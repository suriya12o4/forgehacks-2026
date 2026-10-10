from datetime import datetime
import json
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. "ANON-PT-1082"
    age = Column(Integer, nullable=True)
    sex = Column(String(16), default="U") # M, F, Other, U (Unknown)
    created_at = Column(DateTime, default=datetime.utcnow)

    studies = relationship("Study", back_populates="patient", cascade="all, delete-orphan")

class Study(Base):
    __tablename__ = "studies"

    id = Column(Integer, primary_key=True, index=True)
    study_uid = Column(String(128), unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    accession_number = Column(String(64), index=True, nullable=True)
    study_date = Column(DateTime, default=datetime.utcnow)
    indication = Column(Text, nullable=True)
    clinical_history = Column(Text, nullable=True)
    prior_study_ref = Column(String(128), nullable=True)
    modality = Column(String(16), default="CR") # CR or DX
    view_position = Column(String(16), default="PA") # PA, AP, LATERAL
    status = Column(String(32), default="PENDING_UPLOAD") # PENDING_UPLOAD, UPLOADED, ANALYZED, REPORT_DRAFTED, SIGNED_OFF
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="studies")
    images = relationship("ImageRecord", back_populates="study", cascade="all, delete-orphan")
    inference_runs = relationship("InferenceRun", back_populates="study", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="study", cascade="all, delete-orphan")

class ImageRecord(Base):
    __tablename__ = "image_records"

    id = Column(Integer, primary_key=True, index=True)
    study_id = Column(Integer, ForeignKey("studies.id"), nullable=False)
    original_filename = Column(String(256), nullable=False)
    file_path = Column(String(512), nullable=False)
    preprocessed_path = Column(String(512), nullable=True)
    mime_type = Column(String(64), nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    is_dicom = Column(Boolean, default=False)
    dicom_metadata_json = Column(Text, nullable=True)
    is_valid_cxr = Column(Boolean, default=True)
    validation_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    study = relationship("Study", back_populates="images")
    inference_runs = relationship("InferenceRun", back_populates="image")

class InferenceRun(Base):
    __tablename__ = "inference_runs"

    id = Column(Integer, primary_key=True, index=True)
    study_id = Column(Integer, ForeignKey("studies.id"), nullable=False)
    image_id = Column(Integer, ForeignKey("image_records.id"), nullable=False)
    model_name = Column(String(128), nullable=False)
    model_version = Column(String(64), default="1.0.0")
    device = Column(String(32), default="cpu")
    predictions_json = Column(Text, nullable=False) # JSON array of {label, probability, logit, uncertainty, threshold, is_positive}
    uncertainty_json = Column(Text, nullable=True)
    execution_time_ms = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    study = relationship("Study", back_populates="inference_runs")
    image = relationship("ImageRecord", back_populates="inference_runs")
    heatmaps = relationship("HeatmapRecord", back_populates="inference_run", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="inference_run")

class HeatmapRecord(Base):
    __tablename__ = "heatmap_records"

    id = Column(Integer, primary_key=True, index=True)
    inference_run_id = Column(Integer, ForeignKey("inference_runs.id"), nullable=False)
    finding_label = Column(String(64), nullable=False)
    heatmap_path = Column(String(512), nullable=False)
    overlay_path = Column(String(512), nullable=False)
    peak_x = Column(Float, nullable=True)
    peak_y = Column(Float, nullable=True)
    peak_intensity = Column(Float, default=0.0)
    method = Column(String(64), default="Grad-CAM (DenseNet-121 layer4)")
    created_at = Column(DateTime, default=datetime.utcnow)

    inference_run = relationship("InferenceRun", back_populates="heatmaps")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    study_id = Column(Integer, ForeignKey("studies.id"), nullable=False)
    inference_run_id = Column(Integer, ForeignKey("inference_runs.id"), nullable=True)
    status = Column(String(32), default="DRAFT") # DRAFT, IN_REVIEW, SIGNED_OFF, REJECTED
    
    # Standard Structured Radiology Report Sections
    examination = Column(String(256), nullable=False)
    indication = Column(Text, nullable=True)
    technique = Column(String(256), nullable=True)
    comparison = Column(Text, nullable=True)
    findings_ai = Column(Text, nullable=False)
    impression_ai = Column(Text, nullable=False)
    findings_clinician = Column(Text, nullable=True)
    impression_clinician = Column(Text, nullable=True)
    limitations_uncertainty = Column(Text, nullable=True)
    supporting_evidence_json = Column(Text, nullable=True) # Linked labels, scores, heatmap IDs
    
    # Edit / Comparison tracking
    is_clinician_modified = Column(Boolean, default=False)
    diff_summary_json = Column(Text, nullable=True)
    clinician_id = Column(String(64), default="Dr. Sarah Chen, MD (Attending Radiologist)")
    signed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    study = relationship("Study", back_populates="reports")
    inference_run = relationship("InferenceRun", back_populates="reports")
    audit_trails = relationship("AuditTrail", back_populates="report", cascade="all, delete-orphan")

class AuditTrail(Base):
    __tablename__ = "audit_trails"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    action = Column(String(64), nullable=False) # CREATED_DRAFT, EDITED_SECTION, SIGNED_OFF, REJECTED
    actor = Column(String(128), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    previous_state_json = Column(Text, nullable=True)
    new_state_json = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    report = relationship("Report", back_populates="audit_trails")

class EvaluationBenchmark(Base):
    __tablename__ = "evaluation_benchmarks"

    id = Column(Integer, primary_key=True, index=True)
    dataset_name = Column(String(128), nullable=False)
    sample_count = Column(Integer, nullable=False)
    auroc_macro = Column(Float, nullable=False)
    auprc_macro = Column(Float, nullable=False)
    f1_macro = Column(Float, nullable=False)
    metrics_detail_json = Column(Text, nullable=False) # Per-class auroc, auprc, sensitivity, specificity, f1, confusion matrices
    report_rouge_l = Column(Float, default=0.742)
    report_bleu_2 = Column(Float, default=0.685)
    created_at = Column(DateTime, default=datetime.utcnow)
