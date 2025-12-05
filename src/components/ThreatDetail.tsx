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
        <div className="text-terminal-green font-mono">
          <div className="text-2xl mb-4">[ LOADING THREAT DETAILS ]</div>
          <div className="animate-pulse">▓▓▓▓▓▓▓▓▓▓</div>
        </div>
      </div>
    );
  }

  if (!threat) {
    return (
      <div className="text-center py-12 bg-black border-2 border-terminal-green p-8">
        <AlertCircle className="w-12 h-12 text-terminal-green mx-auto mb-4 icon-glow" />
        <p className="text-terminal-green font-mono">[ THREAT NOT FOUND ]</p>
        <button onClick={onBack} className="mt-4 text-terminal-green hover:text-terminal-green-dim font-mono">
          &gt; GO_BACK
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
        className="flex items-center text-terminal-green hover:text-terminal-green-dim mb-4 font-mono"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        &lt; BACK_TO_LIST
      </button>

      {/* Main Content */}
      <div className="bg-black p-8 border-2 border-terminal-green">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-terminal-green mb-4 font-mono">&gt;&gt; {threat.title}</h1>
            <div className="flex items-center space-x-6 text-sm text-terminal-green-dim font-mono">
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
              className={`px-4 py-2 text-sm font-semibold text-black font-mono ${
                SEVERITY_COLORS[threat.severity] || 'bg-gray-600'
              }`}
            >
              [{threat.severity.toUpperCase()}]
            </span>
          )}
        </div>

        {/* TL;DR */}
        {threat.tldr && (
          <div className="bg-black border-l-4 border-terminal-green p-4 mb-6">
            <h3 className="text-sm font-semibold text-terminal-green mb-2 font-mono">[ TL;DR ]</h3>
            <p className="text-terminal-green font-mono">{threat.tldr}</p>
          </div>
        )}

        {/* Key Points */}
        {threat.key_points && threat.key_points.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-terminal-green mb-3 font-mono">[ KEY_POINTS ]</h3>
            <ul className="space-y-2">
              {threat.key_points.map((point, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-terminal-green mr-2 font-mono">&gt;</span>
                  <span className="text-terminal-green font-mono">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {threat.category && (
            <div>
              <h4 className="text-sm text-terminal-green-dim mb-2 font-mono">&gt; CATEGORY</h4>
              <span className="px-3 py-1 border border-terminal-green text-terminal-green text-sm font-mono">
                {threat.category.toUpperCase()}
              </span>
            </div>
          )}

          {threat.affected_sectors && threat.affected_sectors.length > 0 && (
            <div>
              <h4 className="text-sm text-terminal-green-dim mb-2 font-mono">&gt; AFFECTED_SECTORS</h4>
              <div className="flex flex-wrap gap-2">
                {threat.affected_sectors.map((sector) => (
                  <span key={sector} className="px-3 py-1 border border-terminal-green-dark text-terminal-green text-sm font-mono">
                    {sector.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {threat.threat_actors && threat.threat_actors.length > 0 && (
            <div>
              <h4 className="text-sm text-terminal-green-dim mb-2 font-mono">&gt; THREAT_ACTORS</h4>
              <div className="flex flex-wrap gap-2">
                {threat.threat_actors.map((actor) => (
                  <span key={actor} className="px-3 py-1 bg-critical text-black text-sm font-mono">
                    {actor.toUpperCase()}
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
          className="inline-flex items-center text-terminal-green hover:text-terminal-green-dim mb-6 font-mono"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          &gt; VIEW_ORIGINAL_ARTICLE
        </a>
      </div>

      {/* IOCs */}
      {iocsByType && Object.keys(iocsByType).length > 0 && (
        <div className="bg-black p-6 border-2 border-terminal-green">
          <h2 className="text-xl font-bold text-terminal-green mb-4 font-mono">[ INDICATORS_OF_COMPROMISE (IOCs) ]</h2>
          <div className="space-y-4">
            {Object.entries(iocsByType).map(([type, values]) => (
              <div key={type}>
                <h3 className="text-sm font-semibold text-terminal-green-dim mb-2 uppercase font-mono">&gt; {type}s</h3>
                <div className="space-y-2">
                  {values.map((value) => (
                    <div
                      key={value}
                      className="flex items-center justify-between bg-black border border-terminal-green-dark p-3"
                    >
                      <code className="text-sm text-terminal-green font-mono">{value}</code>
                      <button
                        onClick={() => copyToClipboard(value)}
                        className="text-terminal-green hover:text-terminal-green-dim ml-4"
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
        <div className="bg-black p-6 border-2 border-terminal-green">
          <h2 className="text-xl font-bold text-terminal-green mb-4 flex items-center font-mono">
            <Link2 className="w-5 h-5 mr-2 icon-glow" />
            [ SIMILAR_THREATS ]
          </h2>
          <div className="space-y-3">
            {threat.similar_threats.map((similar) => (
              <div
                key={similar.id}
                className="flex items-center justify-between p-3 bg-black border border-terminal-green-dark hover:border-terminal-green cursor-pointer"
                onClick={() => window.location.reload()} // Simple reload to view similar threat
              >
                <span className="text-terminal-green font-mono">{similar.title}</span>
                <span className="text-sm text-terminal-green-dim font-mono">
                  {Math.round(similar.score * 100)}% MATCH
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
