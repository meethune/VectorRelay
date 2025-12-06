import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Tag,
  AlertCircle,
  Copy,
  CheckCircle,
  Link2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';

interface ThreatDetail {
  id: string;
  source: string;
  title: string;
  url: string;
  content: string;
  published_at: number;
  tldr?: string;
  key_points?: string[];
  category?: string;
  severity?: string;
  affected_sectors?: string[];
  threat_actors?: string[];
  iocs?: Array<{
    ioc_type: string;
    ioc_value: string;
  }>;
  similar_threats?: Array<{
    id: string;
    title: string;
    score: number;
  }>;
}

interface ThreatDetailProps {
  threatId: string;
  onBack: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
  info: 'bg-info',
};

export default function ThreatDetail({ threatId, onBack }: ThreatDetailProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isTerminal = theme === 'terminal';
  const [threat, setThreat] = useState<ThreatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedIOC, setCopiedIOC] = useState<string | null>(null);

  useEffect(() => {
    fetchThreatDetail();
  }, [threatId]);

  const fetchThreatDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/threat/${threatId}`);
      const data = await response.json() as ThreatDetail;
      setThreat(data);
    } catch (error) {
      console.error('Failed to fetch threat details:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIOC(text);
    setTimeout(() => setCopiedIOC(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'}>
          <div className="text-2xl mb-4">{isTerminal ? '[ LOADING THREAT DETAILS ]' : 'Loading threat details...'}</div>
          <div className="animate-pulse">{isTerminal ? '▓▓▓▓▓▓▓▓▓▓' : '...'}</div>
        </div>
      </div>
    );
  }

  if (!threat) {
    return (
      <div className={`text-center py-12 border-2 p-8 ${
        isTerminal
          ? 'bg-black border-terminal-green text-terminal-green'
          : 'bg-business-bg-secondary border-business-border-primary text-business-text-primary'
      }`}>
        <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${isTerminal ? 'icon-glow' : ''}`} />
        <p className={isTerminal ? 'font-mono' : 'font-sans'}>
          {isTerminal ? '[ THREAT NOT FOUND ]' : 'Threat not found'}
        </p>
        <button
          onClick={onBack}
          className={`mt-4 ${
            isTerminal
              ? 'text-terminal-green hover:text-terminal-green-dim font-mono'
              : 'text-business-accent-primary hover:text-business-accent-hover font-sans'
          }`}
        >
          {isTerminal ? '> GO_BACK' : '← Go back'}
        </button>
      </div>
    );
  }

  const iocsByType = threat.iocs?.reduce((acc, ioc) => {
    if (!acc[ioc.ioc_type]) acc[ioc.ioc_type] = [];
    acc[ioc.ioc_type].push(ioc.ioc_value);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className={`flex items-center mb-4 ${
          isTerminal
            ? 'text-terminal-green hover:text-terminal-green-dim font-mono'
            : 'text-business-accent-primary hover:text-business-accent-hover font-sans'
        }`}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {isTerminal ? '< BACK_TO_LIST' : '← Back to list'}
      </button>

      {/* Main Content */}
      <div className={`p-8 border-2 ${
        isTerminal
          ? 'bg-black border-terminal-green'
          : 'bg-business-bg-secondary border-business-border-primary'
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className={`text-3xl font-bold mb-4 ${
              isTerminal
                ? 'text-terminal-green font-mono'
                : 'text-business-text-primary font-sans'
            }`}>
              {isTerminal ? '>> ' : ''}{threat.title}
            </h1>
            <div className={`flex items-center space-x-6 text-sm ${
              isTerminal
                ? 'text-terminal-green-dim font-mono'
                : 'text-business-text-muted font-sans'
            }`}>
              <span className="flex items-center">
                <Tag className="w-4 h-4 mr-2" />
                {threat.source}
              </span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                {formatDistanceToNow(new Date(threat.published_at * 1000), { addSuffix: true })}
              </span>
            </div>
          </div>

          {threat.severity && (
            <span
              className={`px-4 py-2 text-sm font-semibold text-white ${
                isTerminal ? 'font-mono' : 'font-sans'
              } ${SEVERITY_COLORS[threat.severity] || 'bg-gray-600'}`}
            >
              {isTerminal ? `[${threat.severity.toUpperCase()}]` : threat.severity.toUpperCase()}
            </span>
          )}
        </div>

        {/* TL;DR */}
        {threat.tldr && (
          <div className={`border-l-4 p-4 mb-6 ${
            isTerminal
              ? 'bg-black border-terminal-green'
              : 'bg-business-bg-tertiary border-business-accent-primary'
          }`}>
            <h3 className={`text-sm font-semibold mb-2 ${
              isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'
            }`}>
              {isTerminal ? '[ TL;DR ]' : 'Summary'}
            </h3>
            <p className={isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-secondary font-sans'}>
              {threat.tldr}
            </p>
          </div>
        )}

        {/* Key Points */}
        {threat.key_points && threat.key_points.length > 0 && (
          <div className="mb-6">
            <h3 className={`text-lg font-semibold mb-3 ${
              isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'
            }`}>
              {isTerminal ? '[ KEY_POINTS ]' : 'Key Points'}
            </h3>
            <ul className="space-y-2">
              {threat.key_points.map((point, index) => (
                <li key={index} className="flex items-start">
                  <span className={`mr-2 ${
                    isTerminal ? 'text-terminal-green font-mono' : 'text-business-accent-primary font-sans'
                  }`}>
                    {isTerminal ? '>' : '•'}
                  </span>
                  <span className={isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-secondary font-sans'}>
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {threat.category && (
            <div>
              <h4 className={`text-sm mb-2 ${
                isTerminal
                  ? 'text-terminal-green-dim font-mono'
                  : 'text-business-text-muted font-sans'
              }`}>
                {isTerminal ? '> CATEGORY' : 'Category'}
              </h4>
              <span className={`px-3 py-1 border text-sm ${
                isTerminal
                  ? 'border-terminal-green text-terminal-green font-mono'
                  : 'border-business-border-primary text-business-text-primary font-sans'
              }`}>
                {isTerminal ? threat.category.toUpperCase() : threat.category}
              </span>
            </div>
          )}

          {threat.affected_sectors && threat.affected_sectors.length > 0 && (
            <div>
              <h4 className={`text-sm mb-2 ${
                isTerminal
                  ? 'text-terminal-green-dim font-mono'
                  : 'text-business-text-muted font-sans'
              }`}>
                {isTerminal ? '> AFFECTED_SECTORS' : 'Affected Sectors'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {threat.affected_sectors.map((sector) => (
                  <span key={sector} className={`px-3 py-1 border text-sm ${
                    isTerminal
                      ? 'border-terminal-green-dark text-terminal-green font-mono'
                      : 'border-business-border-secondary text-business-text-primary font-sans'
                  }`}>
                    {isTerminal ? sector.toUpperCase() : sector}
                  </span>
                ))}
              </div>
            </div>
          )}

          {threat.threat_actors && threat.threat_actors.length > 0 && (
            <div>
              <h4 className={`text-sm mb-2 ${
                isTerminal
                  ? 'text-terminal-green-dim font-mono'
                  : 'text-business-text-muted font-sans'
              }`}>
                {isTerminal ? '> THREAT_ACTORS' : 'Threat Actors'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {threat.threat_actors.map((actor) => (
                  <span key={actor} className={`px-3 py-1 text-sm ${
                    isTerminal
                      ? 'bg-critical text-black font-mono'
                      : 'bg-critical text-white font-sans'
                  }`}>
                    {isTerminal ? actor.toUpperCase() : actor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* External Link */}
        <a
          href={threat.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center mb-6 ${
            isTerminal
              ? 'text-terminal-green hover:text-terminal-green-dim font-mono'
              : 'text-business-accent-primary hover:text-business-accent-hover font-sans'
          }`}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {isTerminal ? '> VIEW_ORIGINAL_ARTICLE' : 'View Original Article'}
        </a>
      </div>

      {/* IOCs */}
      {iocsByType && Object.keys(iocsByType).length > 0 && (
        <div className={`p-6 border-2 ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          <h2 className={`text-xl font-bold mb-4 ${
            isTerminal
              ? 'text-terminal-green font-mono'
              : 'text-business-text-primary font-sans'
          }`}>
            {isTerminal ? '[ INDICATORS_OF_COMPROMISE (IOCs) ]' : 'Indicators of Compromise (IOCs)'}
          </h2>
          <div className="space-y-4">
            {Object.entries(iocsByType).map(([type, values]) => (
              <div key={type}>
                <h3 className={`text-sm font-semibold mb-2 uppercase ${
                  isTerminal
                    ? 'text-terminal-green-dim font-mono'
                    : 'text-business-text-muted font-sans'
                }`}>
                  {isTerminal ? `> ${type}s` : `${type}s`}
                </h3>
                <div className="space-y-2">
                  {values.map((value) => (
                    <div
                      key={value}
                      className={`flex items-center justify-between border p-3 ${
                        isTerminal
                          ? 'bg-black border-terminal-green-dark'
                          : 'bg-business-bg-tertiary border-business-border-secondary'
                      }`}
                    >
                      <code className={`text-sm ${
                        isTerminal
                          ? 'text-terminal-green font-mono'
                          : 'text-business-accent-primary font-mono'
                      }`}>
                        {value}
                      </code>
                      <button
                        onClick={() => copyToClipboard(value)}
                        className={`ml-4 ${
                          isTerminal
                            ? 'text-terminal-green hover:text-terminal-green-dim'
                            : 'text-business-accent-primary hover:text-business-accent-hover'
                        }`}
                      >
                        {copiedIOC === value ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar Threats */}
      {threat.similar_threats && threat.similar_threats.length > 0 && (
        <div className={`p-6 border-2 ${
          isTerminal
            ? 'bg-black border-terminal-green'
            : 'bg-business-bg-secondary border-business-border-primary'
        }`}>
          <h2 className={`text-xl font-bold mb-4 flex items-center ${
            isTerminal
              ? 'text-terminal-green font-mono'
              : 'text-business-text-primary font-sans'
          }`}>
            <Link2 className={`w-5 h-5 mr-2 ${isTerminal ? 'icon-glow' : ''}`} />
            {isTerminal ? '[ SIMILAR_THREATS ]' : 'Similar Threats'}
          </h2>
          <div className="space-y-3">
            {threat.similar_threats.map((similar) => (
              <div
                key={similar.id}
                className={`flex items-center justify-between p-3 border cursor-pointer ${
                  isTerminal
                    ? 'bg-black border-terminal-green-dark hover:border-terminal-green'
                    : 'bg-business-bg-tertiary border-business-border-secondary hover:border-business-accent-primary'
                }`}
                onClick={() => navigate(`/threat/${similar.id}`)}
              >
                <span className={isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'}>
                  {similar.title}
                </span>
                <span className={`text-sm ${
                  isTerminal
                    ? 'text-terminal-green-dim font-mono'
                    : 'text-business-text-muted font-sans'
                }`}>
                  {Math.round(similar.score * 100)}% {isTerminal ? 'MATCH' : 'match'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
