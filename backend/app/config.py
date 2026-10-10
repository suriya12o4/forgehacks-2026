import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
HEATMAP_DIR = DATA_DIR / "heatmaps"
PROCESSED_DIR = DATA_DIR / "processed"
SYNTHETIC_DIR = DATA_DIR / "synthetic"

# Ensure runtime directories exist
for p in [DATA_DIR, UPLOAD_DIR, HEATMAP_DIR, PROCESSED_DIR, SYNTHETIC_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# Database config (SQLite default for local portability, configurable for PostgreSQL)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'radiant_ai.db'}")

# Model Configuration
DEFAULT_MODEL_NAME = "DenseNet-121 (Torchvision / CheXpert Taxonomy)"
MODEL_VERSION = "1.0.0-research"
DEVICE = os.getenv("DEVICE", "cpu")

# NIH / CheXpert multi-label taxonomy (14 clinically validated abnormality targets)
CHEST_XRAY_LABELS = [
    "Atelectasis",
    "Cardiomegaly",
    "Consolidation",
    "Edema",
    "Pleural Effusion",
    "Pneumonia",
    "Pneumothorax",
    "Infiltration",
    "Lung Opacity",
    "Nodule / Mass",
    "Pleural Thickening",
    "Support Devices",
    "Fracture",
    "No Finding"
]

# Baseline probability decision thresholds (can be customized or calibrated)
DEFAULT_THRESHOLDS = {
    "Atelectasis": 0.35,
    "Cardiomegaly": 0.40,
    "Consolidation": 0.38,
    "Edema": 0.36,
    "Pleural Effusion": 0.35,
    "Pneumonia": 0.30,
    "Pneumothorax": 0.25,  # High sensitivity critical condition
    "Infiltration": 0.35,
    "Lung Opacity": 0.40,
    "Nodule / Mass": 0.30,
    "Pleural Thickening": 0.35,
    "Support Devices": 0.45,
    "Fracture": 0.28,
    "No Finding": 0.50
}

# LLM Adapter config
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "deterministic_fallback") # Options: deterministic_fallback, openai, custom_api
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
