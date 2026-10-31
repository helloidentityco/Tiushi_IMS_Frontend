import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Lock, 
  History, 
  FileText, 
  KeyRound, 
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Users,
  UserPlus,
  Key,
  Trash2,
  X,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';
import { roles } from '../../utils/constants';
import RoleMatrix from './RoleMatrix';

export default function SecurityRBAC() {
  const { currentRole, logAudit, formatCurrency, permissionsMatrix, togglePermission, authUser } = useApp();

  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  const isAdmin = currentRole?.toLowerCase() === 'admin';
  const activeRoleObj = roles.find(r => r.id === currentRole) || roles[0];

  // User Management State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier',
    status: 'Active'
  });

  // Edit Password Modal State
  const [editingUserPassword, setEditingUserPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Fetch real users from backend API
  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const res = await api.get('/users');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch users from backend API:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Safely retrieve audit logs from indexedDB if present
    const req = window.indexedDB?.open('IdentityDB');
    if (req) {
      req.onsuccess = (e) => {
        try {
          const idb = e.target.result;
          if (idb.objectStoreNames.contains('auditLogs')) {
            const tx = idb.transaction('auditLogs', 'readonly');
            const store = tx.objectStore('auditLogs');
            const getAllReq = store.getAll();
            getAllReq.onsuccess = () => {
              if (Array.isArray(getAllReq.result)) {
                setAuditLogs(getAllReq.result.reverse().slice(0, 50));
              }
            };
          }
        } catch {
          // ignore
        }
      };
    }
  }, []);

  const roleDisplayNames = {
    manager: 'Store Manager',
    'store manager': 'Store Manager',
    warehouse: 'Warehouse Staff',
    'warehouse staff': 'Warehouse Staff',
    cashier: 'Cashier',
    admin: 'Admin'
  };

  const getRoleBadge = (roleKey) => {
    const lower = (roleKey || '').toLowerCase();
    const badges = {
      admin: { label: 'Admin (Full Access)', badgeColor: 'bg-purple-950/70 border-purple-800 text-purple-300' },
      manager: { label: 'Store Manager', badgeColor: 'bg-blue-950/70 border-blue-800 text-blue-300' },
      'store manager': { label: 'Store Manager', badgeColor: 'bg-blue-950/70 border-blue-800 text-blue-300' },
      warehouse: { label: 'Warehouse Staff', badgeColor: 'bg-amber-950/70 border-amber-800 text-amber-300' },
      'warehouse staff': { label: 'Warehouse Staff', badgeColor: 'bg-amber-950/70 border-amber-800 text-amber-300' },
      cashier: { label: 'Cashier (POS Focus)', badgeColor: 'bg-emerald-950/70 border-emerald-800 text-emerald-300' }
    };
    return badges[lower] || { label: roleKey, badgeColor: 'bg-slate-900 border-slate-700 text-slate-300' };
  };

  // Create user via Backend API with cloud database persistence
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserFormError('');

    const cleanEmail = newUserForm.email.trim().toLowerCase();
    const cleanPassword = newUserForm.password.trim();
    const cleanName = newUserForm.name.trim();

    if (!cleanEmail || !cleanPassword) {
      setUserFormError('Email and Password are required.');
      return;
    }

    if (cleanPassword.length < 4) {
      setUserFormError('Password must be at least 4 characters long.');
      return;
    }

    try {
      setIsSubmittingUser(true);
      await api.post('/users', {
        name: cleanName || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: cleanPassword,
        role: newUserForm.role,
        status: newUserForm.status || 'Active'
      });

      await logAudit?.(
        'User Created',
        'Security & Access Control',
        `Admin created new user account: ${cleanEmail} with role ${newUserForm.role}`
      );

      await fetchUsers();
      setShowAddUserModal(false);
      setNewUserForm({
        name: '',
        email: '',
        password: '',
        role: 'cashier',
        status: 'Active'
      });
    } catch (err) {
      console.error('Failed to create user:', err);
      setUserFormError(err.response?.data?.message || 'Failed to create user: ' + err.message);
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Modify user password via Backend API
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!editingUserPassword) return;

    const cleanPassword = newPassword.trim();
    if (!cleanPassword || cleanPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters long.');
      return;
    }

    try {
      await api.put(`/users/${editingUserPassword.id}`, {
        password: cleanPassword
      });

      await logAudit?.(
        'User Password Modified',
        'Security & Access Control',
        `Admin updated password for user account: ${editingUserPassword.email}`
      );

      await fetchUsers();
      setEditingUserPassword(null);
    } catch (err) {
      console.error('Failed to update password:', err);
      setPasswordError(err.response?.data?.message || 'Failed to update password: ' + err.message);
    }
  };

  // Safe delete user account via Backend API with self-deletion safeguard
  const handleDeleteUser = async (userToDelete) => {
    if (!userToDelete) return;

    // Frontend Safeguard: Prevent deleting own account
    const isSelf = Boolean(
      (authUser?.id && userToDelete.id === authUser.id) ||
      (authUser?.email && userToDelete.email?.toLowerCase() === authUser.email?.toLowerCase())
    );

    if (isSelf) {
      alert('Security Protection: You cannot delete your currently authenticated account.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the account for "${userToDelete.email}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setIsDeletingUser(userToDelete.id);
      await api.delete(`/users/${userToDelete.id}`);
      await logAudit?.(
        'User Deleted',
        'Security & Access Control',
        `Admin deleted user account: ${userToDelete.email}`
      );
      await fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert(err.response?.data?.message || 'Failed to delete user.');
    } finally {
      setIsDeletingUser(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Security &amp; Role-Based Access Control</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              RBAC Guard
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable audit trail logs and real-time security privilege matrix governance.
          </p>
        </div>
      </div>

      {/* Active Session Security Profile (Read-Only) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Active Authenticated Session
              </h3>
              <p className="text-xs text-slate-400">
                Bound to signed-in user credentials (role changes require authentication)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500">Current Role:</span>
            <span className={`text-xs font-bold py-1 px-3 rounded-xl border select-none ${activeRoleObj.badgeColor}`}>
              {activeRoleObj.label}
            </span>
          </div>
        </div>
      </div>

      {/* Permissions Matrix (Admin-Only Visibility) */}
      {isAdmin && <RoleMatrix />}

      {/* User Access Management (Strictly visible ONLY if activeRole === 'Admin') */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>User Access Management</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {users.length} Registered Accounts
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage operational user accounts, roles, access levels, and credentials.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewUserForm({
                  name: '',
                  email: '',
                  password: '',
                  role: 'cashier',
                  status: 'Active'
                });
                setUserFormError('');
                setShowAddUserModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Loading user accounts from cloud database...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No user accounts found in database.
                    </td>
                  </tr>
                ) : (
                  users.map(u => {
                    const roleBadge = getRoleBadge(u.role);
                    const isSelf = Boolean(
                      (authUser?.id && u.id === authUser.id) ||
                      (authUser?.email && u.email?.toLowerCase() === authUser.email?.toLowerCase())
                    );
                    return (
                      <tr key={u.id || u.email} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0">
                            {(u.name || u.email || 'U')[0].toUpperCase()}
                          </div>
                          <span className="truncate">{u.name || u.email.split('@')[0]}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                          {u.email}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${roleBadge.badgeColor}`}>
                            {roleBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.status?.toLowerCase() === 'inactive'
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status?.toLowerCase() === 'inactive' ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
                            <span>{u.status || 'Active'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserPassword(u);
                                setNewPassword('');
                                setPasswordError('');
                                setShowNewPassword(false);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer active:scale-95 shadow-xs"
                              title={`Change password for ${u.email}`}
                            >
                              <Key className="w-3.5 h-3.5 text-amber-500" />
                              <span>Edit Password</span>
                            </button>

                            {/* Safe Delete Account Button with Self-Account Safeguard */}
                            {isSelf ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 text-xs font-medium border border-slate-200 dark:border-slate-800 cursor-not-allowed select-none"
                                title="You cannot delete your currently authenticated account"
                              >
                                <span>(You)</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                disabled={isDeletingUser === u.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer active:scale-95 shadow-xs"
                                title={`Delete account for ${u.email}`}
                              >
                                {isDeletingUser === u.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                )}
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Immutable Audit Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            Immutable Audit Trail Logs
          </h3>
          <span className="text-xs text-slate-400">
            {auditLogs.length} Events Logged
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {log.userName}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                    {log.module}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-md truncate">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                <span>Add New User Account</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {userFormError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{userFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jdoe@mail.com"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 4 characters"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    System Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="warehouse">Warehouse Staff</option>
                    <option value="manager">Store Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Account Status
                  </label>
                  <select
                    value={newUserForm.status}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingUser ? 'Creating...' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Password */}
      {editingUserPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                <span>Modify User Password</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingUserPassword(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Enter a new secure password for <strong className="text-slate-800 dark:text-slate-200">{editingUserPassword.email}</strong>.
            </p>

            {passwordError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter new password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(prev => !prev)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUserPassword(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
