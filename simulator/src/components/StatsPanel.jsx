import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

export function StatsPanel({ stats, rateHistory }) {
  const chartData = useMemo(() => {
    return rateHistory.map((val, i) => ({ time: i, tps: val }));
  }, [rateHistory]);

  return (
    <div>
      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value accent">{stats.total}</div>
          <div className="stat-label">Total Sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value success">{stats.success}</div>
          <div className="stat-label">Success</div>
        </div>
        <div className="stat-card">
          <div className="stat-value danger">{stats.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value warning">{stats.anomalies}</div>
          <div className="stat-label">Anomalies</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--info)' }}>{stats.avgResponseTime}ms</div>
          <div className="stat-label">Avg RT</div>
        </div>
      </div>

      {/* TPS Chart */}
      {chartData.length > 1 && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,85,99,0.3)" />
              <XAxis
                dataKey="time"
                tick={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--border)' }}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                formatter={(val) => [`${val} txn/s`, 'Rate']}
                labelFormatter={() => ''}
              />
              <Line
                type="monotone"
                dataKey="tps"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
