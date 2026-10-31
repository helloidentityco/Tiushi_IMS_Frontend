import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Calendar, 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Download, 
  Paperclip, 
  Edit3, 
  X, 
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';
import ExpenseModal from './ExpenseModal';

export default function ExpenseManagement({ onOpenCreateModal }) {
  const { formatCurrency, logAudit } = useApp();

  const [expenses, setExpenses] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [warehouseFilter, setWarehouseFilter] = useState('All');

  // Modal states for Create/Edit, View Attachment, and Quick Pay
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [activePaymentModalExp, setActivePaymentModalExp] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState('Bank Transfer');
  const [paymentDateInput, setPaymentDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Fetch live expenses from backend
  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/expenses');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setExpenses(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch warehouses for filter and dropdown mapping
  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/warehouses');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setWarehouses(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchWarehouses();
  }, []);

  // ─── 1. Aggregated KPI Summary Cards calculated dynamically ─────────────────
  const kpiData = useMemo(() => {
    let totalExpenses = 0;
    let totalCount = 0;

    let pendingUnpaid = 0;
    let unpaidCount = 0;

    let partiallyPaidBalance = 0;
    let partialCount = 0;

    for (const exp of expenses) {
      const total = Number(exp.totalAmount || 0);
      const paid = Number(exp.amountPaid || 0);
      const remaining = Math.max(0, total - paid);
      const status = (exp.status || exp.paymentStatus || 'Pending').trim().toLowerCase();

      // Total Expenses: Sum of totalAmount for all recorded bills
      totalExpenses += total;
      totalCount++;

      // Pending Bills: Sum of remaining balance where status is 'Pending' or 'Unpaid'
      if (status === 'pending' || status === 'unpaid') {
        pendingUnpaid += remaining;
        unpaidCount++;
      }

      // Partially Paid Balance: Sum of remaining balance where status is 'Partially Paid'
      if (status === 'partially paid' || status === 'partial') {
        partiallyPaidBalance += remaining;
        partialCount++;
      }
    }

    return {
      totalExpenses,
      totalCount,
      pendingUnpaid,
      unpaidCount,
      partiallyPaidBalance,
      partialCount
    };
  }, [expenses]);

  // Distinct categories for filter
  const categories = Array.from(new Set(expenses.map(e => e.category).filter(Boolean)));

  // Filtered expenses list
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = 
      (exp.billerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.referenceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusNormalized = (exp.status || exp.paymentStatus || 'Pending').trim().toLowerCase();
    const isPaid = statusNormalized === 'fully paid' || statusNormalized === 'paid';
    const isPartial = statusNormalized === 'partially paid' || statusNormalized === 'partial';
    const isPending = !isPaid && !isPartial;

    let matchesStatus = true;
    if (statusFilter === 'Pending') matchesStatus = isPending;
    else if (statusFilter === 'Partially Paid') matchesStatus = isPartial;
    else if (statusFilter === 'Paid') matchesStatus = isPaid;

    const matchesCategory = categoryFilter === 'All' || exp.category === categoryFilter;
    const matchesWarehouse = warehouseFilter === 'All' || exp.warehouseId === warehouseFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesWarehouse;
  });

  // Current month name for human-readable card subtitle
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // ─── Quick Pay / Edit Handler ───────────────────────────────────────────────
  const handleOpenPayModal = (exp) => {
    const total = Number(exp.totalAmount || 0);
    const paid = Number(exp.amountPaid || 0);
    const remaining = Math.max(0, total - paid);
    setActivePaymentModalExp(exp);
    setPaymentAmountInput(remaining > 0 ? remaining.toString() : '0');
    setPaymentMethodInput(exp.paymentMethod || 'Bank Transfer');
    setPaymentDateInput(new Date().toISOString().split('T')[0]);
  };

  const handleCommitPayment = async (e) => {
    e.preventDefault();
    if (!activePaymentModalExp) return;

    const payAmount = Number(paymentAmountInput);
    if (isNaN(payAmount) || payAmount <= 0) {
      alert('Please enter a valid payment amount greater than zero.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const exp = activePaymentModalExp;
      const res = await api.patch(`/expenses/${exp.id}/pay`, {
        paymentAmount: payAmount,
      });

      if (res.data?.success) {
        if (logAudit) {
          await logAudit(
            'Expense Payment Recorded',
            'Operating Bills & Expenses',
            `Disbursed ${formatCurrency(payAmount)} for ${exp.category} bill (${exp.referenceNumber}) to ${exp.billerName}.`
          );
        }

        setActivePaymentModalExp(null);
        await fetchExpenses();
      }
    } catch (err) {
      console.error('Failed to record payment:', err);
      alert(err.response?.data?.message || 'Failed to save payment record.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ─── View Attachment Handler ────────────────────────────────────────────────
  const handleViewAttachment = (exp) => {
    if (!exp.receiptAttachment) {
      alert('No receipt document is attached to this bill.');
      return;
    }

    if (typeof exp.receiptAttachment === 'string') {
      // Base64 data URL or external URL
      if (exp.receiptAttachment.startsWith('data:') || exp.receiptAttachment.startsWith('http')) {
        setPreviewAttachment({
          biller: exp.billerName,
          ref: exp.referenceNumber,
          url: exp.receiptAttachment,
          isImage: exp.receiptAttachment.startsWith('data:image') || /\.(png|jpe?g|webp|gif)/i.test(exp.receiptAttachment)
        });
      } else {
        alert('Attachment format is not a previewable data URL.');
      }
    } else if (exp.receiptAttachment instanceof Blob) {
      const url = URL.createObjectURL(exp.receiptAttachment);
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Top Actions ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <span>Bills & Expenses</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {expenses.length} Records
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and settle facility overhead, utilities, rent, and operational liabilities separate from inventory procurement.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setEditingExpense(null);
              setShowExpenseModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Expense</span>
          </button>
        </div>
      </div>

      {/* ─── 1. KPI Summary Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Total Expenses */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-all hover:border-indigo-400/50 dark:hover:border-indigo-500/50 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-indigo-500/10"></div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Total Expenses
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                All Operating Liabilities
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(kpiData.totalExpenses)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                {kpiData.totalCount} {kpiData.totalCount === 1 ? 'Bill Recorded' : 'Bills Recorded'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Total bills
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Bills */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-all hover:border-rose-400/50 dark:hover:border-rose-500/50 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-rose-500/10"></div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Pending Bills
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                Outstanding Balance of Pending Bills
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-xs">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              {formatCurrency(kpiData.pendingUnpaid)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                {kpiData.unpaidCount} {kpiData.unpaidCount === 1 ? 'Pending Bill' : 'Pending Bills'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Status Pending
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Partially Paid Balance */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-all hover:border-amber-400/50 dark:hover:border-amber-500/50 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-amber-500/10"></div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Partially Paid Balance
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                Remaining Balance on Partial Bills
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5">
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {formatCurrency(kpiData.partiallyPaidBalance)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {kpiData.partialCount} {kpiData.partialCount === 1 ? 'Partial Bill' : 'Partial Bills'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Status Partially Paid
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── Search & Filters Bar ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search biller, reference #, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Warehouse Filter */}
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="All">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── 2. Expenses Data Table ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4">Biller Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Reference #</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Remaining Balance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No Operating Expenses Found</p>
                    <p className="text-xs text-slate-400 mt-1">Click "+ Record Expense" above to add your first bill.</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => {
                  const wh = exp.warehouse || warehouses.find(w => w.id === exp.warehouseId);
                  const remaining = Math.max(0, Number(exp.totalAmount || 0) - Number(exp.amountPaid || 0));
                  
                  const statusNormalized = (exp.status || exp.paymentStatus || 'Pending').trim().toLowerCase();
                  const isPaid = statusNormalized === 'fully paid' || statusNormalized === 'paid';
                  const isPartial = statusNormalized === 'partially paid' || statusNormalized === 'partial';
                  const isPending = !isPaid && !isPartial;

                  const hasAttachment = Boolean(exp.receiptAttachment);

                  return (
                    <tr key={exp.id || exp.expenseId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Warehouse */}
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{wh?.name || 'All Facilities'}</span>
                        </div>
                      </td>

                      {/* 2. Biller Name */}
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {exp.billerName}
                      </td>

                      {/* 3. Category */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                          {exp.category}
                        </span>
                      </td>

                      {/* 4. Reference # */}
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {exp.referenceNumber || exp.expenseId}
                      </td>

                      {/* 5. Due Date */}
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {exp.dueDate || exp.issueDate || '—'}
                      </td>

                      {/* 6. Total Amount */}
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {formatCurrency(exp.totalAmount)}
                      </td>

                      {/* 7. Remaining Balance */}
                      <td className="py-3 px-4 font-black">
                        <span className={remaining > 0 ? (isPartial ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400') : 'text-slate-400'}>
                          {formatCurrency(remaining)}
                        </span>
                      </td>

                      {/* 8. Status */}
                      <td className="py-3 px-4">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Paid
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Partially Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            Pending
                          </span>
                        )}
                      </td>

                      {/* 9. Actions (Edit, Pay, View Attachment) */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit Bill Details Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(exp);
                              setShowExpenseModal(true);
                            }}
                            title="Edit Expense Record"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Settle / Pay Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(exp)}
                            title="Quick Record Payment"
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>

                          {/* View Attachment Button */}
                          <button
                            type="button"
                            onClick={() => handleViewAttachment(exp)}
                            disabled={!hasAttachment}
                            title={hasAttachment ? 'View Attached Receipt Document' : 'No Receipt Attached'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              hasAttachment
                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer'
                                : 'bg-slate-50 dark:bg-slate-800/20 text-slate-300 dark:text-slate-600 border-transparent cursor-not-allowed opacity-40'
                            }`}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
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

      {/* ─── Modal: Quick Pay / Settle Expense ────────────────────────────────── */}
      {activePaymentModalExp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-500" />
                  <span>Settle Bill / Record Payment</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activePaymentModalExp.billerName} • {activePaymentModalExp.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePaymentModalExp(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCommitPayment} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Bill</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(activePaymentModalExp.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Already Paid</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(activePaymentModalExp.amountPaid || 0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Remaining</span>
                  <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                    {formatCurrency(activePaymentModalExp.remainingBalance !== undefined ? activePaymentModalExp.remainingBalance : (activePaymentModalExp.totalAmount - (activePaymentModalExp.amountPaid || 0)))}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Payment Amount to Disburse (Rs.) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethodInput}
                    onChange={(e) => setPaymentMethodInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Direct Debit">Direct Debit</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Check">Check</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Disbursement Date
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDateInput}
                    onChange={(e) => setPaymentDateInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentModalExp(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingPayment ? 'Saving...' : 'Commit Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Receipt Attachment Preview ───────────────────────────────── */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Attached Bill Document Preview
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {previewAttachment.biller} • Ref: {previewAttachment.ref}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 flex items-center justify-center min-h-[300px]">
              {previewAttachment.isImage ? (
                <img
                  src={previewAttachment.url}
                  alt="Receipt Document"
                  className="max-h-[60vh] max-w-full object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={previewAttachment.url}
                  title="PDF Document"
                  className="w-full h-[60vh] rounded-lg"
                />
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end mt-4">
              <a
                href={previewAttachment.url}
                download={`Receipt-${previewAttachment.ref}.pdf`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Attachment</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Create / Edit Expense Bill ─────────────────────────────── */}
      {showExpenseModal && (
        <ExpenseModal
          expense={editingExpense}
          warehouses={warehouses}
          onClose={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
          }}
          onSaved={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
            fetchExpenses();
          }}
        />
      )}

    </div>
  );
}
