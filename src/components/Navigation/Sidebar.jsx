import React, { useState, useEffect } from 'react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Warehouse, 
  PackagePlus, 
  Truck, 
  RotateCcw, 
  BarChart3, 
  ShieldCheck, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Store,
  Boxes,
  Tag,
  Layers,
  Paintbrush,
  Ruler,
  Printer,
  Receipt,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const { 
    t, 
    isSidebarCollapsed, 
    setIsSidebarCollapsed, 
    currentRole,
    hasPermission
  } = useApp();

  const isInventoryActive = location.pathname.startsWith('/inventory');
  const isReturnsActive = location.pathname.startsWith('/returns');

  // Keep accordion open whenever a sub-page is active
  const [inventoryOpen, setInventoryOpen] = useState(isInventoryActive);
  const [returnsOpen, setReturnsOpen] = useState(isReturnsActive);

  useEffect(() => {
    if (isInventoryActive) {
      setInventoryOpen(true);
    }
  }, [isInventoryActive]);

  useEffect(() => {
    if (isReturnsActive) {
      setReturnsOpen(true);
    }
  }, [isReturnsActive]);

  const inventorySubItems = [
    { id: 'inventory',            path: '/inventory',            label: 'Products',           icon: Package   },
    { id: 'inventory-resources',  path: '/inventory/resources',  label: 'Resources',          icon: Boxes     },
    { id: 'inventory-categories', path: '/inventory/categories', label: 'Product Categories', icon: Tag       },
    { id: 'inventory-variants',   path: '/inventory/variants',   label: 'Variants',           icon: Layers    },
    { id: 'inventory-brands',     path: '/inventory/brands',     label: 'Brands',             icon: Paintbrush},
    { id: 'inventory-units',      path: '/inventory/units',      label: 'Units',              icon: Ruler     },
    { id: 'inventory-print',      path: '/inventory/print',      label: 'Print Barcode',      icon: Printer   },
  ];

  const returnsSubItems = [
    { id: 'returns',          path: '/returns',                  label: 'Returns',          icon: RotateCcw },
    { id: 'invoice-register', path: '/returns/invoice-register', label: 'Invoice Register', icon: FileText  },
  ];

  const primaryNavItems = [
    { id: 'dashboard',        path: '/dashboard', label: t.dashboard,    icon: LayoutDashboard, roles: ['admin', 'manager', 'warehouse', 'cashier'], permKey: 'dashboard' },
    { id: 'pos',              path: '/pos',       label: t.posTerminal,  icon: ShoppingCart,    roles: ['admin', 'manager', 'cashier'], permKey: 'pos', badge: 'F9' },
    { id: 'inventory-group',  path: '/inventory', label: t.inventory,    icon: Package,         roles: ['admin', 'manager', 'warehouse'], permKey: 'inventory', isGroup: true },
    { id: 'warehouses',       path: '/warehouses', label: t.warehouses,   icon: Warehouse,       roles: ['admin', 'manager', 'warehouse'], permKey: 'transfers' },
    { id: 'receiving',        path: '/receiving', label: t.receiving,    icon: PackagePlus,     roles: ['admin', 'manager', 'warehouse'], permKey: 'receiving' },
    { id: 'suppliers',        path: '/suppliers', label: t.purchases,    icon: Truck,           roles: ['admin', 'manager'], permKey: 'suppliers' },
    { id: 'expenses',         path: '/expenses',  label: t.billsAndExpenses || 'Bills & Expenses', icon: Receipt, roles: ['admin', 'manager'], permKey: 'suppliers' },
    { id: 'returns-group',    path: '/returns',   label: t.returns,      icon: RotateCcw,       roles: ['admin', 'manager', 'cashier'], permKey: 'pos', isGroup: true },
    { id: 'reports',          path: '/reports',   label: t.reports,      icon: BarChart3,       roles: ['admin', 'manager'], permKey: 'reports' },
    { id: 'security',         path: '/security',  label: t.auditLogs,    icon: ShieldCheck,     roles: ['admin', 'manager'], permKey: 'security' },
  ];

  const settingsItem = {
    id: 'settings',
    path: '/settings',
    label: t.settings,
    icon: Settings,
    roles: ['admin', 'manager', 'warehouse', 'cashier']
  };

  const visibleNavItems = primaryNavItems.filter(item => {
    if (!item.roles.includes(currentRole)) return false;
    if (item.permKey && typeof hasPermission === 'function' && !hasPermission(item.permKey)) {
      return false;
    }
    return true;
  });
  const isSettingsVisible = settingsItem.roles.includes(currentRole);

  return (
    <aside 
      className={`relative flex flex-col h-screen h-full bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-300 select-none z-30 shrink-0 ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800/80 justify-between shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/30 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          {!isSidebarCollapsed && (
            <div className="leading-tight">
              <span className="font-black text-base tracking-tight text-white block">
                Identity <span className="text-indigo-400">IMS</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Inventory Management System
              </span>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1">
        {visibleNavItems.map(item => {
          const Icon = item.icon;

          /* ── Inventory accordion group ── */
          if (item.id === 'inventory-group') {
            return (
              <div key="inventory-group">
                {/* Accordion parent button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isSidebarCollapsed) {
                      // Collapsed: jump straight to Products
                      navigate('/inventory');
                      setInventoryOpen(true);
                    } else {
                      setInventoryOpen(prev => !prev);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
                    isInventoryActive && inventoryOpen
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-600/30'
                      : isInventoryActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                          inventoryOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </>
                  )}
                  {/* Tooltip when sidebar is collapsed */}
                  {isSidebarCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-[11px] font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </button>

                {/* Sub-navigation items (smooth accordion) */}
                {!isSidebarCollapsed && (
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      inventoryOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="ml-3 pl-3 border-l border-slate-700/60 space-y-0.5 py-0.5">
                      {inventorySubItems.map(sub => {
                        const SubIcon = sub.icon;
                        const isSubActive = sub.path === '/inventory'
                          ? (location.pathname === '/inventory' || location.pathname === '/inventory/products')
                          : location.pathname === sub.path;
                        return (
                          <NavLink
                            key={sub.id}
                            to={sub.path}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isSubActive
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                            }`}
                          >
                            <SubIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{sub.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          /* ── Returns & Invoice Register accordion group ── */
          if (item.id === 'returns-group') {
            return (
              <div key="returns-group">
                {/* Accordion parent button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isSidebarCollapsed) {
                      // Collapsed: jump straight to Returns
                      navigate('/returns');
                      setReturnsOpen(true);
                    } else {
                      setReturnsOpen(prev => !prev);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
                    isReturnsActive && returnsOpen
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-600/30'
                      : isReturnsActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                          returnsOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </>
                  )}
                  {/* Tooltip when sidebar is collapsed */}
                  {isSidebarCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-[11px] font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </button>

                {/* Sub-navigation items (smooth accordion) */}
                {!isSidebarCollapsed && (
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      returnsOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="ml-3 pl-3 border-l border-slate-700/60 space-y-0.5 py-0.5">
                      {returnsSubItems.map(sub => {
                        const SubIcon = sub.icon;
                        const isSubActive = location.pathname === sub.path;
                        return (
                          <NavLink
                            key={sub.id}
                            to={sub.path}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isSubActive
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                            }`}
                          >
                            <SubIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{sub.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          /* ── Regular nav item ── */
          const isActive = item.id === 'dashboard'
            ? (location.pathname === '/' || location.pathname === '/dashboard')
            : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
              }`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}
              {!isSidebarCollapsed && item.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-indigo-400'
                }`}>
                  {item.badge}
                </span>
              )}
              {/* Tooltip on collapsed state */}
              {isSidebarCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-[11px] font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Footer: Pinned Global Settings & Offline Status */}
      <div className="mt-auto shrink-0 border-t border-slate-800/80 p-3 bg-slate-950/40 space-y-2">
        {/* Global Settings */}
        {isSettingsVisible && (
          <NavLink
            to={settingsItem.path}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              location.pathname === settingsItem.path
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
            }`}
            title={isSidebarCollapsed ? settingsItem.label : undefined}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="truncate flex-1 text-left">{settingsItem.label}</span>
            )}
            {/* Tooltip on collapsed state */}
            {isSidebarCollapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-[11px] font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {settingsItem.label}
              </div>
            )}
          </NavLink>
        )}
      </div>
    </aside>
  );
}
