import React, { useState } from 'react';
import { X, Shield, CreditCard, User as UserIcon, Mail, Crown, Save, Trash2, AlertTriangle, Send, Bell, Coins, Zap, BarChart3, Gem, Clock, Bitcoin, Activity, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { Trade, subscribeToTrades, sendNotificationToUser } from '../../lib/db';
import { auth } from '../../lib/firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { COUNTRIES } from '../../lib/countries';

interface UserDetailModalProps {
  user: UserProfile & { id: string };
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
}

export default function UserDetailModal({ user, isOpen, onClose, onUpdate, onDelete }: UserDetailModalProps) {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'trades' | 'notif'>('profile');
  const [formData, setFormData] = useState({
    displayName: user.displayName || '',
    email: user.email || '',
    role: user.role || 'user',
    subscription: user.subscription || 'free',
    subscriptionStatus: user.subscriptionStatus || 'active',
    aiCredits: user.aiCredits || 0,
    bypassMaintenance: user.bypassMaintenance || false,
    country: user.country || '',
    phone: user.phone || '',
    capitalSize: user.capitalSize || '0',
    tradingStyle: user.tradingStyle || '',
    experienceLevel: user.experienceLevel || 'beginner'
  });
  const [saving, setSaving] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);

  React.useEffect(() => {
    const checkPrimary = async () => {
      const PRIMARY_EMAIL = import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase();
      const currentEmail = auth.currentUser?.email?.toLowerCase();
      setIsPrimary(currentEmail === PRIMARY_EMAIL);
    };
    checkPrimary();
  }, []);

  React.useEffect(() => {
    setFormData({
      displayName: user.displayName || '',
      email: user.email || '',
      role: user.role || 'user',
      subscription: user.subscription || 'free',
      subscriptionStatus: user.subscriptionStatus || 'active',
      aiCredits: user.aiCredits || 0,
      bypassMaintenance: user.bypassMaintenance || false,
      country: user.country || '',
      phone: user.phone || '',
      capitalSize: user.capitalSize || '0',
      tradingStyle: user.tradingStyle || '',
      experienceLevel: user.experienceLevel || 'beginner'
    });
  }, [user]);

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
            className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 my-auto flex flex-col h-[95vh] md:h-auto md:max-h-[85vh] lg:max-h-[90vh]"
          >
            <div className="p-5 md:p-8 flex flex-col flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-6 md:mb-8 shrink-0">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-gray-100 dark:bg-gray-700 rounded-xl md:rounded-2xl flex items-center justify-center text-gray-400 shrink-0">
                    <UserIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg md:text-2xl font-poppins font-black text-gray-900 dark:text-white truncate">Profile Management</h2>
                    <p className="text-[10px] md:text-xs font-mono text-gray-400 truncate uppercase mt-0.5">{user.email}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900/50 p-1 rounded-2xl mb-6 md:mb-8 shrink-0 overflow-x-auto no-scrollbar">
                {(['profile', 'trades', 'notif'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 min-w-[80px] py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                      activeTab === tab 
                        ? "bg-white dark:bg-gray-800 text-zoya-red shadow-sm" 
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    )}
                  >
                    {tab === 'profile' ? 'Profil' : tab === 'trades' ? 'Trades' : 'Notif'}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                <div className="pb-6">
                {activeTab === 'profile' && (
                  <form id="user-profile-form" onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                      {/* Basic Info */}
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <UserIcon size={14} className="text-zoya-red" /> Identité & Contact
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nom complet</label>
                            <input
                              type="text"
                              value={formData.displayName}
                              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                              placeholder="Nom du client"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Numéro de téléphone</label>
                            <input
                              type="text"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                              placeholder="+243..."
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Pays / Zone</label>
                            <select
                              value={formData.country}
                              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red appearance-none"
                            >
                              <option value="">Sélectionner...</option>
                              {COUNTRIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Control Panel */}
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Shield size={14} className="text-zoya-red" /> Control Panel
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Rôle Système</label>
                            <select
                              value={formData.role}
                              disabled={!isPrimary}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red uppercase tracking-widest disabled:opacity-50"
                            >
                              <option value="user">Client (Standard)</option>
                              <option value="agent">Support (Agent)</option>
                              <option value="admin">Admin (Full access)</option>
                            </select>
                            {!isPrimary && (
                              <p className="text-[8px] text-rose-500 font-black mt-1 uppercase tracking-widest ml-2">Modification du rôle réservée au Super Admin</p>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Niveau</label>
                               <select
                                 value={formData.subscription}
                                 onChange={(e) => setFormData({ ...formData, subscription: e.target.value as any })}
                                 className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-3 py-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-zoya-red"
                               >
                                 <option value="free">Free Account</option>
                                 <option value="discovery">Discovery</option>
                                 <option value="pro">Zoya Pro</option>
                                 <option value="premium">Zoya Premium</option>
                               </select>
                             </div>
                             <div>
                               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Status</label>
                               <select
                                 value={formData.subscriptionStatus}
                                 onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value as any })}
                                 className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-3 py-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-zoya-red"
                               >
                                 <option value="active">Compte Actif</option>
                                 <option value="suspended">Compte Suspendu</option>
                                 <option value=" ट्रायलing">Trial Mode</option>
                                 <option value="inactive">Inactif</option>
                               </select>
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Credits Section */}
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Coins size={14} className="text-zoya-red" /> AI Engine Credits
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 p-4 md:p-6 rounded-[24px] md:rounded-[32px] flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-1 text-center sm:text-left">
                          <p className="text-sm font-black text-gray-900 dark:text-white">Crédits AI Coach</p>
                          <p className="text-[10px] text-gray-500 font-bold">Ajustez manuellement le quota de l'utilisateur.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, aiCredits: Math.max(0, prev.aiCredits - 10) }))}
                            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-xl shadow-sm text-gray-400 hover:text-rose-500 font-black"
                          >
                            -10
                          </button>
                          <input
                            type="number"
                            value={formData.aiCredits}
                            onChange={(e) => setFormData({ ...formData, aiCredits: parseInt(e.target.value) || 0 })}
                            className="w-24 bg-white dark:bg-gray-800 border-2 border-transparent focus:border-zoya-red rounded-xl px-4 py-3 text-center font-poppins font-black text-lg text-zoya-red outline-none"
                          />
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, aiCredits: prev.aiCredits + 10 }))}
                            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-xl shadow-sm text-gray-400 hover:text-emerald-500 font-black"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Advanced Settings */}
                    <div className="space-y-4">
                       <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                         <BarChart3 size={14} className="text-zoya-red" /> Paramètres de Trading
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Capital ($)</label>
                            <input
                              type="text"
                              value={formData.capitalSize}
                              onChange={(e) => setFormData({ ...formData, capitalSize: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-zoya-red"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Style</label>
                            <input
                              type="text"
                              value={formData.tradingStyle}
                              onChange={(e) => setFormData({ ...formData, tradingStyle: e.target.value })}
                              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                              placeholder="Scalping / Day"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Niveau</label>
                            <select
                              value={formData.experienceLevel}
                              onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as any })}
                              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-zoya-red uppercase tracking-widest"
                            >
                              <option value="beginner">Débutant</option>
                              <option value="intermediate">Intermédiaire</option>
                              <option value="expert">Expert</option>
                            </select>
                          </div>
                       </div>
                    </div>
                  </form>
                )}

                {activeTab === 'trades' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Audit des Performances</h3>
                      <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                         <Activity size={12} className="text-indigo-600" />
                         <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{trades.length} Opérations</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {trades.length > 0 ? (
                        trades.map(t => (
                          <div key={t.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex justify-between items-center group">
                            <div className="min-w-0">
                               <div className="flex items-center gap-2">
                                  <p className="font-poppins font-black text-gray-900 dark:text-white uppercase truncate">{t.pair}</p>
                                  {t.hiddenByClient && (
                                    <span className="text-[8px] font-black bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded-md uppercase tracking-widest">Hidden</span>
                                  )}
                               </div>
                               <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                 {format(t.date, 'dd MMM yyyy • HH:mm')}
                               </p>
                            </div>
                            <div className="text-right">
                               <p className={cn(
                                 "font-poppins font-black text-sm",
                                 t.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                               )}>
                                 {t.pnl >= 0 ? '+' : ''}{t.pnl}$
                               </p>
                               <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t.direction}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-gray-400 font-bold italic text-sm">
                          Aucun trade trouvé pour ce profil.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'notif' && (
                  <div className="space-y-6">
                    <div className="text-center md:text-left space-y-1">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                        <Send size={14} className="text-zoya-red" /> Notification Directe
                      </h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Envoyez un message système à cet utilisateur.</p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 p-5 md:p-8 rounded-[32px] space-y-5 border border-gray-100 dark:border-gray-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Objet du Message</label>
                          <input
                            type="text"
                            placeholder="Titre de l'alerte"
                            value={notifData.title}
                            onChange={(e) => setNotifData({ ...notifData, title: e.target.value })}
                            className="w-full bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Sévérité</label>
                          <select
                            value={notifData.type}
                            onChange={(e) => setNotifData({ ...notifData, type: e.target.value as any })}
                            className="w-full bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-zoya-red"
                          >
                            <option value="info">Info (Bleu)</option>
                            <option value="success">Ok (Vert)</option>
                            <option value="warning">Warn (Orange)</option>
                            <option value="error">Panic (Rouge)</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Message</label>
                        <textarea
                          placeholder="Contenu de la notification..."
                          rows={4}
                          value={notifData.message}
                          onChange={(e) => setNotifData({ ...notifData, message: e.target.value })}
                          className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-zoya-red resize-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendNotif}
                        disabled={sendingNotif || !notifData.title || !notifData.message}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-zoya-red text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-zoya-red/20"
                      >
                        {sendingNotif ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                        Transmettre l'Alerte
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 md:p-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 shrink-0">
               <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                 <button
                   type="button"
                   onClick={() => {
                     if (confirm("Supprimer ce profil définitivement ?")) {
                       onDelete(user.id);
                       onClose();
                     }
                   }}
                   className="w-full md:w-auto flex items-center justify-center gap-2 text-rose-500 font-black uppercase text-[10px] tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 px-4 py-3 rounded-xl transition-all"
                 >
                   <Trash2 size={16} /> Delete Identity
                 </button>
                 
                 <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 md:flex-none px-6 py-4 md:py-3 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                    >
                      Fermer
                    </button>
                    
                    {activeTab === 'profile' && (
                      <button
                        type="submit"
                        form="user-profile-form"
                        disabled={saving}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-4 md:py-3 bg-zoya-red text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zoya-red/90 transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50 min-w-[140px]"
                      >
                        {saving ? <RefreshCw className="animate-spin text-white" size={16} /> : <Save size={16} />}
                        Save Audit
                      </button>
                    )}
                 </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
