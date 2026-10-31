import React, { useRef } from 'react';
import { Printer, X, CheckSquare, PackageCheck, Building2, Calendar, User, Hash, MapPin } from 'lucide-react';

export default function PackingSlipModal({ order, warehouses = [], products = [], onClose }) {
  const slipRef = useRef(null);

  if (!order) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const orderNumber = order.orderNumber || order.id || 'SO-2026-XXXX';
  const customerName = order.customerName || 'Walk-in Customer';
  const orderDate = order.orderDate || (order.date ? new Date(order.date).toLocaleDateString() : new Date().toLocaleDateString());
  const fulfillmentStatus = order.fulfillmentStatus || 'Pending Pick';

  const warehouseObj = warehouses.find(w => w.id === order.warehouseId);
  const warehouseName = warehouseObj?.name || 'Central Distribution Hub';
  const warehouseAddress = warehouseObj?.address || '100 Logistics Blvd, North Industrial Port';

  const items = Array.isArray(order.items) ? order.items : [];
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      {/* Print-specific style tag to ensure high-contrast clean printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #packing-slip-printable, #packing-slip-printable * {
            visibility: visible;
          }
          #packing-slip-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
        
        {/* Modal Controls Header (Hidden on print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 no-print mb-6">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Warehouse Packing Slip Preview
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>Print Packing Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Packing Slip Area */}
        <div
          id="packing-slip-printable"
          ref={slipRef}
          className="bg-white text-slate-900 p-6 rounded-2xl border border-slate-200 shadow-xs text-xs font-sans"
        >
          {/* Slip Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">
                Warehouse Fulfillment & Dispatch
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                PACKING SLIP
              </h1>
              <p className="text-[11px] text-slate-500 mt-1">
                Fulfillment Facility: <strong>{warehouseName}</strong>
              </p>
              <p className="text-[10px] text-slate-400">
                {warehouseAddress}
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block bg-slate-100 border border-slate-300 rounded-lg px-3 py-1 text-right">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Order Reference</span>
                <span className="font-mono text-sm font-black text-slate-900">{orderNumber}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Date: <strong>{orderDate}</strong>
              </div>
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  fulfillmentStatus === 'Dispatched'
                    ? 'bg-emerald-100 text-emerald-800'
                    : fulfillmentStatus === 'Packed'
                    ? 'bg-purple-100 text-purple-800'
                    : fulfillmentStatus === 'Picked'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  Status: {fulfillmentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Shipping Information */}
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Recipient / Customer
              </span>
              <div className="font-bold text-slate-900 text-sm">
                {customerName}
              </div>
              <div className="text-[11px] text-slate-600">
                Verified Recipient for Commercial Dispatch
              </div>
            </div>

            <div className="space-y-1 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Dispatch Summary
              </span>
              <div className="text-slate-800 font-medium">
                Total Line Items: <strong>{items.length}</strong>
              </div>
              <div className="text-slate-800 font-medium">
                Total Packed Quantity: <strong>{totalUnits} Units</strong>
              </div>
            </div>
          </div>

          {/* Checklist Table */}
          <div className="py-4">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2 flex items-center justify-between">
              <span>Itemized Packed Goods Checklist</span>
              <span className="text-[10px] font-normal text-slate-500">Tick boxes upon carton verification</span>
            </div>

            <table className="w-full text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3 w-10 text-center">Check</th>
                  <th className="py-2.5 px-3">Product Description & SKU</th>
                  <th className="py-2.5 px-3">Bin Coordinates</th>
                  <th className="py-2.5 px-3 text-center w-24">Packed Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-slate-400 italic">
                      No line items found for this order.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const prod = products.find(p => p.id === item.productId);
                    const binLoc = prod?.binLocation || 'Aisle A - Shelf 1';
                    const sku = item.sku || prod?.sku || 'SKU-N/A';

                    return (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="py-3 px-3 text-center align-middle">
                          <div className="w-4 h-4 rounded border-2 border-slate-400 mx-auto flex items-center justify-center">
                            {fulfillmentStatus === 'Packed' || fulfillmentStatus === 'Dispatched' ? (
                              <span className="text-[10px] font-bold text-emerald-700">✓</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.title || prod?.name || prod?.title || `Item #${index + 1}`}</div>
                          <div className="font-mono text-[10px] text-slate-500">SKU: {sku}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {binLoc}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900 font-mono text-sm">
                          {item.quantity} Units
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Verification Signatures */}
          <div className="mt-6 pt-5 border-t-2 border-slate-300 grid grid-cols-3 gap-4 text-[10px] text-slate-600">
            <div>
              <div className="font-bold text-slate-800">Packed By (Picker):</div>
              <div className="mt-6 border-b border-slate-400"></div>
              <div className="mt-1 text-slate-400">Signature / Staff ID</div>
            </div>
            <div>
              <div className="font-bold text-slate-800">QC Verified By:</div>
              <div className="mt-6 border-b border-slate-400"></div>
              <div className="mt-1 text-slate-400">Signature / Seal</div>
            </div>
            <div>
              <div className="font-bold text-slate-800">Carrier / Received By:</div>
              <div className="mt-6 border-b border-slate-400"></div>
              <div className="mt-1 text-slate-400">Signature & Date</div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-6 text-center text-[9px] text-slate-400 border-t border-slate-100 pt-3">
            Identity IMS • Official Commercial Warehouse Packing Slip & Manifest • Generated {new Date().toLocaleString()}
          </div>
        </div>

      </div>
    </div>
  );
}
