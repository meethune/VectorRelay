import { useState, useEffect } from 'react';
import { ExternalLink, Clock, Tag, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';

interface Threat {
  id: string;
  source: string;
  title: string;
  url: string;
  published_at: number;
  tldr?: string;
  category?: string;
  severity?: string;
  key_points?: string[];
}

interface ThreatListProps {
  searchQuery: string;
  filters: {
    category: string;
    severity: string;
    source: string;
  };
  onThreatClick: (id: string) => void;
}

interface SearchResponse {
  threats: Threat[];
  count: number;
  mode: string;
  query: string;
}

interface ThreatsResponse {
  threats: Threat[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
  info: 'bg-info',
};

export default function ThreatList({ searchQuery, filters, onThreatClick }: ThreatListProps) {
  const { theme, formatText } = useTheme();
  const isTerminal = theme === 'terminal';
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchThreats();
  }, [searchQuery, filters, page]);

  const fetchThreats = async () => {
    setLoading(true);
    try {
      let url = '';

      if (searchQuery) {
        // Search mode
        url = `/api/search?q=${encodeURIComponent(searchQuery)}&mode=semantic&limit=20`;
      } else {
        // Browse mode with filters
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
        });

        if (filters.category) params.append('category', filters.category);
        if (filters.severity) params.append('severity', filters.severity);
        if (filters.source) params.append('source', filters.source);

        url = `/api/threats?${params.toString()}`;
      }

      const response = await fetch(url);

      if (searchQuery) {
        const data = await response.json() as SearchResponse;
        setThreats(data.threats || []);
        setTotalPages(1);
      } else {
        const data = await response.json() as ThreatsResponse;
        setThreats(data.threats || []);
        setTotalPages(data.pagination?.total_pages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch threats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'}>
          <div className="text-2xl mb-4">{isTerminal ? '[ LOADING_THREATS ]' : 'Loading threats...'}</div>
          <div className="animate-pulse">{isTerminal ? '▓▓▓▓▓▓▓▓▓▓' : '...'}</div>
        </div>
      </div>
    );
  }

  if (threats.length === 0) {
    return (
      <div className={`text-center py-12 border-2 p-8 ${
        isTerminal
          ? 'bg-black border-terminal-green text-terminal-green'
          : 'bg-business-bg-secondary border-business-border-primary text-business-text-primary'
      }`}>
        <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${isTerminal ? 'icon-glow' : ''}`} />
        <p className={isTerminal ? 'font-mono' : 'font-sans'}>
          {isTerminal ? '[ NO_THREATS_FOUND ]' : 'No threats found'}
        </p>
        {searchQuery && (
          <p className={`text-sm mt-2 ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {isTerminal ? '> Try a different search query' : 'Try a different search query'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Threat Cards */}
      <div className="space-y-4 mb-6">
        {threats.map((threat) => (
          <div
            key={threat.id}
            onClick={() => onThreatClick(threat.id)}
            className={`p-6 border-2 transition cursor-pointer ${
              isTerminal
                ? 'bg-black border-terminal-green-dark hover:border-terminal-green'
                : 'bg-business-bg-secondary border-business-border-primary hover:border-business-border-secondary'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className={`text-lg font-semibold mb-2 ${
                  isTerminal
                    ? 'text-terminal-green hover:text-terminal-green-dim font-mono'
                    : 'text-business-text-primary hover:text-business-accent-primary font-sans'
                }`}>
                  {isTerminal ? '> ' : ''}{threat.title}
                </h3>
                <div className={`flex items-center space-x-4 text-sm ${
                  isTerminal
                    ? 'text-terminal-green-dim font-mono'
                    : 'text-business-text-muted font-sans'
                }`}>
                  <span className="flex items-center">
                    <Tag className="w-4 h-4 mr-1" />
                    {threat.source}
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDistanceToNow(new Date(threat.published_at * 1000), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              {threat.severity && (
                <span
                  className={`px-3 py-1 text-xs font-semibold text-white ${
                    isTerminal ? 'font-mono' : 'font-sans'
                  } ${SEVERITY_COLORS[threat.severity] || 'bg-gray-600'}`}
                >
                  {isTerminal ? `[${threat.severity.toUpperCase()}]` : threat.severity.toUpperCase()}
                </span>
              )}
            </div>

            {/* TL;DR */}
            {threat.tldr && (
              <p className={`mb-3 line-clamp-2 ${
                isTerminal
                  ? 'text-terminal-green font-mono'
                  : 'text-business-text-secondary font-sans'
              }`}>{threat.tldr}</p>
            )}

            {/* Tags */}
            {threat.category && (
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 border text-xs ${
                  isTerminal
                    ? 'border-terminal-green-dark text-terminal-green font-mono'
                    : 'border-business-border-secondary text-business-text-secondary font-sans'
                }`}>
                  {isTerminal ? threat.category.toUpperCase() : threat.category}
                </span>
              </div>
            )}

            {/* External Link */}
            <a
              href={threat.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center mt-3 text-sm ${
                isTerminal
                  ? 'text-terminal-green hover:text-terminal-green-dim font-mono'
                  : 'text-business-accent-primary hover:text-business-accent-hover font-sans'
              }`}
            >
              {isTerminal ? '> VIEW_ORIGINAL_SOURCE' : 'View original source'}
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!searchQuery && totalPages > 1 && (
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className={`px-4 py-2 border-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isTerminal
                ? 'bg-black text-terminal-green border-terminal-green hover:bg-terminal-green-dark font-mono'
                : 'bg-business-bg-secondary text-business-text-primary border-business-border-primary hover:bg-business-bg-tertiary font-sans'
            }`}
          >
            {isTerminal ? '[ < PREV ]' : '← Previous'}
          </button>

          <span className={isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary font-sans'}>
            {isTerminal ? `PAGE ${page} / ${totalPages}` : `Page ${page} of ${totalPages}`}
          </span>

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className={`px-4 py-2 border-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isTerminal
                ? 'bg-black text-terminal-green border-terminal-green hover:bg-terminal-green-dark font-mono'
                : 'bg-business-bg-secondary text-business-text-primary border-business-border-primary hover:bg-business-bg-tertiary font-sans'
            }`}
          >
            {isTerminal ? '[ NEXT > ]' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}
