import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { analyticsApi } from '../../api-integration/analytics';
import { AlertTriangle, Search, Filter, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

// Custom hook since use-debounce is not installed
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

export function AnomaliesTable({ batchId, userId }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 500);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: anomaliesResponse, isLoading, isError } = useQuery({
    queryKey: ['anomalies-list', batchId, userId, page, debouncedSearch, severityFilter, statusFilter],
    queryFn: () => analyticsApi.getAnomalies({
      batchId,
      limit: 10,
      userId,
      page,
      search: debouncedSearch,
      filter: severityFilter,
      status: statusFilter
    }),
    enabled: !!batchId && !!userId,
    placeholderData: keepPreviousData,
    refetchInterval: 10000
  });

  const anomalies = anomaliesResponse?.data || [];
  const pagination = anomaliesResponse?.pagination || { total: 0, page: 1, pages: 1 };

  return (
    <div className="bg-card border border-border/40 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Header & Controls */}
      <div className="p-4 border-b border-white/5 bg-muted/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-white">Detected Anomalies</h3>
          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full ml-2">
            Total: {pagination.total}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search ID, Merchant..."
              className="pl-9 pr-4 py-1.5 bg-black/20 border border-white/10 rounded-lg text-sm text-gray-200 w-full md:w-48 focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-gray-600"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Severity Filter */}
          <div className="relative">
            <select
              className="pl-3 pr-8 py-1.5 bg-black/20 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-black/30 transition-colors"
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              className="pl-3 pr-8 py-1.5 bg-black/20 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-black/30 transition-colors"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[300px]">
        {isLoading && anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
            Loading data...
          </div>
        ) : anomalies.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <p className="text-white font-medium">No records found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-muted/5 text-xs uppercase tracking-wider text-muted-foreground font-medium border-b border-white/5">
              <tr>
                <th className="px-5 py-3.5">Severity</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Merchant</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {anomalies.map((anomaly) => (
                <tr key={anomaly.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 py-3">
                    <SeverityBadge severity={anomaly.severity} />
                  </td>
                  <td className="px-5 py-3 text-gray-300 max-w-xs truncate font-medium" title={anomaly.explanation}>
                    {anomaly.explanation}
                  </td>
                  <td className="px-5 py-3 text-gray-400 font-mono text-xs">
                    {anomaly.merchant}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-white">
                    {anomaly.currency} {anomaly.amount?.toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${anomaly.status === 'Resolved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                      <div className={`w-1 h-1 rounded-full ${anomaly.status === 'Resolved' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      {anomaly.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-[10px] truncate max-w-[80px]" title={anomaly.id}>
                    {anomaly.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {pagination.pages > 1 && (
        <div className="p-4 border-t border-white/5 bg-muted/5 flex justify-between items-center text-xs text-gray-400">
          <div>
            Showing <span className="text-white font-medium">{((page - 1) * 10) + 1}</span> to <span className="text-white font-medium">{Math.min(page * 10, pagination.total)}</span> of <span className="text-white font-medium">{pagination.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-2 font-mono text-white/50">
              {page} / {pagination.pages}
            </div>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="p-1.5 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }) {
  const styles = {
    critical: 'bg-red-500/20 text-red-300 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  };

  const style = styles[severity?.toLowerCase()] || styles.medium;

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${style} uppercase tracking-wider inline-flex items-center gap-1`}>
      {severity}
    </span>
  );
}
