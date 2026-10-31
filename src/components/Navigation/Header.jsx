import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sun, 
  Moon, 
  Globe, 
  UserCheck, 
  Warehouse, 
  Bell, 
  Search,
  RefreshCw,
  Sparkles,
  Command,
  LogOut
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { roles } from '../../utils/constants';

export default function Header() {
  const navigate = useNavigate();
  const { 
    theme, 
    toggleTheme, 
    language, 
    changeLanguage, 
    currentRole, 
    activeWarehouseId,
    changeActiveWarehouse,
    setActiveTab,
    syncStatus,
    pendingSyncCount,
    triggerSync,
    logAudit,
    logout
  } = useApp();

  const warehouses = useLiveQuery(() => db.warehouses.toArray(), []) || [];
  const activeWarehouse = warehouses.find(w => w.id === activeWarehouseId);

  const activeRoleObj = roles.find(r => r.id === currentRole) || roles[0];

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-20 transition-colors">
      
      {/* Left: Quick Terminal Search & Warehouse Location */}
      <div className="flex items-center gap-4">
        {/* Terminal Switcher */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
          <Warehouse className="w-3.5 h-3.5 text-indigo-500" />
          <select
            value={activeWarehouseId}
            onChange={(e) => changeActiveWarehouse(e.target.value)}
            className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id} className="dark:bg-slate-900 text-slate-900 dark:text-white">
                {w.code} - {w.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Launch Hotkey Pill */}
        <button
          onClick={() => {
            if (typeof setActiveTab === 'function') setActiveTab('pos');
            navigate('/pos');
          }}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
        >
          <span>Launch POS</span>
          <span className="font-mono bg-indigo-200/60 dark:bg-indigo-900 px-1 rounded text-[10px]">F9</span>
        </button>
      </div>

      {/* Right Controls: Role Switcher, Currency, Language, Theme, Sync */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* Sync Queue Button */}
        <button
          onClick={triggerSync}
          title={`${pendingSyncCount} changes in offline sync queue`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-indigo-500' : 'text-slate-500'}`} />
          <span className="hidden sm:inline font-mono">{pendingSyncCount}</span>
        </button>

        {/* Language Switcher */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="en" className="dark:bg-slate-900">EN (UK)</option>
            <option value="ur" className="dark:bg-slate-900">Roman Urdu</option>
          </select>
        </div>

        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Read-Only Role Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <span 
            className={`text-xs font-bold py-1.5 px-3 rounded-xl border select-none ${activeRoleObj.badgeColor}`}
            title="Assigned Role (Managed via Admin Settings)"
          >
            {activeRoleObj.label}
          </span>

          {/* Sign Out Button */}
          <button
            onClick={logout}
            title="Sign Out"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
}
