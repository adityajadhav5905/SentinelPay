import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/layout/Header';
import { StatsCard } from '../components/dashboard/StatsCard';
import { ProfileStatusBanner } from '../components/dashboard/ProfileStatusBanner';
import { Activity, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { analyticsApi } from '../api-integration/analytics';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState('all');

  // 1. Fetch Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', range], // Add range to queryKey to trigger refetch
    queryFn: () => analyticsApi.getStats(range), // Pass range to API
    refetchInterval: 30000
  });

  // 2. Fetch Trends
  const { data: trendData, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends', range],
    queryFn: () => analyticsApi.getTrends(range),
    select: (data) => data?.map(d => ({
      ...d,
      time: d.timestamp
        ? (() => {
          const date = new Date(d.timestamp);
          if (range === '24h') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          if (range === '7d') return date.toLocaleDateString([], { weekday: 'short' });
          if (range === '30d') return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
          if (range === '1y') return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
          return date.toLocaleDateString([], { month: 'short', year: 'numeric' }); // 'all'
        })()
        : d.time
    }))
  });

  // ... (rest is same)

  // In the JSX:
  <div className="flex gap-2">
    {['24h', '7d', '30d', '1y', 'all'].map((r) => (
      <button
        key={r}
        onClick={() => setRange(r)}
        className={`px-3 py-1 rounded-lg text-xs transition-colors ${range === r
          ? 'bg-indigo-500 text-white shadow-lg'
          : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
      >
        {r === 'all' ? 'All' : r}
      </button>
    ))}
  </div>
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: analyticsApi.getRecentActivity,
    refetchInterval: 15000
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-md border border-border/50 p-4 rounded-xl shadow-xl">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-xs text-indigo-400 flex items-center justify-between gap-4">
              <span>Transactions:</span>
              <span className="font-mono font-bold">{payload[0].value}</span>
            </p>
            <p className="text-xs text-cyan-400 flex items-center justify-between gap-4">
              <span>Anomalies:</span>
              <span className="font-mono font-bold">{payload[1].value}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <Header title="Dashboard" />

      {/* Profile Status Banner - non-blocking info */}
      {user?.id && <ProfileStatusBanner userId={user.id} />}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard
          title="Total Transactions"
          value={statsLoading ? "..." : stats?.totalTransactions?.value}
          change={stats?.totalTransactions?.change}
          trend={stats?.totalTransactions?.trend}
          icon={Activity}
        />
        <StatsCard
          title="Anomalies Detected"
          value={statsLoading ? "..." : stats?.anomaliesDetected?.value}
          change={stats?.anomaliesDetected?.change}
          trend={stats?.anomaliesDetected?.trend}
          icon={AlertTriangle}
        />
        <StatsCard
          title="System Status"
          value={statsLoading ? "..." : stats?.systemStatus?.status}
          change={stats?.systemStatus?.value}
          trend="up"
          icon={CheckCircle}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Chart Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 glass-panel p-6 rounded-2xl"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Anomaly Trends</h3>
              <div className="flex items-center gap-4 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-xs text-muted-foreground">Transactions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="text-xs text-muted-foreground">Anomalies</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['24h', '7d', '30d', '1y', 'all'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${range === r
                    ? 'bg-indigo-500 text-white shadow-lg'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[200px] md:h-[300px] w-full">
            {trendsLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-8 w-8 bg-muted/50 rounded-full mb-2"></div>
                  <span className="text-xs">Loading trends...</span>
                </div>
              </div>
            ) : !trendData || trendData.length === 0 || trendData.every(d => d.value === 0 && d.anomalies === 0) ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="flex flex-col items-center">
                  <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
                  <span className="text-sm font-medium">No trend data for this period</span>
                  <span className="text-xs mt-1 opacity-60">Upload transactions to see trends here</span>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="99%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
                    tickLine={false}
                    dy={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-5}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    strokeWidth={2.5}
                    name="Transactions"
                    dot={(props) => {
                      if (props.value === 0) return null;
                      return <circle cx={props.cx} cy={props.cy} r={3} fill="#6366f1" stroke="#1e1b4b" strokeWidth={2} />;
                    }}
                    activeDot={{ r: 5, fill: '#818cf8', stroke: '#312e81', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="anomalies"
                    stroke="#22d3ee"
                    fillOpacity={1}
                    fill="url(#colorAnomalies)"
                    strokeWidth={2.5}
                    name="Anomalies"
                    dot={(props) => {
                      if (props.value === 0) return null;
                      return <circle cx={props.cx} cy={props.cy} r={3} fill="#22d3ee" stroke="#083344" strokeWidth={2} />;
                    }}
                    activeDot={{ r: 5, fill: '#67e8f9', stroke: '#164e63', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>


        {/* Recent Activity Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6 rounded-2xl"
        >
          <h3 className="text-lg font-semibold text-foreground mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {activityLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">Loading activity...</div>
            ) : activityData?.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">No recent activity</div>
            ) : (
              activityData?.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${item.severity === 'critical' ? 'bg-red-500/10 text-red-500 group-hover:bg-red-500/20' :
                    item.severity === 'high' ? 'bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20' :
                      'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20'
                    }`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-foreground">{item.type}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

