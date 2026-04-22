import React, { useState } from 'react';
import { X, Shield, CreditCard, User as UserIcon, Mail, Crown, Save, Trash2, AlertTriangle, Send, Bell, Coins, Zap, BarChart3, Gem, Clock, Bitcoin, Activity, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { Trade, subscribeToTrades, sendNotificationToUser } from '../../lib/db';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface UserDetailModalProps {
  user: UserProfile & { id: string };
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
}

export default function UserDetailModal({ user, isOpen, onClose, onUpdate, onDelete }: UserDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'trades' | 'notif'>('profile');
  const [formData, setFormData] = useState({
    displayName: user.displayName || '',
    email: user.email || '',
    role: user.role || 'user',
    subscription: user.subscription || 'free',
    aiCredits: user.aiCredits || 0,
    bypassMaintenance: user.bypassMaintenance || false,
  });
  const [saving, setSaving] = useState(false);
  const [notifData, setNotifData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'error' | 'success'
  });
  const [sendingNotif, setSendingNotif] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);

  React.useEffect(() => {
    if (isOpen && activeTab === 'trades') {
      const unsubscribe = subscribeToTrades(user.id, (data) => {
        setTrades(data);
      }, true); // includeHidden = true for admins
      return () => unsubscribe();
    }
  }, [isOpen, activeTab, user.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdate(user.id, formData);
      onClose();
    } catch (error) {
      console.error("Error updating user:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSendNotif = async () => {
    if (!notifData.title || !notifData.message) return;
    setSendingNotif(true);
    try {
      await sendNotificationToUser(user.id, notifData);
      setNotifData({ title: '', message: '', type: 'info' });
      toast.success("Notification envoyée avec succès !");
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Erreur lors de l'envoi.");
    } finally {
      setSendingNotif(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-[40px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 my-8"
          >
            <div className="p-8 space-y-8">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-3xl flex items-center justify-center text-gray-400">
                    <UserIcon size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Gérer le Profil</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">ID: {user.id}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900/50 p-1 rounded-2xl">
                {(['profile', 'trades', 'notif'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                      activeTab === tab 
                        ? "bg-white dark:bg-gray-800 text-zoya-red shadow-sm" 
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    )}
                  >
                    {tab === 'profile' ? 'Profil' : tab === 'trades' ? 'Trades' : 'Notif'}
                  </button>
                ))}
              </div>

              <div className="space-y-8">
                {activeTab === 'profile' && (
                  <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <UserIcon size={14} /> Informations de Base
                      </h3>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Nom d'affichage</label>
                        <input
                          type="text"
                          value={formData.displayName}
                          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          disabled
                          className="w-full bg-gray-100 dark:bg-gray-900/50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-400 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Security & Access */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Shield size={14} /> Sécurité & Accès
                      </h3>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Rôle Système</label>
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                        >
                          <option value="user">Client Standard</option>
                          <option value="agent">Agent Support</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Plan d'Abonnement</label>
                        <select
                          value={formData.subscription}
                          onChange={(e) => setFormData({ ...formData, subscription: e.target.value as any })}
                          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                        >
                          <option value="free">Free Plan</option>
                          <option value="pro">Pro Plan</option>
                          <option value="premium">Premium Plan</option>
                        </select>
                      </div>
                    </div>

                    {/* AI Credits */}
                    <div className="md:col-span-2 space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <CreditCard size={14} /> Gestion des Crédits AI
                      </h3>
                      <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-3xl">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">Crédits Disponibles</p>
                          <p className="text-xs text-gray-500">Ces crédits permettent d'utiliser l'AI Coach.</p>
                        </div>
                        <input
                          type="number"
                          value={formData.aiCredits}
                          onChange={(e) => setFormData({ ...formData, aiCredits: parseInt(e.target.value) })}
                          className="w-32 bg-white dark:bg-gray-800 border-none rounded-2xl px-4 py-3 text-center font-black text-lg text-zoya-red outline-none focus:ring-2 focus:ring-zoya-red"
                        />
                      </div>
                    </div>

                    {/* Preferences & Markets */}
                    <div className="md:col-span-2 space-y-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} /> Préférences & Marchés
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-3xl space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Capital</p>
                             <p className="text-lg font-black dark:text-white">{user.capitalSize || '0'} $</p>
                           </div>
                           <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Style</p>
                             <p className="text-lg font-black dark:text-white">{user.tradingStyle || 'N/A'}</p>
                           </div>
                           <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expérience</p>
                             <p className="text-lg font-black dark:text-white capitalize">{user.experienceLevel || 'N/A'}</p>
                           </div>
                        </div>

                        <div className="space-y-3">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Marchés Sélectionnés</p>
                           <div className="flex flex-wrap gap-2">
                              {user.assetTypes && user.assetTypes.length > 0 ? (
                                user.assetTypes.map(asset => {
                                  let Icon = Coins;
                                  if (asset === 'synthetic') Icon = Zap;
                                  if (asset === 'indices') Icon = BarChart3;
                                  if (asset === 'commodities') Icon = Gem;
                                  if (asset === 'futures') Icon = Clock;
                                  if (asset === 'crypto') Icon = Bitcoin;
                                  
                                  return (
                                    <div key={asset} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                      <Icon size={14} className="text-zoya-red" />
                                      <span className="text-xs font-bold capitalize">{asset}</span>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-xs text-gray-500 italic">Aucun marché sélectionné</p>
                              )}
                           </div>
                        </div>

                        {user.subscriptionStatus === 'trialing' && (
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex items-center gap-3">
                             <AlertTriangle size={20} className="text-amber-500" />
                             <div>
                                <p className="text-xs font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest">En Période d'Essai (7 Jours)</p>
                                <p className="text-[10px] text-amber-600 dark:text-amber-400">Expire le {user.subscriptionEndDate ? format(user.subscriptionEndDate.toDate ? user.subscriptionEndDate.toDate() : new Date(user.subscriptionEndDate), 'dd MMMM yyyy', { locale: fr }) : 'N/A'}</p>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2 flex justify-end gap-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-3 bg-zoya-red text-white rounded-2xl font-poppins font-black text-sm hover:bg-zoya-red/90 transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50"
                      >
                        {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        Enregistrer les modifications
                      </button>
                    </div>
                  </form>
                )}

                {activeTab === 'trades' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Historique des Trades (Admin View)</h3>
                      <span className="text-[10px] font-bold text-zoya-red bg-zoya-red/10 px-2 py-0.5 rounded-full">
                        {trades.length} trades au total
                      </span>
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      {trades.length > 0 ? (
                        <table className="w-full text-left">
                          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-400">
                            <tr>
                              <th className="px-4 py-3">Paire</th>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">PnL</th>
                              <th className="px-4 py-3">Masqué ?</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {trades.map(t => (
                              <tr key={t.id} className="text-xs hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white uppercase">{t.pair}</td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                  {format(t.date, 'dd/MM/yy HH:mm')}
                                </td>
                                <td className={cn(
                                  "px-4 py-3 font-bold",
                                  t.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                                )}>
                                  {t.pnl >= 0 ? '+' : ''}{t.pnl}$
                                </td>
                                <td className="px-4 py-3">
                                  {t.hiddenByClient ? (
                                    <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-md font-bold text-[9px] uppercase tracking-tighter">
                                      OUI
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-md font-bold text-[9px] uppercase tracking-tighter">
                                      NON
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-12 text-center text-gray-400 italic">
                          Aucun trade trouvé pour cet utilisateur.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'notif' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Bell size={14} /> Envoyer une Notification Directe
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-[32px] space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Titre</label>
                          <input
                            type="text"
                            placeholder="Ex: Alerte de Trading"
                            value={notifData.title}
                            onChange={(e) => setNotifData({ ...notifData, title: e.target.value })}
                            className="w-full bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Type</label>
                          <select
                            value={notifData.type}
                            onChange={(e) => setNotifData({ ...notifData, type: e.target.value as any })}
                            className="w-full bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                          >
                            <option value="info">Information</option>
                            <option value="success">Succès</option>
                            <option value="warning">Avertissement</option>
                            <option value="error">Erreur</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Message</label>
                        <textarea
                          placeholder="Votre message ici..."
                          rows={3}
                          value={notifData.message}
                          onChange={(e) => setNotifData({ ...notifData, message: e.target.value })}
                          className="w-full bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red resize-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendNotif}
                        disabled={sendingNotif || !notifData.title || !notifData.message}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        {sendingNotif ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                        Envoyer la Notification
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) {
                        onDelete(user.id);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-2 text-rose-500 font-bold text-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 px-4 py-2 rounded-xl transition-all"
                  >
                    <Trash2 size={18} /> Supprimer l'utilisateur
                  </button>
                  
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
