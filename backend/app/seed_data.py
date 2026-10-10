import logging
import json
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session

from backend.app.config import SYNTHETIC_DIR, UPLOAD_DIR
from backend.app.models.db_models import Patient, Study, ImageRecord, EvaluationBenchmark
from backend.app.dataset.dataset_adapter import generate_synthetic_chest_xray
from backend.app.evaluation.evaluation_service import EvaluationService

logger = logging.getLogger("radiant_ai.seed")

DEMO_CASES = [
    {
        "patient_id": "ANON-PT-4091",
        "age": 62,
        "sex": "M",
        "accession": "ACC-2026-8812",
        "view": "PA",
        "indication": "Progressive dyspnea on exertion, orthopnea, and lower extremity edema.",
        "history": "Known ischemic cardiomyopathy (LVEF 30%), coronary artery disease, hypertension.",
        "prior_ref": "Chest radiograph 6 months prior showing mild cardiomegaly without overt edema.",
        "pathology": "Cardiomegaly",
        "secondary_pathology": "Edema"
    },
    {
        "patient_id": "ANON-PT-3104",
        "age": 47,
        "sex": "F",
        "accession": "ACC-2026-8940",
        "view": "PA",
        "indication": "Fever (39.1 C), purulent cough, and right-sided pleuritic chest pain for 4 days.",
        "history": "No prior cardiopulmonary disease. Nonsmoker. Oxygen saturation 92% on ambient air.",
        "prior_ref": None,
        "pathology": "Consolidation",
        "secondary_pathology": "Pneumonia"
    },
    {
        "patient_id": "ANON-PT-5290",
        "age": 71,
        "sex": "M",
        "accession": "ACC-2026-9014",
        "view": "PA",
        "indication": "Subacute dyspnea and dullness to percussion over the right lung base.",
        "history": "History of prostate adenocarcinoma and chronic kidney disease stage 3.",
        "prior_ref": "Chest radiograph 1 year ago was clear.",
        "pathology": "Pleural Effusion",
        "secondary_pathology": "Atelectasis"
    },
    {
        "patient_id": "ANON-PT-1845",
        "age": 28,
        "sex": "M",
        "accession": "ACC-2026-9122",
        "view": "PA",
        "indication": "Acute onset left sharp chest pain and tachypnea following heavy weightlifting.",
        "history": "Tall, thin habitus. Active smoker (5 pack-years). No prior medical history.",
        "prior_ref": None,
        "pathology": "Pneumothorax",
        "secondary_pathology": None
    },
    {
        "patient_id": "ANON-PT-6028",
        "age": 36,
        "sex": "F",
        "accession": "ACC-2026-9280",
        "view": "PA",
        "indication": "Routine pre-operative clearance evaluation prior to elective laparoscopic cholecystectomy.",
        "history": "Asymptomatic. No cardiopulmonary complaints.",
        "prior_ref": None,
        "pathology": "Normal",
        "secondary_pathology": None
    }
]

def seed_database(db: Session):
    """Populates initial realistic demo studies, synthetic DICOM/PNG images, and benchmarks."""
    # Check if already seeded
    if db.query(Patient).count() > 0:
        logger.info("Database already contains data. Skipping initial seeding.")
        return

    logger.info("Seeding database with synthetic demo radiology cases...")

    for i, case in enumerate(DEMO_CASES):
        # 1. Create Patient
        patient = Patient(
            patient_id=case["patient_id"],
            age=case["age"],
            sex=case["sex"],
            created_at=datetime.utcnow() - timedelta(days=5 - i)
        )
        db.add(patient)
        db.flush()

        # 2. Create Study
        study = Study(
            study_uid=f"1.2.840.113619.2.55.3.{8000 + i}",
            patient_id=patient.id,
            accession_number=case["accession"],
            study_date=datetime.utcnow() - timedelta(days=5 - i, hours=i * 3),
            indication=case["indication"],
            clinical_history=case["history"],
            prior_study_ref=case["prior_ref"],
            modality="CR",
            view_position=case["view"],
            status="PENDING_UPLOAD"
        )
        db.add(study)
        db.flush()

        # 3. Generate synthetic X-ray image (PNG + DICOM)
        file_stem = f"case_{i+1}_{case['patient_id']}"
        target_png = UPLOAD_DIR / f"{file_stem}.png"
        
        png_path, dcm_path = generate_synthetic_chest_xray(
            finding_type=case["pathology"],
            output_path=target_png
        )

        # 4. Create ImageRecord
        img_rec = ImageRecord(
            study_id=study.id,
            original_filename=target_png.name,
            file_path=str(png_path),
            preprocessed_path=str(png_path),
            mime_type="image/png",
            width=512,
            height=512,
            is_dicom=dcm_path is not None,
            dicom_metadata_json='{"Modality": "CR", "ViewPosition": "PA", "BitsAllocated": 16}',
            is_valid_cxr=True,
            validation_notes="Synthetic calibrated reference study."
        )
        db.add(img_rec)
        study.status = "UPLOADED"

    # Seed benchmark metrics
    bench = EvaluationService.get_benchmark_metrics()
    eval_record = EvaluationBenchmark(
        dataset_name=bench["dataset_name"],
        sample_count=bench["sample_count"],
        auroc_macro=bench["auroc_macro"],
        auprc_macro=bench["auprc_macro"],
        f1_macro=bench["f1_macro"],
        metrics_detail_json=json.dumps(bench["metrics"]),
        report_rouge_l=bench["report_rouge_l"],
        report_bleu_2=bench["report_bleu_2"]
    )
    db.add(eval_record)

    db.commit()
    logger.info("Database seeding successfully completed!")
