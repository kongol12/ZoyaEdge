import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import * as Icons from 'lucide-react';

import { motion } from 'motion/react';
import { useAuth } from '../../../lib/auth';
import { cn } from '../../../lib/utils';

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isCollapsed, onToggle, className }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const menuItems = [
    { icon: Icons.LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
    { icon: Icons.DollarSign, label: 'Finances', path: '/admin/finance', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
    { icon: Icons.CreditCard, label: 'Tarification', path: '/admin/pricing', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' },
    { icon: Icons.CreditCard, label: 'Transactions', path: '/admin/transactions', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
    { icon: Icons.Terminal, label: 'Activités Système', path: '/admin/activities', color: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20' },
    { icon: Icons.BarChart3, label: 'Rapports Trades', path: '/admin/trade-reports', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' },
    { icon: Icons.PieChart, label: 'Abonnements', path: '/admin/subscription-reports', color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' },
    { icon: Icons.Users, label: 'Clients', path: '/admin/clients', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
    { icon: Icons.Users, label: 'Utilisateurs (Équipe)', path: '/admin/users', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
    { icon: Icons.Activity, label: 'Connexions EA', path: '/admin/connections', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
    { icon: Icons.Bug, label: 'Bugs & Rapports', path: '/admin/reports', color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' },
    { icon: Icons.Bell, label: 'Notifications', path: '/admin/notifications', color: 'text-red-500 bg-red-50 dark:bg-red-900/20', badge: unreadCount },
    { icon: Icons.BrainCircuit, label: 'Monitoring IA', path: '/admin/ai', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' },
    { icon: Icons.Terminal, label: 'Logs Système', path: '/admin/logs', color: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20' },
    { icon: Icons.Settings, label: 'Paramètres', path: '/admin/settings', color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/40' },
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        "bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col fixed h-full z-40",
        className
      )}
    >
      <div className={cn("p-6 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zoya-red rounded-xl flex items-center justify-center text-white font-poppins font-black text-lg shadow-lg shadow-zoya-red/20">
              Z
            </div>
            <span className="text-lg font-poppins font-black text-gray-900 dark:text-white tracking-tight">AdminPanel</span>
          </div>
        )}
        <button 
          onClick={onToggle} 
          className="p-2 text-gray-500 hover:text-zoya-red dark:text-gray-400 dark:hover:text-zoya-red transition-colors rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {isCollapsed ? <Icons.Menu size={20} /> : <Icons.ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto scrollbar-hide py-2 pb-8">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            title={isCollapsed ? item.label : ""}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative",
              isCollapsed ? "justify-center" : "",
              location.pathname === item.path
                ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20 font-black"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-bold"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
              location.pathname === item.path ? "bg-white/20 text-white" : (item.color || "bg-gray-50 dark:bg-gray-900 text-gray-400")
            )}>
              <item.icon size={18} />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-zoya-red text-white text-[7px] flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
                  {item.badge}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 flex justify-between items-center text-sm">
                <span>{item.label}</span>
              </div>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto p-4 space-y-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => navigate('/')}
          title={isCollapsed ? "Vue Client" : ""}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-poppins font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all",
            isCollapsed ? "justify-center" : ""
          )}
        >
          <Icons.ExternalLink size={20} className="shrink-0" />
          {!isCollapsed && <span>Vue Client</span>}
        </button>
        <button
          onClick={() => logout()}
          title={isCollapsed ? "Déconnexion" : ""}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-poppins font-bold text-gray-500 hover:text-zoya-red transition-all",
            isCollapsed ? "justify-center" : ""
          )}
        >
          <Icons.LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </motion.aside>
  );
};
