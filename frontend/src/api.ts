import {
  StudySummary,
  StudyDetail,
  InferenceRun,
  HeatmapItem,
  ReportItem,
  EvaluationBenchmark
} from './types';

const API_BASE = '/api';

export async function fetchStudies(): Promise<StudySummary[]> {
  const res = await fetch(`${API_BASE}/studies`);
  if (!res.ok) throw new Error('Failed to fetch studies');
  return res.json();
}

export async function fetchStudyDetail(id: number): Promise<StudyDetail> {
  const res = await fetch(`${API_BASE}/studies/${id}`);
  if (!res.ok) throw new Error('Failed to fetch study details');
  return res.json();
}

export async function createStudy(data: {
  patient_id: string;
  age?: number;
  sex?: string;
  indication: string;
  clinical_history?: string;
  prior_study_ref?: string;
  view_position?: string;
}): Promise<{ study_id: number; accession_number: string }> {
  const res = await fetch(`${API_BASE}/studies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to create study');
  }
  return res.json();
}

export async function uploadImage(studyId: number, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/studies/${studyId}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Image validation or upload failed');
  }
  return res.json();
}

export async function runInference(studyId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/studies/${studyId}/analyze`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Inference analysis failed');
  }
  return res.json();
}

export async function fetchHeatmaps(studyId: number): Promise<HeatmapItem[]> {
  const res = await fetch(`${API_BASE}/studies/${studyId}/heatmaps`);
  if (!res.ok) throw new Error('Failed to fetch heatmaps');
  return res.json();
}

export async function generateReport(studyId: number, provider: string = 'deterministic_fallback'): Promise<{ report: ReportItem }> {
  const res = await fetch(`${API_BASE}/studies/${studyId}/generate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_provider: provider }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Report synthesis failed');
  }
  return res.json();
}

export async function updateReport(studyId: number, data: {
  findings_clinician: string;
  impression_clinician: string;
  clinician_id?: string;
  notes?: string;
}): Promise<{ report: ReportItem }> {
  const res = await fetch(`${API_BASE}/studies/${studyId}/report`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to save clinician edits');
  }
  return res.json();
}

export async function signOffReport(studyId: number, clinicianId: string): Promise<{ report: ReportItem }> {
  const formData = new FormData();
  formData.append('clinician_id', clinicianId);
  const res = await fetch(`${API_BASE}/studies/${studyId}/report/sign-off`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Report sign-off failed');
  }
  return res.json();
}

export async function fetchEvaluationMetrics(): Promise<EvaluationBenchmark> {
  const res = await fetch(`${API_BASE}/evaluation/metrics`);
  if (!res.ok) throw new Error('Failed to fetch evaluation metrics');
  return res.json();
}

export async function resetDemoData(): Promise<void> {
  const res = await fetch(`${API_BASE}/demo/seed`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to seed demo data');
}
