import { useEffect, useState } from 'react';
import { adminApi } from '../../api-integration/admin';
import { Users, IndianRupee, Activity, Server, Database, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsData, charts] = await Promise.all([
                adminApi.getStats(),
                adminApi.getChartData()
            ]);
            setStats(statsData);
            setChartData(charts);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <div className="text-center">
                <Loader2 className="animate-spin h-8 w-8 text-red-500 mx-auto mb-4" />
                <p className="text-zinc-500">Loading dashboard...</p>
            </div>
        </div>
    );

    // TODO: Revert hardcoded uniform data back to dynamic actuals
    // const trafficData = chartData?.trafficData || [];
    // const userAcquisitionData = chartData?.userAcquisition || [];
    
    const trafficData = [
        { name: 'Sat', transactions: 12, anomalies: 0 },
        { name: 'Sun', transactions: 15, anomalies: 1 },
        { name: 'Mon', transactions: 18, anomalies: 0 },
        { name: 'Tue', transactions: 24, anomalies: 2 },
        { name: 'Wed', transactions: 35, anomalies: 1 },
        { name: 'Thu', transactions: 42, anomalies: 3 },
        { name: 'Fri', transactions: 58, anomalies: 2 }
    ];

    const userAcquisitionData = [
        { name: 'Sat', newUsers: 12 },
        { name: 'Sun', newUsers: 8 },
        { name: 'Mon', newUsers: 24 },
        { name: 'Tue', newUsers: 19 },
        { name: 'Wed', newUsers: 32 },
        { name: 'Thu', newUsers: 27 },
        { name: 'Fri', newUsers: 22 }
    ];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
                    System Overview
                </h2>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Users"
                    value={stats?.users?.total || 0}
                    sub={`+${stats?.users?.newThisMonth || 0} this month`}
                    icon={Users}
                    trend="up"
                />
                <StatCard
                    title="Revenue (MRR)"
                    value={`₹${stats?.revenue?.mrr || 0}`}
                    sub="Monthly Recurring"
                    icon={IndianRupee}
                    trend="up"
                />
                <StatCard
                    title="Transactions"
                    value={stats?.activity?.transactions || 0}
                    sub={`${stats?.activity?.anomalies || 0} anomalies detected`}
                    icon={Database}
                />
                <StatCard
                    title="Anomaly Rate"
                    value={stats?.activity?.anomalyRate || '0%'}
                    sub="Detection Rate"
                    icon={AlertTriangle}
                    highlight={parseFloat(stats?.activity?.anomalyRate) > 5}
                />
            </div>

            {/* System Status */}
            <div className="glass-card p-6 rounded-xl border border-white/5 bg-black/40">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Server className="h-5 w-5 text-red-500" /> System Status
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
                    <StatusItem label="Overall Health" value={stats?.system?.health || 'UNKNOWN'} status={stats?.system?.health === 'HEALTHY' ? 'ok' : stats?.system?.health === 'DEGRADED' ? 'warning' : 'error'} />
                    <StatusItem label="Version" value={stats?.system?.version || '-'} />
                    <StatusItem label="Active Users" value={stats?.users?.active || 0} />
                    <StatusItem label="Uptime" value="99.9%" status="ok" />
                </div>

                {stats?.system?.components && (
                    <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
                        <h4 className="text-sm font-medium text-zinc-400 mb-3">Core Infrastructure Services</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <StatusItem
                                label="PostgreSQL Database"
                                value={stats.system.components.db}
                                status={stats.system.components.db === 'HEALTHY' ? 'ok' : 'error'}
                            />
                            <StatusItem
                                label="Redis Cache"
                                value={stats.system.components.redis}
                                status={stats.system.components.redis === 'HEALTHY' ? 'ok' : 'error'}
                            />
                            <StatusItem
                                label="Redpanda (Kafka)"
                                value={stats.system.components.kafka}
                                status={stats.system.components.kafka === 'HEALTHY' ? 'ok' : 'error'}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-xl border border-white/5 bg-black/40">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-red-500" /> Transaction & Anomaly Activity (Last 7 Days)
                    </h3>
                    <div className="h-[300px]">
                        {trafficData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trafficData}>
                                    <defs>
                                        <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorAnomaly" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="name" stroke="#666" />
                                    <YAxis stroke="#666" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '8px' }}
                                        labelStyle={{ color: '#fff' }}
                                    />
                                    <Legend />
                                    <Area type="monotone" dataKey="transactions" name="Transactions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTx)" />
                                    <Area type="monotone" dataKey="anomalies" name="Anomalies" stroke="#ef4444" fillOpacity={1} fill="url(#colorAnomaly)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-zinc-600">
                                <p>No transaction data available</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-card p-6 rounded-xl border border-white/5 bg-black/40">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-orange-500" /> User Acquisition (Last 7 Days)
                    </h3>
                    <div className="h-[300px]">
                        {userAcquisitionData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={userAcquisitionData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="name" stroke="#666" />
                                    <YAxis stroke="#666" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '8px' }}
                                        labelStyle={{ color: '#fff' }}
                                    />
                                    <Bar dataKey="newUsers" name="New Users" fill="#f97316" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-zinc-600">
                                <p>No user data available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Table */}
            <div className="glass-card p-6 rounded-xl border border-white/5 bg-black/40">
                <h3 className="text-lg font-semibold mb-4">Subscription Breakdown</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left py-3 px-4 text-zinc-500 font-medium">Plan</th>
                                <th className="text-right py-3 px-4 text-zinc-500 font-medium">Price</th>
                                <th className="text-right py-3 px-4 text-zinc-500 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 px-4">Free</td>
                                <td className="text-right py-3 px-4 text-zinc-400">₹0</td>
                                <td className="text-right py-3 px-4"><span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">Active</span></td>
                            </tr>
                            <tr className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 px-4">Basic</td>
                                <td className="text-right py-3 px-4 text-zinc-400">₹29/mo</td>
                                <td className="text-right py-3 px-4"><span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">Active</span></td>
                            </tr>
                            <tr className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 px-4">Pro</td>
                                <td className="text-right py-3 px-4 text-zinc-400">₹99/mo</td>
                                <td className="text-right py-3 px-4"><span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">Active</span></td>
                            </tr>
                            <tr className="hover:bg-white/5">
                                <td className="py-3 px-4">Enterprise</td>
                                <td className="text-right py-3 px-4 text-zinc-400">₹299/mo</td>
                                <td className="text-right py-3 px-4"><span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">Active</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, sub, icon: Icon, trend, highlight }) {
    return (
        <div className={`glass-card p-6 rounded-xl border ${highlight ? 'border-red-500/30' : 'border-white/5'} bg-black/40 relative overflow-hidden group hover:border-red-500/30 transition-all`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon className="h-16 w-16 text-red-500" />
            </div>
            <div className="relative z-10">
                <p className="text-sm font-medium text-zinc-500">{title}</p>
                <h3 className="text-2xl font-bold mt-2 text-white">{value}</h3>
                <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${highlight ? 'text-red-400' : trend === 'up' ? 'text-green-400' : 'text-zinc-400'}`}>
                    {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                    {sub}
                </p>
            </div>
        </div>
    );
}

function StatusItem({ label, value, status }) {
    return (
        <div className="bg-white/5 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">{label}</p>
            <p className={`font-semibold flex items-center gap-2 ${status === 'ok' ? 'text-green-400' :
                status === 'warning' ? 'text-yellow-400' :
                    status === 'error' ? 'text-red-400' : 'text-white'
                }`}>
                {status && <span className={`h-2 w-2 rounded-full ${status === 'ok' ? 'bg-green-500' :
                    status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />}
                {value}
            </p>
        </div>
    );
}
