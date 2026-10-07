"""
Anomalyze ML Service - Profile Repository

Hybrid storage layer that uses:
- Redis: Hot cache for fast reads (real-time inference)
- PostgreSQL: Persistent storage (survives restarts, enables analytics)

Data Flow:
1. Read: Check Redis cache → If miss, load from Postgres → Cache in Redis
2. Write: Update Redis immediately → Async batch write to Postgres
"""
import asyncio
import json
from datetime import datetime
from typing import Optional
import structlog
import redis
import asyncpg
from contextlib import asynccontextmanager

from src.config import get_settings
from src.models.user_profile import UserProfile, create_default_profile

logger = structlog.get_logger()


class ProfileRepository:
    """
    Hybrid repository for user behavioral profiles.
    
    Uses Redis for real-time access and PostgreSQL for persistence.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._redis: Optional[redis.Redis] = None
        self._pg_pool: Optional[asyncpg.Pool] = None
        self._local_cache: dict[str, UserProfile] = {}
        
        # Write buffer for async Postgres updates
        self._write_buffer: dict[str, UserProfile] = {}
        self._write_task: Optional[asyncio.Task] = None
        
        # Config
        self._cache_ttl = 3600  # 1 hour Redis TTL
        self._flush_interval = 60  # Flush to Postgres every 60 seconds
    
    async def connect(self) -> bool:
        """Connect to both Redis and PostgreSQL."""
        redis_ok = self._connect_redis()
        pg_ok = await self._connect_postgres()
        
        # Start background flush task
        if pg_ok and self._write_task is None:
            self._write_task = asyncio.create_task(self._flush_loop())
        
        return redis_ok and pg_ok
    
    def _connect_redis(self) -> bool:
        """Connect to Redis."""
        try:
            self._redis = redis.from_url(
                self.settings.redis_url,
                decode_responses=True
            )
            self._redis.ping()
            logger.info("profile_repo_redis_connected")
            return True
        except Exception as e:
            logger.warning("profile_repo_redis_failed", error=str(e))
            return False
    
    async def _connect_postgres(self) -> bool:
        """Connect to PostgreSQL."""
        if not self.settings.database_url:
            logger.info("profile_repo_postgres_disabled", reason="No DATABASE_URL")
            return False
        
        try:
            self._pg_pool = await asyncpg.create_pool(
                self.settings.database_url,
                min_size=2,
                max_size=10,
                command_timeout=30
            )
            logger.info("profile_repo_postgres_connected")
            return True
        except Exception as e:
            logger.warning("profile_repo_postgres_failed", error=str(e))
            return False
    
    async def close(self) -> None:
        """Close connections and flush pending writes."""
        # Cancel flush task
        if self._write_task:
            self._write_task.cancel()
            try:
                await self._write_task
            except asyncio.CancelledError:
                pass
        
        # Final flush
        await self._flush_to_postgres()
        
        # Close Postgres pool
        if self._pg_pool:
            await self._pg_pool.close()
        
        logger.info("profile_repo_closed")
    
    async def get_profile(self, user_id: str) -> UserProfile:
        """
        Get user profile with cache-through pattern.
        
        1. Check local cache
        2. Check Redis
        3. Load from PostgreSQL
        4. Create default if not found
        """
        # 1. Local cache (fastest)
        if user_id in self._local_cache:
            return self._local_cache[user_id]
        
        # 2. Redis cache
        profile = self._get_from_redis(user_id)
        if profile:
            self._local_cache[user_id] = profile
            return profile
        
        # 3. PostgreSQL (persistent)
        profile = await self._get_from_postgres(user_id)
        if profile:
            self._local_cache[user_id] = profile
            self._save_to_redis(profile)
            return profile
        
        # 4. Create default
        profile = create_default_profile(user_id)
        self._local_cache[user_id] = profile
        return profile
    
    async def save_profile(self, profile: UserProfile, immediate_persist: bool = False) -> bool:
        """
        Save profile with write-behind pattern.
        
        Always updates Redis immediately.
        PostgreSQL updates are buffered and flushed periodically,
        unless immediate_persist=True.
        """
        # Update local cache
        self._local_cache[profile.user_id] = profile
        
        # Update Redis immediately
        self._save_to_redis(profile)
        
        # Queue for PostgreSQL
        self._write_buffer[profile.user_id] = profile
        
        # Immediate persist if requested
        if immediate_persist:
            if self._pg_pool:
                logger.info("save_profile_persisting_immediate", user_id=profile.user_id)
                success = await self._persist_profile(profile)
                if not success:
                    logger.error("save_profile_persist_failed", user_id=profile.user_id)
            else:
                logger.warning("save_profile_no_pg_pool", user_id=profile.user_id)
        
        return True

    def _get_from_redis(self, user_id: str) -> Optional[UserProfile]:
        """Load profile from Redis cache."""
        if not self._redis:
            return None
        
        try:
            key = f"profile:{user_id}"
            data = self._redis.get(key)
            if data:
                return UserProfile.from_redis_dict(json.loads(data))
            return None
        except Exception as e:
            logger.warning("redis_get_failed", user_id=user_id, error=str(e))
            return None
    
    def _save_to_redis(self, profile: UserProfile) -> bool:
        """Save profile to Redis cache."""
        if not self._redis:
            return False
        
        try:
            key = f"profile:{profile.user_id}"
            data = json.dumps(profile.to_redis_dict())
            self._redis.setex(key, self._cache_ttl, data)
            return True
        except Exception as e:
            logger.warning("redis_save_failed", user_id=profile.user_id, error=str(e))
            return False
    
    async def _get_from_postgres(self, user_id: str) -> Optional[UserProfile]:
        """Load profile from PostgreSQL."""
        if not self._pg_pool:
            return None
        
        try:
            async with self._pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT * FROM user_behavior_profiles 
                    WHERE "userId" = $1
                    """,
                    user_id
                )
                
                if row:
                    return self._row_to_profile(row)
                return None
        except Exception as e:
            logger.warning("postgres_get_failed", user_id=user_id, error=str(e))
            return None

    async def _persist_profile(self, profile: UserProfile) -> bool:
        """Persist single profile to PostgreSQL."""
        if not self._pg_pool:
            logger.warning("persist_profile_no_pool", user_id=profile.user_id)
            return False
            
        logger.info("persist_profile_start", user_id=profile.user_id)
        
        try:
            # Calculate profile status
            profile_status = 'NEW'
            data_months = 0.0
            min_months = 6.0
            
            # Normalize timestamps to naive UTC
            first_tx = profile.first_transaction_at
            if first_tx and first_tx.tzinfo:
                first_tx = first_tx.replace(tzinfo=None)
            
            last_tx = profile.last_transaction_at
            if last_tx and last_tx.tzinfo:
                last_tx = last_tx.replace(tzinfo=None)
            
            if first_tx and last_tx:
                delta = last_tx - first_tx
                data_months = delta.days / 30.44
            
            if profile.total_transactions > 0:
                if data_months >= min_months and profile.is_mature:
                    profile_status = 'READY'
                else:
                    profile_status = 'INCOMPLETE'
            
            logger.info("persist_profile_executing_query", user_id=profile.user_id, status=profile_status)
            
            async with self._pg_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO user_behavior_profiles (
                        id, "userId",
                        "profileStatus", "dataMonthsCovered", "minMonthsRequired",
                        "avgAmount", "stdAmount", "minAmount", "maxAmount", 
                        "medianAmount", "p95Amount",
                        "hourDistribution", "dayDistribution", 
                        "peakHours", "activeDays",
                        "avgDailyCount", "avg10minCount", "avgGapSeconds",
                        "merchantCounts", "uniqueMerchants",
                        "totalTransactions", "isMature", "maturityThreshold",
                        "recentAmounts",
                        "firstTransactionAt", "lastTransactionAt",
                        "createdAt", "updatedAt"
                    ) VALUES (
                        gen_random_uuid(), $1,
                        $2, $3, $4,
                        $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14,
                        $15, $16, $17,
                        $18, $19,
                        $20, $21, $22,
                        $23,
                        $24, $25,
                        NOW(), NOW()
                    )
                    ON CONFLICT ("userId") DO UPDATE SET
                        "profileStatus" = EXCLUDED."profileStatus",
                        "dataMonthsCovered" = EXCLUDED."dataMonthsCovered",
                        "minMonthsRequired" = EXCLUDED."minMonthsRequired",
                        "avgAmount" = EXCLUDED."avgAmount",
                        "stdAmount" = EXCLUDED."stdAmount",
                        "minAmount" = EXCLUDED."minAmount",
                        "maxAmount" = EXCLUDED."maxAmount",
                        "medianAmount" = EXCLUDED."medianAmount",
                        "p95Amount" = EXCLUDED."p95Amount",
                        "hourDistribution" = EXCLUDED."hourDistribution",
                        "dayDistribution" = EXCLUDED."dayDistribution",
                        "peakHours" = EXCLUDED."peakHours",
                        "activeDays" = EXCLUDED."activeDays",
                        "avgDailyCount" = EXCLUDED."avgDailyCount",
                        "avg10minCount" = EXCLUDED."avg10minCount",
                        "avgGapSeconds" = EXCLUDED."avgGapSeconds",
                        "merchantCounts" = EXCLUDED."merchantCounts",
                        "uniqueMerchants" = EXCLUDED."uniqueMerchants",
                        "totalTransactions" = EXCLUDED."totalTransactions",
                        "isMature" = EXCLUDED."isMature",
                        "recentAmounts" = EXCLUDED."recentAmounts",
                        "lastTransactionAt" = EXCLUDED."lastTransactionAt",
                        "updatedAt" = NOW()
                    """,
                    profile.user_id,
                    profile_status,
                    data_months,
                    min_months,
                    profile.spending.avg_amount,
                    profile.spending.std_amount,
                    profile.spending.min_amount,
                    profile.spending.max_amount,
                    profile.spending.median_amount,
                    profile.spending.p95_amount,
                    json.dumps(profile.time_patterns.hour_distribution),
                    json.dumps(profile.time_patterns.day_distribution),
                    profile.time_patterns.peak_hours,
                    profile.time_patterns.active_days,
                    profile.velocity.avg_daily_count,
                    profile.velocity.avg_10min_count,
                    profile.velocity.avg_gap_seconds,
                    json.dumps(profile.merchants.merchant_counts),
                    profile.merchants.unique_merchants,
                    profile.total_transactions,
                    profile.is_mature,
                    profile.maturity_threshold,
                    json.dumps(profile.recent_amounts),
                    first_tx,
                    last_tx,
                )
            return True
        except Exception as e:
            logger.error("postgres_persist_failed", user_id=profile.user_id, error=str(e))
            return False
    
    async def _flush_to_postgres(self) -> None:
        """Flush all buffered profiles to PostgreSQL."""
        if not self._write_buffer or not self._pg_pool:
            return
        
        profiles = list(self._write_buffer.values())
        self._write_buffer.clear()
        
        logger.info("flushing_profiles", count=len(profiles))
        
        for profile in profiles:
            await self._persist_profile(profile)
    
    async def _flush_loop(self) -> None:
        """Background task to periodically flush to PostgreSQL."""
        while True:
            try:
                await asyncio.sleep(self._flush_interval)
                await self._flush_to_postgres()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("flush_loop_error", error=str(e))
    
    def _row_to_profile(self, row: asyncpg.Record) -> UserProfile:
        """Convert PostgreSQL row to UserProfile."""
        from src.models.user_profile import (
            UserProfile, SpendingStats, TimePatterns, 
            VelocityPatterns, MerchantPatterns
        )
        
        return UserProfile(
            user_id=row["userId"],
            spending=SpendingStats(
                avg_amount=row["avgAmount"],
                std_amount=row["stdAmount"],
                min_amount=row["minAmount"],
                max_amount=row["maxAmount"],
                median_amount=row["medianAmount"],
                p95_amount=row["p95Amount"],
            ),
            time_patterns=TimePatterns(
                hour_distribution=json.loads(row["hourDistribution"]) if row["hourDistribution"] else [1/24]*24,
                day_distribution=json.loads(row["dayDistribution"]) if row["dayDistribution"] else [1/7]*7,
                peak_hours=list(row["peakHours"]) if row["peakHours"] else list(range(9, 21)),
                active_days=list(row["activeDays"]) if row["activeDays"] else list(range(5)),
            ),
            velocity=VelocityPatterns(
                avg_daily_count=row["avgDailyCount"],
                avg_10min_count=row["avg10minCount"],
                avg_gap_seconds=row["avgGapSeconds"],
            ),
            merchants=MerchantPatterns(
                merchant_counts=json.loads(row["merchantCounts"]) if row["merchantCounts"] else {},
                unique_merchants=row["uniqueMerchants"],
            ),
            total_transactions=row["totalTransactions"],
            is_mature=row["isMature"],
            maturity_threshold=row["maturityThreshold"],
            recent_amounts=json.loads(row["recentAmounts"]) if row["recentAmounts"] else [],
            first_transaction_at=row["firstTransactionAt"],
            last_transaction_at=row["lastTransactionAt"],
            profile_created_at=row["createdAt"],
            profile_updated_at=row["updatedAt"],
        )
    
    @property
    def is_redis_connected(self) -> bool:
        if not self._redis:
            return False
        try:
            self._redis.ping()
            return True
        except:
            return False
    
    @property
    def is_postgres_connected(self) -> bool:
        return self._pg_pool is not None
    
    async def rebuild_profile_from_transactions(self, user_id: str) -> dict:
        """
        Rebuild a user's behavior profile from ALL their historical transactions.
        
        This is a profile-only operation — NO anomaly detection is performed.
        Used after a PROFILE_HISTORY CSV upload to build the user's behavioral
        baseline from historical data.
        
        Returns:
            dict with rebuild results (status, transaction_count, months_covered, etc.)
        """
        if not self._pg_pool:
            return {"success": False, "error": "PostgreSQL not connected"}
        
        try:
            async with self._pg_pool.acquire() as conn:
                # Fetch ALL transactions for this user, sorted by timestamp
                rows = await conn.fetch(
                    """
                    SELECT amount, timestamp, merchant, category, location
                    FROM transactions
                    WHERE "userId" = $1
                    ORDER BY timestamp ASC
                    """,
                    user_id
                )
            
            if not rows:
                return {
                    "success": True,
                    "message": "No transactions found for user",
                    "transaction_count": 0,
                    "profile_status": "NEW"
                }
            
            # Create a fresh profile and replay all transactions
            profile = create_default_profile(user_id)
            
            for row in rows:
                profile.update_with_transaction(
                    amount=float(row["amount"]),
                    timestamp=row["timestamp"],
                    merchant=row.get("merchant"),
                    category=row.get("category"),
                    location=row.get("location")
                )
            
            # Calculate data coverage
            data_months = 0.0
            if profile.first_transaction_at and profile.last_transaction_at:
                delta = profile.last_transaction_at - profile.first_transaction_at
                data_months = delta.days / 30.44
            
            # Determine profile status
            min_months = 6.0
            if data_months >= min_months and profile.is_mature:
                profile_status = "READY"
            elif profile.total_transactions > 0:
                profile_status = "INCOMPLETE"
            else:
                profile_status = "NEW"
            
            # Save to Redis + PostgreSQL
            self._local_cache[profile.user_id] = profile
            self._save_to_redis(profile)
            await self._persist_profile(profile)
            
            logger.info(
                "profile_rebuilt",
                user_id=user_id,
                transaction_count=len(rows),
                data_months=round(data_months, 1),
                profile_status=profile_status,
                is_mature=profile.is_mature
            )
            
            return {
                "success": True,
                "transaction_count": len(rows),
                "data_months_covered": round(data_months, 1),
                "profile_status": profile_status,
                "is_mature": profile.is_mature,
                "avg_amount": round(profile.spending.avg_amount, 2),
                "total_transactions": profile.total_transactions
            }
            
        except Exception as e:
            logger.error("profile_rebuild_failed", user_id=user_id, error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_profile_status(self, user_id: str) -> dict:
        """
        Get the profile readiness status for a user.
        
        Returns profile status info including maturity, data coverage,
        and whether anomaly detection will be accurate.
        """
        if not self._pg_pool:
            # Fall back to in-memory profile
            profile = await self.get_profile(user_id)
            return {
                "user_id": user_id,
                "profile_status": "READY" if profile.is_mature else ("INCOMPLETE" if profile.total_transactions > 0 else "NEW"),
                "total_transactions": profile.total_transactions,
                "is_mature": profile.is_mature,
                "data_months_covered": 0,
                "min_months_required": 6,
                "avg_amount": round(profile.spending.avg_amount, 2)
            }
        
        try:
            async with self._pg_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT "profileStatus", "dataMonthsCovered", "minMonthsRequired",
                           "totalTransactions", "isMature", "avgAmount",
                           "firstTransactionAt", "lastTransactionAt"
                    FROM user_behavior_profiles
                    WHERE "userId" = $1
                    """,
                    user_id
                )
            
            if not row:
                return {
                    "user_id": user_id,
                    "profile_status": "NEW",
                    "total_transactions": 0,
                    "is_mature": False,
                    "data_months_covered": 0,
                    "min_months_required": 6,
                    "avg_amount": 0
                }
            
            return {
                "user_id": user_id,
                "profile_status": row["profileStatus"],
                "total_transactions": row["totalTransactions"],
                "is_mature": row["isMature"],
                "data_months_covered": round(row["dataMonthsCovered"], 1),
                "min_months_required": row["minMonthsRequired"],
                "avg_amount": round(row["avgAmount"], 2)
            }
            
        except Exception as e:
            logger.warning("get_profile_status_failed", user_id=user_id, error=str(e))
            return {
                "user_id": user_id,
                "profile_status": "NEW",
                "total_transactions": 0,
                "is_mature": False,
                "data_months_covered": 0,
                "min_months_required": 6,
                "avg_amount": 0
            }


# Global instance
_profile_repo: Optional[ProfileRepository] = None


def get_profile_repository() -> ProfileRepository:
    """Get the global profile repository instance."""
    global _profile_repo
    if _profile_repo is None:
        _profile_repo = ProfileRepository()
    return _profile_repo
