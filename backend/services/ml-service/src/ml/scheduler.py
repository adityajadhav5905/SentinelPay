"""
Anomalyze ML Service - Scheduled Retraining

This module handles automatic model retraining:
1. Daily scheduled job (configurable interval)
2. Fetches recent transactions from PostgreSQL
3. Extracts features and retrains the model
4. Saves new model version with timestamp
5. Auto-promotes new model if validation passes

This ensures the model stays up-to-date with evolving user behavior.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Optional
import structlog
import asyncpg
import numpy as np
import pandas as pd

from src.config import get_settings
from src.ml.model import get_model
from src.ml.training import FEATURE_NAMES, preprocess_data

logger = structlog.get_logger()


class ScheduledRetrainer:
    """
    Handles automatic model retraining with two triggers:
    1. Time-based: retrain every N hours (configurable)
    2. Adaptive: retrain when N new transactions have been processed
    
    Fetches transactions from PostgreSQL, extracts features,
    and retrains the Isolation Forest model.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._pg_pool: Optional[asyncpg.Pool] = None
        self._task: Optional[asyncio.Task] = None
        
        # Configuration from env vars
        self._retrain_interval_hours = self.settings.retrain_interval_hours
        self._min_samples_for_retrain = self.settings.min_samples_for_retrain
        self._transaction_threshold = self.settings.retrain_transaction_threshold
        self._lookback_days = 7  # Use last 7 days of data
        self._contamination = 0.05  # Expected anomaly rate
        self._check_interval_seconds = 300  # Check every 5 minutes
        
        # State
        self._last_retrain: Optional[datetime] = None
        self._is_running = False
        self._transactions_since_retrain = 0
        self._lock = asyncio.Lock()
    
    def notify_transactions_processed(self, count: int = 1) -> None:
        """
        Called by the Kafka consumer after processing transactions.
        Increments the counter that drives adaptive retraining.
        """
        self._transactions_since_retrain += count
    
    async def start(self) -> bool:
        """Start the scheduled retraining loop."""
        if not self.settings.database_url:
            logger.warning("retrainer_disabled", reason="No DATABASE_URL")
            return False
        
        try:
            self._pg_pool = await asyncpg.create_pool(
                self.settings.database_url,
                min_size=1,
                max_size=3,
                command_timeout=60
            )
            logger.info("retrainer_connected_to_postgres")
            
            self._is_running = True
            self._task = asyncio.create_task(self._retrain_loop())
            logger.info(
                "scheduled_retrainer_started",
                interval_hours=self._retrain_interval_hours,
                transaction_threshold=self._transaction_threshold,
                min_samples=self._min_samples_for_retrain,
                lookback_days=self._lookback_days
            )
            return True
        except Exception as e:
            logger.error("retrainer_start_failed", error=str(e))
            return False
    
    async def stop(self) -> None:
        """Stop the retraining loop."""
        self._is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        if self._pg_pool:
            await self._pg_pool.close()
        
        logger.info("scheduled_retrainer_stopped")
    
    async def _retrain_loop(self) -> None:
        """
        Main retraining loop — checks every 5 minutes for two triggers:
        1. Time elapsed >= retrain_interval_hours since last retrain
        2. Transactions processed >= retrain_transaction_threshold
        """
        while self._is_running:
            try:
                await asyncio.sleep(self._check_interval_seconds)
                
                should_retrain = False
                reason = ""
                
                # Check time-based trigger
                if self._last_retrain is None:
                    elapsed_hours = self._retrain_interval_hours + 1
                else:
                    elapsed_hours = (datetime.now() - self._last_retrain).total_seconds() / 3600
                
                if elapsed_hours >= self._retrain_interval_hours:
                    should_retrain = True
                    reason = f"time_elapsed ({elapsed_hours:.1f}h >= {self._retrain_interval_hours}h)"
                
                # Check transaction-count trigger
                if self._transactions_since_retrain >= self._transaction_threshold:
                    should_retrain = True
                    reason = f"transaction_threshold ({self._transactions_since_retrain} >= {self._transaction_threshold})"
                
                if should_retrain:
                    logger.info(
                        "adaptive_retrain_triggered",
                        reason=reason,
                        transactions_since_retrain=self._transactions_since_retrain
                    )
                    async with self._lock:
                        await self.retrain_from_transactions()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("retrain_loop_error", error=str(e))
                await asyncio.sleep(60)  # Wait 1 min on error
    
    async def retrain_from_transactions(self) -> dict:
        """
        Retrain model using recent transactions from PostgreSQL.
        
        Returns:
            dict: Training results including success status
        """
        logger.info("starting_scheduled_retrain")
        
        if not self._pg_pool:
            return {"success": False, "error": "No database connection"}
        
        try:
            # 1. Fetch recent transactions
            transactions = await self._fetch_recent_transactions()
            
            if len(transactions) < self._min_samples_for_retrain:
                logger.info(
                    "retrain_skipped_insufficient_data",
                    found=len(transactions),
                    required=self._min_samples_for_retrain
                )
                return {
                    "success": False,
                    "reason": "Insufficient data",
                    "samples_found": len(transactions),
                    "samples_required": self._min_samples_for_retrain
                }
            
            # 2. Fetch user profiles for feature extraction
            profiles = await self._fetch_user_profiles(transactions)
            
            # 3. Extract features from transactions
            features_df = self._extract_training_features(transactions, profiles)
            
            # 4. Fetch user feedback and apply to training data
            feedback_data = await self._fetch_feedback_data()
            feedback_stats = self._apply_feedback_weighting(
                features_df, feedback_data, transactions, profiles
            )
            
            # 5. Add synthetic anomalies (to ensure model sees some)
            features_df = self._augment_with_synthetic_anomalies(features_df)
            
            # 6. Train new model
            X = preprocess_data(features_df)
            model = get_model()
            
            training_result = model.train(
                X,
                contamination=self._contamination,
                n_estimators=150
            )
            
            # 7. Validate new model
            validation_passed = self._validate_model(model, X)
            
            if validation_passed:
                # 8. Save and promote new model
                new_version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}_auto"
                model._version = new_version
                model.save(self.settings.model_path)
                
                self._last_retrain = datetime.now()
                self._transactions_since_retrain = 0  # Reset adaptive counter
                
                logger.info(
                    "scheduled_retrain_completed",
                    version=new_version,
                    samples=len(X),
                    anomaly_rate=training_result["anomaly_rate"],
                    feedback_applied=feedback_stats
                )
                
                return {
                    "success": True,
                    "version": new_version,
                    "samples_used": len(X),
                    "anomaly_rate": training_result["anomaly_rate"],
                    "feedback_applied": feedback_stats,
                    "retrained_at": self._last_retrain.isoformat()
                }
            else:
                logger.warning("retrain_validation_failed")
                return {"success": False, "reason": "Validation failed"}
            
        except Exception as e:
            logger.error("retrain_failed", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def _fetch_recent_transactions(self) -> list[dict]:
        """Fetch transactions from last N days."""
        cutoff = datetime.now() - timedelta(days=self._lookback_days)
        
        async with self._pg_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT 
                    id, "userId", amount, merchant, category,
                    timestamp, source
                FROM transactions
                WHERE timestamp >= $1
                ORDER BY timestamp DESC
                LIMIT 50000
                """,
                cutoff
            )
        
        logger.info("fetched_transactions", count=len(rows))
        return [dict(row) for row in rows]
    
    async def _fetch_feedback_data(self) -> list[dict]:
        """
        Fetch user feedback on anomalies for active learning.
        
        Returns anomalies where users have provided feedback:
        - isFalsePositive=true  → user says this was normal (resolve)
        - isFalsePositive=false + feedbackAt IS NOT NULL → user confirmed anomaly
        
        Joined with the transaction to get amount/merchant/timestamp.
        """
        cutoff = datetime.now() - timedelta(days=self._lookback_days)
        
        try:
            async with self._pg_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT 
                        a."transactionId",
                        a."userId",
                        a."isFalsePositive",
                        a."feedbackNotes",
                        a.score,
                        t.amount,
                        t.merchant,
                        t.category,
                        t.timestamp
                    FROM anomalies a
                    JOIN transactions t ON t.id = a."transactionId"
                    WHERE a."feedbackAt" IS NOT NULL
                      AND t.timestamp >= $1
                    ORDER BY a."feedbackAt" DESC
                    LIMIT 5000
                    """,
                    cutoff
                )
            
            feedback = [dict(row) for row in rows]
            false_positives = sum(1 for f in feedback if f.get("isFalsePositive"))
            confirmed = len(feedback) - false_positives
            
            logger.info(
                "fetched_feedback",
                total=len(feedback),
                false_positives=false_positives,
                confirmed_anomalies=confirmed
            )
            return feedback
        except Exception as e:
            logger.warning("feedback_fetch_failed", error=str(e))
            return []
    
    # Mapping from resolve reason → which features to push toward normal
    REASON_FEATURE_ADJUSTMENTS = {
        "KNOWN_MERCHANT": {"merchant_familiarity": 0.9},
        "EXPECTED_AMOUNT": {"amount_zscore": 0.0, "amount_percentile": 0.5, "global_amount_flag": 0.0},
        "NORMAL_TIME": {"hour_deviation": 0.1, "day_deviation": 0.1},
        "REGULAR_PATTERN": {"velocity_ratio": 1.0, "time_since_last": 0.15},
        "OTHER": {},  # Generic normal weighting, no specific feature override
        # TEST_TRANSACTION is handled specially — excluded from training entirely
    }
    
    @staticmethod
    def _parse_feedback_reason(feedback_notes: str | None) -> str | None:
        """Parse the [REASON_CODE] from feedbackNotes string."""
        if not feedback_notes:
            return None
        # Format: "[REASON_CODE] optional notes"
        if feedback_notes.startswith("[") and "]" in feedback_notes:
            return feedback_notes[1:feedback_notes.index("]")]
        return None
    
    def _apply_feedback_weighting(
        self,
        features_df: pd.DataFrame,
        feedback_data: list[dict],
        transactions: list[dict],
        profiles: dict
    ) -> dict:
        """
        Apply user feedback to the training dataset with reason-specific
        feature adjustments.
        
        Strategy:
        - False positives with a reason → adjust the SPECIFIC features that
          the reason maps to (e.g. KNOWN_MERCHANT normalizes merchant_familiarity)
          then duplicate 3x as normal training data.
        - TEST_TRANSACTION → skip entirely (don't add to training data)
        - Confirmed anomalies (not resolved) → boost anomalous features.
        
        Returns stats about how many feedback items were applied.
        """
        if not feedback_data:
            return {"false_positives_applied": 0, "confirmed_applied": 0, "skipped_test": 0}
        
        false_positive_features = []
        confirmed_anomaly_features = []
        skipped_test = 0
        reason_counts: dict[str, int] = {}
        
        for fb in feedback_data:
            amount = float(fb.get("amount", 0))
            if amount <= 0:
                continue
            
            user_id = fb.get("userId")
            tx_time = fb.get("timestamp")
            
            profile = profiles.get(user_id, {
                "avg_amount": 50.0,
                "std_amount": 30.0,
                "is_mature": False
            })
            
            # Build features for this transaction
            log_amount = np.log1p(amount)
            avg = profile.get("avg_amount", 50.0)
            std = max(profile.get("std_amount", 30.0), 1.0)
            amount_zscore = np.clip((amount - avg) / std, -5, 10)
            
            if amount < avg * 0.5:
                amount_percentile = 0.25
            elif amount < avg:
                amount_percentile = 0.5
            elif amount < avg * 2:
                amount_percentile = 0.75
            else:
                amount_percentile = 0.95
            
            hour = tx_time.hour if tx_time else 12
            day = tx_time.weekday() if tx_time else 2
            hour_deviation = 0.9 if (2 <= hour <= 5) else 0.1
            day_deviation = 0.3 if day >= 5 else 0.1
            is_new_user = 0.0 if profile.get("is_mature", False) else 1.0
            global_amount_flag = min(np.log1p(max(0, amount - 1000)) / 5, 1.0)
            
            feature_row = {
                "log_amount": log_amount,
                "amount_zscore": amount_zscore,
                "amount_percentile": amount_percentile,
                "velocity_ratio": 1.0,
                "hour_deviation": hour_deviation,
                "day_deviation": day_deviation,
                "time_since_last": 0.15,
                "merchant_familiarity": 0.5,
                "is_new_user": is_new_user,
                "global_amount_flag": global_amount_flag,
            }
            
            if fb.get("isFalsePositive"):
                # Parse the structured reason from feedbackNotes
                reason = self._parse_feedback_reason(fb.get("feedbackNotes"))
                
                # Skip test transactions — they shouldn't influence the model
                if reason == "TEST_TRANSACTION":
                    skipped_test += 1
                    continue
                
                # Apply reason-specific feature corrections
                adjustments = self.REASON_FEATURE_ADJUSTMENTS.get(reason, {})
                corrected = feature_row.copy()
                for feature_name, normal_value in adjustments.items():
                    corrected[feature_name] = normal_value
                
                reason_counts[reason or "UNKNOWN"] = reason_counts.get(reason or "UNKNOWN", 0) + 1
                false_positive_features.append(corrected)
            else:
                # User confirmed this IS an anomaly → boost anomalous features
                boosted = feature_row.copy()
                boosted["amount_zscore"] = max(amount_zscore, 3.0)
                boosted["velocity_ratio"] = max(boosted["velocity_ratio"], 4.0)
                boosted["merchant_familiarity"] = min(boosted["merchant_familiarity"], 0.1)
                confirmed_anomaly_features.append(boosted)
        
        # Apply false positives: duplicate 3x to emphasize normality
        if false_positive_features:
            fp_df = pd.DataFrame(false_positive_features * 3)
            features_df = pd.concat([features_df, fp_df], ignore_index=True)
            logger.info(
                "feedback_false_positives_applied",
                count=len(false_positive_features),
                rows_added=len(fp_df),
                reasons=reason_counts
            )
        
        # Apply confirmed anomalies
        if confirmed_anomaly_features:
            ca_df = pd.DataFrame(confirmed_anomaly_features)
            features_df = pd.concat([features_df, ca_df], ignore_index=True)
            logger.info(
                "feedback_confirmed_anomalies_applied",
                count=len(confirmed_anomaly_features)
            )
        
        return {
            "false_positives_applied": len(false_positive_features),
            "confirmed_applied": len(confirmed_anomaly_features),
            "skipped_test": skipped_test,
            "reasons": reason_counts
        }
    
    async def _fetch_user_profiles(self, transactions: list[dict]) -> dict:
        """Fetch user profiles for users in transactions."""
        user_ids = list(set(tx["userId"] for tx in transactions if tx.get("userId")))
        
        if not user_ids:
            return {}
        
        async with self._pg_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT "userId", "avgAmount", "stdAmount", "totalTransactions", "isMature"
                FROM user_behavior_profiles
                WHERE "userId" = ANY($1)
                """,
                user_ids
            )
        
        profiles = {}
        for row in rows:
            profiles[row["userId"]] = {
                "avg_amount": row["avgAmount"],
                "std_amount": row["stdAmount"],
                "total_transactions": row["totalTransactions"],
                "is_mature": row["isMature"]
            }
        
        return profiles
    
    def _extract_training_features(
        self,
        transactions: list[dict],
        profiles: dict
    ) -> pd.DataFrame:
        """Extract features from real transactions for training."""
        features_list = []
        
        for tx in transactions:
            user_id = tx.get("userId")
            amount = float(tx.get("amount", 0))
            tx_time = tx.get("timestamp")
            
            if amount <= 0:
                continue
            
            # Get user profile or use defaults
            profile = profiles.get(user_id, {
                "avg_amount": 50.0,
                "std_amount": 30.0,
                "is_mature": False
            })
            
            # Extract features matching FEATURE_NAMES
            log_amount = np.log1p(amount)
            
            # Z-score
            avg = profile.get("avg_amount", 50.0)
            std = max(profile.get("std_amount", 30.0), 1.0)
            amount_zscore = np.clip((amount - avg) / std, -5, 10)
            
            # Percentile (estimate)
            if amount < avg * 0.5:
                amount_percentile = 0.25
            elif amount < avg:
                amount_percentile = 0.5
            elif amount < avg * 2:
                amount_percentile = 0.75
            else:
                amount_percentile = 0.95
            
            # Time-based features
            hour = tx_time.hour if tx_time else 12
            day = tx_time.weekday() if tx_time else 2
            
            hour_deviation = 0.9 if (2 <= hour <= 5) else 0.1
            day_deviation = 0.3 if day >= 5 else 0.1
            
            # Default other features for normal transactions
            velocity_ratio = np.random.lognormal(0, 0.3)  # Around 1.0
            time_since_last = np.random.uniform(0, 0.3)
            merchant_familiarity = np.random.uniform(0.3, 1.0)
            is_new_user = 0.0 if profile.get("is_mature", False) else 1.0
            global_amount_flag = min(np.log1p(max(0, amount - 1000)) / 5, 1.0)
            
            features_list.append({
                "log_amount": log_amount,
                "amount_zscore": amount_zscore,
                "amount_percentile": amount_percentile,
                "velocity_ratio": velocity_ratio,
                "hour_deviation": hour_deviation,
                "day_deviation": day_deviation,
                "time_since_last": time_since_last,
                "merchant_familiarity": merchant_familiarity,
                "is_new_user": is_new_user,
                "global_amount_flag": global_amount_flag,
            })
        
        return pd.DataFrame(features_list)
    
    def _augment_with_synthetic_anomalies(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add synthetic anomalies to ensure model sees edge cases."""
        n_anomalies = max(50, int(len(df) * 0.03))  # At least 3%
        
        anomalies = []
        for _ in range(n_anomalies):
            # Random anomaly type
            anomaly_type = np.random.choice(["amount", "velocity", "time"])
            
            if anomaly_type == "amount":
                anomalies.append({
                    "log_amount": np.log1p(np.random.lognormal(7, 0.8)),
                    "amount_zscore": np.random.uniform(3, 8),
                    "amount_percentile": np.random.uniform(0.95, 1.0),
                    "velocity_ratio": np.random.uniform(0.5, 2.0),
                    "hour_deviation": np.random.uniform(0, 0.4),
                    "day_deviation": np.random.uniform(0, 0.3),
                    "time_since_last": np.random.uniform(0, 0.4),
                    "merchant_familiarity": np.random.uniform(0, 0.5),
                    "is_new_user": np.random.choice([0, 1]),
                    "global_amount_flag": np.random.uniform(0.5, 1.0),
                })
            elif anomaly_type == "velocity":
                anomalies.append({
                    "log_amount": np.log1p(np.random.lognormal(4, 0.6)),
                    "amount_zscore": np.random.uniform(-1, 2),
                    "amount_percentile": np.random.uniform(0.3, 0.8),
                    "velocity_ratio": np.random.uniform(5, 10),
                    "hour_deviation": np.random.uniform(0, 0.5),
                    "day_deviation": np.random.uniform(0, 0.4),
                    "time_since_last": np.random.uniform(0.7, 1.0),
                    "merchant_familiarity": np.random.uniform(0, 0.4),
                    "is_new_user": np.random.choice([0, 1]),
                    "global_amount_flag": 0.0,
                })
            else:  # time
                anomalies.append({
                    "log_amount": np.log1p(np.random.lognormal(4.5, 0.7)),
                    "amount_zscore": np.random.uniform(-0.5, 1.5),
                    "amount_percentile": np.random.uniform(0.4, 0.85),
                    "velocity_ratio": np.random.uniform(0.5, 2.5),
                    "hour_deviation": np.random.uniform(0.7, 1.0),
                    "day_deviation": np.random.uniform(0.6, 1.0),
                    "time_since_last": np.random.uniform(0, 0.5),
                    "merchant_familiarity": np.random.uniform(0.1, 0.6),
                    "is_new_user": np.random.choice([0, 1]),
                    "global_amount_flag": 0.0,
                })
        
        anomalies_df = pd.DataFrame(anomalies)
        combined = pd.concat([df, anomalies_df], ignore_index=True)
        return combined.sample(frac=1).reset_index(drop=True)  # Shuffle
    
    def _validate_model(self, model, X: np.ndarray) -> bool:
        """
        Validate new model before promotion.
        
        Checks:
        1. Anomaly rate is within expected range
        2. Model can make predictions
        """
        try:
            # Test prediction
            test_features = X[0].reshape(1, -1)
            score, pred, _ = model.predict(test_features)
            
            # Check anomaly rate on training data
            predictions = model._model.predict(X)
            anomaly_rate = sum(predictions == -1) / len(predictions)
            
            # Validate: rate should be 2-10%
            if 0.02 <= anomaly_rate <= 0.10:
                return True
            else:
                logger.warning(
                    "validation_anomaly_rate_out_of_range",
                    rate=anomaly_rate
                )
                return False
            
        except Exception as e:
            logger.error("validation_failed", error=str(e))
            return False
    
    @property
    def last_retrain(self) -> Optional[datetime]:
        return self._last_retrain
    
    @property
    def is_running(self) -> bool:
        return self._is_running


# Global instance
_retrainer: Optional[ScheduledRetrainer] = None


def get_retrainer() -> ScheduledRetrainer:
    """Get the global retrainer instance."""
    global _retrainer
    if _retrainer is None:
        _retrainer = ScheduledRetrainer()
    return _retrainer
