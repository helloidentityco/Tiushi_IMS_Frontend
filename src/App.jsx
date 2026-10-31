import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useApp } from './context/AppContext';
import Sidebar from './components/Navigation/Sidebar';
import Header from './components/Navigation/Header';
import Dashboard from './components/Dashboard/Dashboard';
import POSTerminal from './components/POS/POSTerminal';
import ProductManagement from './components/Inventory/ProductManagement';
import CategoriesManagement from './components/Inventory/CategoriesManagement';
import VariantsManagement from './components/Inventory/VariantsManagement';
import BrandsManagement from './components/Inventory/BrandsManagement';
import UnitsManagement from './components/Inventory/UnitsManagement';
import BarcodePrintUtility from './components/Inventory/BarcodePrintUtility';
import MultiWarehouse from './components/Warehouses/MultiWarehouse';
import WarehouseOperations from './components/WarehouseOps/WarehouseOperations';
import SupplierManagement from './components/Suppliers/SupplierManagement';
import ExpenseManagement from './components/Expenses/ExpenseManagement';
import Returns from './components/Returns/Returns';
import InvoiceRegister from './components/Returns/InvoiceRegister';
import ReportsEngine from './components/Reports/ReportsEngine';
import SecurityRBAC from './components/Security/SecurityRBAC';
import GlobalSettings from './components/Settings/GlobalSettings';
import Login from './components/Auth/Login';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const { 
    isDbReady, 
    isAuthLoading,
    isAuthenticated, 
    activeTab, 
    setActiveTab, 
    currentRole, 
    hasPermission, 
    permissionsMatrix, 
    getPrimaryLandingTab 
  } = useApp();

  const pathToTabMap = useMemo(() => ({
    '/': 'dashboard',
    '/dashboard': 'dashboard',
    '/pos': 'pos',
    '/inventory': 'inventory',
    '/inventory/products': 'inventory',
    '/inventory/resources': 'inventory-resources',
    '/inventory/categories': 'inventory-categories',
    '/inventory/variants': 'inventory-variants',
    '/inventory/brands': 'inventory-brands',
    '/inventory/units': 'inventory-units',
    '/inventory/print': 'inventory-print',
    '/warehouses': 'warehouses',
    '/receiving': 'receiving',
    '/suppliers': 'suppliers',
    '/expenses': 'expenses',
    '/returns': 'returns',
    '/returns/invoice-register': 'invoice-register',
    '/reports': 'reports',
    '/security': 'security',
    '/settings': 'settings'
  }), []);

  // Compute active module tab dynamically from location.pathname with fallback to activeTab
  const normalizedPath = location.pathname.length > 1 && location.pathname.endsWith('/')
    ? location.pathname.slice(0, -1)
    : location.pathname;

  const currentModule = pathToTabMap[normalizedPath] || activeTab || 'dashboard';

  // Synchronize activeTab in AppContext whenever location.pathname changes
  useEffect(() => {
    const tab = pathToTabMap[normalizedPath];
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [normalizedPath, activeTab, setActiveTab, pathToTabMap]);

  // Helper to resolve fallback module when Dashboard access is denied
  const getFallbackModule = () => {
    if (typeof getPrimaryLandingTab === 'function') {
      return getPrimaryLandingTab(currentRole, permissionsMatrix);
    }
    return currentRole === 'cashier' ? 'pos' : 'inventory';
  };

  // Enforce landing route redirection ONLY when specifically visiting the root path ('/')
  // Does not trigger for valid authenticated subroutes (/inventory, /reports, etc.)
  // Dependencies are isolated to [isAuthenticated, currentRole] so it never fires on route changes
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/') {
      if (!hasPermission('dashboard')) {
        const fallback = getFallbackModule();
        const tabToPath = {
          'pos': '/pos',
          'inventory': '/inventory',
          'suppliers': '/suppliers'
        };
        navigate(tabToPath[fallback] || '/inventory', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, currentRole]);

  if (!isDbReady || isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold tracking-tight">Initializing Identity IMS...</h2>
        <p className="text-sm text-slate-400 mt-1">Verifying secure session & bootstrapping resources</p>
      </div>
    );
  }

  // Strictly render the login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  const renderActiveModule = () => {
    // If currentModule is dashboard and user lacks permission, automatically render primary functional module
    if (currentModule === 'dashboard' && !hasPermission('dashboard')) {
      const fallback = getFallbackModule();
      return fallback === 'pos' ? <POSTerminal /> : <ProductManagement viewType="product" />;
    }

    const tabPermMap = {
      'dashboard': 'dashboard',
      'pos': 'pos',
      'inventory': 'inventory',
      'inventory-resources': 'inventory',
      'inventory-categories': 'inventory',
      'inventory-variants': 'inventory',
      'inventory-brands': 'inventory',
      'inventory-units': 'inventory',
      'inventory-print': 'inventory',
      'warehouses': 'transfers',
      'receiving': 'receiving',
      'suppliers': 'suppliers',
      'expenses': 'suppliers',
      'returns': 'pos',
      'invoice-register': 'pos',
      'reports': 'reports',
      'security': 'security'
    };

    const permKey = tabPermMap[currentModule];
    if (permKey && typeof hasPermission === 'function' && !hasPermission(permKey)) {
      return (
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto my-12">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Access Denied by Security Policy</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Your assigned role does not have permission to access this module. Please contact the system administrator to request access.
          </p>
        </div>
      );
    }
    switch (currentModule) {
      case 'dashboard':
        return <Dashboard />;
      case 'pos':
        return <POSTerminal />;
      case 'inventory':
        return <ProductManagement viewType="product" />;
      case 'inventory-resources':
        return <ProductManagement viewType="resource" />;
      case 'inventory-categories':
        return <CategoriesManagement />;
      case 'inventory-variants':
        return <VariantsManagement />;
      case 'inventory-brands':
        return <BrandsManagement />;
      case 'inventory-units':
        return <UnitsManagement />;
      case 'inventory-print':
        return <BarcodePrintUtility />;
      case 'warehouses':
        return <MultiWarehouse />;
      case 'receiving':
        return <WarehouseOperations />;
      case 'suppliers':
        return <SupplierManagement />;
      case 'expenses':
        return <ExpenseManagement />;
      case 'returns':
        return <Returns />;
      case 'invoice-register':
        return <InvoiceRegister />;
      case 'reports':
        return <ReportsEngine />;
      case 'security':
        return <SecurityRBAC />;
      case 'settings':
        return <GlobalSettings />;
      default:
        if (!hasPermission('dashboard')) {
          const fallback = getFallbackModule();
          return fallback === 'pos' ? <POSTerminal /> : <ProductManagement viewType="product" />;
        }
        return <Dashboard />;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors">
      {/* Collapsible Left Navigation Bar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Global Action Header */}
        <Header />

        {/* Dynamic Route View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderActiveModule()}
          </div>
        </main>
      </div>
    </div>
  );
}
