"""
Anomalyze ML Service - Enhanced API Routes

Production-grade REST API with:
- User-specific profile endpoints
- Enhanced inference with feature contributions
- Training with validation
- Comprehensive error handling
"""
from datetime import datetime
import time
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional
import structlog

from src.config import get_settings
from src.api.schemas import (
    HealthResponse, TrainingRequest, TrainingStatusResponse,
    ModelInfo, ModelListResponse, PromoteResponse,
    InferenceRequest, InferenceResponse, AnalysisResult, Verdict, Severity,
    TrainingJobStatus, TransactionData, TransactionMeta, TransactionEnrichment, AnomalyEvent
)
from src.ml.model import get_model
from src.ml.features import get_feature_engineer
from src.kafka.producer import get_producer
from src.kafka.consumer import get_consumer

logger = structlog.get_logger()
router = APIRouter(prefix="/v1", tags=["ML Service"])

# In-memory job tracking
_training_jobs: dict[str, TrainingStatusResponse] = {}


# ============================================
# Enhanced Response Models
# ============================================

class EnhancedInferenceResponse(BaseModel):
    """Enhanced inference response with user context."""
    analysis: AnalysisResult
    verdict: Verdict
    user_context: dict = Field(default_factory=dict)
    feature_contributions: list[dict] = Field(default_factory=list)
    processing_time_ms: float


class UserProfileResponse(BaseModel):
    """User profile summary."""
    user_id: str
    total_transactions: int
    is_mature: bool
    avg_spend: float
    std_spend: float
    peak_hours: list[int]
    top_merchants: list[str]


# ============================================
# Health Check
# ============================================

@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check with service status."""
    model = get_model()
    feature_engineer = get_feature_engineer()
    
    return HealthResponse(
        status="healthy",
        model_version=model.version if model.is_loaded else None,
        kafka_connected=True,
        redis_connected=feature_engineer.is_connected
    )


# ============================================
# Training Endpoints
# ============================================

@router.post("/train", response_model=TrainingStatusResponse)
async def trigger_training(
    request: TrainingRequest,
    background_tasks: BackgroundTasks
) -> TrainingStatusResponse:
    """
    Trigger model training with enhanced 10-feature dataset.
    """
    job_id = str(uuid.uuid4())
    
    job = TrainingStatusResponse(
        job_id=job_id,
        status=TrainingJobStatus.QUEUED,
        progress=0.0,
        message="Training job queued",
        started_at=datetime.now()
    )
    
    _training_jobs[job_id] = job
    background_tasks.add_task(_run_training, job_id, request)
    
    logger.info("training_queued", job_id=job_id)
    return job


async def _run_training(job_id: str, request: TrainingRequest) -> None:
    """Background training job with enhanced features."""
    from src.ml.training import generate_enhanced_dataset, preprocess_data
    
    job = _training_jobs.get(job_id)
    if not job:
        return
    
    try:
        job.status = TrainingJobStatus.RUNNING
        job.message = "Generating training data..."
        job.progress = 0.1
        
        # Generate enhanced dataset
        logger.info("generating_training_data", job_id=job_id)
        df = generate_enhanced_dataset(n_samples=15000, anomaly_ratio=0.05)
        
        job.progress = 0.3
        job.message = "Preprocessing features..."
        
        X = preprocess_data(df)
        
        job.progress = 0.5
        job.message = "Training Isolation Forest (10 features)..."
        
        # Train with enhanced settings
        model = get_model()
        training_result = model.train(
            X,
            contamination=0.05,
            n_estimators=150
        )
        
        job.progress = 0.8
        job.message = "Saving model..."
        
        # Save model
        settings = get_settings()
        new_version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        model._version = new_version
        model.save(settings.model_path)
        
        job.progress = 1.0
        job.status = TrainingJobStatus.COMPLETED
        job.message = (
            f"Training completed. Model: {new_version}. "
            f"Detected {training_result['detected_anomalies']} anomalies "
            f"({training_result['anomaly_rate']*100:.1f}%)"
        )
        job.completed_at = datetime.now()
        
        logger.info("training_completed", job_id=job_id, version=new_version)
        
    except Exception as e:
        logger.error("training_failed", job_id=job_id, error=str(e))
        job.status = TrainingJobStatus.FAILED
        job.message = f"Training failed: {str(e)}"


@router.get("/train/{job_id}", response_model=TrainingStatusResponse)
async def get_training_status(job_id: str) -> TrainingStatusResponse:
    """Get training job status."""
    job = _training_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return job


# ============================================
# Model Management
# ============================================

@router.get("/models", response_model=ModelListResponse)
async def list_models() -> ModelListResponse:
    """List available models."""
    model = get_model()
    
    models = []
    if model.is_loaded:
        models.append(ModelInfo(
            version=model.version,
            is_active=True,
            trained_at=datetime.now(),
        ))
    
    return ModelListResponse(
        models=models,
        active_version=model.version if model.is_loaded else None
    )


@router.post("/models/{version}/promote", response_model=PromoteResponse)
async def promote_model(version: str) -> PromoteResponse:
    """Promote a model version to active."""
    model = get_model()
    model_path = f"./models/{version}.pkl"
    
    if model.load(model_path, version=version):
        return PromoteResponse(
            success=True,
            message=f"Model {version} promoted",
            promoted_version=version
        )
    else:
        raise HTTPException(status_code=404, detail=f"Model {version} not found")


# ============================================
# Inference Endpoints
# ============================================

@router.post("/inference", response_model=EnhancedInferenceResponse)
async def enhanced_inference(request: InferenceRequest) -> EnhancedInferenceResponse:
    """
    Run inference with user-specific features.
    
    Returns enhanced response with:
    - User context (profile maturity, avg spend)
    - Feature contributions (why it's anomalous)
    - Detailed verdict with explanation
    """
    start_time = time.time()
    
    model = get_model()
    if not model.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run POST /v1/train first."
        )
    
    feature_engineer = get_feature_engineer()
    if not feature_engineer.is_connected:
        feature_engineer.connect()
    
    # Extract enhanced features
    features, enrichment, profile = feature_engineer.extract_features(
        user_id=request.user_id,
        amount=request.transaction.amount,
        timestamp=datetime.now(),
        merchant=request.transaction.merchant,
        category=request.transaction.category
    )
    
    # Run inference
    ml_score, ml_prediction, details = model.predict(features)
    
    # Generate verdict
    verdict = _generate_enhanced_verdict(
        transaction=request.transaction,
        enrichment=enrichment,
        ml_score=ml_score,
        ml_prediction=ml_prediction,
        contributions=details.get("top_contributors", [])
    )
    
    # Build user context
    user_context = {
        "is_mature_profile": profile.is_mature,
        "total_transactions": profile.total_transactions,
        "avg_spend": round(profile.spending.avg_amount, 2),
        "std_spend": round(profile.spending.std_amount, 2),
    }
    
    processing_time = (time.time() - start_time) * 1000
    
    return EnhancedInferenceResponse(
        analysis=AnalysisResult(
            rule_flags=[],
            ml_score=ml_score,
            ml_prediction=ml_prediction
        ),
        verdict=verdict,
        user_context=user_context,
        feature_contributions=details.get("top_contributors", []),
        processing_time_ms=round(processing_time, 2)
    )


def _generate_enhanced_verdict(
    transaction: TransactionData,
    enrichment: dict,
    ml_score: float,
    ml_prediction: str,
    contributions: list[dict]
) -> Verdict:
    """Generate detailed verdict with explanation from all feature signals."""
    
    explanations = []
    
    # Check amount-based explanations
    zscore = enrichment.get("amount_zscore", 0)
    if zscore > 3:
        explanations.append(
            f"Amount ${transaction.amount:.2f} is {zscore:.1f} std above your average"
        )
    
    # Check velocity
    velocity_ratio = enrichment.get("velocity_ratio", 1)
    if velocity_ratio > 3:
        explanations.append(
            f"Transaction velocity is {velocity_ratio:.1f}x your normal rate"
        )
    
    # Check hour deviation
    hour_dev = enrichment.get("hour_deviation", 0)
    if hour_dev > 0.7:
        explanations.append("Unusual transaction hour for your profile")
    
    # Check new user vulnerability
    if not enrichment.get("is_mature_profile", True) and ml_score >= 0.5:
        total = enrichment.get("total_transactions", 0)
        explanations.append(f"New user with {total} transactions — limited behavioral baseline")
    
    # Use feature contribution labels for remaining signals
    used_features = {"amount_zscore", "velocity_ratio", "hour_deviation", "is_new_user"}
    for contrib in contributions:
        feature = contrib.get("feature", "")
        label = contrib.get("label", "")
        if feature not in used_features and label:
            if feature == "merchant_familiarity":
                explanations.append("Unfamiliar merchant for your profile")
            elif feature == "time_since_last":
                explanations.append("Very short gap since last transaction")
            elif feature == "day_deviation":
                explanations.append("Unusual transaction day for your profile")
            elif feature == "impossible_travel":
                explanations.append("Possible impossible travel detected")
            elif feature == "global_amount_flag":
                explanations.append("Globally unusual transaction amount")
            elif label and feature not in {c.get("feature") for c in contributions[:contributions.index(contrib)]}:
                explanations.append(label)
            used_features.add(feature)
    
    # Determine severity
    if ml_score >= 0.8 or zscore > 5:
        severity = Severity.CRITICAL
    elif ml_score >= 0.6 or zscore > 3:
        severity = Severity.HIGH
    elif ml_score >= 0.4 or zscore > 2:
        severity = Severity.MEDIUM
    else:
        severity = Severity.LOW
    
    # Build explanation string
    if explanations:
        explanation = ". ".join(explanations) + f". ML Score: {ml_score:.2f}"
    elif ml_prediction == "ANOMALY":
        explanation = f"ML model flagged transaction. Score: {ml_score:.2f}"
    else:
        explanation = f"Transaction appears normal. Score: {ml_score:.2f}"
    
    return Verdict(final_severity=severity, explanation=explanation)


# ============================================
# User Profile Endpoints
# ============================================

@router.get("/users/{user_id}/profile", response_model=UserProfileResponse)
async def get_user_profile(user_id: str) -> UserProfileResponse:
    """Get user behavioral profile summary."""
    feature_engineer = get_feature_engineer()
    if not feature_engineer.is_connected:
        feature_engineer.connect()
    
    profile = feature_engineer.get_user_profile(user_id)
    
    return UserProfileResponse(
        user_id=profile.user_id,
        total_transactions=profile.total_transactions,
        is_mature=profile.is_mature,
        avg_spend=round(profile.spending.avg_amount, 2),
        std_spend=round(profile.spending.std_amount, 2),
        peak_hours=profile.time_patterns.peak_hours,
        top_merchants=list(profile.merchants.merchant_counts.keys())[:5]
    )


@router.delete("/users/{user_id}/profile")
async def reset_user_profile(user_id: str) -> dict:
    """Reset user profile (for testing)."""
    feature_engineer = get_feature_engineer()
    
    if feature_engineer._redis:
        key = f"user_profile:{user_id}"
        feature_engineer._redis.delete(key)
        
        # Also clear from cache
        if user_id in feature_engineer._profile_cache:
            del feature_engineer._profile_cache[user_id]
    
    return {"message": f"Profile for {user_id} reset"}


# ============================================
# Profile Status & Rebuild Endpoints
# ============================================

class ProfileStatusResponse(BaseModel):
    """Profile readiness status."""
    user_id: str
    profile_status: str  # NEW, INCOMPLETE, READY
    total_transactions: int
    is_mature: bool
    data_months_covered: float
    min_months_required: float
    avg_amount: float
    confidence_note: Optional[str] = None


class TransactionRecord(BaseModel):
    """Single transaction for profile building."""
    tx_id: Optional[str] = None
    amount: float
    timestamp: str
    merchant: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None


class ProfileBuildRequest(BaseModel):
    """Request to build profile from transactions (in memory, no DB storage)."""
    transactions: list[TransactionRecord]


class ProfileRebuildResponse(BaseModel):
    """Profile rebuild result."""
    success: bool
    transaction_count: int = 0
    data_months_covered: float = 0
    profile_status: str = "NEW"
    is_mature: bool = False
    avg_amount: float = 0
    total_transactions: int = 0
    message: Optional[str] = None
    error: Optional[str] = None


class BatchDetectRequest(BaseModel):
    """Request to batch detect anomalies using split-batch approach."""
    transactions: list[TransactionRecord]
    batch_id: Optional[str] = None


class BatchDetectResponse(BaseModel):
    """Response for split-batch anomaly detection."""
    success: bool
    transaction_count: int = 0
    anomalies_detected: int = 0
    profile_status: str = "NEW"
    message: Optional[str] = None
    error: Optional[str] = None


@router.get("/profile/{user_id}/status", response_model=ProfileStatusResponse)
async def get_profile_status(user_id: str) -> ProfileStatusResponse:
    """
    Get profile readiness status for a user.
    
    Returns whether the user has enough data for accurate anomaly detection.
    """
    from src.repositories.profile_repository import get_profile_repository
    
    repo = get_profile_repository()
    status = await repo.get_profile_status(user_id)
    
    # Add confidence note for non-READY profiles
    confidence_note = None
    if status["profile_status"] == "NEW":
        confidence_note = (
            "Anomaly detection accuracy improves with historical data. "
            "Consider uploading at least 6 months of transaction history."
        )
    elif status["profile_status"] == "INCOMPLETE":
        months = status.get("data_months_covered", 0)
        confidence_note = (
            f"Your behavioral profile is building ({months} months of data). "
            "Detection accuracy will improve as more data is added."
        )
    
    return ProfileStatusResponse(
        **status,
        confidence_note=confidence_note
    )


@router.post("/profile/{user_id}/rebuild", response_model=ProfileRebuildResponse)
async def rebuild_user_profile(
    user_id: str,
    request: ProfileBuildRequest
) -> ProfileRebuildResponse:
    """
    Build user behavioral profile from transactions provided in the request body.
    
    This is a profile-only operation — NO anomaly detection is performed.
    Transactions are processed IN MEMORY and only the aggregated profile
    is saved to the database. No transaction rows are stored.
    """
    from src.repositories.profile_repository import get_profile_repository
    from src.models.user_profile import create_default_profile
    from datetime import datetime as dt
    
    if not request.transactions:
        return ProfileRebuildResponse(
            success=True,
            message="No transactions provided",
            transaction_count=0,
            profile_status="NEW"
        )
    
    logger.info("profile_build_requested", user_id=user_id, tx_count=len(request.transactions))
    
    try:
        # Create a fresh profile and replay all transactions in memory
        profile = create_default_profile(user_id)
        
        for tx in request.transactions:
            try:
                ts = dt.fromisoformat(tx.timestamp.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                try:
                    ts = dt.strptime(tx.timestamp, "%Y-%m-%d %H:%M:%S")
                except (ValueError, AttributeError):
                    ts = dt.now()
            
            profile.update_with_transaction(
                amount=tx.amount,
                timestamp=ts,
                merchant=tx.merchant,
                category=tx.category,
                location=tx.location
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
        
        # Save ONLY the aggregated profile (Redis + PostgreSQL)
        # Using save_profile heavily simplifies things: updates local cache, Redis, and persists to DB
        repo = get_profile_repository()
        await repo.save_profile(profile, immediate_persist=True)
        
        logger.info(
            "profile_built_from_payload",
            user_id=user_id,
            transaction_count=len(request.transactions),
            data_months=round(data_months, 1),
            profile_status=profile_status,
        )
        
        return ProfileRebuildResponse(
            success=True,
            transaction_count=len(request.transactions),
            data_months_covered=round(data_months, 1),
            profile_status=profile_status,
            is_mature=profile.is_mature,
            avg_amount=round(profile.spending.avg_amount, 2),
            total_transactions=profile.total_transactions
        )
        
    except Exception as e:
        logger.error("profile_build_failed", user_id=user_id, error=str(e))
        return ProfileRebuildResponse(success=False, error=str(e))


@router.post("/profile/{user_id}/rebuild-from-db", response_model=ProfileRebuildResponse)
async def rebuild_profile_from_db(user_id: str) -> ProfileRebuildResponse:
    """
    Rebuild user behavioral profile from ALL transactions in the database.
    
    Called after regular BATCH_CSV uploads to ensure the behavioral profile
    reflects all uploaded data, not just what was processed through Kafka.
    """
    from src.repositories.profile_repository import get_profile_repository
    
    try:
        repo = get_profile_repository()
        if not repo.is_postgres_connected:
            await repo.connect()
        
        result = await repo.rebuild_profile_from_transactions(user_id)
        
        if not result.get("success"):
            return ProfileRebuildResponse(
                success=False,
                error=result.get("error", "Unknown error")
            )
        
        return ProfileRebuildResponse(
            success=True,
            transaction_count=result.get("transaction_count", 0),
            data_months_covered=result.get("data_months_covered", 0),
            profile_status=result.get("profile_status", "NEW"),
            is_mature=result.get("is_mature", False),
            avg_amount=result.get("avg_amount", 0),
            total_transactions=result.get("total_transactions", 0),
            message=f"Profile rebuilt from {result.get('transaction_count', 0)} DB transactions"
        )
    except Exception as e:
        logger.error("rebuild_from_db_failed", user_id=user_id, error=str(e))
        return ProfileRebuildResponse(success=False, error=str(e))


@router.post("/profile/{user_id}/batch-detect", response_model=BatchDetectResponse)
async def batch_detect_profile(
    user_id: str,
    request: BatchDetectRequest
) -> BatchDetectResponse:
    """
    Split-batch anomaly detection for initial CSV uploads.
    Splits the transactions in half, detects anomalies bidirectionally using 
    temporary profiles, and finally rebuilds the whole profile.
    """
    from src.repositories.profile_repository import get_profile_repository
    from src.models.user_profile import create_default_profile
    from datetime import datetime as dt
    
    if len(request.transactions) < 30:
        return BatchDetectResponse(
            success=False,
            message="Not enough transactions for split-batch detection (<30)",
            error="Too few transactions"
        )
        
    model = get_model()
    if not model.is_loaded:
        return BatchDetectResponse(
            success=False,
            message="Model not loaded for inference",
            error="Model unavailable"
        )

    feature_engineer = get_feature_engineer()
    if not feature_engineer.is_connected:
        feature_engineer.connect()
        
    producer = get_producer()
    if not producer._producer:
        producer.connect()
        
    consumer = get_consumer() # reusing generate verdict

    temp_id_1 = f"{user_id}_temp_1"
    temp_id_2 = f"{user_id}_temp_2"

    def _parse_ts(tx_ts: str) -> dt:
        try:
            return dt.fromisoformat(tx_ts.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            try:
                return dt.strptime(tx_ts, "%Y-%m-%d %H:%M:%S")
            except (ValueError, AttributeError):
                return dt.now()

    def _clean_temps():
        if feature_engineer._redis:
            feature_engineer._redis.delete(
                f"user_profile:{temp_id_1}", f"user_profile:{temp_id_2}",
                f"velocity:{temp_id_1}", f"velocity:{temp_id_2}"
            )
        if temp_id_1 in feature_engineer._profile_cache:
            del feature_engineer._profile_cache[temp_id_1]
        if temp_id_2 in feature_engineer._profile_cache:
            del feature_engineer._profile_cache[temp_id_2]

    _clean_temps()
    
    try:
        mid = len(request.transactions) // 2
        part1 = request.transactions[:mid]
        part2 = request.transactions[mid:]
        
        # Build Profile 1
        profile1 = create_default_profile(temp_id_1)
        for tx in part1:
            ts = _parse_ts(tx.timestamp)
            profile1.update_with_transaction(tx.amount, ts, tx.merchant, tx.category, tx.location)
        feature_engineer.save_user_profile(profile1)

        # Build Profile 2
        profile2 = create_default_profile(temp_id_2)
        for tx in part2:
            ts = _parse_ts(tx.timestamp)
            profile2.update_with_transaction(tx.amount, ts, tx.merchant, tx.category, tx.location)
        feature_engineer.save_user_profile(profile2)

        anomalies_detected = 0

        async def _detect_batch(txs, target_profile_id):
            nonlocal anomalies_detected
            for i, tx in enumerate(txs):
                ts = _parse_ts(tx.timestamp)
                features, enrichment, p = feature_engineer.extract_features(
                    user_id=target_profile_id,
                    amount=tx.amount,
                    timestamp=ts,
                    merchant=tx.merchant,
                    category=tx.category,
                    location=tx.location
                )
                
                score, pred, details = model.predict(features)
                real_tx_id = tx.tx_id or f"batch_tx_{int(time.time()*1000)}_{i}"
                tx_data = TransactionData(
                    tx_id=real_tx_id,
                    amount=tx.amount,
                    currency="USD",
                    location=tx.location,
                    merchant=tx.merchant,
                    category=tx.category
                )
                
                if pred == "ANOMALY" and score >= 0.55:
                    anomalies_detected += 1
                    verdict = consumer._generate_verdict(tx_data, enrichment, score, pred, ml_details=details)
                    
                    event = AnomalyEvent(
                        meta=TransactionMeta(
                            trace_id=f"ml-batch-{tx_data.tx_id}",
                            timestamp=ts,
                            source="BATCH_CSV",
                            user_id=user_id,
                            end_user_id=user_id,
                            batch_id=request.batch_id
                        ),
                        data=tx_data,
                        enrichment=TransactionEnrichment(**enrichment),
                        analysis=AnalysisResult(rule_flags=[], ml_score=score, ml_prediction=pred),
                        verdict=verdict
                    )
                    await producer.produce_anomaly(event)

        # Detect part2 using profile1, detect part1 using profile2
        await _detect_batch(part2, temp_id_1)
        await _detect_batch(part1, temp_id_2)
        
        # Rebuild official profile
        official_profile = create_default_profile(user_id)
        for tx in request.transactions:
            ts = _parse_ts(tx.timestamp)
            official_profile.update_with_transaction(tx.amount, ts, tx.merchant, tx.category, tx.location)
        
        repo = get_profile_repository()
        await repo.save_profile(official_profile, immediate_persist=True)
        
        # Determine maturity
        data_months = 0.0
        if official_profile.first_transaction_at and official_profile.last_transaction_at:
            delta = official_profile.last_transaction_at - official_profile.first_transaction_at
            data_months = delta.days / 30.44
            
        status = "READY" if (data_months >= 6.0 and official_profile.is_mature) else "INCOMPLETE"

        _clean_temps()
        logger.info("batch_detect_completed", user_id=user_id, anomalies=anomalies_detected)
        
        return BatchDetectResponse(
            success=True,
            transaction_count=len(request.transactions),
            anomalies_detected=anomalies_detected,
            profile_status=status,
            message="Batch split detection complete"
        )
    except Exception as e:
        _clean_temps()
        logger.error("batch_detect_failed", user_id=user_id, error=str(e))
        return BatchDetectResponse(success=False, error=str(e))


# ============================================
# Scheduled Retraining Endpoints
# ============================================

class RetrainStatusResponse(BaseModel):
    """Scheduled retraining status."""
    is_running: bool
    last_retrain: Optional[str] = None
    next_retrain_in_hours: Optional[float] = None
    retrain_interval_hours: int
    transactions_since_retrain: int = 0
    transaction_threshold: int = 200


class ManualRetrainResponse(BaseModel):
    """Manual retrain result."""
    success: bool
    version: Optional[str] = None
    samples_used: Optional[int] = None
    anomaly_rate: Optional[float] = None
    feedback_applied: Optional[dict] = None
    error: Optional[str] = None


@router.get("/retrain/status", response_model=RetrainStatusResponse)
async def get_retrain_status() -> RetrainStatusResponse:
    """Get scheduled retraining status."""
    from src.ml.scheduler import get_retrainer
    
    retrainer = get_retrainer()
    
    interval = retrainer._retrain_interval_hours
    
    next_in_hours = None
    if retrainer.last_retrain:
        elapsed = (datetime.now() - retrainer.last_retrain).total_seconds() / 3600
        next_in_hours = max(0, interval - elapsed)
    
    return RetrainStatusResponse(
        is_running=retrainer.is_running,
        last_retrain=retrainer.last_retrain.isoformat() if retrainer.last_retrain else None,
        next_retrain_in_hours=round(next_in_hours, 1) if next_in_hours else None,
        retrain_interval_hours=interval,
        transactions_since_retrain=retrainer._transactions_since_retrain,
        transaction_threshold=retrainer._transaction_threshold
    )


@router.post("/retrain/trigger", response_model=ManualRetrainResponse)
async def trigger_manual_retrain() -> ManualRetrainResponse:
    """
    Manually trigger model retraining using recent transaction data.
    
    This fetches transactions from the last 7 days, extracts features,
    and retrains the Isolation Forest model.
    """
    from src.ml.scheduler import get_retrainer
    
    retrainer = get_retrainer()
    
    if not retrainer.is_running:
        return ManualRetrainResponse(
            success=False,
            error="Retrainer not running. Set DATABASE_URL to enable."
        )
    
    logger.info("manual_retrain_triggered")
    result = await retrainer.retrain_from_transactions()
    
    return ManualRetrainResponse(
        success=result.get("success", False),
        version=result.get("version"),
        samples_used=result.get("samples_used"),
        anomaly_rate=result.get("anomaly_rate"),
        feedback_applied=result.get("feedback_applied"),
        error=result.get("error") or result.get("reason")
    )
