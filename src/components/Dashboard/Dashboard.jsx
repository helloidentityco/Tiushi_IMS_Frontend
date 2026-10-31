import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  Warehouse, 
  CheckCircle2, 
  Receipt, 
  AlertCircle,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];

/**
 * Check if a given date string or Date matches today in local time
 */
const isDateToday = (dateInput) => {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

/**
 * Format local date to YYYY-MM-DD
 */
const getLocalDateKey = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Utility function to aggregate sales (revenue) and purchase orders (expenses)
 * into a continuous 7-day window ending today
 */
const groupLast7DaysAnalytics = (salesList, poList) => {
  const days = [];
  const today = new Date();

  // Create 7 day buckets from 6 days ago up to today
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const dateKey = getLocalDateKey(d);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const fullDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    days.push({
      dateKey,
      day: dayLabel,
      fullDate,
      revenue: 0,
      expenses: 0,
    });
  }

  // Aggregate Sales into Revenue
  salesList.forEach((sale) => {
    const key = getLocalDateKey(sale.createdAt || sale.date);
    if (key) {
      const bucket = days.find((d) => d.dateKey === key);
      if (bucket) {
        bucket.revenue += Number(sale.totalAmount || 0);
      }
    }
  });

  // Aggregate Purchase Orders into Expenses
  poList.forEach((po) => {
    const key = getLocalDateKey(po.createdAt || po.issueDate || po.date);
    if (key) {
      const bucket = days.find((d) => d.dateKey === key);
      if (bucket) {
        bucket.expenses += Number(po.totalAmount || po.grandTotal || 0);
      }
    }
  });

  return days.map((d) => ({
    day: d.day,
    fullDate: d.fullDate,
    revenue: Math.round(d.revenue * 100) / 100,
    expenses: Math.round(d.expenses * 100) / 100,
  }));
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    t, 
    formatCurrency, 
    activeWarehouseId, 
    changeActiveWarehouse 
  } = useApp();

  // ─── Live State from Backend API ──────────────────────────────────────────
  const [sales, setSales] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Synchronize active warehouse selection with context if valid
  useEffect(() => {
    if (activeWarehouseId && activeWarehouseId !== 'all') {
      setSelectedWarehouseId(activeWarehouseId);
    }
  }, [activeWarehouseId]);

  // ─── Fetch Live Backend Data ──────────────────────────────────────────────
  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      else setIsLoading(true);

      const [salesRes, poRes, prodRes, whRes] = await Promise.all([
        api.get('/sales').catch(err => {
          console.error('Failed to fetch sales for dashboard:', err);
          return { data: { data: [] } };
        }),
        api.get('/purchase-orders').catch(err => {
          console.error('Failed to fetch purchase-orders for dashboard:', err);
          return { data: { data: [] } };
        }),
        api.get('/products').catch(err => {
          console.error('Failed to fetch products for dashboard:', err);
          return { data: { data: [] } };
        }),
        api.get('/warehouses').catch(err => {
          console.error('Failed to fetch warehouses for dashboard:', err);
          return { data: { data: [] } };
        }),
      ]);

      setSales(Array.isArray(salesRes.data?.data) ? salesRes.data.data : []);
      setPurchaseOrders(Array.isArray(poRes.data?.data) ? poRes.data.data : []);
      setProducts(Array.isArray(prodRes.data?.data) ? prodRes.data.data : []);
      setWarehouses(Array.isArray(whRes.data?.data) ? whRes.data.data : []);
    } catch (err) {
      console.error('Dashboard data fetching error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ─── Warehouse-Filtered Datasets ──────────────────────────────────────────
  const activeWarehouseObj = warehouses.find(w => w.id === selectedWarehouseId);

  const filteredSales = useMemo(() => {
    if (selectedWarehouseId === 'all') return sales;
    return sales.filter(s => s.warehouseId === selectedWarehouseId);
  }, [sales, selectedWarehouseId]);

  const filteredPOs = useMemo(() => {
    if (selectedWarehouseId === 'all') return purchaseOrders;
    return purchaseOrders.filter(po => po.warehouseId === selectedWarehouseId);
  }, [purchaseOrders, selectedWarehouseId]);

  // ─── 1. Total Daily Sales (Today's Real Revenue) ───────────────────────────
  const todaySales = useMemo(() => {
    return filteredSales.filter(s => isDateToday(s.createdAt || s.date));
  }, [filteredSales]);

  const totalDailySalesRevenue = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  }, [todaySales]);

  // ─── 2. Est. Net Profit (Daily Revenue minus Daily COGS from sales line items)
  const { dailyRevenue, dailyCOGS, dailyNetProfit } = useMemo(() => {
    let rev = 0;
    let cogs = 0;

    todaySales.forEach(sale => {
      const saleAmt = Number(sale.totalAmount || 0);
      rev += saleAmt;

      if (Array.isArray(sale.items) && sale.items.length > 0) {
        sale.items.forEach(item => {
          const qty = Number(item.quantity || 0);
          const unitCost = Number(
            item.product?.costPrice !== undefined
              ? item.product.costPrice
              : products.find(p => p.id === item.productId)?.costPrice || 0
          );
          cogs += qty * unitCost;
        });
      } else {
        // Fallback for sales without line items: 40% estimated COGS
        cogs += saleAmt * 0.40;
      }
    });

    const profit = Math.max(0, rev - cogs);
    return { dailyRevenue: rev, dailyCOGS: cogs, dailyNetProfit: profit };
  }, [todaySales, products]);

  // ─── 3. Active POs & Low Stock SKUs ───────────────────────────────────────
  const activePOs = useMemo(() => {
    return filteredPOs.filter(po => {
      const status = (po.status || '').toLowerCase();
      return status === 'issued' || status === 'draft' || status === 'pending' || status === 'ordered';
    }).length;
  }, [filteredPOs]);

  // Calculate low stock items (quantity <= minStockLevel)
  const lowStockProducts = useMemo(() => {
    return products.map(prod => {
      const stockArr = Array.isArray(prod.stock) ? prod.stock : [];
      const relevantStock = selectedWarehouseId === 'all'
        ? stockArr
        : stockArr.filter(s => s.warehouseId === selectedWarehouseId);
      
      const totalStock = relevantStock.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
      const minThreshold = Number(prod.minStockLevel || prod.minStockAlert || 10);
      const whName = selectedWarehouseId === 'all'
        ? 'All Depots'
        : activeWarehouseObj?.name || 'Selected Depot';

      return {
        ...prod,
        currentStock: totalStock,
        minThreshold,
        warehouseName: whName,
        isLow: totalStock <= minThreshold
      };
    }).filter(p => p.isLow);
  }, [products, selectedWarehouseId, activeWarehouseObj]);

  // ─── 4. 7-Day Chart Dataset (Grouped by local last 7 days) ────────────────
  const sevenDayChartData = useMemo(() => {
    return groupLast7DaysAnalytics(filteredSales, filteredPOs);
  }, [filteredSales, filteredPOs]);

  // ─── 5. Warehouse Stock Valuation by Category ─────────────────────────────
  const valuationData = useMemo(() => {
    const categoryTotals = {};

    products.forEach(prod => {
      const cost = Number(prod.costPrice || 0);
      const stockArr = Array.isArray(prod.stock) ? prod.stock : [];
      const relevantStock = selectedWarehouseId === 'all'
        ? stockArr
        : stockArr.filter(s => s.warehouseId === selectedWarehouseId);

      const qty = relevantStock.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
      const val = cost * qty;
      const cat = prod.category || 'General';

      if (val > 0) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
      }
    });

    return Object.entries(categoryTotals)
      .map(([cat, val]) => ({
        name: cat,
        fullName: cat,
        value: Math.round(val)
      }))
      .sort((a, b) => b.value - a.value);
  }, [products, selectedWarehouseId]);

  // ─── 6. Top Selling Products ──────────────────────────────────────────────
  const topSelling = useMemo(() => {
    const salesAgg = {};

    filteredSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        if (!item.productId) return;
        if (!salesAgg[item.productId]) {
          salesAgg[item.productId] = { salesCount: 0, revenue: 0 };
        }
        salesAgg[item.productId].salesCount += Number(item.quantity || 1);
        salesAgg[item.productId].revenue += Number(item.lineTotal || (item.quantity * item.unitPrice) || 0);
      });
    });

    const listWithSales = products
      .filter(p => salesAgg[p.id])
      .map(p => ({
        ...p,
        salesCount: salesAgg[p.id].salesCount,
        revenue: salesAgg[p.id].revenue
      }))
      .sort((a, b) => b.salesCount - a.salesCount);

    if (listWithSales.length > 0) {
      return listWithSales.slice(0, 5);
    }

    // If no sales recorded yet, fallback to displaying top catalog items
    return products.slice(0, 5).map(p => ({
      ...p,
      salesCount: 0,
      revenue: 0
    }));
  }, [filteredSales, products]);

  // ─── 7. Recent Sales Table (Latest 10) ────────────────────────────────────
  const recentSales = useMemo(() => {
    return [...filteredSales]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10);
  }, [filteredSales]);

  return (
    <div className="space-y-6">
      {/* ── Top Header & Warehouse Context Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t.dashboard}</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Live Cloud API
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time omnichannel performance, inventory valuation, and POS cashier velocity.
          </p>
        </div>

        {/* Warehouse Selector & Manual Refresh Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-xl border border-slate-300 dark:border-slate-700 transition-colors"
            title="Refresh Live Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Warehouse className="w-4 h-4 text-indigo-500" />
            Active Node:
          </label>
          <select
            value={selectedWarehouseId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedWarehouseId(val);
              if (val !== 'all' && typeof changeActiveWarehouse === 'function') {
                changeActiveWarehouse(val);
              }
            }}
            className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Depots (Omnichannel Global)</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>
                {wh.name} {wh.code ? `(${wh.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Low Stock Alert Banner (Dynamic) ── */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {lowStockProducts.length} Products Below Minimum Stock Threshold!
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
                Immediate purchase replenishment required for:{' '}
                <span className="font-semibold underline">
                  {lowStockProducts.map(p => p.name || p.title).slice(0, 3).join(', ')}
                  {lowStockProducts.length > 3 ? ` and ${lowStockProducts.length - 3} more` : ''}
                </span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              navigate('/inventory');
            }} 
            className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
            title="Navigate to Inventory & Stock Management"
          >
            <span>Review Stock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Dynamic KPI Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Daily Sales */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.totalDailySales}
            </span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(totalDailySalesRevenue)}
            </h3>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
              Today
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {todaySales.length} Invoices Today ({filteredSales.length} Total)
          </div>
        </div>

        {/* Est. Net Profit */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.netProfit}
            </span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(dailyNetProfit)}
            </h3>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
              {dailyRevenue > 0 ? `${((dailyNetProfit / dailyRevenue) * 100).toFixed(1)}%` : '0%'} Margin
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {formatCurrency(dailyCOGS)} COGS from {todaySales.length} {todaySales.length === 1 ? 'sale' : 'sales'} today
          </div>
        </div>

        {/* Active POs */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.activePurchases}
            </span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {activePOs} Orders
            </h3>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
              In-bound
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {filteredPOs.length} Total Lifecycle POs
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.lowStockItems}
            </span>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {lowStockProducts.length} SKUs
            </h3>
            <span className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
              Attention
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Threshold exceeded (stock &le; min alert)
          </div>
        </div>
      </div>

      {/* ── Visual Analytics Charts Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Revenue vs Expenses BarChart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.sevenDayRevenue}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Operating revenue from sales versus procurement expenditures over the last 7 days
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                <span className="w-3 h-3 rounded-sm bg-indigo-600"></span> {t.revenue}
              </span>
              <span className="flex items-center gap-1.5 text-rose-500 font-bold">
                <span className="w-3 h-3 rounded-sm bg-rose-500"></span> {t.expenses}
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sevenDayChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip 
                  formatter={(val) => [formatCurrency(val), '']} 
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? `${item.day} (${item.fullDate})` : label;
                  }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} 
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Warehouse Stock Valuation Category Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t.stockValuation}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Category valuation breakdown for {activeWarehouseObj?.name || 'All Depots'}
            </p>
          </div>

          {valuationData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center p-4">
              <Warehouse className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No stock in this selection</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Allocate inventory to view category valuation</p>
            </div>
          ) : (
            <>
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={valuationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {valuationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => formatCurrency(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 max-h-36 overflow-y-auto">
                {valuationData.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      <span className="font-medium truncate max-w-[130px]">{entry.fullName}</span>
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Top Selling Products Showcase ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t.topSelling}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-velocity revenue and volume performers from live completed sales
            </p>
          </div>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg">
            Top Performers
          </span>
        </div>

        {topSelling.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold">No sales transactions available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {topSelling.map((prod) => (
              <div 
                key={prod.id} 
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={prod.imageUrl || prod.image || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=150&auto=format&fit=crop&q=80'}
                    alt={prod.name || prod.title}
                    className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <h5 className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={prod.name || prod.title}>
                      {prod.name || prod.title}
                    </h5>
                    <p className="text-[11px] text-slate-400 truncate font-mono">
                      {prod.sku}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatCurrency(prod.revenue)}
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {prod.salesCount} sold
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 1. Recent Sales Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Sales
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {recentSales.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time invoice log, cashier velocity, billing state, and payment settlements.
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Sales Stream
          </span>
        </div>

        {recentSales.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No recent sales records</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Orders checked out via the POS Terminal will populate this ledger in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Warehouse Depot</th>
                  <th className="px-5 py-3.5">Date &amp; Time</th>
                  <th className="px-5 py-3.5">Payment Method</th>
                  <th className="px-5 py-3.5">Total Amount</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {recentSales.map((sale) => {
                  const saleDate = sale.createdAt 
                    ? new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                    : 'Today';
                  const whName = sale.warehouse?.name || warehouses.find(w => w.id === sale.warehouseId)?.name || 'Central Warehouse';

                  return (
                    <tr 
                      key={sale.id} 
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                        {sale.customerName || 'Walk-in Customer'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {whName}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {saleDate}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {sale.paymentMethod || 'Cash'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                        {formatCurrency(sale.totalAmount)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {sale.status || 'Completed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 2. Stock Alert Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Stock Alerts
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {lowStockProducts.length} Depleted SKUs
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Low inventory warnings for active deposit node:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {activeWarehouseObj?.name || 'All Depots'}
                </span>
                . Immediate replenishment advised.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Stock &le; Alert Threshold
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                navigate('/inventory');
              }}
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Open Inventory
            </button>
          </div>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Inventory is fully healthy!</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              All catalog products in {activeWarehouseObj?.name || 'all warehouses'} are currently stocked above their minimum alert threshold.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3.5">Code / SKU</th>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5">Deposit Node</th>
                  <th className="px-5 py-3.5">Current Stock</th>
                  <th className="px-5 py-3.5 text-right">Min Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lowStockProducts.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white block">
                        {item.sku}
                      </span>
                      {item.barcode && (
                        <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 block">
                          {item.barcode}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.imageUrl || item.image || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=100&auto=format&fit=crop&q=80'}
                          alt={item.name || item.title}
                          className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm block line-clamp-1">
                            {item.name || item.title}
                          </span>
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium block">
                            {item.category || 'General'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.warehouseName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        {item.currentStock} units
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80">
                        Threshold: {item.minThreshold}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
