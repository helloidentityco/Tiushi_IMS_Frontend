import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Truck, 
  Plus, 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  CheckCheck, 
  Send, 
  Building2, 
  Mail, 
  Phone,
  Eye,
  Download,
  Paperclip,
  Search,
  Filter,
  X,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Receipt,
  Printer,
  CreditCard,
  RotateCcw,
  PackageX,
  FileX
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';
import InvoicePOModal from './InvoicePOModal';

const formatDate = (dateVal) => {
  if (!dateVal) return '-';
  try {
    const str = String(dateVal).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return str.split('T')[0] || '-';
  } catch {
    return '-';
  }
};

export default function SupplierManagement() {
  const { t, formatCurrency, logAudit, activeCurrency } = useApp();

  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [resourcesList, setResourcesList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [debitNotesData, setDebitNotesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Suppliers from Backend API
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await api.get('/suppliers');
      const list = res.data?.data || [];
      const normalized = list.map(s => ({
        ...s,
        company: s.name,
        name: s.name,
        contactPerson: s.contact || s.name,
        phone: s.phone || s.contact || '',
        payableAmount: Number(s.payableAmount !== undefined ? s.payableAmount : (s.metrics?.payableAmount ?? s.payableBalance ?? 0)),
        payableBalance: Number(s.payableAmount !== undefined ? s.payableAmount : (s.metrics?.payableAmount ?? s.payableBalance ?? 0)),
        poCount: s.poCount !== undefined ? s.poCount : (s.purchaseOrders?.length || 0)
      }));
      setSuppliers(normalized);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  }, []);

  // Fetch Purchase Orders from Backend API
  const fetchPOs = useCallback(async () => {
    try {
      const res = await api.get('/purchase-orders');
      const orders = res.data?.data || [];
      const normalized = orders.map(po => ({
        ...po,
        items: (po.items || []).map(it => ({
          ...it,
          productId: it.productId || it.resourceId,
          resourceId: it.resourceId || null,
          title: it.resource?.name || it.product?.name || it.title || 'Resource Material',
          quantity: Number(it.orderedQty !== undefined ? it.orderedQty : (it.quantity || 1)),
          unitCost: Number(it.unitPrice !== undefined ? it.unitPrice : (it.unitCost || 0)),
          totalCost: Number(it.lineTotal !== undefined ? it.lineTotal : (Number(it.orderedQty || 1) * Number(it.unitPrice || 0)))
        }))
      }));
      setPurchaseOrders(normalized);
    } catch (err) {
      console.error('Failed to fetch purchase orders:', err);
    }
  }, []);

  // Fetch Products from Backend API
  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/products');
      setProductsList(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  }, []);

  // Fetch Resources from Backend API
  const fetchResources = useCallback(async () => {
    try {
      const res = await api.get('/resources');
      const list = res.data?.data || [];
      const normalized = list.map(r => ({
        ...r,
        id: r.id,
        productId: r.id,
        sku: r.code || r.sku,
        name: r.name,
        title: r.name,
        category: r.category || 'Raw Materials',
        itemType: 'resource',
        costPrice: Number(r.costPrice || 0)
      }));
      setResourcesList(normalized);
    } catch (err) {
      console.error('Failed to fetch resources:', err);
    }
  }, []);

  // Fetch Warehouses from Backend API
  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await api.get('/warehouses');
      setWarehouses(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
    }
  }, []);

  // Fetch Debit Notes from Backend API
  const fetchDebitNotes = useCallback(async () => {
    try {
      const res = await api.get('/debit-notes');
      setDebitNotesData(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch debit notes:', err);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchSuppliers(),
        fetchPOs(),
        fetchProducts(),
        fetchResources(),
        fetchWarehouses(),
        fetchDebitNotes()
      ]);
      setIsLoading(false);
    };
    loadAll();
  }, [fetchSuppliers, fetchPOs, fetchProducts, fetchResources, fetchWarehouses, fetchDebitNotes]);

  // Restrict procurement strictly to raw materials & resources (itemType === 'resource' or fallback)
  const resources = useMemo(() => {
    if (resourcesList.length > 0) return resourcesList;
    const filtered = productsList.filter(item => item.itemType === 'resource' || item.category === 'Raw Materials' || item.category === 'Supplies');
    return filtered.length > 0 ? filtered : productsList;
  }, [resourcesList, productsList]);

  // Dynamically aggregate Supplier PO KPIs via useMemo linked directly to purchaseOrders
  const poKPIs = useMemo(() => {
    let totalDue = 0;
    let totalCompleted = 0;
    let dueCount = 0;
    let completedCount = 0;

    for (const po of purchaseOrders) {
      const grandTotal = Number(po.grandTotal !== undefined ? po.grandTotal : (po.totalAmount || 0));
      const status = (po.status || '').trim().toLowerCase();
      const isCompletedOrPaid = status === 'completed' || status === 'paid';

      // 1. Due amount: sum of balanceDue across all POs
      // Fallback: If balanceDue is undefined/null, fall back to grandTotal if status is not Completed/Paid
      let due = 0;
      if (po.balanceDue !== undefined && po.balanceDue !== null && !isNaN(po.balanceDue)) {
        due = Math.max(0, Number(po.balanceDue));
      } else {
        due = isCompletedOrPaid ? 0 : grandTotal;
      }

      // 2. Completed/Paid amount: sum of amountPaid across all POs
      // Fallback: If amountPaid is undefined/null, fall back to grandTotal if status is strictly Completed or Paid
      let paid = 0;
      if (po.amountPaid !== undefined && po.amountPaid !== null && !isNaN(po.amountPaid)) {
        paid = Math.max(0, Number(po.amountPaid));
      } else {
        paid = isCompletedOrPaid ? grandTotal : 0;
      }

      totalDue += due;
      totalCompleted += paid;

      // 3. Badges:
      // Pending Invoices count: any PO where balanceDue > 0
      // Settled Invoices count: any PO where balanceDue === 0 or status is Completed
      if (due > 0) {
        dueCount++;
      }
      if (due === 0 || isCompletedOrPaid) {
        completedCount++;
      }
    }

    return { totalDue, totalCompleted, dueCount, completedCount };
  }, [purchaseOrders]);

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'suppliers' | 'debit-notes'
  const [showPOModal, setShowPOModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [payingPO, setPayingPO] = useState(null);
  const [receiptPO, setReceiptPO] = useState(null);
  const [selectedDebitNote, setSelectedDebitNote] = useState(null);
  const [debitNoteSearch, setDebitNoteSearch] = useState('');

  // Aggregate all Supplier Debit Notes across backend API debit notes and purchaseOrders
  const debitNotesList = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    // 1. Process Debit Notes fetched directly from backend /api/debit-notes
    for (const dn of debitNotesData) {
      if (seenIds.has(dn.id)) continue;
      seenIds.add(dn.id);

      const dnNum = dn.notes?.match(/DN-\d+/)?.[0] || `DN-${(dn.purchaseOrder?.poNumber || dn.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
      const delivNote = dn.notes?.match(/Delivery Note:\s*([^.]+)/)?.[1]?.trim() || '';

      const rawItems = Array.isArray(dn.items) ? dn.items : (Array.isArray(dn.debit_note_items) ? dn.debit_note_items : []);
      const mappedItems = rawItems.map((it, idx) => {
        const prod = it.product || it.resource || productsList.find(p => p.id === it.productId) || resourcesList.find(r => r.id === (it.resourceId || it.productId));
        const qty = Number(it.quantity !== undefined ? it.quantity : (it.rejectedQty || 1));
        const cost = Number(it.unitCost !== undefined ? it.unitCost : (it.unitPrice || 0));
        return {
          id: it.id || `dni-${dn.id}-${idx}`,
          productId: it.productId,
          resourceId: it.resourceId,
          productName: prod?.name || prod?.title || it.productName || it.title || 'Rejected Material',
          sku: prod?.sku || prod?.code || it.sku || 'SKU-N/A',
          quantity: qty,
          rejectedQty: qty,
          unitCost: cost,
          unitPrice: cost,
          totalCost: qty * cost
        };
      });

      // Fallback: If no items in debit_note_items, parse from notes if available
      if (mappedItems.length === 0 && dn.notes) {
        const match = dn.notes.match(/(\d+)\s*units rejected(?::\s*([^.]+))?/i);
        if (match) {
          const qty = Number(match[1]);
          const amt = Number(dn.totalAmount || 0);
          mappedItems.push({
            id: `legacy-${dn.id}`,
            productName: match[2]?.trim() || 'Defective Inward Units',
            sku: 'DEFECT-RET',
            quantity: qty,
            rejectedQty: qty,
            unitCost: qty > 0 ? amt / qty : amt,
            unitPrice: qty > 0 ? amt / qty : amt,
            totalCost: amt
          });
        }
      }

      list.push({
        id: dn.id,
        debitNoteNumber: dnNum,
        poId: dn.poId,
        poNumber: dn.purchaseOrder?.poNumber || 'N/A',
        invoiceNumber: dn.purchaseOrder?.invoiceNumber || '',
        supplierId: dn.supplierId,
        warehouseId: dn.warehouseId,
        supplierName: dn.supplier?.name || 'Supplier',
        warehouseName: dn.warehouse?.name || 'Warehouse Depot',
        grnId: null,
        grnNumber: dn.notes?.match(/GRN[-_0-9]+/)?.[0] || 'GRN-INWARD',
        deliveryNote: delivNote,
        amount: Number(dn.totalAmount || 0),
        date: dn.createdAt ? dn.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
        status: dn.refundStatus === 'Refunded' ? 'Refunded' : 'Active',
        refundStatus: dn.refundStatus || 'Deducted',
        refundedAt: dn.refundStatus === 'Refunded' ? dn.updatedAt : null,
        items: mappedItems,
        notes: dn.notes || 'Inward Quality Inspection Rejection'
      });
    }

    // 2. Extract from purchaseOrders.debitNotes if any
    for (const po of purchaseOrders) {
      if (Array.isArray(po.debitNotes) && po.debitNotes.length > 0) {
        for (const dn of po.debitNotes) {
          const dnId = dn.id || `dn-${po.id}-${dn.debitNoteNumber || ''}`;
          if (seenIds.has(dnId) || seenIds.has(dn.id)) continue;
          if (dn.id) seenIds.add(dn.id);
          seenIds.add(dnId);

          list.push({
            id: dn.id || dnId,
            debitNoteNumber: dn.debitNoteNumber || `DN-${po.poNumber}`,
            poId: po.id,
            poNumber: po.poNumber,
            invoiceNumber: po.invoiceNumber || '',
            supplierId: po.supplierId,
            warehouseId: po.warehouseId,
            supplierName: po.supplier?.name || 'Supplier',
            warehouseName: po.warehouse?.name || 'Warehouse Depot',
            grnId: dn.grnId || null,
            grnNumber: dn.grnNumber || 'N/A',
            deliveryNote: dn.deliveryNote || '',
            amount: Number(dn.totalAmount !== undefined ? dn.totalAmount : (dn.amount || 0)),
            date: dn.date || dn.createdAt || po.orderDate || po.date,
            status: dn.status || (po.status === 'Reversed' ? 'Reversed' : 'Active'),
            refundStatus: dn.refundStatus || 'Pending',
            refundedAt: dn.refundedAt || null,
            items: dn.items || [],
            notes: dn.notes || 'Inward Quality Inspection Rejection'
          });
        }
      }
    }

    // Sort descending by date
    return list.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [debitNotesData, purchaseOrders]);

  // Filtered Debit Notes
  const filteredDebitNotes = useMemo(() => {
    if (!debitNoteSearch.trim()) return debitNotesList;
    const q = debitNoteSearch.toLowerCase().trim();
    return debitNotesList.filter(dn => {
      const sup = suppliers.find(s => s.id === dn.supplierId);
      const supName = (sup?.name || '').toLowerCase();
      const supCompany = (sup?.company || '').toLowerCase();
      const dnNum = (dn.debitNoteNumber || '').toLowerCase();
      const poNum = (dn.poNumber || '').toLowerCase();
      const grnNum = (dn.grnNumber || '').toLowerCase();
      const delNote = (dn.deliveryNote || '').toLowerCase();

      return (
        supName.includes(q) ||
        supCompany.includes(q) ||
        dnNum.includes(q) ||
        poNum.includes(q) ||
        grnNum.includes(q) ||
        delNote.includes(q)
      );
    });
  }, [debitNotesList, debitNoteSearch, suppliers]);

  // Payment Modal Form State
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    paymentMethod: 'Bank Transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Smart Filter States for Purchase Orders
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Issued' | 'Completed/Paid' | 'Partial' | 'Overdue'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Overdue Logic: dueDate is strictly less than today's date AND status/paymentStatus is not "Completed" or "Paid"
  const isOrderOverdue = (po) => {
    const status = (po.status || '').trim().toLowerCase();
    const paymentStatus = (po.paymentStatus || '').trim().toLowerCase();
    const grandTotal = Number(po.grandTotal !== undefined ? po.grandTotal : (po.totalAmount || 0));
    const amountPaid = Number(po.amountPaid || 0);
    const balanceDue = Number(po.balanceDue !== undefined ? po.balanceDue : Math.max(0, grandTotal - amountPaid));

    const isCompletedOrPaid = 
      status === 'completed' || 
      status === 'paid' || 
      paymentStatus === 'completed' || 
      paymentStatus === 'paid' || 
      paymentStatus === 'fully paid' ||
      (balanceDue <= 0 && grandTotal > 0);

    if (isCompletedOrPaid) return false;

    const rawDueDate = po.dueDate || po.expectedDate;
    if (!rawDueDate) return false;

    const dueDateStr = rawDueDate.includes('T') ? rawDueDate.split('T')[0] : rawDueDate;
    const todayStr = new Date().toISOString().split('T')[0];

    return Boolean(dueDateStr && dueDateStr < todayStr);
  };

  // Dynamic Data Filtering Logic for Purchase Orders
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const sup = suppliers.find(s => s.id === po.supplierId);
      const supplierName = (sup?.name || '').toLowerCase();
      const supplierCompany = (sup?.company || '').toLowerCase();
      const poNum = (po.poNumber || '').toLowerCase();
      const invRef = (po.invoiceNumber || '').toLowerCase();

      // 1. Search Query: Supplier Name, PO Number, or Invoice Reference
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch = 
          supplierName.includes(q) ||
          supplierCompany.includes(q) ||
          poNum.includes(q) ||
          invRef.includes(q);

        if (!matchesSearch) return false;
      }

      // 2. Status Dropdown: All, Issued, Completed/Paid, Partial, Overdue
      if (statusFilter !== 'All') {
        const isOverdue = isOrderOverdue(po);
        const status = (po.status || '').trim().toLowerCase();
        const paymentStatus = (po.paymentStatus || '').trim().toLowerCase();
        const grandTotal = Number(po.grandTotal !== undefined ? po.grandTotal : (po.totalAmount || 0));
        const amountPaid = Number(po.amountPaid || 0);
        const balanceDue = Number(po.balanceDue !== undefined ? po.balanceDue : Math.max(0, grandTotal - amountPaid));

        const isCompletedOrPaid = 
          status === 'completed' || 
          status === 'paid' || 
          paymentStatus === 'completed' || 
          paymentStatus === 'paid' || 
          paymentStatus === 'fully paid' ||
          (balanceDue <= 0 && grandTotal > 0);

        const isPartial = 
          status === 'partial' || 
          status === 'partially paid' || 
          status === 'partially received' ||
          paymentStatus === 'partial' || 
          paymentStatus === 'partially paid' ||
          (amountPaid > 0 && balanceDue > 0);

        if (statusFilter === 'Issued') {
          if (status !== 'issued' || amountPaid > 0) return false;
        } else if (statusFilter === 'Overdue') {
          if (!isOverdue) return false;
        } else if (statusFilter === 'Completed/Paid') {
          if (!isCompletedOrPaid) return false;
        } else if (statusFilter === 'Partial') {
          if (!isPartial) return false;
        }
      }

      // 3. Date Range (based on orderDate or dueDate)
      const orderDateStr = (po.orderDate || po.date || '').split('T')[0];
      const dueDateStr = (po.dueDate || po.expectedDate || '').split('T')[0];

      if (startDate && endDate) {
        const orderInRange = orderDateStr && orderDateStr >= startDate && orderDateStr <= endDate;
        const dueInRange = dueDateStr && dueDateStr >= startDate && dueDateStr <= endDate;
        if (!orderInRange && !dueInRange) return false;
      } else if (startDate) {
        const orderAfterStart = orderDateStr && orderDateStr >= startDate;
        const dueAfterStart = dueDateStr && dueDateStr >= startDate;
        if (!orderAfterStart && !dueAfterStart) return false;
      } else if (endDate) {
        const orderBeforeEnd = orderDateStr && orderDateStr <= endDate;
        const dueBeforeEnd = dueDateStr && dueDateStr <= endDate;
        if (!orderBeforeEnd && !dueBeforeEnd) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;

      const dateA = a.orderDate || a.date ? new Date(a.orderDate || a.date).getTime() : 0;
      const dateB = b.orderDate || b.date ? new Date(b.orderDate || b.date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      if (timeA !== timeB) return timeB - timeA;

      const extractTimeFromId = (id) => {
        if (typeof id === 'string' && id.startsWith('po-')) {
          const val = Number(id.replace('po-', ''));
          if (!isNaN(val)) return val;
        }
        return 0;
      };
      const idNumA = extractTimeFromId(a.id);
      const idNumB = extractTimeFromId(b.id);
      if (idNumA !== idNumB) return idNumB - idNumA;

      return String(b.poNumber || b.id || '').localeCompare(String(a.poNumber || a.id || ''), undefined, { numeric: true });
    });
  }, [purchaseOrders, suppliers, searchQuery, statusFilter, startDate, endDate]);

  const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'All' || startDate || endDate);
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setStartDate('');
    setEndDate('');
  };

  // New Supplier Form
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    taxId: '',
    address: ''
  });

  // Handle Create Commercial Multi-Item PO & Invoice
  const handleCreateCommercialPO = async (poData) => {
    try {
      const grandTotal = Number(poData.grandTotal || 0);
      const itemsPayload = (poData.items || []).map(i => ({
        productId: i.productId || null,
        resourceId: i.resourceId || null,
        orderedQty: Math.max(1, Number(i.quantity || i.orderedQty || 1)),
        unitPrice: Math.max(0, Number(i.unitCost !== undefined ? i.unitCost : (i.unitPrice || 0)))
      }));

      const payload = {
        poNumber: poData.poNumber,
        supplierId: poData.supplierId,
        warehouseId: poData.warehouseId,
        orderDate: poData.orderDate || null,
        dueDate: poData.dueDate || null,
        invoicePdfUrl: poData.invoicePdfUrl || null,
        items: itemsPayload
      };

      const res = await api.post('/purchase-orders', payload);
      const created = res.data?.data;
      const sup = suppliers.find(s => s.id === poData.supplierId);

      await logAudit(
        'Commercial Invoice / PO Issued',
        'Purchasing & Procurement',
        `Issued PO ${created?.poNumber || poData.poNumber} (${poData.invoiceNumber || 'No Invoice #'}) to ${sup?.company || sup?.name || 'Supplier'} for ${formatCurrency(grandTotal)} with ${itemsPayload.length} line item(s).`
      );

      await fetchPOs();
      await fetchSuppliers();
      setShowPOModal(false);
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      alert(err.response?.data?.message || 'Failed to save purchase order.');
    }
  };

  // Handle Edit Commercial PO
  const handleEditCommercialPO = async (poData) => {
    try {
      if (!editingPO) return;
      // In a production relational backend, updating an issued PO updates local view
      setPurchaseOrders(prev => prev.map(p => p.id === editingPO.id ? { ...p, ...poData } : p));
      await logAudit(
        'Commercial Invoice / PO Updated',
        'Purchasing & Procurement',
        `Updated PO ${poData.poNumber} (${poData.invoiceNumber || 'No Invoice #'}), revised details.`
      );
      setEditingPO(null);
    } catch (err) {
      console.error('Failed to update purchase order:', err);
      alert('Failed to update purchase order.');
    }
  };

  // Handle Open Edit Modal
  const handleOpenEditModal = (po) => {
    setEditingPO(po);
  };

  // Handle Open Pay Modal
  const handleOpenPayModal = (po) => {
    const total = Number(po.grandTotal !== undefined ? po.grandTotal : (po.totalAmount || 0));
    const paid = Number(po.amountPaid || 0);
    const due = Number(po.balanceDue !== undefined ? po.balanceDue : Math.max(0, total - paid));
    setPayingPO(po);
    setPaymentFormData({
      amount: due > 0 ? due.toFixed(2) : '0.00',
      paymentMethod: 'Cash',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  // Handle Record Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payingPO) return;
    const payAmount = parseFloat(paymentFormData.amount);
    const currentDue = Number(payingPO.balanceDue !== undefined ? payingPO.balanceDue : 0);

    if (isNaN(payAmount) || payAmount <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    if (payAmount > currentDue + 0.01) {
      alert(`Payment amount cannot exceed the balance due of ${formatCurrency(currentDue)}.`);
      return;
    }

    try {
      await api.post(`/purchase-orders/${payingPO.id}/payment`, {
        amount: payAmount,
        note: paymentFormData.notes || `Settlement via ${paymentFormData.paymentMethod}`
      });

      await logAudit(
        'PO Payment Recorded',
        'Purchasing & Procurement',
        `Recorded ${paymentFormData.paymentMethod} payment of ${formatCurrency(payAmount)} for PO ${payingPO.poNumber}.`
      );

      await fetchPOs();
      await fetchSuppliers();
      setPayingPO(null);
    } catch (err) {
      console.error('Failed to record payment:', err);
      alert(err.response?.data?.message || 'Failed to record payment.');
    }
  };

  // Handle View Receipt
  const handleViewReceipt = (po) => {
    setReceiptPO(po);
  };

  // PDF Preview and Download Handlers
  const handleViewPDF = (po) => {
    if (po.invoicePdfUrl) {
      window.open(po.invoicePdfUrl, '_blank');
      return;
    }
    if (!po.pdfAttachment) {
      alert('No PDF invoice attached to this purchase order.');
      return;
    }
    const blob = po.pdfAttachment instanceof Blob ? po.pdfAttachment : new Blob([po.pdfAttachment], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleDownloadPDF = (po) => {
    if (po.invoicePdfUrl) {
      window.open(po.invoicePdfUrl, '_blank');
      return;
    }
    if (!po.pdfAttachment) {
      alert('No PDF invoice attached to this purchase order.');
      return;
    }
    const blob = po.pdfAttachment instanceof Blob ? po.pdfAttachment : new Blob([po.pdfAttachment], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = po.pdfAttachmentName || `${po.invoiceNumber || po.poNumber}-Invoice.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Handle Add Supplier
  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    try {
      const phoneVal = (supplierFormData.phone || supplierFormData.contact || '').trim() || undefined;
      const payload = {
        name: (supplierFormData.company || supplierFormData.name || '').trim(),
        email: supplierFormData.email ? supplierFormData.email.trim() : undefined,
        contact: phoneVal,
        phone: phoneVal,
        address: supplierFormData.address ? supplierFormData.address.trim() : undefined
      };
      await api.post('/suppliers', payload);
      await logAudit('Supplier Added', 'Suppliers', `Added supplier: ${payload.name}`);
      await fetchSuppliers();
      setShowSupplierModal(false);
      setSupplierFormData({
        company: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        taxId: '',
        paymentTerms: 'Net 30'
      });
    } catch (err) {
      console.error('Failed to add supplier:', err);
      alert(err.response?.data?.message || 'Failed to add supplier.');
    }
  };

  // Handle Mark Debit Note as Refunded / Settled
  const handleMarkAsRefunded = async (dn) => {
    if (!dn) return;

    const confirmed = window.confirm(
      "Confirm that you have received the refund amount from the supplier for this Debit Note?"
    );
    if (!confirmed) return;

    try {
      await api.patch(`/debit-notes/${dn.id}/mark-refunded`);

      if (selectedDebitNote && (selectedDebitNote.id === dn.id || selectedDebitNote.debitNoteNumber === dn.debitNoteNumber)) {
        setSelectedDebitNote(prev => prev ? ({ ...prev, refundStatus: 'Refunded', refundedAt: new Date().toISOString() }) : null);
      }

      if (typeof logAudit === 'function') {
        await logAudit(
          'Debit Note Refund Confirmed',
          'Suppliers & Purchasing',
          `Confirmed supplier refund receipt of ${formatCurrency(dn.amount || 0)} for Debit Note ${dn.debitNoteNumber} (PO ${dn.poNumber || ''}). Status changed to Refunded / Settled.`
        );
      }

      await fetchDebitNotes();
      await fetchPOs();
      await fetchSuppliers();
    } catch (err) {
      console.error('Failed to mark debit note as refunded:', err);
      alert(err.response?.data?.message || 'Failed to update debit note status: ' + (err.message || 'Error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t.purchases}</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {purchaseOrders.length} Orders
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Issue procurement orders, track supplier accounts payable, and automate stock arrival workflows.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowSupplierModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            <Building2 className="w-4 h-4 text-indigo-500" />
            Add Supplier
          </button>
          <button
            onClick={() => setShowPOModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Issue Purchase Order (PO)
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Purchase Orders</span>
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'suppliers'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Supplier Directory & Payables</span>
        </button>
        <button
          onClick={() => setActiveTab('debit-notes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'debit-notes'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Debit Notes & Returns</span>
          {debitNotesList.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'debit-notes' 
                ? 'bg-white/20 text-white' 
                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
            }`}>
              {debitNotesList.length}
            </span>
          )}
        </button>
      </div>

      {/* PO Orders List & KPIs */}
      {activeTab === 'orders' && (
        <div className="space-y-5">
          {/* Top Stylized KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Total Due Payments */}
            <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-all hover:border-amber-400/50 dark:hover:border-amber-500/50 group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-amber-500/10"></div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Total Due Payments
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                    Unpaid & Pending Commercial Invoices
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3.5">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {formatCurrency(poKPIs.totalDue)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    {poKPIs.dueCount} {poKPIs.dueCount === 1 ? 'Invoice Pending' : 'Invoices Pending'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Outstanding balance &gt; 0
                  </span>
                </div>
              </div>
            </div>

            {/* Total Completed Payments */}
            <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-all hover:border-emerald-400/50 dark:hover:border-emerald-500/50 group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none transition-all group-hover:bg-emerald-500/10"></div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Total Completed Payments
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                    Settled & Fulfilled Purchase Orders
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3.5">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {formatCurrency(poKPIs.totalCompleted)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {poKPIs.completedCount} {poKPIs.completedCount === 1 ? 'Invoice Settled' : 'Invoices Settled'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Zero balance or Completed
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Smart Filter Control Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              
              {/* 1. Search Input (Supplier Name, PO Number, or Invoice Reference) */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by Supplier Name, PO Number, or Invoice Reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs placeholder:text-slate-400 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 2. Status Dropdown (All, Issued, Completed/Paid, Partial, Overdue) */}
              <div className="w-full sm:w-48 shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-medium cursor-pointer transition-all"
                >
                  <option value="All">All Statuses</option>
                  <option value="Issued">Issued</option>
                  <option value="Completed/Paid">Completed / Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              {/* 3. Date Range (Start Date and End Date) */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <div className="relative flex-1 sm:w-36">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    title="Filter Start Date (Order or Due Date)"
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                  />
                </div>
                <span className="text-slate-400 text-xs font-bold">to</span>
                <div className="relative flex-1 sm:w-36">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    title="Filter End Date (Order or Due Date)"
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer border border-rose-500/20 whitespace-nowrap"
                >
                  Reset Filters
                </button>
              )}

            </div>
          </div>

          {/* Main PO Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-4">PO / Invoice #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4">Grand Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Invoice PDF</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredPurchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                        <div className="font-semibold text-slate-300">No purchase orders found matching your filters</div>
                        <p className="text-xs text-slate-500 mt-1">Try resetting the status, date range, or search keyword.</p>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer border border-slate-700"
                          >
                            Reset Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredPurchaseOrders.map(po => {
                      const sup = suppliers.find(s => s.id === po.supplierId);
                      const grandTotal = Number(po.grandTotal !== undefined ? po.grandTotal : (po.totalAmount || 0));
                      const amountPaid = Number(po.amountPaid || 0);
                      const balanceDue = Number(po.balanceDue !== undefined ? po.balanceDue : Math.max(0, grandTotal - amountPaid));
                      const orderDateFormatted = formatDate(po.orderDate || po.date || po.createdAt);
                      const dueDateFormatted = formatDate(po.dueDate || po.expectedDate);
                      const invoiceNum = po.invoiceNumber || po.poNumber;
                      const itemCount = Array.isArray(po.items) ? po.items.length : 1;
                      const isOverdue = isOrderOverdue(po);

                      const statusLower = (po.status || '').trim().toLowerCase();
                      const paymentStatusLower = (po.paymentStatus || '').trim().toLowerCase();
                      const isCompletedOrPaid = 
                        statusLower === 'completed' || 
                        statusLower === 'paid' || 
                        paymentStatusLower === 'completed' || 
                        paymentStatusLower === 'paid' || 
                        (balanceDue <= 0 && grandTotal > 0);

                      return (
                        <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            <div>{po.poNumber}</div>
                            {invoiceNum && invoiceNum !== po.poNumber && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                Ref: {invoiceNum}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {sup?.company || 'Supplier'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                            {orderDateFormatted}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <div className={isOverdue ? 'text-red-500 dark:text-red-400 font-bold flex items-center gap-1.5' : 'text-slate-600 dark:text-slate-300'}>
                              {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                              <span>{dueDateFormatted}</span>
                            </div>
                            {isOverdue && (
                              <span className="text-[10px] text-red-500 dark:text-red-400 font-semibold block mt-0.5">
                                Overdue
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                            {formatCurrency(grandTotal)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isCompletedOrPaid
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : isOverdue
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                : (amountPaid > 0 || po.status === 'Partial' || po.status === 'Partially Paid' || po.status === 'Partially Received')
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                            }`}>
                              {isCompletedOrPaid ? (
                                'Completed'
                              ) : isOverdue ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                  Overdue
                                </>
                              ) : (amountPaid > 0 && balanceDue > 0) ? (
                                'Partially Paid'
                              ) : (
                                po.status || 'Issued'
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {po.invoicePdfUrl ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <a
                                  href={po.invoicePdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-colors font-semibold text-[11px]"
                                  title="Download / Open Cloudinary PDF"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </a>
                              </div>
                            ) : po.pdfAttachment ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPDF(po)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors font-semibold text-[11px] cursor-pointer"
                                  title={`Download ${po.pdfAttachmentName || 'Invoice PDF'}`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isCompletedOrPaid ? (
                              <button
                                type="button"
                                onClick={() => handleViewReceipt(po)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                                title={`View Receipt for ${po.poNumber}`}
                              >
                                <Receipt className="w-3.5 h-3.5 shrink-0" />
                                <span>View Receipt</span>
                              </button>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayModal(po)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs hover:shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
                                  title={`Record payment for ${po.poNumber}`}
                                >
                                  <span>💳</span>
                                  <span>Pay</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(po)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs active:scale-95"
                                  title={`Edit order ${po.poNumber}`}
                                >
                                  <span>✏️</span>
                                  <span>Edit</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Directory Cards */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {suppliers.map(sup => (
            <div key={sup.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {sup.company || sup.name}
                </h3>
                {sup.name && sup.name !== sup.company && (
                  <p className="text-xs text-slate-400 mt-0.5">Contact: {sup.name}</p>
                )}

                <div className="my-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1">
                  <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">Accounts Payable:</div>
                  <div className="text-base font-black text-rose-600 dark:text-rose-400">
                    {formatCurrency(sup.payableAmount !== undefined ? sup.payableAmount : (sup.payableBalance || 0))}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-500">
                  {sup.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{sup.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{sup.phone || sup.contact || 'No phone recorded'}</span>
                  </div>
                  {sup.address && (
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
                      <span className="truncate">{sup.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>{sup.poCount || sup.purchaseOrders?.length || 0} Purchase Orders</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Debit Notes & Returns Tab */}
      {activeTab === 'debit-notes' && (
        <div className="space-y-5">
          {/* Top Stylized Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Total Deductions Card */}
            <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Total Debit Deductions
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                    Settled against Accounts Payable
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-xs">
                  <RotateCcw className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3.5">
                <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                  {formatCurrency(debitNotesList.reduce((sum, d) => d.status !== 'Reversed' ? sum + (Number(d.amount) || 0) : sum, 0))}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>Cumulative rejected deductions</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {debitNotesList.filter(d => d.refundStatus === 'Refunded' || d.refundStatus === 'Settled').length} Settled
                  </span>
                </div>
              </div>
            </div>

            {/* Total Debit Notes Count */}
            <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Issued Debit Notes
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                    Active Inspection Vouchers
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3.5">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {debitNotesList.filter(d => d.status !== 'Reversed').length}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {debitNotesList.filter(d => d.status === 'Reversed').length} reversed transactions
                </div>
              </div>
            </div>

            {/* Total Rejected Units */}
            <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Rejected Defective Units
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                    Physical Stock Returned
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
                  <PackageX className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3.5">
                <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                  {debitNotesList.reduce((sum, d) => sum + (d.items?.reduce((s, it) => s + (Number(it.rejectedQty || it.quantity) || 0), 0) || 0), 0)} Pcs
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Across all warehouse quality inspections
                </div>
              </div>
            </div>

          </div>

          {/* Search Bar & Table Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-500" />
                  <span>Supplier Debit Notes & Purchase Returns Register</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Financial deductions applied to supplier accounts for materials rejected during Goods Received Note (GRN) quality inspection.
                </p>
              </div>

              {/* Search Filter */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Debit Note #, PO, Supplier..."
                  value={debitNoteSearch}
                  onChange={(e) => setDebitNoteSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {debitNoteSearch && (
                  <button
                    type="button"
                    onClick={() => setDebitNoteSearch('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Debit Notes Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Debit Note #</th>
                    <th className="py-3 px-4">Original PO Reference</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">GRN & Challan Ref</th>
                    <th className="py-3 px-4 text-right">Rejected Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredDebitNotes.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-400">
                        <PackageX className="w-8 h-8 mx-auto mb-2 opacity-30 text-rose-400" />
                        <div className="font-semibold text-slate-300">No debit notes recorded yet</div>
                        <p className="text-xs text-slate-500 mt-1">
                          When inbound materials are marked as "Rejected" in the Warehouse Operations (GRN) module, debit notes are automatically created here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDebitNotes.map(dn => {
                      const sup = suppliers.find(s => s.id === dn.supplierId);
                      const isReversed = dn.status === 'Reversed';
                      const isRefunded = dn.refundStatus === 'Refunded' || dn.refundStatus === 'Settled';

                      return (
                        <tr 
                          key={dn.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            isReversed ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/40' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {dn.date}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                            <div>{dn.debitNoteNumber}</div>
                            {dn.items?.length > 0 && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                {dn.items.reduce((sum, it) => sum + (Number(it.rejectedQty) || 0), 0)} units rejected
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {dn.poNumber}
                            </div>
                            {dn.invoiceNumber && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Inv: {dn.invoiceNumber}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {sup?.company || 'Supplier'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {sup?.name}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            <div className="font-bold text-slate-700 dark:text-slate-300">
                              {dn.grnNumber || 'GRN-N/A'}
                            </div>
                            {dn.deliveryNote && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                Challan: {dn.deliveryNote}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            <span className={isReversed ? 'line-through text-slate-400' : ''}>
                              -{formatCurrency(dn.amount)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isReversed ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1">
                                <RotateCcw className="w-3 h-3 text-slate-400" /> Reversed
                              </span>
                            ) : isRefunded ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 inline-flex items-center gap-1">
                                <CheckCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Refund Received
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Deducted
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedDebitNote(dn)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs whitespace-nowrap"
                                title="View & Print Debit Note Receipt"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Debit Note</span>
                              </button>

                              {!isReversed && (
                                isRefunded ? (
                                  <span 
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-semibold whitespace-nowrap opacity-80 cursor-default"
                                    title="Refund has already been confirmed and settled"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Settled</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkAsRefunded(dn)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                    title="Confirm that refund money was received from the supplier"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Mark Refunded</span>
                                  </button>
                                )
                              )}
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
        </div>
      )}

      {/* Modal: New Commercial Invoice / PO */}
      {showPOModal && (
        <InvoicePOModal
          suppliers={suppliers}
          warehouses={warehouses}
          products={resources}
          resources={resources}
          onClose={() => setShowPOModal(false)}
          onSubmit={handleCreateCommercialPO}
        />
      )}

      {/* Modal: Edit Commercial Invoice / PO */}
      {editingPO && (
        <InvoicePOModal
          initialData={editingPO}
          suppliers={suppliers}
          warehouses={warehouses}
          products={resources}
          resources={resources}
          onClose={() => setEditingPO(null)}
          onSubmit={handleEditCommercialPO}
        />
      )}

      {/* Modal: Record Payment */}
      {payingPO && (() => {
        const total = Number(payingPO.grandTotal !== undefined ? payingPO.grandTotal : (payingPO.totalAmount || 0));
        const paid = Number(payingPO.amountPaid || 0);
        const due = Number(payingPO.balanceDue !== undefined ? payingPO.balanceDue : Math.max(0, total - paid));
        const payAmountNum = parseFloat(paymentFormData.amount) || 0;
        const isExceeding = payAmountNum > due;
        const sup = suppliers.find(s => s.id === payingPO.supplierId);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Record PO Payment
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      PO #{payingPO.poNumber} • {sup?.company || 'Supplier'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingPO(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Display (Read-Only): Invoice Grand Total and Current Balance Due */}
              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Invoice Grand Total (Read-Only)
                  </span>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {formatCurrency(total)}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider block">
                    Current Balance Due (Read-Only)
                  </span>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                    {formatCurrency(due)}
                  </div>
                </div>
              </div>

              {/* Payment Input Form */}
              <form onSubmit={handleRecordPayment} className="space-y-4">
                {/* Payment Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Payment Amount ({activeCurrency?.symbol?.trim() || 'Rs.'}) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaymentFormData(prev => ({ ...prev, amount: due.toFixed(2) }))}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      Pay Full Balance ({formatCurrency(due)})
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={due}
                    required
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border ${
                      isExceeding
                        ? 'border-rose-500 focus:ring-rose-500'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500'
                    } text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:outline-none text-sm font-bold`}
                  />
                  {isExceeding && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Payment amount cannot exceed the current balance due of {formatCurrency(due)}.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Payment Method Dropdown: Cash, Bank Transfer, Cheque */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Payment Method <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={paymentFormData.paymentMethod}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Payment Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentFormData.paymentDate}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Transaction Reference / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. Cheque #10492 or Bank slip reference"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPayingPO(null)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isExceeding || payAmountNum <= 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Payment</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal: View Receipt */}
      {receiptPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150 print:p-0 print:m-0 print:static print:bg-transparent print:backdrop-blur-none print:overflow-visible">
          {/* Print Isolation & Contrast CSS */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #receipt-print-area, #receipt-print-area * {
                visibility: visible;
              }
              #receipt-print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 24px;
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

          <div 
            id="receipt-print-area"
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs my-auto max-h-[90vh] flex flex-col print:relative print:block print:m-0 print:p-6 print:shadow-none print:border-none print:w-full print:max-w-none print:max-h-none print:bg-white print:text-black print:overflow-visible"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 print:border-slate-300 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 print:bg-emerald-100 print:text-emerald-700">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white print:text-black">
                    Vendor Payment Receipt
                  </h3>
                  <p className="text-[11px] text-slate-400 print:text-slate-600">
                    Official Settlement Record • PO #{receiptPO.poNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 print:hidden no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer print:hidden no-print"
                  title="Print Receipt"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptPO(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer print:hidden no-print"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4 print:overflow-visible print:py-0">
              {/* Status Header Badge */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 print:bg-emerald-50 border border-emerald-200 dark:border-emerald-800 print:border-emerald-300 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 print:text-emerald-800">
                    Settlement Status
                  </div>
                  <div className="text-sm font-black text-emerald-800 dark:text-emerald-300 print:text-emerald-900 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Paid in Full / Completed
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 print:text-emerald-800">Invoice Reference</div>
                  <div className="font-mono font-bold text-emerald-900 dark:text-emerald-200 print:text-black">
                    {receiptPO.invoiceNumber || receiptPO.poNumber}
                  </div>
                </div>
              </div>

              {/* Vendor & Order Details */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 print:bg-white border border-slate-200 dark:border-slate-800 print:border-slate-300">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-0.5">Vendor / Supplier</span>
                  <div className="font-bold text-slate-900 dark:text-white print:text-black">
                    {suppliers.find(s => s.id === receiptPO.supplierId)?.company || 'Supplier'}
                  </div>
                  <div className="text-[11px] text-slate-500 print:text-slate-700">
                    {suppliers.find(s => s.id === receiptPO.supplierId)?.name}
                  </div>
                  <div className="text-[11px] text-slate-400 print:text-slate-600">
                    {suppliers.find(s => s.id === receiptPO.supplierId)?.email}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-0.5">Order Logistics</span>
                  <div className="text-slate-600 dark:text-slate-300 print:text-black">
                    Date Issued: <strong className="text-slate-900 dark:text-white print:text-black">{receiptPO.orderDate || receiptPO.date}</strong>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 print:text-black">
                    Fulfilled: <strong className="text-slate-900 dark:text-white print:text-black">{receiptPO.dueDate || receiptPO.expectedDate}</strong>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 print:text-black">
                    Destination: <strong className="text-slate-900 dark:text-white print:text-black">{warehouses.find(w => w.id === receiptPO.warehouseId)?.name || 'Central Hub'}</strong>
                  </div>
                </div>
              </div>

              {/* Items Purchased Breakdown */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-1.5">
                  Procured Line Items ({receiptPO.items?.length || 0})
                </span>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 print:border-slate-300 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 print:bg-slate-100 border-b border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-500 print:text-black font-semibold">
                        <th className="py-2 px-3">Item / SKU</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Cost</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200 text-slate-700 dark:text-slate-300 print:text-black">
                      {(receiptPO.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white print:text-black">{it.title || it.productId}</div>
                            {it.sku && <div className="text-[10px] text-slate-400 print:text-slate-600 font-mono">{it.sku}</div>}
                          </td>
                          <td className="py-2 px-3 text-center print:text-black">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono print:text-black">{formatCurrency(it.unitCost || it.unitPrice || 0)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold print:text-black">{formatCurrency((it.quantity || 1) * (it.unitCost || it.unitPrice || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Settlement History */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-1.5">
                  Payment History & Transaction Log
                </span>
                {Array.isArray(receiptPO.paymentHistory) && receiptPO.paymentHistory.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 print:border-slate-300 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 print:bg-slate-100 border-b border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-500 print:text-black font-semibold">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3">Notes / Ref</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200 text-slate-700 dark:text-slate-300 print:text-black">
                        {receiptPO.paymentHistory.map((p, idx) => (
                          <tr key={p.id || idx}>
                            <td className="py-2 px-3 font-mono text-slate-500 print:text-slate-700">{p.date}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 print:text-black">{p.paymentMethod}</td>
                            <td className="py-2 px-3 text-slate-400 print:text-slate-600">{p.notes || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 print:text-black">
                              {formatCurrency(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 print:bg-slate-50 border border-transparent print:border-slate-200 text-slate-400 print:text-slate-700 text-center italic">
                    Recorded as fully settled upon delivery.
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 print:bg-slate-50 border border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-1.5">
                <div className="flex justify-between text-slate-500 print:text-slate-700">
                  <span>Grand Total:</span>
                  <span className="font-bold text-slate-900 dark:text-white print:text-black">
                    {formatCurrency(Number(receiptPO.grandTotal !== undefined ? receiptPO.grandTotal : (receiptPO.totalAmount || 0)))}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 print:text-emerald-800 font-semibold">
                  <span>Total Settled to Vendor:</span>
                  <span className="print:text-emerald-800">
                    {formatCurrency(Number(receiptPO.amountPaid || (receiptPO.grandTotal !== undefined ? receiptPO.grandTotal : (receiptPO.totalAmount || 0))))}
                  </span>
                </div>
                <div className="flex justify-between font-black text-slate-900 dark:text-white print:text-black pt-1.5 border-t border-slate-200 dark:border-slate-700 print:border-slate-300">
                  <span>Remaining Balance:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 print:text-emerald-800 font-mono">
                    {formatCurrency(Number(receiptPO.balanceDue || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Close */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0 print:hidden no-print">
              <button
                type="button"
                onClick={() => setReceiptPO(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer print:hidden no-print"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View & Print Supplier Debit Note Receipt */}
      {selectedDebitNote && (() => {
        const sup = suppliers.find(s => s.id === selectedDebitNote.supplierId);
        const wh = warehouses.find(w => w.id === selectedDebitNote.warehouseId);
        const isReversed = selectedDebitNote.status === 'Reversed';
        const isModalRefunded = selectedDebitNote.refundStatus === 'Refunded' || selectedDebitNote.refundStatus === 'Settled';
        const totalUnits = (selectedDebitNote.items || []).reduce((sum, it) => sum + (Number(it.rejectedQty || it.quantity) || 0), 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150 print:p-0 print:m-0 print:static print:bg-transparent print:backdrop-blur-none print:overflow-visible">
            {/* Scoped Print Styles */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #debit-note-print-area, #debit-note-print-area * {
                  visibility: visible;
                }
                #debit-note-print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  margin: 0;
                  padding: 24px;
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

            <div 
              id="debit-note-print-area"
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs my-auto max-h-[90vh] flex flex-col print:relative print:block print:m-0 print:p-6 print:shadow-none print:border-none print:w-full print:max-w-none print:max-h-none print:bg-white print:text-black print:overflow-visible"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 print:border-slate-300 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 print:bg-rose-100 print:text-rose-700">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white print:text-black">
                      Supplier Debit Note (Purchase Return)
                    </h3>
                    <p className="text-[11px] text-slate-400 print:text-slate-600">
                      Official Deduction Voucher • {selectedDebitNote.debitNoteNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 print:hidden no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer print:hidden no-print"
                    title="Print Debit Note"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDebitNote(null)}
                    className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer print:hidden no-print"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto py-3 space-y-4 print:overflow-visible print:py-0">
                {/* Status Header Badge */}
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  isReversed 
                    ? 'bg-slate-50 dark:bg-slate-800/40 print:bg-slate-50 border-slate-200 dark:border-slate-700 print:border-slate-300'
                    : isModalRefunded
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 print:bg-emerald-50 border-emerald-200 dark:border-emerald-800 print:border-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 print:bg-rose-50 border-rose-200 dark:border-rose-800 print:border-rose-300'
                }`}>
                  <div>
                    <div className={`text-[10px] uppercase font-bold tracking-wider ${
                      isModalRefunded ? 'text-emerald-700 dark:text-emerald-400 print:text-emerald-800' : 'text-rose-700 dark:text-rose-400 print:text-rose-800'
                    }`}>
                      Voucher Status
                    </div>
                    <div className={`text-sm font-black flex items-center gap-1.5 mt-0.5 ${
                      isReversed
                        ? 'text-slate-700 dark:text-slate-300 print:text-black'
                        : isModalRefunded
                        ? 'text-emerald-800 dark:text-emerald-300 print:text-emerald-900'
                        : 'text-rose-800 dark:text-rose-300 print:text-rose-900'
                    }`}>
                      {isReversed ? (
                        <>
                          <RotateCcw className="w-4 h-4 text-slate-500" />
                          <span>Reversed / Cancelled</span>
                        </>
                      ) : isModalRefunded ? (
                        <>
                          <CheckCheck className="w-4 h-4 text-emerald-500" />
                          <span>Refund Received &amp; Settled</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-rose-500" />
                          <span>Payable Balance Deducted</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] ${
                      isModalRefunded ? 'text-emerald-700/80 dark:text-emerald-400/80 print:text-emerald-800' : 'text-rose-700/80 dark:text-rose-400/80 print:text-rose-800'
                    }`}>Debit Note Reference</div>
                    <div className={`font-mono font-bold print:text-black ${
                      isModalRefunded ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'
                    }`}>
                      {selectedDebitNote.debitNoteNumber}
                    </div>
                  </div>
                </div>

                {/* Vendor & Order Details */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 print:bg-white border border-slate-200 dark:border-slate-800 print:border-slate-300">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-0.5">Vendor / Supplier</span>
                    <div className="font-bold text-slate-900 dark:text-white print:text-black">
                      {sup?.company || 'Supplier'}
                    </div>
                    <div className="text-[11px] text-slate-500 print:text-slate-700">
                      Contact: {sup?.name || 'Authorized Representative'}
                    </div>
                    {sup?.email && (
                      <div className="text-[11px] text-slate-400 print:text-slate-600">
                        {sup.email}
                      </div>
                    )}
                    {sup?.taxId && (
                      <div className="text-[10px] text-slate-400 print:text-slate-600 font-mono mt-0.5">
                        Tax ID: {sup.taxId}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-0.5">Audit & Logistics Reference</span>
                    <div className="text-slate-600 dark:text-slate-300 print:text-black">
                      Original PO: <strong className="text-slate-900 dark:text-white print:text-black">{selectedDebitNote.poNumber}</strong>
                    </div>
                    {selectedDebitNote.invoiceNumber && (
                      <div className="text-slate-600 dark:text-slate-300 print:text-black">
                        Invoice Ref: <strong className="text-slate-900 dark:text-white print:text-black">{selectedDebitNote.invoiceNumber}</strong>
                      </div>
                    )}
                    {selectedDebitNote.grnNumber && selectedDebitNote.grnNumber !== 'N/A' && (
                      <div className="text-slate-600 dark:text-slate-300 print:text-black">
                        Inward GRN: <strong className="text-slate-900 dark:text-white print:text-black">{selectedDebitNote.grnNumber}</strong>
                      </div>
                    )}
                    {selectedDebitNote.deliveryNote && (
                      <div className="text-slate-600 dark:text-slate-300 print:text-black">
                        Challan / Slip: <strong className="text-slate-900 dark:text-white print:text-black">{selectedDebitNote.deliveryNote}</strong>
                      </div>
                    )}
                    <div className="text-slate-600 dark:text-slate-300 print:text-black">
                      Facility: <strong className="text-slate-900 dark:text-white print:text-black">{wh?.name || 'Central Hub'}</strong>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 print:text-black">
                      Date Issued: <strong className="text-slate-900 dark:text-white print:text-black">{selectedDebitNote.date}</strong>
                    </div>
                  </div>
                </div>

                {/* Rejected Line Items Breakdown */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-1.5">
                    Rejected Itemized Stock ({selectedDebitNote.items?.length || 0})
                  </span>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 print:border-slate-300 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 print:bg-slate-100 border-b border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-500 print:text-black font-semibold">
                          <th className="py-2 px-3">Description & SKU</th>
                          <th className="py-2 px-3 text-center">Rejected Qty</th>
                          <th className="py-2 px-3 text-right">Unit Cost</th>
                          <th className="py-2 px-3 text-right">Debit Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200 text-slate-700 dark:text-slate-300 print:text-black">
                        {(selectedDebitNote.items || []).length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-4 text-center text-slate-400 italic">
                              No rejected items recorded for this debit note.
                            </td>
                          </tr>
                        ) : (
                          (selectedDebitNote.items || []).map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-900 dark:text-white print:text-black">
                                  {it.productName || it.title || `Item #${idx + 1}`}
                                </div>
                                {it.sku && <div className="text-[10px] text-slate-400 print:text-slate-600 font-mono">{it.sku}</div>}
                              </td>
                              <td className="py-2 px-3 text-center print:text-black font-bold text-rose-600 dark:text-rose-400">
                                {it.rejectedQty || it.quantity || 0} Pcs
                              </td>
                              <td className="py-2 px-3 text-right font-mono print:text-black">
                                {formatCurrency(Number(it.unitCost || 0))}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 print:text-black">
                                -{formatCurrency(Number(it.totalCost !== undefined ? it.totalCost : ((it.rejectedQty || it.quantity || 1) * (it.unitCost || 0))))}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Deduction Summary */}
                <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 print:bg-rose-50/80 border border-rose-200 dark:border-rose-900/60 print:border-rose-300 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black">
                      Total Debit Deduction:
                    </span>
                    <span className="text-base font-black text-rose-600 dark:text-rose-400 print:text-black font-mono">
                      -{formatCurrency(selectedDebitNote.amount)}
                    </span>
                  </div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 print:text-rose-900 border-t border-rose-200 dark:border-rose-900/40 print:border-rose-300 pt-2">
                    Notice: This document certifies that {totalUnits} unit(s) failed inward quality standards and have been returned. The total sum of <strong>{formatCurrency(selectedDebitNote.amount)}</strong> has been deducted from Purchase Order <strong>{selectedDebitNote.poNumber}</strong> and recorded as a reduction in the supplier's payable ledger balance.
                  </div>
                </div>

                {/* Physical Handover Sign-Off Block for Print */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-3">
                      Authorized Warehouse QA Inspector
                    </span>
                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-black h-8"></div>
                    <div className="text-[10px] text-slate-400 print:text-slate-600 mt-1">
                      Signature & Inspection Stamp
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600 block mb-3">
                      Supplier / Carrier Representative
                    </span>
                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-black h-8"></div>
                    <div className="text-[10px] text-slate-400 print:text-slate-600 mt-1">
                      Received Damaged Goods (Name & Signature)
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 print:hidden no-print">
                {!isReversed && !isModalRefunded ? (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRefunded(selectedDebitNote)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Confirm that refund money was received from the supplier"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark as Refunded</span>
                  </button>
                ) : <div />}
                <button
                  type="button"
                  onClick={() => setSelectedDebitNote(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer print:hidden no-print"
                >
                  Close Debit Note
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Add Supplier */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Register Vendor / Supplier
            </h3>
            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Silicon Global"
                  value={supplierFormData.company}
                  onChange={(e) => setSupplierFormData(prev => ({ ...prev, company: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Emily Watson"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +1 (555) 234-5678"
                  value={supplierFormData.phone}
                  onChange={(e) => setSupplierFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Email</label>
                <input
                  type="email"
                  placeholder="e.g. supplier@domain.com"
                  value={supplierFormData.email}
                  onChange={(e) => setSupplierFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="e.g. Silicon Valley, CA"
                  value={supplierFormData.address}
                  onChange={(e) => setSupplierFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
