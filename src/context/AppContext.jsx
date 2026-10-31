import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase } from '../db/db';
import { translations, currencies } from '../utils/constants';
import api from '../api/axiosConfig';

const AppContext = createContext();

export const normalizeRole = (role) => {
  if (!role) return 'admin';
  const lower = role.toLowerCase().trim();
  if (lower.includes('admin')) return 'admin';
  if (lower.includes('manager')) return 'manager';
  if (lower.includes('warehouse')) return 'warehouse';
  if (lower.includes('cashier')) return 'cashier';
  return lower;
};

export const DEFAULT_PERMISSIONS_MATRIX = [
  { 
    id: 'dashboard', 
    feature: 'Dashboard Analytics & Financial KPIs', 
    admin: true, 
    manager: true, 
    warehouse: false, 
    cashier: false 
  },
  { id: 'pos', feature: 'POS Terminal Sales & Invoicing', admin: true, manager: true, warehouse: false, cashier: true },
  { id: 'discount_override', feature: 'Cart Price Overrides & High Discounts', admin: true, manager: true, warehouse: false, cashier: false },
  { id: 'inventory', feature: 'Product Creation & SKU Generation', admin: true, manager: true, warehouse: false, cashier: false },
  { id: 'transfers', feature: 'Inter-Warehouse Stock Transfers', admin: true, manager: true, warehouse: true, cashier: false },
  { id: 'cycle_counts', feature: 'Cycle Count Audits & Discrepancy Reconciliation', admin: true, manager: true, warehouse: true, cashier: false },
  { id: 'receiving', feature: 'Goods Received Notes (GRN) Inward Signing', admin: true, manager: true, warehouse: true, cashier: false },
  { id: 'suppliers', feature: 'Vendor Purchase Orders (PO) Authorization', admin: true, manager: false, warehouse: false, cashier: false },
  { id: 'reports', feature: 'Stock Valuation & Financial Reports', admin: true, manager: true, warehouse: false, cashier: false },
  { id: 'security', feature: 'Full System Audit Log Review', admin: true, manager: false, warehouse: false, cashier: false }
];

export function AppProvider({ children }) {
  const [isDbReady, setIsDbReady] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [permissionsMatrix, setPermissionsMatrix] = useState(DEFAULT_PERMISSIONS_MATRIX);
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');
  const currency = 'PKR';
  const activeCurrency = currencies.PKR;
  const [currentRole, setCurrentRole] = useState('admin');
  const [activeWarehouseId, setActiveWarehouseId] = useState('wh-3');
  const [warehouses, setWarehouses] = useState([]);
  const liveWarehouses = useLiveQuery(() => db.warehouses.toArray(), []) || [];
  const effectiveWarehouses = liveWarehouses.length > 0 ? liveWarehouses : warehouses;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'pending' | 'syncing'
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Initialize DB and settings
  useEffect(() => {
    async function init() {
      try {
        await seedDatabase();
        const storedTheme = await db.settings.get('3');
        const storedLang = await db.settings.get('2');
        const storedWh = await db.settings.get('4');
        try {
          const permRes = await api.get('/permissions');
          if (permRes.data?.success && Array.isArray(permRes.data.data)) {
            setPermissionsMatrix(permRes.data.data);
          }
        } catch (permErr) {
          console.error('Failed to load permissions from backend API, using defaults:', permErr);
        }
        const whList = await db.warehouses.toArray();
        if (whList && whList.length > 0) setWarehouses(whList);

        if (storedTheme) setTheme(storedTheme.value);
        if (storedLang) setLanguage(storedLang.value);
        if (storedWh) setActiveWarehouseId(storedWh.value);

        const syncCount = await db.syncQueue.where('status').equals('pending').count();
        setPendingSyncCount(syncCount);
        setIsDbReady(true);
      } catch (err) {
        console.error('Failed to init DB:', err);
        setIsDbReady(true);
      }
    }
    init();
  }, []);

  // Session Persistence on initial load via backend HttpOnly cookie
  useEffect(() => {
    async function checkAuthSession() {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success && res.data?.data) {
          const user = res.data.data;
          const normalized = normalizeRole(user.role);
          setIsAuthenticated(true);
          setAuthUser({
            ...user,
            name: user.name || user.email?.split('@')[0],
            role: normalized,
          });
          setCurrentRole(normalized);
        } else {
          setIsAuthenticated(false);
          setAuthUser(null);
        }
      } catch (err) {
        // 401 or network error - user is not authenticated
        setIsAuthenticated(false);
        setAuthUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    }

    checkAuthSession();
  }, []);

  // Sync real warehouses from backend
  useEffect(() => {
    if (isAuthenticated) {
      api.get('/warehouses').then(res => {
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setWarehouses(res.data.data);
          setActiveWarehouseId(prev => {
            if (res.data.data.some(w => w.id === prev)) return prev;
            return res.data.data[0].id;
          });
        }
      }).catch(err => console.error('Failed to sync warehouses in AppContext:', err));
    }
  }, [isAuthenticated]);

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Ensure LTR layout direction
  useEffect(() => {
    document.documentElement.setAttribute('dir', 'ltr');
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await db.settings.put({ id: '3', key: 'theme', value: newTheme });
  };

  const changeLanguage = async (newLang) => {
    setLanguage(newLang);
    await db.settings.put({ id: '2', key: 'language', value: newLang });
  };

  const changeActiveWarehouse = async (whId) => {
    setActiveWarehouseId(whId);
    await db.settings.put({ id: '4', key: 'activeWarehouseId', value: whId });
  };

  // Determine primary functional landing module based on role and permissions
  const getPrimaryLandingTab = (role = currentRole, matrix = permissionsMatrix) => {
    const roleKey = role?.toLowerCase();
    if (roleKey === 'admin') return 'dashboard';
    
    // Check if role has dashboard permission
    const dashItem = (matrix || []).find(p => p.id === 'dashboard');
    const canAccessDashboard = dashItem ? Boolean(dashItem[roleKey]) : false;
    if (canAccessDashboard) return 'dashboard';

    // Primary functional module redirection
    if (roleKey === 'cashier') return 'pos';
    if (roleKey === 'warehouse') return 'inventory';
    if (roleKey === 'manager') return 'inventory';
    return 'inventory';
  };

  const login = (user) => {
    const normalizedRole = normalizeRole(user?.role);
    setIsAuthenticated(true);
    setAuthUser({
      ...user,
      role: normalizedRole,
    });
    setCurrentRole(normalizedRole);
    const landingTab = getPrimaryLandingTab(normalizedRole, permissionsMatrix);
    setActiveTab(landingTab);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout failed on backend:', err);
    } finally {
      setIsAuthenticated(false);
      setAuthUser(null);
      setCurrentRole('admin');
    }
  };

  // Toggle role permission in matrix and persist to Neon PostgreSQL DB via API
  const togglePermission = async (featureIdOrIndex, roleKey) => {
    // Admin fail-safe: Admin role is immutable and always returns true for all privileges!
    if (roleKey?.toLowerCase() === 'admin') return;

    const item = typeof featureIdOrIndex === 'number'
      ? permissionsMatrix[featureIdOrIndex]
      : permissionsMatrix.find(p => p.id === featureIdOrIndex || p.feature === featureIdOrIndex);

    if (!item) return;

    const targetFeatureName = item.feature;
    const nextAllowed = !item[roleKey];

    try {
      const payload = {
        role: roleKey,
        featureId: item.id,
        feature: item.feature,
        isAllowed: nextAllowed
      };

      const res = await api.put('/permissions', payload);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setPermissionsMatrix(res.data.data);
      } else {
        setPermissionsMatrix(prevMatrix =>
          prevMatrix.map(p =>
            (p.id === item.id || p.feature === item.feature) ? { ...p, [roleKey]: nextAllowed } : p
          )
        );
      }

      await logAudit(
        'RBAC Permission Toggled',
        'Security',
        `Toggled permission for role ${roleKey.toUpperCase()}: ${targetFeatureName} to ${nextAllowed ? 'ALLOWED' : 'DENIED'}`
      );
    } catch (err) {
      console.error('Failed to persist RBAC permissions:', err);
      alert('Failed to update permission on server. Please try again.');
    }
  };

  // Check feature permission for a role (Admin fail-safe hardcoded to true)
  const hasPermission = (featureKey, targetRole = currentRole) => {
    // Admin fail-safe: Admin always returns true for all privileges!
    if (targetRole?.toLowerCase() === 'admin') {
      return true;
    }

    const item = permissionsMatrix.find(p => p.id === featureKey || p.feature === featureKey);
    if (!item) return true;

    return Boolean(item[targetRole]);
  };

  // Currency formatting helper - Locked to PKR (Rs.)
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0.00';
    const num = Number(amount);
    return `Rs. ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Audit logger helper
  const logAudit = async (action, module, details) => {
    const roleLabels = {
      admin: 'Alexander Wright (Admin)',
      manager: 'Sarah Jenkins (Store Mgr)',
      warehouse: 'Carlos Mendez (Warehouse Staff)',
      cashier: 'Alice Vance (Cashier)'
    };

    const newLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      userId: `usr-${currentRole}`,
      userName: roleLabels[currentRole] || 'System User',
      action,
      module,
      details
    };

    try {
      await db.auditLogs.add(newLog);
      // Queue for cloud sync
      await db.syncQueue.add({
        id: `sync-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        action: 'AUDIT_LOG',
        entity: 'auditLogs',
        payload: newLog,
        status: 'pending'
      });
      const count = await db.syncQueue.where('status').equals('pending').count();
      setPendingSyncCount(count);
    } catch (e) {
      console.error('Failed to log audit:', e);
    }
  };

  // Manual Trigger Sync Simulation
  const triggerSync = async () => {
    setSyncStatus('syncing');
    setTimeout(async () => {
      await db.syncQueue.where('status').equals('pending').modify({ status: 'synced' });
      setPendingSyncCount(0);
      setSyncStatus('synced');
    }, 1200);
  };

  const t = translations[language] || translations.en;

  return (
    <AppContext.Provider
      value={{
        isDbReady,
        isAuthLoading,
        isAuthenticated,
        setIsAuthenticated,
        authUser,
        login,
        logout,
        permissionsMatrix,
        setPermissionsMatrix,
        togglePermission,
        hasPermission,
        theme,
        toggleTheme,
        language,
        changeLanguage,
        currency,
        activeCurrency,
        formatCurrency,
        currentRole,
        setCurrentRole,
        activeWarehouseId,
        activeWarehouse: effectiveWarehouses.find(w => w.id === activeWarehouseId) || { id: activeWarehouseId },
        changeActiveWarehouse,
        warehouses: effectiveWarehouses,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        activeTab,
        setActiveTab,
        getPrimaryLandingTab,
        t,
        logAudit,
        syncStatus,
        pendingSyncCount,
        triggerSync
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
export const useAppContext = useApp;
