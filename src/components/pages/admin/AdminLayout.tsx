import { Link, Outlet, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function AdminLayout() {
  const location = useLocation();
  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: Icons.LayoutDashboard },
    { name: 'Transactions', path: '/admin/transactions', icon: Icons.CreditCard },
    { name: 'Users', path: '/admin/users', icon: Icons.Users },
    { name: 'AI Monitoring', path: '/admin/ai', icon: Icons.BrainCircuit },
    { name: 'Logs', path: '/admin/logs', icon: Icons.ListChecks },
    { name: 'Settings', path: '/admin/settings', icon: Icons.Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-64 border-r border-gray-800 p-6">
        <div className="font-black text-2xl mb-10 text-white">Zoya<span className="text-zoya-red">Edge</span> Admin</div>
        <nav className="space-y-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl font-bold transition-all",
                  isActive ? "bg-zoya-red text-white" : "text-gray-400 hover:bg-gray-900 hover:text-white"
                )}
              >
                <Icon size={20} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
