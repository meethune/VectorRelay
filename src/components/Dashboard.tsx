import { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Activity,
  BarChart3,
} from 'lucide-react';
import { fetchWithCache, CacheTTL } from '../utils/cache';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { CATEGORY_COLORS } from '../constants/theme';
import { LoadingState } from './common/LoadingState';
import { EmptyState } from './common/EmptyState';

interface DashboardStats {
  total_threats: number;
  threats_today: number;
  threats_this_week: number;
  category_breakdown: Record<string, number>;
  severity_breakdown: Record<string, number>;
  top_sources: Array<{ source: string; count: number }>;
  recent_trends: Array<any>;
}

export default function Dashboard() {
  const { theme, formatText } = useTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isTerminal = theme === 'terminal';
  const categoryColors = CATEGORY_COLORS[theme];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await fetchWithCache(
        'dashboard-stats',
        async () => {
          const response = await fetch('/api/stats');
          if (!response.ok) {
            throw new Error('Failed to fetch stats');
          }
          return response.json() as Promise<DashboardStats>;
        },
        { ttl: CacheTTL.FIVE_MINUTES, keyPrefix: 'threat-intel' }
      );
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!stats) {
    return (
      <EmptyState
        icon={<AlertTriangle className={`w-12 h-12 ${isTerminal ? 'icon-glow' : ''}`} />}
        message={isTerminal ? 'ERROR' : 'Failed to load dashboard statistics'}
        description={isTerminal ? 'FAILED_TO_LOAD_DASHBOARD_STATISTICS' : undefined}
      />
    );
  }

  const categoryData = Object.entries(stats.category_breakdown).map(([name, value]) => ({
    name,
    value,
    color: categoryColors[name] || '#6b7280',
  }));

  const severityData = Object.entries(stats.severity_breakdown).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 border-2 relative overflow-hidden ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          <div className={`absolute top-0 left-0 w-full h-1 opacity-50 ${
            isTerminal ? 'bg-terminal-green' : 'bg-business-accent-primary'
          }`}></div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${
                isTerminal
                  ? 'text-terminal-green-dim font-mono'
                  : 'text-business-text-muted font-sans'
              }`}>{formatText('Total Threats', { style: 'label' })}</p>
              <p className={`text-4xl font-bold mt-2 ${
                isTerminal
                  ? 'text-terminal-green font-mono'
                  : 'text-business-text-primary font-sans'
              }`}>{stats.total_threats}</p>
            </div>
            <BarChart3 className={`w-12 h-12 opacity-30 ${
              isTerminal ? 'text-terminal-green icon-glow' : 'text-business-accent-primary'
            }`} />
          </div>
        </div>

        <div className={`p-6 border-2 relative overflow-hidden ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          <div className={`absolute top-0 left-0 w-full h-1 opacity-50 ${
            isTerminal ? 'bg-terminal-green' : 'bg-business-accent-primary'
          }`}></div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${
                isTerminal
                  ? 'text-terminal-green-dim font-mono'
                  : 'text-business-text-muted font-sans'
              }`}>{formatText('Today', { style: 'label' })}</p>
              <p className={`text-4xl font-bold mt-2 ${
                isTerminal
                  ? 'text-terminal-green font-mono'
                  : 'text-business-text-primary font-sans'
              }`}>{stats.threats_today}</p>
            </div>
            <Activity className={`w-12 h-12 opacity-30 ${
              isTerminal ? 'text-terminal-green icon-glow' : 'text-business-accent-primary'
            }`} />
          </div>
        </div>

        <div className={`p-6 border-2 relative overflow-hidden ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          <div className={`absolute top-0 left-0 w-full h-1 opacity-50 ${
            isTerminal ? 'bg-terminal-green' : 'bg-business-accent-primary'
          }`}></div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${
                isTerminal
                  ? 'text-terminal-green-dim font-mono'
                  : 'text-business-text-muted font-sans'
              }`}>{formatText('This Week', { style: 'label' })}</p>
              <p className={`text-4xl font-bold mt-2 ${
                isTerminal
                  ? 'text-terminal-green font-mono'
                  : 'text-business-text-primary font-sans'
              }`}>{stats.threats_this_week}</p>
            </div>
            <TrendingUp className={`w-12 h-12 opacity-30 ${
              isTerminal ? 'text-terminal-green icon-glow' : 'text-business-accent-primary'
            }`} />
          </div>
        </div>
      </div>

      {/* Trending Insights */}
      {stats.recent_trends && stats.recent_trends.length > 0 && (
        <div className={`p-6 border-2 ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          <h2 className={`text-xl font-bold mb-4 flex items-center ${
            isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'
          }`}>
            <TrendingUp className={`w-5 h-5 mr-2 ${isTerminal ? 'icon-glow' : ''}`} />
            {formatText('AI-Detected Trends', { style: 'heading' })}
          </h2>
          <div className="space-y-4">
            {stats.recent_trends.slice(0, 1).map((trend) => (
              <div key={trend.id} className={`border-l-4 pl-4 p-4 ${
                isTerminal
                  ? 'border-terminal-green bg-terminal-gray-dark'
                  : 'border-business-accent-primary bg-business-bg-tertiary'
              }`}>
                <p className={`whitespace-pre-wrap ${
                  isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'
                }`}>{trend.trend_summary}</p>
                <p className={`text-sm mt-2 ${
                  isTerminal
                    ? 'text-terminal-green-dim font-mono'
                    : 'text-business-text-muted font-sans'
                }`}>
                  {isTerminal
                    ? `> ANALYZED: ${trend.threat_count} THREATS | WEEK_OF: ${new Date(trend.week_start * 1000).toLocaleDateString()}`
                    : `Analyzed ${trend.threat_count} threats • Week of ${new Date(trend.week_start * 1000).toLocaleDateString()}`
                  }
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className={`p-6 border-2 ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          <h2 className={`text-lg font-bold mb-4 ${
            isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'
          }`}>
            {isTerminal ? '[ THREATS_BY_CATEGORY ] (30_DAYS)' : 'Threats by Category (30 days)'}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  isTerminal
                    ? `${name.toUpperCase()} (${(percent * 100).toFixed(0)}%)`
                    : `${name} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={80}
                fill={isTerminal ? '#00ff00' : '#A8DADC'}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: isTerminal ? '#000000' : '#2C2C2C',
                  border: isTerminal ? '2px solid #00ff00' : '2px solid #404040',
                  fontFamily: isTerminal ? 'monospace' : 'sans-serif',
                  color: isTerminal ? '#00ff00' : '#E4E4E4',
                }}
                labelStyle={{
                  color: isTerminal ? '#00ff00' : '#E4E4E4',
                  fontFamily: isTerminal ? 'monospace' : 'sans-serif',
                }}
                itemStyle={{
                  color: isTerminal ? '#00ff00' : '#E4E4E4',
                  fontFamily: isTerminal ? 'monospace' : 'sans-serif',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Breakdown */}
        <div className={`p-6 border-2 ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          <h2 className={`text-lg font-bold mb-4 ${
            isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'
          }`}>
            {formatText('Severity Distribution', { style: 'heading' })}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={severityData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isTerminal ? '#00ff00' : '#404040'}
                opacity={0.2}
              />
              <XAxis
                dataKey="name"
                stroke={isTerminal ? '#00ff00' : '#A0A0A0'}
                style={{ fontFamily: isTerminal ? 'monospace' : 'sans-serif' }}
              />
              <YAxis
                stroke={isTerminal ? '#00ff00' : '#A0A0A0'}
                style={{ fontFamily: isTerminal ? 'monospace' : 'sans-serif' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isTerminal ? '#000000' : '#2C2C2C',
                  border: isTerminal ? '2px solid #00ff00' : '2px solid #404040',
                  fontFamily: isTerminal ? 'monospace' : 'sans-serif',
                  color: isTerminal ? '#00ff00' : '#E4E4E4',
                }}
                labelStyle={{
                  color: isTerminal ? '#00ff00' : '#E4E4E4',
                  fontFamily: isTerminal ? 'monospace' : 'sans-serif',
                }}
                itemStyle={{
                  color: isTerminal ? '#00ff00' : '#E4E4E4',
                  fontFamily: isTerminal ? 'monospace' : 'sans-serif',
                }}
              />
              <Bar dataKey="value" fill={isTerminal ? '#00ff00' : '#A8DADC'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Sources */}
      <div className={`p-6 border-2 ${
        isTerminal
          ? 'bg-black border-terminal-green'
          : 'bg-business-bg-secondary border-business-border-primary'
      }`}>
        <h2 className={`text-lg font-bold mb-4 ${
          isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'
        }`}>
          {isTerminal ? '[ TOP_SOURCES ] (30_DAYS)' : 'Top Sources (30 days)'}
        </h2>
        <div className="space-y-3">
          {stats.top_sources.slice(0, 5).map((source, index) => (
            <div key={source.source} className={`flex items-center justify-between border-l-2 pl-4 py-2 ${
              isTerminal
                ? 'border-terminal-green-dark'
                : 'border-business-border-secondary'
            }`}>
              <div className="flex items-center space-x-3">
                <span className={`text-xl font-bold ${
                  isTerminal
                    ? 'text-terminal-green-dim font-mono'
                    : 'text-business-accent-primary font-sans'
                }`}>{isTerminal ? `[${index + 1}]` : `${index + 1}.`}</span>
                <span className={isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'}>
                  {source.source}
                </span>
              </div>
              <span className={isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-secondary font-sans'}>
                {source.count} {formatText('threats')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
