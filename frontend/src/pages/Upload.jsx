import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { FileUpload } from '../components/common/FileUpload';
import { useQuery } from '@tanstack/react-query';
import { ingestionApi } from '../api-integration/ingestion';
import { authApi } from '../api-integration/auth';
import { formatDistanceToNow } from 'date-fns';
import { Shield, Database, Info, FileText } from 'lucide-react';

export default function Upload() {
  const [uploadType, setUploadType] = useState('BATCH_CSV');
  const { data: user } = useQuery({
    queryKey: ['profile'],
    queryFn: authApi.getProfile
  });

  return (
    <div>
      <Header title="Data Ingestion" />
      <div className="glass-panel p-4 md:p-12 rounded-2xl min-h-[500px] flex flex-col items-center justify-center">
        {/* Upload Type Toggle */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1 bg-muted/30 rounded-xl mb-8 border border-border/30">
          <button
            onClick={() => setUploadType('BATCH_CSV')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${uploadType === 'BATCH_CSV'
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Shield className="w-4 h-4" />
            Batch CSV / Excel Ingestion
          </button>
          <button
            onClick={() => setUploadType('BANK_STATEMENT')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${uploadType === 'BANK_STATEMENT'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <FileText className="w-4 h-4" />
            Bank Statement Upload (PDF / OCR)
          </button>
          <button
            onClick={() => setUploadType('PROFILE_HISTORY')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${uploadType === 'PROFILE_HISTORY'
              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Database className="w-4 h-4" />
            Customer Behavioral Baseline
          </button>
        </div>

        <div className="text-center mb-8 max-w-lg">
          {uploadType === 'BATCH_CSV' ? (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Batch Transaction Feed Ingestion</h3>
              <p className="text-gray-400 text-sm">Upload standard transaction datasets (.csv, .xlsx). The data is validated, schema-normalized, and passed to the ML Context & Feature Engineering pipeline.</p>
            </>
          ) : uploadType === 'BANK_STATEMENT' ? (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Bank Statement Parsing & OCR</h3>
              <p className="text-gray-400 text-sm">Upload bank statements in PDF or scanned image format. The Ingestion Engine performs OCR text extraction, entity recognition, table parsing, and maps entries to the SentinelPay transaction schema.</p>
              <div className="flex items-start gap-2 mt-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-left">
                <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-cyan-300/80">
                  Supported banks: HDFC, SBI, ICICI, Axis, Citi & standard MT940 / CAMT.053 formats.
                </p>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Historical Behavioral Profile Builder</h3>
              <p className="text-gray-400 text-sm">Upload historical ledger data to build transaction velocity and behavioral embeddings. Enables accurate SHAP explainability baselines.</p>
              <div className="flex items-start gap-2 mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-left">
                <Info className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-300/80">
                  Tip: Uploading historical records calibrates anomaly thresholds and reduces false positives in the Agentic Investigation layer.
                </p>
              </div>
            </>
          )}
        </div>

        <FileUpload key={uploadType} uploadType={uploadType} />

        {/* Recent Uploads */}
        <div className="w-full max-w-4xl mt-12">
          <h4 className="text-lg font-medium text-white mb-4">Recent Uploads</h4>
          <RecentUploads userId={user?.id} />
        </div>
      </div>
    </div>
  );
}

function RecentUploads({ userId }) {
  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['batch-history', userId],
    queryFn: () => ingestionApi.getBatchHistory(userId),
    enabled: !!userId,
    refetchInterval: 5000 // Poll every 5s for updates
  });

  if (isLoading) return <div className="text-center text-gray-500 py-4">Loading history...</div>;
  if (uploads.length === 0) return <div className="text-center text-gray-500 py-4">No uploads yet</div>;

  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[500px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Filename</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Progress</th>
              <th className="px-6 py-3 font-medium text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {uploads.map((job) => (
              <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">{job.filename}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {job.status === 'COMPLETED' ? (
                    <span className="text-green-400">{job.processedRows.toLocaleString()} rows</span>
                  ) : job.status === 'FAILED' ? (
                    <span className="text-red-400">{job.failedRows.toLocaleString()} failed</span>
                  ) : (
                    <span>Processing...</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-muted-foreground">
                  {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    PROCESSING: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/20',
    FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
}
