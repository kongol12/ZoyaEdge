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
    stopLoss: '',
    takeProfit: '',
    lotSize: '',
    pnl: '',
    strategy: 'Breakout',
    emotion: '😐' as '😐' | '😰' | '🔥',
    session: 'London' as 'London' | 'NY' | 'Asia',
    date: new Date().toISOString().slice(0, 16),
  });

  const [isManualPnl, setIsManualPnl] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToStrategies(user.uid, (data) => {
      setCustomStrategies(data);
    });
    return () => unsubscribe();
  }, [user]);

  const getAssetSettings = (pair: string) => {
    const p = pair.toUpperCase();
    // Indices & Crypto
    if (
      p.includes('NAS') || p.includes('US30') || p.includes('GER') || 
      p.includes('DAX') || p.includes('SPX') || p.includes('BTC') || 
      p.includes('ETH') || p.includes('NDX') || p.includes('US100') ||
      p.includes('US500') || p.includes('UK100')
    ) return { multiplier: 1, pipFactor: 1, label: 'Points' };

    // Metals
    if (p.includes('XAU') || p.includes('GOLD')) return { multiplier: 100, pipFactor: 1, label: 'Points' };
    if (p.includes('XAG') || p.includes('SILVER')) return { multiplier: 5000, pipFactor: 1, label: 'Points' };
    
    // Forex JPY pairs
    if (p.includes('JPY')) return { multiplier: 1000, pipFactor: 100, label: 'Pips' };
    
    // Standard Forex
    return { multiplier: 100000, pipFactor: 10000, label: 'Pips' };
  };

  const [stats, setStats] = useState({ pips: 0, label: 'Pips', risk: 0, reward: 0, rr: 0 });

  useEffect(() => {
    const entry = parseFloat(formData.entryPrice);
    const exit = parseFloat(formData.exitPrice);
    const sl = parseFloat(formData.stopLoss);
    const tp = parseFloat(formData.takeProfit);
    const lots = parseFloat(formData.lotSize);
    
    if (!isNaN(entry)) {
      const settings = getAssetSettings(formData.pair);
      let pips = 0;
      let riskVal = 0;
      let rewardVal = 0;
      let rrRatio = 0;

      // Exit/PnL Calc
      if (!isNaN(exit)) {
        const diff = formData.direction === 'buy' ? exit - entry : entry - exit;
        pips = parseFloat((diff * settings.pipFactor).toFixed(1));
        
        if (!isManualPnl && !isNaN(lots)) {
          const calculatedPnl = (diff * lots * settings.multiplier).toFixed(2);
          setFormData(prev => ({ ...prev, pnl: calculatedPnl }));
        }
      }

      // Risk Calc
      if (!isNaN(sl)) {
        const riskDiff = formData.direction === 'buy' ? entry - sl : sl - entry;
        riskVal = Math.abs(riskDiff * (isNaN(lots) ? 1 : lots) * settings.multiplier);
      }

      // Reward Calc
      if (!isNaN(tp)) {
        const rewardDiff = formData.direction === 'buy' ? tp - entry : entry - tp;
        rewardVal = Math.abs(rewardDiff * (isNaN(lots) ? 1 : lots) * settings.multiplier);
      }

      // RR Calc
      if (riskVal > 0 && rewardVal > 0) {
        rrRatio = parseFloat((rewardVal / riskVal).toFixed(2));
      }
      
      setStats({
        pips,
        label: settings.label,
        risk: parseFloat(riskVal.toFixed(2)),
        reward: parseFloat(rewardVal.toFixed(2)),
        rr: rrRatio
      });
    }
  }, [formData.entryPrice, formData.exitPrice, formData.stopLoss, formData.takeProfit, formData.lotSize, formData.direction, formData.pair, isManualPnl]);

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
        stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined,
        takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
        lotSize: parseFloat(formData.lotSize),
        pnl: finalPnl,
        strategy: formData.strategy,
        emotion: formData.emotion,
        session: formData.session,
        date: new Date(formData.date),
        rr: stats.rr || 0,
        risk: stats.risk || 0,
        reward: stats.reward || 0,
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
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.exitPrice}</label>
            {!isNaN(stats.pips) && (
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                stats.pips >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
              )}>
                {stats.pips} {stats.label}
              </span>
            )}
          </div>
          <input
            required
            type="number"
            step="0.00001"
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
            value={formData.exitPrice}
            onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
          />
        </div>

        <div className="space-y-4 col-span-1 md:col-span-2 bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Gestion du Risque</span>
              <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
            </div>
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, exitPrice: formData.entryPrice });
                setIsManualPnl(false);
              }}
              className="ml-4 px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 hover:bg-zoya-red hover:text-white transition-all"
            >
              {t.dashboard.be}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.stopLoss}</label>
              <input
                type="number"
                step="0.00001"
                placeholder="Entry - Risk"
                className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
                value={formData.stopLoss}
                onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.dashboard.takeProfit}</label>
              <input
                type="number"
                step="0.00001"
                placeholder="Entry + Target"
                className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-900 dark:text-white transition-all duration-300"
                value={formData.takeProfit}
                onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
              />
            </div>
          </div>

          {(stats.risk > 0 || stats.reward > 0) && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Risk $</p>
                <p className="text-sm font-black text-rose-500">-${stats.risk}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Reward $</p>
                <p className="text-sm font-black text-emerald-500">+${stats.reward}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase">{t.dashboard.rr}</p>
                <p className="text-sm font-black text-zoya-red">1:{stats.rr}</p>
              </div>
            </div>
          )}
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
            onChange={(e) => {
              setFormData({ ...formData, pnl: e.target.value });
              setIsManualPnl(e.target.value !== '');
            }}
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
