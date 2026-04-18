import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, Timestamp, where } from 'firebase/firestore';
import { DollarSign, TrendingUp, Users, CreditCard, ArrowUpRight, ArrowDownRight, Calendar, Filter, Download, Wallet, Database, RefreshCw, Trash2 } from 'lucide-react';
import { seedMockTransactions, clearDemoPayments } from '../../lib/seed';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area 
} from 'recharts';

interface PaymentRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  plan: 'pro' | 'premium';
  method: 'stripe' | 'paypal' | 'crypto';
  createdAt: Timestamp;
  isDemo?: boolean;
}

export default function FinanceManagement() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    activeSubscriptions: 0,
    conversionRate: 0,
    chartData: [] as { name: string, revenue: number }[]
  });

  const handleSeed = async () => {
    if (!confirm("Générer 20 transactions fictives pour la démonstration ?")) return;
    setIsSeeding(true);
    try {
      await seedMockTransactions(20);
      alert("Transactions générées avec succès !");
    } catch (error) {
      console.error(error);
      alert("Erreur lors du seeding.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearDemo = async () => {
    if (!confirm("Supprimer toutes les données de démonstration ?")) return;
    setIsSeeding(true);
    try {
      await clearDemoPayments();
      alert("Données de démo supprimées !");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la suppression.");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentRecord);
      
      // Filter based on toggle
      const data = allData.filter(p => showDemo || !p.isDemo);
      
      setPayments(data);
      
      // Calculate basic stats
      const total = data.reduce((acc, curr) => acc + (curr.status === 'completed' ? curr.amount : 0), 0);
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthly = data.reduce((acc, curr) => {
        if (curr.status === 'completed' && curr.createdAt.toDate() >= firstDayOfMonth) {
          return acc + curr.amount;
        }
        return acc;
      }, 0);

      // Calculate chart data from payments
      const monthlyData: { [key: string]: number } = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      data.forEach(p => {
        if (p.status === 'completed') {
          const date = p.createdAt.toDate();
          const monthName = months[date.getMonth()];
          monthlyData[monthName] = (monthlyData[monthName] || 0) + p.amount;
        }
      });

      const formattedChartData = months
        .map((name, index) => ({ name, revenue: monthlyData[name] || 0 }))
        .filter((_, i) => i <= now.getMonth());

      setStats(prev => ({
        ...prev,
        totalRevenue: total,
        monthlyRevenue: monthly,
        chartData: formattedChartData
      }));
      setLoading(false);
    });

    // Fetch user stats for conversion/subscriptions
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data());
      const active = users.filter(u => u.subscription !== 'free').length;
      const totalUsers = users.length;
      setStats(prev => ({
        ...prev,
        activeSubscriptions: active,
        conversionRate: totalUsers > 0 ? (active / totalUsers) * 100 : 0
      }));
    });

    return () => {
      unsubscribe();
      unsubUsers();
    };
  }, []);

  const chartData = [
    { name: 'Jan', revenue: 4500 },
    { name: 'Feb', revenue: 5200 },
    { name: 'Mar', revenue: 4800 },
    { name: 'Apr', revenue: stats.monthlyRevenue || 6100 },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Gestion Financière</h1>
          <p className="text-gray-500 dark:text-gray-400">Suivi des revenus, abonnements et performances comptables.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowDemo(!showDemo)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-all",
              showDemo 
                ? "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800" 
                : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            )}
          >
            {showDemo ? "Cacher Démo" : "Voir Démo"}
          </button>
          <button 
            onClick={handleClearDemo}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-rose-500/20 font-bold text-sm hover:bg-rose-600 transition-colors disabled:opacity-50"
          >
            <Trash2 size={18} />
            Nettoyer Démo
          </button>
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/20 font-bold text-sm hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {isSeeding ? <RefreshCw className="animate-spin" size={18} /> : <Database size={18} />}
            Seed Demo Data
          </button>
          <button className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 font-bold text-sm">
            <Calendar size={18} className="text-indigo-500" />
            Ce Mois
          </button>
          <button className="flex items-center gap-2 bg-zoya-red text-white px-6 py-2 rounded-xl shadow-lg shadow-zoya-red/20 font-bold text-sm">
            <Download size={18} />
            Exporter Rapport
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Revenu Total', value: `${stats.totalRevenue.toLocaleString()}$`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', trend: '+12.5%' },
          { label: 'Revenu Mensuel', value: `${stats.monthlyRevenue.toLocaleString()}$`, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', trend: '+8.2%' },
          { label: 'Abonnés Actifs', value: stats.activeSubscriptions, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', trend: '+5.1%' },
          { label: 'Taux Conversion', value: `${stats.conversionRate.toFixed(1)}%`, icon: CreditCard, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', trend: '+2.4%' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon size={24} className={stat.color} />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                <ArrowUpRight size={10} />
                {stat.trend}
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-poppins font-black text-gray-900 dark:text-white mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Croissance des Revenus</h3>
              <p className="text-sm text-gray-500">Evolution du chiffre d'affaires mensuel.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-zoya-red" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">Revenu</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `${value}$`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: 'none', 
                    borderRadius: '16px',
                    color: '#fff',
                    padding: '12px'
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#DC2626" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-6">Répartition par Plan</h3>
          <div className="space-y-6 flex-1">
            {[
              { label: 'Calculated (Pro)', count: stats.activeSubscriptions * 0.6, total: stats.activeSubscriptions, color: 'bg-emerald-500' },
              { label: 'Calculated (Premium)', count: stats.activeSubscriptions * 0.4, total: stats.activeSubscriptions, color: 'bg-indigo-500' },
            ].map((plan) => (
              <div key={plan.label} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-600 dark:text-gray-400">{plan.label === 'Calculated (Pro)' ? 'Zoya Pro' : 'Zoya Premium'}</span>
                  <span className="font-black text-gray-900 dark:text-white">{Math.round(plan.count)} clients</span>
                </div>
                <div className="h-3 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(plan.count / (plan.total || 1)) * 100}%` }}
                    className={cn("h-full rounded-full", plan.color)}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-3xl">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl">
                <Wallet className="text-zoya-red" size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Payout Prochain</p>
                <p className="text-lg font-black text-gray-900 dark:text-white">Dans 12 jours</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-gray-800 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Transactions Récentes</h3>
          <button className="text-zoya-red hover:text-zoya-red/80 font-black text-sm flex items-center gap-2">
            Voir tout <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-4">Client / ID</th>
                <th className="px-8 py-4">Plan</th>
                <th className="px-8 py-4">Montant</th>
                <th className="px-8 py-4">Méthode</th>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {payments.length > 0 ? payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{payment.userId}</p>
                        <p className="text-[10px] text-gray-400">ID: {payment.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                      payment.plan === 'premium' ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {payment.plan}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <p className="font-black text-gray-900 dark:text-white">{payment.amount} {payment.currency}</p>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-gray-400" />
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">{payment.method}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <p className="text-xs font-bold text-gray-500 whitespace-nowrap">
                      {format(payment.createdAt.toDate(), 'dd MMM yyyy, HH:mm', { locale: fr })}
                    </p>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                      payment.status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                      payment.status === 'pending' ? "bg-amber-100 text-amber-600" :
                      "bg-rose-100 text-rose-600"
                    )}>
                      {payment.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center">
                    <div className="bg-gray-50 dark:bg-gray-900 inline-block p-4 rounded-3xl mb-4">
                      <DollarSign size={32} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-bold">Aucune transaction trouvée.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
