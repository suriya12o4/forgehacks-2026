import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Scan,
  ShieldCheck
} from 'lucide-react';
import { createStudy, uploadImage } from '../api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStudyId: number) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [patientId, setPatientId] = useState<string>('ANON-PT-7702');
  const [age, setAge] = useState<number>(55);
  const [sex, setSex] = useState<string>('M');
  const [viewPosition, setViewPosition] = useState<string>('PA');
  const [indication, setIndication] = useState<string>('Dyspnea, dry cough, and pleuritic chest discomfort for 3 days.');
  const [history, setHistory] = useState<string>('Hypertension, chronic obstructive pulmonary disease (COPD).');
  const [priorRef, setPriorRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select a chest X-ray image (PNG, JPEG, or DICOM).');
      return;
    }
    if (!indication.trim()) {
      setErrorMessage('Clinical indication is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      // 1. Create Study
      const studyRes = await createStudy({
        patient_id: patientId,
        age,
        sex,
        indication,
        clinical_history: history,
        prior_study_ref: priorRef || undefined,
        view_position: viewPosition,
      });

      // 2. Upload image and run Stage A validation
      await uploadImage(studyRes.study_id, file);

      setIsSubmitting(false);
      onSuccess(studyRes.study_id);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Upload and validation failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Ingest Chest Radiograph & Clinical Context</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* File Drag and Drop Zone */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Chest Radiograph File (DICOM, PNG, JPEG):
            </label>
            <label className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/60 transition group">
              <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 transition mb-2" />
              {file ? (
                <div className="text-center">
                  <span className="text-cyan-300 font-medium block">{file.name}</span>
                  <span className="text-[10px] text-slate-400">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  <span className="font-semibold text-slate-300">Click to upload</span> or drag and drop
                  <p className="text-[10px] text-slate-500 mt-0.5">Supports DICOM (.dcm), PNG, JPG up to 50MB</p>
                </div>
              )}
              <input
                type="file"
                accept=".dcm,.dicom,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* De-identified Patient Context */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 font-medium block mb-1">De-Id Patient ID:</label>
              <input
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-slate-400 font-medium block mb-1">Age (Years):</label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-slate-400 font-medium block mb-1">Sex & View:</label>
              <div className="grid grid-cols-2 gap-1">
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                  <option value="U">U</option>
                </select>
                <select
                  value={viewPosition}
                  onChange={(e) => setViewPosition(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="PA">PA</option>
                  <option value="AP">AP</option>
                  <option value="LAT">LAT</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clinical Indication */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Examination Indication (Required):
            </label>
            <input
              type="text"
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              placeholder="e.g. Acute dyspnea, fever, suspected pneumonia..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Clinical History */}
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Relevant Clinical History & Comorbidities:
            </label>
            <textarea
              rows={2}
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              placeholder="e.g. History of CHF, smoking (10 pack-years), immunosuppression..."
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Prior Study */}
          <div>
            <label className="text-slate-400 font-medium block mb-1">Prior Study Reference (Optional):</label>
            <input
              type="text"
              value={priorRef}
              onChange={(e) => setPriorRef(e.target.value)}
              placeholder="e.g. CXR 2025-11-04 (Clear lung fields)"
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Security & De-ID note */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>DICOM tags will be automatically de-identified before storage.</span>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-600/20 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Validating & Uploading...' : 'Submit to PACS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
