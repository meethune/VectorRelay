import { Search, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatTerminalText } from '../utils/formatting';

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
          placeholder={isTerminal ? formatTerminalText('Search threats (keyword or semantic)...') : 'Search threats (keyword or semantic)...'}
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
            {isTerminal ? `> ${formatTerminalText('Category')}` : 'Category'}
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
            <option value="">{isTerminal ? formatTerminalText('All Categories') : 'All Categories'}</option>
            <option value="ransomware">{isTerminal ? formatTerminalText('Ransomware') : 'Ransomware'}</option>
            <option value="apt">{isTerminal ? formatTerminalText('APT') : 'APT'}</option>
            <option value="vulnerability">{isTerminal ? formatTerminalText('Vulnerability') : 'Vulnerability'}</option>
            <option value="phishing">{isTerminal ? formatTerminalText('Phishing') : 'Phishing'}</option>
            <option value="malware">{isTerminal ? formatTerminalText('Malware') : 'Malware'}</option>
            <option value="data_breach">{isTerminal ? formatTerminalText('Data Breach') : 'Data Breach'}</option>
            <option value="ddos">{isTerminal ? formatTerminalText('DDoS') : 'DDoS'}</option>
            <option value="supply_chain">{isTerminal ? formatTerminalText('Supply Chain') : 'Supply Chain'}</option>
            <option value="insider_threat">{isTerminal ? formatTerminalText('Insider Threat') : 'Insider Threat'}</option>
            <option value="other">{isTerminal ? formatTerminalText('Other') : 'Other'}</option>
          </select>
        </div>

        <div>
          <label className={`block text-sm mb-2 ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {isTerminal ? `> ${formatTerminalText('Severity')}` : 'Severity'}
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
            <option value="">{isTerminal ? formatTerminalText('All Severities') : 'All Severities'}</option>
            <option value="critical">{isTerminal ? formatTerminalText('Critical') : 'Critical'}</option>
            <option value="high">{isTerminal ? formatTerminalText('High') : 'High'}</option>
            <option value="medium">{isTerminal ? formatTerminalText('Medium') : 'Medium'}</option>
            <option value="low">{isTerminal ? formatTerminalText('Low') : 'Low'}</option>
            <option value="info">{isTerminal ? formatTerminalText('Info') : 'Info'}</option>
          </select>
        </div>

        <div>
          <label className={`block text-sm mb-2 ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {isTerminal ? `> ${formatTerminalText('Source')}` : 'Source'}
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
            <option value="">{isTerminal ? formatTerminalText('All Sources') : 'All Sources'}</option>
            <option value="CISA Alerts">{isTerminal ? formatTerminalText('CISA Alerts') : 'CISA Alerts'}</option>
            <option value="Krebs on Security">{isTerminal ? formatTerminalText('Krebs on Security') : 'Krebs on Security'}</option>
            <option value="BleepingComputer">{isTerminal ? formatTerminalText('BleepingComputer') : 'BleepingComputer'}</option>
            <option value="The Hacker News">{isTerminal ? formatTerminalText('The Hacker News') : 'The Hacker News'}</option>
            <option value="SANS ISC">{isTerminal ? formatTerminalText('SANS ISC') : 'SANS ISC'}</option>
            <option value="Schneier on Security">{isTerminal ? formatTerminalText('Schneier on Security') : 'Schneier on Security'}</option>
            <option value="Dark Reading">{isTerminal ? formatTerminalText('Dark Reading') : 'Dark Reading'}</option>
            <option value="Cisco Talos">{isTerminal ? formatTerminalText('Cisco Talos') : 'Cisco Talos'}</option>
            <option value="Malwarebytes Labs">{isTerminal ? formatTerminalText('Malwarebytes Labs') : 'Malwarebytes Labs'}</option>
            <option value="Threatpost">{isTerminal ? formatTerminalText('Threatpost') : 'Threatpost'}</option>
            <option value="The Record">{isTerminal ? formatTerminalText('The Record') : 'The Record'}</option>
            <option value="US-CERT Current Activity">{isTerminal ? formatTerminalText('US-CERT Current Activity') : 'US-CERT Current Activity'}</option>
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
            {isTerminal ? `[ ${formatTerminalText('Clear all filters')} ]` : 'Clear all filters'}
          </button>
        </div>
      )}
    </div>
  );
}
