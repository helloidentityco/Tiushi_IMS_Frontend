import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  RotateCcw, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  DollarSign, 
  ArrowLeftRight, 
  HelpCircle,
  Package,
  Search,
  X,
  FileText,
  Phone,
  Mail,
  Building2,
  Percent,
  Check,
  AlertCircle,
  User,
  ArrowRight,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

export default function Returns() {
  const appContext = useApp() || {};
  const { 
    t = {}, 
    formatCurrency = (v) => `$${Number(v || 0).toFixed(2)}`, 
    activeWarehouseId, 
    logAudit = () => Promise.resolve() 
  } = appContext;

  // Safe local states initialized as empty arrays
  const [customerReturns, setCustomerReturns] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal and Form States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [hasInvoice, setHasInvoice] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [returnFormData, setReturnFormData] = useState({
    originalOrderNumber: '',
    saleId: '',
    productId: '',
    unitPrice: 0,
    quantity: 1,
    baseRefundAmount: 0,
    condition: 'Restockable', // 'Restockable' | 'Damaged/Scrapped'
    restockWarehouseId: '',
    refundType: 'Store Credit', // 'Store Credit' | 'Original Payment Cash'
    restockFeePercentage: 0,
    customerContact: '',
    reason: 'Customer ordered wrong color/model'
  });

  // Fetch returns, sales, products, and warehouses from backend API
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [returnsRes, salesRes, prodRes, whRes] = await Promise.all([
        api.get('/returns').catch(() => ({ data: { data: [] } })),
        api.get('/sales').catch(() => ({ data: { data: [] } })),
        api.get('/products').catch(() => ({ data: { data: [] } })),
        api.get('/warehouses').catch(() => ({ data: { data: [] } })),
      ]);

      const rawReturns = Array.isArray(returnsRes.data?.data) ? returnsRes.data.data : [];
      const normalizedReturns = rawReturns.map(r => ({
        id: r?.id,
        returnNumber: r?.returnNumber || `RET-${r?.id?.slice(0, 8)}`,
        originalOrderNumber: r?.sale?.invoiceNumber || (r?.saleId ? `INV-${r.saleId.slice(0, 8)}` : 'DIRECT-RETURN'),
        hasInvoice: Boolean(r?.saleId || r?.sale),
        productId: r?.productId,
        productTitle: r?.product?.name || r?.product?.sku || 'Returned Item',
        quantity: Number(r?.quantity || 1),
        condition: 'Restockable',
        restockWarehouseId: r?.warehouseId,
        warehouseName: r?.warehouse?.name || 'Warehouse Depot',
        refundType: 'Store Credit',
        refundAmount: Number(r?.refundAmount || 0),
        finalRefundAmount: Number(r?.refundAmount || 0),
        customerContact: r?.customerContact || '',
        reason: r?.reason || 'Customer return',
        date: r?.createdAt || new Date().toISOString(),
        status: r?.status || 'Completed'
      }));
      setCustomerReturns(normalizedReturns);

      const rawSales = Array.isArray(salesRes.data?.data) ? salesRes.data.data : [];
      const normalizedSales = rawSales.map(s => {
        const rawItems = Array.isArray(s?.sale_items) ? s.sale_items : (Array.isArray(s?.items) ? s.items : []);
        const mappedItems = rawItems.map(it => ({
          id: it?.id,
          productId: it?.productId,
          title: it?.product?.name || it?.title || 'Product',
          quantity: Number(it?.quantity || 1),
          unitPrice: Number(it?.unitPrice || 0),
          product: it?.product
        }));
        return {
          ...s,
          orderNumber: s?.invoiceNumber || `INV-${s?.id?.slice(0, 8)}`,
          customerName: s?.customerName || 'Walk-in Customer',
          grandTotal: Number(s?.totalAmount || 0),
          items: mappedItems,
          sale_items: mappedItems
        };
      });
      setSalesOrders(normalizedSales);

      const prodList = Array.isArray(prodRes.data?.data) ? prodRes.data.data : [];
      setProducts(prodList);

      const whList = Array.isArray(whRes.data?.data) ? whRes.data.data : [];
      setWarehouses(whList);

      if (whList.length > 0 && !returnFormData.restockWarehouseId) {
        setReturnFormData(prev => ({ ...prev, restockWarehouseId: whList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load Returns data from API:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered orders for invoice lookup
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(salesOrders)) return [];
    if (!searchQuery.trim()) return salesOrders.slice(0, 5);
    const q = searchQuery.toLowerCase().trim();
    return salesOrders.filter(o => {
      if (!o) return false;
      const orderNum = (o?.orderNumber || '').toLowerCase();
      const custName = (o?.customerName || '').toLowerCase();
      const phone = (o?.customerContact || o?.customerPhone || '').toLowerCase();
      return orderNum.includes(q) || custName.includes(q) || phone.includes(q);
    }).slice(0, 8);
  }, [salesOrders, searchQuery]);

  // Form Reset
  const resetForm = () => {
    setHasInvoice(true);
    setSearchQuery('');
    setSelectedOrder(null);
    setIsSearchOpen(false);
    const firstProd = products?.[0];
    const initialPrice = Number(firstProd?.sellingPrice || 0);
    const targetWh = activeWarehouseId || warehouses?.[0]?.id || '';
    setReturnFormData({
      originalOrderNumber: '',
      saleId: '',
      productId: firstProd?.id || '',
      unitPrice: initialPrice,
      quantity: 1,
      baseRefundAmount: initialPrice,
      condition: 'Restockable',
      restockWarehouseId: targetWh,
      refundType: 'Store Credit',
      restockFeePercentage: 0,
      customerContact: '',
      reason: 'Customer ordered wrong color/model'
    });
  };

  const handleOpenModal = () => {
    resetForm();
    setShowReturnModal(true);
  };

  // Select order from dropdown
  const handleSelectOrder = (order) => {
    if (!order) return;
    setSelectedOrder(order);
    setSearchQuery(order?.orderNumber || '');
    setIsSearchOpen(false);

    const contact = order?.customerContact || order?.customerPhone || '';
    const orderItems = Array.isArray(order?.sale_items) && order.sale_items.length > 0
      ? order.sale_items
      : (Array.isArray(order?.items) ? order.items : []);
    const firstItem = orderItems.length > 0 ? orderItems[0] : null;
    const prodId = firstItem?.productId || '';
    const price = firstItem ? Number(firstItem?.unitPrice || 0) : 0;
    const qty = 1;

    setReturnFormData(prev => ({
      ...prev,
      saleId: order?.id || '',
      originalOrderNumber: order?.orderNumber || '',
      customerContact: contact || prev.customerContact,
      productId: prodId,
      unitPrice: price,
      quantity: qty,
      baseRefundAmount: parseFloat((price * qty).toFixed(2))
    }));
  };

  // Toggle invoice linkage
  const handleToggleInvoice = (isDirect) => {
    setHasInvoice(!isDirect);
    if (isDirect) {
      setSelectedOrder(null);
      setSearchQuery('');
      setIsSearchOpen(false);
      const defaultProd = products?.[0];
      const initialPrice = Number(defaultProd?.sellingPrice || 0);
      setReturnFormData(prev => ({
        ...prev,
        saleId: '',
        originalOrderNumber: 'DIRECT-RETURN',
        productId: defaultProd?.id || '',
        unitPrice: initialPrice,
        quantity: 1,
        baseRefundAmount: initialPrice
      }));
    } else {
      setSelectedOrder(null);
      setSearchQuery('');
      setIsSearchOpen(false);
      setReturnFormData(prev => ({
        ...prev,
        saleId: '',
        originalOrderNumber: '',
        productId: '',
        unitPrice: 0,
        quantity: 1,
        baseRefundAmount: 0
      }));
    }
  };

  // Current item selected from linked invoice
  const selectedInvoiceItem = useMemo(() => {
    if (!hasInvoice || !selectedOrder) return null;
    const items = selectedOrder?.sale_items || selectedOrder?.items || [];
    return items.find(it => it?.productId === returnFormData.productId) || null;
  }, [hasInvoice, selectedOrder, returnFormData.productId]);

  const maxReturnQuantity = selectedInvoiceItem ? Number(selectedInvoiceItem.quantity || 1) : null;

  // Dynamic Financial Auto-Calculations
  const baseAmount = Math.max(0, Number(returnFormData.baseRefundAmount) || 0);
  const feePercent = Math.min(100, Math.max(0, Number(returnFormData.restockFeePercentage) || 0));
  const feeDeduction = (baseAmount * feePercent) / 100;
  const finalRefund = Math.max(0, baseAmount - feeDeduction);

  // Submit Return
  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      if (hasInvoice && !selectedOrder && !returnFormData.originalOrderNumber) {
        alert('Please search and select a valid sales invoice, or check "Return Without Invoice".');
        return;
      }

      if (!returnFormData.productId) {
        alert('Please select a product for the return.');
        return;
      }

      if (hasInvoice && selectedOrder && maxReturnQuantity !== null && Number(returnFormData.quantity || 1) > maxReturnQuantity) {
        alert(`Return quantity cannot exceed the original quantity purchased (${maxReturnQuantity}) in this invoice.`);
        return;
      }

      setIsSubmitting(true);
      const returnNumber = `RET-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const prod = products?.find(p => p?.id === returnFormData.productId) || 
        selectedOrder?.items?.find(it => it?.productId === returnFormData.productId);

      const targetWarehouse = returnFormData.restockWarehouseId || activeWarehouseId || warehouses?.[0]?.id || null;

      const payload = {
        saleId: returnFormData.saleId || selectedOrder?.id || null,
        returnNumber,
        productId: returnFormData.productId,
        warehouseId: targetWarehouse,
        quantity: Number(returnFormData.quantity || 1),
        refundAmount: parseFloat(finalRefund.toFixed(2)),
        reason: returnFormData.reason || 'Customer return',
        status: 'Completed',
        customerContact: (returnFormData.customerContact || '').trim(),
        condition: returnFormData.condition
      };

      const res = await api.post('/returns', payload);
      const createdReturn = res.data?.data;

      const newReturnObj = {
        id: createdReturn?.id || `ret-${Date.now()}`,
        returnNumber: createdReturn?.returnNumber || returnNumber,
        originalOrderNumber: hasInvoice ? (returnFormData.originalOrderNumber || 'N/A') : 'DIRECT-RETURN',
        hasInvoice: Boolean(hasInvoice),
        productId: returnFormData.productId,
        productTitle: prod?.name || prod?.title || 'Returned Item',
        quantity: Number(returnFormData.quantity || 1),
        condition: returnFormData.condition,
        restockWarehouseId: targetWarehouse,
        warehouseName: warehouses?.find(w => w?.id === targetWarehouse)?.name || 'Warehouse Depot',
        refundType: returnFormData.refundType,
        refundAmount: parseFloat(finalRefund.toFixed(2)),
        finalRefundAmount: parseFloat(finalRefund.toFixed(2)),
        customerContact: (returnFormData.customerContact || '').trim(),
        reason: returnFormData.reason || 'Customer return',
        date: createdReturn?.createdAt || new Date().toISOString(),
        status: 'Completed'
      };

      setCustomerReturns(prev => [newReturnObj, ...(Array.isArray(prev) ? prev : [])]);

      await logAudit(
        'Sales Return Processed',
        'Returns Management',
        `Processed return ${returnNumber} (${hasInvoice ? 'Invoice: ' + returnFormData.originalOrderNumber : 'Direct Return'}). Product: ${newReturnObj.productTitle}, Qty: ${newReturnObj.quantity}, Final Refund: ${formatCurrency(newReturnObj.finalRefundAmount)}.`
      );

      setShowReturnModal(false);
      resetForm();
    } catch (err) {
      console.error('Error processing return:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to process return.';
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t?.returns || 'Returns Management'}</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {customerReturns?.length || 0} Processed
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Enterprise customer return workflow with invoice tracing, price adjustments, restocking fee deductions, and destination warehouse deposits.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Process Customer Return
        </button>
      </div>

      {/* Returns Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Return #</th>
                <th className="py-3 px-4">Orig Invoice / Mode</th>
                <th className="py-3 px-4">Customer Contact</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Restock Location</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Amount Refunded</th>
                <th className="py-3 px-4">Refund Method</th>
                <th className="py-3 px-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Loading returns records from backend...</span>
                    </div>
                  </td>
                </tr>
              ) : (customerReturns?.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    No returns logged. Click "Process Customer Return" to record a return.
                  </td>
                </tr>
              ) : (
                customerReturns?.map(ret => {
                  const wh = warehouses?.find(w => w?.id === ret?.restockWarehouseId);
                  const isDirect = ret?.hasInvoice === false || ret?.originalOrderNumber === 'DIRECT-RETURN';
                  const refund = Number(ret?.finalRefundAmount !== undefined ? ret.finalRefundAmount : (ret?.refundAmount || 0));

                  return (
                    <tr key={ret?.id || Math.random()} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-rose-500 whitespace-nowrap">
                        {ret?.returnNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isDirect ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Direct (No Inv)
                          </span>
                        ) : (
                          <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                            {ret?.originalOrderNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {ret?.customerContact || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white max-w-[200px] truncate" title={ret?.productTitle}>
                        {ret?.productTitle}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {wh?.code || wh?.name || ret?.warehouseName || 'General Depot'}
                      </td>
                      <td className="py-3 px-4 font-bold">{ret?.quantity || 1}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ret?.condition === 'Restockable'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                        }`}>
                          {ret?.condition || 'Restockable'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-black text-slate-900 dark:text-white text-xs">
                          {formatCurrency(refund)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {ret?.refundType || 'Store Credit'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-[160px] truncate" title={ret?.reason}>
                        {ret?.reason}
                      </td>
                    </tr>
                  );
                })
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Customer Return & Restock Workflow */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-indigo-500" />
                  Customer Return & Restock Workflow
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Process item returns, price adjustments, and destination warehouse deposits
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessReturn} className="space-y-4 text-xs">
              {/* 1. Smart Invoice Search & Direct Return Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    Original Invoice Number
                  </label>
                  {hasInvoice && selectedOrder && (
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Invoice Linked
                    </span>
                  )}
                </div>

                {hasInvoice ? (
                  <div className="relative">
                    {selectedOrder ? (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                              {selectedOrder?.orderNumber}
                            </span>
                            <span className="text-slate-400 text-[10px]">•</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                              {selectedOrder?.customerName || 'Walk-in Customer'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3">
                            <span>Total: <b className="text-slate-700 dark:text-slate-200">{formatCurrency(selectedOrder?.grandTotal || 0)}</b></span>
                            {(selectedOrder?.customerContact || selectedOrder?.customerPhone) && (
                              <span>Contact: <b className="text-slate-700 dark:text-slate-200">{selectedOrder.customerContact || selectedOrder.customerPhone}</b></span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(null);
                            setSearchQuery('');
                            setIsSearchOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-600 rounded-lg transition-colors font-medium cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onFocus={() => setIsSearchOpen(true)}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setIsSearchOpen(true);
                            }}
                            placeholder="Search by Invoice #, Customer Name, or Phone..."
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setIsSearchOpen(false);
                              }}
                              className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {isSearchOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl max-h-56 overflow-y-auto z-30 divide-y divide-slate-100 dark:divide-slate-800">
                            {(filteredOrders?.length === 0) ? (
                              <div className="p-3 text-center text-slate-400 text-xs">
                                No matching sales invoices found.
                              </div>
                            ) : (
                              filteredOrders?.map(order => (
                                <div
                                  key={order?.id || Math.random()}
                                  onClick={() => handleSelectOrder(order)}
                                  className="p-2.5 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex items-center justify-between"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                        {order?.orderNumber}
                                      </span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {order?.customerName}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                      <span>Date: {order?.orderDate || (order?.date ? order.date.split('T')[0] : 'N/A')}</span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-black text-slate-900 dark:text-white">
                                      {formatCurrency(order?.grandTotal || 0)}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Processing return without original receipt reference (Direct Return).</span>
                  </div>
                )}

                {/* Direct Return Checkbox */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={!hasInvoice}
                      onChange={(e) => handleToggleInvoice(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Return Without Invoice (Direct Store Return)</span>
                  </label>
                </div>
              </div>

              {/* 2. Product Selection */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-400" />
                    Product to Return
                  </span>
                  {hasInvoice && selectedOrder && (
                    <span className="text-[11px] text-indigo-500 font-medium">
                      {(selectedOrder?.sale_items || selectedOrder?.items || []).length} items in invoice
                    </span>
                  )}
                </label>
                <select
                  value={returnFormData.productId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (hasInvoice && selectedOrder) {
                      const items = selectedOrder?.sale_items || selectedOrder?.items || [];
                      const item = items.find(it => it.productId === selectedId);
                      const price = Number(item?.unitPrice || 0);
                      const maxAllowed = item ? Number(item.quantity || 1) : 1;
                      const currentQty = Math.min(Number(returnFormData.quantity || 1), maxAllowed);
                      setReturnFormData(prev => ({
                        ...prev,
                        productId: selectedId,
                        unitPrice: price,
                        quantity: currentQty,
                        baseRefundAmount: parseFloat((price * currentQty).toFixed(2))
                      }));
                    } else {
                      const prod = products?.find(p => p?.id === selectedId);
                      const price = Number(prod?.sellingPrice || 0);
                      const qty = Number(returnFormData.quantity || 1);
                      setReturnFormData(prev => ({
                        ...prev,
                        productId: selectedId,
                        unitPrice: price,
                        baseRefundAmount: parseFloat((price * qty).toFixed(2))
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="" disabled>
                    {hasInvoice && !selectedOrder
                      ? 'Select an invoice above first...'
                      : 'Select returned item...'}
                  </option>
                  {hasInvoice && selectedOrder ? (
                    (selectedOrder?.sale_items || selectedOrder?.items || []).length > 0 ? (
                      (selectedOrder?.sale_items || selectedOrder?.items || []).map((item) => (
                        <option key={item.productId || item.id} value={item.productId}>
                          {item.title || item.product?.name || 'Product'} — Qty Purchased: {item.quantity} (Price: {formatCurrency(item.unitPrice)})
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No products found in this invoice</option>
                    )
                  ) : (
                    products?.map(p => (
                      <option key={p?.id} value={p?.id}>
                        {p?.name || p?.title} ({p?.sku}) — {formatCurrency(p?.sellingPrice)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* 3. Destination Warehouse */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Restock Destination Warehouse
                </label>
                <select
                  value={returnFormData.restockWarehouseId}
                  onChange={(e) => setReturnFormData(prev => ({ ...prev, restockWarehouseId: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {warehouses?.map(w => (
                    <option key={w?.id} value={w?.id}>
                      {w?.name} ({w?.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Quantity and Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                    <span>Quantity</span>
                    {maxReturnQuantity !== null && (
                      <span className="text-[11px] font-semibold text-indigo-500">
                        Max Allowed: {maxReturnQuantity}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={maxReturnQuantity || undefined}
                    value={returnFormData.quantity}
                    onChange={(e) => {
                      let qty = parseInt(e.target.value) || 1;
                      if (maxReturnQuantity !== null && qty > maxReturnQuantity) {
                        qty = maxReturnQuantity;
                      }
                      qty = Math.max(1, qty);
                      const unit = Number(returnFormData.unitPrice || 0);
                      setReturnFormData(prev => ({
                        ...prev,
                        quantity: qty,
                        baseRefundAmount: parseFloat((unit * qty).toFixed(2))
                      }));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                  {maxReturnQuantity !== null && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Constrained to original purchased quantity ({maxReturnQuantity}).
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Physical Condition
                  </label>
                  <select
                    value={returnFormData.condition}
                    onChange={(e) => setReturnFormData(prev => ({ ...prev, condition: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Restockable">Restockable (Resellable)</option>
                    <option value="Damaged/Scrapped">Damaged / Scrapped (Write-off)</option>
                  </select>
                </div>
              </div>

              {/* 5. Financial Adjustments & Restock Fee */}
              <div className="p-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Financial Refund Calculation</span>
                  <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Base Refund ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={returnFormData.baseRefundAmount}
                      onChange={(e) => setReturnFormData(prev => ({ ...prev, baseRefundAmount: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Restock Fee (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={returnFormData.restockFeePercentage}
                      onChange={(e) => setReturnFormData(prev => ({ ...prev, restockFeePercentage: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Total Net Refund:</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(finalRefund)}
                  </span>
                </div>
              </div>

              {/* 6. Customer Contact & Reason */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Customer Contact
                  </label>
                  <input
                    type="text"
                    value={returnFormData.customerContact}
                    onChange={(e) => setReturnFormData(prev => ({ ...prev, customerContact: e.target.value }))}
                    placeholder="Phone or Email..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Return Reason
                  </label>
                  <input
                    type="text"
                    value={returnFormData.reason}
                    onChange={(e) => setReturnFormData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="e.g., Wrong size, Defective..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isSubmitting ? 'Processing...' : 'Confirm Return'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
