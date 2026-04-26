import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, Timestamp, getDocs, doc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../../lib/db';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  RefreshCcw, 
  TrendingUp, 
  CreditCard,
  Target,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function SubscriptionReports() {
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamicPricing, setDynamicPricing] = useState({ 
    exchangeRate: 2800,
    proMonthlyUSD: 29,
    premiumMonthlyUSD: 99,
    discoveryMonthlyUSD: 10
  });

  const [userStats, setUserStats] = useState({
    total: 0,
    pro: 0,
    premium: 0,
    discovery: 0,
    free: 0,
    churned: 0,
    mrr: 0,
    ltv: 0,
    conversionRate: 0,
    renewalRate: 0,
    newSalesMonth: 0,
    chartData: [] as any[]
  });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setDynamicPricing({ 
          exchangeRate: data.exchangeRate || 2800,
          proMonthlyUSD: data.proMonthlyUSD || 29,
          premiumMonthlyUSD: data.premiumMonthlyUSD || 99,
          discoveryMonthlyUSD: data.discoveryMonthlyUSD || 10
        });
      }
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => d.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      setPayments(snapshot.docs.map(d => d.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
    });

    return () => {
      unsubSettings();
      unsubUsers();
      unsubPayments();
    };
  }, []);

  useEffect(() => {
    if (users.length === 0 && payments.length === 0) return;

    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData: { [key: string]: { active: number, renewals: number, revenue: number, newSales: number } } = {};
    
    let totalRevenue = 0;
    let activeSubs = 0;
    let churnCount = 0;
    let proCount = 0;
    let premiumCount = 0;
    let freeCount = 0;
    let discoveryCount = 0;
    let newSalesThisMonth = 0;

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Process users for distribution and retention
    users.forEach(u => {
      const sub = u.subscription || 'free';
      const status = u.subscriptionStatus || 'inactive';

      if (sub === 'pro' && status === 'active') proCount++;
      else if (sub === 'premium' && status === 'active') premiumCount++;
      else if (sub === 'discovery' && status === 'active') discoveryCount++;
      else if (sub === 'free') freeCount++;

      if (status === 'suspended') churnCount++;
      if (status === 'active' && sub !== 'free') activeSubs++;
    });

    // Process payments for actual revenue and new sales
    payments.forEach(p => {
      if (p.status === 'completed' && p.amount > 0 && p.createdAt) {
        const date = (p.createdAt as Timestamp).toDate();
        const monthName = months[date.getMonth()];
        if (!monthlyData[monthName]) monthlyData[monthName] = { active: 0, renewals: 0, revenue: 0, newSales: 0 };
        
        const amountUSD = p.currency === 'CDF' ? p.amount / dynamicPricing.exchangeRate : p.amount;
        monthlyData[monthName].revenue += amountUSD;
        totalRevenue += amountUSD;

        if (date >= firstDayOfMonth) {
          newSalesThisMonth++;
        }
      }
    });

    // Sync monthly active counts from users for the chart
    users.forEach(u => {
       if (u.createdAt) {
         const date = (u.createdAt as Timestamp).toDate();
         const monthName = months[date.getMonth()];
         if (monthlyData[monthName] && u.subscription !== 'free') {
           monthlyData[monthName].active++;
           if (u.subscriptionStatus === 'active') monthlyData[monthName].renewals++;
         }
       }
    });

    const mrr = (proCount * dynamicPricing.proMonthlyUSD) + 
                (premiumCount * dynamicPricing.premiumMonthlyUSD) + 
                (discoveryCount * dynamicPricing.discoveryMonthlyUSD);
    const ltv = activeSubs > 0 ? totalRevenue / activeSubs : 0;
    const conversionRate = (proCount + premiumCount + discoveryCount) / (users.length || 1) * 100;
    const renewalRate = activeSubs > 0 ? (activeSubs / (activeSubs + churnCount)) * 100 : 0;

    const formattedChartData = months
      .map((name, index) => ({ 
        name, 
        active: monthlyData[name]?.active || 0, 
        renewals: monthlyData[name]?.renewals || 0,
        revenue: monthlyData[name]?.revenue || 0,
        revenueCDF: (monthlyData[name]?.revenue || 0) * dynamicPricing.exchangeRate
      }))
      .filter((_, i) => i <= now.getMonth());

    setUserStats({
      total: users.length,
      pro: proCount,
      premium: premiumCount,
      discovery: discoveryCount,
      free: freeCount,
      churned: churnCount,
      mrr,
      ltv,
      conversionRate,
      renewalRate,
      newSalesMonth: newSalesThisMonth,
      chartData: formattedChartData
    });
    setLoading(false);
  }, [users, payments, dynamicPricing]);

  const COLORS = ['#94a3b8', '#10b981', '#6366f1'];

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-poppins font-black text-gray-900 dark:text-white flex items-center gap-3">
            <PieChartIcon className="text-zoya-red shrink-0" size={32} />
            <span className="leading-tight">Rapports d'Abonnements</span>
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-bold mt-2">Suivi détaillé des abonnements, renouvellements et taux de rétention.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="flex-1 md:flex-none px-6 py-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center md:items-end">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">MRR Total</span>
            <span className="text-xl font-poppins font-black text-emerald-500">{userStats.mrr.toLocaleString()}$</span>
            <span className="text-[10px] font-bold text-gray-500">{(userStats.mrr * dynamicPricing.exchangeRate).toLocaleString()} FC</span>
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Taux Rétention', value: `${userStats.renewalRate.toFixed(1)}%`, icon: RefreshCcw, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', trend: '+2.4%' },
          { label: 'Ventes (Mois)', value: userStats.newSalesMonth, icon: UserCheck, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', trend: '+12%' },
          { label: 'Conversion', value: `${userStats.conversionRate.toFixed(1)}%`, icon: Target, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', trend: '+1.2%' },
          { label: 'Désabonnements', value: userStats.churned, icon: UserMinus, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20', trend: '-10%' },
          { 
            label: 'LTV Moyen', 
            value: (
              <div className="flex flex-col">
                <span>{userStats.ltv.toFixed(0)}$</span>
                <span className="text-[10px] opacity-60">{(userStats.ltv * dynamicPricing.exchangeRate).toLocaleString()} FC</span>
              </div>
            ), 
            icon: DollarSign, 
            color: 'text-amber-500', 
            bg: 'bg-amber-50 dark:bg-amber-900/20', 
            trend: '+15.5$' 
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform"
          >
            <div className={cn("p-2 md:p-3 rounded-2xl mb-4 inline-flex", stat.bg)}>
              <stat.icon size={20} className={stat.color} />
            </div>
            <div className="absolute top-4 right-4 md:right-8">
              <span className={cn(
                "text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1",
                stat.trend.startsWith('+') ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              )}>
                {stat.trend.startsWith('+') ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {stat.trend}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider">{stat.label}</p>
            <div className="text-2xl md:text-3xl font-poppins font-black text-gray-900 dark:text-white mt-1">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Growth Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 md:mb-10">
            <h3 className="text-base md:text-lg font-poppins font-black text-gray-900 dark:text-white">Evolution des Revenus vs Actifs</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">Actifs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">Revenus ($ / CDF)</span>
              </div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userStats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#9CA3AF' }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#6366F1' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#10B981' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    borderRadius: '24px', 
                    border: 'none', 
                    color: '#fff',
                    padding: '12px 20px'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value: any, name: string) => {
                    if (name === 'revenue') return [`${value.toLocaleString()}$`, 'Revenus ($)'];
                    if (name === 'revenueCDF') return [`${value.toLocaleString()} FC`, 'Revenus (FC)'];
                    if (name === 'active') return [value, 'Abonnés Actifs'];
                    return [value, name];
                  }}
                />
                <Line yAxisId="left" type="monotone" dataKey="active" stroke="#6366F1" strokeWidth={4} dot={{ r: 6, fill: '#6366F1', strokeWidth: 0 }} activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={4} dot={{ r: 6, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="revenueCDF" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution Plan and Health */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm h-full">
            <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-8">Distribution des Plans</h3>
            <div className="space-y-8">
              {[
                { label: 'Free', count: userStats.free, color: 'bg-gray-400', icon: Activity },
                { label: 'Discovery', count: userStats.discovery, color: 'bg-blue-400', icon: ShieldCheck },
                { label: 'Pro', count: userStats.pro, color: 'bg-emerald-500', icon: ShieldCheck },
                { label: 'Premium', count: userStats.premium, color: 'bg-indigo-500', icon: TrendingUp },
              ].map((plan) => (
                <div key={plan.label} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{plan.label}</p>
                      <p className="text-xl font-poppins font-black text-gray-900 dark:text-white">{plan.count}</p>
                    </div>
                    <span className="text-[10px] font-black text-gray-500">
                      {((plan.count / (userStats.total || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(plan.count / (userStats.total || 1)) * 100}%` }}
                      className={cn("h-full", plan.color)} 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-[32px] border border-indigo-100 dark:border-indigo-800/50">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-500 rounded-xl text-white">
                        <Activity size={18} />
                    </div>
                    <p className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-widest">Santé Commerciale</p>
                </div>
                <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold leading-relaxed mt-4">
                    Le taux de conversion actuel à <span className="font-black">{userStats.conversionRate.toFixed(1)}%</span> indique une forte traction sur les plans payants. 
                    Recommandation: Optimiser le funnel Premium pour augmenter le LTV.
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

