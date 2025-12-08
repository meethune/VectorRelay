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
import { RetroGrid } from './ui/retro-grid';
import { FlickeringGrid } from './ui/flickering-grid';
import { AnimatedGridPattern } from './ui/animated-grid-pattern';
import { TextAnimate } from './ui/text-animate';
import { HyperText } from './ui/hyper-text';
import { NumberTicker } from './ui/number-ticker';
import { Particles } from './ui/particles';
import { DotPattern } from './ui/dot-pattern';
import { BorderBeam } from './ui/border-beam';
import { MagicCard } from './ui/magic-card';

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
        icon={<AlertTriangle className="w-12 h-12" />}
        message={isTerminal ? 'ERROR' : 'Failed to load dashboard statistics'}
        description={isTerminal ? 'FAILED_TO_LOAD_DASHBOARD_STATISTICS' : undefined}
      />
    );
  }

  const categoryData = Object.entries(stats.category_breakdown).map(([name, value]) => ({
    name,
    value,
    color: categoryColors[name as keyof typeof categoryColors] || '#6b7280',
  }));

  const severityData = Object.entries(stats.severity_breakdown).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="relative space-y-6">
      {/* RetroGrid Background (Terminal Theme Only) */}
      {isTerminal && (
        <RetroGrid
          className="absolute inset-0 z-0 opacity-20"
          angle={65}
          cellSize={60}
          opacity={0.3}
          darkLineColor="#00ff00"
        />
      )}

      {/* Particle and Dot Pattern Backgrounds (Business Theme Only) */}
      {!isTerminal && (
        <>
          {/* Particle effect background */}
          <Particles
            className="absolute inset-0 -z-10 pointer-events-none"
            quantity={40}
            color="#3b82f6"
            size={0.5}
            staticity={50}
            ease={50}
            vx={0}
            vy={0}
          />

          {/* Subtle dot pattern overlay */}
          <DotPattern
            className="absolute inset-0 -z-10 opacity-10"
            width={20}
            height={20}
            cx={1}
            cy={1}
            cr={1}
            color="#3b82f6"
          />
        </>
      )}

      {/* Stats Cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-6 border-2 relative overflow-hidden rounded-lg ${
          isTerminal
            ? 'bg-black border-terminal-green card-scanlines'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          {/* Business Theme Effects */}
          {!isTerminal && (
            <>
              {/* Animated border effect */}
              <BorderBeam
                size={100}
                duration={8}
                delay={0}
                colorFrom="#3b82f6"
                colorTo="#8b5cf6"
                borderWidth={2}
              />

              {/* Subtle dot pattern background */}
              <DotPattern
                className="absolute inset-0 -z-10 opacity-5"
                width={16}
                height={16}
                cr={1}
                color="#3b82f6"
              />
            </>
          )}

          {/* FlickeringGrid Background (Terminal Theme Only) */}
          {isTerminal && (
            <FlickeringGrid
              className="absolute inset-0 z-0"
              squareSize={4}
              gridGap={6}
              color="rgb(0, 255, 0)"
              maxOpacity={0.2}
              flickerChance={0.3}
            />
          )}
          <div className={`absolute top-0 left-0 w-full h-1 ${
            isTerminal
              ? 'bg-terminal-green opacity-50'
              : 'bg-gradient-to-r from-business-accent-primary to-business-accent-secondary'
          } z-10`}></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              {isTerminal ? (
                <TextAnimate
                  as="p"
                  className="text-sm text-terminal-green-dim font-mono"
                  animation="blurIn"
                  by="character"
                  duration={0.5}
                  delay={0.1}
                >
                  {formatText('Total Threats', { style: 'label' })}
                </TextAnimate>
              ) : (
                <p className="text-sm text-business-text-muted font-sans">
                  {formatText('Total Threats', { style: 'label' })}
                </p>
              )}
              <NumberTicker
                value={stats.total_threats}
                className={`text-4xl font-bold mt-2 ${
                  isTerminal
                    ? 'text-terminal-green font-mono'
                    : 'text-business-text-primary font-sans'
                }`}
                delay={isTerminal ? 0.2 : 0}
                direction="up"
              />
            </div>
            <BarChart3 className={`w-12 h-12 opacity-30 ${
              isTerminal ? 'text-terminal-green icon-glow' : 'text-business-accent-primary'
            }`} />
          </div>
        </div>

        <div className={`p-6 border-2 relative overflow-hidden rounded-lg ${
          isTerminal
            ? 'bg-black border-terminal-green card-scanlines'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          {/* Business Theme Effects */}
          {!isTerminal && (
            <>
              <BorderBeam
                size={100}
                duration={8}
                delay={2}
                colorFrom="#3b82f6"
                colorTo="#8b5cf6"
                borderWidth={2}
              />
              <DotPattern
                className="absolute inset-0 -z-10 opacity-5"
                width={16}
                height={16}
                cr={1}
                color="#3b82f6"
              />
            </>
          )}

          {/* FlickeringGrid Background (Terminal Theme Only) */}
          {isTerminal && (
            <FlickeringGrid
              className="absolute inset-0 z-0"
              squareSize={4}
              gridGap={6}
              color="rgb(0, 255, 0)"
              maxOpacity={0.2}
              flickerChance={0.3}
            />
          )}
          <div className={`absolute top-0 left-0 w-full h-1 ${
            isTerminal
              ? 'bg-terminal-green opacity-50'
              : 'bg-gradient-to-r from-business-accent-primary to-business-accent-secondary'
          } z-10`}></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              {isTerminal ? (
                <TextAnimate
                  as="p"
                  className="text-sm text-terminal-green-dim font-mono"
                  animation="blurIn"
                  by="character"
                  duration={0.5}
                  delay={0.2}
                >
                  {formatText('Today', { style: 'label' })}
                </TextAnimate>
              ) : (
                <p className="text-sm text-business-text-muted font-sans">
                  {formatText('Today', { style: 'label' })}
                </p>
              )}
              <NumberTicker
                value={stats.threats_today}
                className={`text-4xl font-bold mt-2 ${
                  isTerminal
                    ? 'text-terminal-green font-mono'
                    : 'text-business-text-primary font-sans'
                }`}
                delay={isTerminal ? 0.3 : 0.1}
                direction="up"
              />
            </div>
            <Activity className={`w-12 h-12 opacity-30 ${
              isTerminal ? 'text-terminal-green icon-glow' : 'text-business-accent-primary'
            }`} />
          </div>
        </div>

        <div className={`p-6 border-2 relative overflow-hidden rounded-lg ${
          isTerminal
            ? 'bg-black border-terminal-green card-scanlines'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          {/* Business Theme Effects */}
          {!isTerminal && (
            <>
              <BorderBeam
                size={100}
                duration={8}
                delay={4}
                colorFrom="#3b82f6"
                colorTo="#8b5cf6"
                borderWidth={2}
              />
              <DotPattern
                className="absolute inset-0 -z-10 opacity-5"
                width={16}
                height={16}
                cr={1}
                color="#3b82f6"
              />
            </>
          )}

          {/* FlickeringGrid Background (Terminal Theme Only) */}
          {isTerminal && (
            <FlickeringGrid
              className="absolute inset-0 z-0"
              squareSize={4}
              gridGap={6}
              color="rgb(0, 255, 0)"
              maxOpacity={0.2}
              flickerChance={0.3}
            />
          )}
          <div className={`absolute top-0 left-0 w-full h-1 ${
            isTerminal
              ? 'bg-terminal-green opacity-50'
              : 'bg-gradient-to-r from-business-accent-primary to-business-accent-secondary'
          } z-10`}></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              {isTerminal ? (
                <TextAnimate
                  as="p"
                  className="text-sm text-terminal-green-dim font-mono"
                  animation="blurIn"
                  by="character"
                  duration={0.5}
                  delay={0.3}
                >
                  {formatText('This Week', { style: 'label' })}
                </TextAnimate>
              ) : (
                <p className="text-sm text-business-text-muted font-sans">
                  {formatText('This Week', { style: 'label' })}
                </p>
              )}
              <NumberTicker
                value={stats.threats_this_week}
                className={`text-4xl font-bold mt-2 ${
                  isTerminal
                    ? 'text-terminal-green font-mono'
                    : 'text-business-text-primary font-sans'
                }`}
                delay={isTerminal ? 0.4 : 0.2}
                direction="up"
              />
            </div>
            <TrendingUp className={`w-12 h-12 opacity-30 ${
              isTerminal ? 'text-terminal-green icon-glow' : 'text-business-accent-primary'
            }`} />
          </div>
        </div>
      </div>

      {/* Trending Insights */}
      {stats.recent_trends && stats.recent_trends.length > 0 && (
        <div className={`p-6 border-2 relative overflow-hidden ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          {/* AnimatedGridPattern Background (Terminal Theme Only) */}
          {isTerminal && (
            <AnimatedGridPattern
              className="absolute inset-0 z-0 opacity-30"
              width={40}
              height={40}
              numSquares={30}
              maxOpacity={0.3}
              duration={3}
            />
          )}
          <div className="relative z-10 text-xl font-bold mb-4 flex items-center">
            <TrendingUp className={`w-5 h-5 mr-2 ${isTerminal ? 'icon-glow text-terminal-green' : 'text-business-text-primary'}`} />
            {isTerminal ? (
              <HyperText
                className="text-xl text-terminal-green font-mono font-bold"
                duration={600}
                animateOnHover={false}
                startOnView={true}
              >
                {formatText('AI-Detected Trends', { style: 'heading' })}
              </HyperText>
            ) : (
              <span className="text-business-text-primary font-sans">
                {formatText('AI-Detected Trends', { style: 'heading' })}
              </span>
            )}
          </div>
          <div className="relative z-10 space-y-4">
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
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className={`p-6 border-2 rounded-lg ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          {isTerminal ? (
            <HyperText
              as="h2"
              className="text-lg font-bold mb-4 text-terminal-green font-mono"
              duration={600}
              animateOnHover={false}
              startOnView={true}
            >
              [ THREATS_BY_CATEGORY ] (30_DAYS)
            </HyperText>
          ) : (
            <h2 className="text-lg font-bold mb-4 text-business-text-primary font-sans">
              Threats by Category (30 days)
            </h2>
          )}
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props) => {
                  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name, index } = props;
                  const RADIAN = Math.PI / 180;
                  const threshold = 0.08; // 8% threshold - higher to reduce overlap

                  if (percent < threshold) {
                    // Small slice: label outside with custom line
                    const lineStartRadius = outerRadius + 5;
                    const lineEndRadius = outerRadius + 20;
                    const labelRadius = outerRadius + 35;

                    const lineStartX = cx + lineStartRadius * Math.cos(-midAngle * RADIAN);
                    const lineStartY = cy + lineStartRadius * Math.sin(-midAngle * RADIAN);
                    const lineEndX = cx + lineEndRadius * Math.cos(-midAngle * RADIAN);
                    const lineEndY = cy + lineEndRadius * Math.sin(-midAngle * RADIAN);
                    const labelX = cx + labelRadius * Math.cos(-midAngle * RADIAN);
                    const labelY = cy + labelRadius * Math.sin(-midAngle * RADIAN);

                    return (
                      <g key={`label-${index}`}>
                        {/* Custom line for small slices only */}
                        <polyline
                          points={`${lineStartX},${lineStartY} ${lineEndX},${lineEndY} ${labelX},${labelY}`}
                          stroke={isTerminal ? '#00ff00' : '#94a3b8'}
                          strokeWidth={1}
                          fill="none"
                        />
                        <text
                          x={labelX}
                          y={labelY}
                          fill={isTerminal ? '#00ff00' : '#e5e7eb'}
                          textAnchor={labelX > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          fontSize={10}
                          fontFamily={isTerminal ? 'monospace' : 'Inter, sans-serif'}
                        >
                          {isTerminal
                            ? `${name.toUpperCase()} ${(percent * 100).toFixed(0)}%`
                            : `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        </text>
                      </g>
                    );
                  } else {
                    // Large slice: label inside (no line)
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);

                    return (
                      <text
                        key={`label-${index}`}
                        x={x}
                        y={y}
                        fill={isTerminal ? '#000000' : '#1a1f2e'}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={12}
                        fontWeight="700"
                        fontFamily={isTerminal ? 'monospace' : 'Inter, sans-serif'}
                      >
                        <tspan x={x} dy="-0.5em">
                          {isTerminal ? name.toUpperCase() : name}
                        </tspan>
                        <tspan x={x} dy="1.2em">
                          {(percent * 100).toFixed(0)}%
                        </tspan>
                      </text>
                    );
                  }
                }}
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
                  backgroundColor: isTerminal ? '#000000' : '#131720',
                  border: isTerminal ? '2px solid #00ff00' : '2px solid #1e3a5f',
                  borderRadius: '8px',
                  fontFamily: isTerminal ? 'monospace' : 'Inter, sans-serif',
                  color: isTerminal ? '#00ff00' : '#e5e7eb',
                  boxShadow: !isTerminal ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
                }}
                labelStyle={{
                  color: isTerminal ? '#00ff00' : '#e5e7eb',
                  fontFamily: isTerminal ? 'monospace' : 'Inter, sans-serif',
                  fontWeight: '600',
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: isTerminal ? '#00ff00' : '#cbd5e1',
                  fontFamily: isTerminal ? 'monospace' : 'Inter, sans-serif',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Breakdown */}
        <div className={`p-6 border-2 rounded-lg ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          {isTerminal ? (
            <HyperText
              as="h2"
              className="text-lg font-bold mb-4 text-terminal-green font-mono"
              duration={600}
              animateOnHover={false}
              startOnView={true}
            >
              {formatText('Severity Distribution', { style: 'heading' })}
            </HyperText>
          ) : (
            <h2 className="text-lg font-bold mb-4 text-business-text-primary font-sans">
              {formatText('Severity Distribution', { style: 'heading' })}
            </h2>
          )}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={severityData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isTerminal ? '#00ff00' : '#1e3a5f'}
                opacity={isTerminal ? 0.2 : 0.3}
              />
              <XAxis
                dataKey="name"
                stroke={isTerminal ? '#00ff00' : '#cbd5e1'}
                style={{
                  fontFamily: isTerminal ? 'monospace' : 'Inter, sans-serif',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              />
              <YAxis
                stroke={isTerminal ? '#00ff00' : '#cbd5e1'}
                style={{
                  fontFamily: isTerminal ? 'monospace' : 'Inter, sans-serif',
                  fontSize: '12px'
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isTerminal ? '#000000' : '#131720',
                  border: isTerminal ? '2px solid #00ff00' : '2px solid #1e3a5f',
                  borderRadius: '8px',
                  fontFamily: isTerminal ? 'monospace' : 'Inter, sans-serif',
                  color: isTerminal ? '#00ff00' : '#e5e7eb',
                  boxShadow: !isTerminal ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
                }}
                labelStyle={{
                  color: isTerminal ? '#00ff00' : '#e5e7eb',
                  fontFamily: isTerminal ? 'monospace' : 'Inter, sans-serif',
                  fontWeight: '600',
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: isTerminal ? '#00ff00' : '#cbd5e1',
                  fontFamily: isTerminal ? 'monospace' : 'Inter, sans-serif',
                }}
              />
              <Bar
                dataKey="value"
                fill={isTerminal ? '#00ff00' : 'url(#barGradient)'}
                radius={[4, 4, 0, 0]}
              />
              {!isTerminal && (
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Sources */}
      <div className={`relative z-10 p-6 border-2 rounded-lg ${
        isTerminal
          ? 'bg-black border-terminal-green'
          : 'bg-business-bg-secondary border-business-border-primary'
      }`}>
        {isTerminal ? (
          <HyperText
            as="h2"
            className="text-lg font-bold mb-4 text-terminal-green font-mono"
            duration={600}
            animateOnHover={false}
            startOnView={true}
          >
            [ TOP_SOURCES ] (30_DAYS)
          </HyperText>
        ) : (
          <h2 className="text-lg font-bold mb-4 text-business-text-primary font-sans">
            Top Sources (30 days)
          </h2>
        )}
        <div className="space-y-3">
          {stats.top_sources.slice(0, 5).map((source, index) => (
            <div key={source.source} className="relative">
              {isTerminal ? (
                <div className="flex items-center justify-between border-l-2 border-terminal-green-dark pl-4 py-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl font-bold text-terminal-green-dim font-mono">
                      [{index + 1}]
                    </span>
                    <span className="text-terminal-green font-mono">
                      {source.source}
                    </span>
                  </div>
                  <span className="text-terminal-green font-mono">
                    {source.count} {formatText('threats')}
                  </span>
                </div>
              ) : (
                <MagicCard
                  className="flex items-center justify-between border-l-2 border-business-accent-primary pl-4 py-3 rounded-r-lg"
                  gradientSize={200}
                  gradientColor="#0a0e1a"
                  gradientFrom="#3b82f6"
                  gradientTo="#8b5cf6"
                  gradientOpacity={0.3}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl font-bold text-business-accent-primary font-sans">
                      {index + 1}.
                    </span>
                    <span className="text-business-text-primary font-sans font-medium">
                      {source.source}
                    </span>
                  </div>
                  <span className="text-business-text-secondary font-sans">
                    {source.count} {formatText('threats')}
                  </span>
                </MagicCard>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
