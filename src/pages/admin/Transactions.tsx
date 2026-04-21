import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
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
  createdAt: Timestamp;
  transactionRef?: string;
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
      tx.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      tx.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.transactionRef || '').toLowerCase().includes(searchTerm.toLowerCase());
    
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
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400">Historique complet et détails des paiements clients.</p>
        </div>
        <button className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-gray-900/10 transition-transform hover:scale-105 active:scale-95">
          <Download size={18} />
          Exporter CSV
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Rechercher par ID ou Client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl font-bold text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-xs text-gray-600 dark:text-gray-400 outline-none focus:ring-2 focus:ring-zoya-red"
          >
            <option value="all">Tous les Statuts</option>
            <option value="completed">Complété</option>
            <option value="pending">En attente</option>
            <option value="failed">Échec</option>
          </select>

          <select 
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-xs text-gray-600 dark:text-gray-400 outline-none focus:ring-2 focus:ring-zoya-red"
          >
            <option value="all">Toutes Devises</option>
            <option value="USD">USD ($)</option>
            <option value="CDF">CDF (FC)</option>
          </select>

          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-4 py-3 font-bold text-xs text-gray-600 dark:text-gray-400 outline-none focus:ring-2 focus:ring-zoya-red"
          >
            <option value="all">Toute Période</option>
            <option value="today">Aujourd'hui</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
                          {tx.transactionRef || 'Ref: ' + tx.id.slice(0, 8)}
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
                  <td className="px-8 py-5 text-right md:text-left">
                    <p className="font-poppins font-black text-gray-900 dark:text-white">
                      {tx.amount.toLocaleString()} {tx.currency}
                    </p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{tx.method || 'Mobile Money'}</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-[40px] p-8 max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="absolute top-6 right-6 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <ChevronLeft className="rotate-180" size={20} />
              </button>

              <div className="space-y-8">
                <div className="text-center space-y-2">
                  <div className={cn("inline-flex p-4 rounded-3xl mb-4", getStatusColor(selectedTransaction.status))}>
                    <Wallet size={32} />
                  </div>
                  <h2 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Détails de Transaction</h2>
                  <p className="text-sm text-gray-500">ID: {selectedTransaction.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Montant</p>
                    <p className="text-lg font-poppins font-black text-gray-900 dark:text-white">
                      {selectedTransaction.amount.toLocaleString()} {selectedTransaction.currency}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                      getStatusColor(selectedTransaction.status)
                    )}>
                      {getStatusIcon(selectedTransaction.status)}
                      {selectedTransaction.status}
                    </span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Client</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{selectedTransaction.userName || selectedTransaction.userEmail || selectedTransaction.userId}</p>
                    {selectedTransaction.userName && selectedTransaction.userEmail && (
                      <p className="text-[8px] text-gray-400 truncate">{selectedTransaction.userEmail}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Plan</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white uppercase">{selectedTransaction.plan} ({selectedTransaction.cycle})</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl col-span-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Référence Transaction</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedTransaction.transactionRef || "N/A"}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl col-span-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date & Heure</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {format(selectedTransaction.createdAt.toDate(), 'PPPP HH:mm:ss', { locale: fr })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button className="flex-1 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-2xl shadow-lg transition-transform active:scale-95">
                    Télécharger Reçu
                  </button>
                  <button 
                    onClick={() => setSelectedTransaction(null)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-2xl transition-transform active:scale-95"
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
