import { useState } from 'react';
import { Shield, TrendingUp, Filter } from 'lucide-react';
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
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b-2 border-terminal-green sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-terminal-green icon-glow" />
              <h1 className="text-xl font-bold text-terminal-green font-mono tracking-wider">
                [ THREAT INTEL DASHBOARD ]
              </h1>
            </div>

            <nav className="flex space-x-4">
              <button
                onClick={handleBackToDashboard}
                className={`px-4 py-2 border font-mono text-sm font-medium transition ${
                  view === 'dashboard'
                    ? 'bg-terminal-green text-black border-terminal-green'
                    : 'text-terminal-green border-terminal-green-dark hover:bg-terminal-green-dark hover:text-black'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                [ DASHBOARD ]
              </button>
              <button
                onClick={() => setView('threats')}
                className={`px-4 py-2 border font-mono text-sm font-medium transition ${
                  view === 'threats' || view === 'detail'
                    ? 'bg-terminal-green text-black border-terminal-green'
                    : 'text-terminal-green border-terminal-green-dark hover:bg-terminal-green-dark hover:text-black'
                }`}
              >
                <Filter className="w-4 h-4 inline mr-2" />
                [ ALL THREATS ]
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
      <footer className="bg-black border-t-2 border-terminal-green mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-terminal-green-dim text-sm font-mono">
            &gt; POWERED_BY: CLOUDFLARE_WORKERS_AI | DATA_SOURCE: PUBLIC_THREAT_FEEDS
          </p>
        </div>
      </footer>
    </div>
  );
}
