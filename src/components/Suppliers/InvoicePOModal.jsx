import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Plus, 
  Trash2, 
  Building2, 
  Warehouse, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

export default function InvoicePOModal({
  suppliers = [],
  warehouses = [],
  products = [],
  resources = [],
  onClose,
  onSubmit,
  initialData = null
}) {
  const { formatCurrency, activeCurrency } = useApp();
  const isEdit = Boolean(initialData);

  // Strictly filter to ensure ONLY raw materials/resources (itemType === 'resource') are available for procurement
  const availableResources = useMemo(() => {
    const list = resources.length > 0 ? resources : products;
    return list.filter(item => item.itemType === 'resource');
  }, [resources, products]);

  // Basic Header Fields
  const [poNumber, setPoNumber] = useState(initialData?.poNumber || `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoiceNumber || `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [supplierId, setSupplierId] = useState(initialData?.supplierId || suppliers[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || warehouses[0]?.id || 'wh-1');
  const [orderDate, setOrderDate] = useState((initialData?.orderDate || initialData?.date || new Date().toISOString()).split('T')[0]);
  
  const [dueDate, setDueDate] = useState(() => {
    if (initialData?.dueDate || initialData?.expectedDate) {
      return (initialData.dueDate || initialData.expectedDate).split('T')[0];
    }
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  
  const [status, setStatus] = useState(initialData?.status || 'Issued');
  const [notes, setNotes] = useState(initialData?.notes || 'Commercial supplier invoice & inventory procurement');

  // Multi-item rows (initialize with initialData items or first available resource)
  const [items, setItems] = useState(() => {
    if (initialData && Array.isArray(initialData.items) && initialData.items.length > 0) {
      return initialData.items.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        productId: it.resourceId || it.productId,
        quantity: it.quantity || it.orderedQty || 1,
        unitPrice: it.unitCost !== undefined ? it.unitCost : (it.unitPrice || 0)
      }));
    }
    const defaultResource = availableResources[0] || (resources.length > 0 ? resources[0] : products[0]);
    return [
      {
        id: `item-${Date.now()}-1`,
        productId: defaultResource?.id || '',
        quantity: 10,
        unitPrice: defaultResource?.costPrice || 45.00
      }
    ];
  });

  // Synchronize initial item when resources load asynchronously (only in create mode)
  useEffect(() => {
    if (!initialData && availableResources.length > 0) {
      setItems(prev => {
        if (prev.length === 1 && (!prev[0].productId || !availableResources.some(r => r.id === prev[0].productId))) {
          return [{
            ...prev[0],
            productId: availableResources[0].id,
            unitPrice: availableResources[0].costPrice || 45.00
          }];
        }
        return prev;
      });
    }
  }, [availableResources, initialData]);

  // Global Modifiers
  const [discountAmount, setDiscountAmount] = useState(initialData?.discountAmount || 0);
  const [taxPercent, setTaxPercent] = useState(initialData?.taxPercent || 0);
  const [shippingCost, setShippingCost] = useState(initialData?.shippingCost || 0);

  // PDF Attachment State (Manual file attachment only - no auto-extraction)
  const [pdfFile, setPdfFile] = useState(() => {
    if (initialData?.invoicePdfUrl) {
      return { name: initialData.pdfAttachmentName || 'Cloudinary Invoice PDF', url: initialData.invoicePdfUrl };
    }
    if (initialData?.pdfAttachmentName) {
      return { name: initialData.pdfAttachmentName };
    }
    return null;
  });
  const [pdfBlob, setPdfBlob] = useState(initialData?.pdfAttachment || null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // ─── Row management ──────────────────────────────────────────────────────────
  const handleAddItem = () => {
    const defaultResource = availableResources[0];
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        productId: defaultResource?.id || '',
        quantity: 1,
        unitPrice: defaultResource?.costPrice || 10.00
      }
    ]);
  };

  const handleRemoveItem = (id) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      
      // Auto-fill unit price when changing resource
      if (field === 'productId') {
        const prod = availableResources.find(p => p.id === value);
        if (prod && prod.costPrice) {
          updated.unitPrice = Number(prod.costPrice);
        }
      }
      return updated;
    }));
  };

  // ─── PDF File Handling (Attachment only - no auto-scan) ──────────────────────
  const handleFileUpload = (file) => {
    if (!file) return;
    setPdfFile(file);
    // Ensure Blob preservation for storage
    const blob = file instanceof Blob ? file : new Blob([file], { type: file.type || 'application/pdf' });
    setPdfBlob(blob);
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
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleRemovePdf = (e) => {
    e.stopPropagation();
    setPdfFile(null);
    setPdfBlob(null);
  };

  // ─── Live Calculations ──────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + (qty * price);
  }, 0);

  const safeDiscount = Math.max(0, Number(discountAmount) || 0);
  const discountedSubtotal = Math.max(0, subtotal - safeDiscount);
  const safeTaxRate = Math.max(0, Number(taxPercent) || 0);
  const taxAmount = (discountedSubtotal * safeTaxRate) / 100;
  const safeShipping = Math.max(0, Number(shippingCost) || 0);
  const grandTotal = Math.max(0, discountedSubtotal + taxAmount + safeShipping);

  // ─── Upload PDF to Cloudinary ──────────────────────────────────────────────
  const uploadInvoiceToCloudinary = async (file) => {
    if (!file || !(file instanceof File || file instanceof Blob)) {
      return pdfFile?.url || initialData?.invoicePdfUrl || null;
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'hkmimv4d';
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'inventory_preset';

    // 1. Direct unauthenticated Cloudinary API call
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'identity_ims/invoices');

      const clRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData,
      });

      if (clRes.ok) {
        const clData = await clRes.json();
        if (clData.secure_url) {
          return clData.secure_url;
        }
      }
    } catch (directErr) {
      console.warn('Direct Cloudinary upload attempt failed, trying backend upload endpoint:', directErr);
    }

    // 2. Fallback: Authenticated backend /api/upload endpoint
    try {
      const backendFormData = new FormData();
      backendFormData.append('image', file);
      backendFormData.append('folder', 'identity_ims/invoices');

      const bkRes = await api.post('/upload', backendFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (bkRes.data?.data?.url) {
        return bkRes.data.data.url;
      }
    } catch (bkErr) {
      console.error('Backend upload fallback failed:', bkErr);
      throw new Error('Failed to upload PDF invoice to Cloudinary.');
    }

    return null;
  };

  // ─── Submit Form ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || isUploadingPdf) return;

    if (!supplierId) {
      alert('Please select a supplier.');
      return;
    }

    if (items.some(i => !i.productId || Number(i.quantity) <= 0)) {
      alert('Please ensure all items have a selected product and valid quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadedPdfUrl = initialData?.invoicePdfUrl || null;

      // Upload file to Cloudinary if new file selected
      if (pdfFile && (pdfFile instanceof File || (pdfFile instanceof Blob && !pdfFile.url))) {
        setIsUploadingPdf(true);
        try {
          uploadedPdfUrl = await uploadInvoiceToCloudinary(pdfFile);
        } finally {
          setIsUploadingPdf(false);
        }
      } else if (pdfFile?.url) {
        uploadedPdfUrl = pdfFile.url;
      }

      const payload = {
        poNumber,
        invoiceNumber,
        supplierId,
        warehouseId,
        orderDate,
        dueDate,
        date: orderDate,
        expectedDate: dueDate,
        invoicePdfUrl: uploadedPdfUrl || null,
        status,
        subtotal,
        discountAmount: safeDiscount,
        taxPercent: safeTaxRate,
        taxAmount,
        shippingCost: safeShipping,
        grandTotal,
        totalAmount: grandTotal,
        items: items.map(item => {
          const resItem = availableResources.find(p => p.id === item.productId);
          const prod = resItem || products.find(p => p.id === item.productId);
          const isResource = Boolean(resItem || prod?.itemType === 'resource' || prod?.category === 'Raw Materials' || prod?.category === 'Supplies');
          const qty = Number(item.quantity);
          const price = Number(item.unitPrice);
          const existingItem = initialData?.items?.find(it => (it.resourceId || it.productId) === item.productId);
          return {
            productId: isResource ? null : item.productId,
            resourceId: isResource ? item.productId : null,
            sku: prod?.sku || prod?.code || '',
            title: prod?.title || prod?.name || '',
            quantity: qty,
            receivedQty: existingItem?.receivedQty !== undefined ? Number(existingItem.receivedQty) : 0,
            unitCost: price,
            totalCost: qty * price
          };
        }),
        pdfAttachment: pdfBlob || null,
        pdfAttachmentName: pdfFile?.name || null,
        notes
      };

      await onSubmit(payload);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to issue purchase order.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {isEdit ? 'Edit Vendor Purchase Order' : 'Issue Vendor Purchase Order'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isEdit 
                ? 'Update order details, line items, pricing, or vendor invoice attachments.'
                : 'Record commercial invoices, multi-line item procurement, and attach vendor PDF bills.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="invoice-po-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-5 text-xs">
          
          {/* 1. PDF Upload Zone */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Vendor PDF Invoice Upload
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer relative ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                  : pdfFile
                  ? 'border-emerald-400/80 bg-emerald-50/30 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
              onClick={() => document.getElementById('po-pdf-file-input')?.click()}
            >
              <input
                id="po-pdf-file-input"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              {pdfFile ? (
                <div className="flex items-center justify-between text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                        <span>{pdfFile.name}</span>
                        {pdfFile.size && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                            {(pdfFile.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Attached to purchase order record</span>
                        {pdfFile.url && (
                          <a
                            href={pdfFile.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 ml-2 text-indigo-500 hover:text-indigo-600 underline font-semibold"
                          >
                            <span>Open on Cloudinary</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePdf}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  <UploadCloud className="w-8 h-8 mx-auto text-indigo-500/80 mb-1" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Click to browse or drag and drop vendor PDF invoice
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Attach PDF document to purchase order
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Commercial Invoice Header Fields */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Invoice & Order Parameters
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  PO Number *
                </label>
                <input
                  type="text"
                  required
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-medium focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Vendor Invoice # *
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-8812"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-medium focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Issued">Issued (Pending)</option>
                  <option value="Partially Received">Partially Received</option>
                  <option value="Completed">Completed (Settled)</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Vendor / Supplier *
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white truncate focus:ring-1 focus:ring-indigo-500"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company} ({s.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Receiving Warehouse *
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white truncate focus:ring-1 focus:ring-indigo-500"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Payment Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Multiple Line Items Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Invoice Line Items ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Row
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Raw Material / Resource</th>
                      <th className="py-2.5 px-3 w-24">Quantity</th>
                      <th className="py-2.5 px-3 w-32">Unit Price ({activeCurrency?.symbol?.trim() || 'Rs.'})</th>
                      <th className="py-2.5 px-3 w-32 text-right">Line Total</th>
                      <th className="py-2.5 px-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((row) => {
                      const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3">
                            <select
                              value={row.productId}
                              onChange={(e) => handleItemChange(row.id, 'productId', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                            >
                              {availableResources.length === 0 ? (
                                <option value="" disabled>No resources found (Register in Resources tab)</option>
                              ) : (
                                availableResources.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.title} ({p.sku})
                                  </option>
                                ))
                              )}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="1"
                              required
                              value={row.quantity}
                              onChange={(e) => handleItemChange(row.id, 'quantity', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={row.unitPrice}
                              onChange={(e) => handleItemChange(row.id, 'unitPrice', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white font-mono">
                            {formatCurrency(lineTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(row.id)}
                              disabled={items.length <= 1}
                              className={`p-1.5 rounded-lg transition-colors ${
                                items.length <= 1
                                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer'
                              }`}
                              title={items.length <= 1 ? 'Minimum 1 item required' : 'Remove item'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 4. Global Modifiers & Calculations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left: Modifier Inputs & Notes */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Commercial Modifiers
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Discount ({activeCurrency?.symbol?.trim() || 'Rs.'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tax (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Shipping ({activeCurrency?.symbol?.trim() || 'Rs.'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Internal PO Notes
                </label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. FOB Destination, Net 30 terms..."
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white resize-none"
                />
              </div>
            </div>

            {/* Right: Net Payable Summary */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/20 shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                  Net Payable Summary
                </span>
                
                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>Items Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {safeDiscount > 0 && (
                    <div className="flex justify-between text-amber-300">
                      <span>Discount:</span>
                      <span>-{formatCurrency(safeDiscount)}</span>
                    </div>
                  )}
                  {safeTaxRate > 0 && (
                    <div className="flex justify-between text-indigo-200">
                      <span>Sales Tax ({safeTaxRate}%):</span>
                      <span>+{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  {safeShipping > 0 && (
                    <div className="flex justify-between text-indigo-200">
                      <span>Shipping & Freight:</span>
                      <span>+{formatCurrency(safeShipping)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700/80 mt-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider block">
                    Grand Total
                  </span>
                  <div className="text-2xl font-black text-white">
                    {formatCurrency(grandTotal)}
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  {items.length} {items.length === 1 ? 'Line Item' : 'Line Items'}
                </div>
              </div>
            </div>

          </div>

        </form>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            form="invoice-po-form"
            type="submit"
            disabled={isSubmitting || isUploadingPdf}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            {isUploadingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading PDF to Cloudinary...</span>
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isEdit ? 'Saving Changes...' : 'Issuing Purchase Order...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{isEdit ? 'Save Changes' : 'Issue Vendor Purchase Order'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
