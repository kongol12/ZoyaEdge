import React from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useTranslation } from '../../lib/i18n';
import { User, ShieldCheck, Settings as SettingsIcon, Server, CreditCard } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Settings() {
  const { t } = useTranslation();
  const location = useLocation();

  const settingsTabs = [
    { name: t.common.profile, path: '/settings/profile', icon: User },
    { name: t.common.security, path: '/settings/security', icon: ShieldCheck },
    { name: 'Abonnement', path: '/settings/billing', icon: CreditCard },
    { name: 'Connexions Broker', path: '/settings/connections', icon: Server },
    { name: t.common.preferences, path: '/settings/preferences', icon: SettingsIcon },
  ];

  return (
    <div className="w-full space-y-8">
      <header>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">{t.common.account}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Gérez votre profil, votre sécurité et vos préférences de trading.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl font-poppins font-bold transition-all duration-300 whitespace-nowrap",
                    isActive 
                      ? "bg-zoya-red text-white shadow-lg shadow-zoya-red/20" 
                      : "text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-zoya-red dark:hover:text-zoya-red"
                  )}
                >
                  <Icon size={20} />
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Settings Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
