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
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (UserProfile & { id: string })[];
      
      // Sort by creation date
      const sorted = data.sort((a, b) => {
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
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error("Error deleting user:", error);
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
      u.subscription || 'free',
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
      Abonnement: u.subscription || 'free',
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
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Gestion de l'Équipe</h1>
          <p className="text-gray-500 dark:text-gray-400">Gérez les rôles et les accès des agents et administrateurs.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isSuper && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-zoya-red text-white px-6 py-3 rounded-2xl shadow-lg shadow-zoya-red/20 font-poppins font-black text-sm hover:bg-zoya-red/90 transition-all"
            >
              <UserPlus size={18} />
              Nouveau Compte
            </button>
          )}

          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 px-6 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              <FileDown size={18} className="text-zoya-red" />
              Exporter la Liste
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

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
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
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{user.displayName || 'Sans nom'}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.role || 'user'}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                      className={cn(
                        "text-xs font-bold px-3 py-1.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-zoya-red transition-all",
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
                      value={user.subscription || 'free'}
                      onChange={(e) => handleUpdateSubscription(user.id, e.target.value)}
                      className={cn(
                        "text-xs font-bold px-3 py-1.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-zoya-red transition-all",
                        user.subscription === 'premium' ? "bg-orange-100 text-orange-600" :
                        user.subscription === 'pro' ? "bg-emerald-100 text-emerald-600" :
                        "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      )}
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="premium">Premium</option>
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
