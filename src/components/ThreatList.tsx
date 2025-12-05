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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (threats.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-800">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">No threats found</p>
        {searchQuery && <p className="text-gray-500 text-sm mt-2">Try a different search query</p>}
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
            className="bg-slate-900 rounded-lg p-6 border border-slate-800 hover:border-blue-500 transition cursor-pointer"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2 hover:text-blue-400">
                  {threat.title}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
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
                  className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                    SEVERITY_COLORS[threat.severity] || 'bg-gray-600'
                  }`}
                >
                  {threat.severity.toUpperCase()}
                </span>
              )}
            </div>

            {/* TL;DR */}
            {threat.tldr && (
              <p className="text-gray-300 mb-3 line-clamp-2">{threat.tldr}</p>
            )}

            {/* Tags */}
            {threat.category && (
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 bg-slate-800 text-blue-400 rounded text-xs">
                  {threat.category}
                </span>
              </div>
            )}

            {/* External Link */}
            <a
              href={threat.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center mt-3 text-sm text-blue-500 hover:text-blue-400"
            >
              View original source
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!searchQuery && totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            Previous
          </button>

          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
