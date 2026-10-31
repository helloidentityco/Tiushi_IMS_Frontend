import React, { useState, useRef, useEffect } from 'react';
import { 
  Printer, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Warehouse as WarehouseIcon, 
  Sliders, 
  Eye, 
  Tag, 
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

const INPUT_CLS =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors';
const LABEL_CLS = 
  'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';

// ─── Standard Code 128 Pattern Table (107 ISO/IEC 15417 Symbols) ───────────
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

// ─── Generate Real PNG Barcode Data URL using Canvas ─────────────────────────
// Using Canvas to DataURL renders an HTML <img> element which browser print
// engines treat as persistent foreground graphics, never stripped even when
// "Background graphics" is disabled by the user.
function generateBarcodeDataUrl(text, height = 64) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const width = 340;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Solid white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const cleanText = (text || '12345678').substring(0, 30);
  let pattern = CODE128_PATTERNS[104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < cleanText.length; i++) {
    const code = cleanText.charCodeAt(i) - 32;
    const validCode = code >= 0 && code <= 95 ? code : 0;
    pattern += CODE128_PATTERNS[validCode];
    checksum += validCode * (i + 1);
  }

  const checkSymbol = checksum % 103;
  pattern += CODE128_PATTERNS[checkSymbol];
  pattern += CODE128_PATTERNS[106]; // Stop Code
  pattern += '2'; // Termination bar

  let totalModules = 0;
  for (let i = 0; i < pattern.length; i++) {
    totalModules += parseInt(pattern[i], 10);
  }

  const quietZone = 8;
  const grandTotal = totalModules + quietZone * 2;
  const moduleW = width / grandTotal;

  // Draw high-contrast solid black bars (#000000)
  ctx.fillStyle = '#000000';
  let curX = quietZone * moduleW;
  let isBar = true;

  for (let i = 0; i < pattern.length; i++) {
    const w = parseInt(pattern[i], 10) * moduleW;
    if (isBar) {
      ctx.fillRect(Math.round(curX), 0, Math.ceil(w), height);
    }
    curX += w;
    isBar = !isBar;
  }

  return canvas.toDataURL('image/png');
}

// In-memory barcode data URL cache for fast rendering
const barcodeCache = new Map();

function BarcodeImage({ code, className = '' }) {
  const [dataUrl, setDataUrl] = React.useState(() => {
    return barcodeCache.get(code) || '';
  });

  React.useEffect(() => {
    if (!code) return;
    if (barcodeCache.has(code)) {
      setDataUrl(barcodeCache.get(code));
    } else {
      const url = generateBarcodeDataUrl(code, 64);
      barcodeCache.set(code, url);
      setDataUrl(url);
    }
  }, [code]);

  if (!dataUrl) {
    return <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />;
  }

  return (
    <img
      src={dataUrl}
      alt={code}
      className={`print-barcode-img select-none pointer-events-none object-contain ${className}`}
      style={{
        imageRendering: 'pixelated',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    />
  );
}

// ─── Toggle Switch Component ────────────────────────────────────────────────
function ToggleSwitch({ label, checked, onChange, description }) {
  return (
    <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors">
      <div className="min-w-0">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
          {label}
        </span>
        {description && (
          <span className="text-[10px] text-slate-400 block truncate">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

// ─── Error Boundary ─────────────────────────────────────────────────────────
class BarcodeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Barcode Print Utility caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-center text-rose-700 dark:text-rose-300 my-6">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-rose-500" />
          <h3 className="text-base font-bold mb-1">Barcode Module Encountered an Issue</h3>
          <p className="text-xs text-rose-600 dark:text-rose-400 mb-4 max-w-md mx-auto">
            {this.state.error?.message || 'A data parsing error occurred while rendering barcode labels.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Reset Module View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Normalization Helpers ──────────────────────────────────────────────────
const normalizeProduct = (p) => {
  if (!p || typeof p !== 'object') return null;
  const stockArray = p.rawStock || p.stock || p.warehouse_stock || [];
  const unitStr = typeof p.unit === 'string'
    ? p.unit
    : (p.unit?.name || p.unit?.code || p.unitOfSale?.name || 'Pcs');
  const catStr = typeof p.category === 'string'
    ? p.category
    : (p.category?.name || p.categoryRef?.name || 'Finished Goods');

  return {
    id: p.id || '',
    title: p.name || p.title || 'Unnamed Product',
    name: p.name || p.title || 'Unnamed Product',
    sku: p.sku || p.code || 'N/A',
    barcode: p.barcode || p.sku || p.code || '12345678',
    sellingPrice: Number(p.sellingPrice !== undefined ? p.sellingPrice : (p.costPrice || 0)),
    costPrice: Number(p.costPrice || 0),
    category: catStr,
    image: p.imageUrl || p.image || '',
    unit: unitStr,
    stock: Array.isArray(stockArray) ? stockArray : [],
    rawStock: Array.isArray(stockArray) ? stockArray : [],
    warehouse_stock: Array.isArray(stockArray) ? stockArray : [],
    type: 'Product',
  };
};

const normalizeResource = (r) => {
  if (!r || typeof r !== 'object') return null;
  const stockArray = r.rawStock || r.stock || r.warehouse_stock || [];
  const unitStr = typeof r.unit === 'string'
    ? r.unit
    : (r.unitOfMeasure || r.unit?.name || 'Units');
  const catStr = typeof r.category === 'string'
    ? r.category
    : (r.category?.name || 'Raw Materials');

  return {
    id: r.id || '',
    title: r.name || r.title || 'Unnamed Resource',
    name: r.name || r.title || 'Unnamed Resource',
    sku: r.code || r.sku || 'N/A',
    barcode: r.barcode || r.code || r.sku || '12345678',
    sellingPrice: Number(r.costPrice || 0),
    costPrice: Number(r.costPrice || 0),
    category: catStr,
    image: r.imageUrl || r.image || '',
    unit: unitStr,
    stock: Array.isArray(stockArray) ? stockArray : [],
    rawStock: Array.isArray(stockArray) ? stockArray : [],
    warehouse_stock: Array.isArray(stockArray) ? stockArray : [],
    type: 'Resource',
  };
};

// ─── Inner BarcodePrintUtility Component ─────────────────────────────────────
function BarcodePrintUtilityInner({ products: propProducts, onClose }) {
  const { formatCurrency, activeWarehouseId } = useApp();

  const [catalog, setCatalog] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Selected warehouse / deposit
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(activeWarehouseId || '');

  // Fetch live products, resources, and warehouses from backend
  useEffect(() => {
    let isMounted = true;
    const fetchCatalogData = async () => {
      try {
        setIsLoading(true);
        const [prodRes, resRes, whRes] = await Promise.all([
          api.get('/products').catch(err => {
            console.error('Failed to load products for barcodes:', err);
            return { data: { success: false, data: [] } };
          }),
          api.get('/resources').catch(err => {
            console.error('Failed to load resources for barcodes:', err);
            return { data: { success: false, data: [] } };
          }),
          api.get('/warehouses').catch(err => {
            console.error('Failed to load warehouses for barcodes:', err);
            return { data: { success: false, data: [] } };
          }),
        ]);

        if (!isMounted) return;

        const rawProds = Array.isArray(prodRes?.data?.data)
          ? prodRes.data.data
          : Array.isArray(prodRes?.data)
          ? prodRes.data
          : [];

        const prods = rawProds.map(normalizeProduct).filter(Boolean);

        const rawRes = Array.isArray(resRes?.data?.data)
          ? resRes.data.data
          : Array.isArray(resRes?.data)
          ? resRes.data
          : [];

        const rawMaterials = rawRes.map(normalizeResource).filter(Boolean);

        const combined = [...prods, ...rawMaterials];
        setCatalog(combined);

        const rawWh = Array.isArray(whRes?.data?.data)
          ? whRes.data.data
          : Array.isArray(whRes?.data)
          ? whRes.data
          : [];

        if (rawWh.length > 0) {
          setWarehouses(rawWh);
          setSelectedWarehouseId(prev => prev || rawWh[0]?.id || '');
        }
      } catch (err) {
        console.error('Failed to fetch catalog for barcodes:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCatalogData();
    return () => { isMounted = false; };
  }, []);

  const activeCatalog = (Array.isArray(propProducts) && propProducts.length > 0)
    ? propProducts.map(normalizeProduct).filter(Boolean)
    : (Array.isArray(catalog) ? catalog : []);

  // Product Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef(null);

  // Staging Area: array of { product, quantity }
  const [stagedItems, setStagedItems] = useState(() => {
    if (Array.isArray(propProducts) && propProducts.length > 0) {
      const p1 = normalizeProduct(propProducts[0]);
      const p2 = propProducts[1] ? normalizeProduct(propProducts[1]) : null;
      return [
        ...(p1 ? [{ product: p1, quantity: 4 }] : []),
        ...(p2 ? [{ product: p2, quantity: 2 }] : [])
      ];
    }
    return [];
  });

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && Array.isArray(activeCatalog) && activeCatalog.length > 0 && stagedItems.length === 0) {
      initializedRef.current = true;
      const p1 = activeCatalog[0];
      const p2 = activeCatalog[1];
      setStagedItems([
        ...(p1 ? [{ product: p1, quantity: 4 }] : []),
        ...(p2 ? [{ product: p2, quantity: 2 }] : [])
      ]);
    }
  }, [activeCatalog, stagedItems.length]);

  // Settings Toggles & Options
  const [paperSize, setPaperSize] = useState('50x25'); // '40x30' | '50x25' | '60x40' | 'continuous' | 'a4-30'
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBorder, setShowBorder] = useState(true);
  const [showBarcodeDigits, setShowBarcodeDigits] = useState(true);
  const [priceFontSize, setPriceFontSize] = useState(12); // in px
  const [storeNameText, setStoreNameText] = useState('Identity IMS');

  // Close search popup on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products for search dropdown
  const searchResults = (activeCatalog || []).filter(p => {
    if (!p) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return false;
    const titleStr = String(p.title || p.name || '').toLowerCase();
    const skuStr = String(p.sku || '').toLowerCase();
    const barcodeStr = String(p.barcode || '');
    const catStr = String(p.category || '').toLowerCase();
    return (
      titleStr.includes(q) ||
      skuStr.includes(q) ||
      barcodeStr.includes(q) ||
      catStr.includes(q)
    );
  }).slice(0, 8);

  // Stock lookup for product/resource in selected warehouse
  const getStock = (productOrId) => {
    if (!productOrId) return 0;
    const item = typeof productOrId === 'object'
      ? productOrId
      : (activeCatalog || []).find(c => c?.id === productOrId);

    if (!item) return 0;

    const stockArray = item.rawStock || item.stock || item.warehouse_stock || [];
    if (!Array.isArray(stockArray)) return 0;

    if (!selectedWarehouseId || selectedWarehouseId === 'all') {
      return stockArray.reduce((sum, s) => sum + (Number(s?.quantity) || 0), 0);
    }
    const record = stockArray.find(s => s?.warehouseId === selectedWarehouseId);
    return record ? (Number(record?.quantity) || 0) : 0;
  };

  // Add product to staging area
  const handleAddToStaging = (product) => {
    if (!product || !product.id) return;
    setStagedItems(prev => {
      const items = Array.isArray(prev) ? prev : [];
      const existingIdx = items.findIndex(item => item?.product?.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...items];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: (Number(updated[existingIdx]?.quantity) || 0) + 1
        };
        return updated;
      }
      return [...items, { product, quantity: 2 }];
    });
    setSearchQuery('');
    setShowSearchResults(false);
  };

  // Adjust quantity in staging
  const handleUpdateQuantity = (productId, newQty) => {
    const qty = Math.max(1, Math.min(500, parseInt(newQty) || 1));
    setStagedItems(prev =>
      (Array.isArray(prev) ? prev : []).map(item =>
        item?.product?.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  // Remove item from staging
  const handleRemoveFromStaging = (productId) => {
    setStagedItems(prev => (Array.isArray(prev) ? prev : []).filter(item => item?.product?.id !== productId));
  };

  const handleAddAllProducts = () => {
    setStagedItems((activeCatalog || []).map(p => ({ product: p, quantity: 2 })));
  };

  const handleClearStaging = () => {
    setStagedItems([]);
  };

  // Generate flat array of labels for printing
  const labelsToRender = [];
  (Array.isArray(stagedItems) ? stagedItems : []).forEach(item => {
    if (!item?.product) return;
    const qty = Math.max(0, parseInt(item.quantity) || 0);
    for (let i = 0; i < qty; i++) {
      labelsToRender.push(item.product);
    }
  });

  const handlePrint = () => {
    window.print();
  };

  // Label card size styles
  const getLabelDimensions = () => {
    switch (paperSize) {
      case '40x30':
        return { minHeight: '120px', width: '100%', barcodeHeight: 'h-8' };
      case '60x40':
        return { minHeight: '160px', width: '100%', barcodeHeight: 'h-12' };
      case 'continuous':
        return { minHeight: '130px', width: '100%', barcodeHeight: 'h-10' };
      case 'a4-30':
        return { minHeight: '110px', width: '100%', barcodeHeight: 'h-8' };
      case '50x25':
      default:
        return { minHeight: '115px', width: '100%', barcodeHeight: 'h-9' };
    }
  };

  const labelDims = getLabelDimensions();

  const content = (
    <div className="space-y-6">
      {/* ── Injected Print CSS to guarantee barcodes and borders render on paper ── */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print, header, aside, nav, button {
            display: none !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .print-label-card {
            background-color: #ffffff !important;
            color: #000000 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
          }
          .print-barcode-img {
            display: block !important;
            visibility: visible !important;
            max-width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>Print Barcodes &amp; Shelf Labels</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {labelsToRender.length} Labels Queued
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Stage inventory items, customize layout attributes, and print high-density thermal stickers.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs"
            >
              Close
            </button>
          )}
          <button
            onClick={handlePrint}
            disabled={labelsToRender.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            Print ({labelsToRender.length} Labels)
          </button>
        </div>
      </div>

      {/* ── Section 1: Inputs (Warehouse Dropdown + Product Search) ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs no-print">
        {/* Warehouse / Deposit Dropdown */}
        <div className="md:col-span-4">
          <label className={LABEL_CLS}>Warehouse / Deposit</label>
          <div className="relative">
            <WarehouseIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={selectedWarehouseId}
              onChange={e => setSelectedWarehouseId(e.target.value)}
              className={`${INPUT_CLS} pl-9 font-medium`}
            >
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} {wh.code ? `(${wh.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Stock quantities reflect available inventory in this deposit node.
          </span>
        </div>

        {/* Product Search Bar */}
        <div className="md:col-span-8 relative" ref={searchContainerRef}>
          <label className={LABEL_CLS}>Search &amp; Add Products</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder="Search product by title, SKU or scan barcode to add..."
              className={`${INPUT_CLS} pl-9 pr-8`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown Typeahead Results */}
          {showSearchResults && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-72 overflow-y-auto z-40 divide-y divide-slate-100 dark:divide-slate-800">
              {(searchResults || []).map(prod => {
                if (!prod) return null;
                const stock = getStock(prod.id);
                const pTitle = String(prod.title || prod.name || 'Unnamed Product');
                const pSku = String(prod.sku || 'N/A');
                const pBarcode = String(prod.barcode || pSku || '');
                const pType = String(prod.type || 'Product');
                const pPrice = Number(prod.sellingPrice) || 0;

                return (
                  <button
                    key={prod.id || Math.random()}
                    type="button"
                    onClick={() => handleAddToStaging(prod)}
                    className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {prod.image ? (
                        <img
                          src={prod.image}
                          alt={pTitle}
                          className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                          {pTitle.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                          <span>{pTitle}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {pType}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          SKU: {pSku} · Barcode: {pBarcode}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {formatCurrency(pPrice)}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {stock} in stock
                      </div>
                    </div>
                  </button>
                );
              })}

              {searchResults.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs">
                  No matching products found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Table (Staging Area) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden no-print">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Staging Area (Selected Products)
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {stagedItems.length} Products ({labelsToRender.length} Total Copies)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddAllProducts}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              Add All Catalog
            </button>
            <button
              type="button"
              onClick={handleClearStaging}
              disabled={stagedItems.length === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 text-xs font-semibold transition-colors disabled:opacity-40"
            >
              Clear Staging
            </button>
          </div>
        </div>

        {stagedItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500">
            <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              No products staged for printing
            </p>
            <p className="text-[11px] mt-0.5">
              Search above or click "Add All Catalog" to populate this staging list.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">SKU &amp; Barcode</th>
                  <th className="py-3 px-4">Deposit Stock</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4 text-center">Labels to Print</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {(stagedItems || []).map(({ product, quantity }) => {
                  if (!product) return null;
                  const stock = getStock(product.id);
                  const pTitle = String(product.title || product.name || 'Unnamed Product');
                  const pCategory = String(product.category || 'General');
                  const pType = product.type ? String(product.type) : '';
                  const pSku = String(product.sku || 'N/A');
                  const pBarcode = String(product.barcode || pSku || '');
                  const pUnit = typeof product.unit === 'string' ? product.unit : (product.unit?.name || 'Pcs');
                  const pPrice = Number(product.sellingPrice) || 0;

                  return (
                    <tr
                      key={product.id || Math.random()}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={pTitle}
                              className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                              {pTitle.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white line-clamp-1 block text-xs">
                              {pTitle}
                            </span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                              {pCategory} {pType ? `(${pType})` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {pSku}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {pBarcode}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <WarehouseIcon className="w-3 h-3 text-slate-400" />
                          {stock} {pUnit}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(pPrice)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(product.id, quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={quantity}
                            onChange={e => handleUpdateQuantity(product.id, e.target.value)}
                            className="w-14 text-center bg-transparent font-bold text-xs text-slate-900 dark:text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(product.id, quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromStaging(product.id)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-colors"
                          title="Remove from staging"
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
        )}
      </div>

      {/* ── Section 3: Settings Toggles & Layout Options ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs no-print space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Label Layout &amp; Content Toggles
          </h3>
        </div>

        {/* Paper Size & Price Font Size row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Paper Size */}
          <div>
            <label className={LABEL_CLS}>Paper / Sticker Format</label>
            <select
              value={paperSize}
              onChange={e => setPaperSize(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="50x25">50mm x 25mm (Standard Shelf Adhesive)</option>
              <option value="40x30">40mm x 30mm (Compact Bin Tag)</option>
              <option value="60x40">60mm x 40mm (Pallet / Large Carton)</option>
              <option value="continuous">Continuous Thermal Roll (1 Column)</option>
              <option value="a4-30">A4 Laser Sheet (3 x 10 - 30 per Sheet)</option>
            </select>
          </div>

          {/* Price Font Size */}
          <div>
            <label className={LABEL_CLS}>Price Font Size ({priceFontSize}px)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="9"
                max="24"
                value={priceFontSize}
                onChange={e => setPriceFontSize(Math.max(9, Math.min(24, parseInt(e.target.value) || 12)))}
                className={INPUT_CLS}
              />
              <span className="text-xs text-slate-400 font-mono">px</span>
            </div>
          </div>

          {/* Custom Store Name Input */}
          {showStoreName && (
            <div>
              <label className={LABEL_CLS}>Store Name Header</label>
              <input
                type="text"
                value={storeNameText}
                onChange={e => setStoreNameText(e.target.value)}
                placeholder="e.g. Identity IMS"
                className={INPUT_CLS}
              />
            </div>
          )}
        </div>

        {/* Settings Toggle Switches Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          <ToggleSwitch
            label="Show Store Name"
            description="Header banner on sticker"
            checked={showStoreName}
            onChange={setShowStoreName}
          />
          <ToggleSwitch
            label="Show Product Name"
            description="Product title line"
            checked={showProductName}
            onChange={setShowProductName}
          />
          <ToggleSwitch
            label="Show Price"
            description="Formatted price display"
            checked={showPrice}
            onChange={setShowPrice}
          />
          <ToggleSwitch
            label="Show Border"
            description="Thin outline cut line"
            checked={showBorder}
            onChange={setShowBorder}
          />
          <ToggleSwitch
            label="Show Digits"
            description="Barcode numeric code"
            checked={showBarcodeDigits}
            onChange={setShowBarcodeDigits}
          />
        </div>
      </div>

      {/* ── Section 4: Live Label Preview ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4 no-print">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Live Printable Preview ({labelsToRender.length} Labels)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Dimension: {paperSize === 'a4-30' ? 'A4 Grid' : paperSize}
          </span>
        </div>

        {/* Label Cards Container */}
        <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl overflow-y-auto max-h-[520px]">
          <div
            className={`print-area ${
              paperSize === 'continuous'
                ? 'grid grid-cols-1 sm:grid-cols-2 max-w-md mx-auto gap-3'
                : paperSize === 'a4-30'
                ? 'grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-4xl mx-auto'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5'
            }`}
          >
            {(labelsToRender || []).map((prod, idx) => {
              if (!prod) return null;
              const pTitle = String(prod.title || prod.name || 'Unnamed Product');
              const pSku = String(prod.sku || 'N/A');
              const pBarcode = String(prod.barcode || pSku || '12345678');
              const pPrice = Number(prod.sellingPrice) || 0;

              return (
                <div
                  key={idx}
                  className={`print-label-card bg-white text-slate-950 rounded-lg p-2.5 flex flex-col justify-between text-center select-none shadow-2xs font-sans transition-all ${
                    showBorder ? 'border border-slate-400' : 'border border-transparent'
                  }`}
                  style={{
                    minHeight: labelDims.minHeight,
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: showBorder ? '1px solid #94a3b8' : '1px solid transparent'
                  }}
                >
                  {/* Store Name Header */}
                  {showStoreName && (
                    <div className="text-[9px] font-black tracking-wider uppercase text-slate-800 pb-0.5 border-b border-slate-200">
                      {storeNameText || 'Store'}
                    </div>
                  )}

                  {/* Product Title & SKU */}
                  <div className="my-0.5">
                    {showProductName && (
                      <div className="text-[10px] font-bold leading-tight line-clamp-2 uppercase text-slate-900">
                        {pTitle}
                      </div>
                    )}
                    <div className="text-[8px] text-slate-500 font-mono mt-0.5">
                      SKU: {pSku}
                    </div>
                  </div>

                  {/* Real High-Contrast Barcode Image */}
                  <div className="my-1 w-full flex flex-col items-center justify-center">
                    <div className={`w-full ${labelDims.barcodeHeight} flex items-center justify-center overflow-hidden`}>
                      <BarcodeImage
                        code={pBarcode}
                        className="h-full max-h-12 w-auto max-w-full"
                      />
                    </div>
                    {showBarcodeDigits && (
                      <div className="text-[9px] font-mono font-bold tracking-widest mt-0.5 text-black">
                        {pBarcode}
                      </div>
                    )}
                  </div>

                  {/* Product Price with dynamic font size */}
                  {showPrice && (
                    <div 
                      className="font-black text-slate-950 border-t border-slate-200 w-full pt-1"
                      style={{ fontSize: `${priceFontSize}px`, lineHeight: 1.1 }}
                    >
                      {formatCurrency(pPrice)}
                    </div>
                  )}
                </div>
              );
            })}

            {labelsToRender.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                Stage products in the table above to generate live sticker previews.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Modal mode when onClose is passed
  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  // Standalone full-page view
  return content;
}

export default function BarcodePrintUtility(props) {
  return (
    <BarcodeErrorBoundary>
      <BarcodePrintUtilityInner {...props} />
    </BarcodeErrorBoundary>
  );
}
