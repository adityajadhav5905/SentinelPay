import sys
import os
from pathlib import Path

# Add project root to python path so imports work
# Assumes script is in /app/scripts/train_initial.py and we need /app in path
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
sys.path.append(str(project_root))

from src.ml.training import generate_enhanced_dataset, preprocess_data
from src.ml.model import get_model
from src.config import get_settings

def main():
    print("🚀 Starting initial model training...")
    
    # Generate data
    print("📊 Generating synthetic data...")
    df = generate_enhanced_dataset(n_samples=5000, anomaly_ratio=0.05)
    X = preprocess_data(df)
    
    # Train model
    print(f"🧠 Training Isolation Forest on {len(X)} samples...")
    model = get_model()
    metrics = model.train(X, contamination=0.05, n_estimators=200)
    print(f"✅ Training complete. Metrics: {metrics}")
    
    # Save model
    settings = get_settings()
    model_path = settings.model_path 
    
    print(f"💾 Saving model to {model_path}...")
    if model.save(model_path):
        print(f"✅ Model saved successfully to {model_path}")
    else:
        print("❌ Failed to save model")
        sys.exit(1)

if __name__ == "__main__":
    main()
