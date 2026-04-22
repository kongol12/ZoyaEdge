import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, limit, orderBy, getDocs, collectionGroup } from 'firebase/firestore';
import { useTranslation } from '../../lib/i18n';
import { Users, Activity, CreditCard, Shield, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, User } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '../../lib/utils';
import { format } from 'date-fns';
import { useAuth } from '../../lib/auth';
import { OperationType, handleFirestoreError } from '../../lib/db';

import { Terminal, Database, Trash2, RefreshCw } from 'lucide-react';
import { seedMockTransactions, clearDemoPayments } from '../../lib/seed';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeConnections: 0,
    totalTrades: 0,
    revenue: 0
  });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  const { profile } = useAuth();

  const handleSeed = async () => {
    if (!confirm("Générer des données de démonstration (trades & transactions) ?")) return;
    setIsSeeding(true);
    try {
      await seedMockTransactions(20);
      toast.success("Données générées !");
    } catch (error) {
      toast.error("Erreur lors du seeding.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Supprimer TOUTES les données marquées comme 'Démo' ?")) return;
    setIsSeeding(true);
    try {
      await clearDemoPayments();
      // Also clear demo trades if applicable (already handled by clearDemoPayments in some implementations)
      toast.success("Nettoyage terminé !");
    } catch (error) {
      toast.error("Erreur lors du nettoyage.");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'agent' && profile.email !== 'kongolmandf@gmail.com')) {
      return;
    }

    // 1. Fetch Total Users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
      
      let rev = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.subscription === 'pro') rev += 15.99;
        if (data.subscription === 'premium') rev += 22.99;
      });
      setStats(prev => ({ ...prev, revenue: rev }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // 2. Fetch Active Connections
    const unsubscribeConns = onSnapshot(collection(db, 'broker_connections'), (snapshot) => {
      const active = snapshot.docs.filter(d => d.data().status === 'active').length;
      setStats(prev => ({ ...prev, activeConnections: active }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'broker_connections');
    });

    // 3. Fetch Global Recent Trades (using collectionGroup)
    const qTrades = query(collectionGroup(db, 'trades'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeTrades = onSnapshot(qTrades, async (snapshot) => {
      const trades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      // Enrich trades with user names
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const userMap: Record<string, any> = {};
        usersSnap.docs.forEach(d => userMap[d.id] = d.data());

        const enrichedTrades = trades.map(t => {
          const profile = userMap[t.userId];
          return {
            ...t,
            userName: profile?.displayName || profile?.name || profile?.email?.split('@')[0] || t.userId.substring(0, 8)
          };
        });
        setRecentTrades(enrichedTrades);

        // Update activities with trades
        setRecentActivities(prev => {
          const otherActivities = prev.filter(a => a.type !== 'trade');
          const tradeActivities = enrichedTrades.slice(0, 5).map(t => ({
            id: `trade-${t.id}`,
            msg: `Nouveau trade: ${t.userName} - ${t.pair} (${t.direction})`,
            time: t.createdAt,
            type: 'trade'
          }));
          return [...otherActivities, ...tradeActivities].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
        });
      } catch (err) {
        console.error("Enrichment error:", err);
        setRecentTrades(trades);
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trades (collectionGroup)');
    });

    // 4. Fetch recent users for activities
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeRecentUsers = onSnapshot(qUsers, (snapshot) => {
      const newUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      
      setRecentActivities(prev => {
        const otherActivities = prev.filter(a => a.type !== 'user');
        const userActivities = newUsers.map(u => ({
          id: `user-${u.id}`,
          msg: `Nouveau client: ${u.displayName || u.email || u.id}`,
          time: u.createdAt,
          type: 'user'
        }));
        return [...otherActivities, ...userActivities].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users (recent)');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeConns();
      unsubscribeTrades();
      unsubscribeRecentUsers();
    };
  }, [profile]);

  const statCards = [
    { label: 'Utilisateurs Totaux', value: stats.totalUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Connexions Actives', value: stats.activeConnections, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Revenu Mensuel (Est.)', value: formatCurrency(stats.revenue), icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Niveau de Sécurité', value: 'Optimal', icon: Shield, color: 'text-zoya-red', bg: 'bg-zoya-red-accent' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Console d'Administration</h1>
          <p className="text-gray-500 dark:text-gray-400">Vue d'ensemble de l'écosystème ZoyaEdge en temps réel.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleClear}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-rose-500/20 font-bold text-sm hover:bg-rose-600 transition-all disabled:opacity-50"
          >
            <Trash2 size={18} />
            Reset Demo
          </button>
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 font-bold text-sm hover:bg-indigo-600 transition-all disabled:opacity-50"
          >
            {isSeeding ? <RefreshCw className="animate-spin" size={18} /> : <Database size={18} />}
            Seed Mock Data
          </button>
          <div className="w-px h-8 bg-gray-100 dark:bg-gray-700 mx-2 self-center" />
          <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-zoya-red">
            <Terminal size={20} />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-poppins font-black text-gray-900 dark:text-white mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Global Trade Feed */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-zoya-red" />
              Flux de Trading Global
            </h2>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-bold animate-pulse">
              LIVE
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Utilisateur</th>
                  <th className="px-6 py-4">Pair</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">PnL</th>
                  <th className="px-6 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {recentTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <User size={14} className="text-gray-400" />
                        </div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[100px]">
                          {trade.userName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-poppins font-black text-gray-900 dark:text-white">{trade.pair}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        trade.direction === 'buy' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 font-poppins font-black",
                      trade.pnl >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {formatCurrency(trade.pnl)}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {format(trade.date, 'HH:mm:ss')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Alerts / Logs */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg p-6">
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Clock size={20} className="text-gray-400" />
            Activités Système
          </h2>
          <div className="space-y-6">
            {recentActivities.length > 0 ? recentActivities.map((log) => {
              // Calculate time ago
              const diffMs = new Date().getTime() - log.time.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMins / 60);
              const diffDays = Math.floor(diffHours / 24);
              
              let timeStr = 'À l\'instant';
              if (diffDays > 0) timeStr = `Il y a ${diffDays} j`;
              else if (diffHours > 0) timeStr = `Il y a ${diffHours} h`;
              else if (diffMins > 0) timeStr = `Il y a ${diffMins} min`;

              return (
                <div key={log.id} className="flex gap-4">
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                    log.type === 'user' ? "bg-blue-500" : "bg-emerald-500"
                  )} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{log.msg}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">{timeStr}</p>
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">Aucune activité récente.</p>
            )}
          </div>
          <button className="w-full mt-8 py-3 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs font-bold rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
            Voir tous les logs
          </button>
        </div>
      </div>
    </div>
  );
}
