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
  ransomware: '#ef4444',
  apt: '#dc2626',
  vulnerability: '#f59e0b',
  phishing: '#eab308',
  malware: '#f97316',
  data_breach: '#8b5cf6',
  ddos: '#ec4899',
  supply_chain: '#06b6d4',
  insider_threat: '#84cc16',
  other: '#6b7280',
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-400 py-12">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
        <p>Failed to load dashboard statistics</p>
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
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Threats</p>
              <p className="text-3xl font-bold text-white mt-2">{stats.total_threats}</p>
            </div>
            <BarChart3 className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Today</p>
              <p className="text-3xl font-bold text-white mt-2">{stats.threats_today}</p>
            </div>
            <Activity className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">This Week</p>
              <p className="text-3xl font-bold text-white mt-2">{stats.threats_this_week}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Trending Insights */}
      {stats.recent_trends && stats.recent_trends.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
            AI-Detected Trends
          </h2>
          <div className="space-y-4">
            {stats.recent_trends.slice(0, 1).map((trend) => (
              <div key={trend.id} className="border-l-4 border-blue-500 pl-4">
                <p className="text-gray-300 whitespace-pre-wrap">{trend.trend_summary}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Based on {trend.threat_count} threats • Week of{' '}
                  {new Date(trend.week_start * 1000).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-bold text-white mb-4">Threats by Category (30 days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Breakdown */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-lg font-bold text-white mb-4">Severity Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Sources */}
      <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
        <h2 className="text-lg font-bold text-white mb-4">Top Sources (30 days)</h2>
        <div className="space-y-3">
          {stats.top_sources.slice(0, 5).map((source, index) => (
            <div key={source.source} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                <span className="text-gray-300">{source.source}</span>
              </div>
              <span className="text-blue-500 font-semibold">{source.count} threats</span>
            </div>
          ))}
        </div>
      </div>

      {/* View All Button */}
      <div className="text-center">
        <button
          onClick={onViewThreats}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition inline-flex items-center"
        >
          View All Threats
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
}
