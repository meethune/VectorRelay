import { Search, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { fetchWithCache, CacheTTL } from '../utils/cache';
import { THREAT_CATEGORIES, THREAT_SEVERITIES } from '../../functions/constants';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: {
    category: string;
    severity: string;
    source: string;
  };
  onFiltersChange: (filters: any) => void;
}

interface FeedSource {
  id: number;
  name: string;
  url: string;
  type: string;
  enabled: number;
}

export default function SearchBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
}: SearchBarProps) {
  const { theme, formatText } = useTheme();
  const isTerminal = theme === 'terminal';
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);

  // Fetch sources from the database with client-side caching
  useEffect(() => {
    const loadSources = async () => {
      try {
        setIsLoadingSources(true);

        const data = await fetchWithCache(
          'sources',
          async () => {
            const response = await fetch('/api/sources');
            if (!response.ok) {
              throw new Error('Failed to fetch sources');
            }
            return response.json();
          },
          { ttl: CacheTTL.ONE_HOUR, keyPrefix: 'threat-intel' }
        );

        setSources(data.sources || []);
      } catch (error) {
        console.error('Error fetching sources:', error);
        setSources([]);
      } finally {
        setIsLoadingSources(false);
      }
    };

    loadSources();
  }, []);

  return (
    <div className={`p-4 border-2 mb-6 ${
      isTerminal
        ? 'bg-black border-terminal-green'
        : 'bg-business-bg-secondary border-business-border-primary'
    }`}>
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
          isTerminal ? 'text-terminal-green-dim' : 'text-business-text-muted'
        }`} />
        <input
          type="text"
          placeholder={formatText('Search threats (keyword or semantic)...')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full pl-10 pr-10 py-3 border-2 focus:outline-none ${
            isTerminal
              ? 'bg-black text-terminal-green border-terminal-green-dark focus:border-terminal-green font-mono placeholder-terminal-green-dark'
              : 'bg-business-bg-tertiary text-business-text-primary border-business-border-primary focus:border-business-accent-primary font-sans placeholder:text-business-text-muted'
          }`}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
              isTerminal
                ? 'text-terminal-green-dim hover:text-terminal-green'
                : 'text-business-text-muted hover:text-business-accent-primary'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={`block text-sm mb-2 ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {formatText('Category', { style: 'label' })}
          </label>
          <select
            value={filters.category}
            onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
            className={`w-full px-4 py-2 border-2 focus:outline-none ${
              isTerminal
                ? 'bg-black text-terminal-green border-terminal-green-dark focus:border-terminal-green font-mono'
                : 'bg-business-bg-tertiary text-business-text-primary border-business-border-primary focus:border-business-accent-primary font-sans'
            }`}
          >
            <option value="">{formatText('All Categories')}</option>
            {THREAT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatText(category.replace('_', ' '))}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-sm mb-2 ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {formatText('Severity', { style: 'label' })}
          </label>
          <select
            value={filters.severity}
            onChange={(e) => onFiltersChange({ ...filters, severity: e.target.value })}
            className={`w-full px-4 py-2 border-2 focus:outline-none ${
              isTerminal
                ? 'bg-black text-terminal-green border-terminal-green-dark focus:border-terminal-green font-mono'
                : 'bg-business-bg-tertiary text-business-text-primary border-business-border-primary focus:border-business-accent-primary font-sans'
            }`}
          >
            <option value="">{formatText('All Severities')}</option>
            {THREAT_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {formatText(severity)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-sm mb-2 ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {formatText('Source', { style: 'label' })}
          </label>
          <select
            value={filters.source}
            onChange={(e) => onFiltersChange({ ...filters, source: e.target.value })}
            disabled={isLoadingSources}
            className={`w-full px-4 py-2 border-2 focus:outline-none ${
              isTerminal
                ? 'bg-black text-terminal-green border-terminal-green-dark focus:border-terminal-green font-mono'
                : 'bg-business-bg-tertiary text-business-text-primary border-business-border-primary focus:border-business-accent-primary font-sans'
            } ${isLoadingSources ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">
              {isLoadingSources
                ? formatText('Loading sources...')
                : formatText('All Sources')}
            </option>
            {sources.map((source) => (
              <option key={source.id} value={source.name}>
                {formatText(source.name)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clear Filters */}
      {(filters.category || filters.severity || filters.source || searchQuery) && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              onSearchChange('');
              onFiltersChange({ category: '', severity: '', source: '' });
            }}
            className={`text-sm flex items-center ${
              isTerminal
                ? 'text-terminal-green hover:text-terminal-green-dim font-mono'
                : 'text-business-accent-primary hover:text-business-accent-hover font-sans'
            }`}
          >
            <X className="w-4 h-4 mr-1" />
            {formatText('Clear all filters', { style: 'button' })}
          </button>
        </div>
      )}
    </div>
  );
}
