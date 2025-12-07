import { Search, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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

export default function SearchBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
}: SearchBarProps) {
  const { theme, formatText } = useTheme();
  const isTerminal = theme === 'terminal';

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
            className={`w-full px-4 py-2 border-2 focus:outline-none ${
              isTerminal
                ? 'bg-black text-terminal-green border-terminal-green-dark focus:border-terminal-green font-mono'
                : 'bg-business-bg-tertiary text-business-text-primary border-business-border-primary focus:border-business-accent-primary font-sans'
            }`}
          >
            <option value="">{formatText('All Sources')}</option>
            <option value="CISA Alerts">{formatText('CISA Alerts')}</option>
            <option value="Krebs on Security">{formatText('Krebs on Security')}</option>
            <option value="BleepingComputer">{formatText('BleepingComputer')}</option>
            <option value="The Hacker News">{formatText('The Hacker News')}</option>
            <option value="SANS ISC">{formatText('SANS ISC')}</option>
            <option value="Schneier on Security">{formatText('Schneier on Security')}</option>
            <option value="Dark Reading">{formatText('Dark Reading')}</option>
            <option value="Cisco Talos">{formatText('Cisco Talos')}</option>
            <option value="Malwarebytes Labs">{formatText('Malwarebytes Labs')}</option>
            <option value="Threatpost">{formatText('Threatpost')}</option>
            <option value="The Record">{formatText('The Record')}</option>
            <option value="US-CERT Current Activity">{formatText('US-CERT Current Activity')}</option>
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
