import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Clock, Trash2, Filter, Bug, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { OperationType, handleFirestoreError } from '../../lib/db';

interface BugReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  type: 'client' | 'system';
  createdAt: any;
}

export default function SystemReports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [filter, setFilter] = useState<'all' | 'client' | 'system'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    
    const q = query(collection(db, 'bug_reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BugReport[];
      setReports(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bug_reports');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleUpdateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'bug_reports', id), { status });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer ce rapport ?")) {
      await deleteDoc(doc(db, 'bug_reports', id));
    }
  };

  const filteredReports = reports.filter(r => filter === 'all' || r.type === filter);

  const severityColors = {
    low: 'bg-blue-100 text-blue-600',
    medium: 'bg-amber-100 text-amber-600',
    high: 'bg-orange-100 text-orange-600',
    critical: 'bg-rose-100 text-rose-600 animate-pulse'
  };

  const statusColors = {
    open: 'bg-gray-100 text-gray-600',
    'in-progress': 'bg-indigo-100 text-indigo-600',
    resolved: 'bg-emerald-100 text-emerald-600',
    closed: 'bg-gray-200 text-gray-400'
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Rapports d'Erreurs</h1>
          <p className="text-gray-500 dark:text-gray-400">Surveillez les bugs clients et les alertes système en temps réel.</p>
        </div>
        
        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
          {(['all', 'client', 'system'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize",
                filter === f 
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" 
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {f === 'all' ? 'Tous' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredReports.map((report) => (
            <motion.div
              key={report.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg flex flex-col md:flex-row gap-6 items-start"
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                report.type === 'system' ? "bg-rose-50 dark:bg-rose-900/20" : "bg-blue-50 dark:bg-blue-900/20"
              )}>
                {report.type === 'system' ? <ShieldAlert className="text-rose-600" /> : <Bug className="text-blue-600" />}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">{report.title}</h3>
                  <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase", severityColors[report.severity])}>
                    {report.severity}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase", statusColors[report.status])}>
                    {report.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{report.description}</p>
                <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><Clock size={12} /> {format(report.createdAt?.toDate() || new AlertCircle(), 'dd MMM, HH:mm')}</span>
                  <span>User ID: {report.userId.substring(0, 8)}...</span>
                </div>
              </div>

              <div className="flex md:flex-col gap-2 shrink-0">
                <select
                  value={report.status}
                  onChange={(e) => handleUpdateStatus(report.id, e.target.value)}
                  className="text-xs font-bold bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-zoya-red"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button
                  onClick={() => handleDelete(report.id)}
                  className="p-2 text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 dark:bg-gray-900 rounded-xl"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredReports.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4 opacity-20" />
            <p className="text-gray-400 font-medium">Aucun rapport d'erreur trouvé.</p>
          </div>
        )}
      </div>
    </div>
  );
}
