import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, File, CheckCircle, X, AlertTriangle, Download } from 'lucide-react';
import { ingestionApi } from '../../api-integration/ingestion';
import { useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useUpload } from '../../contexts/UploadContext';

export function FileUpload({ uploadType = 'BATCH_CSV' }) {
  const { user } = useAuth();
  const { activeJob, startUpload, clearJob } = useUpload();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const isProfileHistory = uploadType === 'PROFILE_HISTORY';

  // Determine if the dropzone should be shown
  // Show dropzone when: no active job, or job is done (COMPLETED/FAILED), or job is in PROCESSING phase (user can upload another)
  const showDropzone = (!activeJob) ||
    (activeJob.jobStatus === 'COMPLETED' && (!activeJob.failedRows || activeJob.failedRows === 0)) ||
    (activeJob.jobStatus === 'FAILED' && (!activeJob.failedRows || activeJob.failedRows === 0)) ||
    activeJob.jobStatus === 'PROCESSING';

  const isUploading = activeJob?.jobStatus === 'UPLOADING';
  const hasFailedRows = (activeJob?.jobStatus === 'COMPLETED' || activeJob?.jobStatus === 'FAILED') && activeJob?.failedRows > 0;

  const handleDownloadErrors = async () => {
    try {
      const blob = await ingestionApi.downloadBatchErrors(activeJob.jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `missing_values_rows_${activeJob.jobId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download missing values CSV');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = async (file) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Invalid file type', { description: 'Please upload a CSV file.' });
      return;
    }
    if (!user?.id) {
      toast.error('Authentication Error', { description: 'User ID not found. Please log in again.' });
      return;
    }
    await startUpload(file, user.id, uploadType);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {isUploading ? (
          /* Show inline upload progress while actively uploading */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            key="uploading"
            className="bg-card border border-border/50 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <File className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{activeJob.filename}</h4>
                  <p className="text-xs text-muted-foreground">{(activeJob.fileSize / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button onClick={clearJob} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Upload Status</span>
                <span>{activeJob.uploadProgress}%</span>
              </div>
              <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${activeJob.uploadProgress}% ` }}
                  transition={{ ease: "linear" }}
                />
              </div>
            </div>
          </motion.div>
        ) : hasFailedRows ? (
          /* Show Failure / Missing Values Block */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            key="errors"
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-500/20 text-red-500">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-medium text-red-400">Missing Data Detected</h4>
                  <p className="text-sm text-red-400/80">Some rows could not be processed due to missing values</p>
                </div>
              </div>
              <button onClick={clearJob} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-red-500/5 rounded-xl p-4 mb-4 border border-red-500/10">
              <div className="flex justify-between text-sm mb-2 text-foreground">
                <span className="text-muted-foreground">Successfully Processed:</span>
                <span className="font-semibold text-emerald-400">{activeJob.processedRows} rows</span>
              </div>
              <div className="flex justify-between text-sm text-foreground">
                <span className="text-muted-foreground">Rows directly discarded:</span>
                <span className="font-semibold text-red-400">{activeJob.failedRows} rows</span>
              </div>
            </div>

            <button
              onClick={handleDownloadErrors}
              className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Missing Values CSV
            </button>
            <p className="text-xs text-red-400/70 text-center mt-3">
              Please fill in the missing data for these rows and re-upload the file.
            </p>
          </motion.div>
        ) : showDropzone ? (
          /* Dropzone - shown when idle or during processing/after completion */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            key="dropzone"
          >
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center w-full h-64 rounded-2xl border-2 border-dashed transition-all cursor-pointer",
                isDragging
                  ? "border-cyan-400 bg-cyan-400/5 scale-[1.02]"
                  : "border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-border/80"
              )}
            >
              <div className="p-4 rounded-full bg-indigo-500/10 mb-4 text-indigo-400">
                <UploadCloud className="h-10 w-10" />
              </div>
              <p className="text-lg font-medium text-foreground mb-1">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground">CSV files only (max 10MB)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
