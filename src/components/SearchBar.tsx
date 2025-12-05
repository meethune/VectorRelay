import { Search, X } from 'lucide-react';

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
  return (
    <div className="bg-black p-4 border-2 border-terminal-green mb-6">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-terminal-green-dim w-5 h-5" />
        <input
          type="text"
          placeholder="SEARCH_THREATS (KEYWORD OR SEMANTIC)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-black text-terminal-green pl-10 pr-10 py-3 border-2 border-terminal-green-dark focus:border-terminal-green focus:outline-none font-mono placeholder-terminal-green-dark"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-terminal-green-dim hover:text-terminal-green"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-terminal-green-dim mb-2 font-mono">&gt; CATEGORY</label>
          <select
            value={filters.category}
            onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
            className="w-full bg-black text-terminal-green px-4 py-2 border-2 border-terminal-green-dark focus:border-terminal-green focus:outline-none font-mono"
          >
            <option value="">ALL_CATEGORIES</option>
            <option value="ransomware">RANSOMWARE</option>
            <option value="apt">APT</option>
            <option value="vulnerability">VULNERABILITY</option>
            <option value="phishing">PHISHING</option>
            <option value="malware">MALWARE</option>
            <option value="data_breach">DATA_BREACH</option>
            <option value="ddos">DDOS</option>
            <option value="supply_chain">SUPPLY_CHAIN</option>
            <option value="insider_threat">INSIDER_THREAT</option>
            <option value="other">OTHER</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-terminal-green-dim mb-2 font-mono">&gt; SEVERITY</label>
          <select
            value={filters.severity}
            onChange={(e) => onFiltersChange({ ...filters, severity: e.target.value })}
            className="w-full bg-black text-terminal-green px-4 py-2 border-2 border-terminal-green-dark focus:border-terminal-green focus:outline-none font-mono"
          >
            <option value="">ALL_SEVERITIES</option>
            <option value="critical">CRITICAL</option>
            <option value="high">HIGH</option>
            <option value="medium">MEDIUM</option>
            <option value="low">LOW</option>
            <option value="info">INFO</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-terminal-green-dim mb-2 font-mono">&gt; SOURCE</label>
          <select
            value={filters.source}
            onChange={(e) => onFiltersChange({ ...filters, source: e.target.value })}
            className="w-full bg-black text-terminal-green px-4 py-2 border-2 border-terminal-green-dark focus:border-terminal-green focus:outline-none font-mono"
          >
            <option value="">ALL_SOURCES</option>
            <option value="CISA Alerts">CISA_ALERTS</option>
            <option value="Krebs on Security">KREBS_ON_SECURITY</option>
            <option value="BleepingComputer">BLEEPINGCOMPUTER</option>
            <option value="The Hacker News">THE_HACKER_NEWS</option>
            <option value="SANS ISC">SANS_ISC</option>
            <option value="Schneier on Security">SCHNEIER_ON_SECURITY</option>
            <option value="Dark Reading">DARK_READING</option>
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
            className="text-sm text-terminal-green hover:text-terminal-green-dim flex items-center font-mono"
          >
            <X className="w-4 h-4 mr-1" />
            [ CLEAR_ALL_FILTERS ]
          </button>
        </div>
      )}
    </div>
  );
}
