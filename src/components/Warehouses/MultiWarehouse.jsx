import React, { useState, useEffect } from 'react';
import { 
  Warehouse as WarehouseIcon, 
  Plus, 
  MapPin, 
  Pencil,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

export default function MultiWarehouse() {
  const { t, formatCurrency, activeWarehouseId, changeActiveWarehouse, logAudit } = useApp();

  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch warehouses from backend API
  const fetchWarehouses = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/warehouses');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setWarehouses(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch warehouses from API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch products from backend API for valuation calculations
  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  useEffect(() => {
    fetchWarehouses();
    fetchProducts();
  }, []);

  const [activeSubTab, setActiveSubTab] = useState('warehouses'); // 'warehouses'
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState(null);

  // Warehouse form state
  const [whFormData, setWhFormData] = useState({
    code: 'WH-EAST',
    name: 'East Coast Distribution Center',
    type: 'Regional',
    address: '880 Logistics Blvd, Newark, NJ',
    capacity: 18000,
    manager: 'David Miller',
    contact: '+1 555-442-9981'
  });

  const handleOpenAddModal = () => {
    setEditingWarehouseId(null);
    setWhFormData({
      code: '',
      name: '',
      type: 'Regional',
      address: '',
      capacity: 10000,
      manager: '',
      contact: ''
    });
    setShowAddWarehouseModal(true);
  };

  const handleEditWarehouse = (wh) => {
    setEditingWarehouseId(wh.id);
    setWhFormData({
      code: wh.code || '',
      name: wh.name || '',
      type: wh.type || 'Regional',
      address: wh.address || '',
      capacity: wh.capacitySqFt || wh.capacity || 0,
      manager: wh.managerName || wh.manager || '',
      contact: wh.contact || ''
    });
    setShowAddWarehouseModal(true);
  };

  // Save warehouse (Create or Edit via Backend API)
  const handleSaveWarehouse = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: whFormData.code.trim().toUpperCase(),
        name: whFormData.name.trim(),
        address: whFormData.address?.trim() || null,
        capacitySqFt: Number(whFormData.capacity) || null,
        managerName: whFormData.manager?.trim() || null
      };

      if (editingWarehouseId) {
        // Edit Mode: PUT /api/warehouses/:id
        await api.put(`/warehouses/${editingWarehouseId}`, payload);

        if (activeWarehouseId === editingWarehouseId && typeof changeActiveWarehouse === 'function') {
          await changeActiveWarehouse(editingWarehouseId);
        }

        await logAudit?.(
          'Warehouse Updated',
          'Multi-Warehouse',
          `Modified warehouse facility details: ${payload.name} (${payload.code})`
        );
      } else {
        // Create Mode: POST /api/warehouses
        await api.post('/warehouses', payload);

        await logAudit?.(
          'Warehouse Created',
          'Multi-Warehouse',
          `Added new facility node: ${payload.name} (${payload.code})`
        );
      }

      // Refresh list immediately from server
      await fetchWarehouses();

      setShowAddWarehouseModal(false);
      setEditingWarehouseId(null);
    } catch (err) {
      console.error('Save warehouse error:', err);
      const serverMessage = 
        err.response?.data?.message || 
        (err.response?.data?.errors && err.response.data.errors[0]?.message) ||
        err.message || 
        'Failed to save warehouse.';
      alert(`Warehouse Error: ${serverMessage}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t.warehouses}</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              {warehouses.length} Facilities Active
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Facility directory, capacity tracking, and multi-depot inventory management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Warehouse Node
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('warehouses')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-indigo-600 text-white shadow-xs"
        >
          <WarehouseIcon className="w-4 h-4" />
          <span>Warehouse Directory</span>
        </button>
      </div>

      {/* SUB-TAB 1: WAREHOUSES DIRECTORY */}
      {activeSubTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {warehouses.map(wh => {
            const whStock = stockLevels.filter(s => s.warehouseId === wh.id);
            const totalUnits = whStock.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
            const totalValuation = whStock.reduce((acc, curr) => {
              const p = products.find(prod => prod.id === curr.productId);
              return acc + (p ? p.costPrice * curr.quantity : 0);
            }, 0);
            const isCurrentlySelected = activeWarehouseId === wh.id;

            return (
              <div
                key={wh.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between ${
                  isCurrentlySelected
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                        {wh.code}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                        {wh.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{wh.address}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isCurrentlySelected && (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] rounded-full">
                          Active Node
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditWarehouse(wh);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700/60"
                        title="Edit Warehouse Depot Details"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 my-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
                    <div>
                      <div className="text-slate-400 text-[11px]">Units Stored</div>
                      <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                        {totalUnits.toLocaleString()} Pcs
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Depot Valuation</div>
                      <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                        {formatCurrency(totalValuation)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Facility Manager:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {wh.managerName || wh.manager || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Storage Capacity:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {(wh.capacitySqFt || wh.capacity || 0).toLocaleString()} sq.ft
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => changeActiveWarehouse(wh.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      isCurrentlySelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isCurrentlySelected ? 'Selected Terminal Node' : 'Switch To This Warehouse'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add or Edit Warehouse Depot */}
      {showAddWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-indigo-500" />
                <span>{editingWarehouseId ? 'Edit Warehouse Depot' : 'Register New Warehouse Depot'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddWarehouseModal(false);
                  setEditingWarehouseId(null);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Depot Code</label>
                <input
                  type="text"
                  required
                  value={whFormData.code}
                  onChange={(e) => setWhFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. WH-EAST"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Facility Name</label>
                <input
                  type="text"
                  required
                  value={whFormData.name}
                  onChange={(e) => setWhFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. East Coast Distribution Center"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Physical Address</label>
                <input
                  type="text"
                  required
                  value={whFormData.address}
                  onChange={(e) => setWhFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="e.g. 880 Logistics Blvd, Newark, NJ"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Capacity (sq.ft)</label>
                  <input
                    type="number"
                    min="0"
                    value={whFormData.capacity}
                    onChange={(e) => setWhFormData(prev => ({ ...prev, capacity: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Manager</label>
                  <input
                    type="text"
                    value={whFormData.manager}
                    onChange={(e) => setWhFormData(prev => ({ ...prev, manager: e.target.value }))}
                    placeholder="e.g. David Miller"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddWarehouseModal(false);
                    setEditingWarehouseId(null);
                  }}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {editingWarehouseId ? 'Save Changes' : 'Save Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
