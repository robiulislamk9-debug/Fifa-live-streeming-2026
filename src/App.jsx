import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Trophy, Tv, Star, Globe, Search, ShieldAlert, Menu, X, RefreshCw, Wifi, WifiOff, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import channelsData from './data/channels.json';
import { useWorldCupData } from './hooks/useWorldCupData';
import VideoPlayer from './components/VideoPlayer';
import PremiumCard from './components/PremiumCard';
import HeroBanner from './components/HeroBanner';
import LiveScores from './components/LiveScores';
import CategorySidebar from './components/CategorySidebar';
import ChannelDrawer from './components/ChannelDrawer';
import RecentChannels from './components/RecentChannels';
import CommandPalette from './components/CommandPalette';
import QuickSwitchPanel from './components/QuickSwitchPanel';
import { COUNTRY_MAP } from './utils/countryMap';

const ScheduleBoard = lazy(() => import('./components/ScheduleBoard'));
const EPGTimeline = lazy(() => import('./components/EPGTimeline'));

// Top English channels to display as featured cards
const FEATURED_IDS = [
  'FIFAPlus.uk',
  'beINSPORTSXTRA.us',
  'CBSSportsGolazoNetwork.us',
  'CBSSportsHQ.us',
  'NFLChannel.us',
  'NBCSportsNOW.us',
  'FuboSportsNetwork.us',
  'TSNTheOcho.ca',
  'DAZNCombat.uk'
];

function App() {
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [activeToast, setActiveToast] = useState(null);

  // Real 2026 World Cup data from worldcup26.ir (polls every 60s)
  const { matches, loading: dataLoading, error: dataError, usingFallback, refetch } = useWorldCupData();

  // Track previous match scores to detect goals/kickoffs between polls
  const prevMatchesRef = useRef([]);
  useEffect(() => {
    if (prevMatchesRef.current.length === 0) {
      prevMatchesRef.current = matches;
      return;
    }

    for (const match of matches) {
      const prev = prevMatchesRef.current.find(m => m.id === match.id);
      if (!prev) continue;

      // Detect newly live match (kickoff)
      if (prev.status !== 'live' && match.status === 'live') {
        setActiveToast({
          message: `🏁 Kickoff! ${match.homeTeam} vs ${match.awayTeam} is now LIVE!`,
          type: 'kickoff',
          id: Date.now(),
        });
        break;
      }

      // Detect score change (goal)
      if (match.status === 'live' && prev.score !== match.score) {
        setActiveToast({
          message: `⚽ GOAL! ${match.homeTeam} ${match.score} ${match.awayTeam} (${match.minute || ''})`,
          type: 'goal',
          id: Date.now(),
        });
        break;
      }
    }

    prevMatchesRef.current = matches;
  }, [matches]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => setActiveToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);
  
  // URL Routing States
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'wc-broadcasters';
  });
  
  const [selectedCountry, setSelectedCountry] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('country') || 'all';
  });
  
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
  });

  // Favorites & Bookmarks States
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('fifa_streamer_favs');
    return saved ? JSON.parse(saved) : [];
  });

  // Recently Watched State
  const [recentlyWatched, setRecentlyWatched] = useState(() => {
    const saved = localStorage.getItem('fifa_streamer_recent');
    return saved ? JSON.parse(saved) : [];
  });

  // Sidebar expand / Channel Drawer / Command Palette / Mobile overlay states
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  const handleSelectCountry = (countryCode) => {
    setSelectedCountry(countryCode);
    setIsDrawerOpen(true);
    const channelTabs = ['wc-broadcasters', 'fifa-26', 'all-sports', 'news-channels', 'bangla-tv', 'favorites'];
    if (!channelTabs.includes(activeTab)) {
      setActiveTab('all-sports');
    }
  };

  // Sync state to URL search parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'wc-broadcasters') params.set('tab', activeTab);
    if (selectedCountry !== 'all') params.set('country', selectedCountry);
    if (searchQuery !== '') params.set('search', searchQuery);
    if (selectedChannel) params.set('watch', selectedChannel.id);
    
    const newRelativePathQuery = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState(null, '', newRelativePathQuery);
  }, [activeTab, selectedCountry, searchQuery, selectedChannel]);

  // Deep linking initial load & POPState listener
  useEffect(() => {
    const loadStateFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const watchId = params.get('watch');
      if (watchId) {
        const channel = channelsData.find(c => c.id === watchId);
        if (channel) setSelectedChannel(channel);
      }
      
      const tabParam = params.get('tab');
      if (tabParam) setActiveTab(tabParam);
      
      const countryParam = params.get('country');
      if (countryParam) setSelectedCountry(countryParam);

      const searchParam = params.get('search');
      if (searchParam) setSearchQuery(searchParam);
    };

    loadStateFromUrl();
    window.addEventListener('popstate', loadStateFromUrl);
    return () => window.removeEventListener('popstate', loadStateFromUrl);
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('fifa_streamer_favs', JSON.stringify(favorites));
  }, [favorites]);

  const handleToggleFavorite = (channelId) => {
    setFavorites(prev => {
      if (prev.includes(channelId)) {
        return prev.filter(id => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    
    // Add to recently watched
    setRecentlyWatched(prev => {
      const filtered = prev.filter(id => id !== channel.id);
      const updated = [channel.id, ...filtered].slice(0, 8);
      localStorage.setItem('fifa_streamer_recent', JSON.stringify(updated));
      return updated;
    });

    // Auto scroll up to the player on mobile devices
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setSelectedChannel(null);
    setActiveTab('wc-broadcasters');
    setSelectedCountry('all');
    setSearchQuery('');
    setIsDrawerOpen(true);
    // Clear URL parameters
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Global key listener for Ctrl+K command palette trigger
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const getResultsHeader = () => {
    if (selectedCountry !== 'all') {
      const countryDetails = COUNTRY_MAP[selectedCountry.toLowerCase()] || { name: selectedCountry.toUpperCase() };
      return (
        <div className="flex items-center gap-4 mb-5 bg-sport-card/30 border border-white/5 p-4 rounded-2xl backdrop-blur-sm">
          <img 
            src={`https://flagcdn.com/w80/${selectedCountry.toLowerCase()}.png`} 
            alt="" 
            className="h-8 w-12 object-cover rounded-md border border-white/10 shadow-lg"
            onError={(e) => e.target.style.display = 'none'}
          />
          <div>
            <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
              {countryDetails.name} Streams
            </h2>
            <p className="text-xs text-sport-secondary font-semibold mt-0.5">
              Showing {displayChannels.length} verified live feeds from {countryDetails.name}
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="mb-5">
        <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
          Search Results
          <span className="text-xs font-bold bg-sport-accent/10 border border-sport-accent/20 text-sport-accent px-2.5 py-0.5 rounded-full">
            {displayChannels.length} streams
          </span>
        </h2>
        <p className="text-xs text-sport-secondary mt-1 font-semibold">
          Showing matching feeds for query "{searchQuery}"
        </p>
      </div>
    );
  };

  // Filter channels based on Search, Country, and Active Tab
  const filteredChannels = channelsData.filter(ch => {
    // Search Filter
    const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (ch.country && ch.country.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    // Country Filter
    if (selectedCountry !== 'all' && ch.country !== selectedCountry) return false;

    // Tab Filter
    if (activeTab === 'wc-broadcasters' && !ch.isWorldCupBroadcaster) return false;
    if (activeTab === 'fifa-26' && !ch.categories.includes('fifa-26')) return false;
    if (activeTab === 'all-sports' && !ch.categories.includes('sports')) return false;
    if (activeTab === 'news-channels' && !ch.categories.includes('news')) return false;
    if (activeTab === 'bangla-tv' && !ch.categories.includes('bangla')) return false;
    if (activeTab === 'favorites' && !favorites.includes(ch.id)) return false;

    return true;
  });

  const isDefaultView = searchQuery === '' && selectedCountry === 'all';

  // Create sorted list with featured channels at the top in default view
  const displayChannels = [...filteredChannels];
  if (isDefaultView && (activeTab === 'wc-broadcasters' || activeTab === 'fifa-26' || activeTab === 'all-sports' || activeTab === 'news-channels' || activeTab === 'bangla-tv')) {
    displayChannels.sort((a, b) => {
      const aFeatured = FEATURED_IDS.includes(a.id);
      const bFeatured = FEATURED_IDS.includes(b.id);
      if (aFeatured && !bFeatured) return -1;
      if (!aFeatured && bFeatured) return 1;
      return 0;
    });
  }

  // Get recently watched channel objects
  const recentWatchedChannels = recentlyWatched
    .map(id => channelsData.find(c => c.id === id))
    .filter(Boolean);

  // Get bookmarked channel objects
  const favoriteChannels = favorites
    .map(id => channelsData.find(c => c.id === id))
    .filter(Boolean);

  // Compute counts for sidebar categories
  const wcCount = channelsData.filter(c => c.isWorldCupBroadcaster).length;
  const fifa26Count = channelsData.filter(c => c.categories.includes('fifa-26')).length;
  const sportsCount = channelsData.filter(c => c.categories.includes('sports')).length;
  const newsCount = channelsData.filter(c => c.categories.includes('news')).length;
  const banglaCount = channelsData.filter(c => c.categories.includes('bangla')).length;
  const totalCount = channelsData.length;

  return (
    <div className="flex flex-col min-h-screen bg-sport-bg text-white selection:bg-sport-accent selection:text-black">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile Categories Menu Trigger */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-sport-secondary hover:text-white md:hidden transition-all"
            title="Open Categories Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div 
            onClick={handleGoHome}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
            title="Go to Homepage"
          >
            <Trophy className="h-6 w-6 text-sport-accent filter drop-shadow-[0_0_8px_rgba(0,255,136,0.3)] group-hover:scale-110 transition-transform duration-300" />
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-sport-accent bg-clip-text text-transparent flex items-center gap-1.5">
              OSOMOI LIVE TV 
              <span className="text-[9px] bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black px-1.5 py-0.5 rounded tracking-wider shadow-md">
                LIVE
              </span>
            </h1>
          </div>
        </div>

        {/* Global Spotlight Search trigger bar */}
        <div 
          onClick={() => setIsCommandPaletteOpen(true)}
          className="hidden md:flex items-center relative w-80 lg:w-96 cursor-pointer group select-none"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sport-secondary group-hover:text-sport-accent transition-colors" />
          <input
            type="text"
            placeholder="Search channels globally... (Press Ctrl+K)"
            readOnly
            className="w-full bg-white/5 border border-white/5 group-hover:border-white/10 outline-none rounded-xl pl-10 pr-16 py-2.5 text-xs font-semibold text-white placeholder-sport-secondary cursor-pointer transition-all duration-300 shadow-inner"
          />
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 border border-white/10 text-sport-secondary font-mono shadow-sm group-hover:text-white transition-colors">
            Ctrl+K
          </kbd>
        </div>

        {/* API Status + Drawer toggle + Bookmarks button */}
        <div className="flex items-center gap-3">
          {/* Drawer Open/Collapse Button */}
          <button
            onClick={() => setIsDrawerOpen(prev => !prev)}
            className={`hidden md:flex items-center gap-2 font-bold text-xs px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              isDrawerOpen 
                ? 'bg-sport-accent/10 border-sport-accent/20 text-sport-accent'
                : 'bg-white/5 border-white/5 text-sport-secondary hover:text-white hover:bg-white/10'
            }`}
            title={isDrawerOpen ? "Collapse Channels Drawer" : "Expand Channels Drawer"}
          >
            <Tv className="h-4 w-4" />
            <span className="hidden lg:inline">Channels</span>
          </button>

          {/* Live matches counter */}
          {(() => {
            const liveCount = matches.filter(m => m.status === 'live').length;
            return (
              <div className="hidden sm:flex items-center gap-2 bg-sport-accent/5 border border-sport-accent/10 px-3 py-1.5 rounded-lg text-[10px] font-bold text-sport-accent uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-sport-accent animate-pulse-accent" />
                {liveCount > 0 ? `${liveCount} Match${liveCount > 1 ? 'es' : ''} Live` : '217 Feeds Online'}
              </div>
            );
          })()}

          {/* API data source badge */}
          <button
            onClick={refetch}
            title={usingFallback ? 'Using offline data — click to retry live API' : 'Live data from worldcup26.ir — click to refresh'}
            className={`hidden md:flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
              usingFallback
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {usingFallback ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
            {usingFallback ? 'Offline' : 'WC 2026 Live'}
          </button>
          
          <button 
            onClick={() => { setActiveTab('favorites'); setSelectedCountry('all'); setIsDrawerOpen(true); }}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs px-3 py-2 rounded-xl border border-white/5 transition-all cursor-pointer"
            title="Bookmarked Feeds"
          >
            <Star className={`h-4 w-4 ${favorites.length > 0 ? 'fill-yellow-400 text-yellow-400' : 'text-sport-secondary'}`} />
            <span className="hidden sm:inline">Bookmarks</span>
            <span className="bg-sport-card px-1.5 py-0.5 rounded-full text-[10px] border border-white/5">
              {favorites.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Layout Row */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Category Sidebar (Desktop/Tablet) */}
        <div className="hidden md:block h-full flex-shrink-0">
          <CategorySidebar
            activeTab={activeTab}
            setActiveTab={(tabId) => {
              setActiveTab(tabId);
              setSelectedCountry('all');
              setIsDrawerOpen(true);
            }}
            wcCount={wcCount}
            fifa26Count={fifa26Count}
            sportsCount={sportsCount}
            newsCount={newsCount}
            banglaCount={banglaCount}
            favoritesCount={favorites.length}
            isSidebarExpanded={isSidebarExpanded}
            setIsSidebarExpanded={setIsSidebarExpanded}
            selectedCountry={selectedCountry}
            setSelectedCountry={handleSelectCountry}
          />
        </div>

        {/* Category Sidebar (Mobile Drawer overlay) */}
        <AnimatePresence>
          {isMobileOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-64 h-full z-10 flex flex-col"
              >
                <CategorySidebar
                  activeTab={activeTab}
                  setActiveTab={(tabId) => {
                    setActiveTab(tabId);
                    setSelectedCountry('all');
                    setIsDrawerOpen(true);
                    setIsMobileOpen(false);
                  }}
                  wcCount={wcCount}
                  fifa26Count={fifa26Count}
                  sportsCount={sportsCount}
                  newsCount={newsCount}
                  banglaCount={banglaCount}
                  favoritesCount={favorites.length}
                  isSidebarExpanded={true}
                  setIsSidebarExpanded={() => {}}
                  selectedCountry={selectedCountry}
                  setSelectedCountry={handleSelectCountry}
                />
                {/* Close Button Inside Drawer */}
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 border border-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Channels List Drawer: Pushes player when open on desktop */}
        <ChannelDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          category={activeTab}
          allChannels={channelsData}
          selectedChannel={selectedChannel}
          onSelectChannel={handleSelectChannel}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          isKeyboardActive={!isCommandPaletteOpen}
          selectedCountry={selectedCountry}
          setSelectedCountry={handleSelectCountry}
        />

        {/* Middle main content pane */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6 md:gap-8 transition-all duration-250 ease-in-out">
          
          {/* Mobile search bar trigger button */}
          <div 
            onClick={() => setIsCommandPaletteOpen(true)}
            className="md:hidden relative w-full cursor-pointer select-none"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sport-secondary" />
            <input
              type="text"
              placeholder="Search streams... (Ctrl+K)"
              readOnly
              className="w-full bg-white/5 border border-white/5 outline-none rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-white placeholder-sport-secondary cursor-pointer"
            />
          </div>

          {/* Active Filters HUD */}
          {!isDefaultView && (
            <div className="flex flex-wrap items-center gap-3 bg-sport-card/45 border border-white/5 px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-inner">
              <span className="text-[10px] font-extrabold text-sport-secondary uppercase tracking-widest pl-1">
                Active Filters:
              </span>
              <div className="flex flex-wrap gap-2 items-center">
                {searchQuery && (
                  <span className="flex items-center gap-1.5 bg-white/5 border border-white/5 text-[11px] font-semibold text-white px-2.5 py-1 rounded-xl">
                    <span>Search: "{searchQuery}"</span>
                    <button 
                      onClick={() => setSearchQuery('')} 
                      className="text-sport-secondary hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                      title="Clear Search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedCountry !== 'all' && (
                  <span className="flex items-center gap-1.5 bg-white/5 border border-white/5 text-[11px] font-semibold text-white px-2.5 py-1 rounded-xl">
                    <img 
                      src={`https://flagcdn.com/w40/${selectedCountry.toLowerCase()}.png`} 
                      alt="" 
                      className="h-2.5 w-3.5 object-cover rounded-sm border border-white/10 flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span>Country: {COUNTRY_MAP[selectedCountry.toLowerCase()]?.name || selectedCountry.toUpperCase()}</span>
                    <button 
                      onClick={() => setSelectedCountry('all')} 
                      className="text-sport-secondary hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                      title="Clear Country Filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <button 
                  onClick={handleGoHome}
                  className="text-[10px] font-extrabold text-sport-accent hover:text-white transition-colors uppercase pl-3 border-l border-white/10 ml-2 cursor-pointer"
                  title="Clear All Filters"
                >
                  Reset Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Primary View: Video Player and Quick Switch Area */}
          <section className={`grid grid-cols-1 ${(isTheaterMode || !selectedChannel) ? 'grid-cols-1' : 'lg:grid-cols-12'} gap-6 w-full`}>
            {/* Player + History Panel */}
            <div className={`flex flex-col gap-4 ${(isTheaterMode || !selectedChannel) ? 'w-full' : 'lg:col-span-8'}`}>
              <VideoPlayer
                channel={selectedChannel}
                onClose={selectedChannel ? () => setSelectedChannel(null) : null}
                isTheaterMode={isTheaterMode}
                onToggleTheater={selectedChannel ? () => setIsTheaterMode(!isTheaterMode) : null}
              />
              
              {/* Recently Watched channels horizontal section directly below video player */}
              <RecentChannels
                recentChannels={recentWatchedChannels}
                selectedChannel={selectedChannel}
                onSelectChannel={handleSelectChannel}
                onClearRecent={() => {
                  setRecentlyWatched([]);
                  localStorage.removeItem('fifa_streamer_recent');
                }}
              />
            </div>
            
            {/* Right Quick Switch Sidebar Panel */}
            {!isTheaterMode && selectedChannel && (
              <div className="lg:col-span-4 h-full">
                <QuickSwitchPanel
                  category={activeTab}
                  allChannels={channelsData}
                  selectedChannel={selectedChannel}
                  onSelectChannel={handleSelectChannel}
                  favorites={favorites}
                />
              </div>
            )}
          </section>

          {/* Hero Marquee Match Banner */}
          {isDefaultView && (
            <section className="w-full">
              <HeroBanner
                onSelectChannel={handleSelectChannel}
                channels={channelsData}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                matches={matches}
              />
            </section>
          )}

          {/* Sofascore Live Fixture Widgets */}
          {isDefaultView && (
            <section className="w-full">
              <LiveScores
                onSelectChannel={handleSelectChannel}
                channels={channelsData}
                matches={matches}
              />
            </section>
          )}

          {/* Tab Navigation header */}
          <section className="flex flex-col gap-5">
            <div className="flex border-b border-white/5 gap-6 overflow-x-auto no-scrollbar whitespace-nowrap">
              <button
                onClick={() => { setActiveTab('wc-broadcasters'); setSelectedCountry('all'); }}
                className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all duration-300 cursor-pointer ${
                  activeTab === 'wc-broadcasters'
                    ? 'border-sport-accent text-sport-accent'
                    : 'border-transparent text-sport-secondary hover:text-white'
                }`}
              >
                World Cup Feeds
              </button>
              
              <button
                onClick={() => { setActiveTab('fifa-26'); setSelectedCountry('all'); }}
                className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all duration-300 cursor-pointer ${
                  activeTab === 'fifa-26'
                    ? 'border-sport-accent text-sport-accent'
                    : 'border-transparent text-sport-secondary hover:text-white'
                }`}
              >
                FIFA 26
              </button>
              
              <button
                onClick={() => { setActiveTab('all-sports'); setSelectedCountry('all'); }}
                className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all duration-300 cursor-pointer ${
                  activeTab === 'all-sports'
                    ? 'border-sport-accent text-sport-accent'
                    : 'border-transparent text-sport-secondary hover:text-white'
                }`}
              >
                Channel Directory
              </button>

              <button
                onClick={() => { setActiveTab('news-channels'); setSelectedCountry('all'); }}
                className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all duration-300 cursor-pointer ${
                  activeTab === 'news-channels'
                    ? 'border-sport-accent text-sport-accent'
                    : 'border-transparent text-sport-secondary hover:text-white'
                }`}
              >
                News Channels
              </button>

              <button
                onClick={() => { setActiveTab('bangla-tv'); setSelectedCountry('all'); }}
                className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all duration-300 cursor-pointer ${
                  activeTab === 'bangla-tv'
                    ? 'border-sport-accent text-sport-accent'
                    : 'border-transparent text-sport-secondary hover:text-white'
                }`}
              >
                Bangla TV
              </button>

              <button
                onClick={() => { setActiveTab('epg-guide'); setSelectedCountry('all'); }}
                className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all duration-300 cursor-pointer ${
                  activeTab === 'epg-guide'
                    ? 'border-sport-accent text-sport-accent'
                    : 'border-transparent text-sport-secondary hover:text-white'
                }`}
              >
                TV Guide (EPG)
              </button>

              <button
                onClick={() => { setActiveTab('schedule'); setSelectedCountry('all'); }}
                className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all duration-300 cursor-pointer ${
                  activeTab === 'schedule'
                    ? 'border-sport-accent text-sport-accent'
                    : 'border-transparent text-sport-secondary hover:text-white'
                }`}
              >
                Schedule & Bracket
              </button>
            </div>

            {/* Tab screen layouts */}
            <Suspense fallback={
              <div className="w-full py-20 flex flex-col items-center justify-center text-sport-secondary gap-3">
                <RefreshCw className="h-8 w-8 text-sport-accent animate-spin" />
                <span className="text-xs font-bold uppercase tracking-widest text-sport-accent">Loading Screen...</span>
              </div>
            }>
              {activeTab === 'schedule' ? (
                <ScheduleBoard
                  onSelectChannel={handleSelectChannel}
                  channels={channelsData}
                  matches={matches}
                />
              ) : activeTab === 'epg-guide' ? (
                <EPGTimeline
                  channels={filteredChannels}
                  onSelectChannel={handleSelectChannel}
                  selectedChannel={selectedChannel}
                />
              ) : activeTab === 'fifa-26' ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-wide">FIFA 26 Official Broadcasters</h2>
                      <p className="text-xs text-sport-secondary">Verified 100% live streams for all matches and ceremonies</p>
                    </div>
                    <span className="text-xs font-bold bg-sport-accent/10 border border-sport-accent/20 text-sport-accent px-2.5 py-0.5 rounded-full">
                      {displayChannels.length} streams
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {displayChannels.map(ch => (
                      <PremiumCard
                        key={ch.id}
                        channel={ch}
                        isActive={selectedChannel && selectedChannel.id === ch.id}
                        onSelect={handleSelectChannel}
                        isFavorite={favorites.includes(ch.id)}
                        onToggleFavorite={handleToggleFavorite}
                        isFeatured={false}
                      />
                    ))}
                  </div>
                  {displayChannels.length === 0 && (
                    <div className="text-center py-12 glass-panel border border-white/5 rounded-2xl flex flex-col items-center">
                      <ShieldAlert className="h-10 w-10 text-red-400 mb-3" />
                      <h4 className="font-bold text-white">No streams found</h4>
                      <p className="text-xs text-sport-secondary mt-1">Try selecting another country filter.</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'news-channels' ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-wide">Live News Broadcasts</h2>
                      <p className="text-xs text-sport-secondary">Verified active news feeds from around the world</p>
                    </div>
                    <span className="text-xs font-bold bg-sport-accent/10 border border-sport-accent/20 text-sport-accent px-2.5 py-0.5 rounded-full">
                      {displayChannels.length} streams
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {displayChannels.map(ch => (
                      <PremiumCard
                        key={ch.id}
                        channel={ch}
                        isActive={selectedChannel && selectedChannel.id === ch.id}
                        onSelect={handleSelectChannel}
                        isFavorite={favorites.includes(ch.id)}
                        onToggleFavorite={handleToggleFavorite}
                        isFeatured={false}
                      />
                    ))}
                  </div>
                  {displayChannels.length === 0 && (
                    <div className="text-center py-12 glass-panel border border-white/5 rounded-2xl flex flex-col items-center">
                      <ShieldAlert className="h-10 w-10 text-red-400 mb-3" />
                      <h4 className="font-bold text-white">No streams found</h4>
                      <p className="text-xs text-sport-secondary mt-1">Try selecting another country filter.</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'bangla-tv' ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-wide">Bangla TV Channels</h2>
                      <p className="text-xs text-sport-secondary">Top live entertainment, news, and sports channels from Bangladesh</p>
                    </div>
                    <span className="text-xs font-bold bg-sport-accent/10 border border-sport-accent/20 text-sport-accent px-2.5 py-0.5 rounded-full">
                      {displayChannels.length} streams
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {displayChannels.map(ch => (
                      <PremiumCard
                        key={ch.id}
                        channel={ch}
                        isActive={selectedChannel && selectedChannel.id === ch.id}
                        onSelect={handleSelectChannel}
                        isFavorite={favorites.includes(ch.id)}
                        onToggleFavorite={handleToggleFavorite}
                        isFeatured={false}
                      />
                    ))}
                  </div>
                  {displayChannels.length === 0 && (
                    <div className="text-center py-12 glass-panel border border-white/5 rounded-2xl flex flex-col items-center">
                      <ShieldAlert className="h-10 w-10 text-red-400 mb-3" />
                      <h4 className="font-bold text-white">No streams found</h4>
                      <p className="text-xs text-sport-secondary mt-1">Try selecting another country filter.</p>
                    </div>
                  )}
                </div>
              ) : (
                // Rows for main catalogs (World Cup feeds or sports directories)
                <div className="flex flex-col gap-6 md:gap-8">
                  
                  {/* Search / Filters Active HUD */}
                  {!isDefaultView && (
                    <div>
                      {getResultsHeader()}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {displayChannels.map(ch => (
                          <PremiumCard
                            key={ch.id}
                            channel={ch}
                            isActive={selectedChannel && selectedChannel.id === ch.id}
                            onSelect={handleSelectChannel}
                            isFavorite={favorites.includes(ch.id)}
                            onToggleFavorite={handleToggleFavorite}
                            isFeatured={false}
                          />
                        ))}
                      </div>
                      {displayChannels.length === 0 && (
                        <div className="text-center py-12 glass-panel border border-white/5 rounded-2xl flex flex-col items-center">
                          <ShieldAlert className="h-10 w-10 text-red-400 mb-3" />
                          <h4 className="font-bold text-white">No streams found</h4>
                          <p className="text-xs text-sport-secondary mt-1">Try clearing your filters or testing another query.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Default Catalog Rows (Netflix Style) */}
                  {isDefaultView && (
                    <>
                      {/* Row 1: Bookmarks (Horizontal lane) */}
                      {favoriteChannels.length > 0 && (
                        <div className="flex flex-col gap-3">
                          <h3 className="text-sm font-bold text-sport-secondary tracking-widest uppercase flex items-center gap-2 pl-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            Bookmarked Channels
                          </h3>
                          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3 scroll-smooth">
                            {favoriteChannels.map(ch => (
                              <div key={ch.id} className="flex-shrink-0 w-64">
                                <PremiumCard
                                  channel={ch}
                                  isActive={selectedChannel && selectedChannel.id === ch.id}
                                  onSelect={handleSelectChannel}
                                  isFavorite={true}
                                  onToggleFavorite={handleToggleFavorite}
                                  isFeatured={false}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Row 2: Featured English Feeds (21:9 grid) */}
                      <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-sport-secondary tracking-widest uppercase pl-1 border-l-2 border-sport-accent/60">
                          Top Sports Broadcasts (English)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {displayChannels
                            .filter(ch => FEATURED_IDS.includes(ch.id))
                            .map(ch => (
                              <PremiumCard
                                key={ch.id}
                                channel={ch}
                                isActive={selectedChannel && selectedChannel.id === ch.id}
                                onSelect={handleSelectChannel}
                                isFavorite={favorites.includes(ch.id)}
                                onToggleFavorite={handleToggleFavorite}
                                isFeatured={true}
                              />
                            ))}
                        </div>
                      </div>

                      {/* Row 3: All Matches & Feeds Catalog */}
                      <div className="flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-sport-secondary tracking-widest uppercase pl-1 border-l-2 border-white/20">
                          All Live Streams Directory
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {displayChannels
                            .filter(ch => !FEATURED_IDS.includes(ch.id))
                            .map(ch => (
                              <PremiumCard
                                key={ch.id}
                                channel={ch}
                                isActive={selectedChannel && selectedChannel.id === ch.id}
                                onSelect={handleSelectChannel}
                                isFavorite={favorites.includes(ch.id)}
                                onToggleFavorite={handleToggleFavorite}
                                isFeatured={false}
                              />
                            ))}
                        </div>
                      </div>
                    </>
                  )}

                </div>
              )}
            </Suspense>
          </section>

        </main>
      </div>

      {/* Floating Goal/Event Notifications */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            key={activeToast.id}
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-20 right-4 md:right-6 z-50 glass-panel border px-4.5 py-3 rounded-2xl flex items-center gap-3.5 shadow-2xl max-w-sm ${
              activeToast.type === 'goal' 
                ? 'border-sport-accent/40 shadow-sport-accent/5' 
                : 'border-yellow-400/40 shadow-yellow-400/5'
            }`}
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-black flex-shrink-0 font-bold ${
              activeToast.type === 'goal' ? 'bg-sport-accent' : 'bg-yellow-400'
            }`}>
              {activeToast.type === 'goal' ? '⚽' : '🏁'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-extrabold text-sport-secondary uppercase tracking-widest leading-none">
                {activeToast.type === 'goal' ? 'LIVE GOAL ALERT' : 'TOURNAMENT KICKOFF'}
              </span>
              <p className="text-xs font-bold text-white mt-1 leading-normal break-words pr-2">
                {activeToast.message}
              </p>
            </div>
            <button 
              onClick={() => setActiveToast(null)} 
              className="text-sport-secondary hover:text-white transition-colors ml-auto p-1 cursor-pointer flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Spotlight Search modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        allChannels={channelsData}
        selectedChannel={selectedChannel}
        onSelectChannel={handleSelectChannel}
        favorites={favorites}
        recentChannels={recentWatchedChannels}
      />
    </div>
  );
}

export default App;
