import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, Users, Settings, LogOut, ChevronLeft, ExternalLink, Activity, Menu, Bug, Bell, Shield } from 'lucide-react';
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
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Users, label: 'Clients', path: '/admin/clients' },
    { icon: Shield, label: 'Équipe', path: '/admin/users' },
    { icon: Activity, label: 'Connexions EA', path: '/admin/connections' },
    { icon: Bug, label: 'Bugs & Rapports', path: '/admin/reports' },
    { icon: Bell, label: 'Notifications', path: '/admin/notifications', badge: unreadCount },
    { icon: Settings, label: 'Paramètres Système', path: '/admin/settings' },
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
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            title={isCollapsed ? item.label : ""}
            className={cn(
              "flex items-center gap-3 px-4 py-3.5 rounded-2xl font-poppins font-bold transition-all relative",
              isCollapsed ? "justify-center" : "",
              location.pathname === item.path
                ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            <div className="relative">
              <item.icon size={20} className="shrink-0" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-zoya-red text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 flex justify-between items-center">
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && !isCollapsed && (
                  <span className="bg-zoya-red/10 text-zoya-red text-[10px] px-2 py-0.5 rounded-lg">
                    {item.badge}
                  </span>
                )}
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
          <ExternalLink size={20} className="shrink-0" />
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
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </motion.aside>
  );
};
