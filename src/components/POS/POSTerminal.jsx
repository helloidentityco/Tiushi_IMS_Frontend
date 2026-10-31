import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Warehouse, 
  Percent, 
  User, 
  ShoppingBag,
  Tag,
  Calendar,
  Truck
} from 'lucide-react';
import FastPaymentModal from './FastPaymentModal';
import ReceiptModal from './ReceiptModal';

export default function POSTerminal() {
  const appContext = useApp() || {};
  const { 
    t = {}, 
    formatCurrency = (v) => `$${Number(v || 0).toFixed(2)}`, 
    activeWarehouseId = 'wh-1', 
    currentRole = 'admin', 
    logAudit = () => Promise.resolve() 
  } = appContext;

  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch catalog products and warehouses from backend API
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [prodRes, whRes] = await Promise.all([
        api.get('/products'),
        api.get('/warehouses'),
      ]);
      const rawProducts = Array.isArray(prodRes.data?.data) ? prodRes.data.data : [];
      const normalizedProducts = rawProducts.map(p => {
        // Calculate total stock by reducing/summing quantity from nested product.stock array
        const totalStock = Array.isArray(p.stock)
          ? p.stock.reduce((sum, s) => sum + Math.max(0, Number(s?.quantity || 0)), 0)
          : Math.max(0, Number(p?.quantity ?? 0));

        const img = p.imageUrl || p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300';

        return {
          ...p,
          title: p.name || p.title || 'Product',
          sellingPrice: Number(p.sellingPrice || 0),
          imageUrl: img,
          image: img,
          totalStock,
          stock: Array.isArray(p.stock) ? p.stock : []
        };
      });
      setProducts(normalizedProducts);
      const whList = Array.isArray(whRes.data?.data) ? whRes.data.data : [];
      setWarehouses(whList);
      if (whList.length > 0) {
        setSelectedWarehouseId(prev => whList.some(w => w.id === prev) ? prev : whList[0].id);
      }
    } catch (err) {
      console.error('Failed to load POS catalog data from API:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);

  // Advanced Order Attributes
  const [customerName, setCustomerName] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(activeWarehouseId || 'wh-1');
  const [orderState, setOrderState] = useState('Completed'); // 'Completed' | 'Pending' | 'Compiled'
  const [paymentStatus, setPaymentStatus] = useState('Paid'); // 'Paid' | 'Unpaid' | 'Partial'
  const [notes, setNotes] = useState('');

  // Global Order Modifiers (safe numeric state)
  const [orderTax, setOrderTax] = useState(0); // Global Tax (%)
  const [globalDiscount, setGlobalDiscount] = useState(0); // Flat-rate discount (Rs.)
  const [shipmentCost, setShipmentCost] = useState(0); // Flat-rate shipment (Rs.)

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  const searchInputRef = useRef(null);

  // Sync default warehouse if context loads asynchronously
  useEffect(() => {
    if (activeWarehouseId) {
      setSelectedWarehouseId(prev => prev || activeWarehouseId);
    }
  }, [activeWarehouseId]);

  // Focus search input on mount & keyboard hotkeys
  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (e) => {
      // F9 Hotkey for checkout
      if (e.key === 'F9') {
        e.preventDefault();
        if ((cart || []).length > 0) setShowPaymentModal(true);
      }
      // F2 to focus product search/scanner
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to cancel modal
      if (e.key === 'Escape') {
        setShowPaymentModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Extract unique categories safely
  const categories = ['All', ...new Set((products || []).map(p => p?.category).filter(Boolean))];

  // Map stock for the currently selected warehouse with fallback to totalStock
  const effectiveWarehouseId = selectedWarehouseId || activeWarehouseId || warehouses[0]?.id;
  const currentWarehouseStockMap = useMemo(() => {
    const map = {};
    (products || []).forEach(p => {
      // 1. Total stock across all warehouses
      const totalStock = Array.isArray(p.stock)
        ? p.stock.reduce((sum, s) => sum + Math.max(0, Number(s?.quantity || 0)), 0)
        : Math.max(0, Number(p?.totalStock ?? p?.quantity ?? 0));

      // 2. Warehouse specific stock
      const stockEntry = Array.isArray(p.stock)
        ? p.stock.find(s => s?.warehouseId === effectiveWarehouseId)
        : null;

      const whStock = stockEntry !== null && stockEntry !== undefined ? Number(stockEntry.quantity || 0) : null;
      map[p.id] = whStock !== null ? whStock : totalStock;
    });
    return map;
  }, [products, effectiveWarehouseId]);

  // Filtered products list
  const filteredProducts = (products || []).filter(p => {
    if (!p) return false;
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const query = (searchQuery || '').toLowerCase().trim();
    const title = (p.title || p.name || '').toLowerCase();
    const sku = (p.sku || '').toLowerCase();
    const barcode = (p.barcode || '');
    const matchesSearch = !query || 
      title.includes(query) ||
      sku.includes(query) ||
      barcode.includes(query);
    return matchesCat && matchesSearch;
  });

  // Handle Barcode Scanner Instant Add (exact barcode match on enter)
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      const match = (products || []).find(p => 
        (p?.barcode && p.barcode === searchQuery.trim()) || 
        (p?.sku && p.sku.toLowerCase() === searchQuery.toLowerCase().trim())
      );
      if (match) {
        addToCart(match);
        setSearchQuery('');
      }
    }
  };

  // Add product to cart
  const addToCart = (product) => {
    if (!product) return;
    const availableStock = currentWarehouseStockMap[product.id] ?? 0;
    
    setCart(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const existing = safePrev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= availableStock) {
          alert(`Warning: Only ${availableStock} units available in this deposit!`);
        }
        return safePrev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.sellingPrice }
            : item
        );
      }
      return [
        ...safePrev,
        {
          ...product,
          quantity: 1,
          lineDiscount: 0,
          total: product.sellingPrice
        }
      ];
    });
  };

  const updateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const availableStock = currentWarehouseStockMap[productId] ?? 0;
    if (newQty > availableStock) {
      alert(`Warning: Available stock in this deposit is ${availableStock}!`);
    }
    setCart(prev =>
      (prev || []).map(item =>
        item.id === productId
          ? { ...item, quantity: newQty, total: newQty * item.sellingPrice }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(prev => (prev || []).filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setNotes('');
    setOrderTax(0);
    setGlobalDiscount(0);
    setShipmentCost(0);
  };

  // Safe Cart Calculations: (Subtotal + Order Tax %) - Discount + Shipment
  const safeCart = Array.isArray(cart) ? cart : [];
  const subtotal = safeCart.reduce((sum, item) => sum + (Number(item?.total) || 0), 0);

  const parsedTax = isNaN(Number(orderTax)) ? 0 : Math.max(0, Number(orderTax));
  const parsedDiscount = isNaN(Number(globalDiscount)) ? 0 : Math.max(0, Number(globalDiscount));
  const parsedShipment = isNaN(Number(shipmentCost)) ? 0 : Math.max(0, Number(shipmentCost));

  const taxAmount = subtotal * (parsedTax / 100);
  const discountAmount = parsedDiscount;
  const shippingAmount = parsedShipment;
  const grandTotal = Math.max(0, (subtotal + taxAmount) - discountAmount + shippingAmount);
  const totalItemCount = safeCart.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);

  // Safe Modifier input handlers preventing NaN
  const handleTaxChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      setOrderTax('');
    } else {
      const num = Number(val);
      setOrderTax(isNaN(num) ? 0 : Math.max(0, num));
    }
  };

  const handleDiscountChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      setGlobalDiscount('');
    } else {
      const num = Number(val);
      setGlobalDiscount(isNaN(num) ? 0 : Math.max(0, num));
    }
  };

  const handleShipmentChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      setShipmentCost('');
    } else {
      const num = Number(val);
      setShipmentCost(isNaN(num) ? 0 : Math.max(0, num));
    }
  };

  // Complete Order & Deduct Warehouse Stock
  const handleCompleteOrder = async (paymentDetails) => {
    try {
      const orderNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const finalCustomer = (paymentDetails.customerName || customerName || '').trim() || 'Walk-in Customer';
      const finalOrderDate = paymentDetails.orderDate || orderDate || new Date().toISOString().split('T')[0];
      const finalWarehouseId = paymentDetails.warehouseId || effectiveWarehouseId;
      const finalOrderState = paymentDetails.orderState || orderState || 'Completed';
      const finalPaymentStatus = paymentDetails.paymentStatus || paymentStatus || 'Paid';
      const finalNotes = paymentDetails.notes !== undefined ? paymentDetails.notes : notes;
      
      const finalPaymentMethod = paymentDetails.paymentMethod || 'Cash';
      const isCardPayment = finalPaymentMethod === 'Credit Card';

      // Strict validation: Require authReference for card payments
      if (isCardPayment && paymentDetails.paymentStatus !== 'Unpaid' && !paymentDetails.authReference?.trim()) {
        alert('Card Validation Error: Transaction / Auth Reference is required for card checkout.');
        return;
      }

      // Build payload for backend POST /api/sales
      const checkoutPayload = {
        invoiceNumber: orderNumber,
        warehouseId: finalWarehouseId,
        customerName: finalCustomer,
        discount: discountAmount,
        paymentMethod: finalPaymentMethod,
        authReference: isCardPayment && paymentDetails.authReference ? paymentDetails.authReference.trim() : undefined,
        status: finalOrderState,
        items: safeCart.map(item => ({
          productId: item.id,
          quantity: Number(item.quantity),
          unitPrice: Number(item.sellingPrice || 0)
        }))
      };

      // 1. Submit sale to backend API with atomic stock deduction in DB transaction
      const res = await api.post('/sales', checkoutPayload);
      const createdSale = res.data?.data;

      // 2. Refresh products & stock levels from backend
      await fetchData();

      // 3. Prepare normalized order object for Receipt Modal
      const receiptOrder = {
        ...createdSale,
        orderNumber: createdSale?.invoiceNumber || orderNumber,
        cashier: currentRole === 'cashier' ? 'Alice Vance (Cashier)' : 'Store Admin',
        customerName: finalCustomer,
        orderDate: finalOrderDate,
        date: createdSale?.createdAt || new Date().toISOString(),
        warehouseId: finalWarehouseId,
        orderState: finalOrderState,
        status: finalOrderState,
        paymentStatus: finalPaymentStatus,
        subtotal: subtotal,
        orderTax: parsedTax,
        taxPercent: parsedTax,
        taxAmount: taxAmount,
        globalDiscount: discountAmount,
        discountTotal: discountAmount,
        shipmentCost: shippingAmount,
        grandTotal: createdSale?.totalAmount ? Number(createdSale.totalAmount) : grandTotal,
        paymentMethod: finalPaymentMethod,
        ...(isCardPayment && paymentDetails.authReference ? { authReference: paymentDetails.authReference.trim() } : {}),
        amountPaid: paymentDetails.amountPaid !== undefined 
          ? paymentDetails.amountPaid 
          : (finalPaymentStatus === 'Paid' ? grandTotal : 0),
        changeDue: paymentDetails.changeDue || 0,
        notes: finalNotes || '',
        items: safeCart.map(item => ({
          productId: item.id,
          title: item.title || item.name,
          quantity: item.quantity,
          unitPrice: item.sellingPrice,
          discount: item.lineDiscount || 0,
          total: item.total
        }))
      };

      // 4. Log to audit trail
      await logAudit(
        'POS Sale Completed',
        'POS Terminal',
        `Completed invoice ${createdSale?.invoiceNumber || orderNumber} for ${finalCustomer} (${formatCurrency(createdSale?.totalAmount || grandTotal)} via ${paymentDetails.paymentMethod || 'Cash'}). State: ${finalOrderState}, Payment: ${finalPaymentStatus}.`
      );

      // 5. Update UI
      setShowPaymentModal(false);
      setCompletedOrder(receiptOrder);
      clearCart();
    } catch (err) {
      console.error('Order completion error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error finalizing sale. Please try again.';
      alert(errorMessage);
    }
  };

  const activeWarehouse = (warehouses || []).find(w => w?.id === effectiveWarehouseId);

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col lg:flex-row gap-5">
      
      {/* LEFT SECTION: Search, Filters, & Product Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs overflow-hidden">
        
        {/* Search Bar & Quick Scan Input */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t?.searchPlaceholder || 'Search products by name, SKU, or barcode...'}
              className="w-full pl-11 pr-24 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="hidden sm:inline bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">F2</span>
              <Barcode className="w-4 h-4 text-indigo-500" />
            </div>
          </div>

          {/* Active Warehouse Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
            <Warehouse className="w-4 h-4" />
            <span>{activeWarehouse?.name || 'Warehouse'}</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none mb-3">
          {(categories || []).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {(filteredProducts || []).map(product => {
            const stockInWarehouse = currentWarehouseStockMap[product?.id] ?? product?.totalStock ?? 0;
            const isOutOfStock = stockInWarehouse <= 0;
            const isLowStock = stockInWarehouse > 0 && stockInWarehouse <= (product?.minStockAlert || product?.minStockLevel || 5);
            const imageSrc = product?.imageUrl || product?.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300';

            return (
              <div
                key={product?.id}
                onClick={() => !isOutOfStock && addToCart(product)}
                className={`group relative flex flex-col justify-between bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 cursor-pointer transition-all hover:border-indigo-500 hover:shadow-md ${
                  isOutOfStock ? 'opacity-50 cursor-not-allowed hover:border-slate-200' : 'active:scale-98'
                }`}
              >
                <div>
                  <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 mb-2.5">
                    <img
                      src={imageSrc}
                      alt={product?.title || product?.name || 'Product'}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Stock Availability Badge */}
                    <span
                      className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs ${
                        isOutOfStock
                          ? 'bg-rose-500/90 text-white'
                          : isLowStock
                          ? 'bg-amber-500/90 text-white'
                          : 'bg-emerald-600/90 text-white'
                      }`}
                    >
                      {isOutOfStock ? 'Out of Stock' : `${stockInWarehouse} in stock`}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                    {product?.title || product?.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                    <span>{product?.sku}</span>
                    <span>•</span>
                    <span className="text-indigo-500 font-medium">{product?.category}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {formatCurrency(product?.sellingPrice)}
                  </span>
                  <button 
                    disabled={isOutOfStock}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT SECTION: Cart & Order Attributes Panel */}
      <div className="w-full lg:w-[420px] shrink-0 h-full flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {/* Cart Header (Persistent Top) */}
        <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              {t?.cartSummary || 'Cart Summary'}
            </h3>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
              {totalItemCount} items
            </span>
          </div>
          {safeCart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Scrollable Middle Container (Wraps Order Attributes + Cart Line Items) */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3.5">
          {/* Compact Order Attributes Card */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-2.5">
            {/* 1. Customer Name (Free-text input, defaults to Walk-in Customer if blank) */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Customer Name
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Tighter 2-Column Grid for Order Attributes */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full pl-8 pr-1.5 py-1.5 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Deposit / Warehouse */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Deposit / Warehouse
                </label>
                <div className="relative">
                  <Warehouse className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={effectiveWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full pl-8 pr-1.5 py-1.5 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                  >
                    {(warehouses || []).map((wh, idx) => (
                      <option key={wh?.id || `wh-${idx}`} value={wh?.id || ''}>
                        {wh?.name || wh?.code || 'Warehouse'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Order State */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Order State
                </label>
                <select
                  value={orderState}
                  onChange={(e) => setOrderState(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                >
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="Compiled">Compiled</option>
                </select>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            {/* Notes Textarea (Full-width, rows="2") */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Internal Notes
              </label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order instructions or internal notes..."
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Cart Items Section */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
              <span>Cart Items ({totalItemCount})</span>
              {safeCart.length > 0 && (
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                  {formatCurrency(subtotal)}
                </span>
              )}
            </div>

            <div className="space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
              {safeCart.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-6 text-slate-400">
                  <ShoppingBag className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600 mb-1.5" />
                  <p className="text-xs font-medium">{t?.emptyCart || 'Your cart is empty'}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5">Press F2 or scan barcode to add</span>
                </div>
              ) : (
                safeCart.map(item => (
                  <div key={item?.id} className="pt-2 first:pt-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {item?.title}
                        </h5>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {formatCurrency(item?.sellingPrice)} each
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                        {formatCurrency(item?.total)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(item?.id, (item?.quantity || 1) - 1)}
                          className="p-1 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item?.quantity || 1}
                        </span>
                        <button
                          onClick={() => updateQuantity(item?.id, (item?.quantity || 1) + 1)}
                          className="p-1 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item?.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Persistent Fixed Footer: Modifiers, Totals & Fast Checkout Button */}
        <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
          {/* Global Modifiers & Calculations: (Subtotal + Order Tax %) - Discount + Shipment */}
          <div className="space-y-1.5 text-xs">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>{t?.subtotal || 'Subtotal'}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(subtotal)}</span>
            </div>

            {/* Global Order Tax (%) */}
            <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-indigo-500" /> Order Tax (%):
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={orderTax}
                  onChange={handleTaxChange}
                  className="w-14 text-right px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300 min-w-14 text-right font-mono">
                  +{formatCurrency(taxAmount)}
                </span>
              </div>
            </div>

            {/* Global Flat Discount (Rs.) */}
            <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-rose-500" /> Discount (Rs.):
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={globalDiscount}
                  onChange={handleDiscountChange}
                  className="w-14 text-right px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
                <span className="font-semibold text-rose-500 min-w-14 text-right font-mono">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            </div>

            {/* Global Flat Shipment Cost (Rs.) */}
            <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-amber-500" /> Shipment (Rs.):
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={shipmentCost}
                  onChange={handleShipmentChange}
                  className="w-14 text-right px-2 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 min-w-14 text-right font-mono">
                  +{formatCurrency(shippingAmount)}
                </span>
              </div>
            </div>

            {/* Final Grand Total Payable */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm font-black text-slate-900 dark:text-white">
              <span>{t?.grandTotal || 'Total Payable'}</span>
              <span className="text-lg text-indigo-600 dark:text-indigo-400 font-mono">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Fast Checkout Button */}
          <button
            disabled={safeCart.length === 0}
            onClick={() => setShowPaymentModal(true)}
            className={`w-full py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
              safeCart.length === 0
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30 active:scale-98 cursor-pointer'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{t?.checkout || 'Fast Checkout'}</span>
            <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">F9</span>
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <FastPaymentModal
          cartSummary={{
            subtotal,
            orderTax: parsedTax,
            taxAmount,
            globalDiscount: discountAmount,
            discountTotal: discountAmount,
            shipmentCost: shippingAmount,
            grandTotal,
            itemCount: totalItemCount
          }}
          orderAttributes={{
            customerName,
            orderDate,
            warehouseId: effectiveWarehouseId,
            orderState,
            paymentStatus,
            notes
          }}
          warehouses={warehouses}
          onClose={() => setShowPaymentModal(false)}
          onCompleteOrder={handleCompleteOrder}
        />
      )}

      {/* Completed Order Receipt Modal */}
      {completedOrder && (
        <ReceiptModal
          order={completedOrder}
          warehouses={warehouses}
          onClose={() => setCompletedOrder(null)}
        />
      )}
    </div>
  );
}
