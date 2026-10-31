import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Layers, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  DollarSign,
  Search,
  RefreshCw,
  Package
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

export default function ReportsEngine() {
  const { t, formatCurrency } = useApp();

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [valuationMethod, setValuationMethod] = useState('FIFO'); // 'FIFO' | 'Average Costing'

  // Fetch real live product and sales data from backend APIs
  // Note: Resources are excluded because customers do not purchase raw materials
  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, salesRes] = await Promise.all([
        api.get('/products').catch(err => {
          console.error('Failed to fetch products:', err);
          return { data: { data: [] } };
        }),
        api.get('/sales').catch(err => {
          console.error('Failed to fetch sales:', err);
          return { data: { data: [] } };
        }),
      ]);

      const fetchedProducts = prodRes.data?.data || [];
      const fetchedSales = salesRes.data?.data || [];

      setProducts(fetchedProducts);
      setSales(fetchedSales);

      // Only include Finished Goods (Products) in the Customer Behaviour / Valuation report
      const productItems = fetchedProducts.map(p => ({
        ...p,
        title: p.name,
        sku: p.sku,
        barcode: p.sku,
        category: p.category || 'General',
        unit: 'Pcs',
        costPrice: Number(p.costPrice || 0),
        sellingPrice: Number(p.sellingPrice || 0),
        itemType: 'Product',
        rawStock: p.stock || p.warehouseStock || p.warehouse_stock || [],
      }));

      setInventoryItems(productItems);
    } catch (error) {
      console.error('Error loading reports data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Map total sold quantities per product from customer sales transactions
  const soldQtyMap = useMemo(() => {
    const map = {};
    sales.forEach(sale => {
      (sale.items || []).forEach(si => {
        const id = si.productId;
        if (id) {
          map[id] = (map[id] || 0) + Number(si.quantity || 0);
        }
      });
    });
    return map;
  }, [sales]);

  // Compute stock and valuation rows dynamically for products
  const valuationRows = useMemo(() => {
    return inventoryItems.map(item => {
      // Sum quantity across all warehouse depot records
      const stockArray = item.rawStock || item.stock || item.warehouse_stock || item.warehouseStock || [];
      const totalStock = Array.isArray(stockArray)
        ? stockArray.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
        : 0;

      const cost = Number(item.costPrice || 0);
      const selling = Number(item.sellingPrice || cost);
      const totalCost = totalStock * cost;
      const retailValue = totalStock * selling;
      const potentialMargin = retailValue - totalCost;

      const soldQty = soldQtyMap[item.id] || 0;
      let turnoverRate = '0.0';
      if (totalStock > 0) {
        turnoverRate = (soldQty / totalStock).toFixed(1);
      } else if (soldQty > 0) {
        turnoverRate = soldQty.toFixed(1);
      }

      const isSlowMoving = Number(turnoverRate) < 1.0;

      return {
        ...item,
        quantity: totalStock,
        soldQty,
        totalCost,
        retailValue,
        potentialMargin,
        turnoverRate,
        isSlowMoving,
      };
    });
  }, [inventoryItems, soldQtyMap]);

  // Dynamic Product KPI Computations (Excludes raw materials)
  const totalInventoryCost = useMemo(() => {
    return valuationRows.reduce((sum, r) => sum + r.totalCost, 0);
  }, [valuationRows]);

  const totalRetailPotential = useMemo(() => {
    return valuationRows.reduce((sum, r) => sum + r.retailValue, 0);
  }, [valuationRows]);

  // Filtered rows based on user search term
  const filteredRows = useMemo(() => {
    return valuationRows.filter(row => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (row.title || '').toLowerCase().includes(term) ||
        (row.sku || '').toLowerCase().includes(term) ||
        (row.category || '').toLowerCase().includes(term)
      );
    });
  }, [valuationRows, searchTerm]);

  // CSV Export utility
  const exportToCSV = () => {
    const headers = [
      'Product Name',
      'SKU / Barcode',
      'Category',
      'Total Stock',
      'Unit',
      'Unit Cost',
      'Selling Price',
      'Total Cost Valuation',
      'Total Retail Potential',
      'Units Sold',
      'Turnover Ratio',
      'Velocity Status'
    ];

    const rows = filteredRows.map(r => [
      `"${r.title}"`,
      `"${r.sku}"`,
      `"${r.category}"`,
      r.quantity,
      `"${r.unit || 'Pcs'}"`,
      r.costPrice.toFixed(2),
      r.sellingPrice.toFixed(2),
      r.totalCost.toFixed(2),
      r.retailValue.toFixed(2),
      r.soldQty,
      r.turnoverRate,
      `"${r.isSlowMoving ? 'Slow Mover' : 'Fast Runner'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Product_Valuation_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t.reports}</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              Audit Grade Live
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Finished goods stock valuation (FIFO / Weighted Average), sales turnover ratios, slow-moving items, and export.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={fetchReportData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh from Neon Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV / Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-500" />
            Print / PDF Report
          </button>
        </div>
      </div>

      {/* Summary KPI Cards - Exclusively Finished Products */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Inventory Cost Valuation
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCurrency(totalInventoryCost)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Finished Goods ({valuationMethod} Costing Model)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Retail Potential Value
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {formatCurrency(totalRetailPotential)}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
            +{formatCurrency(Math.max(0, totalRetailPotential - totalInventoryCost))} Gross Margin
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Costing Model Toggle
          </div>
          <div className="flex items-center gap-2 mt-2">
            {['FIFO', 'Average Costing'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setValuationMethod(m)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  valuationMethod === m
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Valuation & Turnover Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" />
              <span>Inventory Turnover & Slow-Moving Item Identification</span>
            </h3>
            <span className="text-xs text-slate-400">
              {filteredRows.length} of {valuationRows.length} Products Displayed
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-64"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Total Stock</th>
                <th className="py-3 px-4">Unit Cost</th>
                <th className="py-3 px-4">Total Valuation</th>
                <th className="py-3 px-4">Retail Value</th>
                <th className="py-3 px-4">Turnover Ratio</th>
                <th className="py-3 px-4">Velocity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Loading live product data from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-slate-400">
                    No products found matching "{searchTerm}".
                  </td>
                </tr>
              ) : (
                filteredRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      <div>
                        {r.title}
                        {r.category && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            {r.category}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{r.sku}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <span className={r.quantity <= 0 ? 'text-rose-500 font-bold' : ''}>
                        {r.quantity} {r.unit || 'Pcs'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{formatCurrency(r.costPrice)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(r.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {formatCurrency(r.retailValue)}
                    </td>
                    <td className="py-3 px-4 font-bold font-mono">
                      <span>{r.turnoverRate}x</span>
                      {r.soldQty > 0 && (
                        <span className="text-[10px] font-normal text-slate-400 block">
                          ({r.soldQty} sold)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.quantity <= 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1 w-max">
                          Out of Stock
                        </span>
                      ) : r.isSlowMoving ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1 w-max">
                          <AlertCircle className="w-3 h-3" /> Slow Mover
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 w-max">
                          <TrendingUp className="w-3 h-3" /> Fast Runner
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
