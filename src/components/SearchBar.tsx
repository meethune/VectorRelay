import { Search, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useState, useEffect } from 'react';

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
    const CACHE_KEY = 'threat-intel-sources';
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

    const fetchSources = async () => {
      try {
        setIsLoadingSources(true);

        // Check for cached sources
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const { sources: cachedSources, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            // If cache is still valid, use it
            if (age < CACHE_DURATION && cachedSources && Array.isArray(cachedSources)) {
              setSources(cachedSources);
              setIsLoadingSources(false);
              return;
            }
          } catch (e) {
            // Invalid cache data, continue to fetch
            localStorage.removeItem(CACHE_KEY);
          }
        }

        // Fetch from API
        const response = await fetch('/api/sources');
        if (!response.ok) {
          throw new Error('Failed to fetch sources');
        }
        const data = await response.json();
        const fetchedSources = data.sources || [];

        setSources(fetchedSources);

        // Cache the sources
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              sources: fetchedSources,
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          // localStorage might be full or disabled, continue without caching
          console.warn('Failed to cache sources:', e);
        }
      } catch (error) {
        console.error('Error fetching sources:', error);
        // Keep empty array on error
        setSources([]);
      } finally {
        setIsLoadingSources(false);
      }
    };

    fetchSources();
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
            <option value="ransomware">{formatText('Ransomware')}</option>
            <option value="apt">{formatText('APT')}</option>
            <option value="vulnerability">{formatText('Vulnerability')}</option>
            <option value="phishing">{formatText('Phishing')}</option>
            <option value="malware">{formatText('Malware')}</option>
            <option value="data_breach">{formatText('Data Breach')}</option>
            <option value="ddos">{formatText('DDoS')}</option>
            <option value="supply_chain">{formatText('Supply Chain')}</option>
            <option value="insider_threat">{formatText('Insider Threat')}</option>
            <option value="other">{formatText('Other')}</option>
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
            <option value="critical">{formatText('Critical')}</option>
            <option value="high">{formatText('High')}</option>
            <option value="medium">{formatText('Medium')}</option>
            <option value="low">{formatText('Low')}</option>
            <option value="info">{formatText('Info')}</option>
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
