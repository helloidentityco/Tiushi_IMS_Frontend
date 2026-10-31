import React, { useState, useEffect } from 'react';
import { 
  Ruler, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Scale,
  Layers,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

const INPUT_CLS =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors';
const LABEL_CLS = 
  'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

export default function UnitsManagement() {
  const { logAudit } = useApp();

  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    baseUnit: 'None'
  });

  const fetchUnits = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/units');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setUnits(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch units:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setFormData({
      name: '',
      shortName: '',
      baseUnit: 'None'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name || '',
      shortName: unit.shortName || unit.abbreviation || '',
      baseUnit: unit.baseUnit || 'None'
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.shortName.trim()) return;

    setIsSubmitting(true);
    try {
      const shortName = formData.shortName.trim();
      const payload = {
        name: formData.name.trim(),
        shortName,
        baseUnit: formData.baseUnit || 'None'
      };

      if (editingUnit) {
        await api.put(`/units/${editingUnit.id}`, payload);
        if (logAudit) {
          await logAudit(
            'Unit Updated',
            'Units Management',
            `Updated unit "${formData.name.trim()}" (${shortName}) with base unit "${formData.baseUnit}".`
          );
        }
      } else {
        await api.post('/units', payload);
        if (logAudit) {
          await logAudit(
            'Unit Created',
            'Units Management',
            `Created unit "${formData.name.trim()}" (${shortName}) with base unit "${formData.baseUnit}".`
          );
        }
      }
      setShowModal(false);
      await fetchUnits();
    } catch (err) {
      console.error('Failed to save unit:', err);
      alert(err.response?.data?.message || 'Failed to save unit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (unit) => {
    if (confirm(`Are you sure you want to delete unit "${unit.name}"?`)) {
      try {
        await api.delete(`/units/${unit.id}`);
        if (logAudit) {
          await logAudit(
            'Unit Deleted',
            'Units Management',
            `Deleted unit "${unit.name}" (ID: ${unit.id}).`
          );
        }
        await fetchUnits();
      } catch (err) {
        console.error('Failed to delete unit:', err);
        alert(err.response?.data?.message || 'Failed to delete unit.');
      }
    }
  };

  const filteredUnits = units.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = u.name?.toLowerCase().includes(q);
    const shortMatch = (u.shortName || u.abbreviation || '').toLowerCase().includes(q);
    const baseMatch = (u.baseUnit || '').toLowerCase().includes(q);
    return nameMatch || shortMatch || baseMatch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>Units of Measurement</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {units.length} Units
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure units for product inventory, sales ordering, and warehouse bulk packaging conversion.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Unit
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search units by name or abbreviation..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Units Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-5">Unit Name</th>
                <th className="py-3.5 px-5">Short Name</th>
                <th className="py-3.5 px-5">Base Unit</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredUnits.map(unit => {
                const short = unit.shortName || unit.abbreviation || '—';
                const base = unit.baseUnit || 'None';

                return (
                  <tr 
                    key={unit.id} 
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                          <Ruler className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {unit.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ID: {unit.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
                        {short}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        base === 'None' || !base
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        <Scale className="w-3.5 h-3.5" />
                        {base}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(unit)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                          title="Edit Unit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(unit)}
                          className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-xl transition-colors"
                          title="Delete Unit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUnits.length === 0 && (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <Ruler className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No units found</p>
              <p className="text-xs mt-1">Click "Add Unit" to create a new measurement standard.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Unit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden my-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Ruler className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingUnit ? 'Edit Unit' : 'Create Unit'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define unit name, short symbol, and base unit reference.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {/* Unit Name */}
              <div>
                <label className={LABEL_CLS}>Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Pieces, Box, Kilogram, Metre..."
                  className={INPUT_CLS}
                />
              </div>

              {/* Short Name */}
              <div>
                <label className={LABEL_CLS}>Short Name *</label>
                <input
                  type="text"
                  required
                  value={formData.shortName}
                  onChange={e => setFormData(prev => ({ ...prev, shortName: e.target.value }))}
                  placeholder="e.g. Pcs, Box, Kg, Mtr..."
                  className={INPUT_CLS}
                />
              </div>

              {/* Base Unit Dropdown */}
              <div>
                <label className={LABEL_CLS}>Base Unit</label>
                <select
                  value={formData.baseUnit}
                  onChange={e => setFormData(prev => ({ ...prev, baseUnit: e.target.value }))}
                  className={INPUT_CLS}
                >
                  <option value="None">None (This is a Base Unit)</option>
                  {units
                    .filter(u => !editingUnit || u.id !== editingUnit.id)
                    .map(u => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.shortName || u.abbreviation})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Select a base unit if this is a composite or container unit (e.g. Box whose base is Pieces).
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingUnit ? 'Update Unit' : 'Save Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
