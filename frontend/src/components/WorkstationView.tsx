import React, { useState } from 'react';
import {
  StudyDetail,
  HeatmapItem,
  ClassPrediction
} from '../types';
import {
  Activity,
  Layers,
  Sliders,
  Eye,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileText,
  Maximize2,
  RefreshCw,
  Sparkles,
  Info,
  ChevronRight,
  Stethoscope,
  Scan
} from 'lucide-react';

interface WorkstationViewProps {
  study: StudyDetail | null;
  heatmaps: HeatmapItem[];
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
  onNavigateToReport: () => void;
}

export const WorkstationView: React.FC<WorkstationViewProps> = ({
  study,
  heatmaps,
  isAnalyzing,
  onRunAnalysis,
  onNavigateToReport,
}) => {
  const [viewMode, setViewMode] = useState<'overlay' | 'original' | 'heatmap' | 'side-by-side'>('overlay');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.65);
  const [selectedFinding, setSelectedFinding] = useState<string>('Cardiomegaly');
  const [invertContrast, setInvertContrast] = useState<boolean>(false);
  const [activeWindow, setActiveWindow] = useState<'standard' | 'lung' | 'bone'>('standard');

  if (!study) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Activity className="w-12 h-12 text-slate-600 animate-pulse mb-3" />
        <p className="text-base font-medium">Select or upload a radiology study to begin examination.</p>
      </div>
    );
  }

  const primaryImage = study.images[0];
  const latestInference = study.latest_inference;
  const predictions = latestInference?.predictions || [];
  const positiveFindings = latestInference?.positive_findings || [];

  // Match active heatmap
  const currentHeatmap = heatmaps.find(
    (h) => h.finding_label.toLowerCase() === selectedFinding.toLowerCase()
  ) || heatmaps[0];

  const getWindowFilter = () => {
    let filterStr = invertContrast ? 'invert(1) ' : '';
    if (activeWindow === 'lung') filterStr += 'contrast(1.4) brightness(1.1)';
    else if (activeWindow === 'bone') filterStr += 'contrast(1.7) brightness(0.9)';
    return filterStr;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Patient & Study Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
            <Scan className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Patient: <span className="text-cyan-400 font-mono">{study.patient.patient_id}</span>
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {study.patient.age || '—'} yrs • {study.patient.sex === 'M' ? 'Male' : study.patient.sex === 'F' ? 'Female' : 'Unknown'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                {study.view_position} View
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Accession: <span className="font-mono text-slate-300">{study.accession_number || 'ACC-PENDING'}</span> • Exam Date: {new Date(study.study_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          {!latestInference ? (
            <button
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-600/20 transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Analyzing DenseNet-121...' : 'Run Abnormality Inference'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2.5 py-1.5 rounded-lg border border-emerald-800/60 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Inference Complete ({latestInference.execution_time_ms} ms)
              </span>
              <button
                onClick={onNavigateToReport}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-medium transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Open Draft Report</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-Column Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Medical Image Viewer & Grad-CAM (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            {/* Viewer Toolbar */}
            <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* View Modes */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setViewMode('overlay')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    viewMode === 'overlay' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Blended Overlay
                </button>
                <button
                  onClick={() => setViewMode('side-by-side')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    viewMode === 'side-by-side' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setViewMode('original')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    viewMode === 'original' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Original X-Ray
                </button>
                <button
                  onClick={() => setViewMode('heatmap')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    viewMode === 'heatmap' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  CAM Heatmap
                </button>
              </div>

              {/* Window & Contrast Presets */}
              <div className="flex items-center gap-2">
                <select
                  value={activeWindow}
                  onChange={(e) => setActiveWindow(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="standard">Standard Window</option>
                  <option value="lung">Lung Parenchyma</option>
                  <option value="bone">Bone / Thoracic Cage</option>
                </select>

                <button
                  onClick={() => setInvertContrast(!invertContrast)}
                  className={`px-2 py-1 rounded border text-xs font-mono transition ${
                    invertContrast ? 'bg-slate-800 text-cyan-400 border-cyan-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Invert Grayscale (Negative/Positive)"
                >
                  Invert
                </button>
              </div>
            </div>

            {/* Display Viewport */}
            <div className="relative bg-black flex items-center justify-center p-2 min-h-[440px] select-none overflow-hidden">
              {primaryImage ? (
                viewMode === 'side-by-side' ? (
                  <div className="grid grid-cols-2 gap-2 w-full h-full">
                    {/* Left: Original */}
                    <div className="relative rounded overflow-hidden bg-slate-950 flex flex-col items-center">
                      <div className="absolute top-2 left-2 z-10 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                        Original CXR
                      </div>
                      <img
                        src={primaryImage.original_url}
                        alt="Original Chest Radiograph"
                        style={{ filter: getWindowFilter() }}
                        className="object-contain max-h-[380px] w-full"
                      />
                    </div>
                    {/* Right: Grad-CAM Overlay */}
                    <div className="relative rounded overflow-hidden bg-slate-950 flex flex-col items-center">
                      <div className="absolute top-2 left-2 z-10 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300 border border-cyan-800/50">
                        Grad-CAM: {currentHeatmap ? currentHeatmap.finding_label : selectedFinding}
                      </div>
                      {currentHeatmap ? (
                        <img
                          src={currentHeatmap.overlay_url}
                          alt="Grad-CAM Overlay"
                          className="object-contain max-h-[380px] w-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                          Run analysis to generate Grad-CAM
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center w-full max-h-[460px]">
                    {/* Base Radiograph */}
                    <img
                      src={primaryImage.original_url}
                      alt="Original Chest X-Ray"
                      style={{ filter: getWindowFilter() }}
                      className="object-contain max-h-[440px] max-w-full rounded"
                    />

                    {/* Heatmap overlay (blended) */}
                    {viewMode === 'overlay' && currentHeatmap && (
                      <img
                        src={currentHeatmap.heatmap_url}
                        alt="Grad-CAM Activation Map"
                        style={{
                          opacity: overlayOpacity,
                          mixBlendMode: 'screen',
                        }}
                        className="absolute inset-0 m-auto object-contain max-h-[440px] max-w-full pointer-events-none transition-opacity"
                      />
                    )}

                    {/* Pure heatmap view */}
                    {viewMode === 'heatmap' && currentHeatmap && (
                      <img
                        src={currentHeatmap.heatmap_url}
                        alt="Grad-CAM Heatmap"
                        className="absolute inset-0 m-auto object-contain max-h-[440px] max-w-full"
                      />
                    )}
                  </div>
                )
              ) : (
                <div className="text-slate-500 text-sm">No image available</div>
              )}
            </div>

            {/* Viewer Controls: Opacity & Finding Selector */}
            <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 space-y-3">
              {/* Opacity Slider */}
              {viewMode === 'overlay' && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    Heatmap Opacity:
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-cyan-400 font-mono w-10 text-right">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </div>
              )}

              {/* Explainability Target Finding Selector */}
              {heatmaps.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <span className="text-slate-400 shrink-0 font-medium">CAM Target:</span>
                  {heatmaps.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedFinding(h.finding_label)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition flex items-center gap-1.5 ${
                        selectedFinding.toLowerCase() === h.finding_label.toLowerCase()
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span>{h.finding_label}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        (Peak: {Math.round(h.peak_intensity * 100)}%)
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Explainability Caveat Banner */}
              <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800 flex items-start gap-2 text-[11px] text-slate-400">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Model Feature Attribution:</strong> Heatmaps highlight localized gradients in the final DenseNet convolutional layer. They denote model receptive field associations and do not represent validated tissue boundaries or pathological confirmation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Abnormality Classification & Clinical Context (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Structured Clinical Context Intake */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-800 text-xs font-semibold text-slate-200">
              <Stethoscope className="w-4 h-4 text-cyan-400" />
              <span>Structured Clinical Indication & Context</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-slate-400 font-medium">Indication for Radiograph:</label>
                <p className="text-slate-200 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 mt-1 leading-relaxed">
                  {study.indication || 'No clinical indication entered.'}
                </p>
              </div>

              {study.clinical_history && (
                <div>
                  <label className="text-slate-400 font-medium">Patient History & Comorbidities:</label>
                  <p className="text-slate-300 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 mt-1 leading-relaxed">
                    {study.clinical_history}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Prior Study:</span>
                <span className="font-mono text-slate-300">
                  {study.prior_study_ref ? study.prior_study_ref : 'No priors found in archive'}
                </span>
              </div>
            </div>
          </div>

          {/* AI Abnormality Classification Scores */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Multi-Label Abnormality Classification</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {predictions.length > 0 ? `${predictions.length} Targets` : 'Awaiting Inference'}
              </span>
            </div>

            {/* Critical Alert Banner */}
            {latestInference?.has_critical_findings && (
              <div className="bg-rose-950/50 border border-rose-800/70 rounded-lg p-2.5 flex items-start gap-2 text-rose-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-rose-300">Potential Critical Finding Flagged:</strong>
                  <p className="text-[11px] text-rose-200/90 mt-0.5">
                    Model detected elevated scores for acute pathologies ({positiveFindings.join(', ')}). Prioritize review.
                  </p>
                </div>
              </div>
            )}

            {/* Predictions List */}
            {predictions.length > 0 ? (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {predictions.map((p) => {
                  const probPct = Math.round(p.probability * 100);
                  const threshPct = Math.round(p.threshold * 100);
                  const isElevated = p.is_positive && p.label !== 'No Finding';

                  return (
                    <div
                      key={p.label}
                      onClick={() => {
                        if (heatmaps.some((h) => h.finding_label === p.label)) {
                          setSelectedFinding(p.label);
                        }
                      }}
                      className={`p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                        isElevated
                          ? 'bg-cyan-950/30 border-cyan-500/40 hover:border-cyan-400'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isElevated ? 'text-white' : 'text-slate-300'}`}>
                            {p.label}
                          </span>
                          {isElevated && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/80 text-cyan-300 font-mono uppercase">
                              Above Thresh ({threshPct}%)
                            </span>
                          )}
                        </div>

                        {/* Confidence & Uncertainty Badge */}
                        <div className="flex items-center gap-1.5 font-mono">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              p.confidence_level === 'HIGH'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                : p.confidence_level === 'MODERATE'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            }`}
                            title={`MC-Dropout Uncertainty Score: ${p.uncertainty}`}
                          >
                            {p.confidence_level} CONF
                          </span>
                          <span className="font-bold text-slate-200 w-10 text-right">
                            {probPct}%
                          </span>
                        </div>
                      </div>

                      {/* Visual Probability Bar with Threshold Marker */}
                      <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isElevated
                              ? 'bg-gradient-to-r from-cyan-500 to-sky-400'
                              : 'bg-slate-600'
                          }`}
                          style={{ width: `${probPct}%` }}
                        />
                        {/* Threshold vertical tick */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-sm"
                          style={{ left: `${threshPct}%` }}
                          title={`Decision Threshold: ${threshPct}%`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                Click "Run Abnormality Inference" to process chest radiograph.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
