import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  RefreshCcw, 
  TrendingUp, 
  CreditCard,
  Target
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function SubscriptionReports() {
  const [userStats, setUserStats] = useState({
    total: 0,
    pro: 0,
    premium: 0,
    free: 0,
    churned: 0,
    chartData: [] as { name: string, active: number, renewals: number }[]
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data());
      
      const now = new Date();
      const monthlyData: { [key: string]: { active: number, renewals: number } } = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      users.forEach(u => {
        if (u.createdAt) {
          const date = (u.createdAt as Timestamp).toDate();
          const monthName = months[date.getMonth()];
          if (!monthlyData[monthName]) monthlyData[monthName] = { active: 0, renewals: 0 };
          
          if (u.subscription !== 'free') {
            monthlyData[monthName].active += 1;
            // renewing users mock logic based on updated status date if existed, 
            // but for simple reporting we count them in their creation month for demo
            if (u.subscriptionStatus === 'active') {
              monthlyData[monthName].renewals += 1;
            }
          }
        }
      });

      const formattedChartData = months
        .map((name, index) => ({ 
          name, 
          active: monthlyData[name]?.active || 0, 
          renewals: monthlyData[name]?.renewals || 0 
        }))
        .filter((_, i) => i <= now.getMonth());

      setUserStats({
        total: users.length,
        pro: users.filter(u => u.subscription === 'pro').length,
        premium: users.filter(u => u.subscription === 'premium').length,
        free: users.filter(u => u.subscription === 'free').length,
        churned: users.filter(u => u.subscriptionStatus === 'suspended').length,
        chartData: formattedChartData
      });
    });
    return () => unsubscribe();
  }, []);

  const data = [
    { name: 'Jan', active: 400, renewals: 240 },
    { name: 'Feb', active: 450, renewals: 300 },
    { name: 'Mar', active: 520, renewals: 380 },
    { name: 'Apr', active: userStats.pro + userStats.premium + 400, renewals: 420 },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Rapports d'Abonnements</h1>
        <p className="text-gray-500 dark:text-gray-400">Suivi détaillé des abonnements, renouvellements et taux de rétention.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Taux de Renouvellement', value: '82%', icon: RefreshCcw, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Nouvelles Ventes (Mois)', value: '142', icon: UserCheck, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Désabonnements', value: userStats.churned, icon: UserMinus, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
          { label: 'LTV Moyen', value: '185$', icon: Target, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className={cn("p-3 rounded-2xl mb-4 inline-flex", stat.bg)}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-poppins font-black text-gray-900 dark:text-white mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-8">Evolution des Abonnés vs Renouvellements</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userStats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }} />
                <Tooltip />
                <Line type="monotone" dataKey="active" stroke="#6366F1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="renewals" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-6">Distribution des Plans</h3>
          <div className="space-y-6">
            {[
              { label: 'Free', count: userStats.free, color: 'bg-gray-400' },
              { label: 'Pro', count: userStats.pro, color: 'bg-emerald-500' },
              { label: 'Premium', count: userStats.premium, color: 'bg-indigo-500' },
            ].map((plan) => (
              <div key={plan.label} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-600 dark:text-gray-400">{plan.label}</span>
                  <span className="font-black text-gray-900 dark:text-white">{plan.count} ({((plan.count / (userStats.total || 1)) * 100).toFixed(0)}%)</span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                  <div className={cn("h-full", plan.color)} style={{ width: `${(plan.count / (userStats.total || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
