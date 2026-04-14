import React from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, Info, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import EconomicCalendarWidget from '../../components/calendar/EconomicCalendarWidget';

export default function Calendar() {
  const { t, language } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-xl">
              <CalendarIcon size={24} />
            </div>
            <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">{t.common.calendar}</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl">
            {language === 'fr' 
              ? 'Suivez les événements économiques mondiaux en temps réel pour anticiper la volatilité des marchés.' 
              : 'Track global economic events in real-time to anticipate market volatility.'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold border border-emerald-100 dark:border-emerald-800/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {language === 'fr' ? 'Temps Réel' : 'Real-Time'}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Calendar Container */}
        <div className="lg:col-span-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="zoya-card overflow-hidden min-h-[800px] p-1"
          >
            <div className="w-full h-[800px] rounded-2xl overflow-hidden">
              <EconomicCalendarWidget />
            </div>
          </motion.div>
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
