import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Info, ExternalLink, Globe, History } from 'lucide-react';
import { useTranslation } from '@shared/lib/i18n';
import EconomicCalendarWidget from '@shared/components/calendar/EconomicCalendarWidget';
import TradeExplorer from '@shared/components/organisms/client/TradeExplorer';
import { subscribeToTrades, Trade } from '@shared/lib/db';
import { auth } from '@shared/lib/firebase';
import { cn } from '@shared/lib/utils';

export default function Calendar() {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'economic' | 'performance'>('economic');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) {
        return subscribeToTrades(user.uid, (data) => {
          setTrades(data);
          setLoading(false);
        });
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="w-full space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-xl">
              <CalendarIcon size={24} />
            </div>
            <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">{t.common.calendar}</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl">
            {activeTab === 'economic' 
              ? (language === 'fr' 
                 ? 'Suivez les événements économiques mondiaux en temps réel.' 
                 : 'Track global economic events in real-time.')
              : (language === 'fr'
                 ? 'Analysez vos performances de trading jour par jour.'
                 : 'Analyze your trading performance day by day.')
            }
          </p>
        </div>
        
        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <button 
            onClick={() => setActiveTab('economic')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'economic' ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            )}
          >
            <Globe size={14} />
            {language === 'fr' ? 'Économique' : 'Economic'}
          </button>
          <button 
            onClick={() => setActiveTab('performance')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'performance' ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            )}
          >
            <History size={14} />
            {language === 'fr' ? 'Performance' : 'Performance'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="zoya-card overflow-hidden min-h-[600px] p-1 shadow-2xl"
            >
              <div className="w-full h-full rounded-2xl overflow-hidden">
                {activeTab === 'economic' ? (
                  <div className="h-[800px]">
                    <EconomicCalendarWidget />
                  </div>
                ) : (
                  <div className="p-4 sm:p-6 bg-gray-50/50 dark:bg-gray-900/50">
                    {loading ? (
                      <div className="flex items-center justify-center p-20">
                        <div className="w-8 h-8 border-2 border-zoya-red border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <TradeExplorer 
                        trades={trades} 
                        defaultView="calendar" 
                      />
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="zoya-card p-6 bg-zoya-red text-white border-none"
          >
            <div className="flex items-center gap-2 mb-4">
              <Info size={20} />
              <h3 className="font-poppins font-bold">Trading Tip</h3>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">
              {language === 'fr'
                ? "Évitez de prendre des positions 15 minutes avant et après les annonces à fort impact (rouges). La volatilité peut entraîner des slippages importants."
                : "Avoid taking positions 15 minutes before and after high-impact (red) announcements. Volatility can lead to significant slippage."}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="zoya-card p-6"
          >
            <h3 className="font-poppins font-bold text-gray-900 dark:text-white mb-4">Impact Levels</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">High Impact</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Medium Impact</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Low Impact</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="zoya-card p-6 border-dashed"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {language === 'fr'
                ? "Données fournies par Tradays (MQL5). Les horaires sont automatiquement ajustés à votre fuseau horaire local."
                : "Data provided by Tradays (MQL5). Times are automatically adjusted to your local time zone."}
            </p>
            <a 
              href="https://www.tradays.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-zoya-red text-sm font-bold hover:underline"
            >
              Tradays.com <ExternalLink size={14} />
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
