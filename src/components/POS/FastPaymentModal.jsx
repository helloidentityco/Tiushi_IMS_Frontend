import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  User,
  Calendar,
  Warehouse,
  FileText,
  DollarSign,
  AlertCircle,
  Truck,
  Percent,
  Tag
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import confetti from 'canvas-confetti';

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

export default function FastPaymentModal({ 
  cartSummary, 
  orderAttributes = {},
  warehouses = [],
  onClose, 
  onCompleteOrder 
}) {
  const { formatCurrency, t } = useApp();

  // Order attributes
  const [customerName, setCustomerName] = useState(orderAttributes.customerName || '');
  const [orderDate, setOrderDate] = useState(orderAttributes.orderDate || new Date().toISOString().split('T')[0]);
  const [warehouseId, setWarehouseId] = useState(orderAttributes.warehouseId || 'wh-1');
  const [orderState, setOrderState] = useState(orderAttributes.orderState || 'Completed');
  const [paymentStatus, setPaymentStatus] = useState(orderAttributes.paymentStatus || 'Paid');
  const [notes, setNotes] = useState(orderAttributes.notes || '');

  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [authReference, setAuthReference] = useState('');
  const grandTotal = isNaN(Number(cartSummary?.grandTotal)) ? 0 : Math.max(0, Number(cartSummary.grandTotal));
  const subtotal = Number(cartSummary?.subtotal || 0);
  const orderTax = Number(cartSummary?.orderTax || 0);
  const taxAmount = Number(cartSummary?.taxAmount || 0);
  const globalDiscount = Number(cartSummary?.globalDiscount || 0);
  const shipmentCost = Number(cartSummary?.shipmentCost || 0);

  const [tenderedAmount, setTenderedAmount] = useState(() => {
    if (orderAttributes?.paymentStatus === 'Unpaid') return 0;
    if (orderAttributes?.paymentStatus === 'Partial') return Math.round(grandTotal / 2);
    return grandTotal;
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync tendered amount when payment status changes
  const handlePaymentStatusChange = (newStatus) => {
    setPaymentStatus(newStatus);
    if (newStatus === 'Paid') {
      setTenderedAmount(grandTotal);
    } else if (newStatus === 'Unpaid') {
      setTenderedAmount(0);
    } else if (newStatus === 'Partial') {
      setTenderedAmount(prev => (Number(prev) > 0 && Number(prev) < grandTotal ? prev : Math.round(grandTotal / 2)));
    }
  };

  const safeTendered = isNaN(Number(tenderedAmount)) ? 0 : Math.max(0, Number(tenderedAmount));

  // Payment calculations
  let amountPaid = 0;
  let changeDue = 0;
  let dueAmount = 0;
  let isShortPaid = false;

  if (paymentStatus === 'Paid') {
    amountPaid = grandTotal;
    changeDue = paymentMethod === 'Cash' ? Math.max(0, safeTendered - grandTotal) : 0;
    dueAmount = 0;
    isShortPaid = paymentMethod === 'Cash' && safeTendered < grandTotal;
  } else if (paymentStatus === 'Partial') {
    amountPaid = Math.min(grandTotal, safeTendered);
    changeDue = 0;
    dueAmount = Math.max(0, grandTotal - amountPaid);
    isShortPaid = amountPaid <= 0;
  } else {
    // Unpaid
    amountPaid = 0;
    changeDue = 0;
    dueAmount = grandTotal;
    isShortPaid = false;
  }

  const handleSetExact = () => {
    setTenderedAmount(grandTotal);
  };

  const handleAddQuickCash = (amount) => {
    setTenderedAmount(prev => Number(prev || 0) + amount);
  };

  const handleSubmit = async () => {
    if (isShortPaid) return;

    if (paymentMethod === 'Credit Card' && paymentStatus !== 'Unpaid' && !authReference.trim()) {
      alert('Card Validation Error: Transaction / Auth Reference is mandatory for Card payments. Please enter the terminal authorization code.');
      return;
    }

    setIsProcessing(true);

    // Fire festive celebration if paid or partial
    if (paymentStatus !== 'Unpaid') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    }

    setTimeout(() => {
      onCompleteOrder({
        customerName: (customerName || '').trim() || 'Walk-in Customer',
        orderDate,
        warehouseId,
        orderState,
        paymentStatus,
        paymentMethod,
        amountPaid,
        changeDue,
        notes,
        ...(paymentMethod === 'Credit Card' && authReference.trim() ? { authReference: authReference.trim() } : {})
      });
      setIsProcessing(false);
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
              Finalize Order & Checkout
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review order parameters, modifiers, and select tender method.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Payable Summary Box */}
        <div className="my-4 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-indigo-600/20">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-200 block">
                Total Payable (Calculated)
              </span>
              <div className="text-2xl sm:text-3xl font-black mt-0.5">
                {formatCurrency(grandTotal)}
              </div>
            </div>
            <div className="text-right text-[11px] text-indigo-100 space-y-0.5 font-mono">
              <div>Subtotal: {formatCurrency(cartSummary.subtotal)}</div>
              {Number(cartSummary.orderTax || 0) > 0 && (
                <div>Tax ({cartSummary.orderTax}%): +{formatCurrency(cartSummary.taxAmount)}</div>
              )}
              {cartSummary.globalDiscount > 0 && (
                <div className="text-amber-200 font-bold">
                  Discount: -{formatCurrency(cartSummary.globalDiscount)}
                </div>
              )}
              {cartSummary.shipmentCost > 0 && (
                <div className="text-indigo-200">
                  Shipment: +{formatCurrency(cartSummary.shipmentCost)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order Attributes Review & Adjustment Strip */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Order Metadata</span>
            <span className="text-indigo-600 dark:text-indigo-400">Editable before finalize</span>
          </div>

          {/* Customer Name & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Customer Name
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Order Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Deposit & Order State */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Deposit / Warehouse
              </label>
              <div className="relative">
                <Warehouse className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full pl-8 pr-1.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                >
                  {(warehouses || []).map(wh => (
                    <option key={wh?.id || Math.random()} value={wh?.id || ''}>
                      {wh?.name || wh?.code || 'Warehouse'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
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

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => handlePaymentStatusChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                <option value="Paid">Paid</option>
                <option value="Partial">Partial</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Internal Order Notes
            </label>
            <textarea
              rows="1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dispatched via Express Courier, Gate 3..."
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'Cash', label: 'Cash', icon: Banknote },
              { id: 'Credit Card', label: 'Card / Chip', icon: CreditCard }
            ].map(method => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method.id);
                    if (method.id !== 'Cash' && paymentStatus === 'Paid') {
                      setTenderedAmount(grandTotal);
                    }
                  }}
                  className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{method.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tendered Amount / Auth Reference / Change Calculator */}
          {paymentStatus !== 'Unpaid' && (
            <div className="space-y-2.5 pt-1">
              {paymentMethod === 'Credit Card' ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Transaction / Auth Reference <span className="text-rose-500 font-bold">(required)</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={authReference}
                      onChange={(e) => setAuthReference(e.target.value)}
                      placeholder="e.g. AUTH-9821 or Terminal ID (required)"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Swipe or tap card on the physical card terminal, then confirm.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {paymentStatus === 'Partial' ? 'Deposit / Amount Paid Now' : 'Tendered Cash Amount'}
                    </label>
                    {paymentStatus === 'Paid' && (
                      <button
                        type="button"
                        onClick={handleSetExact}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Exact ({formatCurrency(grandTotal)})
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tenderedAmount}
                      onChange={(e) => setTenderedAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  {paymentMethod === 'Cash' && paymentStatus === 'Paid' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {QUICK_AMOUNTS.map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTenderedAmount(amt)}
                          className="text-xs font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Real-Time Balance Status */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                {paymentStatus === 'Paid' ? (
                  <>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {paymentMethod === 'Credit Card' ? 'Card Charge Total:' : 'Customer Change Due:'}
                    </span>
                    <span className={`text-sm font-black ${isShortPaid ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {paymentMethod === 'Credit Card' ? formatCurrency(grandTotal) : (isShortPaid ? `Short by ${formatCurrency(grandTotal - tenderedAmount)}` : formatCurrency(changeDue))}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Remaining Balance Due:
                    </span>
                    <span className="text-sm font-black text-amber-500 dark:text-amber-400">
                      {formatCurrency(dueAmount)}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Unpaid Notice */}
          {paymentStatus === 'Unpaid' && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
              <span>
                Order will be saved with <strong>Unpaid</strong> payment status. Total due of{' '}
                <strong>{formatCurrency(grandTotal)}</strong> will remain outstanding.
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-2xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isShortPaid || isProcessing}
            onClick={handleSubmit}
            className={`flex-2 py-2.5 px-6 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              isShortPaid
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-98'
            }`}
          >
            {isProcessing ? (
              <span>Finalizing Order...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Complete & Issue Receipt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
