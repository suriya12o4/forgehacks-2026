export interface Patient {
  id: number;
  patient_id: string;
  age?: number;
  sex?: string;
}

export interface ImageRecord {
  id: number;
  original_filename: string;
  mime_type: string;
  width?: number;
  height?: number;
  is_dicom: boolean;
  dicom_metadata?: Record<string, any>;
  is_valid_cxr: boolean;
  validation_notes?: string;
  original_url: string;
  preprocessed_url?: string;
  created_at: string;
}

export interface ClassPrediction {
  label: string;
  probability: number;
  uncalibrated_logit: number;
  threshold: number;
  is_positive: boolean;
  uncertainty: number;
  confidence_level: 'HIGH' | 'MODERATE' | 'LOW';
  heatmap_available: boolean;
}

export interface InferenceRun {
  run_id: number;
  study_id: number;
  image_id: number;
  model_name: string;
  model_version: string;
  device: string;
  execution_time_ms: number;
  predictions: ClassPrediction[];
  positive_findings: string[];
  has_critical_findings: boolean;
  created_at: string;
}

export interface HeatmapItem {
  id: number;
  finding_label: string;
  heatmap_url: string;
  overlay_url: string;
  peak_x?: number;
  peak_y?: number;
  peak_intensity: number;
  method: string;
  disclaimer: string;
}

export interface DiffChunk {
  type: 'equal' | 'replaced' | 'deleted' | 'inserted';
  text?: string;
  original?: string;
  revised?: string;
}

export interface DiffSummary {
  similarity_ratio: number;
  has_modifications: boolean;
  word_count_ai: number;
  word_count_clinician: number;
  diff_chunks: DiffChunk[];
}

export interface ReportItem {
  id: number;
  study_id: number;
  inference_run_id?: number;
  status: 'DRAFT' | 'IN_REVIEW' | 'SIGNED_OFF' | 'REJECTED';
  examination: string;
  indication?: string;
  technique?: string;
  comparison?: string;
  findings_ai: string;
  impression_ai: string;
  findings_clinician?: string;
  impression_clinician?: string;
  limitations_uncertainty?: string;
  supporting_evidence?: Array<{
    label: string;
    probability: number;
    threshold: number;
    uncertainty: number;
    confidence_level: string;
  }>;
  is_clinician_modified: boolean;
  diff_summary?: {
    findings_diff: DiffSummary;
    impression_diff: DiffSummary;
    is_modified: boolean;
  };
  clinician_id: string;
  signed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StudySummary {
  id: number;
  study_uid: string;
  accession_number?: string;
  patient_id: string;
  patient_age?: number;
  patient_sex?: string;
  indication?: string;
  clinical_history?: string;
  study_date: string;
  status: string;
  view_position: string;
  thumbnail_url?: string;
  has_inference: boolean;
  has_report: boolean;
  report_status?: string;
}

export interface StudyDetail {
  id: number;
  study_uid: string;
  accession_number?: string;
  study_date: string;
  indication?: string;
  clinical_history?: string;
  prior_study_ref?: string;
  modality: string;
  view_position: string;
  status: string;
  patient: Patient;
  prior_studies: Array<{
    id: number;
    accession_number?: string;
    study_date: string;
    indication?: string;
    status: string;
  }>;
  images: ImageRecord[];
  latest_inference?: InferenceRun;
  latest_report?: ReportItem;
}

export interface MetricDetail {
  label: string;
  auroc: number;
  auprc: number;
  sensitivity: number;
  specificity: number;
  precision: number;
  recall: number;
  f1: number;
  threshold: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export interface EvaluationBenchmark {
  id: number;
  dataset_name: string;
  sample_count: number;
  auroc_macro: number;
  auprc_macro: number;
  f1_macro: number;
  metrics: MetricDetail[];
  report_rouge_l: number;
  report_bleu_2: number;
  clinical_concept_recall: number;
  expected_calibration_error: number;
  created_at: string;
}
