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
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 mb-6">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search threats (keyword or semantic)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-800 text-white pl-10 pr-10 py-3 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Category</label>
          <select
            value={filters.category}
            onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="ransomware">Ransomware</option>
            <option value="apt">APT</option>
            <option value="vulnerability">Vulnerability</option>
            <option value="phishing">Phishing</option>
            <option value="malware">Malware</option>
            <option value="data_breach">Data Breach</option>
            <option value="ddos">DDoS</option>
            <option value="supply_chain">Supply Chain</option>
            <option value="insider_threat">Insider Threat</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Severity</label>
          <select
            value={filters.severity}
            onChange={(e) => onFiltersChange({ ...filters, severity: e.target.value })}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Source</label>
          <select
            value={filters.source}
            onChange={(e) => onFiltersChange({ ...filters, source: e.target.value })}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="CISA Alerts">CISA Alerts</option>
            <option value="Krebs on Security">Krebs on Security</option>
            <option value="BleepingComputer">BleepingComputer</option>
            <option value="The Hacker News">The Hacker News</option>
            <option value="SANS ISC">SANS ISC</option>
            <option value="Schneier on Security">Schneier on Security</option>
            <option value="Dark Reading">Dark Reading</option>
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
            className="text-sm text-blue-500 hover:text-blue-400 flex items-center"
          >
            <X className="w-4 h-4 mr-1" />
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
