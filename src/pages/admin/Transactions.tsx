import React, { useEffect, useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp, where, getDocs } from 'firebase/firestore';
import { Search, Filter, Download, Calendar, ArrowUpRight, CreditCard, Users, Wallet, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Transaction {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  plan: 'free' | 'pro' | 'premium';
  method: string;
  operator?: string;
  createdAt: Timestamp;
  transactionReference?: string;
  transactionId?: string;
  cycle?: 'monthly' | 'yearly';
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all'); // all, today, 7d, 30d
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    let q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
      
      try {
        // Fetch users to map information
        const usersSnap = await getDocs(collection(db, 'users'));
        const userMap: Record<string, any> = {};
        usersSnap.docs.forEach(d => {
          userMap[d.id] = d.data();
        });

        const enrichedTxs = txs.map(tx => {
          const userProfile = userMap[tx.userId];
          return {
            ...tx,
            userName: tx.userName || userProfile?.displayName || userProfile?.name || userProfile?.email?.split('@')[0] || "Client Sans Nom",
            userEmail: tx.userEmail || userProfile?.email || "N/A"
          };
        });

        setTransactions(enrichedTxs);
      } catch (error) {
        console.error("Erreur d'enrichissement des données:", error);
        setTransactions(txs);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      tx.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.transactionReference || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    const matchesCurrency = currencyFilter === 'all' || tx.currency === currencyFilter;
    
    let matchesDate = true;
    if (dateRange !== 'all') {
      const txDate = tx.createdAt.toDate();
      const now = new Date();
      if (dateRange === 'today') {
        matchesDate = txDate >= startOfDay(now) && txDate <= endOfDay(now);
      } else if (dateRange === '7d') {
        matchesDate = txDate >= subDays(now, 7);
      } else if (dateRange === '30d') {
        matchesDate = txDate >= subDays(now, 30);
      }
    }

    return matchesSearch && matchesStatus && matchesCurrency && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
      case 'pending': return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
      case 'failed': return 'text-rose-500 bg-rose-50 dark:bg-rose-900/20';
      case 'refunded': return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={14} />;
      case 'pending': return <Clock size={14} />;
      case 'failed': return <XCircle size={14} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tighter">
            Transactions
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-bold mt-1">Audit financier et flux de trésorerie.</p>
        </div>
        <button className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-4 md:py-3 rounded-2xl font-black text-[10px] md:text-sm uppercase tracking-widest shadow-xl shadow-gray-900/10 transition-transform hover:scale-105 active:scale-95">
          <Download size={18} />
          <span className="md:hidden">Exporter Audit</span>
          <span className="hidden md:inline">Exporter CSV</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="ID, Client, Référence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 md:py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl font-bold text-sm md:text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red transition-all"
          />
        </div>

        <div className="flex overflow-x-auto gap-2 pb-2 md:pb-0 no-scrollbar">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 md:flex-none bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 md:py-4 font-black text-[10px] md:text-xs text-gray-600 dark:text-gray-400 outline-none focus:ring-2 focus:ring-zoya-red uppercase tracking-widest min-w-[120px]"
          >
            <option value="all">Tous Statuts</option>
            <option value="completed">Succès</option>
            <option value="pending">En attente</option>
            <option value="failed">Échec</option>
          </select>

          <select 
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="flex-1 md:flex-none bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 md:py-4 font-black text-[10px] md:text-xs text-gray-600 dark:text-gray-400 outline-none focus:ring-2 focus:ring-zoya-red uppercase tracking-widest min-w-[100px]"
          >
            <option value="all">Toutes Devises</option>
            <option value="USD">USD ($)</option>
            <option value="CDF">CDF (FC)</option>
          </select>

          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="flex-1 md:flex-none bg-gray-50 dark:bg-gray-900 border-none rounded-xl md:rounded-2xl px-4 py-3 md:py-4 font-black text-[10px] md:text-xs text-gray-600 dark:text-gray-400 outline-none focus:ring-2 focus:ring-zoya-red uppercase tracking-widest min-w-[140px]"
          >
            <option value="all">Toute Période</option>
            <option value="today">Aujourd'hui</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-zoya-red border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
            <div 
              key={tx.id} 
              onClick={() => setSelectedTransaction(tx)}
              className="p-5 space-y-4 active:bg-gray-50 dark:active:bg-gray-900/40 transition-colors"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center text-gray-400 shrink-0">
                    <CreditCard size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-poppins font-black text-gray-900 dark:text-white truncate">
                      {tx.userName || 'Client'}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 truncate">RE: {tx.id.slice(0, 10)}...</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-poppins font-black text-gray-900 dark:text-white">
                    {tx.amount.toLocaleString()} {tx.currency}
                  </p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    {tx.method || 'MM'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-lg",
                    tx.plan === 'premium' ? "bg-amber-100 text-amber-600" : 
                    tx.plan === 'pro' ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                  )}>
                    {tx.plan} {tx.cycle ? `(${tx.cycle[0]})` : ''}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                    getStatusColor(tx.status)
                  )}>
                    {getStatusIcon(tx.status)}
                    {tx.status}
                  </span>
                </div>
                <div className="text-[9px] font-bold text-gray-400 flex flex-col items-end">
                   <span>{format(tx.createdAt.toDate(), 'dd MMM yyyy', { locale: fr })}</span>
                   <span>{format(tx.createdAt.toDate(), 'HH:mm')}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="p-12 text-center text-gray-400 font-bold italic">
              Aucune transaction.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-5">Transaction Details</th>
                <th className="px-8 py-5 text-center">Plan / Cycle</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">Date / Time</th>
                <th className="px-8 py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {loading ? (
                 <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="w-8 h-8 border-4 border-zoya-red border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                 </tr>
              ) : filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                <tr 
                  key={tx.id} 
                  onClick={() => setSelectedTransaction(tx)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors cursor-pointer group"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-zoya-red/10 group-hover:text-zoya-red transition-colors">
                        <CreditCard size={24} />
                      </div>
                      <div>
                        <p className="font-poppins font-black text-gray-900 dark:text-white group-hover:text-zoya-red transition-colors">
                          {tx.transactionReference || 'Ref: ' + tx.id.slice(0, 8)}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 flex items-center gap-2">
                           <Users size={10} /> {tx.userName || tx.userEmail || tx.userId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full",
                        tx.plan === 'premium' ? "bg-amber-100 text-amber-600" : 
                        tx.plan === 'pro' ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                      )}>
                        {tx.plan}
                      </span>
                      <span className="text-[9px] font-bold uppercase text-gray-400">
                        {tx.cycle || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-poppins font-black text-gray-900 dark:text-white">
                      {tx.amount.toLocaleString()} {tx.currency}
                    </p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      {tx.operator || tx.method || 'Mobile Money'}
                    </p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-[11px] font-bold text-gray-500 whitespace-nowrap">
                      {format(tx.createdAt.toDate(), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {format(tx.createdAt.toDate(), 'HH:mm:ss')}
                    </p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider",
                      getStatusColor(tx.status)
                    )}>
                      {getStatusIcon(tx.status)}
                      {tx.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <p className="text-gray-500 font-bold">Aucune transaction correspondante.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Simple Pagination Footer */}
        <div className="px-8 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <p className="text-xs font-bold text-gray-400">
            Affichage de {filteredTransactions.length} transaction(s)
          </p>
          <div className="flex gap-2">
            <button className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-zoya-red transition-colors disabled:opacity-50" disabled>
              <ChevronLeft size={18} />
            </button>
            <button className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-zoya-red transition-colors disabled:opacity-50" disabled>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[32px] md:rounded-[40px] p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="absolute top-6 right-6 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-10"
              >
                <XCircle size={24} className="text-gray-400" />
              </button>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 md:space-y-8 pr-1">
                <div className="text-center space-y-2">
                  <div className={cn("inline-flex p-4 rounded-3xl mb-4", getStatusColor(selectedTransaction.status))}>
                    <Wallet size={32} />
                  </div>
                  <h2 className="text-xl md:text-2xl font-poppins font-black text-gray-900 dark:text-white">Détails Audit</h2>
                  <p className="text-[10px] md:text-sm text-gray-500 font-mono break-all px-4 sm:px-0">ID: {selectedTransaction.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Montant</p>
                    <p className="text-base md:text-lg font-poppins font-black text-gray-900 dark:text-white">
                      {selectedTransaction.amount.toLocaleString()} {selectedTransaction.currency}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Statut</p>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-wider",
                      getStatusColor(selectedTransaction.status)
                    )}>
                      {getStatusIcon(selectedTransaction.status)}
                      {selectedTransaction.status}
                    </span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl col-span-2 sm:col-span-1">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Client</p>
                    <p className="text-xs md:text-sm font-bold text-gray-900 dark:text-white truncate">{selectedTransaction.userName || 'N/A'}</p>
                    <p className="text-[8px] md:text-[9px] text-gray-400 truncate">{selectedTransaction.userEmail || selectedTransaction.userId}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl col-span-2 sm:col-span-1">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Plan</p>
                    <p className="text-xs md:text-sm font-bold text-gray-900 dark:text-white uppercase truncate">{selectedTransaction.plan} ({selectedTransaction.cycle || '?'})</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl col-span-2">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Méthode de Paiement</p>
                    <p className="text-xs md:text-sm font-bold text-gray-900 dark:text-white uppercase">
                      {selectedTransaction.operator || selectedTransaction.method || "N/A"}
                      {selectedTransaction.operator && selectedTransaction.method && selectedTransaction.method !== 'Mobile Money' && ` via ${selectedTransaction.method}`}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl col-span-2">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Référence Transaction</p>
                    <p className="text-xs md:text-sm font-bold text-gray-900 dark:text-white break-all">{selectedTransaction.transactionReference || "N/A"}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl col-span-2">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date & Heure</p>
                    <p className="text-xs md:text-sm font-bold text-gray-900 dark:text-white">
                      {format(selectedTransaction.createdAt.toDate(), 'PPPP HH:mm:ss', { locale: fr })}
                    </p>
                  </div>
                </div>

                {selectedTransaction.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={async () => {
                        try {
                          const token = await auth.currentUser?.getIdToken();
                          const resp = await fetch('/api/admin/transactions/override', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ transactionId: selectedTransaction.transactionId || selectedTransaction.id, action: 'complete' })
                          });
                          const data = await resp.json();
                          if (!resp.ok) throw new Error(data.error || 'Erreur');
                          import('react-hot-toast').then(m => m.default.success("Transaction forcée à succès"));
                          setSelectedTransaction(null);
                        } catch (err: any) {
                          import('react-hot-toast').then(m => m.default.error(err.message));
                        }
                      }}
                      className="py-4 bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg transition-transform active:scale-95"
                    >
                      Forcer Succès
                    </button>
                    <button 
                      onClick={async () => {
                         try {
                          const token = await auth.currentUser?.getIdToken();
                          const resp = await fetch('/api/admin/transactions/override', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ transactionId: selectedTransaction.transactionId || selectedTransaction.id, action: 'fail' })
                          });
                          const data = await resp.json();
                          if (!resp.ok) throw new Error(data.error || 'Erreur');
                          import('react-hot-toast').then(m => m.default.success("Transaction forcée à échec"));
                          setSelectedTransaction(null);
                        } catch (err: any) {
                          import('react-hot-toast').then(m => m.default.error(err.message));
                        }
                      }}
                      className="py-4 bg-rose-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg transition-transform active:scale-95"
                    >
                      Forcer Échec
                    </button>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button className="flex-1 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg transition-transform active:scale-95">
                    Télécharger Reçu
                  </button>
                  <button 
                    onClick={() => setSelectedTransaction(null)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-transform active:scale-95"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
