import React, { useState, useEffect } from 'react';
import {
  StudyDetail,
  ReportItem
} from '../types';
import {
  FileText,
  CheckCircle2,
  Edit3,
  GitCompare,
  Lock,
  Sparkles,
  AlertCircle,
  Copy,
  Printer,
  ShieldCheck,
  Clock,
  ArrowRight,
  UserCheck
} from 'lucide-react';

interface ReportEditorViewProps {
  study: StudyDetail | null;
  onGenerateReport: (provider: string) => void;
  onSaveReportEdits: (findings: string, impression: string) => void;
  onSignOffReport: (clinicianId: string) => void;
  isGenerating: boolean;
  isSaving: boolean;
}

export const ReportEditorView: React.FC<ReportEditorViewProps> = ({
  study,
  onGenerateReport,
  onSaveReportEdits,
  onSignOffReport,
  isGenerating,
  isSaving,
}) => {
  const report = study?.latest_report;

  const [activeTab, setActiveTab] = useState<'edit' | 'diff' | 'preview'>('edit');
  const [editedFindings, setEditedFindings] = useState<string>('');
  const [editedImpression, setEditedImpression] = useState<string>('');
  const [clinicianId, setClinicianId] = useState<string>('Dr. Sarah Chen, MD (Attending Radiologist)');
  const [selectedProvider, setSelectedProvider] = useState<string>('deterministic_fallback');
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (report) {
      setEditedFindings(report.findings_clinician || report.findings_ai || '');
      setEditedImpression(report.impression_clinician || report.impression_ai || '');
      if (report.clinician_id) setClinicianId(report.clinician_id);
    }
  }, [report]);

  if (!study) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <FileText className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
        <p className="text-base font-medium">Select a study to view or generate its radiology report.</p>
      </div>
    );
  }

  const isSigned = report?.status === 'SIGNED_OFF';
  const diffSummary = report?.diff_summary;

  const handleCopyReport = () => {
    if (!report) return;
    const fullText = `
RADIANT-AI CLINICAL RADIOLOGY REPORT
Status: ${report.status}
Attending Radiologist: ${clinicianId}

EXAMINATION:
${report.examination}

CLINICAL INDICATION:
${report.indication || 'Unspecified'}

TECHNIQUE:
${report.technique || 'Standard PA acquisition'}

COMPARISON:
${report.comparison || 'None'}

FINDINGS:
${editedFindings || report.findings_ai}

IMPRESSION:
${editedImpression || report.impression_ai}

LIMITATIONS AND UNCERTAINTY:
${report.limitations_uncertainty || 'N/A'}
    `.trim();

    navigator.clipboard.writeText(fullText);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              <span>Structured Radiology Report Copilot</span>
            </h2>
            {report && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${
                  isSigned
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : report.is_clinician_modified
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                }`}
              >
                {report.status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Accession: <span className="text-slate-300 font-mono">{study.accession_number}</span> • Patient ID: <span className="text-cyan-400 font-mono">{study.patient.patient_id}</span>
          </p>
        </div>

        {/* Synthesis / Sign-off Buttons */}
        <div className="flex items-center gap-2.5">
          {!report ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-2 text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="deterministic_fallback">Deterministic Clinical Synthesis (Zero-Hallucination)</option>
                <option value="openai">OpenAI / Hosted LLM API Adapter</option>
              </select>

              <button
                onClick={() => onGenerateReport(selectedProvider)}
                disabled={isGenerating || !study.latest_inference}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-600/20 transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGenerating ? 'Synthesizing Report...' : 'Generate AI Draft'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition"
              >
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>{copyFeedback ? 'Copied!' : 'Copy Report'}</span>
              </button>

              {!isSigned && (
                <>
                  <button
                    onClick={() => onSaveReportEdits(editedFindings, editedImpression)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 rounded-lg text-xs font-medium transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving Edits...' : 'Save Revisions'}</span>
                  </button>

                  <button
                    onClick={() => onSignOffReport(clinicianId)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/20 transition active:scale-95"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Sign & Authorize</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {report ? (
        <div className="space-y-6">
          {/* Sub-Tabs: Editor / Diff / Preview */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('edit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition ${
                  activeTab === 'edit'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Clinician Editor</span>
              </button>

              <button
                onClick={() => setActiveTab('diff')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition ${
                  activeTab === 'diff'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>AI vs Clinician Diff</span>
              </button>

              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition ${
                  activeTab === 'preview'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Formatted PACS Document</span>
              </button>
            </div>

            {/* Signed status indicator */}
            {isSigned && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Signed by: {report.clinician_id} on {new Date(report.signed_at || '').toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* TAB 1: Clinician Editor Mode */}
          {activeTab === 'edit' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Main Report Form (8 cols) */}
              <div className="md:col-span-8 space-y-4">
                {/* Fixed Diagnostic Fields */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-400 font-medium">EXAMINATION:</span>
                      <p className="text-slate-200 font-mono mt-0.5">{report.examination}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">TECHNIQUE:</span>
                      <p className="text-slate-200 mt-0.5">{report.technique}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">CLINICAL INDICATION:</span>
                    <p className="text-slate-300 mt-0.5 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                      {report.indication || 'Unspecified'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">COMPARISON:</span>
                    <p className="text-slate-300 mt-0.5">{report.comparison}</p>
                  </div>
                </div>

                {/* Editable FINDINGS section */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>FINDINGS (Organ-System Breakdown):</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isSigned ? 'Locked (Signed-Off)' : 'Editable'}
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={editedFindings}
                    disabled={isSigned}
                    onChange={(e) => setEditedFindings(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500 disabled:opacity-75 resize-y"
                    placeholder="Organ-system findings..."
                  />
                </div>

                {/* Editable IMPRESSION section */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>IMPRESSION (Prioritized Clinical Conclusions):</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isSigned ? 'Locked' : 'Editable'}
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={editedImpression}
                    disabled={isSigned}
                    onChange={(e) => setEditedImpression(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500 disabled:opacity-75 resize-y"
                    placeholder="Numbered clinical impressions..."
                  />
                </div>
              </div>

              {/* Right Sidebar: Supporting Evidence & Traceability (4 cols) */}
              <div className="md:col-span-4 space-y-4">
                {/* Model Limitations & Uncertainty */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 pb-1 border-b border-slate-800">
                    <AlertCircle className="w-4 h-4" />
                    <span>Limitations & Uncertainty</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    {report.limitations_uncertainty}
                  </p>
                </div>

                {/* Supporting Model Outputs (Traceability) */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 pb-1 border-b border-slate-800">
                    <Sparkles className="w-4 h-4" />
                    <span>Supporting Model Evidence</span>
                  </div>
                  {report.supporting_evidence && report.supporting_evidence.length > 0 ? (
                    <div className="space-y-2">
                      {report.supporting_evidence.map((ev: any) => (
                        <div
                          key={ev.label}
                          className="bg-slate-950/80 p-2 rounded border border-slate-800 text-xs flex items-center justify-between"
                        >
                          <span className="font-medium text-slate-200">{ev.label}</span>
                          <span className="font-mono text-cyan-400 font-bold">
                            {Math.round(ev.probability * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">All categories scored within baseline parameters.</p>
                  )}
                </div>

                {/* Clinician Signature Box */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 pb-1 border-b border-slate-800">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>Attending Electronic Stamp</span>
                  </div>
                  <input
                    type="text"
                    value={clinicianId}
                    disabled={isSigned}
                    onChange={(e) => setClinicianId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Authorized electronic signature validates all draft contents for hospital PACS integration.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI Draft vs Clinician Diff Mode */}
          {activeTab === 'diff' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-cyan-400" />
                  <span>Differential Revision Audit (AI Draft vs Clinician Edited)</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Real-time textual comparison tracking changes made by the clinician against the raw model synthesis.
                </p>

                {diffSummary ? (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400">Findings Similarity:</span>
                      <p className="text-base font-bold text-cyan-400 font-mono mt-0.5">
                        {Math.round((diffSummary.findings_diff?.similarity_ratio || 1) * 100)}%
                      </p>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400">Impression Similarity:</span>
                      <p className="text-base font-bold text-cyan-400 font-mono mt-0.5">
                        {Math.round((diffSummary.impression_diff?.similarity_ratio || 1) * 100)}%
                      </p>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400">Original AI Words:</span>
                      <p className="text-base font-bold text-slate-200 font-mono mt-0.5">
                        {diffSummary.findings_diff?.word_count_ai || 0}
                      </p>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400">Clinician Revised Words:</span>
                      <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                        {diffSummary.findings_diff?.word_count_clinician || 0}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-400 bg-slate-950 p-3 rounded border border-slate-800">
                    No modifications made yet. Click "Save Revisions" after modifying Findings or Impression to generate diff telemetry.
                  </div>
                )}
              </div>

              {/* Side-by-side text display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                {/* AI Draft Original */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-cyan-400 font-bold uppercase tracking-wider">AI Draft (Original Baseline)</span>
                    <span className="text-[10px] text-slate-500 font-sans">Automated Synthesizer</span>
                  </div>
                  <div>
                    <h5 className="text-slate-400 mb-1">FINDINGS:</h5>
                    <p className="text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 whitespace-pre-line leading-relaxed">
                      {report.findings_ai}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-slate-400 mb-1">IMPRESSION:</h5>
                    <p className="text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 whitespace-pre-line leading-relaxed">
                      {report.impression_ai}
                    </p>
                  </div>
                </div>

                {/* Clinician Revision */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-emerald-400 font-bold uppercase tracking-wider">Clinician Version (Revised)</span>
                    <span className="text-[10px] text-slate-500 font-sans">Authorized Changes</span>
                  </div>
                  <div>
                    <h5 className="text-slate-400 mb-1">FINDINGS:</h5>
                    <p className="text-emerald-200/90 bg-slate-950 p-3 rounded border border-emerald-950/80 whitespace-pre-line leading-relaxed">
                      {editedFindings || report.findings_clinician || report.findings_ai}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-slate-400 mb-1">IMPRESSION:</h5>
                    <p className="text-emerald-200/90 bg-slate-950 p-3 rounded border border-emerald-950/80 whitespace-pre-line leading-relaxed">
                      {editedImpression || report.impression_clinician || report.impression_ai}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Formatted PACS Document Preview */}
          {activeTab === 'preview' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 max-w-4xl mx-auto shadow-2xl font-mono text-xs space-y-6">
              {/* Header */}
              <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-base font-bold text-white font-sans">RADIOLOGY CONSULTATION REPORT</h1>
                  <p className="text-slate-400 text-[11px] mt-0.5">RadiantAI PACS Integrated Clinical Document</p>
                </div>
                <div className="text-right text-[11px] text-slate-400 space-y-0.5">
                  <p>ACCESSION: <span className="text-white">{study.accession_number}</span></p>
                  <p>PATIENT ID: <span className="text-cyan-400">{study.patient.patient_id}</span></p>
                  <p>EXAM DATE: <span className="text-white">{new Date(study.study_date).toLocaleDateString()}</span></p>
                </div>
              </div>

              {/* Patient Banner */}
              <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded border border-slate-800 text-[11px]">
                <p>AGE: <span className="text-slate-200">{study.patient.age || '—'}</span></p>
                <p>SEX: <span className="text-slate-200">{study.patient.sex}</span></p>
                <p>MODALITY: <span className="text-slate-200">{study.modality} ({study.view_position})</span></p>
              </div>

              {/* Report Body */}
              <div className="space-y-4 leading-relaxed text-slate-300">
                <div>
                  <h4 className="font-bold text-slate-200">EXAMINATION:</h4>
                  <p>{report.examination}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200">CLINICAL INDICATION:</h4>
                  <p>{report.indication}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200">TECHNIQUE:</h4>
                  <p>{report.technique}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200">COMPARISON:</h4>
                  <p>{report.comparison}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200">FINDINGS:</h4>
                  <p className="whitespace-pre-line text-white mt-1">
                    {editedFindings || report.findings_clinician || report.findings_ai}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <h4 className="font-bold text-cyan-400 text-sm">IMPRESSION:</h4>
                  <p className="whitespace-pre-line text-white font-semibold mt-1">
                    {editedImpression || report.impression_clinician || report.impression_ai}
                  </p>
                </div>
              </div>

              {/* Signature Stamp */}
              <div className="border-t border-slate-800 pt-4 flex justify-between items-end text-[11px] text-slate-400">
                <div>
                  <p>ATTENDING RADIOLOGIST:</p>
                  <p className="text-white font-bold text-xs mt-0.5">{clinicianId}</p>
                  <p className="text-emerald-400 mt-1">
                    {isSigned ? '✓ Electronically Authorized & Stamped' : '⚠ Pending Attending Verification'}
                  </p>
                </div>
                <div className="text-right">
                  <p>REPORT STATUS: <span className="text-white uppercase">{report.status}</span></p>
                  <p>SYSTEM: RadiantAI Multimodal Copilot v1.0</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-900/30">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Generate Structured Radiology Draft</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              Synthesize an evidence-grounded draft adhering to American College of Radiology guidelines by combining visual DenseNet inferences with the patient's structured clinical context.
            </p>
          </div>
          <button
            onClick={() => onGenerateReport('deterministic_fallback')}
            disabled={isGenerating || !study.latest_inference}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-600/25 transition disabled:opacity-50"
          >
            {isGenerating ? 'Synthesizing...' : 'Generate AI Draft Report'}
          </button>
        </div>
      )}
    </div>
  );
};
