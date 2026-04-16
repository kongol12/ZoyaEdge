import React, { useState } from 'react';
import { X, Shield, CreditCard, User as UserIcon, Mail, Crown, Save, Trash2, AlertTriangle, Send, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { sendNotificationToUser } from '../../lib/db';

interface UserDetailModalProps {
  user: UserProfile & { id: string };
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
}

export default function UserDetailModal({ user, isOpen, onClose, onUpdate, onDelete }: UserDetailModalProps) {
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
      alert("Notification envoyée avec succès !");
    } catch (error) {
      console.error("Error sending notification:", error);
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

              <div className="space-y-8">
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

                {/* Send Notification Section */}
                <div className="pt-8 border-t border-gray-100 dark:border-gray-700 space-y-4">
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

function RefreshCw({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
