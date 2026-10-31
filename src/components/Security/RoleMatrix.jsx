import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../api/axiosConfig';
import { useApp } from '../../context/AppContext';

export default function RoleMatrix({ onPermissionChange }) {
  const { logAudit, setPermissionsMatrix: setContextMatrix } = useApp() || {};

  const [matrix, setMatrix] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState(null); // 'itemId-role'

  const roleDisplayNames = {
    manager: 'Store Manager',
    'store manager': 'Store Manager',
    warehouse: 'Warehouse Staff',
    'warehouse staff': 'Warehouse Staff',
    cashier: 'Cashier',
    admin: 'Admin'
  };

  // Fetch live permission matrix from Neon PostgreSQL API
  const fetchPermissions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/permissions');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setMatrix(res.data.data);
        if (setContextMatrix) {
          setContextMatrix(res.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch permission matrix:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  // Handle toggling permission via API
  const handleToggle = async (item, roleKey) => {
    if (roleKey?.toLowerCase() === 'admin') return;

    const roleName = roleDisplayNames[roleKey] || roleKey;
    const currentAllowed = Boolean(item[roleKey]);
    const nextAllowed = !currentAllowed;

    const confirmed = window.confirm(
      `Are you sure you want to ${nextAllowed ? 'grant' : 'deny'} access to "${item.feature}" for ${roleName}?`
    );
    if (!confirmed) return;

    const opKey = `${item.id}-${roleKey}`;
    try {
      setUpdatingKey(opKey);

      const payload = {
        role: roleKey,
        featureId: item.id,
        feature: item.feature,
        isAllowed: nextAllowed
      };

      // Persist to Neon DB via API
      const res = await api.put('/permissions', payload);

      if (res.data?.success && Array.isArray(res.data.data)) {
        setMatrix(res.data.data);
        if (setContextMatrix) {
          setContextMatrix(res.data.data);
        }
        if (onPermissionChange) {
          onPermissionChange(res.data.data);
        }
      } else {
        // Fallback optimistic update upon HTTP 200
        setMatrix(prev =>
          prev.map(p => (p.id === item.id ? { ...p, [roleKey]: nextAllowed } : p))
        );
        if (setContextMatrix) {
          setContextMatrix(prev =>
            prev.map(p => (p.id === item.id ? { ...p, [roleKey]: nextAllowed } : p))
          );
        }
      }

      if (logAudit) {
        await logAudit(
          'RBAC Permission Toggled',
          'Security',
          `Toggled permission for role ${roleName.toUpperCase()}: ${item.feature} to ${nextAllowed ? 'ALLOWED' : 'DENIED'}`
        );
      }
    } catch (err) {
      console.error('Failed to update permission in database:', err);
      alert('Failed to update permission on server. Please try again.');
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Role Permission Matrix &amp; Capabilities</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
              Admin Master Control
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any permission badge to grant or deny access in real time. Changes are persisted directly to the cloud database.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Syncing permissions...</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <th className="py-3 px-4">Feature / Privilege</th>
              <th className="py-3 px-4 text-center">Store Manager</th>
              <th className="py-3 px-4 text-center">Warehouse Staff</th>
              <th className="py-3 px-4 text-center">Cashier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {matrix.map((item, idx) => {
              const isManagerUpdating = updatingKey === `${item.id}-manager`;
              const isWarehouseUpdating = updatingKey === `${item.id}-warehouse`;
              const isCashierUpdating = updatingKey === `${item.id}-cashier`;

              return (
                <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                    {item.feature}
                  </td>

                  {/* Store Manager Column */}
                  <td className="py-2.5 px-4 text-center">
                    <button
                      type="button"
                      disabled={isManagerUpdating}
                      onClick={() => handleToggle(item, 'manager')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer hover:opacity-80 transition-all select-none border shadow-xs disabled:opacity-50 ${
                        item.manager
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900/60'
                      }`}
                      title={`Click to ${item.manager ? 'deny' : 'grant'} permission for Store Manager`}
                    >
                      {isManagerUpdating ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <span className={`w-1.5 h-1.5 rounded-full ${item.manager ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      )}
                      <span>{item.manager ? 'Allowed' : 'Denied'}</span>
                    </button>
                  </td>

                  {/* Warehouse Staff Column */}
                  <td className="py-2.5 px-4 text-center">
                    <button
                      type="button"
                      disabled={isWarehouseUpdating}
                      onClick={() => handleToggle(item, 'warehouse')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer hover:opacity-80 transition-all select-none border shadow-xs disabled:opacity-50 ${
                        item.warehouse
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900/60'
                      }`}
                      title={`Click to ${item.warehouse ? 'deny' : 'grant'} permission for Warehouse Staff`}
                    >
                      {isWarehouseUpdating ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <span className={`w-1.5 h-1.5 rounded-full ${item.warehouse ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      )}
                      <span>{item.warehouse ? 'Allowed' : 'Denied'}</span>
                    </button>
                  </td>

                  {/* Cashier Column */}
                  <td className="py-2.5 px-4 text-center">
                    <button
                      type="button"
                      disabled={isCashierUpdating}
                      onClick={() => handleToggle(item, 'cashier')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer hover:opacity-80 transition-all select-none border shadow-xs disabled:opacity-50 ${
                        item.cashier
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900/60'
                      }`}
                      title={`Click to ${item.cashier ? 'deny' : 'grant'} permission for Cashier`}
                    >
                      {isCashierUpdating ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <span className={`w-1.5 h-1.5 rounded-full ${item.cashier ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      )}
                      <span>{item.cashier ? 'Allowed' : 'Denied'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
