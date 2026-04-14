import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, limit } from 'firebase/firestore';
import { Bell, Check, Trash2, Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { OperationType, handleFirestoreError } from '../../lib/db';

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
        <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-2">
          <Bell size={18} className="text-zoya-red" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {notifications.filter(n => !n.read).length} Non lues
          </span>
        </div>
      </div>

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
