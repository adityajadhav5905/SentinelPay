import { Header } from '../components/layout/Header';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, Filter, MoreHorizontal, ChevronLeft, ChevronRight, 
  CheckCircle, Clock, Search as SearchIcon, X, Check, ShieldAlert, ShieldCheck, Eye 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '../api-integration/analytics';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
// Custom hook to avoid missing dependency 'use-debounce'

// Custom hook to avoid missing dependency 'use-debounce'
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return [debouncedValue];
}

export default function Anomalies() {
  const [filter, setFilter] = useState('All'); // Options: All, Critical, High, Medium, Low, Resolved
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('q') || '';
  const [localSearch, setLocalSearch] = useState(urlSearch);
  const [debouncedSearch] = useDebounce(localSearch, 500);

  const [page, setPage] = useState(1);
  const [activeActionId, setActiveActionId] = useState(null);

  // Resolution Modal State
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState(null);
  const [feedbackReason, setFeedbackReason] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');

  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  // Using useMutation from react-query
  const resolveMutation = useMutation({
    mutationFn: ({ id, reason, notes }) => analyticsApi.resolveAnomaly(id, {
      isFalsePositive: true,
      feedbackReason: reason,
      feedbackNotes: notes
    }),
    onSuccess: () => {
      toast.success('Anomaly resolved — your feedback will improve the model');
      setIsResolveModalOpen(false);
      setFeedbackReason('');
      setFeedbackNotes('');
      setSelectedAnomalyId(null);
      queryClient.invalidateQueries({ queryKey: ['anomalies-page'] });
    },
    onError: (err) => {
      console.error("Failed to resolve", err);
      toast.error('Failed to resolve anomaly');
    }
  });

  // Sync local search with URL
  useEffect(() => {
    setLocalSearch(urlSearch);
  }, [urlSearch]);

  // Update URL when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      setSearchParams(prev => {
        if (debouncedSearch) prev.set('q', debouncedSearch);
        else prev.delete('q');
        return prev;
      });
      setPage(1);
    }
  }, [debouncedSearch]);


  // Determine API params
  const getQueryParams = () => {
    const params = { page, limit: 10, search: debouncedSearch };

    // Status Logic
    if (filter === 'Resolved') {
      params.status = 'Resolved';
    } else {
      // For severity filters, we usually look at Pending issues
      if (filter !== 'All') {
        params.status = 'Pending';
        params.filter = filter.toUpperCase();
      }
      // If 'All', we don't set status, so it returns both Pending and Resolved
    }
    return params;
  };

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['anomalies-page', filter, debouncedSearch, page],
    queryFn: () => analyticsApi.getAnomalies(getQueryParams()),
    enabled: isAuthenticated,
    placeholderData: (previousData) => previousData,
  });

  const anomalies = data?.data || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  const handleExport = async () => {
    try {
      const blob = await analyticsApi.exportAnomalies();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'anomalies.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export started');
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Failed to export anomalies');
    }
  };

  const navigate = useNavigate();

  const handleMarkFraudDirect = (id) => {
    setActiveActionId(null);
    resolveMutation.mutate({
      id,
      reason: 'CONFIRMED_FRAUD',
      notes: 'Marked as verified fraud by risk analyst.'
    });
  };

  const handleMarkGenuineDirect = (id) => {
    setActiveActionId(null);
    resolveMutation.mutate({
      id,
      reason: 'LEGITIMATE_TRANSACTION',
      notes: 'Verified as genuine customer transaction.'
    });
  };

  const openResolveModal = (id) => {
    setSelectedAnomalyId(id);
    setFeedbackReason('');
    setFeedbackNotes('');
    setIsResolveModalOpen(true);
    setActiveActionId(null);
  };

  const tabs = ['All', 'Critical', 'High', 'Medium', 'Low', 'Resolved'];

  return (
    <div className="min-h-screen pb-20 relative">
      <Header title="Anomalies Explorer" />

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 overflow-x-auto max-w-full">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => { setFilter(tab); setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                  filter === tab
                    ? "bg-indigo-500 text-white shadow-lg"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* In-page Search */}
          <div className="relative group flex-1 md:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search transaction, merchant..."
              className="pl-9 pr-8 py-2 w-full bg-muted/30 border border-border/50 rounded-xl text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto justify-end">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20 whitespace-nowrap"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="glass-panel rounded-2xl overflow-hidden min-h-[400px] flex flex-col">
        {/* Desktop Header - hidden on mobile */}
        <div className="hidden md:grid grid-cols-7 gap-4 p-4 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
          <div className="col-span-1">Transaction ID</div>
          <div className="col-span-1">Merchant</div>
          <div className="col-span-2">Reason</div>
          <div className="col-span-1">Severity</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        <div className="flex-1 relative">
          {isLoading && !isPlaceholderData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-muted-foreground bg-background/50 z-10">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              Loading anomalies...
            </div>
          ) : null}

          {anomalies.length === 0 && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-muted-foreground">
              <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-foreground">No anomalies found</p>
              <p className="text-sm">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="bg-transparent">
              <AnimatePresence mode="popLayout">
                {anomalies.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border/10 hover:bg-muted/30 transition-colors group relative"
                  >
                    {/* Desktop row */}
                    <div 
                      onClick={() => navigate(`/investigations?txId=${encodeURIComponent(item.displayId || item.id)}`)}
                      className="hidden md:grid grid-cols-7 gap-4 p-4 items-center cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="col-span-1 font-medium text-indigo-400 hover:text-indigo-300 underline text-ellipsis overflow-hidden text-xs font-mono" title={item.displayId}>
                        {item.displayId?.substring(0, 12)}...
                      </div>
                      <div className="col-span-1 text-muted-foreground text-sm truncate" title={item.merchant || 'Unknown'}>{item.merchant || 'Unknown'}</div>
                      <div className="col-span-2 text-foreground/80 text-sm truncate" title={item.explanation}>
                        {item.explanation || 'Anomaly detected'}
                      </div>
                      <div className="col-span-1">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                          item.severity === 'CRITICAL' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                            item.severity === 'HIGH' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                              item.severity === 'MEDIUM' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                "bg-green-500/10 text-green-500 border-green-500/20"
                        )}>
                          {item.severity === 'CRITICAL' && <AlertTriangle className="h-3 w-3" />}
                          {item.severity ? item.severity.charAt(0).toUpperCase() + item.severity.slice(1).toLowerCase() : 'Unknown'}
                        </span>
                      </div>
                      <div className="col-span-1">
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-lg flex items-center gap-1 w-fit",
                          item.status === 'Resolved' ? "text-green-500 bg-green-500/10" : "text-amber-500 bg-amber-500/10"
                        )}>
                          {item.status === 'Resolved' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {item.status}
                        </span>
                      </div>
                      <div className="col-span-1 flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveActionId(activeActionId === item.id ? null : item.id)}
                          className="p-2 hover:bg-muted/80 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div 
                      onClick={() => navigate(`/investigations?txId=${encodeURIComponent(item.displayId || item.id)}`)}
                      className="md:hidden p-4 space-y-2 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                          item.severity === 'CRITICAL' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                            item.severity === 'HIGH' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                              item.severity === 'MEDIUM' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                "bg-green-500/10 text-green-500 border-green-500/20"
                        )}>
                          {item.severity === 'CRITICAL' && <AlertTriangle className="h-3 w-3" />}
                          {item.severity ? item.severity.charAt(0).toUpperCase() + item.severity.slice(1).toLowerCase() : 'Unknown'}
                        </span>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-lg flex items-center gap-1",
                            item.status === 'Resolved' ? "text-green-500 bg-green-500/10" : "text-amber-500 bg-amber-500/10"
                          )}>
                            {item.status === 'Resolved' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {item.status}
                          </span>
                          <button
                            onClick={() => setActiveActionId(activeActionId === item.id ? null : item.id)}
                            className="p-1.5 hover:bg-muted/80 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground">{item.merchant || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.explanation || 'Anomaly detected'}</p>
                      <p className="text-[10px] font-mono text-indigo-400">ID: {item.displayId?.substring(0, 16)}...</p>
                    </div>

                    {/* Actions Menu (shared) */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      {activeActionId === item.id && (
                        <div className="absolute right-4 bottom-0 w-64 bg-card text-card-foreground border border-border rounded-xl shadow-2xl z-20 overflow-hidden py-1">
                          <button
                            onClick={() => handleMarkFraudDirect(item.id)}
                            className="w-full text-left px-4 py-2.5 text-xs text-red-500 hover:bg-red-500/10 flex items-center gap-2 font-semibold transition-colors"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> Mark as Confirmed Fraud
                          </button>
                          <button
                            onClick={() => handleMarkGenuineDirect(item.id)}
                            className="w-full text-left px-4 py-2.5 text-xs text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-2 font-semibold transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Mark as Genuine / Safe
                          </button>
                          <button
                            onClick={() => openResolveModal(item.id)}
                            className="w-full text-left px-4 py-2.5 text-xs text-blue-500 hover:bg-blue-500/10 flex items-center gap-2 font-semibold transition-colors border-t border-border/50"
                          >
                            <Check className="w-3.5 h-3.5 text-blue-500" /> Mark as Resolved (Add Notes)
                          </button>
                          <button
                            onClick={() => { setActiveActionId(null); navigate(`/investigations?txId=${encodeURIComponent(item.displayId || item.id)}`); }}
                            className="w-full text-left px-4 py-2.5 text-xs text-indigo-500 hover:bg-indigo-500/10 flex items-center gap-2 font-semibold transition-colors border-t border-border/50"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-500" /> Open in Investigation Console
                          </button>
                        </div>
                      )}
                      {activeActionId === item.id && (
                        <div className="fixed inset-0 z-10" style={{ cursor: 'default' }} onClick={(e) => { e.stopPropagation(); setActiveActionId(null); }} />
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-border/50 bg-muted/5 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{pagination.pages}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="p-2 rounded-lg hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages || isLoading}
                className="p-2 rounded-lg hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      <AnimatePresence>
        {isResolveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsResolveModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border shadow-2xl rounded-xl w-full max-w-md p-6 relative z-10"
            >
              <h3 className="text-lg font-semibold mb-1">Resolve Anomaly</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Why is this not an anomaly? Your feedback helps improve the model.
              </p>

              <div className="space-y-4">
                {/* Structured Resolve Reasons */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">Select a reason</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { value: 'KNOWN_MERCHANT', label: 'Known merchant / regular store', icon: '🏪' },
                      { value: 'EXPECTED_AMOUNT', label: 'Expected large purchase', icon: '💰' },
                      { value: 'NORMAL_TIME', label: 'Normal time for me', icon: '🕐' },
                      { value: 'REGULAR_PATTERN', label: 'Regular recurring payment', icon: '🔄' },
                      { value: 'TEST_TRANSACTION', label: 'Test / internal transaction', icon: '🧪' },
                      { value: 'OTHER', label: 'Other reason', icon: '📝' },
                    ].map((reason) => (
                      <button
                        key={reason.value}
                        type="button"
                        onClick={() => setFeedbackReason(reason.value)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg border text-sm flex items-center gap-3 transition-all",
                          feedbackReason === reason.value
                            ? "border-indigo-500 bg-indigo-500/10 text-foreground ring-1 ring-indigo-500/30"
                            : "border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                      >
                        <span className="text-base">{reason.icon}</span>
                        <span className="flex-1">{reason.label}</span>
                        {feedbackReason === reason.value && (
                          <Check className="w-4 h-4 text-indigo-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional additional notes */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Additional notes (optional)</label>
                  <textarea
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg p-3 text-sm min-h-[60px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-muted-foreground/50"
                    placeholder="Any extra context..."
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setIsResolveModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => resolveMutation.mutate({
                      id: selectedAnomalyId,
                      reason: feedbackReason,
                      notes: feedbackNotes
                    })}
                    disabled={resolveMutation.isPending || !feedbackReason}
                    className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {resolveMutation.isPending ? 'Resolving...' : 'Confirm Resolution'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
