import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { ingestionApi } from '../api-integration/ingestion';
import { toast } from 'sonner';

const UploadContext = createContext();

export function UploadProvider({ children }) {
  const [activeJob, setActiveJob] = useState(null);
  // activeJob shape: { jobId, filename, fileSize, uploadProgress, jobStatus, uploadType }
  // jobStatus: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

  const pollIntervalRef = useRef(null);
  const autoDismissRef = useRef(null);

  const clearJob = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
    setActiveJob(null);
  }, []);

  const startUpload = useCallback(async (file, userId, uploadType = 'BATCH_CSV') => {
    // Clear any existing job
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }

    const isProfileHistory = uploadType === 'PROFILE_HISTORY';

    // Set initial state
    setActiveJob({
      jobId: null,
      filename: file.name,
      fileSize: file.size,
      uploadProgress: 0,
      jobStatus: 'UPLOADING',
      uploadType
    });

    try {
      // Upload file with progress tracking
      const response = await ingestionApi.uploadBatch(file, userId, (percent) => {
        setActiveJob(prev => prev ? { ...prev, uploadProgress: percent } : null);
      }, uploadType);

      const { jobId } = response;

      // Upload done, switch to processing
      setActiveJob(prev => prev ? {
        ...prev,
        jobId,
        uploadProgress: 100,
        jobStatus: 'PROCESSING'
      } : null);

      toast.success('Upload complete', {
        description: isProfileHistory ? 'Building behavioral profile...' : 'Processing transactions...'
      });

      // Start polling for job completion
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await ingestionApi.getBatchStatus(jobId);

          if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;

            setActiveJob(prev => prev ? {
              ...prev,
              jobStatus: status.status,
              failedRows: status.failedRows || 0,
              processedRows: status.processedRows || 0,
              totalRows: status.totalRows || 0
            } : null);

            if (status.failedRows > 0) {
              // Automatically trigger the download
              ingestionApi.downloadBatchErrors(jobId).then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `missing_values_rows_${jobId}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              }).catch(err => console.error('Failed to auto-download missing values CSV', err));

              toast.error('Missing Data Detected', {
                description: `${status.processedRows} rows processed successfully. ${status.failedRows} rows had missing data points and have been automatically downloaded to your device as a CSV. Please fill them and re-upload.`,
                duration: 15000, // Stay longer
                action: {
                  label: 'Download Again',
                  onClick: () => {
                    ingestionApi.downloadBatchErrors(jobId).then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `missing_values_rows_${jobId}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    }).catch(err => toast.error('Failed to download missing values CSV'));
                  }
                }
              });

              // Do NOT auto-dismiss so the user can see the error state in the UI
            } else {
              if (status.status === 'COMPLETED') {
                toast.success(isProfileHistory ? 'Profile Updated' : 'Analysis Complete', {
                  description: isProfileHistory
                    ? `Processed ${status.totalRows} transactions for profile building.`
                    : `Processed ${status.totalRows} transactions.`
                });
              } else {
                toast.error('Processing Failed', {
                  description: 'The batch processing encountered an error.'
                });
              }

              // Auto-dismiss after 5 seconds since there are no failed rows to fix
              autoDismissRef.current = setTimeout(() => {
                setActiveJob(null);
              }, 5000);
            }
          }
        } catch (e) {
          console.error('Polling error', e);
        }
      }, 3000);

    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed', {
        description: error.response?.data?.error || 'Failed to upload file. Please try again.'
      });
      setActiveJob(prev => prev ? { ...prev, jobStatus: 'FAILED' } : null);

      autoDismissRef.current = setTimeout(() => {
        setActiveJob(null);
      }, 5000);
    }
  }, []);

  return (
    <UploadContext.Provider value={{ activeJob, startUpload, clearJob }}>
      {children}
    </UploadContext.Provider>
  );
}

export const useUpload = () => useContext(UploadContext);
