import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Sparkles,
  Tag,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

const INPUT_CLS =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors';
const LABEL_CLS = 
  'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

export default function VariantsManagement() {
  const { logAudit } = useApp();

  const [variants, setVariants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    values: []
  });

  const [currentTagInput, setCurrentTagInput] = useState('');

  const fetchVariants = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/variants');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setVariants(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch variants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVariants();
  }, []);

  const handleOpenAdd = () => {
    setEditingVariant(null);
    setFormData({ name: '', values: [] });
    setCurrentTagInput('');
    setShowModal(true);
  };

  const handleOpenEdit = (variant) => {
    setEditingVariant(variant);
    // ensure values is an array
    let parsedValues = [];
    if (Array.isArray(variant.options)) {
      parsedValues = [...variant.options];
    } else if (Array.isArray(variant.values)) {
      parsedValues = [...variant.values];
    } else if (typeof variant.options === 'string') {
      try {
        const parsed = JSON.parse(variant.options);
        parsedValues = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        parsedValues = variant.options.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else if (typeof variant.value === 'string') {
      parsedValues = variant.value.split(',').map(s => s.trim()).filter(Boolean);
    }
    setFormData({
      name: variant.name || '',
      values: parsedValues
    });
    setCurrentTagInput('');
    setShowModal(true);
  };

  const handleAddTag = () => {
    const trimmed = currentTagInput.trim();
    if (!trimmed) return;
    if (!formData.values.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        values: [...prev.values, trimmed]
      }));
    }
    setCurrentTagInput('');
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      values: prev.values.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    // If there is any leftover text in currentTagInput, add it
    let finalValues = [...formData.values];
    if (currentTagInput.trim() && !finalValues.includes(currentTagInput.trim())) {
      finalValues.push(currentTagInput.trim());
    }

    setIsSubmitting(true);
    try {
      if (editingVariant) {
        await api.put(`/variants/${editingVariant.id}`, {
          name: formData.name.trim(),
          options: finalValues
        });
        if (logAudit) {
          await logAudit(
            'Variant Updated',
            'Variants Management',
            `Updated variant "${formData.name.trim()}" with values [${finalValues.join(', ')}].`
          );
        }
      } else {
        await api.post('/variants', {
          name: formData.name.trim(),
          options: finalValues
        });
        if (logAudit) {
          await logAudit(
            'Variant Created',
            'Variants Management',
            `Created new variant "${formData.name.trim()}" with values [${finalValues.join(', ')}].`
          );
        }
      }
      setShowModal(false);
      await fetchVariants();
    } catch (err) {
      console.error('Failed to save variant:', err);
      alert(err.response?.data?.message || 'Failed to save variant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (variant) => {
    if (confirm(`Are you sure you want to delete variant "${variant.name}"?`)) {
      try {
        await api.delete(`/variants/${variant.id}`);
        if (logAudit) {
          await logAudit(
            'Variant Deleted',
            'Variants Management',
            `Deleted variant "${variant.name}" (ID: ${variant.id}).`
          );
        }
        await fetchVariants();
      } catch (err) {
        console.error('Failed to delete variant:', err);
        alert(err.response?.data?.message || 'Failed to delete variant.');
      }
    }
  };

  const filteredVariants = variants.filter(v => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = v.name?.toLowerCase().includes(q);
    const valMatch = (v.values || []).some(val => val.toLowerCase().includes(q)) || 
                     (v.value || '').toLowerCase().includes(q);
    return nameMatch || valMatch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>Product Variants</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {variants.length} Attributes
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure dynamic product variations like Color, Storage Capacity, Size, and Connectivity options.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Variant
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
            placeholder="Search variants or option values..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Variants Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-5">Variant Name</th>
                <th className="py-3.5 px-5">Variant Values (Options)</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredVariants.map(variant => {
                const values = Array.isArray(variant.options) 
                  ? variant.options 
                  : (Array.isArray(variant.values)
                    ? variant.values
                    : (variant.value ? variant.value.split(',').map(s => s.trim()) : []));

                return (
                  <tr 
                    key={variant.id} 
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {variant.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ID: {variant.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap gap-1.5 max-w-xl">
                        {values.map((val, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80"
                          >
                            {val}
                          </span>
                        ))}
                        {values.length === 0 && (
                          <span className="text-slate-400 italic text-[11px]">
                            No values configured
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(variant)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                          title="Edit Variant"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(variant)}
                          className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-xl transition-colors"
                          title="Delete Variant"
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

          {filteredVariants.length === 0 && (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No variants found</p>
              <p className="text-xs mt-1">Click "Add Variant" to configure product variation options.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Variant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden my-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingVariant ? 'Edit Variant' : 'Create Variant'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define attribute name and add multiple option values.
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
              {/* Variant Name */}
              <div>
                <label className={LABEL_CLS}>Variant Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Color, Size, Storage Capacity, Material..."
                  className={INPUT_CLS}
                />
              </div>

              {/* Variant Types / Values with Tag Input */}
              <div>
                <label className={LABEL_CLS}>Variant Types / Values *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentTagInput}
                    onChange={e => setCurrentTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Type value (e.g. Red, 256GB) and press Enter or '+'"
                    className={INPUT_CLS}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="shrink-0 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center transition-colors shadow-xs"
                    title="Add value tag"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Tags / Chips Display */}
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl min-h-[70px] flex flex-wrap gap-2 items-center">
                  {formData.values.length === 0 ? (
                    <span className="text-slate-400 text-xs italic">
                      No tags added yet. Enter values above to build option list.
                    </span>
                  ) : (
                    formData.values.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shadow-2xs group"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(idx)}
                          className="text-slate-400 hover:text-rose-500 rounded-full p-0.5 transition-colors"
                          title="Remove tag"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
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
                  {editingVariant ? 'Update Variant' : 'Save Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
