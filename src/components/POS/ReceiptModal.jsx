import React, { useRef } from 'react';
import { Printer, X, Store } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ReceiptModal({ order = {}, warehouses = [], onClose }) {
  const { formatCurrency } = useApp();
  const receiptRef = useRef(null);

  if (!order || Object.keys(order).length === 0) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Safe object destructuring with sensible defaults
  const {
    orderNumber = `INV-${Date.now().toString().slice(-6)}`,
    cashier = 'Terminal #01',
    customerName = 'Walk-in Customer',
    orderState = 'Completed',
    status,
    paymentStatus = 'Paid',
    paymentMethod = 'Cash',
    notes = '',
    authReference = '',
    warehouseId = '',
    orderDate,
    date,
    items,
    cart
  } = order || {};

  // Safe warehouse resolution
  const warehouseObj = (warehouses || []).find(w => w?.id === (warehouseId || order?.warehouseId));
  const warehouseName = warehouseObj?.name || 'Central Distribution Hub';

  // Safe numeric helper
  const safeNumber = (val, fallback = 0) => {
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  };

  // Defensive numeric parsing for all totals, modifiers, and payment fields
  const subtotal = safeNumber(order.subtotal);
  const taxPercent = safeNumber(
    order.orderTax !== undefined ? order.orderTax : (order.taxPercent !== undefined ? order.taxPercent : 0)
  );
  const taxAmount = safeNumber(order.taxAmount);
  const discountTotal = safeNumber(
    order.globalDiscount !== undefined ? order.globalDiscount : (order.discountTotal !== undefined ? order.discountTotal : 0)
  );
  const shipmentCost = safeNumber(order.shipmentCost);
  const grandTotal = safeNumber(order.grandTotal);
  const amountPaid = safeNumber(order.amountPaid !== undefined ? order.amountPaid : grandTotal);
  const changeDue = safeNumber(order.changeDue);
  const dueAmount = Math.max(0, grandTotal - amountPaid);

  // Safe date formatting
  const formattedDate = orderDate || (date ? new Date(date).toLocaleDateString() : new Date().toLocaleDateString());

  // Safe cart/items array fallback
  const lineItems = items || cart || [];

  // Safe currency display helper
  const formatMoney = (val) => {
    const num = safeNumber(val);
    if (typeof formatCurrency === 'function') {
      return formatCurrency(num);
    }
    return `$${num.toFixed(2)}`;
  };

  const effectiveOrderState = orderState || status || 'Completed';
  const effectivePaymentStatus = paymentStatus || 'Paid';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 no-print cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Action Buttons (Excluded from Print) */}
        <div className="flex items-center gap-2 mb-5 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold py-2.5 px-4 rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Thermal Printable Receipt Area */}
        <div 
          ref={receiptRef}
          className="print-area font-mono text-[11px] leading-tight text-black border border-dashed border-slate-300 p-4 rounded-lg bg-amber-50/20"
        >
          {/* Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
            <div className="flex justify-center items-center gap-1 font-bold text-sm tracking-wider">
              <Store className="w-4 h-4" />
              IDENTITY IMS
            </div>
            <div>{warehouseName}</div>
            <div>742 Broadway Ave, Retail District</div>
          </div>

          {/* Metadata */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span className="font-bold">{orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{cashier}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-bold">{customerName}</span>
            </div>
            <div className="flex justify-between">
              <span>Deposit:</span>
              <span>{warehouseName}</span>
            </div>
            <div className="flex justify-between">
              <span>Order State:</span>
              <span className="font-semibold uppercase">{effectiveOrderState}</span>
            </div>
          </div>

          {/* Line Items */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5">
            <div className="flex justify-between font-bold border-b border-slate-200 pb-1 text-[10px]">
              <span>ITEM</span>
              <span>QTY x PRICE</span>
              <span>TOTAL</span>
            </div>
            {(lineItems || []).map((item, i) => {
              const itemTitle = item?.title || item?.name || 'Item';
              const itemQty = safeNumber(item?.quantity || item?.qty, 1);
              const itemPrice = safeNumber(item?.unitPrice || item?.sellingPrice || item?.price, 0);
              const itemTotal = safeNumber(
                item?.total !== undefined ? item?.total : (itemQty * itemPrice)
              );
              const itemDiscount = safeNumber(item?.discount || item?.lineDiscount, 0);

              return (
                <div key={i} className="space-y-0.5">
                  <div className="font-semibold line-clamp-1">{itemTitle}</div>
                  <div className="flex justify-between text-slate-600">
                    <span>{itemQty} x {formatMoney(itemPrice)}</span>
                    <span>{formatMoney(itemTotal)}</span>
                  </div>
                  {itemDiscount > 0 && (
                    <div className="text-[10px] text-emerald-700">
                      Disc: -{formatMoney(itemDiscount)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calculation Breakdown: (Subtotal + Order Tax %) - Discount + Shipment */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {(taxPercent > 0 || taxAmount > 0) && (
              <div className="flex justify-between">
                <span>Order Tax ({safeNumber(taxPercent).toFixed(0)}%):</span>
                <span>+{formatMoney(taxAmount)}</span>
              </div>
            )}
            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount:</span>
                <span>-{formatMoney(discountTotal)}</span>
              </div>
            )}
            {shipmentCost > 0 && (
              <div className="flex justify-between">
                <span>Shipment:</span>
                <span>+{formatMoney(shipmentCost)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-300">
              <span>GRAND TOTAL:</span>
              <span>{formatMoney(grandTotal)}</span>
            </div>
          </div>

          {/* Payment Details */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Payment Type:</span>
              <span className="font-bold">{paymentMethod}</span>
            </div>
            {authReference && authReference.trim() !== '' && (
              <div className="flex justify-between text-slate-700">
                <span>Auth / Ref #:</span>
                <span className="font-mono font-bold">{authReference}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Amount Paid:</span>
              <span>{formatMoney(amountPaid)}</span>
            </div>
            {changeDue > 0 && (
              <div className="flex justify-between font-bold text-emerald-700">
                <span>Change Given:</span>
                <span>{formatMoney(changeDue)}</span>
              </div>
            )}
            {dueAmount > 0 && (
              <div className="flex justify-between font-bold text-amber-700">
                <span>Balance Due:</span>
                <span>{formatMoney(dueAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Payment Status:</span>
              <span className={`font-bold ${
                effectivePaymentStatus.toLowerCase() === 'paid'
                  ? 'text-emerald-700'
                  : effectivePaymentStatus.toLowerCase() === 'partial'
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}>
                {effectivePaymentStatus.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Notes if present */}
          {notes && notes.trim() !== '' && (
            <div className="py-2 border-b border-dashed border-slate-400 text-[10px] text-slate-600">
              <span className="font-bold text-slate-800">Note: </span>
              <span>{notes}</span>
            </div>
          )}

          {/* Barcode & Footer */}
          <div className="text-center pt-3 space-y-2">
            <div className="flex flex-col items-center justify-center">
              <div className="tracking-[4px] font-bold text-xs">
                *{orderNumber}*
              </div>
              <div className="w-48 h-7 bg-slate-800 flex items-center justify-center text-white text-[8px] tracking-widest mt-1">
                || | || |||| | | ||| || |||
              </div>
            </div>
            <div className="text-[9px] text-slate-500">
              Thank you for shopping with us!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
