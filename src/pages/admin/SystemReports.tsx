import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Clock, Trash2, Filter, Bug, ShieldAlert, Activity, ArrowRightCircle, Target, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { OperationType, handleFirestoreError } from '../../lib/db';
import toast from 'react-hot-toast';

interface BugReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  type: 'client' | 'system';
  createdAt: any;
  suggestedAction?: string; // New field for actions
  resolution?: string;
}

export default function SystemReports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [filter, setFilter] = useState<'all' | 'client' | 'system'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    
    // Allow admins/agents to track system errors
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
    try {
      await updateDoc(doc(db, 'bug_reports', id), { status });
      toast.success("Statut du rapport mis à jour !");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleAddResolution = async (id: string, resolutionText: string) => {
    try {
      await updateDoc(doc(db, 'bug_reports', id), { 
        resolution: resolutionText,
        status: 'resolved',
        updatedAt: serverTimestamp()
      });
      toast.success("Rapport résolu avec une explication !");
    } catch (error) {
      toast.error("Erreur lors de la résolution");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer définitivement ce rapport ?")) {
      try {
        await deleteDoc(doc(db, 'bug_reports', id));
        toast.success("Rapport supprimé");
      } catch (error) {
        toast.error("Erreur");
      }
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const active = reports.filter(r => r.status === 'open' || r.status === 'in-progress').length;
    const resolved = reports.filter(r => r.status === 'resolved' || r.status === 'closed').length;
    const pending = reports.filter(r => r.status === 'open').length;
    const inProgress = reports.filter(r => r.status === 'in-progress').length;
    return { active, resolved, pending, inProgress, total: reports.length };
  }, [reports]);

  const filteredReports = useMemo(() => {
    let result = reports;
    if (filter !== 'all') {
      result = result.filter(r => r.type === filter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.title.toLowerCase().includes(q) || 
        r.description.toLowerCase().includes(q) ||
        r.userId.toLowerCase().includes(q)
      );
    }
    return result;
  }, [reports, filter, searchQuery]);

  const severityColors = {
    low: 'bg-blue-100 text-blue-600 border-blue-200',
    medium: 'bg-amber-100 text-amber-600 border-amber-200',
    high: 'bg-orange-100 text-orange-600 border-orange-200',
    critical: 'bg-rose-100 text-rose-600 border-rose-200 animate-pulse'
  };

  const statusColors = {
    open: 'bg-gray-100 text-gray-600 border-gray-200',
    'in-progress': 'bg-indigo-100 text-indigo-600 border-indigo-200',
    resolved: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    closed: 'bg-gray-200 text-gray-400 border-gray-300'
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Chargement des rapports système...</div>;
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-poppins font-black text-gray-900 dark:text-white">Suivi des Erreurs</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Rapports d'erreurs clients et alertes d'infrastructure avec actions de résolution.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Erreurs</p>
          <p className="text-2xl font-poppins font-black text-gray-900 dark:text-white">{metrics.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30 shadow-sm flex flex-col">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">En attente (Actif)</p>
          <p className="text-2xl font-poppins font-black text-rose-600">{metrics.pending}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm flex flex-col">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">En Cours</p>
          <p className="text-2xl font-poppins font-black text-indigo-600">{metrics.inProgress}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex flex-col">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Erreurs Résolus</p>
          <p className="text-2xl font-poppins font-black text-emerald-600">{metrics.resolved}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[24px] border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par mot-clé, Description, UUID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div className="flex p-1 bg-gray-50 dark:bg-gray-900 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar border border-gray-100 dark:border-gray-800">
            {(['all', 'client', 'system'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all",
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
              className="bg-white dark:bg-gray-800 rounded-[28px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
            >
              <div 
                className="p-5 md:p-6 cursor-pointer flex flex-col md:flex-row gap-4 md:gap-6 items-start hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                  report.type === 'system' ? "bg-rose-50 dark:bg-rose-900/40" : "bg-blue-50 dark:bg-blue-900/40"
                )}>
                  {report.type === 'system' ? <ShieldAlert size={20} className="text-rose-600 dark:text-rose-400" /> : <Bug size={20} className="text-blue-600 dark:text-blue-400" />}
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base md:text-lg font-poppins font-black text-gray-900 dark:text-white">{report.title}</h3>
                    <div className="flex gap-1.5 ml-auto md:ml-0">
                      <span className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border", severityColors[report.severity])}>
                        {report.severity}
                      </span>
                      <span className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border", statusColors[report.status])}>
                        {report.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 md:line-clamp-1">{report.description}</p>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-1">
                    <span className="flex items-center gap-1.5"><Clock size={12} /> {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'dd MMM yyyy, HH:mm', { locale: fr }) : 'Inconnu'}</span>
                    <span className="flex items-center gap-1.5 truncate"><Bug size={12} /> ID: {report.id.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>

              {/* EXPANDED CONTENT */}
              <AnimatePresence>
                {expandedId === report.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                  >
                    <div className="p-5 md:p-6 space-y-6">
                      <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <AlertCircle size={14} className="text-gray-400" /> Description Complète de l'Erreur
                        </h4>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono relative">
                          {report.description}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Target size={14} className="text-indigo-500" /> Actions Recommandées à faire
                          </h4>
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-sm text-indigo-900 dark:text-indigo-200 whitespace-pre-wrap leadimg-relaxed">
                            {report.suggestedAction || "Consulter les logs de Firebase. Vérifier la connectivité avec le broker ou alerter l'équipe de développement sur le composant défaillant."}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-500" /> Explication de la Résolution (Notes Admin)
                          </h4>
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 transition-all h-full min-h-[100px]">
                             <textarea 
                               className="w-full h-full p-4 bg-transparent border-none outline-none text-sm text-emerald-900 dark:text-emerald-200 placeholder-emerald-400/50 resize-none font-medium"
                               placeholder="Décrivez comment cette erreur a été résolue..."
                               defaultValue={report.resolution || ''}
                               onBlur={(e) => {
                                 if(e.target.value !== report.resolution && e.target.value.trim() !== '') {
                                    handleAddResolution(report.id, e.target.value);
                                 }
                               }}
                             />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">État du rapport :</span>
                          <select
                            value={report.status}
                            onChange={(e) => handleUpdateStatus(report.id, e.target.value)}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none shadow-sm cursor-pointer"
                          >
                            <option value="open">En attente (Open)</option>
                            <option value="in-progress">En Cours d'analyse</option>
                            <option value="resolved">Résolu</option>
                            <option value="closed">Fermé (Ignoré)</option>
                          </select>
                        </div>
                        <button
                          onClick={() => handleDelete(report.id)}
                          className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl font-bold text-xs transition-colors"
                        >
                          <Trash2 size={16} /> Supprimer
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredReports.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-[32px] border border-dashed border-gray-200 dark:border-gray-700">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4 opacity-20" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">Système Sain</p>
            <p className="text-gray-400 font-medium text-sm mt-1">Aucun rapport d'erreur ne correspond à vos recherches.</p>
          </div>
        )}
      </div>
    </div>
  );
}
