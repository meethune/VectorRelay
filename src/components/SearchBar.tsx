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
  const { theme } = useTheme();
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
          placeholder={isTerminal ? 'SEARCH_THREATS (KEYWORD OR SEMANTIC)...' : 'Search threats (keyword or semantic)...'}
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
            {isTerminal ? '> CATEGORY' : 'Category'}
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
            <option value="">{isTerminal ? 'ALL_CATEGORIES' : 'All Categories'}</option>
            <option value="ransomware">{isTerminal ? 'RANSOMWARE' : 'Ransomware'}</option>
            <option value="apt">{isTerminal ? 'APT' : 'APT'}</option>
            <option value="vulnerability">{isTerminal ? 'VULNERABILITY' : 'Vulnerability'}</option>
            <option value="phishing">{isTerminal ? 'PHISHING' : 'Phishing'}</option>
            <option value="malware">{isTerminal ? 'MALWARE' : 'Malware'}</option>
            <option value="data_breach">{isTerminal ? 'DATA_BREACH' : 'Data Breach'}</option>
            <option value="ddos">{isTerminal ? 'DDOS' : 'DDoS'}</option>
            <option value="supply_chain">{isTerminal ? 'SUPPLY_CHAIN' : 'Supply Chain'}</option>
            <option value="insider_threat">{isTerminal ? 'INSIDER_THREAT' : 'Insider Threat'}</option>
            <option value="other">{isTerminal ? 'OTHER' : 'Other'}</option>
          </select>
        </div>

        <div>
          <label className={`block text-sm mb-2 ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {isTerminal ? '> SEVERITY' : 'Severity'}
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
            <option value="">{isTerminal ? 'ALL_SEVERITIES' : 'All Severities'}</option>
            <option value="critical">{isTerminal ? 'CRITICAL' : 'Critical'}</option>
            <option value="high">{isTerminal ? 'HIGH' : 'High'}</option>
            <option value="medium">{isTerminal ? 'MEDIUM' : 'Medium'}</option>
            <option value="low">{isTerminal ? 'LOW' : 'Low'}</option>
            <option value="info">{isTerminal ? 'INFO' : 'Info'}</option>
          </select>
        </div>

        <div>
          <label className={`block text-sm mb-2 ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {isTerminal ? '> SOURCE' : 'Source'}
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
            <option value="">{isTerminal ? 'ALL_SOURCES' : 'All Sources'}</option>
            <option value="CISA Alerts">{isTerminal ? 'CISA_ALERTS' : 'CISA Alerts'}</option>
            <option value="Krebs on Security">{isTerminal ? 'KREBS_ON_SECURITY' : 'Krebs on Security'}</option>
            <option value="BleepingComputer">{isTerminal ? 'BLEEPINGCOMPUTER' : 'BleepingComputer'}</option>
            <option value="The Hacker News">{isTerminal ? 'THE_HACKER_NEWS' : 'The Hacker News'}</option>
            <option value="SANS ISC">{isTerminal ? 'SANS_ISC' : 'SANS ISC'}</option>
            <option value="Schneier on Security">{isTerminal ? 'SCHNEIER_ON_SECURITY' : 'Schneier on Security'}</option>
            <option value="Dark Reading">{isTerminal ? 'DARK_READING' : 'Dark Reading'}</option>
            <option value="Cisco Talos">{isTerminal ? 'CISCO_TALOS' : 'Cisco Talos'}</option>
            <option value="Malwarebytes Labs">{isTerminal ? 'MALWAREBYTES_LABS' : 'Malwarebytes Labs'}</option>
            <option value="Threatpost">{isTerminal ? 'THREATPOST' : 'Threatpost'}</option>
            <option value="The Record">{isTerminal ? 'THE_RECORD' : 'The Record'}</option>
            <option value="US-CERT Current Activity">{isTerminal ? 'US-CERT_CURRENT_ACTIVITY' : 'US-CERT Current Activity'}</option>
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
            {isTerminal ? '[ CLEAR_ALL_FILTERS ]' : 'Clear all filters'}
          </button>
        </div>
      )}
    </div>
  );
}
