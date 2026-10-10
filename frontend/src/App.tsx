import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { WorkstationView } from './components/WorkstationView';
import { ReportEditorView } from './components/ReportEditorView';
import { EvaluationView } from './components/EvaluationView';
import { StudiesArchiveView } from './components/StudiesArchiveView';
import { UploadModal } from './components/UploadModal';
import {
  StudySummary,
  StudyDetail,
  HeatmapItem,
  EvaluationBenchmark
} from './types';
import {
  fetchStudies,
  fetchStudyDetail,
  fetchHeatmaps,
  runInference,
  generateReport,
  updateReport,
  signOffReport,
  fetchEvaluationMetrics,
  resetDemoData
} from './api';
import { Loader2 } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'workstation' | 'report' | 'evaluation' | 'archive'>('workstation');
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [currentStudy, setCurrentStudy] = useState<StudyDetail | null>(null);
  const [heatmaps, setHeatmaps] = useState<HeatmapItem[]>([]);
  const [benchmark, setBenchmark] = useState<EvaluationBenchmark | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [isSavingEdits, setIsSavingEdits] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  // Load studies list & benchmark
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [studiesData, benchData] = await Promise.all([
        fetchStudies(),
        fetchEvaluationMetrics().catch(() => null),
      ]);
      setStudies(studiesData);
      if (benchData) setBenchmark(benchData);

      if (studiesData.length > 0) {
        const firstId = studiesData[0].id;
        setSelectedStudyId(firstId);
        await loadStudyDetails(firstId);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudyDetails = async (studyId: number) => {
    try {
      const detail = await fetchStudyDetail(studyId);
      setCurrentStudy(detail);
      setSelectedStudyId(studyId);

      // Fetch heatmaps if inference has occurred
      if (detail.latest_inference) {
        const hms = await fetchHeatmaps(studyId);
        setHeatmaps(hms);
      } else {
        setHeatmaps([]);
      }
    } catch (err) {
      console.error(`Error loading study ${studyId}:`, err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Run AI Inference on current study
  const handleRunAnalysis = async () => {
    if (!selectedStudyId) return;
    try {
      setIsAnalyzing(true);
      await runInference(selectedStudyId);
      await loadStudyDetails(selectedStudyId);
      // Refresh studies list status
      const updatedList = await fetchStudies();
      setStudies(updatedList);
    } catch (err) {
      console.error('Inference error:', err);
      alert('Inference failed. Check console for details.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate Report
  const handleGenerateReport = async (provider: string) => {
    if (!selectedStudyId) return;
    try {
      setIsGeneratingReport(true);
      await generateReport(selectedStudyId, provider);
      await loadStudyDetails(selectedStudyId);
      const updatedList = await fetchStudies();
      setStudies(updatedList);
    } catch (err) {
      console.error('Report generation error:', err);
      alert('Report generation failed. Check console.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Save clinician report revisions
  const handleSaveReportEdits = async (findings: string, impression: string) => {
    if (!selectedStudyId) return;
    try {
      setIsSavingEdits(true);
      await updateReport(selectedStudyId, {
        findings_clinician: findings,
        impression_clinician: impression,
      });
      await loadStudyDetails(selectedStudyId);
      const updatedList = await fetchStudies();
      setStudies(updatedList);
    } catch (err) {
      console.error('Save edits error:', err);
      alert('Failed to save revisions.');
    } finally {
      setIsSavingEdits(false);
    }
  };

  // Sign off report
  const handleSignOffReport = async (clinicianId: string) => {
    if (!selectedStudyId) return;
    try {
      await signOffReport(selectedStudyId, clinicianId);
      await loadStudyDetails(selectedStudyId);
      const updatedList = await fetchStudies();
      setStudies(updatedList);
    } catch (err) {
      console.error('Sign off error:', err);
      alert('Sign off failed.');
    }
  };

  // Reset to synthetic demo cases
  const handleResetDemo = async () => {
    try {
      setIsSeeding(true);
      await resetDemoData();
      await loadInitialData();
    } catch (err) {
      console.error('Reset demo error:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Study selection from archive or list
  const handleSelectStudy = async (studyId: number) => {
    await loadStudyDetails(studyId);
    setActiveTab('workstation');
  };

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        onResetDemo={handleResetDemo}
        isSeeding={isSeeding}
      />

      <main className="flex-1 pb-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm font-medium">Initializing RadiantAI Workstation...</p>
          </div>
        ) : (
          <>
            {activeTab === 'workstation' && (
              <WorkstationView
                study={currentStudy}
                heatmaps={heatmaps}
                isAnalyzing={isAnalyzing}
                onRunAnalysis={handleRunAnalysis}
                onNavigateToReport={() => setActiveTab('report')}
              />
            )}

            {activeTab === 'report' && (
              <ReportEditorView
                study={currentStudy}
                onGenerateReport={handleGenerateReport}
                onSaveReportEdits={handleSaveReportEdits}
                onSignOffReport={handleSignOffReport}
                isGenerating={isGeneratingReport}
                isSaving={isSavingEdits}
              />
            )}

            {activeTab === 'evaluation' && (
              <EvaluationView benchmark={benchmark} />
            )}

            {activeTab === 'archive' && (
              <StudiesArchiveView
                studies={studies}
                onSelectStudy={handleSelectStudy}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={async (newId) => {
          const updatedList = await fetchStudies();
          setStudies(updatedList);
          await loadStudyDetails(newId);
          setActiveTab('workstation');
        }}
      />
    </div>
  );
}

export default App;
