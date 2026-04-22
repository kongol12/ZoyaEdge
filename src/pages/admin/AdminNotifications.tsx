import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, limit } from 'firebase/firestore';
import { Bell, Check, Trash2, Info, AlertTriangle, XCircle, CheckCircle2, Send, Megaphone, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { OperationType, handleFirestoreError, sendGlobalNotification } from '../../lib/db';

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: any;
}

export default function AdminNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastData, setBroadcastData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'error' | 'success'
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminNotification[];
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'admin_notifications');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastData.title || !broadcastData.message) return;
    setSending(true);
    try {
      await sendGlobalNotification(broadcastData);
      setBroadcastData({ title: '', message: '', type: 'info' });
      setShowBroadcast(false);
      alert("Message global envoyé à tous les utilisateurs !");
    } catch (error) {
      console.error("Error sending broadcast:", error);
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'admin_notifications', id), { read: true });
  };

  const deleteNotif = async (id: string) => {
    await deleteDoc(doc(db, 'admin_notifications', id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="text-amber-500" />;
      case 'error': return <XCircle className="text-rose-500" />;
      case 'success': return <CheckCircle2 className="text-emerald-500" />;
      default: return <Info className="text-blue-500" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Centre de Notifications</h1>
          <p className="text-gray-500 dark:text-gray-400">Alertes système et notifications administratives en temps réel.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowBroadcast(!showBroadcast)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/20 font-poppins font-black text-sm hover:bg-indigo-700 transition-all"
          >
            <Megaphone size={18} />
            Diffusion Globale
          </button>
          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-2">
            <Bell size={18} className="text-zoya-red" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {notifications.filter(n => !n.read).length} Non lues
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showBroadcast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-indigo-100 dark:border-indigo-900/20 shadow-2xl space-y-6"
          >
            <div className="flex items-center gap-3 text-indigo-600">
              <Megaphone size={24} />
              <h2 className="text-xl font-poppins font-black">Envoyer un message à TOUS les utilisateurs</h2>
            </div>
            <form onSubmit={handleBroadcast} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Titre de l'alerte</label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Maintenance prévue ce soir"
                  value={broadcastData.title}
                  onChange={(e) => setBroadcastData({ ...broadcastData, title: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type d'alerte</label>
                <select
                  value={broadcastData.type}
                  onChange={(e) => setBroadcastData({ ...broadcastData, type: e.target.value as any })}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="info">Information (Bleu)</option>
                  <option value="success">Succès (Vert)</option>
                  <option value="warning">Avertissement (Orange)</option>
                  <option value="error">Erreur (Rouge)</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Message détaillé</label>
                <textarea
                  required
                  placeholder="Décrivez l'alerte ici..."
                  rows={3}
                  value={broadcastData.message}
                  onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBroadcast(false)}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-poppins font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {sending ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                  Diffuser le message
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "bg-white dark:bg-gray-800 p-6 rounded-3xl border shadow-lg flex items-center gap-6 transition-all",
                notif.read ? "border-gray-100 dark:border-gray-700 opacity-75" : "border-zoya-red/20 dark:border-zoya-red/30 ring-1 ring-zoya-red/5"
              )}
            >
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0">
                {getIcon(notif.type)}
              </div>

              <div className="flex-1">
                <h3 className={cn("font-poppins font-black text-gray-900 dark:text-white", notif.read ? "opacity-70" : "")}>
                  {notif.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{notif.message}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">
                  {format(notif.createdAt?.toDate() || new Date(), 'dd MMM, HH:mm:ss')}
                </p>
              </div>

              <div className="flex gap-2">
                {!notif.read && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                    title="Marquer comme lu"
                  >
                    <Check size={20} />
                  </button>
                )}
                <button
                  onClick={() => deleteNotif(notif.id)}
                  className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                  title="Supprimer"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {notifications.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
            <Bell size={48} className="mx-auto text-gray-300 mb-4 opacity-20" />
            <p className="text-gray-400 font-medium">Aucune notification pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
