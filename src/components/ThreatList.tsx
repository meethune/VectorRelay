import { useState, useEffect } from 'react';
import { ExternalLink, Clock, Tag, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-600',
  medium: 'bg-yellow-600',
  low: 'bg-blue-600',
  info: 'bg-gray-600',
};

export default function ThreatList({ searchQuery, filters, onThreatClick }: ThreatListProps) {
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
      const data = await response.json();

      if (searchQuery) {
        setThreats(data.threats || []);
        setTotalPages(1);
      } else {
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
        <div className="text-terminal-green font-mono">
          <div className="text-2xl mb-4">[ LOADING THREATS ]</div>
          <div className="animate-pulse">▓▓▓▓▓▓▓▓▓▓</div>
        </div>
      </div>
    );
  }

  if (threats.length === 0) {
    return (
      <div className="text-center py-12 bg-black border-2 border-terminal-green p-8">
        <AlertCircle className="w-12 h-12 text-terminal-green mx-auto mb-4 icon-glow" />
        <p className="text-terminal-green font-mono">[ NO THREATS FOUND ]</p>
        {searchQuery && <p className="text-terminal-green-dim text-sm mt-2 font-mono">&gt; Try a different search query</p>}
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
            className="bg-black p-6 border-2 border-terminal-green-dark hover:border-terminal-green transition cursor-pointer"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-terminal-green mb-2 hover:text-terminal-green-dim font-mono">
                  &gt; {threat.title}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-terminal-green-dim font-mono">
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
                  className={`px-3 py-1 text-xs font-semibold text-black font-mono ${
                    SEVERITY_COLORS[threat.severity] || 'bg-gray-600'
                  }`}
                >
                  [{threat.severity.toUpperCase()}]
                </span>
              )}
            </div>

            {/* TL;DR */}
            {threat.tldr && (
              <p className="text-terminal-green mb-3 line-clamp-2 font-mono">{threat.tldr}</p>
            )}

            {/* Tags */}
            {threat.category && (
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 border border-terminal-green-dark text-terminal-green text-xs font-mono">
                  {threat.category.toUpperCase()}
                </span>
              </div>
            )}

            {/* External Link */}
            <a
              href={threat.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center mt-3 text-sm text-terminal-green hover:text-terminal-green-dim font-mono"
            >
              &gt; VIEW_ORIGINAL_SOURCE
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
            className="px-4 py-2 bg-black text-terminal-green border-2 border-terminal-green disabled:opacity-50 disabled:cursor-not-allowed hover:bg-terminal-green-dark font-mono"
          >
            [ &lt; PREV ]
          </button>

          <span className="text-terminal-green font-mono">
            PAGE {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-black text-terminal-green border-2 border-terminal-green disabled:opacity-50 disabled:cursor-not-allowed hover:bg-terminal-green-dark font-mono"
          >
            [ NEXT &gt; ]
          </button>
        </div>
      )}
    </div>
  );
}
