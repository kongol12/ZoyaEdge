import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { addStrategy, subscribeToStrategies, deleteStrategy, Strategy } from '../../lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Save, Loader2, LayoutGrid, ListChecks, Activity, Info, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function StrategyBuilder() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    marketConditions: [''],
    entryRules: [''],
    exitRules: [''],
    indicators: ['']
  });

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToStrategies(user.uid, (data) => {
      setStrategies(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddItem = (field: keyof typeof formData) => {
    if (Array.isArray(formData[field])) {
      setFormData({
        ...formData,
        [field]: [...(formData[field] as string[]), '']
      });
    }
  };

  const handleRemoveItem = (field: keyof typeof formData, index: number) => {
    if (Array.isArray(formData[field])) {
      const newList = [...(formData[field] as string[])];
      newList.splice(index, 1);
      setFormData({ ...formData, [field]: newList });
    }
  };

  const handleItemChange = (field: keyof typeof formData, index: number, value: string) => {
    if (Array.isArray(formData[field])) {
      const newList = [...(formData[field] as string[])];
      newList[index] = value;
      setFormData({ ...formData, [field]: newList });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await addStrategy(user.uid, {
        ...formData,
        marketConditions: formData.marketConditions.filter(i => i.trim()),
        entryRules: formData.entryRules.filter(i => i.trim()),
        exitRules: formData.exitRules.filter(i => i.trim()),
        indicators: formData.indicators.filter(i => i.trim()),
      });
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        marketConditions: [''],
        entryRules: [''],
        exitRules: [''],
        indicators: ['']
      });
    } catch (error) {
      console.error("Error saving strategy", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !window.confirm('Are you sure?')) return;
    try {
      await deleteStrategy(user.uid, id);
    } catch (error) {
      console.error("Error deleting strategy", error);
    }
  };

  return (
    <div className="w-full space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">{t.strategies.title}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t.strategies.subtitle}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-zoya-red text-white px-6 py-3 rounded-2xl font-poppins font-bold hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 active:scale-[0.98]"
        >
          <Plus size={20} />
          {t.strategies.add}
        </button>
      </header>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 space-y-8 overflow-hidden"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">{t.strategies.name}</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
                  placeholder="ex: Breakout H1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">{t.strategies.description}</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
                  placeholder="Brief description..."
                />
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Market Conditions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zoya-red font-poppins font-bold">
                    <Activity size={18} />
                    {t.strategies.marketConditions}
                  </div>
                  <button type="button" onClick={() => handleAddItem('marketConditions')} className="text-zoya-red hover:text-zoya-red-dark transition-colors">
                    <Plus size={18} />
                  </button>
                </div>
                {formData.marketConditions.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={e => handleItemChange('marketConditions', idx, e.target.value)}
                      className="flex-1 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none text-sm transition-all"
                      placeholder="ex: Trend Bullish H4"
                    />
                    <button type="button" onClick={() => handleRemoveItem('marketConditions', idx)} className="text-gray-300 dark:text-gray-600 hover:text-zoya-red transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Indicators */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-poppins font-bold">
                    <LayoutGrid size={18} />
                    {t.strategies.indicators}
                  </div>
                  <button type="button" onClick={() => handleAddItem('indicators')} className="text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
                    <Plus size={18} />
                  </button>
                </div>
                {formData.indicators.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={e => handleItemChange('indicators', idx, e.target.value)}
                      className="flex-1 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none text-sm transition-all"
                      placeholder="ex: EMA 20, RSI < 30"
                    />
                    <button type="button" onClick={() => handleRemoveItem('indicators', idx)} className="text-gray-300 dark:text-gray-600 hover:text-zoya-red transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Entry Rules */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-poppins font-bold">
                    <ListChecks size={18} />
                    {t.strategies.entryRules}
                  </div>
                  <button type="button" onClick={() => handleAddItem('entryRules')} className="text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                    <Plus size={18} />
                  </button>
                </div>
                {formData.entryRules.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={e => handleItemChange('entryRules', idx, e.target.value)}
                      className="flex-1 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none text-sm transition-all"
                      placeholder="ex: Candle close above resistance"
                    />
                    <button type="button" onClick={() => handleRemoveItem('entryRules', idx)} className="text-gray-300 dark:text-gray-600 hover:text-zoya-red transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Exit Rules */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zoya-red font-poppins font-bold">
                    <LogOut size={18} />
                    {t.strategies.exitRules}
                  </div>
                  <button type="button" onClick={() => handleAddItem('exitRules')} className="text-zoya-red hover:text-zoya-red-dark transition-colors">
                    <Plus size={18} />
                  </button>
                </div>
                {formData.exitRules.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={e => handleItemChange('exitRules', idx, e.target.value)}
                      className="flex-1 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none text-sm transition-all"
                      placeholder="ex: TP at next supply zone"
                    />
                    <button type="button" onClick={() => handleRemoveItem('exitRules', idx)} className="text-gray-300 dark:text-gray-600 hover:text-zoya-red transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-zoya-red text-white py-4 rounded-2xl font-poppins font-bold hover:bg-zoya-red-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-zoya-red/20 active:scale-[0.98]"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {t.strategies.save}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid gap-6 md:grid-cols-2">
        {strategies.length === 0 && !loading && (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-dashed border-gray-100 dark:border-gray-700 shadow-lg">
            <Info className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{t.strategies.noStrategies}</p>
          </div>
        )}

        {strategies.map((strategy) => (
          <motion.div
            key={strategy.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 space-y-4 relative group hover:border-zoya-red/20 transition-all"
          >
            <button
              onClick={() => strategy.id && handleDelete(strategy.id)}
              className="absolute top-4 right-4 p-2 text-gray-300 dark:text-gray-600 hover:text-zoya-red transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={18} />
            </button>

            <div>
              <h3 className="text-xl font-poppins font-black text-gray-900 dark:text-white">{strategy.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{strategy.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {strategy.marketConditions.map((c, i) => (
                <span key={i} className="px-2 py-1 bg-zoya-red-accent text-zoya-red rounded-lg text-xs font-bold">{c}</span>
              ))}
              {strategy.indicators.map((c, i) => (
                <span key={i} className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold">{c}</span>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-50 dark:border-gray-700/50">
              <div className="text-xs font-poppins font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.strategies.entryRules}</div>
              <ul className="space-y-1">
                {strategy.entryRules.map((r, i) => (
                  <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
