import pytest
import io
from pathlib import Path
from PIL import Image
import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import CHEST_XRAY_LABELS, DATA_DIR, UPLOAD_DIR
from backend.app.pipeline.stage_a_ingestion import validate_and_decode_image
from backend.app.pipeline.stage_b_classification import get_classifier
from backend.app.pipeline.stage_c_explainability import get_explainer
from backend.app.pipeline.stage_d_clinical_context import ClinicalContextIntegrator
from backend.app.pipeline.stage_e_report_generator import MultimodalReportGenerator
from backend.app.pipeline.stage_f_review_workflow import ReviewWorkflowManager
from backend.app.evaluation.evaluation_service import EvaluationService, compute_roc_auc_pure, compute_binary_metrics

client = TestClient(app)

def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "pytorch_version" in data

def test_studies_list():
    response = client.get("/api/studies")
    assert response.status_code == 200
    studies = response.json()
    assert isinstance(studies, list)
    assert len(studies) >= 5
    assert "patient_id" in studies[0]

def test_study_details():
    response = client.get("/api/studies/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert "patient" in data
    assert len(data["images"]) >= 1

def test_ingestion_valid_and_rejections(tmp_path):
    # 1. Valid grayscale CXR simulation
    valid_img = Image.new("L", (300, 300), color=50)
    buf = io.BytesIO()
    valid_img.save(buf, format="PNG")
    valid_bytes = buf.getvalue()
    
    is_valid, msg, meta, orig, prep = validate_and_decode_image(valid_bytes, "test_valid.png", tmp_path)
    assert is_valid is True
    assert orig.exists()
    assert prep.exists()

    # 2. Reject empty file
    is_valid_empty, msg_empty, _, _, _ = validate_and_decode_image(b"", "empty.png", tmp_path)
    assert is_valid_empty is False
    assert "empty" in msg_empty.lower()

    # 3. Reject corrupt image
    is_valid_corrupt, msg_corrupt, _, _, _ = validate_and_decode_image(b"not an image data", "corrupt.png", tmp_path)
    assert is_valid_corrupt is False

    # 4. Reject small image (< 128x128)
    small_img = Image.new("L", (64, 64), color=50)
    sbuf = io.BytesIO()
    small_img.save(sbuf, format="PNG")
    is_valid_small, msg_small, _, _, _ = validate_and_decode_image(sbuf.getvalue(), "small.png", tmp_path)
    assert is_valid_small is False
    assert "too small" in msg_small.lower()

def test_classification_and_uncertainty():
    classifier = get_classifier()
    # Test on seeded case
    case_path = UPLOAD_DIR / "case_1_ANON-PT-4091.png"
    if case_path.exists():
        preds, meta = classifier.predict(case_path)
        assert len(preds) == len(CHEST_XRAY_LABELS)
        assert meta["execution_time_ms"] > 0
        for p in preds:
            assert 0.0 <= p["probability"] <= 1.0
            assert 0.0 <= p["uncertainty"] <= 1.0
            assert p["confidence_level"] in ["HIGH", "MODERATE", "LOW"]

def test_explainability_gradcam(tmp_path):
    explainer = get_explainer()
    case_path = UPLOAD_DIR / "case_1_ANON-PT-4091.png"
    if case_path.exists():
        cam_path, overlay_path, meta = explainer.generate_heatmap(
            image_path=case_path,
            target_class_idx=1,
            output_dir=tmp_path,
            prefix="test_cam"
        )
        assert cam_path.exists()
        assert overlay_path.exists()
        assert meta["peak_intensity"] > 0.0
        assert "disclaimer" in meta

def test_clinical_concordance():
    integrator = ClinicalContextIntegrator()
    res = integrator.evaluate_clinical_concordance(
        indication="Acute respiratory distress, severe orthopnea",
        clinical_history="Known congestive heart failure",
        positive_findings=["Cardiomegaly", "Edema"]
    )
    assert res["risk_tier"] in ["ELEVATED", "CRITICAL"]
    assert len(res["concordance_notes"]) > 0

def test_multimodal_report_generator():
    generator = MultimodalReportGenerator()
    dummy_preds = [
        {"label": "Cardiomegaly", "probability": 0.82, "threshold": 0.40, "is_positive": True, "uncertainty": 0.12, "confidence_level": "HIGH"},
        {"label": "Edema", "probability": 0.74, "threshold": 0.36, "is_positive": True, "uncertainty": 0.18, "confidence_level": "HIGH"},
        {"label": "No Finding", "probability": 0.05, "threshold": 0.50, "is_positive": False, "uncertainty": 0.08, "confidence_level": "HIGH"}
    ]
    report = generator.generate_draft(
        examination="Chest Radiograph, PA View",
        indication="Shortness of breath and orthopnea",
        clinical_history="Heart failure",
        view_position="PA",
        prior_study_ref=None,
        predictions=dummy_preds,
        concordance_info={}
    )
    assert "Cardiomegaly" in report["findings_ai"] or "enlarged" in report["findings_ai"].lower()
    assert "No prior examinations are available" in report["comparison"]
    assert "MANDATORY HUMAN REVIEW REQUIREMENT" in report["mandatory_review_notice"]

def test_review_workflow_diff():
    ai_text = "Cardiac silhouette is enlarged consistent with cardiomegaly. Lungs demonstrate mild interstitial edema."
    clinician_text = "Cardiac silhouette is moderately enlarged consistent with cardiomegaly. Lungs demonstrate moderate interstitial pulmonary edema with bilateral vascular engorgement."
    
    diff = ReviewWorkflowManager.compute_text_diff(ai_text, clinician_text)
    assert diff["has_modifications"] is True
    assert diff["similarity_ratio"] < 1.0
    assert len(diff["diff_chunks"]) > 0

def test_evaluation_metrics_service():
    bench = EvaluationService.get_benchmark_metrics()
    assert bench["sample_count"] == 500
    assert bench["auroc_macro"] > 0.80
    assert len(bench["metrics"]) >= 10
    
    # Test pure ROC AUC calculation
    y_true = np.array([1, 1, 0, 0])
    y_score = np.array([0.9, 0.8, 0.2, 0.1])
    auc_val = compute_roc_auc_pure(y_true, y_score)
    assert auc_val == 1.0

    metrics = compute_binary_metrics(y_true, y_score, threshold=0.5)
    assert metrics["tp"] == 2
    assert metrics["tn"] == 2
    assert metrics["fp"] == 0
    assert metrics["fn"] == 0
    assert metrics["f1"] == 1.0
