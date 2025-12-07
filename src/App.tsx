import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Shield, TrendingUp, Filter } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ThreatList from './components/ThreatList';
import ThreatDetail from './components/ThreatDetail';
import SearchBar from './components/SearchBar';
import ThemeToggle from './components/ThemeToggle';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Route components
function DashboardRoute() {
  return <Dashboard />;
}

function ThreatsRoute({
  searchQuery,
  setSearchQuery,
  filters,
  setFilters,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: { category: string; severity: string; source: string };
  setFilters: (filters: any) => void;
}) {
  const navigate = useNavigate();
  return (
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
        onThreatClick={(id) => navigate(`/threat/${id}`)}
      />
    </>
  );
}

function ThreatDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate('/threats');
    return null;
  }

  return <ThreatDetail threatId={id} onBack={() => navigate('/threats')} />;
}

function AppContent() {
  const { theme, formatText } = useTheme();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    severity: '',
    source: '',
  });

  const isTerminal = theme === 'terminal';

  // Determine active view based on current route
  const isThreatsView = location.pathname === '/threats' || location.pathname.startsWith('/threat/');

  return (
    <div className={`min-h-screen ${isTerminal ? 'bg-black' : 'bg-business-bg-primary'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b-2 ${
        isTerminal
          ? 'bg-black border-terminal-green'
          : 'bg-business-bg-secondary border-business-border-primary'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition cursor-pointer">
              <Shield className={`w-8 h-8 ${
                isTerminal ? 'text-terminal-green icon-glow' : 'text-business-accent-primary'
              }`} />
              <h1 className={`text-xl font-bold tracking-wider ${
                isTerminal
                  ? 'text-terminal-green font-mono'
                  : 'text-business-text-primary font-sans'
              }`}>
                {isTerminal ? '[ THREAT_INTEL_DASHBOARD ]' : 'Threat Intelligence Dashboard'}
              </h1>
            </Link>

            <nav className="flex space-x-4 items-center">
              <Link
                to="/"
                className={`px-4 py-2 border text-sm font-medium transition ${
                  isTerminal ? 'font-mono' : 'font-sans'
                } ${
                  location.pathname === '/'
                    ? isTerminal
                      ? 'bg-terminal-green text-black border-terminal-green'
                      : 'bg-business-accent-button text-white border-business-accent-button'
                    : isTerminal
                      ? 'text-terminal-green border-terminal-green-dark hover:bg-terminal-green-dark hover:text-black'
                      : 'text-business-text-secondary border-business-border-secondary hover:bg-business-bg-tertiary hover:text-business-text-primary'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                {formatText('Dashboard', { style: 'navigation' })}
              </Link>
              <Link
                to="/threats"
                className={`px-4 py-2 border text-sm font-medium transition ${
                  isTerminal ? 'font-mono' : 'font-sans'
                } ${
                  isThreatsView
                    ? isTerminal
                      ? 'bg-terminal-green text-black border-terminal-green'
                      : 'bg-business-accent-button text-white border-business-accent-button'
                    : isTerminal
                      ? 'text-terminal-green border-terminal-green-dark hover:bg-terminal-green-dark hover:text-black'
                      : 'text-business-text-secondary border-business-border-secondary hover:bg-business-bg-tertiary hover:text-business-text-primary'
                }`}
              >
                <Filter className="w-4 h-4 inline mr-2" />
                {formatText('All Threats', { style: 'navigation' })}
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<DashboardRoute />} />
          <Route
            path="/threats"
            element={
              <ThreatsRoute
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filters={filters}
                setFilters={setFilters}
              />
            }
          />
          <Route path="/threat/:id" element={<ThreatDetailRoute />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className={`border-t-2 mt-16 ${
        isTerminal
          ? 'bg-black border-terminal-green'
          : 'bg-business-bg-secondary border-business-border-primary'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className={`text-center text-sm ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}>
            {isTerminal
              ? '> POWERED_BY: CLOUDFLARE_WORKERS_AI | DATA_SOURCE: PUBLIC_THREAT_FEEDS'
              : 'Powered by Cloudflare Workers AI • Data from public threat feeds'
            }
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}
