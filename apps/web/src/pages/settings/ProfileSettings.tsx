import React, { useEffect, useState } from 'react';
import { useAuth, UserProfile } from '@shared/lib/auth';
import { useTranslation } from '@shared/lib/i18n';
import { db } from '@shared/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Trade, hardDeleteAllTrades, hardDeleteTrades, subscribeToTrades } from '@shared/lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { User, Save, Loader2, Languages, Trash2, AlertTriangle, Filter, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { COUNTRIES } from '@shared/lib/countries';

export default function ProfileSettings() {
  const { user, updateProfile } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [filterPair, setFilterPair] = useState<string>('all');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');
  const [isBulkMode, setIsBulkMode] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function fetchProfile() {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();

    const unsubscribe = subscribeToTrades(user.uid, (data) => {
      setTrades(data);
    });
    return () => unsubscribe();
  }, [user]);

  const pairs = Array.from(new Set(trades.map(t => t.pair))).sort();
  const strategies = Array.from(new Set(trades.map(t => t.strategy))).sort();

  const filteredTrades = trades.filter(t => {
    const matchPair = filterPair === 'all' || t.pair === filterPair;
    const matchStrategy = filterStrategy === 'all' || t.strategy === filterStrategy;
    return matchPair && matchStrategy;
  });

  const handleDeleteAllTrades = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await hardDeleteAllTrades(user.uid);
      setMessage({ type: 'success', text: 'Tous les trades ont été supprimés de façon permanente.' });
      setShowConfirmDelete(false);
    } catch (error) {
      console.error("Error deleting trades:", error);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression des trades.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectedDelete = async () => {
    if (!user || selectedTrades.length === 0) return;
    setDeleting(true);
    try {
      await hardDeleteTrades(user.uid, selectedTrades);
      setMessage({ type: 'success', text: `${selectedTrades.length} trades ont été supprimés de façon permanente.` });
      setSelectedTrades([]);
      setIsBulkMode(false);
    } catch (error) {
      console.error("Error deleting selected trades:", error);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression sélective.' });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTrades.length === filteredTrades.length) {
      setSelectedTrades([]);
    } else {
      setSelectedTrades(filteredTrades.map(t => t.id!));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(profile);
      setMessage({ type: 'success', text: t.common.save + ' success!' });
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: 'Error updating profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zoya-red" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Language Selection */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-2xl">
            <Languages size={24} />
          </div>
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">{t.settings.language}</h2>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setLanguage('fr')}
            className={`flex-1 py-3 rounded-2xl font-poppins font-bold transition-all shadow-lg ${
              language === 'fr' ? 'bg-zoya-red text-white shadow-zoya-red/20' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Français
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`flex-1 py-3 rounded-2xl font-poppins font-bold transition-all shadow-lg ${
              language === 'en' ? 'bg-zoya-red text-white shadow-zoya-red/20' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            English
          </button>
        </div>
      </motion.section>

      {/* Profile Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-2xl">
            <User size={24} />
          </div>
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">{t.settings.profile}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.settings.displayName}</label>
              <input
                type="text"
                value={profile?.displayName || ''}
                onChange={e => setProfile(prev => prev ? { ...prev, displayName: e.target.value } : null)}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pays</label>
              <select
                value={profile?.country || ''}
                onChange={e => setProfile(prev => prev ? { ...prev, country: e.target.value } : null)}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all appearance-none"
              >
                <option value="">Sélectionner...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Téléphone</label>
              <input
                type="text"
                value={profile?.phone || ''}
                onChange={e => setProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                placeholder="+33 6..."
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
              />
            </div>
          </div>

          <h3 className="text-lg font-poppins font-bold text-gray-900 dark:text-white mt-8 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Préférences de Trading</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Style de Trading</label>
              <select
                value={profile?.tradingStyle || ''}
                onChange={e => setProfile(prev => prev ? { ...prev, tradingStyle: e.target.value } : null)}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all appearance-none"
              >
                <option value="">Sélectionner...</option>
                <option value="Scalping">Scalping (Court terme)</option>
                <option value="Day Trading">Day Trading (Intraday)</option>
                <option value="Swing Trading">Swing Trading (Moyen terme)</option>
                <option value="Position Trading">Position Trading (Long terme)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Niveau d'expérience</label>
              <select
                value={profile?.experienceLevel || ''}
                onChange={e => setProfile(prev => prev ? { ...prev, experienceLevel: e.target.value as any } : null)}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all appearance-none"
              >
                <option value="beginner">Débutant (- de 1 an)</option>
                <option value="intermediate">Intermédiaire (1 à 3 ans)</option>
                <option value="advanced">Avancé (+ de 3 ans)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Taille du capital</label>
              <input
                type="text"
                value={profile?.capitalSize || ''}
                onChange={e => setProfile(prev => prev ? { ...prev, capitalSize: e.target.value } : null)}
                placeholder="Ex: 5000"
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
              />
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-2xl text-sm font-medium ${
              message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-zoya-red text-white py-3 rounded-2xl font-poppins font-bold hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
            {saving ? t.common.saving : t.common.save}
          </button>
        </form>
      </motion.section>

      {/* Danger Zone */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-rose-50 dark:bg-rose-950/20 rounded-3xl p-6 shadow-lg border border-rose-100 dark:border-rose-900/30"
      >
        <div className="flex items-center gap-3 mb-6 text-rose-600 dark:text-rose-400">
          <Trash2 size={24} />
          <h2 className="text-xl font-poppins font-black">Zone de Danger</h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-rose-100 dark:border-rose-900/30">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
              <AlertTriangle className="text-rose-500" size={16} />
              Gestion des Données
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ces actions suppriment définitivement les trades de la base de données. Cette action est irréversible.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-rose-100 dark:border-rose-900/30 overflow-hidden">
            <button
              onClick={() => setIsBulkMode(!isBulkMode)}
              className="w-full px-4 py-3 flex items-center justify-between font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all"
            >
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-rose-500" />
                <span>Filtrer et Supprimer par Sélection</span>
                {trades.length > 0 && (
                  <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] px-2 py-0.5 rounded-full">
                    {trades.length} trades
                  </span>
                )}
              </div>
              {isBulkMode ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            <AnimatePresence>
              {isBulkMode && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700"
                >
                  <div className="pt-4 space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Paire</label>
                        <select
                          value={filterPair}
                          onChange={(e) => setFilterPair(e.target.value)}
                          className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs outline-none"
                        >
                          <option value="all">Toutes les paires</option>
                          {pairs.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Stratégie</label>
                        <select
                          value={filterStrategy}
                          onChange={(e) => setFilterStrategy(e.target.value)}
                          className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs outline-none"
                        >
                          <option value="all">Toutes les stratégies</option>
                          {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Selection Controls */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={toggleSelectAll}
                        className="text-xs font-bold text-zoya-red hover:underline"
                      >
                        {selectedTrades.length === filteredTrades.length ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                      <span className="text-[10px] font-bold text-gray-400">
                        {selectedTrades.length} sélectionné(s) sur {filteredTrades.length}
                      </span>
                    </div>

                    {/* Trade List Scrollable */}
                    <div className="max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                      {filteredTrades.length > 0 ? (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {filteredTrades.map(t => (
                            <label
                              key={t.id}
                              className="flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer group"
                            >
                              <div 
                                className={cn(
                                  "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                                  selectedTrades.includes(t.id!) 
                                    ? "bg-rose-500 border-rose-500 text-white" 
                                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 group-hover:border-rose-300"
                                )}
                              >
                                {selectedTrades.includes(t.id!) && <Check size={14} strokeWidth={4} />}
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={selectedTrades.includes(t.id!)}
                                  onChange={() => {
                                    if (selectedTrades.includes(t.id!)) {
                                      setSelectedTrades(selectedTrades.filter(id => id !== t.id));
                                    } else {
                                      setSelectedTrades([...selectedTrades, t.id!]);
                                    }
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-gray-900 dark:text-white">{t.pair}</span>
                                  <span className={cn(
                                    "text-[10px] font-bold",
                                    t.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                                  )}>
                                    {t.pnl >= 0 ? '+' : ''}{t.pnl}$
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
                                  <span>{t.strategy}</span>
                                  <span>{format(t.date, 'dd MMM yyyy', { locale: fr })}</span>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-gray-400 italic text-sm">
                          Aucun trade ne correspond aux filtres.
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleSelectedDelete}
                        disabled={deleting || selectedTrades.length === 0}
                        className="flex-1 py-3 rounded-2xl font-poppins font-bold bg-rose-600 text-white shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={16} />}
                        Supprimer la sélection
                      </button>
                      <button
                        onClick={() => {
                          setIsBulkMode(false);
                          setSelectedTrades([]);
                        }}
                        className="px-4 py-3 rounded-2xl font-poppins font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-px bg-rose-100 dark:bg-rose-900/30 my-2" />

          {!showConfirmDelete ? (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="w-full py-3 rounded-2xl font-poppins font-bold bg-white dark:bg-gray-800 text-rose-600 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/50 transition-all"
            >
              Écraser absolument tous les trades
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold text-rose-500 text-center uppercase tracking-widest">Confirmer la suppression totale ?</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-2xl font-poppins font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAllTrades}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-2xl font-poppins font-bold bg-rose-600 text-white shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={16} />}
                  Tout supprimer définitivement
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
