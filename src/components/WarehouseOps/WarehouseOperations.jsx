import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, 
  PackagePlus, 
  RotateCcw, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Printer, 
  Sparkles,
  Search,
  X,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Truck,
  PackageCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';
import PackingSlipModal from './PackingSlipModal';

export default function WarehouseOperations() {
  const { t, formatCurrency, activeWarehouseId, logAudit, currentRole } = useApp();

  const canReverseGRN = currentRole === 'admin' || currentRole === 'manager';

  const [products, setProducts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [grns, setGrns] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Purchase Orders
  const fetchPOs = async () => {
    try {
      const res = await api.get('/purchase-orders');
      setPurchaseOrders(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch purchase orders:', err);
    }
  };

  // Fetch Products
  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  // Fetch Warehouses
  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/warehouses');
      setWarehouses(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
    }
  };

  // Fetch GRNs
  const fetchGRNs = async () => {
    try {
      const res = await api.get('/grns');
      setGrns(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch GRNs:', err);
    }
  };

  // Fetch Sales Orders for Picking & Packing Slips
  const fetchSalesOrders = async () => {
    try {
      const res = await api.get('/sales');
      const rawSales = res.data?.data || [];
      const normalized = rawSales.map(sale => {
        const items = (sale.sale_items || sale.items || []).map(it => ({
          id: it.id,
          productId: it.productId,
          title: it.product?.name || it.title || 'Product Item',
          sku: it.product?.sku || it.sku || 'SKU-N/A',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          lineTotal: Number(it.lineTotal || 0),
        }));

        return {
          id: sale.id,
          orderNumber: sale.invoiceNumber || sale.id,
          customerName: sale.customerName || 'Walk-in Customer',
          orderDate: sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : 'N/A',
          fulfillmentStatus: sale.fulfillmentStatus || 'Pending Pick',
          warehouseId: sale.warehouseId,
          totalAmount: Number(sale.totalAmount || 0),
          paymentMethod: sale.paymentMethod,
          items,
        };
      });
      setSalesOrders(normalized);
    } catch (err) {
      console.error('Failed to fetch sales orders:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchPOs(), fetchProducts(), fetchWarehouses(), fetchGRNs(), fetchSalesOrders()]);
      setIsLoading(false);
    };
    loadAll();
  }, []);

  // Derived stock levels across warehouses from product stock records
  const stockLevels = useMemo(() => {
    return products.flatMap(p => (p.stock || []).map(s => ({
      id: s.id,
      productId: p.id,
      warehouseId: s.warehouseId,
      quantity: Number(s.quantity || 0),
      warehouse: s.warehouse
    })));
  }, [products]);

  const [activeTab, setActiveTab] = useState('grn'); // 'grn' | 'audit' | 'picklists'
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState(null);
  const [picklistFilter, setPicklistFilter] = useState('All');

  useEffect(() => {
    if (activeTab === 'picklists') {
      fetchSalesOrders();
    }
  }, [activeTab]);

  // Receivable POs: Only show POs with status 'Issued' or 'Partially Received'. Hide 'Completed' POs so they cannot be received again.
  const receivablePOs = useMemo(() => {
    return purchaseOrders.filter(po => {
      const statusLower = (po.status || '').trim().toLowerCase();
      if (statusLower === 'completed' || statusLower === 'paid') return false;

      // Check if all items in this PO are already fully received
      if (Array.isArray(po.items) && po.items.length > 0) {
        const totalOrdered = po.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        const totalReceived = po.items.reduce((sum, it) => sum + (Number(it.receivedQty) || 0), 0);
        if (totalOrdered > 0 && totalReceived >= totalOrdered) return false;
      }

      return statusLower === 'issued' || statusLower === 'partially received' || !po.status;
    });
  }, [purchaseOrders]);

  // Inward GRN State
  const [grnData, setGrnData] = useState({
    poId: '',
    deliveryNote: '',
    warehouseId: activeWarehouseId || 'wh-1',
    batchNumber: `BATCH-2026-${Math.floor(100 + Math.random() * 900)}`,
    expiryDate: '2028-12-31',
    notes: 'Inspected carton packaging. Good condition.'
  });

  const [grnItems, setGrnItems] = useState([]);

  // Helper to extract & prepare line items from a Purchase Order with remaining quantity calculations
  const loadPOItems = (targetPO) => {
    if (!targetPO) return [];
    if (Array.isArray(targetPO.items) && targetPO.items.length > 0) {
      return targetPO.items.map((item, index) => {
        const prod = item.product || item.resource || products.find(p => p.id === item.productId);
        const ordered = Number(item.orderedQty !== undefined ? item.orderedQty : (item.quantity || 1));
        const prevReceived = Number(item.receivedQty || 0);
        const remaining = Math.max(0, ordered - prevReceived);
        const cost = Number(item.unitPrice !== undefined ? item.unitPrice : (item.unitCost || prod?.costPrice || 0));
        return {
          id: item.id || `item-${index}-${item.productId || item.resourceId || index}`,
          itemId: item.id,
          productId: item.productId || item.resourceId,
          resourceId: item.resourceId,
          productName: prod?.name || prod?.title || item.title || `Item #${index + 1}`,
          sku: prod?.sku || prod?.code || item.sku || 'SKU-N/A',
          orderedQty: ordered,
          previouslyReceivedQty: prevReceived,
          remainingQty: remaining,
          receivedQty: remaining, // default to remaining balance
          unitCost: cost,
          qcStatus: 'QA Passed' // 'QA Passed' | 'Quarantine' | 'Rejected'
        };
      });
    }

    const prodId = targetPO.productId || products[0]?.id;
    const prod = products.find(p => p.id === prodId);
    const ordered = Number(targetPO.orderedQty !== undefined ? targetPO.orderedQty : (targetPO.quantity || 1));
    const prevReceived = Number(targetPO.receivedQty || 0);
    const remaining = Math.max(0, ordered - prevReceived);
    const cost = Number(targetPO.unitPrice !== undefined ? targetPO.unitPrice : (targetPO.unitCost || prod?.costPrice || 0));
    return [{
      id: targetPO.id ? `item-0-${targetPO.id}` : `item-0-${prodId}`,
      itemId: targetPO.id,
      productId: prodId,
      productName: prod?.name || prod?.title || 'Purchase Item',
      sku: prod?.sku || 'SKU-N/A',
      orderedQty: ordered,
      previouslyReceivedQty: prevReceived,
      remainingQty: remaining,
      receivedQty: remaining,
      unitCost: cost,
      qcStatus: 'QA Passed'
    }];
  };

  // Synchronize PO selection and line items
  const handleSelectPO = (poId) => {
    const selectedPO = receivablePOs.find(p => p.id === poId) || purchaseOrders.find(p => p.id === poId);
    setGrnData(prev => ({
      ...prev,
      poId,
      deliveryNote: selectedPO?.invoiceNumber ? `DN-${selectedPO.invoiceNumber}` : (selectedPO ? `DN-${selectedPO.poNumber}` : ''),
      warehouseId: selectedPO?.warehouseId || prev.warehouseId || activeWarehouseId || 'wh-1'
    }));

    if (selectedPO) {
      setGrnItems(loadPOItems(selectedPO));
    } else {
      setGrnItems([]);
    }
  };

  // Open modal and pre-initialize if needed
  const handleOpenGRNModal = () => {
    const targetPO = receivablePOs.find(p => p.id === grnData.poId) || receivablePOs[0];
    if (targetPO) {
      setGrnData(prev => ({
        ...prev,
        poId: targetPO.id,
        deliveryNote: prev.deliveryNote || (targetPO.invoiceNumber ? `DN-${targetPO.invoiceNumber}` : `DN-${targetPO.poNumber}`),
        warehouseId: targetPO.warehouseId || prev.warehouseId || activeWarehouseId || 'wh-1'
      }));
      setGrnItems(loadPOItems(targetPO));
    } else {
      setGrnData(prev => ({ ...prev, poId: '', deliveryNote: '' }));
      setGrnItems([]);
    }
    setShowGRNModal(true);
  };

  // Auto-sync items if modal opens with empty items
  useEffect(() => {
    if (showGRNModal && grnItems.length === 0 && receivablePOs.length > 0) {
      const targetPO = receivablePOs.find(p => p.id === grnData.poId) || receivablePOs[0];
      if (targetPO) {
        setGrnData(prev => ({
          ...prev,
          poId: targetPO.id,
          deliveryNote: prev.deliveryNote || (targetPO.invoiceNumber ? `DN-${targetPO.invoiceNumber}` : `DN-${targetPO.poNumber}`),
          warehouseId: targetPO.warehouseId || prev.warehouseId || activeWarehouseId || 'wh-1'
        }));
        setGrnItems(loadPOItems(targetPO));
      }
    }
  }, [showGRNModal, receivablePOs, grnItems.length, grnData.poId, activeWarehouseId]);

  // Line item change handlers with upper bound constraint
  const handleItemQtyChange = (itemId, val) => {
    setGrnItems(prev => prev.map(item => {
      if (item.id === itemId) {
        if (val === '') {
          return { ...item, receivedQty: '' };
        }
        const numVal = Math.max(0, Number(val));
        const maxLimit = item.remainingQty !== undefined ? item.remainingQty : item.orderedQty;
        const cappedVal = Math.min(numVal, maxLimit);
        return { ...item, receivedQty: cappedVal };
      }
      return item;
    }));
  };

  const handleItemQCChange = (itemId, qcStatus) => {
    setGrnItems(prev => prev.map(item => item.id === itemId ? { ...item, qcStatus } : item));
  };

  // Dynamic Receiving Totals
  const totalReceivedUnits = grnItems.reduce((sum, item) => sum + Math.max(0, Number(item.receivedQty || 0)), 0);
  const totalQaPassedUnits = grnItems.reduce((sum, item) => item.qcStatus === 'QA Passed' ? sum + Math.max(0, Number(item.receivedQty || 0)) : sum, 0);
  const totalQuarantineUnits = grnItems.reduce((sum, item) => item.qcStatus === 'Quarantine' ? sum + Math.max(0, Number(item.receivedQty || 0)) : sum, 0);
  const totalRejectedUnits = grnItems.reduce((sum, item) => item.qcStatus === 'Rejected' ? sum + Math.max(0, Number(item.receivedQty || 0)) : sum, 0);
  const totalRejectedValue = grnItems.reduce((sum, item) => {
    if (item.qcStatus === 'Rejected') {
      const qty = Math.max(0, Number(item.receivedQty || 0));
      const price = Number(item.unitCost || 0);
      return sum + (qty * price);
    }
    return sum;
  }, 0);

  // Cycle count audit form state
  const [auditData, setAuditData] = useState({
    productId: products[0]?.id || '',
    warehouseId: activeWarehouseId || 'wh-1',
    physicalCount: 0,
    reasonCode: 'Data Entry Error', // 'Damaged' | 'Stolen / Shrinkage' | 'Data Entry Error' | 'Expired'
    notes: 'Routine quarterly bin discrepancy recount'
  });

  // Dynamic live expected stock & variance calculation
  const auditTargetProductId = auditData.productId || products[0]?.id || '';
  const auditTargetWarehouseId = auditData.warehouseId || activeWarehouseId || 'wh-1';

  const auditStockRec = stockLevels.find(
    s => s.productId === auditTargetProductId && s.warehouseId === auditTargetWarehouseId
  );
  const auditExpectedCount = auditStockRec ? Number(auditStockRec.quantity || 0) : 0;
  const auditActualCount = Number(auditData.physicalCount !== '' && !isNaN(auditData.physicalCount) ? auditData.physicalCount : 0);
  const auditVariance = auditActualCount - auditExpectedCount;
  const auditSelectedProduct = products.find(p => p.id === auditTargetProductId);
  const auditUnitCost = Number(auditSelectedProduct?.costPrice || 0);
  const auditFinancialImpact = auditVariance * auditUnitCost;

  const handleOpenAuditModal = () => {
    const prodId = auditData.productId || products[0]?.id || '';
    const whId = auditData.warehouseId || activeWarehouseId || 'wh-1';
    const rec = stockLevels.find(s => s.productId === prodId && s.warehouseId === whId);
    const expected = rec ? Number(rec.quantity || 0) : 0;

    setAuditData(prev => ({
      ...prev,
      productId: prodId,
      warehouseId: whId,
      physicalCount: expected,
      reasonCode: prev.reasonCode || 'Data Entry Error'
    }));
    setShowAuditModal(true);
  };

  const handleAuditWarehouseChange = (whId) => {
    const rec = stockLevels.find(s => s.productId === auditTargetProductId && s.warehouseId === whId);
    setAuditData(prev => ({
      ...prev,
      warehouseId: whId,
      physicalCount: rec ? Number(rec.quantity || 0) : 0
    }));
  };

  const handleAuditProductChange = (prodId) => {
    const rec = stockLevels.find(s => s.productId === prodId && s.warehouseId === auditTargetWarehouseId);
    setAuditData(prev => ({
      ...prev,
      productId: prodId,
      physicalCount: rec ? Number(rec.quantity || 0) : 0
    }));
  };

  // Handle order fulfillment status transition
  const handleUpdateFulfillmentStatus = async (orderId, newStatus) => {
    try {
      // Optimistically update local sales orders state
      setSalesOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, fulfillmentStatus: newStatus } : o))
      );

      // Persist fulfillment status update to Neon DB via API
      await api.patch(`/sales/${orderId}/fulfillment-status`, { fulfillmentStatus: newStatus });

      await logAudit(
        'Order Fulfillment Status Updated',
        'Warehouse Operations',
        `Order ${orderId} moved to workflow state: ${newStatus}.`
      );
    } catch (err) {
      console.error('Failed to update order fulfillment status:', err);
      alert('Failed to update order status. Refreshing orders...');
      fetchSalesOrders();
    }
  };

  // Handle Inward GRN Submission
  const handleSaveGRN = async (e) => {
    e.preventDefault();
    if (!grnData.poId) {
      alert('Please select a Purchase Order.');
      return;
    }

    if (!grnData.deliveryNote || !grnData.deliveryNote.trim()) {
      alert('Supplier Delivery Note / Vendor Delivery Challan # is mandatory before submission.');
      return;
    }

    if (grnItems.length === 0) {
      alert('The selected Purchase Order has no line items to receive.');
      return;
    }

    if (totalReceivedUnits <= 0) {
      alert('Please enter a receiving quantity greater than 0.');
      return;
    }

    // Validate that received quantities do not exceed remaining quantities
    for (const item of grnItems) {
      const qty = Math.max(0, Number(item.receivedQty || 0));
      if (item.remainingQty !== undefined && qty > item.remainingQty) {
        alert(`Received quantity for "${item.productName}" exceeds remaining quantity of ${item.remainingQty}.`);
        return;
      }
    }

    try {
      const selectedPO = purchaseOrders.find(p => p.id === grnData.poId);
      if (!selectedPO) {
        alert('Selected Purchase Order not found.');
        return;
      }

      // Extract specific rejected items for auto-debit note mapping
      const rejectedItemsPayload = grnItems
        .filter(item => item.qcStatus === 'Rejected' && Number(item.receivedQty || 0) > 0)
        .map(item => {
          const lineItem = selectedPO.items?.find(it => it.id === item.itemId || it.productId === item.productId || it.id === item.id);
          const rejectedCount = Math.max(0, Number(item.receivedQty || 0));
          const cost = Number(item.unitCost || lineItem?.unitPrice || 0);
          return {
            itemId: lineItem?.id || item.itemId || item.id,
            productId: item.productId || lineItem?.productId || null,
            resourceId: item.resourceId || lineItem?.resourceId || null,
            quantity: rejectedCount,
            rejectedQty: rejectedCount,
            unitCost: cost,
            unitPrice: cost,
            productName: item.productName || lineItem?.product?.name || lineItem?.resource?.name || 'Rejected Material',
            rejectionReason: grnData.notes || 'Inspection QA Failed'
          };
        });

      // Build payload matching backend POST /api/grns
      const payload = {
        poId: selectedPO.id,
        warehouseId: grnData.warehouseId,
        deliveryNote: grnData.deliveryNote.trim(),
        batchNumber: grnData.batchNumber || null,
        expiryDate: grnData.expiryDate || null,
        unitsReceived: totalReceivedUnits,
        receivingDate: new Date().toISOString().split('T')[0],
        qualityStatus: totalRejectedUnits > 0 ? 'QC Issues / Rejected' : totalQuarantineUnits > 0 ? 'Quarantine Hold' : 'QA Passed',
        notes: grnData.notes || '',
        items: grnItems.map(item => {
          const lineItem = selectedPO.items?.find(it => it.id === item.itemId || it.productId === item.productId || it.id === item.id);
          const inwardQty = Math.max(0, Number(item.receivedQty || 0));
          const cost = Number(item.unitCost || lineItem?.unitPrice || 0);
          return {
            itemId: lineItem?.id || item.itemId || item.id,
            productId: item.productId || lineItem?.productId || null,
            resourceId: item.resourceId || lineItem?.resourceId || null,
            productName: item.productName || lineItem?.product?.name || lineItem?.resource?.name || '',
            unitCost: cost,
            unitPrice: cost,
            passedQty: item.qcStatus === 'QA Passed' ? inwardQty : 0,
            rejectedQty: item.qcStatus === 'Rejected' ? inwardQty : 0,
            quarantineQty: item.qcStatus === 'Quarantine' ? inwardQty : 0,
            rejectionReason: item.qcStatus === 'Rejected' ? (grnData.notes || 'Inspection QA Failed') : undefined,
          };
        }),
        rejectedItems: rejectedItemsPayload
      };

      const res = await api.post('/grns', payload);
      const resData = res.data?.data;
      const grnNumber = resData?.grnNumber || `GRN-${Date.now().toString().slice(-6)}`;

      await logAudit(
        'Inbound GRN Processed & Stock Received',
        'Warehouse Operations',
        `Accepted GRN (${grnNumber}) for PO ${selectedPO.poNumber || ''}: ${totalQaPassedUnits} QA passed, ${totalQuarantineUnits} quarantine, ${totalRejectedUnits} rejected.${totalRejectedValue > 0 ? ` Supplier Debit Note generated (-${formatCurrency(totalRejectedValue)}).` : ''}`
      );

      await fetchGRNs();
      await fetchPOs();
      await fetchProducts();
      setShowGRNModal(false);

      alert(`GRN created successfully! ${totalQaPassedUnits} units stocked into warehouse inventory.${totalRejectedUnits > 0 ? ` Debit Note of ${formatCurrency(totalRejectedValue)} generated for rejected items.` : ''}`);
    } catch (err) {
      console.error('Failed to create GRN:', err);
      alert(err.response?.data?.message || 'Failed to process Goods Received Note receipt.');
    }
  };

  // Safe GRN Reversal
  const handleReverseGRN = async (grn) => {
    if (!canReverseGRN) {
      alert('Access Denied: Only Admin and Store Manager roles are permitted to reverse Goods Received Notes.');
      return;
    }

    if (grn.isReversed || grn.status === 'Reversed') {
      alert('This Goods Received Note has already been reversed.');
      return;
    }

    const confirmMsg = `Are you sure you want to reverse GRN ${grn.grnNumber}?\n\nThis will mark this GRN record as Reversed.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (grn.id) {
        await api.patch(`/grns/${grn.id}/reverse`);
      }

      await fetchGRNs();

      await logAudit(
        'GRN Transaction Reversed',
        'Warehouse Operations',
        `GRN ${grn.grnNumber} (PO: ${grn.poId}) was safely marked as reversed by ${currentRole}.`
      );

      alert(`GRN ${grn.grnNumber} marked as reversed successfully.`);
    } catch (err) {
      console.error('Failed to reverse GRN:', err);
      alert('Failed to reverse Goods Received Note: ' + (err.response?.data?.message || err.message || 'Unknown error'));
    }
  };

  // Reconcile Physical Cycle Count Audit
  const handleSaveAudit = async (e) => {
    e.preventDefault();
    try {
      const prod = products.find(p => p.id === auditTargetProductId);
      const stockRec = stockLevels.find(s => s.productId === auditTargetProductId && s.warehouseId === auditTargetWarehouseId);
      const previousQty = stockRec ? Number(stockRec.quantity || 0) : 0;
      const physicalCountNum = Math.max(0, Number(auditData.physicalCount));
      const discrepancy = physicalCountNum - previousQty;
      const unitCost = Number(prod?.costPrice || 0);
      const financialImpact = discrepancy * unitCost;

      // Update physical inventory in backend
      await api.post('/products/allocate-stock', {
        warehouseId: auditTargetWarehouseId,
        productId: auditTargetProductId,
        quantity: physicalCountNum,
        binLocation: auditData.binLocation || 'Audited Bay'
      });

      await logAudit(
        'Cycle Count Adjustment',
        'Warehouse Operations',
        `Cycle count for ${prod?.name || prod?.title || 'Product'} (${prod?.sku || 'SKU-N/A'}). System Expected: ${previousQty}, Actual Physical: ${physicalCountNum} (Variance: ${discrepancy > 0 ? '+' : ''}${discrepancy}). Reason: ${auditData.reasonCode}. Financial Impact: ${discrepancy < 0 ? '-' : discrepancy > 0 ? '+' : ''}${formatCurrency(Math.abs(financialImpact))}.`
      );

      await fetchProducts();
      alert(`Cycle count recorded successfully! Discrepancy of ${discrepancy > 0 ? `+${discrepancy}` : discrepancy} units (${auditData.reasonCode}) reconciled.`);
      setShowAuditModal(false);
    } catch (err) {
      console.error('Failed to record cycle count adjustment:', err);
      alert(err.response?.data?.message || 'Failed to record cycle count adjustment.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t.receiving}</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Goods Received Notes (GRN), cycle count audits, discrepancy reconciliation & pick slips.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAuditModal}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4 text-indigo-500" />
            Physical Cycle Count Audit
          </button>
          <button
            onClick={handleOpenGRNModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            Create Inward GRN
          </button>
        </div>
      </div>

      {/* Operations Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: 'grn', label: 'Goods Received Notes (GRN)', icon: PackagePlus },
          { id: 'picklists', label: 'Picking & Packing Slips', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* GRN History Table */}
      {activeTab === 'grn' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Inward Stock Receipts & Batch Expiry Tracking
            </h3>
            <span className="text-xs text-slate-400">
              {grns.length} Recorded Deliveries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                  <th className="py-3 px-4">GRN #</th>
                  <th className="py-3 px-4">PO Reference</th>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Units Inward</th>
                  <th className="py-3 px-4">Receiving Date</th>
                  <th className="py-3 px-4">Quality Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {grns.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      No inbound GRN receipts recorded yet. Click "Create Inward GRN" to accept shipments.
                    </td>
                  </tr>
                ) : (
                  grns.map(grn => {
                    const po = purchaseOrders.find(p => p.id === grn.poId) || grn.purchaseOrder;
                    const isReversed = grn.isReversed || grn.status === 'Reversed';
                    const hasQuarantine = (grn.qualityStatus === 'Quarantine Hold') || (grn.totalQuarantine > 0) || (Array.isArray(grn.items) && grn.items.some(i => i.qcStatus === 'Quarantine'));
                    const hasRejected = (grn.qualityStatus === 'QC Issues / Rejected' || grn.qualityStatus === 'Rejected') || (grn.totalRejected > 0) || (Array.isArray(grn.items) && grn.items.some(i => i.qcStatus === 'Rejected'));

                    return (
                      <tr 
                        key={grn.id} 
                        className={`transition-colors ${
                          isReversed 
                            ? 'bg-slate-50/60 dark:bg-slate-900/60 opacity-75' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          <div className="flex items-center gap-1.5">
                            <span className={isReversed ? 'line-through text-slate-400' : ''}>
                              {grn.grnNumber}
                            </span>
                            {isReversed && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                                Reversed
                              </span>
                            )}
                          </div>
                          {grn.deliveryNote && (
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                              DN: {grn.deliveryNote}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {po?.poNumber || grn.purchaseOrder?.poNumber || grn.poId}
                          </div>
                          {Array.isArray(grn.items) && grn.items.length > 0 && (
                            <div className="text-[10px] text-slate-400">
                              {grn.items.length} {grn.items.length === 1 ? 'line item' : 'line items'}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {grn.batchNumber || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {grn.expiryDate || '—'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <span className={`font-bold ${
                            isReversed 
                              ? 'line-through text-slate-400' 
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            +{grn.unitsReceived ?? grn.quantity ?? 0} Units Stocked
                          </span>
                          {grn.totalReceivedQuantity && grn.totalReceivedQuantity !== (grn.unitsReceived ?? grn.quantity) && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              ({grn.totalReceivedQuantity} total recv)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {grn.receivingDate || grn.date || (grn.createdAt ? new Date(grn.createdAt).toLocaleDateString() : '—')}
                        </td>
                        <td className="py-3 px-4">
                          {isReversed ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 flex items-center gap-1 w-max">
                              <RotateCcw className="w-3 h-3 text-slate-400" /> Stock Reversed
                            </span>
                          ) : hasRejected ? (
                            <div className="space-y-1">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-1 w-max">
                                <XCircle className="w-3 h-3" /> QC Issues / Rejected
                              </span>
                              {grn.totalRejectedValue > 0 && (
                                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold font-mono">
                                  DN: -{formatCurrency(grn.totalRejectedValue)}
                                </div>
                              )}
                            </div>
                          ) : hasQuarantine ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1 w-max">
                              <AlertTriangle className="w-3 h-3" /> Quarantine Hold
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 w-max">
                              <CheckCircle className="w-3 h-3" /> QA Passed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isReversed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                              <RotateCcw className="w-3 h-3 text-slate-400" />
                              Reversed
                            </span>
                          ) : canReverseGRN ? (
                            <button
                              type="button"
                              onClick={() => handleReverseGRN(grn)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
                              title="Safely reverse this GRN and revert stock / restore PO fulfillment"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reverse GRN</span>
                            </button>
                          ) : (
                            <span 
                              className="text-[11px] text-slate-400 italic px-2 py-1 rounded bg-slate-100/50 dark:bg-slate-800/50" 
                              title="Admin or Store Manager privileges required to reverse GRN transactions"
                            >
                              Locked
                            </span>
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
      )}

      {/* Order-Based Fulfillment Pick & Pack Lists */}
      {activeTab === 'picklists' && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-indigo-500" />
                <span>Order-Based Fulfillment & Picking Lists</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage warehouse order picking routes, progress order fulfillment statuses, and generate commercial packing slips.
              </p>
            </div>

            {/* Workflow Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {['All', 'Pending Pick', 'Picked', 'Packed', 'Dispatched'].map(filterStatus => {
                const count = filterStatus === 'All'
                  ? salesOrders.length
                  : salesOrders.filter(o => (o.fulfillmentStatus || 'Pending Pick') === filterStatus).length;
                const isActive = picklistFilter === filterStatus;

                return (
                  <button
                    key={filterStatus}
                    onClick={() => setPicklistFilter(filterStatus)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span>{filterStatus}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orders Cards List */}
          {salesOrders.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
              <PackageCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No Sales Orders Found
              </p>
              <p className="text-xs text-slate-400 mt-1">
                New sales orders placed via the POS terminal or online sales will automatically appear here for pick & pack fulfillment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {salesOrders
                .filter(order => {
                  if (picklistFilter === 'All') return true;
                  return (order.fulfillmentStatus || 'Pending Pick') === picklistFilter;
                })
                .map(order => {
                  const currentStatus = order.fulfillmentStatus || 'Pending Pick';
                  const orderRef = order.orderNumber || order.id;
                  const customer = order.customerName || 'Walk-in Customer';
                  const dateStr = order.orderDate || (order.date ? new Date(order.date).toLocaleDateString() : 'N/A');
                  const orderItems = Array.isArray(order.items) ? order.items : [];
                  const warehouse = warehouses.find(w => w.id === order.warehouseId);

                  return (
                    <div
                      key={order.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      {/* Order Header */}
                      <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-3 py-1 rounded-xl">
                            {orderRef}
                          </div>

                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {customer}
                            </span>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Date: {dateStr}</span>
                              <span>•</span>
                              <span>Facility: {warehouse?.name || 'Central Distribution Hub'}</span>
                              <span>•</span>
                              <span>{orderItems.length} {orderItems.length === 1 ? 'item' : 'items'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Dropdown & Packing Slip Button */}
                        <div className="flex items-center gap-2.5">
                          {/* Status Workflow Dropdown */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline">Status:</span>
                            <select
                              value={currentStatus}
                              onChange={(e) => handleUpdateFulfillmentStatus(order.id, e.target.value)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border outline-none cursor-pointer transition-colors ${
                                currentStatus === 'Dispatched'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                  : currentStatus === 'Packed'
                                  ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-400'
                                  : currentStatus === 'Picked'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              <option value="Pending Pick" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                Pending Pick
                              </option>
                              <option value="Picked" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                Picked
                              </option>
                              <option value="Packed" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                Packed
                              </option>
                              <option value="Dispatched" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                Dispatched
                              </option>
                            </select>
                          </div>

                          {/* Generate Packing Slip Button */}
                          <button
                            onClick={() => setSelectedOrderForSlip(order)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-98 whitespace-nowrap"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Generate Packing Slip</span>
                          </button>
                        </div>
                      </div>

                      {/* Items List Inside Order */}
                      <div className="p-4">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                              <th className="pb-2 px-2">Line Item & SKU</th>
                              <th className="pb-2 px-2">Bin Location Coordinates</th>
                              <th className="pb-2 px-2 text-right">Pick Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                            {orderItems.map((item, itemIdx) => {
                              const prod = products.find(p => p.id === item.productId);
                              const binLoc = prod?.binLocation || 'Aisle A - Shelf 1';
                              const sku = item.sku || prod?.sku || 'SKU-N/A';

                              return (
                                <tr key={itemIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                  <td className="py-2.5 px-2">
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {item.title || prod?.name || prod?.title || `Item #${itemIdx + 1}`}
                                    </div>
                                    <div className="font-mono text-[10px] text-slate-400">
                                      SKU: {sku}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-900/50">
                                      {binLoc}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-black font-mono text-sm text-slate-900 dark:text-white">
                                    {item.quantity} Pcs
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Inward GRN */}
      {showGRNModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-indigo-500" />
                  <span>Receive Goods & Inward Stock Note (GRN)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Inspect incoming shipment against Purchase Order line items, verify quantities, and assign Quality Control (QC) statuses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGRNModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="grn-form" onSubmit={handleSaveGRN} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              
              {/* Row 1: PO Selector & Delivery Note */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Purchase Order (PO) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={grnData.poId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  >
                    <option value="">Select a Purchase Order...</option>
                    {receivablePOs.length === 0 ? (
                      <option value="" disabled>No outstanding POs available to receive (all Completed)</option>
                    ) : (
                      receivablePOs.map(po => (
                        <option key={po.id} value={po.id}>
                          {po.poNumber} {po.invoiceNumber ? `(${po.invoiceNumber})` : ''} — [{po.status || 'Issued'}] — {formatCurrency(po.grandTotal || po.totalAmount || 0)}
                        </option>
                      ))
                    )}
                  </select>
                  {receivablePOs.length === 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      All purchase orders have been received and completed.
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Supplier Delivery Note / Invoice # <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DN-90214 or INV-2026-88"
                    value={grnData.deliveryNote}
                    onChange={(e) => setGrnData(prev => ({ ...prev, deliveryNote: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Destination Warehouse, Batch Number, Expiry Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Destination Warehouse
                  </label>
                  <select
                    value={grnData.warehouseId}
                    onChange={(e) => setGrnData(prev => ({ ...prev, warehouseId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Batch / Lot # <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="BATCH-XXXX"
                    value={grnData.batchNumber}
                    onChange={(e) => setGrnData(prev => ({ ...prev, batchNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Batch Expiry Date
                  </label>
                  <input
                    type="date"
                    value={grnData.expiryDate}
                    onChange={(e) => setGrnData(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Line Items Receiving Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <span>PO Line Items & Inward Quality Control</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800">
                      {grnItems.length} {grnItems.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Only <strong className="text-emerald-600 dark:text-emerald-400 font-bold">QA Passed</strong> quantities increase available inventory.
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-950/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3 text-center w-20">Ordered</th>
                          <th className="py-2.5 px-3 text-center w-24">Prev. Recv</th>
                          <th className="py-2.5 px-3 text-center w-24">Remaining</th>
                          <th className="py-2.5 px-3 text-center w-32">Receiving Now</th>
                          <th className="py-2.5 px-3 w-44">QC Status</th>
                          <th className="py-2.5 px-3 text-right w-28">Stock Impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                        {grnItems.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="py-8 text-center text-slate-400">
                              Please select an outstanding Purchase Order to view line items for receiving.
                            </td>
                          </tr>
                        ) : (
                          grnItems.map(item => {
                            const qty = Math.max(0, Number(item.receivedQty || 0));
                            const isPassed = item.qcStatus === 'QA Passed';
                            const isQuarantine = item.qcStatus === 'Quarantine';
                            const isRejected = item.qcStatus === 'Rejected';

                            return (
                              <tr key={item.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {item.productName}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                                    SKU: {item.sku}
                                  </div>
                                </td>
                                
                                <td className="py-3 px-3 text-center">
                                  <span className="inline-block px-2.5 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {item.orderedQty}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-center">
                                  <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">
                                    {item.previouslyReceivedQty || 0}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-center">
                                  <span className="inline-block px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    {item.remainingQty}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-center">
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.remainingQty}
                                      required
                                      value={item.receivedQty}
                                      onChange={(e) => handleItemQtyChange(item.id, e.target.value)}
                                      className="w-24 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                      Max: {item.remainingQty}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-3 px-3">
                                  <select
                                    value={item.qcStatus}
                                    onChange={(e) => handleItemQCChange(item.id, e.target.value)}
                                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border outline-none transition-colors ${
                                      isPassed
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                        : isQuarantine
                                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                                        : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400'
                                    }`}
                                  >
                                    <option value="QA Passed" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                      QA Passed
                                    </option>
                                    <option value="Quarantine" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                      Quarantine
                                    </option>
                                    <option value="Rejected" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                      Rejected
                                    </option>
                                  </select>
                                </td>

                                <td className="py-3 px-3 text-right font-mono font-bold">
                                  {isPassed ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      +{qty} units
                                    </span>
                                  ) : isQuarantine ? (
                                    <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                                      0 (Hold)
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 dark:text-rose-400 text-[11px]">
                                      0 (Rejected)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Bar */}
                  {grnItems.length > 0 && (
                    <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-4 text-[11px]">
                        <span className="text-slate-500">
                          Total Received: <strong className="text-slate-900 dark:text-white font-bold">{totalReceivedUnits}</strong>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> QA Passed: <strong>{totalQaPassedUnits}</strong>
                        </span>
                        {totalQuarantineUnits > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" /> Quarantine: <strong>{totalQuarantineUnits}</strong>
                          </span>
                        )}
                        {totalRejectedUnits > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-semibold">
                            <X className="w-3.5 h-3.5" /> Rejected: <strong>{totalRejectedUnits}</strong>
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold font-mono text-[10px] border border-rose-200 dark:border-rose-900">
                              Debit Note: -{formatCurrency(totalRejectedValue)}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Net Stock Addition: <span className="font-bold text-emerald-600 dark:text-emerald-400">+{totalQaPassedUnits} units</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Debit Note Warning Callout */}
                {totalRejectedUnits > 0 && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 rounded-xl flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold">Automatic Supplier Debit Note / Purchase Return:</div>
                      <div className="text-[11px] text-rose-600 dark:text-rose-400">
                        A financial deduction of <strong className="font-bold text-rose-800 dark:text-rose-200">{formatCurrency(totalRejectedValue)}</strong> will be automatically deducted from the PO's grand total and balance due, logged into transaction payment history, and deducted from the supplier's payable ledger upon submission.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Receiving Notes */}
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Receiving & Inspection Notes
                </label>
                <textarea
                  rows="2"
                  value={grnData.notes}
                  onChange={(e) => setGrnData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Note physical packaging condition, seal integrity, carrier tracking, or discrepancy reasons..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setShowGRNModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                form="grn-form"
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Accept & Update Active Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Physical Cycle Count Audit */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-indigo-500" />
                  <span>Physical Cycle Count Inventory Audit</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reconcile physical on-shelf stock with system records and record variances.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAudit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Audited Warehouse
                  </label>
                  <select
                    value={auditTargetWarehouseId}
                    onChange={(e) => handleAuditWarehouseChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Product SKU
                  </label>
                  <select
                    value={auditTargetProductId}
                    onChange={(e) => handleAuditProductChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.title} ({p.sku})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Counts: Expected vs Actual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    System Expected Count
                  </label>
                  <div className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span className="text-sm">{auditExpectedCount} units</span>
                    <span className="text-[10px] text-slate-400 font-sans font-normal uppercase tracking-wider">Indexed</span>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Actual Physical Count <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={auditData.physicalCount}
                    onChange={(e) => setAuditData(prev => ({ ...prev, physicalCount: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-black text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Discrepancy (Variance) Display */}
              <div className="p-3.5 rounded-2xl border transition-all bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Discrepancy (Variance)
                  </span>
                  <span className={`text-base font-black font-mono flex items-center gap-1 ${
                    auditVariance < 0
                      ? 'text-red-600 dark:text-red-400'
                      : auditVariance > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {auditVariance > 0 ? `+${auditVariance}` : auditVariance} units
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Financial Impact (Estimated):
                  </span>
                  <span className={`font-mono font-bold ${
                    auditVariance < 0
                      ? 'text-red-600 dark:text-red-400'
                      : auditVariance > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {auditVariance < 0
                      ? `-${formatCurrency(Math.abs(auditFinancialImpact))} (Loss / Write-off)`
                      : auditVariance > 0
                      ? `+${formatCurrency(auditFinancialImpact)} (Surplus Gain)`
                      : `${formatCurrency(0)} (Balanced)`}
                  </span>
                </div>
              </div>

              {/* Reason Code Dropdown */}
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Reason Code <span className="text-rose-500">*</span>
                </label>
                <select
                  value={auditData.reasonCode}
                  onChange={(e) => setAuditData(prev => ({ ...prev, reasonCode: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="Damaged">Damaged</option>
                  <option value="Stolen / Shrinkage">Stolen / Shrinkage</option>
                  <option value="Data Entry Error">Data Entry Error</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Auditor Notes & Justification
                </label>
                <input
                  type="text"
                  placeholder="Optional details or bin inspection notes..."
                  value={auditData.notes}
                  onChange={(e) => setAuditData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-98"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Commit Reconciliation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Printable Packing Slip */}
      {selectedOrderForSlip && (
        <PackingSlipModal
          order={selectedOrderForSlip}
          warehouses={warehouses}
          products={products}
          onClose={() => setSelectedOrderForSlip(null)}
        />
      )}
    </div>
  );
}
