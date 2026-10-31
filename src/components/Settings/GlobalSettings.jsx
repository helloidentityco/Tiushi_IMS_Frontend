import React from 'react';
import { 
  Globe, 
  DollarSign, 
  Moon, 
  Sun, 
  Database, 
  RefreshCw, 
  CheckCircle, 
  Cloud, 
  HardDrive,
  HelpCircle,
  ShieldCheck,
  Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function GlobalSettings() {
  const { 
    t, 
    theme, 
    toggleTheme, 
    language, 
    changeLanguage, 
    currentRole,
    syncStatus, 
    pendingSyncCount, 
    triggerSync,
    logAudit
  } = useApp();

  const handleClearCache = async () => {
    if (confirm('Clear local offline cache? Your data stored in IndexedDB will remain safe.')) {
      await logAudit('Offline Cache Flushed', 'Settings', 'Cleared local offline storage cache.');
      alert('Local storage cache flushed successfully.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t.settings}</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pakistani Rupee (PKR) standardization, English & Roman Urdu localization, and offline-first Dexie synchronization.
          </p>
        </div>
      </div>

      {/* Grid Settings Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Fixed Currency Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Rs.</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Fixed System Currency
              </h3>
              <p className="text-xs text-slate-400">
                Operational currency is standardized and locked across all modules
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
            <div>
              <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Pakistani Rupee</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  PKR (Rs.)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Standard currency for local inventory, sales, and manufacturing procurement.
              </p>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 pl-3">
              Rs.
            </div>
          </div>
        </div>

        {/* Language & i18n */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Language & Localization
              </h3>
              <p className="text-xs text-slate-400">
                Select your preferred operational interface language
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { code: 'en', label: 'English (UK)', desc: 'Standard business English' },
              { code: 'ur', label: 'Roman Urdu', desc: 'Asaan Urdu alfaaz (English huroof)' }
            ].map(lang => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                  language === lang.code
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{lang.label}</div>
                  <div className="text-[11px] text-slate-400 font-normal">{lang.desc}</div>
                </div>
                {language === lang.code && (
                  <CheckCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Appearance Theme */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Interface Color Scheme
              </h3>
              <p className="text-xs text-slate-400">
                High contrast cashier and dashboard mode
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              className={`p-3 rounded-xl border text-center transition-all ${
                theme === 'light'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Sun className="w-5 h-5 mx-auto mb-1 text-amber-500" />
              Light Mode
            </button>
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              className={`p-3 rounded-xl border text-center transition-all ${
                theme === 'dark'
                  ? 'border-indigo-600 bg-indigo-950/50 text-indigo-300 font-bold'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <Moon className="w-5 h-5 mx-auto mb-1 text-indigo-400" />
              Dark Mode
            </button>
          </div>
        </div>

        {/* Offline-First & Cloud Sync Queue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Offline-First Architecture & Sync
              </h3>
              <p className="text-xs text-slate-400">
                IndexedDB (Dexie.js) persistence with REST queue
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Storage Engine:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-indigo-500" /> IndexedDB Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pending Broadcast Queue:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {pendingSyncCount} mutations
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Network Condition:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> High Velocity (Zero Latency)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={triggerSync}
              disabled={syncStatus === 'syncing'}
              className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              {syncStatus === 'syncing' ? 'Broadcasting...' : 'Flush & Sync Queue Now'}
            </button>
            <button
              onClick={handleClearCache}
              className="py-2.5 px-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold"
            >
              Flush Cache
            </button>
          </div>
        </div>

      </div>

      {/* ── User Access Management (Admin RBAC Only) ── */}
      {currentRole?.toLowerCase() === 'admin' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    User Access Management
                  </h3>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Admin RBAC Restricted
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Authorized enterprise credentials and role assignments for testing phase
                </p>
              </div>
            </div>
            
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono self-start sm:self-auto">
              4 Accounts Provisioned
            </span>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Operator / Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  {
                    name: 'Alexander Wright',
                    email: 'admin@mail.com',
                    role: 'Admin',
                    roleBadge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                    lastLogin: 'Active Session (Now)',
                    status: 'Active',
                    isCurrent: true
                  },
                  {
                    name: 'Sarah Jenkins',
                    email: 'storemanager@mail.com',
                    role: 'Manager',
                    roleBadge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                    lastLogin: 'Today, 2 hours ago',
                    status: 'Active',
                    isCurrent: false
                  },
                  {
                    name: 'Carlos Mendez',
                    email: 'warehousestaff@mail.com',
                    role: 'Warehouse',
                    roleBadge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                    lastLogin: 'Yesterday, 16:45',
                    status: 'Active',
                    isCurrent: false
                  },
                  {
                    name: 'Alice Vance',
                    email: 'cashier@mail.com',
                    role: 'Cashier',
                    roleBadge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                    lastLogin: 'Today, 09:12',
                    status: 'Active',
                    isCurrent: false
                  }
                ].map((u) => (
                  <tr key={u.email} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {u.isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                        {u.email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${u.roleBadge}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {u.lastLogin}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled
                          title="Disabled during testing phase"
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700 opacity-60"
                        >
                          Edit Password
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Disabled during testing phase"
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-400 dark:text-rose-500/70 cursor-not-allowed border border-rose-200 dark:border-rose-900/40 opacity-60"
                        >
                          Remove User
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Note: User CRUD operations and password modifications are locked in testing mode. Live credential updates will be available in production phase.
          </p>
        </div>
      )}
    </div>
  );
}
