from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# Patient Schemas
class PatientBase(BaseModel):
    patient_id: str
    age: Optional[int] = None
    sex: Optional[str] = "U"

class PatientResponse(PatientBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Study Schemas
class StudyCreate(BaseModel):
    patient_id: Optional[str] = Field("ANON-PT-1001", description="De-identified patient ID")
    age: Optional[int] = Field(54, description="Patient age in years")
    sex: Optional[str] = Field("M", description="Biological sex (M/F/U)")
    indication: str = Field(..., description="Reason for chest radiograph")
    clinical_history: Optional[str] = Field(None, description="Relevant clinical history and comorbidities")
    prior_study_ref: Optional[str] = Field(None, description="Prior radiograph identifier or summary")
    view_position: Optional[str] = Field("PA", description="View position (PA, AP, Lateral)")

class StudyUpdate(BaseModel):
    indication: Optional[str] = None
    clinical_history: Optional[str] = None
    prior_study_ref: Optional[str] = None
    view_position: Optional[str] = None

class ImageRecordResponse(BaseModel):
    id: int
    original_filename: str
    mime_type: str
    width: Optional[int] = None
    height: Optional[int] = None
    is_dicom: bool
    dicom_metadata: Optional[Dict[str, Any]] = None
    is_valid_cxr: bool
    validation_notes: Optional[str] = None
    original_url: str
    preprocessed_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Inference and Prediction Schemas
class ClassPrediction(BaseModel):
    label: str
    probability: float
    uncalibrated_logit: float
    threshold: float
    is_positive: bool
    uncertainty: float
    confidence_level: str  # HIGH, MODERATE, LOW
    heatmap_available: bool

class InferenceResponse(BaseModel):
    run_id: int
    study_id: int
    image_id: int
    model_name: str
    model_version: str
    device: str
    execution_time_ms: float
    predictions: List[ClassPrediction]
    positive_findings: List[str]
    has_critical_findings: bool
    created_at: datetime

# Heatmap Schemas
class HeatmapResponse(BaseModel):
    id: int
    finding_label: str
    heatmap_url: str
    overlay_url: str
    peak_x: Optional[float] = None
    peak_y: Optional[float] = None
    peak_intensity: float
    method: str
    disclaimer: str

# Report Schemas
class ReportGenerateRequest(BaseModel):
    model_provider: Optional[str] = "deterministic_fallback" # or openai, custom_api
    clinician_notes: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    study_id: int
    inference_run_id: Optional[int] = None
    status: str
    examination: str
    indication: Optional[str] = None
    technique: Optional[str] = None
    comparison: Optional[str] = None
    findings_ai: str
    impression_ai: str
    findings_clinician: Optional[str] = None
    impression_clinician: Optional[str] = None
    limitations_uncertainty: Optional[str] = None
    supporting_evidence: Optional[List[Dict[str, Any]]] = None
    is_clinician_modified: bool
    diff_summary: Optional[Dict[str, Any]] = None
    clinician_id: str
    signed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ReportUpdateRequest(BaseModel):
    findings_clinician: str
    impression_clinician: str
    clinician_id: Optional[str] = "Dr. Sarah Chen, MD (Attending Radiologist)"
    notes: Optional[str] = None

class StudyDetailResponse(BaseModel):
    id: int
    study_uid: str
    patient: PatientResponse
    accession_number: Optional[str] = None
    study_date: datetime
    indication: Optional[str] = None
    clinical_history: Optional[str] = None
    prior_study_ref: Optional[str] = None
    modality: str
    view_position: str
    status: str
    images: List[ImageRecordResponse]
    latest_inference: Optional[InferenceResponse] = None
    latest_report: Optional[ReportResponse] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Evaluation Schemas
class MetricDetail(BaseModel):
    label: str
    auroc: float
    auprc: float
    sensitivity: float
    specificity: float
    precision: float
    recall: float
    f1: float
    threshold: float
    tp: int
    fp: int
    fn: int
    tn: int

class EvaluationResponse(BaseModel):
    id: int
    dataset_name: str
    sample_count: int
    auroc_macro: float
    auprc_macro: float
    f1_macro: float
    metrics: List[MetricDetail]
    report_rouge_l: float
    report_bleu_2: float
    clinical_concept_recall: float
    created_at: datetime
