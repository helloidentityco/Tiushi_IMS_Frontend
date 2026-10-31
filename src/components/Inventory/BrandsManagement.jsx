import React, { useState, useEffect } from 'react';
import { 
  Paintbrush, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Upload, 
  X, 
  ImageIcon, 
  Check, 
  Package,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

const INPUT_CLS =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors';
const LABEL_CLS = 
  'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

export default function BrandsManagement() {
  const { logAudit } = useApp();

  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    logo: ''
  });

  const fetchBrands = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/brands');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setBrands(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
    fetchBrands();
    fetchProducts();
  }, []);

  const handleOpenAdd = () => {
    setEditingBrand(null);
    setFormData({ name: '', logo: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name || '',
      logo: brand.logo || ''
    });
    setShowModal(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Selected image exceeds the 5MB size limit. Please choose a smaller file.');
      return;
    }

    try {
      setIsUploadingImage(true);

      const uploadData = new FormData();
      uploadData.append('image', file);
      uploadData.append('folder', 'identity_ims/brands');

      const res = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const secureUrl = res.data?.data?.url || res.data?.url;
      if (secureUrl) {
        setFormData(prev => ({ ...prev, logo: secureUrl }));
      } else {
        throw new Error('No image URL returned from upload server.');
      }
    } catch (err) {
      console.error('Failed to upload brand logo to Cloudinary:', err);
      alert(err.response?.data?.message || 'Failed to upload image to Cloudinary. Please try again.');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingBrand) {
        await api.put(`/brands/${editingBrand.id}`, {
          name: formData.name.trim(),
          logo: formData.logo || null
        });
        if (logAudit) {
          await logAudit(
            'Brand Updated',
            'Brands Management',
            `Updated brand "${formData.name.trim()}" (ID: ${editingBrand.id}).`
          );
        }
      } else {
        await api.post('/brands', {
          name: formData.name.trim(),
          logo: formData.logo || null
        });
        if (logAudit) {
          await logAudit(
            'Brand Created',
            'Brands Management',
            `Created new brand "${formData.name.trim()}".`
          );
        }
      }
      setShowModal(false);
      await fetchBrands();
    } catch (err) {
      console.error('Failed to save brand:', err);
      alert(err.response?.data?.message || 'Failed to save brand.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (brand) => {
    if (confirm(`Are you sure you want to delete brand "${brand.name}"?`)) {
      try {
        await api.delete(`/brands/${brand.id}`);
        if (logAudit) {
          await logAudit(
            'Brand Deleted',
            'Brands Management',
            `Deleted brand "${brand.name}" (ID: ${brand.id}).`
          );
        }
        await fetchBrands();
      } catch (err) {
        console.error('Failed to delete brand:', err);
        alert(err.response?.data?.message || 'Failed to delete brand.');
      }
    }
  };

  const filteredBrands = brands.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Helper to count products mapped to brand
  const getProductCount = (brandId, brandName) => {
    return products.filter(p => p.brandId === brandId || p.brand === brandName).length;
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>Product Brands</span>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {brands.length} Brands
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage manufacturer labels, brand logos, and original equipment suppliers across your inventory.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Brand
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
            placeholder="Search brands by name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Brands Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-5">Brand Name</th>
                <th className="py-3.5 px-5">Associated Products</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredBrands.map(brand => {
                const prodCount = getProductCount(brand.id, brand.name);
                return (
                  <tr 
                    key={brand.id} 
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3.5">
                        {brand.logo ? (
                          <img
                            src={brand.logo}
                            alt={brand.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0 shadow-2xs"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-sm shrink-0">
                            {brand.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {brand.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ID: {brand.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        {prodCount} items
                      </span>
                    </td>

                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(brand)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                          title="Edit Brand"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(brand)}
                          className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-xl transition-colors"
                          title="Delete Brand"
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

          {filteredBrands.length === 0 && (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <Paintbrush className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No brands found</p>
              <p className="text-xs mt-1">Try another search query or click "Add Brand" to register one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Brand Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden my-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Paintbrush className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingBrand ? 'Edit Brand' : 'Create Brand'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter brand or manufacturer name and upload logo.
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
              {/* Brand Name */}
              <div>
                <label className={LABEL_CLS}>Brand Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Logitech, Sony, Apple, Samsung..."
                  className={INPUT_CLS}
                />
              </div>

              {/* Change Logo / Upload Zone */}
              <div>
                <label className={LABEL_CLS}>Change Logo</label>
                
                {isUploadingImage ? (
                  <div className="flex flex-col items-center justify-center gap-2 h-28 border-2 border-indigo-400 dark:border-indigo-500 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      Uploading to Cloudinary...
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Generating secure image URL
                    </span>
                  </div>
                ) : formData.logo ? (
                  <div className="relative group w-24 h-24 mx-auto my-2 rounded-2xl overflow-hidden border-2 border-indigo-500/40 shadow-md">
                    <img
                      src={formData.logo}
                      alt="Brand Logo Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-semibold gap-1 text-[11px]"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors bg-slate-50/50 dark:bg-slate-800/40 p-4">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingImage}
                      onChange={handleFileChange}
                    />
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                        Upload Brand Logo
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        PNG, JPG or SVG up to 5MB (Cloudinary CDN)
                      </span>
                    </div>
                  </label>
                )}

                {/* Direct Image URL input */}
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Or paste image URL:</span>
                  </div>
                  <input
                    type="url"
                    value={formData.logo}
                    onChange={e => setFormData(prev => ({ ...prev, logo: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className={INPUT_CLS}
                  />
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
                  disabled={isSubmitting || isUploadingImage}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {editingBrand ? 'Update Brand' : 'Save Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
