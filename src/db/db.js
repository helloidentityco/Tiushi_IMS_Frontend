import Dexie from 'dexie';

export const db = new Dexie('InfyPosEnterpriseDB');

// Define database schema — v1 baseline (kept for smooth migration path)
db.version(1).stores({
  products: 'id, sku, barcode, title, category, minStockAlert',
  warehouses: 'id, code, name, type, isDefault',
  stockLevels: 'id, [productId+warehouseId], productId, warehouseId',
  suppliers: 'id, name, company, email, phone',
  purchaseOrders: 'id, poNumber, supplierId, status, date',
  salesOrders: 'id, orderNumber, cashier, customerName, date, paymentStatus',
  warehouseTransfers: 'id, transferNumber, fromWarehouseId, toWarehouseId, status, date',
  cycleCounts: 'id, countNumber, warehouseId, status, date',
  goodsReceivedNotes: 'id, grnNumber, poId, supplierId, date',
  salesReturns: 'id, returnNumber, originalOrderNumber, date',
  purchaseReturns: 'id, returnNumber, poId, supplierId, date',
  auditLogs: 'id, timestamp, userId, userName, action, module, details',
  syncQueue: 'id, timestamp, action, entity, payload, status',
  settings: 'id, key, value'
});

// v2 — Enterprise product catalog: brands, categories, units, variants + expanded product fields
db.version(2).stores({
  products: 'id, sku, barcode, title, category, categoryId, brandId, minStockAlert, productType, barcodeSymbology',
  warehouses: 'id, code, name, type, isDefault',
  stockLevels: 'id, [productId+warehouseId], productId, warehouseId',
  suppliers: 'id, name, company, email, phone',
  purchaseOrders: 'id, poNumber, supplierId, status, date',
  salesOrders: 'id, orderNumber, cashier, customerName, date, paymentStatus',
  warehouseTransfers: 'id, transferNumber, fromWarehouseId, toWarehouseId, status, date',
  cycleCounts: 'id, countNumber, warehouseId, status, date',
  goodsReceivedNotes: 'id, grnNumber, poId, supplierId, date',
  salesReturns: 'id, returnNumber, originalOrderNumber, date',
  purchaseReturns: 'id, returnNumber, poId, supplierId, date',
  auditLogs: 'id, timestamp, userId, userName, action, module, details',
  syncQueue: 'id, timestamp, action, entity, payload, status',
  settings: 'id, key, value',
  categories: 'id, name',
  brands: 'id, name',
  units: 'id, name, abbreviation',
  variants: 'id, productId, name, value'
});

// v3 — Expanded Sales Orders schema: advanced order attributes & modifiers
db.version(3).stores({
  salesOrders: 'id, orderNumber, cashier, customerName, date, orderDate, warehouseId, orderState, paymentStatus, grandTotal'
});

// v4 — Card transaction & auth reference support
db.version(4).stores({
  salesOrders: 'id, orderNumber, cashier, customerName, date, orderDate, warehouseId, orderState, paymentStatus, grandTotal, paymentMethod, authReference'
});

// v5 — Inventory separation: Products vs Resources (itemType)
db.version(5).stores({
  products: 'id, sku, barcode, title, category, categoryId, brandId, minStockAlert, productType, barcodeSymbology, itemType'
}).upgrade(async tx => {
  await tx.table('products').toCollection().modify(item => {
    if (!item.itemType) {
      item.itemType = 'product';
    }
  });
});

// v6 — Robust Purchase Orders & Commercial Invoice Management
db.version(6).stores({
  purchaseOrders: 'id, poNumber, invoiceNumber, supplierId, warehouseId, orderDate, dueDate, status, grandTotal'
}).upgrade(async tx => {
  await tx.table('purchaseOrders').toCollection().modify(po => {
    if (!po.invoiceNumber) {
      po.invoiceNumber = po.poNumber ? `INV-${po.poNumber}` : `INV-PO-${po.id || Date.now()}`;
    }
    if (!po.orderDate) {
      po.orderDate = po.date || new Date().toISOString().split('T')[0];
    }
    if (!po.dueDate) {
      po.dueDate = po.expectedDate || po.orderDate;
    }
    const total = Number(po.grandTotal !== undefined ? po.grandTotal : (po.totalAmount || 0));
    if (po.subtotal === undefined) po.subtotal = total;
    if (po.discountAmount === undefined) po.discountAmount = 0;
    if (po.taxAmount === undefined) po.taxAmount = 0;
    if (po.shippingCost === undefined) po.shippingCost = 0;
    if (po.grandTotal === undefined) po.grandTotal = total;
    if (!Array.isArray(po.items)) po.items = [];
    if (!po.pdfAttachment) po.pdfAttachment = null;
  });
});

// v7 — Operating Bills & Expenses module
db.version(7).stores({
  expenses: 'expenseId, id, warehouseId, category, billerName, referenceNumber, issueDate, dueDate, paymentDate, totalAmount, amountPaid, remainingBalance, paymentStatus, paymentMethod, receiptAttachment'
}).upgrade(async tx => {
  try {
    await tx.table('expenses').toCollection().modify(exp => {
      if (!exp.expenseId && exp.id) exp.expenseId = exp.id;
      if (!exp.paymentStatus) exp.paymentStatus = 'Unpaid';
      if (exp.remainingBalance === undefined) {
        exp.remainingBalance = (exp.totalAmount || 0) - (exp.amountPaid || 0);
      }
    });
  } catch (err) {
    console.warn('Expenses v7 upgrade notice:', err);
  }
});

// v8 — Enterprise Returns schema: restockWarehouseId, baseRefundAmount, restockFeePercentage, finalRefundAmount, customerContact, hasInvoice
db.version(8).stores({
  returns: 'id, returnNumber, originalOrderNumber, restockWarehouseId, baseRefundAmount, restockFeePercentage, finalRefundAmount, customerContact, hasInvoice, date',
  salesReturns: 'id, returnNumber, originalOrderNumber, restockWarehouseId, baseRefundAmount, restockFeePercentage, finalRefundAmount, customerContact, hasInvoice, date'
}).upgrade(async tx => {
  try {
    await tx.table('salesReturns').toCollection().modify(ret => {
      if (ret.hasInvoice === undefined) {
        ret.hasInvoice = Boolean(ret.originalOrderNumber && ret.originalOrderNumber !== 'DIRECT-RETURN' && ret.originalOrderNumber !== 'N/A');
      }
      if (!ret.restockWarehouseId) ret.restockWarehouseId = ret.warehouseId || 'wh-3';
      if (ret.baseRefundAmount === undefined) ret.baseRefundAmount = ret.refundAmount || 0;
      if (ret.restockFeePercentage === undefined) ret.restockFeePercentage = 0;
      if (ret.finalRefundAmount === undefined) ret.finalRefundAmount = ret.refundAmount || 0;
      if (!ret.customerContact) ret.customerContact = '';
    });
  } catch (err) {
    console.warn('salesReturns v8 upgrade notice:', err);
  }
});

// v9 — Bag & Purse Manufacturing Business Seed & Catalog Reset
db.version(9).stores({
  products: 'id, sku, barcode, title, category, categoryId, brandId, minStockAlert, productType, barcodeSymbology, itemType',
  categories: 'id, name',
  brands: 'id, name',
  units: 'id, name, abbreviation',
  variants: 'id, productId, name, value',
  warehouses: 'id, code, name, type, isDefault',
  suppliers: 'id, name, company, email, phone',
  stockLevels: 'id, [productId+warehouseId], productId, warehouseId',
  purchaseOrders: 'id, poNumber, invoiceNumber, supplierId, warehouseId, orderDate, dueDate, status, grandTotal',
  salesOrders: 'id, orderNumber, cashier, customerName, date, orderDate, warehouseId, orderState, paymentStatus, grandTotal, paymentMethod, authReference',
  returns: 'id, returnNumber, originalOrderNumber, restockWarehouseId, baseRefundAmount, restockFeePercentage, finalRefundAmount, customerContact, hasInvoice, date',
  salesReturns: 'id, returnNumber, originalOrderNumber, restockWarehouseId, baseRefundAmount, restockFeePercentage, finalRefundAmount, customerContact, hasInvoice, date',
  expenses: 'expenseId, id, warehouseId, category, billerName, referenceNumber, issueDate, dueDate, paymentDate, totalAmount, amountPaid, remainingBalance, paymentStatus, paymentMethod, receiptAttachment'
}).upgrade(async tx => {
  try {
    // 1. Clear old electronics products and resources, inject bag manufacturing catalog
    await tx.table('products').clear();
    await tx.table('products').bulkAdd([...initialProducts, ...initialResources]);

    // 2. Clear old electronics categories and brands
    await tx.table('categories').clear();
    await tx.table('categories').bulkAdd(initialCategories);

    await tx.table('brands').clear();
    await tx.table('brands').bulkAdd(initialBrands);

    await tx.table('variants').clear();
    await tx.table('variants').bulkAdd(initialVariants);

    // 3. Reset suppliers to bag material tanneries, hardware, and fabric vendors
    await tx.table('suppliers').clear();
    await tx.table('suppliers').bulkAdd(initialSuppliers);

    // 4. Reset stock levels for the bag manufacturing catalog
    await tx.table('stockLevels').clear();
    await tx.table('stockLevels').bulkAdd(initialStock);

    // 5. Reset commercial purchase orders and retail sales orders
    await tx.table('purchaseOrders').clear();
    await tx.table('purchaseOrders').bulkAdd(initialPurchaseOrders);

    await tx.table('salesOrders').clear();
    await tx.table('salesOrders').bulkAdd(initialSalesOrders);

    // 6. Reset warehouse transfers & returns
    await tx.table('warehouseTransfers').clear();
    await tx.table('warehouseTransfers').bulkAdd(initialTransfers);

    try {
      await tx.table('salesReturns').clear();
      await tx.table('salesReturns').bulkAdd(initialReturns);
      if (tx.table('returns')) {
        await tx.table('returns').clear();
        await tx.table('returns').bulkAdd(initialReturns);
      }
    } catch (_) {}
  } catch (err) {
    console.warn('v9 bag manufacturing upgrade notice:', err);
  }
});

// v10 — Purchase Orders Payment Tracking: amountPaid, balanceDue, paymentHistory
db.version(10).stores({
  purchaseOrders: 'id, poNumber, invoiceNumber, supplierId, warehouseId, orderDate, dueDate, status, grandTotal, amountPaid, balanceDue'
}).upgrade(async tx => {
  try {
    await tx.table('purchaseOrders').toCollection().modify(po => {
      const grandTotal = Number(po.grandTotal !== undefined ? po.grandTotal : (po.totalAmount || 0));
      const statusLower = (po.status || '').trim().toLowerCase();
      const isCompleted = statusLower === 'completed' || statusLower === 'paid';

      if (po.amountPaid === undefined) {
        po.amountPaid = isCompleted ? grandTotal : 0;
      }
      if (po.balanceDue === undefined) {
        po.balanceDue = isCompleted ? 0 : Math.max(0, grandTotal - (po.amountPaid || 0));
      }
      if (!Array.isArray(po.paymentHistory)) {
        po.paymentHistory = po.amountPaid > 0 ? [
          {
            id: `pay-${po.id || Date.now()}-1`,
            amount: po.amountPaid,
            paymentMethod: 'Bank Transfer',
            date: (po.orderDate || po.date || new Date().toISOString().split('T')[0]),
            notes: 'Initial recorded settlement'
          }
        ] : [];
      }
    });
  } catch (err) {
    console.warn('purchaseOrders v10 upgrade notice:', err);
  }
});

// v11 — Purchase Orders Receiving Tracking: receivedQty on line items, status: Issued | Partially Received | Completed
db.version(11).stores({
  purchaseOrders: 'id, poNumber, invoiceNumber, supplierId, warehouseId, orderDate, dueDate, status, grandTotal, amountPaid, balanceDue'
}).upgrade(async tx => {
  try {
    await tx.table('purchaseOrders').toCollection().modify(po => {
      const isCompleted = (po.status || '').trim().toLowerCase() === 'completed';
      if (Array.isArray(po.items)) {
        po.items = po.items.map(item => ({
          ...item,
          receivedQty: item.receivedQty !== undefined ? Number(item.receivedQty) : (isCompleted ? Number(item.quantity || 0) : 0)
        }));
      }
    });
  } catch (err) {
    console.warn('purchaseOrders v11 upgrade notice:', err);
  }
});

// v12 — Dynamic User Management & Password Modification
db.version(12).stores({
  users: 'id, email, password, role, status'
});

export const initialWarehouses = [
  {
    id: 'wh-1',
    code: 'WH-CENTRAL',
    name: 'Central Manufacturing & Distribution Hub',
    type: 'Primary',
    address: '100 Logistics Blvd, North Industrial Port',
    capacity: 25000,
    manager: 'Sarah Jenkins',
    contact: '+1 555-019-2831',
    isDefault: true,
    aisles: ['Aisle A (Raw Materials)', 'Aisle B (Hardware & Metal)', 'Aisle C (Fabrics & Linings)'],
    racks: ['Rack 1', 'Rack 2', 'Rack 3', 'Rack 4'],
    shelves: ['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 4']
  },
  {
    id: 'wh-2',
    code: 'WH-WEST',
    name: 'West Coast Regional Depot',
    type: 'Regional',
    address: '450 Harbor Way, Bay Area Logistics Zone',
    capacity: 12000,
    manager: 'Carlos Mendez',
    contact: '+1 555-019-8822',
    isDefault: false,
    aisles: ['Aisle W1', 'Aisle W2', 'Aisle W3'],
    racks: ['Rack A', 'Rack B', 'Rack C'],
    shelves: ['Shelf 1', 'Shelf 2']
  },
  {
    id: 'wh-3',
    code: 'WH-RETAIL-01',
    name: 'Downtown Flagship Boutique Backstore',
    type: 'Retail',
    address: '742 Broadway Ave, Retail District Suite 10',
    capacity: 4500,
    manager: 'Elena Rostova',
    contact: '+1 555-019-4411',
    isDefault: false,
    aisles: ['Aisle Front-Stock', 'Aisle High-Value Secure'],
    racks: ['Rack 1', 'Rack 2'],
    shelves: ['Tier A', 'Tier B', 'Tier C']
  }
];

export const initialSuppliers = [
  {
    id: 'sup-1',
    name: 'Marco Bellini',
    company: 'Tuscany Heritage Tannery Ltd.',
    email: 'orders@tuscanyleather.it',
    phone: '+39 055 849 2100',
    taxId: 'IT-VAT-994821',
    address: 'Florence, Italy - Leather Artisan Zone',
    leadTimeDays: 7,
    payableBalance: 4500.00
  },
  {
    id: 'sup-2',
    name: 'David O\'Connor',
    company: 'Apex Precision Hardware & Fasteners',
    email: 'orders@apexhardware.com',
    phone: '+1 800-449-3320',
    taxId: 'US-IL-338291',
    address: 'Chicago, IL - Industrial Parkway',
    leadTimeDays: 3,
    payableBalance: 1250.00
  },
  {
    id: 'sup-3',
    name: 'Kenji Takahashi',
    company: 'Kyoto Textile & Silk Mills',
    email: 'contact@kyototextiles.jp',
    phone: '+81 75 987 6543',
    taxId: 'JP-CORP-883719',
    address: 'Kyoto, Japan - Nishijin District',
    leadTimeDays: 8,
    payableBalance: 850.00
  },
  {
    id: 'sup-4',
    name: 'Sarah Jenkins',
    company: 'ProStitch Industrial Thread & Notions',
    email: 'supplies@prostitch-thread.com',
    phone: '+1 888-293-8472',
    taxId: 'US-NC-449102',
    address: 'Charlotte, NC - Textile Corridor',
    leadTimeDays: 2,
    payableBalance: 320.00
  }
];

export const initialProducts = [
  {
    id: 'prod-1',
    sku: 'PRD-TOT-01',
    barcode: '7611984501234',
    title: 'Classic Leather Tote Bag',
    category: 'Handbags',
    categoryId: 'cat-1',
    brandId: 'brand-1',
    unit: 'Pcs',
    costPrice: 65.00,
    sellingPrice: 150.00,
    taxPercent: 8,
    minStockAlert: 15,
    supplierId: 'sup-1',
    binLocation: 'Aisle Front-Stock - Rack 1 - Shelf 1 - Bin TOT-01',
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=300&auto=format&fit=crop&q=80',
    description: 'Spacious everyday tote handcrafted with full-grain leather, dual shoulder handles, and solid brass hardware.'
  },
  {
    id: 'prod-2',
    sku: 'PRD-CLU-01',
    barcode: '7611984502345',
    title: 'Elegant Evening Clutch',
    category: 'Purses',
    categoryId: 'cat-2',
    brandId: 'brand-2',
    unit: 'Pcs',
    costPrice: 35.00,
    sellingPrice: 85.00,
    taxPercent: 8,
    minStockAlert: 10,
    supplierId: 'sup-1',
    binLocation: 'Aisle Front-Stock - Rack 1 - Shelf 2 - Bin CLU-01',
    image: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=300&auto=format&fit=crop&q=80',
    description: 'Sleek luxury clutch purse featuring magnetic snap closure, gold-plated accents, and detachable chain strap.'
  },
  {
    id: 'prod-3',
    sku: 'PRD-CRB-01',
    barcode: '7611984503456',
    title: 'Minimalist Crossbody Sling Bag',
    category: 'Handbags',
    categoryId: 'cat-1',
    brandId: 'brand-1',
    unit: 'Pcs',
    costPrice: 42.00,
    sellingPrice: 110.00,
    taxPercent: 8,
    minStockAlert: 12,
    supplierId: 'sup-1',
    binLocation: 'Aisle High-Value Secure - Rack 1 - Tier A - Bin CRB-01',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&auto=format&fit=crop&q=80',
    description: 'Compact versatile sling bag with adjustable shoulder strap, quick-access exterior pocket, and nylon lining.'
  },
  {
    id: 'prod-4',
    sku: 'PRD-DUF-01',
    barcode: '7611984504567',
    title: 'Luxury Travel Duffel Bag',
    category: 'Travel Bags',
    categoryId: 'cat-3',
    brandId: 'brand-3',
    unit: 'Pcs',
    costPrice: 120.00,
    sellingPrice: 299.00,
    taxPercent: 10,
    minStockAlert: 8,
    supplierId: 'sup-1',
    binLocation: 'Aisle Dry - Rack 2 - Shelf 1 - Bin DUF-01',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&auto=format&fit=crop&q=80',
    description: 'Heavy-duty weekender travel duffel bag with reinforced leather base, padded carry handle, and brass zippers.'
  }
].map(p => ({ itemType: 'product', ...p }));

export const initialResources = [
  {
    id: 'res-1',
    sku: 'RES-LTH-01',
    barcode: '7611984590011',
    title: 'Premium Full-Grain Leather Hide',
    category: 'Raw Leather',
    categoryId: 'cat-4',
    unit: 'SqFt',
    costPrice: 45.00,
    sellingPrice: 0,
    taxPercent: 8,
    minStockAlert: 50,
    supplierId: 'sup-1',
    binLocation: 'Aisle A (Raw Materials) - Rack 1 - Shelf 1 - Bin LTH-01',
    itemType: 'resource',
    image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=300&auto=format&fit=crop&q=80',
    description: 'Vegetable-tanned full-grain cowhide leather, 1.8mm-2.0mm thickness, supple natural grain finish.'
  },
  {
    id: 'res-2',
    sku: 'RES-ZIP-01',
    barcode: '7611984590022',
    title: 'Gold-Plated Brass Zippers',
    category: 'Hardware & Metal',
    categoryId: 'cat-5',
    unit: 'Pcs',
    costPrice: 2.50,
    sellingPrice: 0,
    taxPercent: 8,
    minStockAlert: 100,
    supplierId: 'sup-2',
    binLocation: 'Aisle B (Hardware) - Rack 2 - Shelf 1 - Bin ZIP-01',
    itemType: 'resource',
    image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=300&auto=format&fit=crop&q=80',
    description: '#5 heavy-duty polished gold-plated brass teeth zipper with auto-lock puller.'
  },
  {
    id: 'res-3',
    sku: 'RES-LIN-01',
    barcode: '7611984590033',
    title: 'Nylon Inner Lining Fabric',
    category: 'Fabrics',
    categoryId: 'cat-6',
    unit: 'Meter',
    costPrice: 5.00,
    sellingPrice: 0,
    taxPercent: 8,
    minStockAlert: 40,
    supplierId: 'sup-3',
    binLocation: 'Aisle C (Fabrics) - Rack 1 - Shelf 2 - Bin LIN-01',
    itemType: 'resource',
    image: 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=300&auto=format&fit=crop&q=80',
    description: 'Tear-resistant 210D waterproof nylon jacquard lining fabric roll for bag interiors.'
  },
  {
    id: 'res-4',
    sku: 'RES-THR-01',
    barcode: '7611984590044',
    title: 'Heavy-Duty Stitching Thread Spool',
    category: 'Fabrics',
    categoryId: 'cat-6',
    unit: 'Spool',
    costPrice: 1.20,
    sellingPrice: 0,
    taxPercent: 8,
    minStockAlert: 60,
    supplierId: 'sup-4',
    binLocation: 'Aisle C (Fabrics) - Rack 2 - Shelf 1 - Bin THR-01',
    itemType: 'resource',
    image: 'https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?w=300&auto=format&fit=crop&q=80',
    description: 'Bonded nylon sewing thread #69 / Tex 70 high-tensile resistance for heavy leatherwork.'
  },
  {
    id: 'res-5',
    sku: 'RES-BCK-01',
    barcode: '7611984590055',
    title: 'Magnetic Snap Closures & Buckles',
    category: 'Hardware & Metal',
    categoryId: 'cat-5',
    unit: 'Set',
    costPrice: 3.00,
    sellingPrice: 0,
    taxPercent: 8,
    minStockAlert: 80,
    supplierId: 'sup-2',
    binLocation: 'Aisle B (Hardware) - Rack 3 - Shelf 1 - Bin BCK-01',
    itemType: 'resource',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&auto=format&fit=crop&q=80',
    description: 'Solid brass 18mm magnetic button clasps and roller buckles with anti-tarnish protective coating.'
  }
];

export const initialStock = [
  // Central Manufacturing & Distribution Hub (wh-1)
  { id: 'stk-1-1', productId: 'prod-1', warehouseId: 'wh-1', quantity: 45, bin: 'A-1-1' },
  { id: 'stk-1-2', productId: 'prod-2', warehouseId: 'wh-1', quantity: 30, bin: 'A-1-2' },
  { id: 'stk-1-3', productId: 'prod-3', warehouseId: 'wh-1', quantity: 25, bin: 'A-2-1' },
  { id: 'stk-1-4', productId: 'prod-4', warehouseId: 'wh-1', quantity: 18, bin: 'A-3-1' },
  { id: 'stk-1-r1', productId: 'res-1', warehouseId: 'wh-1', quantity: 120, bin: 'RAW-LTH-01' },
  { id: 'stk-1-r2', productId: 'res-2', warehouseId: 'wh-1', quantity: 450, bin: 'RAW-ZIP-01' },
  { id: 'stk-1-r3', productId: 'res-3', warehouseId: 'wh-1', quantity: 180, bin: 'RAW-LIN-01' },
  { id: 'stk-1-r4', productId: 'res-4', warehouseId: 'wh-1', quantity: 300, bin: 'RAW-THR-01' },
  { id: 'stk-1-r5', productId: 'res-5', warehouseId: 'wh-1', quantity: 240, bin: 'RAW-BCK-01' },

  // West Coast Regional Depot (wh-2)
  { id: 'stk-2-1', productId: 'prod-1', warehouseId: 'wh-2', quantity: 20, bin: 'W1-A' },
  { id: 'stk-2-2', productId: 'prod-2', warehouseId: 'wh-2', quantity: 15, bin: 'W1-B' },
  { id: 'stk-2-3', productId: 'prod-3', warehouseId: 'wh-2', quantity: 12, bin: 'W2-A' },
  { id: 'stk-2-4', productId: 'prod-4', warehouseId: 'wh-2', quantity: 6, bin: 'W2-B' },
  { id: 'stk-2-r1', productId: 'res-1', warehouseId: 'wh-2', quantity: 40, bin: 'W-RAW-1' },
  { id: 'stk-2-r2', productId: 'res-2', warehouseId: 'wh-2', quantity: 150, bin: 'W-RAW-2' },
  { id: 'stk-2-r3', productId: 'res-3', warehouseId: 'wh-2', quantity: 60, bin: 'W-RAW-3' },
  { id: 'stk-2-r4', productId: 'res-4', warehouseId: 'wh-2', quantity: 80, bin: 'W-RAW-4' },
  { id: 'stk-2-r5', productId: 'res-5', warehouseId: 'wh-2', quantity: 90, bin: 'W-RAW-5' },

  // Downtown Flagship Boutique (wh-3)
  { id: 'stk-3-1', productId: 'prod-1', warehouseId: 'wh-3', quantity: 12, bin: 'FS-1' },
  { id: 'stk-3-2', productId: 'prod-2', warehouseId: 'wh-3', quantity: 8, bin: 'FS-2' },
  { id: 'stk-3-3', productId: 'prod-3', warehouseId: 'wh-3', quantity: 4, bin: 'FS-3' }, // Low stock!
  { id: 'stk-3-4', productId: 'prod-4', warehouseId: 'wh-3', quantity: 3, bin: 'FS-4' }  // Low stock!
];

export const getDynamicDate = (daysAgo = 0, hoursAgo = 0, minutesAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  d.setMinutes(d.getMinutes() - minutesAgo);
  return {
    dateStr: d.toISOString().split('T')[0],
    isoString: d.toISOString()
  };
};

export const generateInitialSalesOrders = () => [
  // ── Warehouse 1: Central Manufacturing & Distribution Hub (wh-1) ──
  {
    id: 'ord-101',
    orderNumber: 'INV-2026-101',
    cashier: 'Sarah Jenkins',
    customerName: 'Executive Leather Corp',
    customerContact: '+92 300 1234567',
    customerPhone: '+92 300 1234567',
    warehouseId: 'wh-1',
    orderDate: getDynamicDate(0, 2).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-1', title: 'Classic Leather Tote Bag', quantity: 2, unitPrice: 28500.00, discount: 0, total: 57000.00 },
      { productId: 'prod-4', title: 'Luxury Travel Duffel Bag', quantity: 1, unitPrice: 38000.00, discount: 0, total: 38000.00 }
    ],
    subtotal: 95000.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 5000.00,
    discountTotal: 5000.00,
    shipmentCost: 0,
    grandTotal: 90000.00,
    amountPaid: 90000.00,
    changeDue: 0,
    paymentMethod: 'Bank Transfer',
    paymentStatus: 'Paid',
    notes: 'Corporate client executive gifting consignment',
    date: getDynamicDate(0, 2).isoString
  },
  {
    id: 'ord-102',
    orderNumber: 'INV-2026-102',
    cashier: 'Sarah Jenkins',
    customerName: 'Artisanal Boutique Network',
    customerContact: '+92 321 9876543',
    customerPhone: '+92 321 9876543',
    warehouseId: 'wh-1',
    orderDate: getDynamicDate(2, 4).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-2', title: 'Elegant Evening Clutch', quantity: 3, unitPrice: 12000.00, discount: 0, total: 36000.00 },
      { productId: 'prod-3', title: 'Minimalist Crossbody Sling Bag', quantity: 2, unitPrice: 16500.00, discount: 0, total: 33000.00 }
    ],
    subtotal: 69000.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 4000.00,
    discountTotal: 4000.00,
    shipmentCost: 0,
    grandTotal: 65000.00,
    amountPaid: 65000.00,
    changeDue: 0,
    paymentMethod: 'Credit Card',
    paymentStatus: 'Paid',
    notes: 'Wholesale order for luxury retail rack',
    date: getDynamicDate(2, 4).isoString
  },
  {
    id: 'ord-103',
    orderNumber: 'INV-2026-103',
    cashier: 'Alexander Wright',
    customerName: 'Metro Department Stores',
    customerContact: '+92 333 5551234',
    customerPhone: '+92 333 5551234',
    warehouseId: 'wh-1',
    orderDate: getDynamicDate(4, 5).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-1', title: 'Classic Leather Tote Bag', quantity: 4, unitPrice: 28500.00, discount: 0, total: 114000.00 }
    ],
    subtotal: 114000.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 4000.00,
    discountTotal: 4000.00,
    shipmentCost: 0,
    grandTotal: 110000.00,
    amountPaid: 110000.00,
    changeDue: 0,
    paymentMethod: 'Bank Transfer',
    paymentStatus: 'Paid',
    notes: 'Bulk distribution consignment',
    date: getDynamicDate(4, 5).isoString
  },
  {
    id: 'ord-104',
    orderNumber: 'INV-2026-104',
    cashier: 'Sarah Jenkins',
    customerName: 'Voyager Travel Outfitters',
    customerContact: '+92 312 4448899',
    customerPhone: '+92 312 4448899',
    warehouseId: 'wh-1',
    orderDate: getDynamicDate(6, 3).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-4', title: 'Luxury Travel Duffel Bag', quantity: 3, unitPrice: 38000.00, discount: 0, total: 114000.00 },
      { productId: 'prod-3', title: 'Minimalist Crossbody Sling Bag', quantity: 2, unitPrice: 16500.00, discount: 0, total: 33000.00 }
    ],
    subtotal: 147000.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 5000.00,
    discountTotal: 5000.00,
    shipmentCost: 0,
    grandTotal: 142000.00,
    amountPaid: 142000.00,
    changeDue: 0,
    paymentMethod: 'Bank Transfer',
    paymentStatus: 'Paid',
    notes: 'International traveler merchandise delivery',
    date: getDynamicDate(6, 3).isoString
  },

  // ── Warehouse 2: West Coast Regional Depot (wh-2) ──
  {
    id: 'ord-201',
    orderNumber: 'INV-2026-201',
    cashier: 'Carlos Mendez',
    customerName: 'Pacific Leather Gallery',
    customerContact: '+92 301 7772211',
    customerPhone: '+92 301 7772211',
    warehouseId: 'wh-2',
    orderDate: getDynamicDate(1, 3).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-1', title: 'Classic Leather Tote Bag', quantity: 2, unitPrice: 28500.00, discount: 0, total: 57000.00 },
      { productId: 'prod-3', title: 'Minimalist Crossbody Sling Bag', quantity: 1, unitPrice: 16500.00, discount: 0, total: 16500.00 }
    ],
    subtotal: 73500.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 3500.00,
    discountTotal: 3500.00,
    shipmentCost: 0,
    grandTotal: 70000.00,
    amountPaid: 70000.00,
    changeDue: 0,
    paymentMethod: 'Credit Card',
    paymentStatus: 'Paid',
    notes: 'Regional gallery retail replenishment',
    date: getDynamicDate(1, 3).isoString
  },
  {
    id: 'ord-202',
    orderNumber: 'INV-2026-202',
    cashier: 'Carlos Mendez',
    customerName: 'Harbor Luxury Goods',
    customerContact: '+92 345 8881234',
    customerPhone: '+92 345 8881234',
    warehouseId: 'wh-2',
    orderDate: getDynamicDate(3, 5).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-4', title: 'Luxury Travel Duffel Bag', quantity: 2, unitPrice: 38000.00, discount: 0, total: 76000.00 },
      { productId: 'prod-2', title: 'Elegant Evening Clutch', quantity: 2, unitPrice: 12000.00, discount: 0, total: 24000.00 }
    ],
    subtotal: 100000.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 5000.00,
    discountTotal: 5000.00,
    shipmentCost: 0,
    grandTotal: 95000.00,
    amountPaid: 95000.00,
    changeDue: 0,
    paymentMethod: 'Bank Transfer',
    paymentStatus: 'Paid',
    notes: 'Luxury harbor boutique dispatch',
    date: getDynamicDate(3, 5).isoString
  },
  {
    id: 'ord-203',
    orderNumber: 'INV-2026-203',
    cashier: 'Carlos Mendez',
    customerName: 'West Coast Bag Emporium',
    customerContact: '+92 322 3334455',
    customerPhone: '+92 322 3334455',
    warehouseId: 'wh-2',
    orderDate: getDynamicDate(5, 2).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-2', title: 'Elegant Evening Clutch', quantity: 3, unitPrice: 12000.00, discount: 0, total: 36000.00 },
      { productId: 'prod-3', title: 'Minimalist Crossbody Sling Bag', quantity: 1, unitPrice: 16500.00, discount: 0, total: 16500.00 }
    ],
    subtotal: 52500.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 2500.00,
    discountTotal: 2500.00,
    shipmentCost: 0,
    grandTotal: 50000.00,
    amountPaid: 50000.00,
    changeDue: 0,
    paymentMethod: 'Store Credit',
    paymentStatus: 'Paid',
    notes: 'Direct boutique supply consignment',
    date: getDynamicDate(5, 2).isoString
  },
  {
    id: 'ord-204',
    orderNumber: 'INV-2026-204',
    cashier: 'Carlos Mendez',
    customerName: 'Bay View Retailers',
    customerContact: '+92 300 9998877',
    customerPhone: '+92 300 9998877',
    warehouseId: 'wh-2',
    orderDate: getDynamicDate(6, 6).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-1', title: 'Classic Leather Tote Bag', quantity: 2, unitPrice: 28500.00, discount: 0, total: 57000.00 },
      { productId: 'prod-4', title: 'Luxury Travel Duffel Bag', quantity: 1, unitPrice: 38000.00, discount: 0, total: 38000.00 }
    ],
    subtotal: 95000.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 7000.00,
    discountTotal: 7000.00,
    shipmentCost: 0,
    grandTotal: 88000.00,
    amountPaid: 88000.00,
    changeDue: 0,
    paymentMethod: 'Credit Card',
    paymentStatus: 'Paid',
    notes: 'Weekend promotion inventory delivery',
    date: getDynamicDate(6, 6).isoString
  },

  // ── Warehouse 3: Downtown Flagship Boutique (wh-3) ──
  {
    id: 'ord-301',
    orderNumber: 'INV-2026-301',
    cashier: 'Alice Vance',
    customerName: 'Robert Walker',
    customerContact: '+92 333 1112233',
    customerPhone: '+92 333 1112233',
    warehouseId: 'wh-3',
    orderDate: getDynamicDate(0, 1).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-1', title: 'Classic Leather Tote Bag', quantity: 1, unitPrice: 28500.00, discount: 0, total: 28500.00 }
    ],
    subtotal: 28500.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 1500.00,
    discountTotal: 1500.00,
    shipmentCost: 0,
    grandTotal: 27000.00,
    amountPaid: 27000.00,
    changeDue: 0,
    paymentMethod: 'Credit Card',
    paymentStatus: 'Paid',
    notes: 'Walk-in boutique flagship purchase',
    date: getDynamicDate(0, 1).isoString
  },
  {
    id: 'ord-302',
    orderNumber: 'INV-2026-302',
    cashier: 'Alice Vance',
    customerName: 'TechVibe Creative Studio',
    customerContact: '+92 321 4445566',
    customerPhone: '+92 321 4445566',
    warehouseId: 'wh-3',
    orderDate: getDynamicDate(1, 4).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-2', title: 'Elegant Evening Clutch', quantity: 2, unitPrice: 12000.00, discount: 0, total: 24000.00 },
      { productId: 'prod-3', title: 'Minimalist Crossbody Sling Bag', quantity: 1, unitPrice: 16500.00, discount: 0, total: 16500.00 }
    ],
    subtotal: 40500.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 2500.00,
    discountTotal: 2500.00,
    shipmentCost: 0,
    grandTotal: 38000.00,
    amountPaid: 38000.00,
    changeDue: 0,
    paymentMethod: 'Store Credit',
    paymentStatus: 'Paid',
    notes: 'Boutique corporate gift order',
    date: getDynamicDate(1, 4).isoString
  },
  {
    id: 'ord-303',
    orderNumber: 'INV-2026-303',
    cashier: 'Alice Vance',
    customerName: 'Zainab Chaudhry (VIP)',
    customerContact: '+92 300 7778899',
    customerPhone: '+92 300 7778899',
    warehouseId: 'wh-3',
    orderDate: getDynamicDate(3, 2).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-4', title: 'Luxury Travel Duffel Bag', quantity: 1, unitPrice: 38000.00, discount: 0, total: 38000.00 },
      { productId: 'prod-2', title: 'Elegant Evening Clutch', quantity: 1, unitPrice: 12000.00, discount: 0, total: 12000.00 }
    ],
    subtotal: 50000.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 2000.00,
    discountTotal: 2000.00,
    shipmentCost: 0,
    grandTotal: 48000.00,
    amountPaid: 48000.00,
    changeDue: 0,
    paymentMethod: 'Credit Card',
    paymentStatus: 'Paid',
    notes: 'Loyalty member private styling purchase',
    date: getDynamicDate(3, 2).isoString
  },
  {
    id: 'ord-304',
    orderNumber: 'INV-2026-304',
    cashier: 'Alice Vance',
    customerName: 'Walk-in Cash Client',
    customerContact: '+92 311 2223344',
    customerPhone: '+92 311 2223344',
    warehouseId: 'wh-3',
    orderDate: getDynamicDate(5, 5).dateStr,
    orderState: 'Completed',
    status: 'Completed',
    items: [
      { productId: 'prod-1', title: 'Classic Leather Tote Bag', quantity: 1, unitPrice: 28500.00, discount: 0, total: 28500.00 },
      { productId: 'prod-3', title: 'Minimalist Crossbody Sling Bag', quantity: 1, unitPrice: 16500.00, discount: 0, total: 16500.00 }
    ],
    subtotal: 45000.00,
    orderTax: 0,
    taxPercent: 0,
    taxAmount: 0,
    globalDiscount: 3000.00,
    discountTotal: 3000.00,
    shipmentCost: 0,
    grandTotal: 42000.00,
    amountPaid: 45000.00,
    changeDue: 3000.00,
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
    notes: 'In-store cash transaction',
    date: getDynamicDate(5, 5).isoString
  }
];

export const initialSalesOrders = generateInitialSalesOrders();

export const generateInitialPurchaseOrders = () => [
  // ── wh-1: Central Manufacturing & Distribution Hub ──
  {
    id: 'po-101',
    poNumber: 'PO-2026-101',
    invoiceNumber: 'INV-PO-2026-101',
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    status: 'Completed',
    orderDate: getDynamicDate(5).dateStr,
    dueDate: getDynamicDate(2).dateStr,
    date: getDynamicDate(5).dateStr,
    expectedDate: getDynamicDate(2).dateStr,
    subtotal: 90000.00,
    discountAmount: 0,
    taxAmount: 0,
    shippingCost: 0,
    grandTotal: 90000.00,
    totalAmount: 90000.00,
    amountPaid: 90000.00,
    balanceDue: 0.00,
    paymentHistory: [
      {
        id: 'pay-101-1',
        amount: 90000.00,
        paymentMethod: 'Bank Transfer',
        date: getDynamicDate(2).dateStr,
        notes: 'Full payment cleared on inspection approval'
      }
    ],
    debitNotes: [
      {
        id: 'dn-seed-101',
        debitNoteNumber: 'DN-PO-2026-101',
        grnNumber: 'GRN-2026-001',
        deliveryNote: 'DC-88419',
        amount: 3000.00,
        date: getDynamicDate(4).dateStr,
        refundStatus: 'Pending',
        items: [
          {
            productId: 'res-2',
            productName: 'Solid Brass Zippers 12"',
            sku: 'RAW-ZIP-BRS-12',
            rejectedQty: 20,
            unitCost: 150.00,
            totalCost: 3000.00
          }
        ],
        notes: 'Inward Quality Inspection: 20 defective zipper teeth returned.'
      }
    ],
    items: [
      { productId: 'res-1', quantity: 50, receivedQty: 50, unitCost: 1200.00, totalCost: 60000.00 },
      { productId: 'res-2', quantity: 200, receivedQty: 200, unitCost: 150.00, totalCost: 30000.00 }
    ],
    pdfAttachment: null,
    notes: 'Batch of premium leather hides & solid brass zippers.'
  },
  {
    id: 'po-102',
    poNumber: 'PO-2026-102',
    invoiceNumber: 'INV-PO-2026-102',
    supplierId: 'sup-3',
    warehouseId: 'wh-1',
    status: 'Issued',
    orderDate: getDynamicDate(2).dateStr,
    dueDate: getDynamicDate(-3).dateStr,
    date: getDynamicDate(2).dateStr,
    expectedDate: getDynamicDate(-3).dateStr,
    subtotal: 47000.00,
    discountAmount: 0,
    taxAmount: 0,
    shippingCost: 0,
    grandTotal: 47000.00,
    totalAmount: 47000.00,
    amountPaid: 0.00,
    balanceDue: 47000.00,
    paymentHistory: [],
    items: [
      { productId: 'res-3', quantity: 100, receivedQty: 0, unitCost: 350.00, totalCost: 35000.00 },
      { productId: 'res-4', quantity: 150, receivedQty: 0, unitCost: 80.00, totalCost: 12000.00 }
    ],
    pdfAttachment: null,
    notes: 'Nylon inner lining and heavy-duty thread replenishment.'
  },

  // ── wh-2: West Coast Regional Depot ──
  {
    id: 'po-201',
    poNumber: 'PO-2026-201',
    invoiceNumber: 'INV-PO-2026-201',
    supplierId: 'sup-1',
    warehouseId: 'wh-2',
    status: 'Completed',
    orderDate: getDynamicDate(4).dateStr,
    dueDate: getDynamicDate(1).dateStr,
    date: getDynamicDate(4).dateStr,
    expectedDate: getDynamicDate(1).dateStr,
    subtotal: 56000.00,
    discountAmount: 0,
    taxAmount: 0,
    shippingCost: 0,
    grandTotal: 56000.00,
    totalAmount: 56000.00,
    amountPaid: 56000.00,
    balanceDue: 0.00,
    paymentHistory: [
      {
        id: 'pay-201-1',
        amount: 56000.00,
        paymentMethod: 'Bank Transfer',
        date: getDynamicDate(1).dateStr,
        notes: 'Paid upon arrival at regional depot'
      }
    ],
    items: [
      { productId: 'res-1', quantity: 30, receivedQty: 30, unitCost: 1200.00, totalCost: 36000.00 },
      { productId: 'res-5', quantity: 100, receivedQty: 100, unitCost: 200.00, totalCost: 20000.00 }
    ],
    pdfAttachment: null,
    notes: 'Regional raw materials batch for custom assembly.'
  },
  {
    id: 'po-202',
    poNumber: 'PO-2026-202',
    invoiceNumber: 'INV-PO-2026-202',
    supplierId: 'sup-2',
    warehouseId: 'wh-2',
    status: 'Partially Received',
    orderDate: getDynamicDate(1).dateStr,
    dueDate: getDynamicDate(-4).dateStr,
    date: getDynamicDate(1).dateStr,
    expectedDate: getDynamicDate(-4).dateStr,
    subtotal: 27000.00,
    discountAmount: 0,
    taxAmount: 0,
    shippingCost: 0,
    grandTotal: 27000.00,
    totalAmount: 27000.00,
    amountPaid: 0.00,
    balanceDue: 27000.00,
    paymentHistory: [],
    items: [
      { productId: 'res-2', quantity: 180, receivedQty: 60, unitCost: 150.00, totalCost: 27000.00 }
    ],
    pdfAttachment: null,
    notes: 'Brass zippers replenishment order (60 units received on first delivery).'
  },

  // ── wh-3: Downtown Flagship Boutique ──
  {
    id: 'po-301',
    poNumber: 'PO-2026-301',
    invoiceNumber: 'INV-PO-2026-301',
    supplierId: 'sup-1',
    warehouseId: 'wh-3',
    status: 'Completed',
    orderDate: getDynamicDate(3).dateStr,
    dueDate: getDynamicDate(1).dateStr,
    date: getDynamicDate(3).dateStr,
    expectedDate: getDynamicDate(1).dateStr,
    subtotal: 18000.00,
    discountAmount: 0,
    taxAmount: 0,
    shippingCost: 0,
    grandTotal: 18000.00,
    totalAmount: 18000.00,
    amountPaid: 18000.00,
    balanceDue: 0.00,
    paymentHistory: [
      {
        id: 'pay-301-1',
        amount: 18000.00,
        paymentMethod: 'Credit Card',
        date: getDynamicDate(1).dateStr,
        notes: 'In-store repair workshop leather supply'
      }
    ],
    items: [
      { productId: 'res-1', quantity: 15, receivedQty: 15, unitCost: 1200.00, totalCost: 18000.00 }
    ],
    pdfAttachment: null,
    notes: 'Premium leather hide for bespoke in-store embossing and monogramming.'
  },
  {
    id: 'po-302',
    poNumber: 'PO-2026-302',
    invoiceNumber: 'INV-PO-2026-302',
    supplierId: 'sup-2',
    warehouseId: 'wh-3',
    status: 'Issued',
    orderDate: getDynamicDate(0).dateStr,
    dueDate: getDynamicDate(-5).dateStr,
    date: getDynamicDate(0).dateStr,
    expectedDate: getDynamicDate(-5).dateStr,
    subtotal: 12000.00,
    discountAmount: 0,
    taxAmount: 0,
    shippingCost: 0,
    grandTotal: 12000.00,
    totalAmount: 12000.00,
    amountPaid: 0.00,
    balanceDue: 12000.00,
    paymentHistory: [],
    items: [
      { productId: 'res-5', quantity: 60, receivedQty: 0, unitCost: 200.00, totalCost: 12000.00 }
    ],
    pdfAttachment: null,
    notes: 'Boutique replacement buckles and lock closures.'
  }
];

export const initialPurchaseOrders = generateInitialPurchaseOrders();

export const initialTransfers = [
  {
    id: 'tr-901',
    transferNumber: 'TRF-2026-001',
    fromWarehouseId: 'wh-1',
    toWarehouseId: 'wh-3',
    status: 'Completed',
    date: '2026-10-14',
    items: [
      { productId: 'prod-1', quantity: 8 },
      { productId: 'prod-2', quantity: 5 }
    ],
    requestedBy: 'Sarah Jenkins',
    notes: 'Replenishing Downtown Flagship showroom display inventory.'
  },
  {
    id: 'tr-902',
    transferNumber: 'TRF-2026-002',
    fromWarehouseId: 'wh-1',
    toWarehouseId: 'wh-2',
    status: 'In-Transit',
    date: '2026-10-16',
    items: [
      { productId: 'prod-3', quantity: 6 },
      { productId: 'prod-4', quantity: 4 }
    ],
    requestedBy: 'Carlos Mendez',
    notes: 'Inter-warehouse regional depot equilibrium.'
  }
];

export const initialAuditLogs = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    userId: 'usr-admin',
    userName: 'Alexander Wright (Admin)',
    action: 'Stock Transfer Dispatched',
    module: 'Logistics',
    details: 'Dispatched transfer TRF-2026-002 from Central Hub to West Coast Regional Depot.'
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    userId: 'usr-cashier',
    userName: 'Alice Vance (Cashier)',
    action: 'Order Completed',
    module: 'POS Terminal',
    details: 'Invoice INV-2026-001 generated for Robert Walker ($162.00 via Credit Card).'
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    userId: 'usr-mgr',
    userName: 'Sarah Jenkins (Store Mgr)',
    action: 'Cycle Count Audit Completed',
    module: 'Warehouse Operations',
    details: 'Cycle count verified for WH-CENTRAL Raw Materials Aisle. Discrepancies: 0.'
  }
];

// Seed data for new attribute tables
export const initialCategories = [
  { id: 'cat-1', name: 'Handbags', logo: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=120&auto=format&fit=crop&q=80' },
  { id: 'cat-2', name: 'Purses', logo: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=120&auto=format&fit=crop&q=80' },
  { id: 'cat-3', name: 'Travel Bags', logo: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=120&auto=format&fit=crop&q=80' },
  { id: 'cat-4', name: 'Raw Leather', logo: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=120&auto=format&fit=crop&q=80' },
  { id: 'cat-5', name: 'Hardware & Metal', logo: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=120&auto=format&fit=crop&q=80' },
  { id: 'cat-6', name: 'Fabrics', logo: 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=120&auto=format&fit=crop&q=80' }
];

export const initialBrands = [
  { id: 'brand-1', name: 'Atelier Cuir', logo: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=120&auto=format&fit=crop&q=80' },
  { id: 'brand-2', name: 'Maison Luxe', logo: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=120&auto=format&fit=crop&q=80' },
  { id: 'brand-3', name: 'Voyager Craft', logo: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=120&auto=format&fit=crop&q=80' },
  { id: 'brand-4', name: 'Heritage Leather Co.', logo: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=120&auto=format&fit=crop&q=80' },
  { id: 'brand-5', name: 'Generic / Artisanal Studio', logo: '' }
];

export const initialUnits = [
  { id: 'unit-1', name: 'Pieces', shortName: 'Pcs', abbreviation: 'Pcs', baseUnit: 'None' },
  { id: 'unit-2', name: 'Square Foot', shortName: 'SqFt', abbreviation: 'SqFt', baseUnit: 'None' },
  { id: 'unit-3', name: 'Meter', shortName: 'Mtr', abbreviation: 'm', baseUnit: 'None' },
  { id: 'unit-4', name: 'Spool', shortName: 'Spool', abbreviation: 'Spl', baseUnit: 'Pieces' },
  { id: 'unit-5', name: 'Set', shortName: 'Set', abbreviation: 'Set', baseUnit: 'Pieces' },
  { id: 'unit-6', name: 'Roll', shortName: 'Roll', abbreviation: 'Roll', baseUnit: 'None' }
];

export const initialVariants = [
  { id: 'var-1', name: 'Leather Color', values: ['Cognac Brown', 'Obsidian Black', 'Burgundy Wine', 'Tan Camel'] },
  { id: 'var-2', name: 'Hardware Finish', values: ['Polished Gold', 'Antique Brass', 'Gunmetal Matte', 'Nickel Silver'] },
  { id: 'var-3', name: 'Size', values: ['Small (10L)', 'Medium (18L)', 'Large (28L)', 'Overnight (45L)'] },
  { id: 'var-4', name: 'Lining Material', values: ['Tear-Resistant Nylon', 'Silk Jacquard', 'Cotton Canvas'] }
];

export const generateInitialExpenses = () => [
  // ── wh-1: Central Manufacturing & Distribution Hub ──
  {
    id: 'exp-101',
    expenseId: 'exp-101',
    warehouseId: 'wh-1',
    category: 'Electricity',
    billerName: 'K-Electric Industrial Grid',
    referenceNumber: 'KE-IND-2026-9921',
    issueDate: getDynamicDate(6).dateStr,
    dueDate: getDynamicDate(-15).dateStr,
    paymentDate: getDynamicDate(5).dateStr,
    totalAmount: 42000.00,
    amountPaid: 42000.00,
    remainingBalance: 0.00,
    paymentStatus: 'Fully Paid',
    paymentMethod: 'Bank Transfer',
    receiptAttachment: null,
    notes: 'Central Distribution Hub monthly high-voltage power consumption'
  },
  {
    id: 'exp-102',
    expenseId: 'exp-102',
    warehouseId: 'wh-1',
    category: 'Rent',
    billerName: 'Pinnacle Logistics Commercial Realty',
    referenceNumber: 'RENT-OCT-WH1',
    issueDate: getDynamicDate(4).dateStr,
    dueDate: getDynamicDate(-20).dateStr,
    paymentDate: getDynamicDate(3).dateStr,
    totalAmount: 75000.00,
    amountPaid: 37500.00,
    remainingBalance: 37500.00,
    paymentStatus: 'Partially Paid',
    paymentMethod: 'Bank Transfer',
    receiptAttachment: null,
    notes: 'Warehouse facility lease installment for current month'
  },
  {
    id: 'exp-103',
    expenseId: 'exp-103',
    warehouseId: 'wh-1',
    category: 'Internet',
    billerName: 'PTCL Corporate Fiber',
    referenceNumber: 'PTCL-CORP-8839',
    issueDate: getDynamicDate(2).dateStr,
    dueDate: getDynamicDate(-10).dateStr,
    paymentDate: getDynamicDate(1).dateStr,
    totalAmount: 9500.00,
    amountPaid: 9500.00,
    remainingBalance: 0.00,
    paymentStatus: 'Fully Paid',
    paymentMethod: 'Direct Debit',
    receiptAttachment: null,
    notes: 'Dedicated 100Mbps symmetrical fiber optic line and static IP block'
  },

  // ── wh-2: West Coast Regional Depot ──
  {
    id: 'exp-201',
    expenseId: 'exp-201',
    warehouseId: 'wh-2',
    category: 'Electricity',
    billerName: 'K-Electric Commercial Wing',
    referenceNumber: 'KE-COM-2026-4412',
    issueDate: getDynamicDate(5).dateStr,
    dueDate: getDynamicDate(-18).dateStr,
    paymentDate: getDynamicDate(4).dateStr,
    totalAmount: 24500.00,
    amountPaid: 24500.00,
    remainingBalance: 0.00,
    paymentStatus: 'Fully Paid',
    paymentMethod: 'Bank Transfer',
    receiptAttachment: null,
    notes: 'Regional distribution warehouse lighting and climate control'
  },
  {
    id: 'exp-202',
    expenseId: 'exp-202',
    warehouseId: 'wh-2',
    category: 'Rent',
    billerName: 'Western Commercial Properties Ltd',
    referenceNumber: 'RENT-OCT-WH2',
    issueDate: getDynamicDate(4).dateStr,
    dueDate: getDynamicDate(-12).dateStr,
    paymentDate: getDynamicDate(2).dateStr,
    totalAmount: 52000.00,
    amountPaid: 26000.00,
    remainingBalance: 26000.00,
    paymentStatus: 'Partially Paid',
    paymentMethod: 'Cheque',
    receiptAttachment: null,
    notes: 'Depot storage space lease monthly installment'
  },
  {
    id: 'exp-203',
    expenseId: 'exp-203',
    warehouseId: 'wh-2',
    category: 'Internet',
    billerName: 'StormFiber Enterprise',
    referenceNumber: 'SF-ENT-5521',
    issueDate: getDynamicDate(1).dateStr,
    dueDate: getDynamicDate(-8).dateStr,
    paymentDate: getDynamicDate(0).dateStr,
    totalAmount: 7800.00,
    amountPaid: 7800.00,
    remainingBalance: 0.00,
    paymentStatus: 'Fully Paid',
    paymentMethod: 'Bank Transfer',
    receiptAttachment: null,
    notes: 'High-speed fiber connection for regional barcode sync'
  },

  // ── wh-3: Downtown Flagship Boutique ──
  {
    id: 'exp-301',
    expenseId: 'exp-301',
    warehouseId: 'wh-3',
    category: 'Electricity',
    billerName: 'K-Electric Downtown Commercial',
    referenceNumber: 'KE-DT-2026-3199',
    issueDate: getDynamicDate(4).dateStr,
    dueDate: getDynamicDate(-14).dateStr,
    paymentDate: getDynamicDate(3).dateStr,
    totalAmount: 31000.00,
    amountPaid: 31000.00,
    remainingBalance: 0.00,
    paymentStatus: 'Fully Paid',
    paymentMethod: 'Credit Card',
    receiptAttachment: null,
    notes: 'Boutique showroom track lighting, display spotlights & AC'
  },
  {
    id: 'exp-302',
    expenseId: 'exp-302',
    warehouseId: 'wh-3',
    category: 'Rent',
    billerName: 'Downtown Commercial Plaza Ltd',
    referenceNumber: 'RENT-OCT-WH3',
    issueDate: getDynamicDate(5).dateStr,
    dueDate: getDynamicDate(-15).dateStr,
    paymentDate: getDynamicDate(2).dateStr,
    totalAmount: 68000.00,
    amountPaid: 34000.00,
    remainingBalance: 34000.00,
    paymentStatus: 'Partially Paid',
    paymentMethod: 'Bank Transfer',
    receiptAttachment: null,
    notes: 'Prime high-street flagship retail outlet rental'
  },
  {
    id: 'exp-303',
    expenseId: 'exp-303',
    warehouseId: 'wh-3',
    category: 'Internet',
    billerName: 'StormFiber Enterprise',
    referenceNumber: 'SF-POS-9021',
    issueDate: getDynamicDate(2).dateStr,
    dueDate: getDynamicDate(-10).dateStr,
    paymentDate: getDynamicDate(1).dateStr,
    totalAmount: 6500.00,
    amountPaid: 6500.00,
    remainingBalance: 0.00,
    paymentStatus: 'Fully Paid',
    paymentMethod: 'Credit Card',
    receiptAttachment: null,
    notes: 'POS terminal connectivity and customer showroom Wi-Fi'
  }
];

export const initialExpenses = generateInitialExpenses();

export const initialReturns = [
  {
    id: 'ret-1001',
    returnNumber: 'RET-2026-101',
    originalOrderNumber: 'INV-2026-001',
    productId: 'prod-1',
    productTitle: 'Classic Leather Tote Bag',
    quantity: 1,
    condition: 'Restockable',
    restockWarehouseId: 'wh-3',
    refundType: 'Store Credit',
    baseRefundAmount: 150.00,
    restockFeePercentage: 0,
    finalRefundAmount: 150.00,
    customerContact: '+1 555-019-2831',
    hasInvoice: true,
    reason: 'Customer preferred different color/shade',
    date: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'ret-1002',
    returnNumber: 'RET-2026-102',
    originalOrderNumber: 'INV-2026-002',
    productId: 'prod-2',
    productTitle: 'Elegant Evening Clutch',
    quantity: 1,
    condition: 'Damaged/Scrapped',
    restockWarehouseId: 'wh-3',
    refundType: 'Original Payment Cash',
    baseRefundAmount: 85.00,
    restockFeePercentage: 10,
    finalRefundAmount: 76.50,
    customerContact: '+1 555-019-8822',
    hasInvoice: true,
    reason: 'Defective hardware clasp mechanism',
    date: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];

export const initialUsers = [
  {
    id: 'user-admin',
    name: 'Alexander Wright',
    email: 'admin@mail.com',
    password: '12345',
    role: 'admin',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-manager',
    name: 'Sarah Jenkins',
    email: 'storemanager@mail.com',
    password: '1111',
    role: 'manager',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-warehouse',
    name: 'Carlos Mendez',
    email: 'warehousestaff@mail.com',
    password: '2222',
    role: 'warehouse',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-cashier',
    name: 'Alice Vance',
    email: 'cashier@mail.com',
    password: '3333',
    role: 'cashier',
    status: 'Active',
    createdAt: new Date().toISOString()
  }
];

// Initialize and seed database if empty
export async function seedDatabase() {
  const prodCount = await db.products.count();
  if (prodCount === 0) {
    await db.warehouses.bulkAdd(initialWarehouses);
    await db.suppliers.bulkAdd(initialSuppliers);
    await db.products.bulkAdd([...initialProducts, ...initialResources]);
    await db.stockLevels.bulkAdd(initialStock);
    await db.salesOrders.bulkAdd(initialSalesOrders);
    await db.purchaseOrders.bulkAdd(initialPurchaseOrders);
    await db.warehouseTransfers.bulkAdd(initialTransfers);
    await db.auditLogs.bulkAdd(initialAuditLogs);
    await db.categories.bulkAdd(initialCategories);
    await db.brands.bulkAdd(initialBrands);
    await db.units.bulkAdd(initialUnits);
    await db.variants.bulkAdd(initialVariants);
    await db.expenses.bulkAdd(initialExpenses);
    await db.users.bulkAdd(initialUsers);
    await db.settings.bulkAdd([
      { id: '1', key: 'currency', value: 'PKR' },
      { id: '2', key: 'language', value: 'en' },
      { id: '3', key: 'theme', value: 'light' },
      { id: '4', key: 'activeWarehouseId', value: 'wh-1' }
    ]);
  } else {
    // Migration: If database already exists with legacy electronics data, wipe and reseed with bag manufacturing catalog
    const legacyProd = await db.products.where('sku').equals('LOG-MXM3-BLK').first();
    const hasHandbagsCategory = await db.categories.where('name').equals('Handbags').first();
    if (legacyProd || !hasHandbagsCategory) {
      console.log('Migrating database: Replacing electronics mock data with Bag & Purse Manufacturing dataset...');
      await db.products.clear();
      await db.products.bulkAdd([...initialProducts, ...initialResources]);

      await db.categories.clear();
      await db.categories.bulkAdd(initialCategories);

      await db.brands.clear();
      await db.brands.bulkAdd(initialBrands);

      await db.units.clear();
      await db.units.bulkAdd(initialUnits);

      await db.variants.clear();
      await db.variants.bulkAdd(initialVariants);

      await db.suppliers.clear();
      await db.suppliers.bulkAdd(initialSuppliers);

      await db.stockLevels.clear();
      await db.stockLevels.bulkAdd(initialStock);

      await db.purchaseOrders.clear();
      await db.purchaseOrders.bulkAdd(initialPurchaseOrders);

      await db.salesOrders.clear();
      await db.salesOrders.bulkAdd(initialSalesOrders);

      await db.warehouseTransfers.clear();
      await db.warehouseTransfers.bulkAdd(initialTransfers);

      try {
        if (db.salesReturns) {
          await db.salesReturns.clear();
          await db.salesReturns.bulkAdd(initialReturns);
        }
        if (db.returns) {
          await db.returns.clear();
          await db.returns.bulkAdd(initialReturns);
        }
      } catch (_) {}
    }
  }

  // Seed attribute tables independently — safe to re-run
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(initialCategories);
    await db.brands.bulkAdd(initialBrands);
    await db.units.bulkAdd(initialUnits);
  }

  const varCount = await db.variants.count();
  if (varCount === 0) {
    await db.variants.bulkAdd(initialVariants);
  }

  // Ensure raw materials & resources are seeded into products table
  try {
    const resCount = await db.products.where('itemType').equals('resource').count();
    if (resCount === 0) {
      await db.products.bulkAdd(initialResources);
    }
  } catch (err) {
    console.warn('Resources seed notice:', err);
  }

  // Ensure all existing product records default their itemType to 'product'
  try {
    await db.products.toCollection().modify(item => {
      if (!item.itemType) {
        item.itemType = 'product';
      }
    });
  } catch (err) {
    console.warn('itemType migration notice:', err);
  }

  // Ensure all existing PO records have invoice & payment fields initialized
  try {
    await db.purchaseOrders.toCollection().modify(po => {
      if (!po.invoiceNumber) po.invoiceNumber = po.poNumber ? `INV-${po.poNumber}` : `INV-PO-${po.id}`;
      if (!po.orderDate) po.orderDate = po.date || new Date().toISOString().split('T')[0];
      if (!po.dueDate) po.dueDate = po.expectedDate || po.orderDate;
      const total = Number(po.grandTotal !== undefined ? po.grandTotal : (po.totalAmount || 0));
      if (po.grandTotal === undefined) po.grandTotal = total;
      if (po.subtotal === undefined) po.subtotal = total;
      if (po.discountAmount === undefined) po.discountAmount = 0;
      if (po.taxAmount === undefined) po.taxAmount = 0;
      if (po.shippingCost === undefined) po.shippingCost = 0;
      if (!Array.isArray(po.items)) po.items = [];
      if (!po.pdfAttachment) po.pdfAttachment = null;

      // Payment tracking fields: amountPaid (default 0), balanceDue (default equals grandTotal), paymentHistory array
      const statusLower = (po.status || '').trim().toLowerCase();
      const isCompleted = statusLower === 'completed' || statusLower === 'paid';
      if (po.amountPaid === undefined) {
        po.amountPaid = isCompleted ? total : 0;
      }
      if (po.balanceDue === undefined) {
        po.balanceDue = isCompleted ? 0 : Math.max(0, total - (po.amountPaid || 0));
      }
      if (!Array.isArray(po.paymentHistory)) {
        po.paymentHistory = po.amountPaid > 0 ? [
          {
            id: `pay-${po.id || Date.now()}-1`,
            amount: po.amountPaid,
            paymentMethod: 'Bank Transfer',
            date: po.orderDate || new Date().toISOString().split('T')[0],
            notes: 'Initial recorded settlement'
          }
        ] : [];
      }

      // Ensure receivedQty on items array (default to 0, or quantity if completed)
      if (Array.isArray(po.items)) {
        po.items = po.items.map(it => ({
          ...it,
          receivedQty: it.receivedQty !== undefined 
            ? Number(it.receivedQty) 
            : (isCompleted ? Number(it.quantity || 0) : 0)
        }));
      }
    });
  } catch (err) {
    console.warn('PO invoice migration notice:', err);
  }

  // Ensure operating bills & expenses table is seeded
  try {
    const expCount = await db.expenses.count();
    if (expCount === 0) {
      await db.expenses.bulkAdd(generateInitialExpenses());
    }
  } catch (err) {
    console.warn('Expenses seed notice:', err);
  }

  // Ensure returns / salesReturns tables are initialized and seeded
  try {
    const retCount = await db.salesReturns.count();
    if (retCount === 0) {
      await db.salesReturns.bulkAdd(initialReturns);
    }
  } catch (err) {
    console.warn('SalesReturns seed notice:', err);
  }

  try {
    if (db.returns) {
      const count = await db.returns.count();
      if (count === 0) {
        await db.returns.bulkAdd(initialReturns);
      }
    }
  } catch (err) {
    console.warn('Returns table seed notice:', err);
  }

  // Auto-refresh multi-warehouse dummy data across wh-1, wh-2, wh-3 if missing or outdated
  try {
    const wh2Sales = await db.salesOrders.where('warehouseId').equals('wh-2').count();
    const hasOldSales = await db.salesOrders.where('id').equals('ord-001').first();
    if (wh2Sales === 0 || hasOldSales) {
      console.log('Seeding balanced sales orders across all warehouses (wh-1, wh-2, wh-3)...');
      await db.salesOrders.clear();
      await db.salesOrders.bulkAdd(generateInitialSalesOrders());
    }
  } catch (err) {
    console.warn('Sales orders multi-warehouse seed notice:', err);
  }

  try {
    const wh2Expenses = await db.expenses.where('warehouseId').equals('wh-2').count();
    const sampleExp = await db.expenses.where('id').equals('exp-101').first();
    const isOldExpenseData = sampleExp && sampleExp.totalAmount === 1450.00;
    if (wh2Expenses < 2 || isOldExpenseData) {
      console.log('Seeding balanced operational expenses across all warehouses (wh-1, wh-2, wh-3)...');
      await db.expenses.clear();
      await db.expenses.bulkAdd(generateInitialExpenses());
    }
  } catch (err) {
    console.warn('Expenses multi-warehouse seed notice:', err);
  }

  try {
    const wh2POs = await db.purchaseOrders.where('warehouseId').equals('wh-2').count();
    const samplePo = await db.purchaseOrders.where('id').equals('po-101').first();
    const sampleItem = samplePo?.items?.[0];
    const isOldPo = samplePo && (samplePo.grandTotal === 2850.00 || sampleItem?.receivedQty === undefined);
    if (wh2POs === 0 || isOldPo) {
      console.log('Seeding balanced purchase orders across all warehouses (wh-1, wh-2, wh-3)...');
      await db.purchaseOrders.clear();
      await db.purchaseOrders.bulkAdd(generateInitialPurchaseOrders());
    }
  } catch (err) {
    console.warn('Purchase orders multi-warehouse seed notice:', err);
  }

  // Ensure users table is initialized and seeded with default accounts
  try {
    if (db.users) {
      const userCount = await db.users.count();
      if (userCount === 0) {
        console.log('Seeding testing user accounts into Dexie users table...');
        await db.users.bulkAdd(initialUsers);
      }
    }
  } catch (err) {
    console.warn('Users table seed notice:', err);
  }
}
