import { useState, useEffect } from 'react';
import { Shield, TrendingUp, Search, Filter } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ThreatList from './components/ThreatList';
import ThreatDetail from './components/ThreatDetail';
import SearchBar from './components/SearchBar';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'threats' | 'detail'>('dashboard');
  const [selectedThreatId, setSelectedThreatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    severity: '',
    source: '',
  });

  const handleThreatClick = (id: string) => {
    setSelectedThreatId(id);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('threats');
    setSelectedThreatId(null);
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedThreatId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-500" />
              <h1 className="text-xl font-bold text-white">Threat Intelligence Dashboard</h1>
            </div>

            <nav className="flex space-x-4">
              <button
                onClick={handleBackToDashboard}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  view === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => setView('threats')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  view === 'threats' || view === 'detail'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-slate-800'
                }`}
              >
                <Filter className="w-4 h-4 inline mr-2" />
                All Threats
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'dashboard' && <Dashboard onViewThreats={() => setView('threats')} />}

        {view === 'threats' && (
          <>
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <ThreatList
              searchQuery={searchQuery}
              filters={filters}
              onThreatClick={handleThreatClick}
            />
          </>
        )}

        {view === 'detail' && selectedThreatId && (
          <ThreatDetail threatId={selectedThreatId} onBack={handleBackToList} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-400 text-sm">
            Powered by Cloudflare Workers AI • Data from public threat intelligence feeds
          </p>
        </div>
      </footer>
    </div>
  );
}
