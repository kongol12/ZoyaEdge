import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { Users, Shield, Crown, User as UserIcon, Trash2, CheckCircle, XCircle, MoreVertical, Settings, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { UserProfile, useAuth } from '../../lib/auth';
import UserDetailModal from '../../components/admin/UserDetailModal';
import CreateUserModal from '../../components/admin/CreateUserModal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { OperationType, handleFirestoreError } from '../../lib/db';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const [users, setUsers] = useState<(UserProfile & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<(UserProfile & { id: string }) | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSuper, setIsSuper] = useState(false);

  const { profile, isSuperAdmin, user } = useAuth();

  useEffect(() => {
    const checkSuper = async () => {
      const res = await isSuperAdmin(user?.email);
      setIsSuper(res);
    };
    checkSuper();
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'agent' && !isSuper)) {
      return;
    }

    // Fetch all users
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const PRIMARY_EMAIL = import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase();
      
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (UserProfile & { id: string })[];
      
      // Dans admin utilisateur (équipe) je dois juste voir les utilisateurs qui ont été crée par le super admin
      // et non tout le nouveau client.
      const filtered = data.filter(u => {
        const isTeam = u.role === 'admin' || u.role === 'agent';
        const isCreatedByPrimary = u.createdBy?.toLowerCase() === PRIMARY_EMAIL;
        const isPrimaryHimself = u.email?.toLowerCase() === PRIMARY_EMAIL;
        
        return isTeam && (isCreatedByPrimary || isPrimaryHimself);
      });
      
      // Sort by creation date
      const sorted = filtered.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
      });
      
      setUsers(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, [profile]);

  const handleUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', userId), updates);
      toast.success("Utilisateur mis à jour");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success("Utilisateur supprimé");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    await handleUpdateUser(userId, { role: newRole as any });
  };

  const handleUpdateSubscription = async (userId: string, tier: string) => {
    await handleUpdateUser(userId, { 
      subscription: tier as any,
      subscriptionStatus: 'active',
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
    });
  };

  const handleUpdateCredits = async (userId: string, credits: number) => {
    await handleUpdateUser(userId, { aiCredits: credits });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('ZoyaEdge - Liste des Utilisateurs', 14, 15);
    
    const tableData = users.map(u => [
      u.displayName || 'N/A',
      u.email,
      u.role || 'user',
      u.subscription || 'discovery',
      u.aiCredits || 0,
      u.subscriptionStatus || 'inactive'
    ]);

    (doc as any).autoTable({
      head: [['Nom', 'Email', 'Rôle', 'Plan', 'Crédits', 'Statut']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      headStyles: { fillStyle: [220, 38, 38] } // Zoya Red
    });

    doc.save(`zoyaedge_users_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(users.map(u => ({
      Nom: u.displayName || 'N/A',
      Email: u.email,
      Role: u.role || 'user',
      Abonnement: u.subscription || 'discovery',
      Credits_AI: u.aiCredits || 0,
      Statut: u.subscriptionStatus || 'inactive',
      Cree_le: u.createdAt?.toDate?.()?.toLocaleString() || 'N/A'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, `zoyaedge_users_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-poppins font-black text-gray-900 dark:text-white">Gestion de l'Équipe</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Gérez les rôles et les accès des agents et administrateurs.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {isSuper && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zoya-red text-white px-4 md:px-6 py-2.5 md:py-3 rounded-2xl shadow-lg shadow-zoya-red/20 font-poppins font-black text-xs md:text-sm hover:bg-zoya-red/90 transition-all"
            >
              <UserPlus size={18} />
              Nouveau
            </button>
          )}

          <div className="relative flex-1 md:flex-none">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 px-4 md:px-6 py-2.5 md:py-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg font-bold text-xs md:text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              <FileDown size={18} className="text-zoya-red" />
              Exporter
            </button>

            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden"
                >
                  <button 
                    onClick={exportToPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileText size={18} className="text-rose-500" />
                    Format PDF (.pdf)
                  </button>
                  <button 
                    onClick={exportToExcel}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileSpreadsheet size={18} className="text-emerald-500" />
                    Format Excel (.xlsx)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[32px] md:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">Utilisateur</th>
                <th className="px-6 py-4">Rôle</th>
                <th className="px-6 py-4">Abonnement</th>
                <th className="px-6 py-4">Crédits AI</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400 shrink-0">
                        <UserIcon size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-white line-clamp-1">{user.displayName || 'Sans nom'}</p>
                          {user.isEmergencyAdmin && (
                            <span className="shrink-0 text-[8px] bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest border border-rose-200">Secours</span>
                          )}
                          {user.email?.toLowerCase() === import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase() && (
                            <span className="shrink-0 text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest border border-amber-200">Primaire</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.role || 'user'}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                      className={cn(
                        "text-xs font-bold px-3 py-1.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-zoya-red transition-all cursor-pointer",
                        user.role === 'admin' ? "bg-zoya-red text-white" :
                        user.role === 'agent' ? "bg-indigo-100 text-indigo-600" :
                        "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      )}
                    >
                      <option value="user">Client</option>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.subscription || 'discovery'}
                      onChange={(e) => handleUpdateSubscription(user.id, e.target.value)}
                      className={cn(
                        "text-xs font-bold px-3 py-1.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-zoya-red transition-all cursor-pointer",
                        user.subscription === 'premium' ? "bg-orange-100 text-orange-600" :
                        user.subscription === 'pro' ? "bg-emerald-100 text-emerald-600" :
                        "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      )}
                    >
                      <option value="discovery">Discovery</option>
                      <option value="pro">Zoya Pro</option>
                      <option value="premium">Zoya Premium</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="number"
                      value={user.aiCredits || 0}
                      onChange={(e) => handleUpdateCredits(user.id, parseInt(e.target.value))}
                      className="w-20 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-zoya-red"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {user.subscriptionStatus === 'active' ? (
                        <CheckCircle size={14} className="text-emerald-500" />
                      ) : (
                        <XCircle size={14} className="text-gray-300" />
                      )}
                      <span className="text-xs font-medium capitalize">{user.subscriptionStatus || 'Inactif'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setSelectedUser(user)}
                        title="Gérer Profil"
                        className="p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                      >
                        <Settings size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm("Supprimer cet utilisateur ?")) {
                            handleDeleteUser(user.id);
                          }
                        }}
                        title="Supprimer"
                        className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden space-y-4 p-4 divide-y divide-gray-50 dark:divide-gray-700/50">
          {users.map((user) => (
            <div key={user.id} className="pt-4 first:pt-0 pb-4 last:pb-0">
               <div className="flex items-start justify-between mb-3">
                 <div className="flex items-center gap-3 min-w-0">
                   <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 shrink-0">
                     <UserIcon size={20} />
                   </div>
                   <div className="min-w-0">
                     <div className="flex items-center gap-2">
                       <p className="font-bold text-gray-900 dark:text-white truncate">{user.displayName || 'Sans nom'}</p>
                       {user.isEmergencyAdmin && (
                         <span className="shrink-0 text-[7px] bg-rose-100 text-rose-500 px-1 py-0.5 rounded-md font-black uppercase tracking-widest">Secours</span>
                       )}
                       {user.email?.toLowerCase() === import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase() && (
                         <span className="shrink-0 text-[7px] bg-amber-100 text-amber-600 px-1 py-0.5 rounded-md font-black uppercase tracking-widest">Primaire</span>
                       )}
                     </div>
                     <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                   </div>
                 </div>
                 <div className="shrink-0 flex items-center gap-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full", user.subscriptionStatus === 'active' ? "bg-emerald-500" : "bg-gray-300")} />
                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{user.subscriptionStatus || 'Inactif'}</span>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rôle</p>
                    <select 
                      value={user.role || 'user'}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                      className={cn(
                        "w-full text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-zoya-red",
                        user.role === 'admin' ? "bg-zoya-red text-white" :
                        user.role === 'agent' ? "bg-indigo-50 text-indigo-500" :
                        "bg-gray-50 text-gray-500 dark:bg-gray-900"
                      )}
                    >
                      <option value="user">Client</option>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Abonnement</p>
                    <select 
                      value={user.subscription || 'discovery'}
                      onChange={(e) => handleUpdateSubscription(user.id, e.target.value)}
                      className={cn(
                        "w-full text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-zoya-red",
                        user.subscription === 'premium' ? "bg-orange-50 text-orange-600" :
                        user.subscription === 'pro' ? "bg-emerald-50 text-emerald-600" :
                        "bg-gray-50 text-gray-500 dark:bg-gray-900"
                      )}
                    >
                      <option value="discovery">Discovery</option>
                      <option value="pro">Pro</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
               </div>

               <div className="flex items-center justify-between">
                 <div className="flex flex-col gap-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Crédits AI</p>
                    <input 
                      type="number"
                      value={user.aiCredits || 0}
                      onChange={(e) => handleUpdateCredits(user.id, parseInt(e.target.value))}
                      className="w-16 p-1.5 bg-gray-50 dark:bg-gray-900 border border-transparent rounded-lg text-xs font-bold font-mono outline-none"
                    />
                 </div>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedUser(user)}
                      className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl"
                    >
                      <Settings size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("Supprimer cet utilisateur ?")) {
                          handleDeleteUser(user.id);
                        }
                      }}
                      className="p-2.5 bg-rose-50 text-rose-500 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdate={handleUpdateUser}
          onDelete={handleDeleteUser}
        />
      )}

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          // Refresh list if needed, but onSnapshot handles it
        }}
      />
    </div>
  );
}
