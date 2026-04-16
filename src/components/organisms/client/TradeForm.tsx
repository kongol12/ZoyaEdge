import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../lib/auth';
import { addTrade, subscribeToStrategies, Strategy } from '../../../lib/db';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';

export default function TradeForm() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [customStrategies, setCustomStrategies] = useState<Strategy[]>([]);

  const [formData, setFormData] = useState({
    pair: 'EURUSD',
    direction: 'buy' as 'buy' | 'sell',
    entryPrice: '',
    exitPrice: '',
    lotSize: '',
    pnl: '',
    strategy: 'Breakout',
    emotion: '😐' as '😐' | '😰' | '🔥',
    session: 'London' as 'London' | 'NY' | 'Asia',
    date: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToStrategies(user.uid, (data) => {
      setCustomStrategies(data);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const entry = parseFloat(formData.entryPrice);
    const exit = parseFloat(formData.exitPrice);
    const lots = parseFloat(formData.lotSize);
    
    if (!isNaN(entry) && !isNaN(exit) && !isNaN(lots)) {
      const diff = formData.direction === 'buy' ? exit - entry : entry - exit;
      // Standard Forex lot size is 100,000. 
      // For indices like NAS100/US30, it's often different, but we'll use a heuristic or just 100k for now as a base.
      // Better: let's detect if it's a gold/index pair.
      let multiplier = 100000;
      const pair = formData.pair.toUpperCase();
      if (pair.includes('XAU') || pair.includes('GOLD')) multiplier = 100;
      if (pair.includes('NAS') || pair.includes('US30') || pair.includes('GER40') || pair.includes('SPX')) multiplier = 1;
      if (pair.includes('JPY')) multiplier = 1000;

      const calculatedPnl = (diff * lots * multiplier).toFixed(2);
      setFormData(prev => ({ ...prev, pnl: calculatedPnl }));
    }
  }, [formData.entryPrice, formData.exitPrice, formData.lotSize, formData.direction, formData.pair]);

  const quickPairs = ['EURUSD', 'NAS100', 'XAUUSD', 'US30'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const finalPnl = parseFloat(formData.pnl);

      await addTrade(user.uid, {
        pair: formData.pair.toUpperCase(),
        direction: formData.direction,
        entryPrice: parseFloat(formData.entryPrice),
        exitPrice: parseFloat(formData.exitPrice),
        lotSize: parseFloat(formData.lotSize),
        pnl: finalPnl,
        strategy: formData.strategy,
        emotion: formData.emotion,
        session: formData.session,
        date: new Date(formData.date),
      });

      setShowSuccess(true);
      setTimeout(() => navigate('/'), 1200);
    } catch (error) {
      console.error("Error adding trade", error);
      alert("Failed to add trade");
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 p-12 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg text-center space-y-4"
      >
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">{t.dashboard.tradeSaved}</h2>
        <p className="text-gray-500 dark:text-gray-400">{t.dashboard.journalUpdated}</p>
      </motion.div>
    );
  }

  return (
    <motion.form 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit} 
      className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6"
    >
      {/* Quick Pair Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.frequentPairs}</label>
        <div className="flex flex-wrap gap-2">
          {quickPairs.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setFormData({ ...formData, pair: p })}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                formData.pair === p 
                  ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" 
                  : "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      
      {/* Direction Toggle */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.direction}</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, direction: 'buy' })}
            className={cn(
              "py-3 rounded-2xl font-poppins font-black text-lg transition-all border-2",
              formData.direction === 'buy' 
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-lg shadow-emerald-500/10" 
                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-emerald-200"
            )}
          >
            {t.dashboard.buy.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, direction: 'sell' })}
            className={cn(
              "py-3 rounded-2xl font-poppins font-black text-lg transition-all border-2",
              formData.direction === 'sell' 
                ? "bg-rose-50 dark:bg-rose-900/20 border-rose-500 text-rose-700 dark:text-rose-400 shadow-lg shadow-rose-500/10" 
                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-rose-200"
            )}
          >
            {t.dashboard.sell.toUpperCase()}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.pair} (ex: EURUSD)</label>
          <input
            required
            type="text"
            placeholder="EURUSD"
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red focus:border-transparent outline-none uppercase text-gray-900 dark:text-white transition-all duration-300"
            value={formData.pair}
            onChange={(e) => setFormData({ ...formData, pair: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.dateTime}</label>
          <input
            required
            type="datetime-local"
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.entryPrice}</label>
          <input
            required
            type="number"
            step="0.00001"
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
            value={formData.entryPrice}
            onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.exitPrice}</label>
          <input
            required
            type="number"
            step="0.00001"
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
            value={formData.exitPrice}
            onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.lotSize}</label>
          <input
            required
            type="number"
            step="0.01"
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
            value={formData.lotSize}
            onChange={(e) => setFormData({ ...formData, lotSize: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.pnl} ($)</label>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Calculé automatiquement</span>
          </div>
          <input
            type="number"
            step="0.01"
            placeholder={t.dashboard.pnlPlaceholder}
            className="w-full p-3 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
            value={formData.pnl}
            onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.strategy}</label>
          <select
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
            value={formData.strategy}
            onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
          >
            <optgroup label={t.dashboard.default}>
              <option value="Breakout">Breakout</option>
              <option value="Reversal">Reversal</option>
              <option value="Trend Following">Trend Following</option>
              <option value="Scalping">Scalping</option>
              <option value="Other">{t.dashboard.other}</option>
            </optgroup>
            {customStrategies.length > 0 && (
              <optgroup label={t.dashboard.myStrategies}>
                {customStrategies.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.session}</label>
          <select
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
            value={formData.session}
            onChange={(e) => setFormData({ ...formData, session: e.target.value as any })}
          >
            <option value="London">{t.dashboard.london}</option>
            <option value="NY">{t.dashboard.newYork}</option>
            <option value="Asia">{t.dashboard.asia}</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.emotion}</label>
        <div className="flex gap-4">
          {(['😐', '😰', '🔥'] as const).map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setFormData({ ...formData, emotion: emoji })}
              className={cn(
                "text-4xl p-4 rounded-2xl transition-all hover:scale-110",
                formData.emotion === emoji ? "bg-gray-100 dark:bg-gray-900 ring-2 ring-zoya-red shadow-lg" : "bg-gray-50 dark:bg-gray-900/50 grayscale opacity-50"
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-zoya-red text-white font-poppins font-bold py-4 rounded-2xl hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50 active:scale-[0.98]"
      >
        {loading ? t.common.saving : t.dashboard.saveTrade}
      </button>
    </motion.form>
  );
}
