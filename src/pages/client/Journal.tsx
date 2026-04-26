import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book, Plus, Filter, History, Calendar, LayoutGrid, List, Sparkles } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { subscribeToTrades, subscribeToNotebook, Trade, NotebookEntry } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import TradeExplorer from '../../components/organisms/client/TradeExplorer';
import TradeDetail from '../../components/organisms/client/TradeDetail';
import NotebookEntryModal from '../../components/organisms/client/NotebookEntryModal';
import { useFilteredTrades } from '../../hooks/useFilteredTrades';
import { Button } from '../../components/atoms/Button';
import { Link } from 'react-router';

export default function Journal() {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const unsubscribeTrades = subscribeToTrades(user.uid, (data) => {
      setTrades(data);
      setLoading(false);
    });

    const unsubscribeNotebook = subscribeToNotebook(user.uid, (data) => {
      setNotebookEntries(data);
    });

    return () => {
      unsubscribeTrades();
      unsubscribeNotebook();
    };
  }, [user]);

  const { 
    filters, 
    setFilters, 
    filteredTrades, 
    uniqueMonths, 
    uniqueStrategies, 
    uniquePairs, 
    uniqueSessions,
    uniquePlatforms 
  } = useFilteredTrades(trades);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-zoya-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 pb-12">
      <AnimatePresence mode="wait">
        {!selectedTrade ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="p-3 bg-zoya-red/10 rounded-2xl">
                    <Book className="text-zoya-red" size={28} />
                  </div>
                  {t.common.journal}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm max-w-xl">
                  {(t.common as any).journalDesc}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button 
                  onClick={() => setIsNotebookOpen(true)}
                  variant="outline"
                  className="rounded-2xl h-12 px-6 border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center gap-2 group transition-all"
                >
                  <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                  {language === 'fr' ? 'Journal de Bord' : 'Notebook'}
                </Button>

                <Link to="/add">
                  <Button className="rounded-2xl h-12 px-6 shadow-lg shadow-zoya-red/20 flex items-center gap-2">
                    <Plus size={18} />
                    {t.common.addTrade}
                  </Button>
                </Link>
                
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3 h-12 bg-white dark:bg-gray-800 border rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm",
                    showFilters ? "border-zoya-red text-zoya-red" : "border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200"
                  )}
                >
                  <Filter size={14} className={showFilters ? "text-zoya-red shadow-[0_0_10px_rgba(235,59,90,0.3)]" : "text-gray-400"} />
                  {showFilters ? 'Fermer' : 'Filtres'}
                </button>
              </div>
            </div>

            {/* Filter Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-400">Période</label>
                      <select 
                        value={filters.dateRange}
                        onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-transparent rounded-xl text-xs font-bold outline-none focus:border-zoya-red/30 transition-all"
                      >
                        <option value="all">Tout</option>
                        {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-400">Pair</label>
                      <select 
                        value={filters.pair}
                        onChange={(e) => setFilters({...filters, pair: e.target.value})}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-transparent rounded-xl text-xs font-bold outline-none focus:border-zoya-red/30 transition-all"
                      >
                        <option value="all">Tout</option>
                        {uniquePairs.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-400">Stratégie</label>
                      <select 
                        value={filters.strategy}
                        onChange={(e) => setFilters({...filters, strategy: e.target.value})}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-transparent rounded-xl text-xs font-bold outline-none focus:border-zoya-red/30 transition-all"
                      >
                        <option value="all">Tout</option>
                        {uniqueStrategies.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-400">Session</label>
                      <select 
                        value={filters.session}
                        onChange={(e) => setFilters({...filters, session: e.target.value})}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-transparent rounded-xl text-xs font-bold outline-none focus:border-zoya-red/30 transition-all"
                      >
                        <option value="all">Tout</option>
                        {uniqueSessions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-400">Platform</label>
                      <select 
                        value={filters.platform}
                        onChange={(e) => setFilters({...filters, platform: e.target.value})}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-transparent rounded-xl text-xs font-bold outline-none focus:border-zoya-red/30 transition-all"
                      >
                        <option value="all">Tout</option>
                        {uniquePlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Content: Trade Explorer (Calendar by Default) */}
            <TradeExplorer 
              trades={filteredTrades} 
              notebookEntries={notebookEntries}
              defaultView="calendar" 
              onTradeClick={(trade) => setSelectedTrade(trade)}
            />
          </motion.div>
        ) : (
          <TradeDetail 
            trade={selectedTrade} 
            allTrades={trades}
            onBack={() => setSelectedTrade(null)} 
          />
        )}
      </AnimatePresence>

      <NotebookEntryModal 
        isOpen={isNotebookOpen} 
        onClose={() => setIsNotebookOpen(false)} 
      />
    </div>
  );
}
