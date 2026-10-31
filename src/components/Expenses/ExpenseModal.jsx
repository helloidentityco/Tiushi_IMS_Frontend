import React, { useState, useEffect } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Building2, 
  Calendar, 
  DollarSign, 
  CreditCard, 
  CheckCircle2, 
  Receipt, 
  AlertCircle,
  Clock,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

export default function ExpenseModal({ 
  expense = null, 
  warehouses = [], 
  onClose, 
  onSaved 
}) {
  const { activeWarehouseId, formatCurrency, logAudit } = useApp();
  const isEdit = Boolean(expense);

  // ─── 1. Form Layout & Header Fields ─────────────────────────────────────────
  const [warehouseId, setWarehouseId] = useState(
    expense?.warehouseId || activeWarehouseId || warehouses[0]?.id || ''
  );

  useEffect(() => {
    if (warehouses && warehouses.length > 0) {
      if (!warehouseId || !warehouses.some(w => w.id === warehouseId)) {
        setWarehouseId(warehouses[0].id);
      }
    }
  }, [warehouses, warehouseId]);
  
  const [category, setCategory] = useState(
    expense?.category || 'Electricity'
  );

  const [billerName, setBillerName] = useState(
    expense?.billerName || ''
  );

  const [referenceNumber, setReferenceNumber] = useState(
    expense?.referenceNumber || `BILL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );

  const [issueDate, setIssueDate] = useState(
    expense?.issueDate || new Date().toISOString().split('T')[0]
  );

  const [dueDate, setDueDate] = useState(() => {
    if (expense?.dueDate) return expense.dueDate;
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  const [notes, setNotes] = useState(expense?.notes || '');

  // ─── 2. Financials & Auto-Calculation ───────────────────────────────────────
  const [totalAmount, setTotalAmount] = useState(
    expense?.totalAmount !== undefined ? expense.totalAmount.toString() : ''
  );

  const [amountPaid, setAmountPaid] = useState(
    expense?.amountPaid !== undefined ? expense.amountPaid.toString() : '0'
  );

  const [paymentStatus, setPaymentStatus] = useState(
    expense?.paymentStatus || 'Unpaid'
  );

  const [paymentMethod, setPaymentMethod] = useState(
    expense?.paymentMethod || 'Bank Transfer'
  );

  const [paymentDate, setPaymentDate] = useState(
    expense?.paymentDate || new Date().toISOString().split('T')[0]
  );

  // Auto-calculated Remaining Balance
  const parsedTotal = Math.max(0, Number(totalAmount) || 0);
  const parsedPaid = Math.max(0, Number(amountPaid) || 0);
  const remainingBalance = Math.max(0, parsedTotal - parsedPaid);

  // Auto-set Payment Status based on parsed amounts whenever Total or Paid changes
  useEffect(() => {
    if (parsedPaid <= 0) {
      setPaymentStatus('Unpaid');
    } else if (parsedPaid < parsedTotal) {
      setPaymentStatus('Partially Paid');
    } else {
      setPaymentStatus('Fully Paid');
    }
  }, [parsedTotal, parsedPaid]);

  const isUnpaid = paymentStatus === 'Unpaid';

  // ─── 3. File Upload & Drag-and-Drop Zone ────────────────────────────────────
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentBlob, setAttachmentBlob] = useState(expense?.receiptAttachment || null);
  const [attachmentName, setAttachmentName] = useState(expense?.receiptAttachmentName || '');
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle file selection / drop
  const handleProcessFile = (file) => {
    if (!file) return;

    // Check size limit (15MB)
    if (file.size > 15 * 1024 * 1024) {
      alert('File size exceeds 15MB limit. Please upload a smaller receipt document.');
      return;
    }

    setAttachmentFile(file);
    setAttachmentName(file.name);

    // Save as Blob for Dexie storage
    const blob = new Blob([file], { type: file.type });
    setAttachmentBlob(blob);

    // If image or previewable, create temporary preview URL
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setAttachmentPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreviewUrl(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentBlob(null);
    setAttachmentName('');
    setAttachmentPreviewUrl(null);
  };

  // ─── Save / Submit Form ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!billerName.trim()) {
      alert('Please enter a Biller or Vendor Name.');
      return;
    }

    if (!referenceNumber.trim()) {
      alert('Please enter a Bill or Reference Number.');
      return;
    }

    if (parsedTotal <= 0) {
      alert('Please enter a valid Total Bill Amount greater than 0.');
      return;
    }

    if (!warehouseId) {
      alert('Please select a facility/warehouse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        warehouseId,
        category,
        billerName: billerName.trim(),
        referenceNumber: referenceNumber.trim(),
        dueDate,
        totalAmount: parsedTotal,
        amountPaid: parsedPaid,
        status: parsedPaid >= parsedTotal ? 'Paid' : (parsedPaid > 0 ? 'Partially Paid' : 'Pending'),
        notes: notes.trim() || null
      };

      const res = await api.post('/expenses', payload);

      if (logAudit) {
        await logAudit(
          'New Operating Bill Recorded',
          'Operating Bills & Expenses',
          `Recorded ${category} bill (${referenceNumber.trim()}) from ${billerName.trim()} for ${formatCurrency(parsedTotal)}. Status: ${payload.status}.`
        );
      }

      if (onSaved) onSaved(res.data?.data);
      onClose();
    } catch (err) {
      console.error('Failed to save expense record:', err);
      alert(err.response?.data?.message || 'Failed to save expense. Please verify all fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {isEdit ? 'Edit Operating Expense / Bill' : 'Record Operating Expense / Bill'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Log recurring overhead liabilities, utility invoices, and manage disbursements.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="expense-modal-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          
          {/* Section 1: Facility & Classification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Facility / Warehouse <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Expense Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              >
                <option value="Electricity">Electricity</option>
                <option value="Gas">Gas</option>
                <option value="Rent">Rent</option>
                <option value="Internet">Internet</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Water">Water</option>
                <option value="Salaries">Salaries</option>
                <option value="Waste & Sanitation">Waste & Sanitation</option>
                <option value="Insurance">Insurance</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Other Overhead">Other Overhead</option>
              </select>
            </div>
          </div>

          {/* Section 2: Vendor & Reference Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Biller / Vendor Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Pacific Metro Power or Landlord LLC"
                value={billerName}
                onChange={(e) => setBillerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Bill / Reference Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ELEC-9821 or INV-4401"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Section 3: Billing Timeline Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Issue Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">
                Payment Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Section 4: Financials & Auto-Calculation Panel */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
              Financial Breakdown & Auto-Calculated Balances
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Bill Amount */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Total Bill Amount (Rs.) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Amount Paid */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Amount Paid (Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Auto-Calculated Read-only Remaining Balance */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                  <span>Remaining Balance</span>
                  <span className="text-[10px] text-slate-500 font-normal flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Auto
                  </span>
                </label>
                <div className={`w-full px-3 py-2 bg-slate-900/90 border rounded-xl font-mono font-black text-sm flex items-center justify-between ${
                  remainingBalance > 0 ? 'border-rose-500/50 text-rose-400' : 'border-emerald-500/50 text-emerald-400'
                }`}>
                  <span>{formatCurrency(remainingBalance)}</span>
                  <span className="text-[10px] uppercase font-sans font-bold">
                    {remainingBalance > 0 ? 'Due' : 'Settled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Lifecycle Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60">
              {/* Payment Status Dropdown (auto-set based on amount paid) */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                    paymentStatus === 'Fully Paid'
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                      : paymentStatus === 'Partially Paid'
                      ? 'bg-amber-950/60 border-amber-700 text-amber-400'
                      : 'bg-rose-950/60 border-rose-700 text-rose-400'
                  }`}
                >
                  <option value="Unpaid" className="bg-slate-900 text-white">Unpaid</option>
                  <option value="Partially Paid" className="bg-slate-900 text-white">Partially Paid</option>
                  <option value="Fully Paid" className="bg-slate-900 text-white">Fully Paid</option>
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Payment Method
                </label>
                <select
                  disabled={isUnpaid}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Direct Debit">Direct Debit</option>
                </select>
              </div>

              {/* Payment Date (disabled if Unpaid) */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                  <span>Payment Date</span>
                  {isUnpaid && <span className="text-[10px] text-slate-500 italic">Disabled if Unpaid</span>}
                </label>
                <input
                  type="date"
                  disabled={isUnpaid}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Drag-and-Drop Receipt Attachment Zone */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-300 block">
              Attach Receipt Document / Utility Bill (PDF or Image)
            </label>

            {attachmentBlob || attachmentName ? (
              <div className="p-3 rounded-2xl bg-slate-800 border border-indigo-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    {attachmentPreviewUrl ? (
                      <img src={attachmentPreviewUrl} alt="Receipt" className="w-8 h-8 object-cover rounded-lg" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-white block truncate text-xs">
                      {attachmentName || 'Attached-Receipt-Document'}
                    </span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Ready to save as IndexedDB Blob
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Remove Attached File"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/40 text-slate-400'
                }`}
                onClick={() => document.getElementById('expense-receipt-upload')?.click()}
              >
                <input
                  id="expense-receipt-upload"
                  type="file"
                  accept=".pdf, image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessFile(e.target.files[0]);
                    }
                  }}
                />
                <UploadCloud className="w-8 h-8 mx-auto text-indigo-400 mb-2 opacity-80" />
                <div className="text-xs font-semibold text-slate-200">
                  Drag and drop invoice receipt PDF or photo, or <span className="text-indigo-400 underline">browse files</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Supports PDF, PNG, JPG, WebP up to 15MB • Stored locally in IndexedDB Blob
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Additional Notes */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Operational Notes & Details (Optional)
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Account number, meter reading period, tax deduction notes..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
            />
          </div>

        </form>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            form="expense-modal-form"
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving Expense...' : isEdit ? 'Update Expense Bill' : 'Record Operating Expense'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
