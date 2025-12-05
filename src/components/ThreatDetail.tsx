import { useState, useEffect } from 'react';
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
  critical: 'bg-red-600',
  high: 'bg-orange-600',
  medium: 'bg-yellow-600',
  low: 'bg-blue-600',
  info: 'bg-gray-600',
};

export default function ThreatDetail({ threatId, onBack }: ThreatDetailProps) {
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
      const data = await response.json();
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!threat) {
    return (
      <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-800">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Threat not found</p>
        <button onClick={onBack} className="mt-4 text-blue-500 hover:text-blue-400">
          Go back
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
        className="flex items-center text-blue-500 hover:text-blue-400 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to list
      </button>

      {/* Main Content */}
      <div className="bg-slate-900 rounded-lg p-8 border border-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-4">{threat.title}</h1>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
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
              className={`px-4 py-2 rounded-full text-sm font-semibold text-white ${
                SEVERITY_COLORS[threat.severity] || 'bg-gray-600'
              }`}
            >
              {threat.severity.toUpperCase()}
            </span>
          )}
        </div>

        {/* TL;DR */}
        {threat.tldr && (
          <div className="bg-blue-900/20 border-l-4 border-blue-500 p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">TL;DR</h3>
            <p className="text-gray-300">{threat.tldr}</p>
          </div>
        )}

        {/* Key Points */}
        {threat.key_points && threat.key_points.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Key Points</h3>
            <ul className="space-y-2">
              {threat.key_points.map((point, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span className="text-gray-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {threat.category && (
            <div>
              <h4 className="text-sm text-gray-400 mb-2">Category</h4>
              <span className="px-3 py-1 bg-slate-800 text-blue-400 rounded text-sm">
                {threat.category}
              </span>
            </div>
          )}

          {threat.affected_sectors && threat.affected_sectors.length > 0 && (
            <div>
              <h4 className="text-sm text-gray-400 mb-2">Affected Sectors</h4>
              <div className="flex flex-wrap gap-2">
                {threat.affected_sectors.map((sector) => (
                  <span key={sector} className="px-3 py-1 bg-slate-800 text-gray-300 rounded text-sm">
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          )}

          {threat.threat_actors && threat.threat_actors.length > 0 && (
            <div>
              <h4 className="text-sm text-gray-400 mb-2">Threat Actors</h4>
              <div className="flex flex-wrap gap-2">
                {threat.threat_actors.map((actor) => (
                  <span key={actor} className="px-3 py-1 bg-red-900/20 text-red-400 rounded text-sm">
                    {actor}
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
          className="inline-flex items-center text-blue-500 hover:text-blue-400 mb-6"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View original article
        </a>
      </div>

      {/* IOCs */}
      {iocsByType && Object.keys(iocsByType).length > 0 && (
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4">Indicators of Compromise (IOCs)</h2>
          <div className="space-y-4">
            {Object.entries(iocsByType).map(([type, values]) => (
              <div key={type}>
                <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase">{type}s</h3>
                <div className="space-y-2">
                  {values.map((value) => (
                    <div
                      key={value}
                      className="flex items-center justify-between bg-slate-800 p-3 rounded"
                    >
                      <code className="text-sm text-gray-300">{value}</code>
                      <button
                        onClick={() => copyToClipboard(value)}
                        className="text-blue-500 hover:text-blue-400 ml-4"
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
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Link2 className="w-5 h-5 mr-2 text-blue-500" />
            Similar Threats
          </h2>
          <div className="space-y-3">
            {threat.similar_threats.map((similar) => (
              <div
                key={similar.id}
                className="flex items-center justify-between p-3 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer"
                onClick={() => window.location.reload()} // Simple reload to view similar threat
              >
                <span className="text-gray-300">{similar.title}</span>
                <span className="text-sm text-gray-500">
                  {Math.round(similar.score * 100)}% match
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
