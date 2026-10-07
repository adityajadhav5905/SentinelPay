import { useQuery } from '@tanstack/react-query';
import { ingestionApi } from '../api-integration/ingestion';
import { authApi } from '../api-integration/auth';
import { subscriptionApi } from '../api-integration/subscriptions';
import { useState, useEffect } from 'react';
import { Database, Loader2, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnomaliesTable } from '../components/analysis/AnomaliesTable';

import { useAuth } from '../contexts/AuthContext';

// ... (in component)
export default function Analysis() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 1. Get User ID
  const { data: user } = useQuery({
    queryKey: ['user-profile'],
    queryFn: authApi.getProfile,
    enabled: isAuthenticated
  });

  // Fetch My Subscription
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: subscriptionApi.getMySubscription
  });

  const isPro = subscription?.plan === 'Pro' || subscription?.plan === 'Enterprise';

  // 2. Get Batch History
  const { data: batches, isLoading: historyLoading } = useQuery({
    queryKey: ['batch-history', user?.id],
    queryFn: () => ingestionApi.getBatchHistory(user?.id),
    enabled: !!user?.id
  });

  // 3. Auto-select Live Traffic (if Pro) or latest batch
  useEffect(() => {
    if (!selectedBatchId) {
      if (isPro) {
        setSelectedBatchId('live');
      } else if (batches && batches.length > 0) {
        const latest = batches.find(b => b.status === 'COMPLETED') || batches[0];
        setSelectedBatchId(latest.id);
      }
    }
  }, [selectedBatchId, isPro, batches]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Analysis Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Real-time anomaly detection and transaction insights
          </p>
        </div>

        {/* Batch Selection Dropdown */}
        {/* Batch Selection Dropdown */}
        <div className="relative z-50">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/10 transition-colors w-full md:min-w-[280px] md:w-auto justify-between group"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:text-indigo-300 transition-colors">
                <Database className="w-4 h-4" />
              </div>
              <span className="text-sm text-gray-200 truncate">
                {selectedBatchId === 'live'
                  ? 'Live Traffic (Real-time)'
                  : (selectedBatchId
                    ? batches?.find(b => b.id === selectedBatchId)?.filename
                    : 'Select Uploaded File')}
              </span>
            </div>
            {historyLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            )}
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute top-full right-0 mt-2 w-full min-w-[280px] bg-[#0A0A0B] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 py-1 max-h-60 overflow-y-auto">
                {isPro ? (
                  <button
                    onClick={() => {
                      setSelectedBatchId('live');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${selectedBatchId === 'live' ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-300'
                      }`}
                  >
                    <span className="truncate mr-3 font-medium">Live Traffic (Real-time)</span>
                    <span className="text-xs text-emerald-500 whitespace-nowrap">
                      Active
                    </span>
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed opacity-75">
                    <span className="truncate mr-3 font-medium">Live Traffic (Pro)</span>
                    <div className="text-[10px] font-bold bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20">
                      LOCKED
                    </div>
                  </div>
                )}
                <div className="h-px bg-white/10 my-1 mx-2" />
                {batches?.map(batch => (
                  <button
                    key={batch.id}
                    onClick={() => {
                      setSelectedBatchId(batch.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${selectedBatchId === batch.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-300'
                      }`}
                  >
                    <span className="truncate mr-3">{batch.filename}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(batch.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
                {(!batches || batches.length === 0) && (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">
                    No files found
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {!selectedBatchId ? (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/5">
          <Database className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-xl font-medium text-gray-400">No Data Selected</h3>
          <p className="text-gray-500 mt-2">Please select an uploaded CSV file from the dropdown above to view analysis.</p>
          <button
            onClick={() => navigate('/upload')}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Go to Upload
          </button>
        </div>
      ) : (
        <>
          {/* Anomalies List */}
          <AnomaliesTable batchId={selectedBatchId} userId={user?.id} />
        </>
      )}
    </div>
  );
}
