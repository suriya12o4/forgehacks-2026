import io
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.config import (
    UPLOAD_DIR,
    HEATMAP_DIR,
    DEFAULT_MODEL_NAME,
    MODEL_VERSION,
    CHEST_XRAY_LABELS,
    DEFAULT_THRESHOLDS
)
from backend.app.models.db_models import (
    Patient,
    Study,
    ImageRecord,
    InferenceRun,
    HeatmapRecord,
    Report,
    AuditTrail,
    EvaluationBenchmark
)
from backend.app.models.schemas import (
    StudyCreate,
    StudyUpdate,
    ReportUpdateRequest,
    ReportGenerateRequest
)
from backend.app.pipeline.stage_a_ingestion import validate_and_decode_image
from backend.app.pipeline.stage_b_classification import get_classifier
from backend.app.pipeline.stage_c_explainability import get_explainer
from backend.app.pipeline.stage_d_clinical_context import ClinicalContextIntegrator
from backend.app.pipeline.stage_e_report_generator import MultimodalReportGenerator
from backend.app.pipeline.stage_f_review_workflow import ReviewWorkflowManager
from backend.app.evaluation.evaluation_service import EvaluationService
from backend.app.seed_data import seed_database

logger = logging.getLogger("radiant_ai.api")
router = APIRouter()

def serialize_image(img: ImageRecord) -> Dict[str, Any]:
    file_stem = Path(img.file_path).name
    prep_stem = Path(img.preprocessed_path).name if img.preprocessed_path else file_stem
    meta_json = json.loads(img.dicom_metadata_json) if img.dicom_metadata_json else None

    return {
        "id": img.id,
        "original_filename": img.original_filename,
        "mime_type": img.mime_type,
        "width": img.width,
        "height": img.height,
        "is_dicom": img.is_dicom,
        "dicom_metadata": meta_json,
        "is_valid_cxr": img.is_valid_cxr,
        "validation_notes": img.validation_notes,
        "original_url": f"/api/files/uploads/{file_stem}",
        "preprocessed_url": f"/api/files/uploads/{prep_stem}" if img.preprocessed_path else None,
        "created_at": img.created_at.isoformat()
    }

def serialize_inference(inf: Optional[InferenceRun]) -> Optional[Dict[str, Any]]:
    if not inf:
        return None
    preds = json.loads(inf.predictions_json)
    positives = [p["label"] for p in preds if p.get("is_positive") and p["label"] != "No Finding"]
    has_crit = any(p in ["Pneumothorax", "Edema", "Consolidation", "Pleural Effusion"] for p in positives)

    return {
        "run_id": inf.id,
        "study_id": inf.study_id,
        "image_id": inf.image_id,
        "model_name": inf.model_name,
        "model_version": inf.model_version,
        "device": inf.device,
        "execution_time_ms": inf.execution_time_ms,
        "predictions": preds,
        "positive_findings": positives,
        "has_critical_findings": has_crit,
        "created_at": inf.created_at.isoformat()
    }

def serialize_report(rep: Optional[Report]) -> Optional[Dict[str, Any]]:
    if not rep:
        return None
    evidence = json.loads(rep.supporting_evidence_json) if rep.supporting_evidence_json else []
    diff_data = json.loads(rep.diff_summary_json) if rep.diff_summary_json else None

    return {
        "id": rep.id,
        "study_id": rep.study_id,
        "inference_run_id": rep.inference_run_id,
        "status": rep.status,
        "examination": rep.examination,
        "indication": rep.indication,
        "technique": rep.technique,
        "comparison": rep.comparison,
        "findings_ai": rep.findings_ai,
        "impression_ai": rep.impression_ai,
        "findings_clinician": rep.findings_clinician or rep.findings_ai,
        "impression_clinician": rep.impression_clinician or rep.impression_ai,
        "limitations_uncertainty": rep.limitations_uncertainty,
        "supporting_evidence": evidence,
        "is_clinician_modified": rep.is_clinician_modified,
        "diff_summary": diff_data,
        "clinician_id": rep.clinician_id,
        "signed_at": rep.signed_at.isoformat() if rep.signed_at else None,
        "created_at": rep.created_at.isoformat(),
        "updated_at": rep.updated_at.isoformat()
    }


# --- Studies Endpoints ---

@router.get("/studies")
def list_studies(db: Session = Depends(get_db)):
    """Lists all radiology studies with patient demographics and current status."""
    studies = db.query(Study).order_by(Study.study_date.desc()).all()
    results = []
    for s in studies:
        latest_inf = db.query(InferenceRun).filter(InferenceRun.study_id == s.id).order_by(InferenceRun.created_at.desc()).first()
        latest_rep = db.query(Report).filter(Report.study_id == s.id).order_by(Report.created_at.desc()).first()
        imgs = db.query(ImageRecord).filter(ImageRecord.study_id == s.id).all()
        
        primary_img = imgs[0] if imgs else None
        thumb_url = None
        if primary_img:
            file_name = Path(primary_img.preprocessed_path or primary_img.file_path).name
            thumb_url = f"/api/files/uploads/{file_name}"

        results.append({
            "id": s.id,
            "study_uid": s.study_uid,
            "accession_number": s.accession_number,
            "patient_id": s.patient.patient_id,
            "patient_age": s.patient.age,
            "patient_sex": s.patient.sex,
            "indication": s.indication,
            "clinical_history": s.clinical_history,
            "study_date": s.study_date.isoformat(),
            "status": s.status,
            "view_position": s.view_position,
            "thumbnail_url": thumb_url,
            "has_inference": latest_inf is not None,
            "has_report": latest_rep is not None,
            "report_status": latest_rep.status if latest_rep else None,
        })
    return results


@router.post("/studies")
def create_study(payload: StudyCreate, db: Session = Depends(get_db)):
    """Creates a new study with structured clinical context."""
    # Find or create patient
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        patient = Patient(
            patient_id=payload.patient_id,
            age=payload.age,
            sex=payload.sex or "U"
        )
        db.add(patient)
        db.flush()

    study_uid = f"1.2.840.113619.2.55.3.{int(datetime.utcnow().timestamp())}"
    accession = f"ACC-{datetime.utcnow().strftime('%Y%m%d')}-{patient.id:04d}"

    study = Study(
        study_uid=study_uid,
        patient_id=patient.id,
        accession_number=accession,
        study_date=datetime.utcnow(),
        indication=payload.indication,
        clinical_history=payload.clinical_history,
        prior_study_ref=payload.prior_study_ref,
        modality="CR",
        view_position=payload.view_position or "PA",
        status="PENDING_UPLOAD"
    )
    db.add(study)
    db.commit()
    db.refresh(study)

    return {"study_id": study.id, "accession_number": accession, "message": "Study created successfully."}


@router.get("/studies/{study_id}")
def get_study(study_id: int, db: Session = Depends(get_db)):
    """Retrieves complete study data including patient history, images, AI predictions, and reports."""
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found.")

    images = db.query(ImageRecord).filter(ImageRecord.study_id == study_id).all()
    latest_inf = db.query(InferenceRun).filter(InferenceRun.study_id == study_id).order_by(InferenceRun.created_at.desc()).first()
    latest_rep = db.query(Report).filter(Report.study_id == study_id).order_by(Report.created_at.desc()).first()

    # Prior studies for patient
    prior_studies = db.query(Study).filter(Study.patient_id == study.patient_id, Study.id != study.id).all()
    priors_list = [
        {
            "id": p.id,
            "accession_number": p.accession_number,
            "study_date": p.study_date.isoformat(),
            "indication": p.indication,
            "status": p.status
        }
        for p in prior_studies
    ]

    return {
        "id": study.id,
        "study_uid": study.study_uid,
        "accession_number": study.accession_number,
        "study_date": study.study_date.isoformat(),
        "indication": study.indication,
        "clinical_history": study.clinical_history,
        "prior_study_ref": study.prior_study_ref,
        "modality": study.modality,
        "view_position": study.view_position,
        "status": study.status,
        "patient": {
            "id": study.patient.id,
            "patient_id": study.patient.patient_id,
            "age": study.patient.age,
            "sex": study.patient.sex,
        },
        "prior_studies": priors_list,
        "images": [serialize_image(img) for img in images],
        "latest_inference": serialize_inference(latest_inf),
        "latest_report": serialize_report(latest_rep),
    }


# --- Stage A: Image Upload & Validation ---

@router.post("/studies/{study_id}/upload")
async def upload_image(study_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Stage A: Uploads chest radiograph (PNG, JPG, DICOM), executes de-identification and validation."""
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    is_valid, message, metadata, orig_path, prep_path = validate_and_decode_image(
        file_bytes=content,
        filename=file.filename or "uploaded_cxr.png",
        output_dir=UPLOAD_DIR
    )

    if not is_valid:
        raise HTTPException(status_code=422, detail=f"Image validation failed: {message}")

    img_rec = ImageRecord(
        study_id=study.id,
        original_filename=file.filename or "uploaded_cxr.png",
        file_path=str(orig_path),
        preprocessed_path=str(prep_path) if prep_path else str(orig_path),
        mime_type=file.content_type or "image/png",
        width=metadata.get("width"),
        height=metadata.get("height"),
        is_dicom=metadata.get("is_dicom", False),
        dicom_metadata_json=json.dumps(metadata) if metadata.get("is_dicom") else None,
        is_valid_cxr=is_valid,
        validation_notes=message
    )
    db.add(img_rec)
    study.status = "UPLOADED"
    db.commit()
    db.refresh(img_rec)

    return {
        "message": "Image validated and uploaded successfully.",
        "image": serialize_image(img_rec),
        "validation_notes": message
    }


# --- Stages B & C: Analysis & Explainability ---

@router.post("/studies/{study_id}/analyze")
def analyze_study(study_id: int, db: Session = Depends(get_db)):
    """
    Executes Stage B (Abnormality Classification) & Stage C (Grad-CAM Heatmaps)
    using the active PyTorch DenseNet-121 model.
    """
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found.")

    img = db.query(ImageRecord).filter(ImageRecord.study_id == study_id).order_by(ImageRecord.created_at.desc()).first()
    if not img:
        raise HTTPException(status_code=400, detail="No image found for this study. Please upload an image first.")

    target_image_path = Path(img.preprocessed_path or img.file_path)
    if not target_image_path.exists():
        raise HTTPException(status_code=500, detail="Target image file not found on disk.")

    classifier = get_classifier()
    predictions, meta = classifier.predict(target_image_path)

    # Save inference run
    inf_run = InferenceRun(
        study_id=study.id,
        image_id=img.id,
        model_name=meta["model_name"],
        model_version=meta["model_version"],
        device=meta["device"],
        predictions_json=json.dumps(predictions),
        uncertainty_json=json.dumps({"positive_findings": meta["positive_findings"]}),
        execution_time_ms=meta["execution_time_ms"]
    )
    db.add(inf_run)
    db.flush()

    # Stage C: Generate Grad-CAM for top 3 positive or highest-scoring classes
    explainer = get_explainer()
    # Rank by probability
    sorted_labels = sorted(predictions, key=lambda x: x["probability"], reverse=True)
    heatmaps_generated = []

    # Pick top findings (up to 3) to compute Grad-CAM
    classes_to_explain = [p["label"] for p in sorted_labels[:3] if p["label"] != "No Finding"]
    if not classes_to_explain:
        # If all low, explain top category
        classes_to_explain = [sorted_labels[0]["label"]]

    for label_name in classes_to_explain:
        try:
            class_idx = classifier.labels.index(label_name)
            cam_path, overlay_path, cam_meta = explainer.generate_heatmap(
                image_path=target_image_path,
                target_class_idx=class_idx,
                output_dir=HEATMAP_DIR,
                prefix=f"study_{study.id}_inf_{inf_run.id}"
            )

            h_rec = HeatmapRecord(
                inference_run_id=inf_run.id,
                finding_label=label_name,
                heatmap_path=str(cam_path),
                overlay_path=str(overlay_path),
                peak_x=cam_meta["peak_x"],
                peak_y=cam_meta["peak_y"],
                peak_intensity=cam_meta["peak_intensity"],
                method=cam_meta["method"]
            )
            db.add(h_rec)
            heatmaps_generated.append(label_name)
        except Exception as e:
            logger.warning(f"Grad-CAM generation failed for {label_name}: {e}")

    study.status = "ANALYZED"
    db.commit()
    db.refresh(inf_run)

    return {
        "message": "Inference and explainability pipeline completed.",
        "inference": serialize_inference(inf_run),
        "heatmaps_count": len(heatmaps_generated)
    }


@router.get("/studies/{study_id}/heatmaps")
def get_study_heatmaps(study_id: int, db: Session = Depends(get_db)):
    """Returns all Grad-CAM heatmaps for the study's latest inference run."""
    inf_run = db.query(InferenceRun).filter(InferenceRun.study_id == study_id).order_by(InferenceRun.created_at.desc()).first()
    if not inf_run:
        return []

    heatmaps = db.query(HeatmapRecord).filter(HeatmapRecord.inference_run_id == inf_run.id).all()
    results = []
    for h in heatmaps:
        h_name = Path(h.heatmap_path).name
        o_name = Path(h.overlay_path).name
        results.append({
            "id": h.id,
            "finding_label": h.finding_label,
            "heatmap_url": f"/api/files/heatmaps/{h_name}",
            "overlay_url": f"/api/files/heatmaps/{o_name}",
            "peak_x": h.peak_x,
            "peak_y": h.peak_y,
            "peak_intensity": h.peak_intensity,
            "method": h.method,
            "disclaimer": (
                "Heatmaps are approximate model feature attribution explanations and "
                "do not establish that an abnormality exists."
            )
        })
    return results


# --- Stage E: Draft Report Generation ---

@router.post("/studies/{study_id}/generate-report")
def generate_report(study_id: int, payload: ReportGenerateRequest, db: Session = Depends(get_db)):
    """
    Stage E: Combines structured clinical context and model outputs to synthesize
    an evidence-grounded draft radiology report.
    """
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found.")

    inf_run = db.query(InferenceRun).filter(InferenceRun.study_id == study_id).order_by(InferenceRun.created_at.desc()).first()
    if not inf_run:
        raise HTTPException(status_code=400, detail="Must run AI analysis before generating report.")

    predictions = json.loads(inf_run.predictions_json)
    positives = [p["label"] for p in predictions if p.get("is_positive") and p["label"] != "No Finding"]

    # Stage D: Clinical Concordance
    concordance = ClinicalContextIntegrator.evaluate_clinical_concordance(
        indication=study.indication or "None provided",
        clinical_history=study.clinical_history,
        positive_findings=positives
    )

    # Stage E: Generate report draft
    generator = MultimodalReportGenerator(provider=payload.model_provider or "deterministic_fallback")
    draft = generator.generate_draft(
        examination=f"Chest Radiograph, Single View ({study.view_position})",
        indication=study.indication or "Indication unspecified",
        clinical_history=study.clinical_history,
        view_position=study.view_position,
        prior_study_ref=study.prior_study_ref,
        predictions=predictions,
        concordance_info=concordance
    )

    # Save report in DB
    report = Report(
        study_id=study.id,
        inference_run_id=inf_run.id,
        status="DRAFT",
        examination=draft["examination"],
        indication=draft["indication"],
        technique=draft["technique"],
        comparison=draft["comparison"],
        findings_ai=draft["findings_ai"],
        impression_ai=draft["impression_ai"],
        findings_clinician=draft["findings_ai"],
        impression_clinician=draft["impression_ai"],
        limitations_uncertainty=draft["limitations_uncertainty"],
        supporting_evidence_json=json.dumps(draft.get("supporting_evidence", [])),
        is_clinician_modified=False,
        diff_summary_json=None,
        clinician_id="Dr. Sarah Chen, MD (Attending Radiologist)"
    )
    db.add(report)
    db.flush()

    # Initial audit log
    audit = AuditTrail(
        report_id=report.id,
        action="CREATED_DRAFT",
        actor="RadiantAI Copilot Engine",
        timestamp=datetime.utcnow(),
        new_state_json=json.dumps({"status": "DRAFT", "provider": draft.get("provider_used")}),
        notes="Automated draft report generated and routed for radiologist verification."
    )
    db.add(audit)
    study.status = "REPORT_DRAFTED"
    db.commit()
    db.refresh(report)

    return {
        "message": "Draft report generated successfully.",
        "report": serialize_report(report)
    }


# --- Stage F: Clinician Review & Audit ---

@router.put("/studies/{study_id}/report")
def update_report(study_id: int, payload: ReportUpdateRequest, db: Session = Depends(get_db)):
    """Stage F: Saves radiologist edits, computes word/sentence diffs, logs revision in audit trail."""
    report = db.query(Report).filter(Report.study_id == study_id).order_by(Report.created_at.desc()).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found for this study.")

    updated_report = ReviewWorkflowManager.apply_clinician_edits(
        db=db,
        report=report,
        revised_findings=payload.findings_clinician,
        revised_impression=payload.impression_clinician,
        clinician_id=payload.clinician_id or "Dr. Sarah Chen, MD (Attending Radiologist)",
        notes=payload.notes or "Clinician modified report sections."
    )

    return {
        "message": "Clinician report edits saved successfully.",
        "report": serialize_report(updated_report)
    }


@router.post("/studies/{study_id}/report/sign-off")
def sign_off_report(study_id: int, clinician_id: str = Form("Dr. Sarah Chen, MD (Attending Radiologist)"), db: Session = Depends(get_db)):
    """Stage F: Clinician electronically signs off and finalizes the report."""
    study = db.query(Study).filter(Study.id == study_id).first()
    report = db.query(Report).filter(Report.study_id == study_id).order_by(Report.created_at.desc()).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    finalized = ReviewWorkflowManager.sign_off_report(
        db=db,
        report=report,
        clinician_id=clinician_id
    )
    study.status = "SIGNED_OFF"
    db.commit()

    return {
        "message": "Report successfully finalized and signed off.",
        "report": serialize_report(finalized)
    }


# --- Evaluation & Benchmarks ---

@router.get("/evaluation/metrics")
def get_evaluation_metrics(db: Session = Depends(get_db)):
    """Returns evaluation benchmark metrics (AUROC, AUPRC, confusion matrices, ROUGE-L)."""
    bench = EvaluationService.get_benchmark_metrics()
    return bench


# --- Demo Data Seed ---

@router.post("/demo/seed")
def seed_demo_data(db: Session = Depends(get_db)):
    """Populates or resets realistic synthetic radiology demo cases."""
    seed_database(db)
    return {"message": "Demo cases seeded successfully."}


# --- Safe Static File Serving for DICOM / Images / Heatmaps ---

@router.get("/files/uploads/{filename}")
def serve_upload(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(file_path)

@router.get("/files/heatmaps/{filename}")
def serve_heatmap(filename: str):
    file_path = HEATMAP_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Heatmap file not found.")
    return FileResponse(file_path)
