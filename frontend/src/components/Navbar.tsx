import React from 'react';
import {
  Activity,
  FileText,
  BarChart3,
  FolderArchive,
  ShieldAlert,
  Cpu,
  UserCheck,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'workstation' | 'report' | 'evaluation' | 'archive';
  setActiveTab: (tab: 'workstation' | 'report' | 'evaluation' | 'archive') => void;
  onOpenUpload: () => void;
  onResetDemo: () => void;
  isSeeding: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenUpload,
  onResetDemo,
  isSeeding,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
      {/* Clinical Research Prototype Disclaimer Banner */}
      <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-600/30 px-4 py-1 text-xs text-amber-200/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-amber-300 font-semibold">CLINICAL RESEARCH PROTOTYPE:</strong> Non-autonomous diagnostic assistance tool. Not FDA/CE cleared. Requires mandatory independent review by an authorized qualified radiologist.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            PyTorch DenseNet-121 Engine
          </span>
          <span className="text-slate-600">|</span>
          <span>DICOM De-Id Active</span>
        </div>
      </div>

      {/* Main PACS Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('workstation')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-700 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white font-sans">
                Radiant<span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 uppercase tracking-wider">
                Copilot v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">Multimodal AI Radiology Workstation</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('workstation')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'workstation'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Reading Room</span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'report'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Report Copilot & Diff</span>
          </button>

          <button
            onClick={() => setActiveTab('evaluation')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'evaluation'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Model Evaluation</span>
          </button>

          <button
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'archive'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Cohort Archive</span>
          </button>
        </nav>

        {/* Right Actions & Persona */}
        <div className="flex items-center gap-3">
          <button
            onClick={onResetDemo}
            disabled={isSeeding}
            title="Reset to synthetic clinical benchmark cases"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>Reset Demo</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg shadow-md shadow-cyan-600/20 transition active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Study / Upload</span>
          </button>

          {/* Clinician Persona Pill */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200 leading-none">Dr. Sarah Chen, MD</p>
              <p className="text-[10px] text-cyan-400 font-mono mt-0.5">Attending Radiologist</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
