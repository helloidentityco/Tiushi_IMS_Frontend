import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Barcode as BarcodeIcon, 
  Printer, 
  Edit3, 
  Trash2,
  Sparkles,
  AlertTriangle,
  X,
  Check,
  Upload,
  Boxes,
  Factory,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';
import BarcodePrintUtility from './BarcodePrintUtility';

// ─── Reusable field styles ───────────────────────────────────────────────────
const INPUT_CLS =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500';
const LABEL_CLS = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';
const SECTION_HDR = 'text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 pb-1.5 border-b border-slate-200 dark:border-slate-700/60 mb-3';

// ─── Quick-add inline modal ───────────────────────────────────────────────────
function QuickAddModal({ title, onSave, onClose }) {
  const [name, setName] = useState('');
  const [abbrev, setAbbrev] = useState('');
  const isUnit = title.toLowerCase().includes('unit');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), abbreviation: abbrev.trim() || name.trim().substring(0, 4) });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quick Add: {title}</h4>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className={LABEL_CLS}>Name *</label>
            <input
              autoFocus
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className={INPUT_CLS}
              placeholder={`Enter ${title.toLowerCase()} name`}
            />
          </div>
          {isUnit && (
            <div>
              <label className={LABEL_CLS}>Abbreviation</label>
              <input
                type="text"
                value={abbrev}
                onChange={e => setAbbrev(e.target.value)}
                className={INPUT_CLS}
                placeholder="e.g. Pcs, Kg, Box"
              />
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Dropdown + quick-add button combo ───────────────────────────────────────
function QuickSelect({ label, value, onChange, items, onQuickAdd, placeholder = 'Select…', required = false }) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}{required && ' *'}</label>
      <div className="flex gap-1.5">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          className={`${INPUT_CLS} flex-1`}
        >
          <option value="">{placeholder}</option>
          {items.map(item => (
            <option key={item.id} value={item.id}>{item.displayName || item.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onQuickAdd}
          title={`Quick add new ${label}`}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductManagement({ viewType = 'product', activeSubTab } = {}) {
  const { formatCurrency, logAudit } = useApp();

  const effectiveViewType = (activeSubTab === 'inventory-resources' || viewType === 'resource') ? 'resource' : 'product';
  const isResourceView = effectiveViewType === 'resource';
  const currentItemType = effectiveViewType;

  // Products from Backend API
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Aux data from Backend API
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Live metadata fetched from backend API
  const [fetchedCategories, setFetchedCategories] = useState([]);
  const [fetchedBrands, setFetchedBrands] = useState([]);
  const [fetchedUnits, setFetchedUnits] = useState([]);
  const [fetchedVariants, setFetchedVariants] = useState([]);

  // Local categories, brands, units states fallback (independent of Dexie)
  const [categories, setCategories] = useState([
    { id: 'cat-1', name: 'Peripherals' },
    { id: 'cat-2', name: 'Raw Materials' },
    { id: 'cat-3', name: 'Electronics' },
    { id: 'cat-4', name: 'Components' },
    { id: 'cat-5', name: 'General' },
  ]);
  const [brands, setBrands] = useState([
    { id: 'brand-1', name: 'Logitech' },
    { id: 'brand-2', name: 'Corsair' },
    { id: 'brand-3', name: 'Razer' },
    { id: 'brand-4', name: 'Generic' },
  ]);
  const [units, setUnits] = useState([
    { id: 'unit-1', name: 'Pieces', abbreviation: 'Pcs' },
    { id: 'unit-2', name: 'Boxes', abbreviation: 'Box' },
    { id: 'unit-3', name: 'Kilograms', abbreviation: 'Kg' },
    { id: 'unit-4', name: 'Meters', abbreviation: 'm' },
  ]);

  const activeCategories = fetchedCategories.length > 0 ? fetchedCategories : categories;
  const activeBrands = fetchedBrands.length > 0 ? fetchedBrands : brands;
  const activeUnits = fetchedUnits.length > 0 ? fetchedUnits : units;

  // Cloudinary image upload states
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Fetch live product metadata (categories, brands, units, variants)
  const fetchMetadata = async () => {
    try {
      const [catsRes, brandsRes, unitsRes, variantsRes] = await Promise.allSettled([
        api.get('/categories'),
        api.get('/brands'),
        api.get('/units'),
        api.get('/variants'),
      ]);

      if (catsRes.status === 'fulfilled' && catsRes.value?.data?.success && Array.isArray(catsRes.value.data.data)) {
        setFetchedCategories(catsRes.value.data.data);
      }
      if (brandsRes.status === 'fulfilled' && brandsRes.value?.data?.success && Array.isArray(brandsRes.value.data.data)) {
        setFetchedBrands(brandsRes.value.data.data);
      }
      if (unitsRes.status === 'fulfilled' && unitsRes.value?.data?.success && Array.isArray(unitsRes.value.data.data)) {
        setFetchedUnits(unitsRes.value.data.data);
      }
      if (variantsRes.status === 'fulfilled' && variantsRes.value?.data?.success && Array.isArray(variantsRes.value.data.data)) {
        setFetchedVariants(variantsRes.value.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch product metadata from backend API:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Fetch products or resources from API
  const fetchItems = async () => {
    try {
      setIsLoadingProducts(true);
      const endpoint = isResourceView ? '/resources' : '/products';
      const res = await api.get(endpoint);
      if (res.data?.success && Array.isArray(res.data.data)) {
        const normalized = res.data.data.map(item => ({
          ...item,
          sku: item.code || item.sku,
          name: item.name || item.title,
          title: item.name || item.title,
          costPrice: item.costPrice || '0.00',
          sellingPrice: item.sellingPrice || item.costPrice || '0.00',
          minStockAlert: item.minStockLevel || item.minStockAlert || 0,
          unit: item.unit?.shortName || item.unit?.name || item.unitOfMeasure || item.unit || 'units',
          image: item.imageUrl || item.image || '',
          imageUrl: item.imageUrl || item.image || '',
          categoryId: item.categoryId || item.categoryRef?.id || '',
          brandId: item.brandId || item.brand?.id || '',
          unitId: item.unitId || item.unit?.id || '',
          unitOfSaleId: item.unitOfSaleId || item.unitOfSale?.id || '',
          purchaseUnitId: item.purchaseUnitId || item.purchaseUnit?.id || '',
          variants: Array.isArray(item.variants) ? item.variants : [],
        }));
        setProducts(normalized);
      }
    } catch (err) {
      console.error(`Failed to fetch ${isResourceView ? 'resources' : 'products'} from backend API:`, err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Fetch data on mount and whenever isResourceView changes
  useEffect(() => {
    fetchItems();
  }, [isResourceView]);

  // Fetch auxiliary options
  useEffect(() => {
    api.get('/warehouses').then(res => {
      if (res.data?.success && Array.isArray(res.data.data)) setWarehouses(res.data.data);
    }).catch(err => console.error('Failed to fetch warehouses:', err));

    api.get('/suppliers').then(res => {
      if (res.data?.success && Array.isArray(res.data.data)) {
        const normalized = res.data.data.map(s => ({
          ...s,
          name: s.name || s.company || 'Unnamed Supplier',
          company: s.company || s.name || 'Unnamed Supplier'
        }));
        setSuppliers(normalized);
      }
    }).catch(err => console.error('Failed to fetch suppliers:', err));
  }, []);

  const [searchQuery,      setSearchQuery]      = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [showPrintModal,   setShowPrintModal]   = useState(activeSubTab === 'inventory-print');
  const [editingProduct,   setEditingProduct]   = useState(null);

  // Manual Stock Allocation modal state (Products)
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockFormData, setStockFormData] = useState({
    warehouseId: '',
    quantity: '',
    binLocation: ''
  });
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // Manufacturing Stock Consumption modal state (Resources)
  const [selectedResourceForConsume, setSelectedResourceForConsume] = useState(null);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [consumeFormData, setConsumeFormData] = useState({
    warehouseId: '',
    quantityUsed: '',
    notes: ''
  });
  const [isSubmittingConsume, setIsSubmittingConsume] = useState(false);
  const [consumeError, setConsumeError] = useState('');

  // Quick-add modals
  const [quickAdd, setQuickAdd] = useState(null); // { type: 'category'|'brand'|'unit' }

  // ─── Form state ─────────────────────────────────────────────────────────────
  const blankForm = () => ({
    title: '',
    itemType: currentItemType,
    sku: `${isResourceView ? 'RES' : 'PROD'}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    barcode: '761' + Math.floor(1000000000 + Math.random() * 9000000000).toString(),
    // Existing fields
    category: isResourceView ? 'Raw Materials' : (activeCategories[0]?.name || 'Peripherals'),
    categoryId: activeCategories[0]?.id || '',
    unit: activeUnits[0]?.shortName || activeUnits[0]?.abbreviation || 'Pcs',
    costPrice: '45.00',
    sellingPrice: '79.99',
    taxPercent: 0,
    minStockAlert: 10,
    supplierId: suppliers[0]?.id || '',
    binLocation: 'Aisle A - Rack 1 - Shelf 1',
    description: '',
    image: '',
    // New enterprise fields
    brandId: activeBrands[0]?.id || '',
    unitId: activeUnits[0]?.id || '',
    unitOfSaleId: activeUnits[0]?.id || '',
    purchaseUnitId: activeUnits[0]?.id || '',
    variants: [],
    barcodeSymbology: 'EAN-13',
    productType: 'Standard',
    quantityLimit: '',
    expirationDate: '',
    notes: '',
    images: []
  });

  const [formData, setFormData] = useState(blankForm);

  const patch = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  // ─── Generators ─────────────────────────────────────────────────────────────
  const generateSKU = () => {
    const prefix = (formData.category || 'PROD').substring(0, 3).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    patch('sku', `${prefix}-${rand}-2026`);
  };

  const generateBarcode = () => {
    const ean = '761' + Math.floor(1000000000 + Math.random() * 9000000000).toString();
    patch('barcode', ean);
  };

  // ─── CRUD handlers ───────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setSelectedImageFile(null);
    setImagePreview('');
    setFormData(blankForm());
    if (suppliers.length === 0) {
      api.get('/suppliers').then(res => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          setSuppliers(res.data.data.map(s => ({
            ...s,
            name: s.name || s.company || 'Unnamed Supplier',
            company: s.company || s.name || 'Unnamed Supplier'
          })));
        }
      }).catch(err => console.error('Failed to fetch suppliers:', err));
    }
    setShowAddModal(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setSelectedImageFile(null);
    setImagePreview(product.imageUrl || product.image || '');
    if (suppliers.length === 0) {
      api.get('/suppliers').then(res => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          setSuppliers(res.data.data.map(s => ({
            ...s,
            name: s.name || s.company || 'Unnamed Supplier',
            company: s.company || s.name || 'Unnamed Supplier'
          })));
        }
      }).catch(err => console.error('Failed to fetch suppliers:', err));
    }
    setFormData({
      itemType:        product.itemType       || effectiveViewType,
      title:           product.name           || product.title        || '',
      sku:             product.sku            || '',
      barcode:         product.barcode        || '',
      category:        product.categoryRef?.name || product.category || 'Peripherals',
      categoryId:      product.categoryId     || product.categoryRef?.id || '',
      unit:            product.unit?.shortName || product.unit?.name || product.unit || 'Pcs',
      costPrice:       product.costPrice      || '',
      sellingPrice:    product.sellingPrice   || '',
      taxPercent:      product.taxPercent !== undefined ? product.taxPercent : 0,
      minStockAlert:   product.minStockLevel  || product.minStockAlert || 10,
      supplierId:      product.supplierId     || '',
      binLocation:     product.binLocation    || '',
      description:     product.description   || '',
      image:           product.imageUrl       || product.image        || '',
      brandId:         product.brandId        || product.brand?.id || '',
      unitId:          product.unitId         || product.unit?.id || '',
      unitOfSaleId:    product.unitOfSaleId   || product.unitOfSale?.id || '',
      purchaseUnitId:  product.purchaseUnitId || product.purchaseUnit?.id || '',
      variants:        Array.isArray(product.variants) ? product.variants : [],
      barcodeSymbology:product.barcodeSymbology || 'EAN-13',
      productType:     product.productType    || 'Standard',
      quantityLimit:   product.quantityLimit  || '',
      expirationDate:  product.expirationDate || '',
      notes:           product.notes          || '',
      images:          product.images         || []
    });
    setShowAddModal(true);
  };

  // Save product with Cloudinary image upload via FormData
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const productName = (formData.title || formData.name || '').trim();
      const productSku = (formData.sku || '').trim().toUpperCase();
      const productCategory = activeCategories.find(c => c.id === formData.categoryId)?.name || formData.category || (isResourceView ? 'Raw Materials' : 'General');

      if (!productName) {
        alert(`${isResourceView ? 'Resource' : 'Product'} name is required.`);
        return;
      }
      if (!productSku) {
        alert(`${isResourceView ? 'Resource code' : 'Product SKU'} is required.`);
        return;
      }

      // ── Cloudinary Image Upload Flow ──
      // If external URL is provided directly, bypass upload and use string directly
      let finalImageUrl = (formData.image || '').trim() || null;

      // If a new local image file was selected, upload to Cloudinary first
      if (selectedImageFile) {
        setIsUploadingImage(true);
        try {
          const uploadData = new FormData();
          uploadData.append('image', selectedImageFile);
          uploadData.append('folder', isResourceView ? 'identity_ims/resources' : 'identity_ims/products');

          const uploadRes = await api.post('/upload', uploadData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const secureUrl = uploadRes.data?.data?.url || uploadRes.data?.url;
          if (secureUrl) {
            finalImageUrl = secureUrl;
          } else {
            throw new Error('No image URL returned from upload server.');
          }
        } catch (uploadErr) {
          console.error('Failed to upload image to Cloudinary:', uploadErr);
          alert('Cloudinary Upload Failed: ' + (uploadErr.response?.data?.message || uploadErr.message));
          setIsUploadingImage(false);
          return;
        } finally {
          setIsUploadingImage(false);
        }
      }

      if (isResourceView) {
        // Resources API payload with verified Cloudinary / external image URL
        const resourcePayload = {
          code: productSku,
          name: productName,
          category: productCategory,
          costPrice: String(formData.costPrice || '0.00'),
          unitOfMeasure: formData.unit || 'units',
          minStockLevel: Number(formData.minStockAlert || 0),
          imageUrl: finalImageUrl || null,
        };

        if (editingProduct) {
          await api.put(`/resources/${editingProduct.id}`, resourcePayload);

          await logAudit?.(
            'Resource Updated',
            'Product Management',
            `Updated resource ${productName} (${productSku}) via API.`
          );
        } else {
          await api.post('/resources', resourcePayload);

          await logAudit?.(
            'Resource Created',
            'Product Management',
            `Created new resource code ${productSku} - ${productName} via API.`
          );
        }
      } else {
        // Construct FormData for multipart product API submission
        const formDataObj = new FormData();
        formDataObj.append('name', productName);
        formDataObj.append('sku', productSku);
        formDataObj.append('category', productCategory);
        if (formData.categoryId) formDataObj.append('categoryId', formData.categoryId);
        if (formData.brandId) formDataObj.append('brandId', formData.brandId);
        if (formData.unitId) formDataObj.append('unitId', formData.unitId);
        if (formData.unitOfSaleId) formDataObj.append('unitOfSaleId', formData.unitOfSaleId);
        if (formData.purchaseUnitId) formDataObj.append('purchaseUnitId', formData.purchaseUnitId);
        formDataObj.append('variants', JSON.stringify(formData.variants || []));
        formDataObj.append('costPrice', String(formData.costPrice || '0.00'));
        formDataObj.append('sellingPrice', String(formData.sellingPrice || '0.00'));
        formDataObj.append('minStockLevel', String(formData.minStockAlert || 0));

        if (finalImageUrl) {
          formDataObj.append('imageUrl', finalImageUrl);
        } else if (selectedImageFile) {
          formDataObj.append('image', selectedImageFile);
        }

        if (editingProduct) {
          // PUT /api/products/:id
          await api.put(`/products/${editingProduct.id}`, formDataObj, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          await logAudit?.(
            'Product Updated',
            'Product Management',
            `Updated product ${productName} (${productSku}) via API.`
          );
        } else {
          // POST /api/products
          await api.post('/products', formDataObj, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          await logAudit?.(
            'Product Created',
            'Product Management',
            `Created new product SKU ${productSku} - ${productName} via API.`
          );
        }
      }

      // Refresh items table from backend
      await fetchItems();

      setShowAddModal(false);
      setEditingProduct(null);
      setSelectedImageFile(null);
      setImagePreview('');
    } catch (err) {
      console.error('Save product error:', err);
      const serverMessage = 
        err.response?.data?.message || 
        (err.response?.data?.errors && err.response.data.errors[0]?.message) ||
        err.message || 
        'Failed to save product.';
      alert(`Product Error: ${serverMessage}`);
    }
  };

  const handleDeleteProduct = (id, title) => {
    alert(`Enterprise Protection: Direct deletion for "${title}" is disabled to preserve audit history and relational procurement integrity.`);
  };

  // ─── Manual Stock Allocation Handlers ─────────────────────────────────────────
  const handleOpenStockAdjustment = (product) => {
    setSelectedProductForStock(product);
    const defaultWarehouseId = warehouses[0]?.id || '';
    const existing = Array.isArray(product.stock)
      ? product.stock.find(s => s.warehouseId === defaultWarehouseId)
      : null;

    setStockFormData({
      warehouseId: defaultWarehouseId,
      quantity: existing ? existing.quantity : '',
      binLocation: existing?.binLocation || product.binLocation || ''
    });
    setShowStockModal(true);
  };

  const handleWarehouseChangeInStockModal = (whId) => {
    const existing = Array.isArray(selectedProductForStock?.stock)
      ? selectedProductForStock.stock.find(s => s.warehouseId === whId)
      : null;

    setStockFormData(prev => ({
      ...prev,
      warehouseId: whId,
      quantity: existing ? existing.quantity : '',
      binLocation: existing?.binLocation || prev.binLocation || ''
    }));
  };

  const handleSaveStockAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedProductForStock) return;
    if (!stockFormData.warehouseId) {
      alert('Please select a warehouse.');
      return;
    }
    const qty = parseInt(stockFormData.quantity, 10);
    if (isNaN(qty) || qty < 0) {
      alert('Please enter a valid non-negative quantity.');
      return;
    }

    setIsSubmittingStock(true);
    try {
      if (isResourceView) {
        await api.post('/resources/allocate-stock', {
          resourceId: selectedProductForStock.id,
          warehouseId: stockFormData.warehouseId,
          quantity: qty,
          binLocation: stockFormData.binLocation?.trim() || undefined
        });
      } else {
        await api.post('/products/allocate-stock', {
          productId: selectedProductForStock.id,
          warehouseId: stockFormData.warehouseId,
          quantity: qty,
          binLocation: stockFormData.binLocation?.trim() || undefined
        });
      }

      await logAudit?.(
        'Stock Allocation Adjusted',
        'Inventory Management',
        `Adjusted stock for ${selectedProductForStock.name || selectedProductForStock.title} (${selectedProductForStock.sku}) to ${qty} in warehouse.`
      );

      await fetchItems();
      setShowStockModal(false);
      setSelectedProductForStock(null);
      alert('Stock allocation updated successfully!');
    } catch (err) {
      console.error('Failed to allocate stock:', err);
      const serverMsg = err.response?.data?.message || err.message || 'Failed to adjust stock.';
      alert(`Error adjusting stock: ${serverMsg}`);
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // ─── Resource Manufacturing Consumption Handlers ─────────────────────────────
  const getWarehouseStock = (item, whId) => {
    if (!item || !Array.isArray(item.stock)) return 0;
    const match = item.stock.find(s => s.warehouseId === whId);
    return match ? Number(match.quantity || 0) : 0;
  };

  const handleOpenConsumeModal = (resource) => {
    setSelectedResourceForConsume(resource);
    const defaultWarehouseId = warehouses[0]?.id || '';
    setConsumeFormData({
      warehouseId: defaultWarehouseId,
      quantityUsed: '',
      notes: ''
    });
    setConsumeError('');
    setShowConsumeModal(true);
  };

  const handleSaveConsumeStock = async (e) => {
    e.preventDefault();
    if (!selectedResourceForConsume) return;
    if (!consumeFormData.warehouseId) {
      setConsumeError('Please select a source warehouse.');
      return;
    }
    const qty = parseInt(consumeFormData.quantityUsed, 10);
    if (isNaN(qty) || qty <= 0) {
      setConsumeError('Please enter a valid positive quantity used.');
      return;
    }

    const available = getWarehouseStock(selectedResourceForConsume, consumeFormData.warehouseId);
    if (qty > available) {
      setConsumeError(`Insufficient stock in selected warehouse. Available: ${available}, requested: ${qty}.`);
      return;
    }

    setIsSubmittingConsume(true);
    setConsumeError('');
    try {
      await api.post('/resources/consume-stock', {
        resourceId: selectedResourceForConsume.id,
        warehouseId: consumeFormData.warehouseId,
        quantityUsed: qty,
        notes: consumeFormData.notes?.trim() || null
      });

      if (logAudit) {
        await logAudit(
          'Resource Consumed for Manufacturing',
          'Manufacturing & Resources',
          `Consumed ${qty} ${selectedResourceForConsume.unit || 'units'} of ${selectedResourceForConsume.name || selectedResourceForConsume.title} for manufacturing. Notes: ${consumeFormData.notes || 'None'}.`
        );
      }

      await fetchItems();
      setShowConsumeModal(false);
      setSelectedResourceForConsume(null);
      alert(`Successfully recorded consumption of ${qty} ${selectedResourceForConsume.unit || 'units'}.`);
    } catch (err) {
      console.error('Failed to consume resource stock:', err);
      const serverMsg = err.response?.data?.message || err.message || 'Failed to consume stock.';
      setConsumeError(serverMsg);
    } finally {
      setIsSubmittingConsume(false);
    }
  };

  // ─── Quick-add handlers ──────────────────────────────────────────────────────
  const handleQuickAddSave = async ({ name, abbreviation }) => {
    if (!quickAdd) return;
    try {
      if (quickAdd.type === 'category') {
        const res = await api.post('/categories', { name, description: '' });
        const created = res.data?.data;
        if (created) {
          setFetchedCategories(prev => [...prev, created]);
          patch('categoryId', created.id);
          patch('category', created.name);
        }
      } else if (quickAdd.type === 'brand') {
        const res = await api.post('/brands', { name, description: '' });
        const created = res.data?.data;
        if (created) {
          setFetchedBrands(prev => [...prev, created]);
          patch('brandId', created.id);
        }
      } else if (quickAdd.type === 'unit') {
        const res = await api.post('/units', {
          name,
          shortName: abbreviation || name.substring(0, 4),
          baseUnit: 'None'
        });
        const created = res.data?.data;
        if (created) {
          setFetchedUnits(prev => [...prev, created]);
          patch(quickAdd.field, created.id);
        }
      }
    } catch (err) {
      console.error(`Quick add ${quickAdd.type} failed:`, err);
      const id = `${quickAdd.type}-${Date.now()}`;
      if (quickAdd.type === 'category') {
        setFetchedCategories(prev => [...prev, { id, name }]);
        patch('categoryId', id);
        patch('category', name);
      } else if (quickAdd.type === 'brand') {
        setFetchedBrands(prev => [...prev, { id, name }]);
        patch('brandId', id);
      } else if (quickAdd.type === 'unit') {
        setFetchedUnits(prev => [...prev, { id, name, shortName: abbreviation || name }]);
        patch(quickAdd.field, id);
      }
    } finally {
      setQuickAdd(null);
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────────────────
  // Multi-node stock summary directly from backend relation
  const getProductStockSummary = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return 0;
    if (Array.isArray(prod.stock)) {
      return prod.stock.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
    }
    return 0;
  };

  const categoryNames = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const titleMatch = (p.name || p.title || '').toLowerCase().includes(q);
    const skuMatch = (p.sku || '').toLowerCase().includes(q);
    const barcodeMatch = (p.barcode || '').includes(q);
    return matchesCat && (!q || titleMatch || skuMatch || barcodeMatch);
  });

  const unitItems = activeUnits.map(u => ({
    id: u.id,
    name: u.name,
    displayName: `${u.name} (${u.shortName || u.abbreviation || ''})`,
    shortName: u.shortName || u.abbreviation || '',
  }));

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{isResourceView ? 'Resources' : 'Products'}</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {products.length} {isResourceView ? 'Resources' : 'Products'}
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isResourceView
              ? 'Manage raw materials, components (leather, straps, shells), barcodes, and stock levels.'
              : 'Manage catalog, barcode generation, brand/category attributes, and multi-node stock allocation.'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            <Printer className="w-4 h-4 text-indigo-500" />
            Barcode Print Utility
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            {isResourceView ? 'Add New Resource' : 'Add New Product'}
          </button>
        </div>
      </div>

      {/* ── Search + Category filter ── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isResourceView ? "Search resources by title, SKU or barcode…" : "Search products by title, SKU or barcode…"}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1">
          {categoryNames.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Products Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">SKU &amp; Barcode</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Cost Price</th>
                <th className="py-3.5 px-4">Selling Price</th>
                <th className="py-3.5 px-4">Total Stock</th>
                <th className="py-3.5 px-4">Bin Location</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filtered.map(product => {
                const totalStock = getProductStockSummary(product.id);
                const isLowStock = totalStock <= (product.minStockAlert || 10);
                return (
                  <tr key={product.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.imageUrl || product.image || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=300&auto=format&fit=crop&q=80'}
                          alt={product.name || product.title}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                            {product.name || product.title}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>{activeBrands.find(b => b.id === product.brandId)?.name || product.brand?.name || 'General'}</span>
                            <span>·</span>
                            <span>{product.unit || 'Pcs'}</span>
                            {Array.isArray(product.variants) && product.variants.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold text-[10px]">
                                {product.variants.length} {product.variants.length === 1 ? 'Variant' : 'Variants'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white">{product.sku}</div>
                      <div className="text-[10px] text-indigo-500 flex items-center gap-1">
                        <BarcodeIcon className="w-3.5 h-3.5" />{product.barcode}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                        {product.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">
                      {formatCurrency(product.costPrice)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(product.sellingPrice)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                          isLowStock
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        }`}>
                          {totalStock} {product.unit || 'Pcs'}
                        </span>
                        {isLowStock && <AlertTriangle className="w-4 h-4 text-amber-500" title="Below Minimum Alert Level" />}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {product.binLocation || 'Aisle 1 - Shelf A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isResourceView ? (
                          <button
                            type="button"
                            onClick={() => handleOpenConsumeModal(product)}
                            className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg transition-colors cursor-pointer"
                            title="Consume / Use Resource in Manufacturing"
                          >
                            <Factory className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenStockAdjustment(product)}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                            title="Adjust / Allocate Stock"
                          >
                            <Boxes className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleOpenEdit(product)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteProduct(product.id, product.title)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-colors cursor-pointer" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">{isResourceView ? 'No resources found' : 'No products found'}</p>
              <p className="text-xs mt-1">Try adjusting your search or category filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          REGISTER / EDIT PRODUCT MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] my-4">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingProduct 
                      ? (isResourceView ? 'Edit Resource Details' : 'Edit Product Details') 
                      : (isResourceView ? 'Register New Resource' : 'Register New Product')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isResourceView 
                      ? 'Fill in all required fields to record this component/material in the resources catalog.'
                      : 'Fill in all required fields to add this SKU to the enterprise catalog.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable form body */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-xs">

              {/* ── SECTION 1: Basic Info ── */}
              <div>
                <p className={SECTION_HDR}>1 · Basic Information</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Title — full width */}
                  <div className="md:col-span-3">
                    <label className={LABEL_CLS}>Product Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => patch('title', e.target.value)}
                      placeholder="e.g. MX Master 3S Wireless Performance Mouse"
                      className={INPUT_CLS}
                    />
                  </div>

                  {/* SKU */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={LABEL_CLS.replace('mb-1', '')}>SKU Code *</label>
                      <button type="button" onClick={generateSKU}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                        <Sparkles className="w-3 h-3" /> Auto-Gen
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={e => patch('sku', e.target.value)}
                      className={`${INPUT_CLS} font-mono`}
                    />
                  </div>

                  {/* Barcode */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={LABEL_CLS.replace('mb-1', '')}>Barcode Number *</label>
                      <button type="button" onClick={generateBarcode}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                        <Sparkles className="w-3 h-3" /> Generate
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.barcode}
                      onChange={e => patch('barcode', e.target.value)}
                      className={`${INPUT_CLS} font-mono`}
                    />
                  </div>

                  {/* Barcode Symbology */}
                  <div>
                    <label className={LABEL_CLS}>Barcode Symbology</label>
                    <select value={formData.barcodeSymbology} onChange={e => patch('barcodeSymbology', e.target.value)} className={INPUT_CLS}>
                      <option value="EAN-13">EAN-13</option>
                      <option value="Code128">Code128</option>
                      <option value="UPC-A">UPC-A</option>
                      <option value="QR">QR Code</option>
                      <option value="ITF-14">ITF-14</option>
                    </select>
                  </div>

                  {/* Product Type */}
                  <div>
                    <label className={LABEL_CLS}>Product Type</label>
                    <select value={formData.productType} onChange={e => patch('productType', e.target.value)} className={INPUT_CLS}>
                      <option value="Standard">Standard</option>
                      <option value="Combo">Combo / Bundle</option>
                      <option value="Service">Service</option>
                      <option value="Digital">Digital</option>
                    </select>
                  </div>

                  {/* Category */}
                  <QuickSelect
                    label="Category"
                    value={formData.categoryId}
                    onChange={v => {
                      patch('categoryId', v);
                      const catObj = activeCategories.find(c => c.id === v);
                      if (catObj) patch('category', catObj.name);
                    }}
                    items={activeCategories}
                    onQuickAdd={() => setQuickAdd({ type: 'category' })}
                    placeholder="Select category…"
                  />

                  {/* Brand */}
                  <QuickSelect
                    label="Brand"
                    value={formData.brandId}
                    onChange={v => patch('brandId', v)}
                    items={activeBrands}
                    onQuickAdd={() => setQuickAdd({ type: 'brand' })}
                    placeholder="Select brand…"
                  />
                </div>
              </div>

              {/* ── SECTION 2: Pricing & Tax ── */}
              <div>
                <p className={SECTION_HDR}>2 · Pricing &amp; Tax</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Cost Price (Rs.) *</label>
                    <input type="number" step="0.01" required value={formData.costPrice}
                      onChange={e => patch('costPrice', e.target.value)} className={INPUT_CLS} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Selling Price (Rs.) *</label>
                    <input type="number" step="0.01" required value={formData.sellingPrice}
                      onChange={e => patch('sellingPrice', e.target.value)} className={INPUT_CLS} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Tax Rate (%)</label>
                    <input type="number" step="0.1" min="0" max="100" value={formData.taxPercent}
                      onChange={e => patch('taxPercent', e.target.value)} className={INPUT_CLS} />
                  </div>
                </div>
              </div>

              {/* ── SECTION 3: Units ── */}
              <div>
                <p className={SECTION_HDR}>3 · Unit Configuration</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <QuickSelect
                    label="Product Unit"
                    value={formData.unitId}
                    onChange={v => {
                      patch('unitId', v);
                      const uObj = activeUnits.find(u => u.id === v);
                      if (uObj) patch('unit', uObj.shortName || uObj.abbreviation || uObj.name);
                    }}
                    items={unitItems}
                    onQuickAdd={() => setQuickAdd({ type: 'unit', field: 'unitId' })}
                    placeholder="Select unit…"
                  />
                  <QuickSelect
                    label="Unit of Sale"
                    value={formData.unitOfSaleId}
                    onChange={v => patch('unitOfSaleId', v)}
                    items={unitItems}
                    onQuickAdd={() => setQuickAdd({ type: 'unit', field: 'unitOfSaleId' })}
                    placeholder="Select unit of sale…"
                  />
                  <QuickSelect
                    label="Purchase Unit"
                    value={formData.purchaseUnitId}
                    onChange={v => patch('purchaseUnitId', v)}
                    items={unitItems}
                    onQuickAdd={() => setQuickAdd({ type: 'unit', field: 'purchaseUnitId' })}
                    placeholder="Select purchase unit…"
                  />
                </div>
              </div>

              {/* ── SECTION 4: Inventory & Warehouse ── */}
              <div>
                <p className={SECTION_HDR}>4 · Inventory &amp; Warehouse</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Min Stock Threshold</label>
                    <input type="number" min="0" value={formData.minStockAlert}
                      onChange={e => patch('minStockAlert', e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Quantity Limitation</label>
                    <input type="number" min="0" value={formData.quantityLimit}
                      onChange={e => patch('quantityLimit', e.target.value)}
                      placeholder="Max qty per order (optional)"
                      className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Expiration Date</label>
                    <input type="date" value={formData.expirationDate}
                      onChange={e => patch('expirationDate', e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={LABEL_CLS}>Default Bin Mapping</label>
                    <input type="text" value={formData.binLocation}
                      onChange={e => patch('binLocation', e.target.value)}
                      placeholder="e.g. Aisle B - Rack 2 - Shelf 1 - Bin C-04"
                      className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Preferred Supplier</label>
                    <select value={formData.supplierId} onChange={e => patch('supplierId', e.target.value)} className={INPUT_CLS}>
                      <option value="">None / Select Supplier</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name || s.company}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── SECTION 5: Variants (Optional) ── */}
              {!isResourceView && (
                <div>
                  <p className={SECTION_HDR}>5 · Variants (Optional)</p>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Product Variant Attributes
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Select one or multiple variant attributes (e.g., Size, Color) associated with this product.
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {(formData.variants || []).length} Selected
                      </span>
                    </div>

                    {fetchedVariants.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 dark:text-slate-500">
                        <p className="text-xs font-medium">No variants registered in catalog yet.</p>
                        <p className="text-[10px] mt-0.5">Define variants in the Variants module to associate them with products.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {fetchedVariants.map((variant) => {
                          const isChecked = (formData.variants || []).some(
                            v => (typeof v === 'string' ? v === variant.id : v?.id === variant.id)
                          );
                          const optionsList = Array.isArray(variant.options)
                            ? variant.options
                            : Array.isArray(variant.values)
                              ? variant.values
                              : [];

                          return (
                            <div
                              key={variant.id}
                              onClick={() => {
                                const current = Array.isArray(formData.variants) ? formData.variants : [];
                                const exists = current.some(v => (typeof v === 'string' ? v === variant.id : v?.id === variant.id));
                                let next;
                                if (exists) {
                                  next = current.filter(v => (typeof v === 'string' ? v !== variant.id : v?.id !== variant.id));
                                } else {
                                  next = [...current, { id: variant.id, name: variant.name, options: optionsList }];
                                }
                                patch('variants', next);
                              }}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                isChecked
                                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-600 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 pointer-events-none"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-slate-900 dark:text-white truncate">
                                    {variant.name}
                                  </span>
                                  {isChecked && (
                                    <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  )}
                                </div>
                                {optionsList.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {optionsList.slice(0, 4).map((opt, idx) => (
                                      <span
                                        key={idx}
                                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono"
                                      >
                                        {opt}
                                      </span>
                                    ))}
                                    {optionsList.length > 4 && (
                                      <span className="text-[10px] text-slate-400">
                                        +{optionsList.length - 4}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SECTION 6: Media ── */}
              <div>
                <p className={SECTION_HDR}>6 · Media &amp; Images (Cloudinary Integration)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Primary Photo File (Upload to Cloudinary)</label>
                    <label className="flex flex-col items-center justify-center gap-1.5 h-20 border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 rounded-xl cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors bg-indigo-50/30 dark:bg-indigo-950/20">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedImageFile(file);
                            setImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <Upload className="w-5 h-5 text-indigo-500" />
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                        {selectedImageFile ? selectedImageFile.name : 'Click to select image file'}
                      </span>
                    </label>
                    {(imagePreview || formData.image) && (
                      <div className="flex items-center gap-2.5 mt-2.5">
                        <img
                          src={imagePreview || formData.image}
                          alt="Preview"
                          className="h-14 w-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                        />
                        {selectedImageFile ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            {isUploadingImage ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Uploading to Cloudinary...</span>
                              </>
                            ) : (
                              <span>Ready for Cloudinary</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            Current Image
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Or Image URL (External / CDN)</label>
                    <input
                      type="url"
                      value={formData.image}
                      onChange={e => {
                        patch('image', e.target.value);
                        if (!selectedImageFile) setImagePreview(e.target.value);
                      }}
                      placeholder="https://images.unsplash.com/..."
                      className={INPUT_CLS}
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      You can either upload an image file (auto-synced to Cloudinary CDN) or paste a direct image URL.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── SECTION 7: Notes ── */}
              <div>
                <p className={SECTION_HDR}>7 · Internal Notes &amp; Description</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Short Description</label>
                    <textarea rows={3} value={formData.description}
                      onChange={e => patch('description', e.target.value)}
                      placeholder="Public-facing product description…"
                      className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Internal Notes</label>
                    <textarea rows={3} value={formData.notes}
                      onChange={e => patch('notes', e.target.value)}
                      placeholder="Warehouse notes, handling instructions, sourcing details…"
                      className={INPUT_CLS} />
                  </div>
                </div>
              </div>
            </form>

            {/* Modal footer */}
            <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900/80 rounded-b-3xl">
              <p className="text-[11px] text-slate-400">* Required fields</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  form="product-form"
                  type="submit"
                  disabled={isUploadingImage}
                  onClick={handleSaveProduct}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading Image...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {editingProduct 
                          ? (isResourceView ? 'Update Resource' : 'Update Product') 
                          : (isResourceView ? 'Save Resource' : 'Save Product')}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick-add sub-modal ── */}
      {quickAdd && (
        <QuickAddModal
          title={quickAdd.type === 'category' ? 'Category' : quickAdd.type === 'brand' ? 'Brand' : 'Unit'}
          onSave={handleQuickAddSave}
          onClose={() => setQuickAdd(null)}
        />
      )}

      {/* ── Manual Stock Allocation Modal (Products only) ── */}
      {showStockModal && selectedProductForStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Manual Stock Allocation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Adjust quantity and bin assignment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowStockModal(false);
                  setSelectedProductForStock(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Product Summary Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                  {selectedProductForStock.name || selectedProductForStock.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded">
                    SKU: {selectedProductForStock.sku}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Total: {getProductStockSummary(selectedProductForStock.id)} {selectedProductForStock.unit || 'units'}
                  </span>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStockAdjustment} className="space-y-4">
              <div>
                <label className={LABEL_CLS}>Target Warehouse *</label>
                <select
                  required
                  value={stockFormData.warehouseId}
                  onChange={(e) => handleWarehouseChangeInStockModal(e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="" disabled>Select a warehouse</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} {wh.code ? `(${wh.code})` : ''}
                    </option>
                  ))}
                </select>
                {warehouses.length === 0 && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    No warehouses found. Please create a warehouse first.
                  </p>
                )}
              </div>

              <div>
                <label className={LABEL_CLS}>New Total Quantity *</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stockFormData.quantity}
                  onChange={(e) => setStockFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="Enter total units in this warehouse"
                  className={INPUT_CLS}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Directly sets the physical stock count available in this warehouse node.
                </p>
              </div>

              <div>
                <label className={LABEL_CLS}>Bin / Shelf Location (Optional)</label>
                <input
                  type="text"
                  value={stockFormData.binLocation}
                  onChange={(e) => setStockFormData(prev => ({ ...prev, binLocation: e.target.value }))}
                  placeholder="e.g., Aisle 2 - Rack B - Shelf 3"
                  className={INPUT_CLS}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowStockModal(false);
                    setSelectedProductForStock(null);
                  }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStock || warehouses.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isSubmittingStock ? 'Saving...' : 'Save Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Consume Resource Modal (Manufacturing) ── */}
      {showConsumeModal && selectedResourceForConsume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Consume Resource
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Log material usage for manufacturing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowConsumeModal(false);
                  setSelectedResourceForConsume(null);
                  setConsumeError('');
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Resource Summary Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                  {selectedResourceForConsume.name || selectedResourceForConsume.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded">
                    Code: {selectedResourceForConsume.sku || selectedResourceForConsume.code}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Total Available: {getProductStockSummary(selectedResourceForConsume.id)} {selectedResourceForConsume.unit || 'units'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error alert if any */}
            {consumeError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{consumeError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveConsumeStock} className="space-y-4">
              <div>
                <label className={LABEL_CLS}>Source Warehouse *</label>
                <select
                  required
                  value={consumeFormData.warehouseId}
                  onChange={(e) => {
                    setConsumeFormData(prev => ({ ...prev, warehouseId: e.target.value }));
                    setConsumeError('');
                  }}
                  className={INPUT_CLS}
                >
                  <option value="" disabled>Select source warehouse</option>
                  {warehouses.map((wh) => {
                    const whQty = getWarehouseStock(selectedResourceForConsume, wh.id);
                    return (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} {wh.code ? `(${wh.code})` : ''} — Stock: {whQty} {selectedResourceForConsume.unit || 'units'}
                      </option>
                    );
                  })}
                </select>
                {consumeFormData.warehouseId && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Available in selected warehouse:{' '}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {getWarehouseStock(selectedResourceForConsume, consumeFormData.warehouseId)} {selectedResourceForConsume.unit || 'units'}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className={LABEL_CLS}>Quantity Consumed *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={consumeFormData.quantityUsed}
                  onChange={(e) => {
                    setConsumeFormData(prev => ({ ...prev, quantityUsed: e.target.value }));
                    setConsumeError('');
                  }}
                  placeholder="Enter amount used in manufacturing"
                  className={INPUT_CLS}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This amount will be deducted directly from the selected warehouse stock.
                </p>
              </div>

              <div>
                <label className={LABEL_CLS}>Manufacturing Notes</label>
                <input
                  type="text"
                  value={consumeFormData.notes}
                  onChange={(e) => setConsumeFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g., Used for Batch #102, Assembly Line 4"
                  className={INPUT_CLS}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowConsumeModal(false);
                    setSelectedResourceForConsume(null);
                    setConsumeError('');
                  }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingConsume}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Factory className="w-3.5 h-3.5" />
                  {isSubmittingConsume ? 'Recording...' : 'Record Consumption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Barcode Print Utility Modal ── */}
      {showPrintModal && (
        <BarcodePrintUtility
          products={products}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
