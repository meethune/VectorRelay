import { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Activity,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
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

interface DashboardStats {
  total_threats: number;
  threats_today: number;
  threats_this_week: number;
  category_breakdown: Record<string, number>;
  severity_breakdown: Record<string, number>;
  top_sources: Array<{ source: string; count: number }>;
  recent_trends: Array<any>;
}

const CATEGORY_COLORS: Record<string, string> = {
  ransomware: '#00ff00',
  apt: '#00dd00',
  vulnerability: '#00cc00',
  phishing: '#00bb00',
  malware: '#00aa00',
  data_breach: '#009900',
  ddos: '#008800',
  supply_chain: '#007700',
  insider_threat: '#006600',
  other: '#005500',
};

export default function Dashboard({ onViewThreats }: { onViewThreats: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-terminal-green font-mono">
          <div className="text-2xl mb-4">[ LOADING DATA ]</div>
          <div className="animate-pulse">▓▓▓▓▓▓▓▓▓▓</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-terminal-green py-12 border-2 border-terminal-green p-8">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 icon-glow" />
        <p className="font-mono">[ ERROR ] FAILED TO LOAD DASHBOARD STATISTICS</p>
      </div>
    );
  }

  const categoryData = Object.entries(stats.category_breakdown).map(([name, value]) => ({
    name,
    value,
    color: CATEGORY_COLORS[name] || '#6b7280',
  }));

  const severityData = Object.entries(stats.severity_breakdown).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black p-6 border-2 border-terminal-green relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-terminal-green opacity-50"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-terminal-green-dim text-sm font-mono">&gt; TOTAL_THREATS</p>
              <p className="text-4xl font-bold text-terminal-green mt-2 font-mono">{stats.total_threats}</p>
            </div>
            <BarChart3 className="w-12 h-12 text-terminal-green opacity-30 icon-glow" />
          </div>
        </div>

        <div className="bg-black p-6 border-2 border-terminal-green relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-terminal-green opacity-50"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-terminal-green-dim text-sm font-mono">&gt; TODAY</p>
              <p className="text-4xl font-bold text-terminal-green mt-2 font-mono">{stats.threats_today}</p>
            </div>
            <Activity className="w-12 h-12 text-terminal-green opacity-30 icon-glow" />
          </div>
        </div>

        <div className="bg-black p-6 border-2 border-terminal-green relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-terminal-green opacity-50"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-terminal-green-dim text-sm font-mono">&gt; THIS_WEEK</p>
              <p className="text-4xl font-bold text-terminal-green mt-2 font-mono">{stats.threats_this_week}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-terminal-green opacity-30 icon-glow" />
          </div>
        </div>
      </div>

      {/* Trending Insights */}
      {stats.recent_trends && stats.recent_trends.length > 0 && (
        <div className="bg-black p-6 border-2 border-terminal-green">
          <h2 className="text-xl font-bold text-terminal-green mb-4 flex items-center font-mono">
            <TrendingUp className="w-5 h-5 mr-2 icon-glow" />
            [ AI_DETECTED_TRENDS ]
          </h2>
          <div className="space-y-4">
            {stats.recent_trends.slice(0, 1).map((trend) => (
              <div key={trend.id} className="border-l-4 border-terminal-green pl-4 bg-terminal-gray-dark p-4">
                <p className="text-terminal-green font-mono whitespace-pre-wrap">{trend.trend_summary}</p>
                <p className="text-sm text-terminal-green-dim mt-2 font-mono">
                  &gt; ANALYZED: {trend.threat_count} THREATS | WEEK_OF: {new Date(trend.week_start * 1000).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-black p-6 border-2 border-terminal-green">
          <h2 className="text-lg font-bold text-terminal-green mb-4 font-mono">[ THREATS_BY_CATEGORY ] (30_DAYS)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name.toUpperCase()} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#00ff00"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#000000',
                  border: '2px solid #00ff00',
                  fontFamily: 'monospace',
                  color: '#00ff00',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Breakdown */}
        <div className="bg-black p-6 border-2 border-terminal-green">
          <h2 className="text-lg font-bold text-terminal-green mb-4 font-mono">[ SEVERITY_DISTRIBUTION ]</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00ff00" opacity={0.2} />
              <XAxis dataKey="name" stroke="#00ff00" style={{ fontFamily: 'monospace' }} />
              <YAxis stroke="#00ff00" style={{ fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#000000',
                  border: '2px solid #00ff00',
                  fontFamily: 'monospace',
                  color: '#00ff00',
                }}
              />
              <Bar dataKey="value" fill="#00ff00" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Sources */}
      <div className="bg-black p-6 border-2 border-terminal-green">
        <h2 className="text-lg font-bold text-terminal-green mb-4 font-mono">[ TOP_SOURCES ] (30_DAYS)</h2>
        <div className="space-y-3">
          {stats.top_sources.slice(0, 5).map((source, index) => (
            <div key={source.source} className="flex items-center justify-between border-l-2 border-terminal-green-dark pl-4 py-2">
              <div className="flex items-center space-x-3">
                <span className="text-xl font-bold text-terminal-green-dim font-mono">[{index + 1}]</span>
                <span className="text-terminal-green font-mono">{source.source}</span>
              </div>
              <span className="text-terminal-green font-mono">{source.count} THREATS</span>
            </div>
          ))}
        </div>
      </div>

      {/* View All Button */}
      <div className="text-center">
        <button
          onClick={onViewThreats}
          className="bg-terminal-green hover:bg-terminal-green-dim text-black px-6 py-3 border-2 border-terminal-green font-mono font-bold transition inline-flex items-center"
        >
          [ VIEW_ALL_THREATS ]
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
}
