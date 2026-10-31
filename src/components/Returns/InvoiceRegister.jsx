import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Calendar, 
  Package, 
  User, 
  Phone, 
  Copy, 
  Check, 
  RotateCcw, 
  Printer, 
  X, 
  Store,
  DollarSign,
  Receipt,
  ArrowRight,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

export default function InvoiceRegister() {
  const navigate = useNavigate();
  const { t = {}, formatCurrency = (v) => `$${Number(v || 0).toFixed(2)}`, setActiveTab } = useApp() || {};

  const [salesOrders, setSalesOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch sales, products, and warehouses from backend API
  const fetchSalesData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [salesRes, prodRes, whRes] = await Promise.all([
        api.get('/sales'),
        api.get('/products'),
        api.get('/warehouses'),
      ]);

      const rawSales = Array.isArray(salesRes?.data?.data) ? salesRes.data.data : [];
      const normalizedSales = rawSales.map(sale => {
        if (!sale) return null;
        const total = Number(sale?.totalAmount || 0);
        const disc = Number(sale?.discount || 0);
        return {
          ...sale,
          orderNumber: sale?.invoiceNumber || sale?.orderNumber || `INV-${sale?.id?.slice(0, 8)}`,
          customerName: sale?.customerName || 'Walk-in Customer',
          orderDate: sale?.createdAt ? sale.createdAt.split('T')[0] : '',
          date: sale?.createdAt || new Date().toISOString(),
          grandTotal: total,
          subtotal: total + disc,
          globalDiscount: disc,
          orderState: sale?.status || 'Completed',
          status: sale?.status || 'Completed',
          paymentStatus: 'Paid',
          paymentMethod: sale?.paymentMethod || 'Cash',
          items: Array.isArray(sale?.items)
            ? sale.items.map(it => ({
                productId: it?.productId,
                title: it?.product?.name || it?.product?.title || 'Product',
                name: it?.product?.name || it?.product?.title || 'Product',
                sku: it?.product?.sku || '',
                category: it?.product?.category || '',
                quantity: Number(it?.quantity || 1),
                unitPrice: Number(it?.unitPrice || 0),
                total: Number(it?.lineTotal || (Number(it?.quantity || 1) * Number(it?.unitPrice || 0))),
                sellingPrice: Number(it?.unitPrice || 0)
              }))
            : []
        };
      }).filter(Boolean);

      setSalesOrders(normalizedSales);
      setProducts(Array.isArray(prodRes?.data?.data) ? prodRes.data.data : []);
      setWarehouses(Array.isArray(whRes?.data?.data) ? whRes.data.data : []);
    } catch (err) {
      console.error('Failed to load invoice register data from API:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  // Create a fast lookup map for product categories
  const productsMap = useMemo(() => {
    const map = {};
    products.forEach(p => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  // Smart Filter Panel State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // UI state for copy feedback & receipt view modal
  const [copiedId, setCopiedId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Quick Date Preset Handlers
  const handlePreset = (type) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (type === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'week') {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(pastWeek.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (type === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (type === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const clearAllFilters = () => {
    setStartDate('');
    setEndDate('');
    setItemSearch('');
    setCustomerSearch('');
  };

  // Helper to get all purchased line items from an order
  const getOrderItems = (order) => {
    if (!order) return [];
    if (Array.isArray(order.items) && order.items.length > 0) return order.items;
    if (Array.isArray(order.cart) && order.cart.length > 0) return order.cart;
    return [];
  };

  // Dynamic Javascript Filtering Logic
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(salesOrders)) return [];
    return salesOrders.filter(order => {
      if (!order) return false;
      // 1. Date Range Filtering
      const rawDate = order.orderDate || order.date;
      if (rawDate) {
        const orderDateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : String(rawDate);
        if (startDate && orderDateStr < startDate) return false;
        if (endDate && orderDateStr > endDate) return false;
      }

      // 2. Customer Search (Phone Number or Name)
      if (customerSearch.trim()) {
        const cQuery = customerSearch.toLowerCase().trim();
        const cName = (order.customerName || '').toLowerCase();
        const cContact = (order.customerContact || '').toLowerCase();
        const cPhone = (order.customerPhone || '').toLowerCase();
        const cOtherPhone = (order.phone || '').toLowerCase();

        const customerMatches = 
          cName.includes(cQuery) || 
          cContact.includes(cQuery) || 
          cPhone.includes(cQuery) || 
          cOtherPhone.includes(cQuery);

        if (!customerMatches) return false;
      }

      // 3. Item Search: iterate through the cart or items array inside each order to check if any purchased product matches the search string
      if (itemSearch.trim()) {
        const iQuery = itemSearch.toLowerCase().trim();
        const items = getOrderItems(order);

        const itemMatches = items.some(item => {
          const itemTitle = (item.title || item.name || '').toLowerCase();
          const itemCategory = (item.category || '').toLowerCase();
          
          // Lookup catalog details if available
          const productDetail = item.productId ? productsMap[item.productId] : null;
          const catalogCategory = (productDetail?.category || '').toLowerCase();
          const catalogTitle = (productDetail?.title || productDetail?.name || '').toLowerCase();

          return (
            itemTitle.includes(iQuery) ||
            itemCategory.includes(iQuery) ||
            catalogCategory.includes(iQuery) ||
            catalogTitle.includes(iQuery)
          );
        });

        if (!itemMatches) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date || b.orderDate || 0) - new Date(a.date || a.orderDate || 0));
  }, [salesOrders, startDate, endDate, itemSearch, customerSearch, productsMap]);

  // Copy Invoice ID with interactive feedback
  const handleCopyInvoiceId = (invoiceNumber) => {
    if (!invoiceNumber) return;
    navigator.clipboard.writeText(invoiceNumber);
    setCopiedId(invoiceNumber);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Format Items list (e.g., "2x Black Bag, 1x Mouse")
  const formatItemsString = (order) => {
    const items = getOrderItems(order);
    if (items.length === 0) return 'No line items recorded';
    return items.map(item => `${item.quantity || 1}x ${item.title || item.name || 'Item'}`).join(', ');
  };

  const receiptRef = useRef(null);

  const handlePrintSlip = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Invoice-${selectedInvoice?.orderNumber || 'Slip'}`,
  });

  const isFiltered = Boolean(startDate || endDate || itemSearch || customerSearch);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            <span>Invoice Register</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {filteredOrders.length} Invoices Found
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Trace lost receipts by searching past transactions through purchased items, product categories, customer details, and date ranges.
          </p>
        </div>

        <button
          onClick={() => {
            if (typeof setActiveTab === 'function') setActiveTab('returns');
            navigate('/returns');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Process Customer Return
        </button>
      </div>

      {/* 1. Smart Filter Panel (Top Section) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-800 dark:text-slate-200">
              Smart Invoice Trace Filters
            </h2>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 mr-1">Quick Dates:</span>
            <button
              type="button"
              onClick={() => handlePreset('today')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset('week')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePreset('month')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
            >
              This Month
            </button>
            {isFiltered && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer ml-1"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Date Range: Start Date and End Date pickers */}
          <div className="md:col-span-5 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* Item Search: Product Name or Category (e.g. "Black Bag") */}
          <div className="md:col-span-4">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-indigo-400" />
              Item Search (Product Name / Category)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder='e.g., "Charger", "Mouse", "Electronics"...'
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              {itemSearch && (
                <button
                  type="button"
                  onClick={() => setItemSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Customer Search: Phone Number or Name */}
          <div className="md:col-span-3">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Customer Search (Phone / Name)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Phone # or Customer Name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
              />
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sales Ledger Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Order Date & Time</th>
                <th className="py-3 px-4">Invoice ID</th>
                <th className="py-3 px-4">Customer Info</th>
                <th className="py-3 px-4">Items Purchased</th>
                <th className="py-3 px-4">Grand Total</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-indigo-400" />
                    <div className="font-semibold text-slate-300">No matching sales transactions found</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Try broadening your search criteria or resetting the item/date filters above.
                    </p>
                    {isFiltered && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer border border-slate-700"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const invoiceId = order.orderNumber || order.id;
                  const isCopied = copiedId === invoiceId;
                  const contact = order.customerContact || order.customerPhone || order.phone;
                  const itemsListText = formatItemsString(order);
                  const orderItems = getOrderItems(order);

                  // Extract timestamp
                  let dateDisplay = 'N/A';
                  let timeDisplay = '';
                  if (order.date) {
                    const d = new Date(order.date);
                    if (!isNaN(d.getTime())) {
                      dateDisplay = d.toLocaleDateString();
                      timeDisplay = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                  } else if (order.orderDate) {
                    dateDisplay = order.orderDate;
                  }

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Order Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {dateDisplay}
                        </div>
                        {timeDisplay && (
                          <div className="text-[11px] text-slate-400">
                            {timeDisplay}
                          </div>
                        )}
                      </td>

                      {/* 2. Invoice ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {invoiceId}
                      </td>

                      {/* 3. Customer Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {order.customerName || 'Walk-in Customer'}
                        </div>
                        {contact ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{contact}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 mt-0.5">No contact saved</div>
                        )}
                      </td>

                      {/* 4. Items Purchased (e.g., "2x Black Bag, 1x Mouse") */}
                      <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                        <div className="line-clamp-2 text-slate-800 dark:text-slate-200 font-medium" title={itemsListText}>
                          {itemsListText}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {orderItems.length} distinct item{orderItems.length !== 1 ? 's' : ''}
                        </div>
                      </td>

                      {/* 5. Grand Total */}
                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white whitespace-nowrap text-sm">
                        {formatCurrency(order.grandTotal || 0)}
                      </td>

                      {/* 6. Action button (Copy Invoice ID + View Slip) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyInvoiceId(invoiceId)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                            }`}
                            title="Copy Invoice ID to clipboard for customer returns"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                                <span>Copy ID</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(order)}
                            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-300 dark:border-slate-700"
                            title="View & Reprint Invoice Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
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

      {/* Invoice Receipt Slip Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8 print:my-0 print:p-0 print:w-full print:max-w-none print:border-none print:shadow-none print:bg-white">
            {/* Modal Header (Hidden on Print) */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800 no-print print:hidden">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Invoice Slip #{selectedInvoice.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Slip Paper */}
            <div 
              ref={receiptRef}
              id="receipt-print-area"
              className="receipt-print-container print-area print:block print:w-full print:m-0 print:p-6 print:bg-white print:text-black bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-3 shadow-xs"
            >
              <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-400">
                <div className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white print:text-black">
                  Identity IMS Retail Store
                </div>
                <div className="text-[10px] text-slate-500 print:text-slate-600">Official Commercial Sales Invoice</div>
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 print:text-black font-bold mt-1">#{selectedInvoice.orderNumber}</div>
              </div>

              {/* Meta details */}
              <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 print:text-slate-800 pb-2 border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-400">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-900 dark:text-white print:text-black">{selectedInvoice.customerName || 'Walk-in Customer'}</span>
                </div>
                {(selectedInvoice.customerContact || selectedInvoice.customerPhone) && (
                  <div className="flex justify-between">
                    <span>Contact:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 print:text-black">{selectedInvoice.customerContact || selectedInvoice.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span className="print:text-black">{selectedInvoice.cashier || 'Terminal #01'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="print:text-black">{selectedInvoice.orderDate || (selectedInvoice.date ? selectedInvoice.date.split('T')[0] : 'N/A')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span className="print:text-black">{selectedInvoice.paymentMethod || 'Cash'} ({selectedInvoice.paymentStatus || 'Paid'})</span>
                </div>
                {selectedInvoice.authReference && (
                  <div className="flex justify-between">
                    <span>Auth / Terminal ID:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 print:text-black">{selectedInvoice.authReference}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5 pb-2 border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-400">
                <div className="font-bold text-[10px] text-slate-400 print:text-slate-600 uppercase flex justify-between">
                  <span>Item / Qty</span>
                  <span>Total</span>
                </div>
                {getOrderItems(selectedInvoice).length > 0 ? (
                  getOrderItems(selectedInvoice).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[11px]">
                      <div className="pr-2">
                        <div className="text-slate-900 dark:text-white print:text-black font-medium">{item.title || item.name}</div>
                        <div className="text-slate-500 print:text-slate-600 text-[10px]">{item.quantity || 1} × {formatCurrency(item.unitPrice || 0)}</div>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white print:text-black whitespace-nowrap">
                        {formatCurrency(item.total || ((item.quantity || 1) * (item.unitPrice || 0)))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 print:text-slate-600 text-center py-2 text-[10px]">No item breakdown stored</div>
                )}
              </div>

              {/* Financial summary */}
              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between text-slate-500 print:text-slate-800">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedInvoice.subtotal || selectedInvoice.grandTotal || 0)}</span>
                </div>
                {Number(selectedInvoice.taxAmount || 0) > 0 && (
                  <div className="flex justify-between text-slate-500 print:text-slate-800">
                    <span>Tax ({selectedInvoice.orderTax || selectedInvoice.taxPercent || 0}%):</span>
                    <span>{formatCurrency(selectedInvoice.taxAmount)}</span>
                  </div>
                )}
                {Number(selectedInvoice.discountTotal || selectedInvoice.globalDiscount || 0) > 0 && (
                  <div className="flex justify-between text-amber-500 print:text-slate-800">
                    <span>Discount:</span>
                    <span>-{formatCurrency(selectedInvoice.discountTotal || selectedInvoice.globalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white print:text-black pt-1 border-t border-slate-300 dark:border-slate-700 print:border-slate-400">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(selectedInvoice.grandTotal || 0)}</span>
                </div>
              </div>

              {/* Barcode & Footer */}
              <div className="text-center pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 print:border-slate-400 space-y-2">
                <div className="flex flex-col items-center justify-center">
                  <div className="tracking-[4px] font-bold text-xs text-slate-800 dark:text-slate-200 print:text-black">
                    *{selectedInvoice.orderNumber}*
                  </div>
                  <div className="w-48 h-7 bg-slate-900 print:bg-black flex items-center justify-center text-white text-[8px] tracking-widest mt-1">
                    || | || |||| | | ||| || |||
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 print:text-slate-700">
                  Thank you for shopping with us!
                </div>
              </div>
            </div>

            {/* Modal Actions (Hidden on Print) */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 no-print print:hidden">
              <button
                type="button"
                onClick={() => handleCopyInvoiceId(selectedInvoice.orderNumber)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors text-xs font-semibold cursor-pointer border border-slate-300 dark:border-slate-700"
              >
                {copiedId === selectedInvoice.orderNumber ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer text-xs"
                >
                  <Printer className="w-4 h-4" />
                  Reprint Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
