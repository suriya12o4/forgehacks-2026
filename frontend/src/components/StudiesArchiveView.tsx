import React, { useState } from 'react';
import { StudySummary } from '../types';
import {
  FolderArchive,
  Search,
  Plus,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  Filter
} from 'lucide-react';

interface StudiesArchiveViewProps {
  studies: StudySummary[];
  onSelectStudy: (studyId: number) => void;
  onOpenUpload: () => void;
}

export const StudiesArchiveView: React.FC<StudiesArchiveViewProps> = ({
  studies,
  onSelectStudy,
  onOpenUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filtered = studies.filter((s) => {
    const matchesSearch =
      s.patient_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.accession_number && s.accession_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.indication && s.indication.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter =
      filterStatus === 'ALL' ||
      (filterStatus === 'SIGNED_OFF' && s.status === 'SIGNED_OFF') ||
      (filterStatus === 'ANALYZED' && (s.status === 'ANALYZED' || s.has_inference)) ||
      (filterStatus === 'PENDING' && s.status === 'UPLOADED');

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-cyan-400" />
            <span>Radiology Cohort Archive & Longitudinal History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Access de-identified patient studies, prior comparisons, and clinical review status.
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Upload New CXR / DICOM</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Patient ID, Accession, or Indication..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses ({studies.length})</option>
            <option value="SIGNED_OFF">Signed Off</option>
            <option value="ANALYZED">Analyzed / In Review</option>
            <option value="PENDING">Pending Analysis</option>
          </select>
        </div>
      </div>

      {/* Studies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s) => {
          const isSigned = s.status === 'SIGNED_OFF';
          const isAnalyzed = s.has_inference;

          return (
            <div
              key={s.id}
              onClick={() => onSelectStudy(s.id)}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition shadow-sm hover:shadow-cyan-900/10 cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-950 transition">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white font-mono block">
                        {s.patient_id}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {s.patient_age || '—'} yrs • {s.patient_sex} • {s.view_position}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border ${
                      isSigned
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : isAnalyzed
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                {/* Indication */}
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Clinical Indication:</span>
                  <p className="text-xs text-slate-300 line-clamp-2 mt-0.5 leading-relaxed">
                    {s.indication || 'No indication documented.'}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono text-[10px]">
                  {new Date(s.study_date).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-1 text-cyan-400 group-hover:translate-x-1 transition-transform font-medium">
                  <span>Open Study</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
