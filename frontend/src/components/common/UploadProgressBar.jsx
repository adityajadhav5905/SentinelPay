import { motion, AnimatePresence } from 'framer-motion';
import { File, CheckCircle, XCircle, X, Loader2 } from 'lucide-react';
import { useUpload } from '../../contexts/UploadContext';

export function UploadProgressBar() {
  const { activeJob, clearJob } = useUpload();

  if (!activeJob) return null;

  const { filename, fileSize, uploadProgress, jobStatus } = activeJob;
  const isUploading = jobStatus === 'UPLOADING';
  const isProcessing = jobStatus === 'PROCESSING';
  const isComplete = jobStatus === 'COMPLETED';
  const isFailed = jobStatus === 'FAILED';

  const statusConfig = {
    UPLOADING: {
      label: `Uploading... ${uploadProgress}%`,
      color: 'from-indigo-500 to-cyan-400',
      icon: <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />,
    },
    PROCESSING: {
      label: 'Processing transactions...',
      color: 'from-purple-500 to-pink-500',
      icon: <Loader2 className="w-4 h-4 animate-spin text-purple-400" />,
    },
    COMPLETED: {
      label: 'Analysis Complete',
      color: 'from-green-500 to-emerald-400',
      icon: <CheckCircle className="w-4 h-4 text-green-400" />,
    },
    FAILED: {
      label: 'Processing Failed',
      color: 'from-red-500 to-orange-400',
      icon: <XCircle className="w-4 h-4 text-red-400" />,
    },
  };

  const config = statusConfig[jobStatus] || statusConfig.UPLOADING;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 right-6 z-50 w-80"
      >
        <div className="bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4 shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <File className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{filename}</p>
                <p className="text-xs text-gray-400">{(fileSize / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              onClick={clearJob}
              className="p-1 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="h-1.5 w-full bg-gray-700/50 rounded-full overflow-hidden">
              {isUploading ? (
                <motion.div
                  className={`h-full bg-gradient-to-r ${config.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ ease: 'linear' }}
                />
              ) : isProcessing ? (
                <div className="h-full w-full relative overflow-hidden">
                  <motion.div
                    className={`h-full bg-gradient-to-r ${config.color} absolute`}
                    initial={{ x: '-100%', width: '50%' }}
                    animate={{ x: '200%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                  />
                </div>
              ) : (
                <div className={`h-full w-full bg-gradient-to-r ${config.color}`} />
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            {config.icon}
            <span className={`text-xs font-medium ${isComplete ? 'text-green-400' : isFailed ? 'text-red-400' : 'text-gray-300'}`}>
              {config.label}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
