import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Edit2, Trash2, Package, Camera, X, Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { id: 'liquor',     label: 'Liquor / TASMAC',   emoji: '🍶' },
  { id: 'beer',       label: 'Beer',               emoji: '🍺' },
  { id: 'wine',       label: 'Wine',               emoji: '🍷' },
  { id: 'food',       label: 'Food',               emoji: '🍛' },
  { id: 'cigarette',  label: 'Cigarettes',         emoji: '🚬' },
  { id: 'cooldrink',  label: 'Cool Drinks',        emoji: '🥤' },
  { id: 'water',      label: 'Water / Juice',      emoji: '💧' },
  { id: 'other',      label: 'Other',              emoji: '📦' },
];

const GST_RATES = [0, 5, 12, 18, 28];

const emptyForm = () => ({
  name: '', category: 'liquor', price: '', gstEnabled: false,
  gstRate: 18, unit: 'bottle', barcode: '', description: '', photoURL: '',
});

export default function ProductCatalogPage() {
  const { selectedShop, userProfile } = useAuth();
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const canEdit = userProfile?.role === 'superadmin' || userProfile?.role === 'restaurant';

  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'products'), orderBy('category'), orderBy('name'));
    const unsub = onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [selectedShop]);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    setUploading(true);
    try {
      const storageRef = ref(storage, `shops/${selectedShop.id}/products/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm(p => ({ ...p, photoURL: url }));
      toast.success('Photo uploaded');
    } catch { toast.error('Photo upload failed'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Product name is required');
    if (!form.price || isNaN(form.price)) return toast.error('Enter a valid price');
    setSaving(true);
    try {
      const data = {
        name:        form.name.trim(),
        category:    form.category,
        price:       parseFloat(form.price),
        gstEnabled:  form.gstEnabled,
        gstRate:     form.gstEnabled ? Number(form.gstRate) : 0,
        priceWithGst: form.gstEnabled
          ? parseFloat(form.price) * (1 + Number(form.gstRate) / 100)
          : parseFloat(form.price),
        unit:        form.unit,
        barcode:     form.barcode,
        description: form.description,
        photoURL:    form.photoURL,
        updatedAt:   new Date(),
      };
      if (editId) {
        await updateDoc(doc(db, 'shops', selectedShop.id, 'products', editId), data);
        toast.success('Product updated');
      } else {
        await addDoc(collection(db, 'shops', selectedShop.id, 'products'), { ...data, createdAt: new Date() });
        toast.success('Product added');
      }
      setShowForm(false); setEditId(null); setForm(emptyForm());
    } catch (e) { toast.error('Failed to save product'); console.error(e); }
    finally { setSaving(false); }
  };

  const handleEdit = (p) => {
    setEditId(p.id);
    setForm({ name: p.name, category: p.category, price: p.price, gstEnabled: p.gstEnabled || false, gstRate: p.gstRate || 18, unit: p.unit || 'bottle', barcode: p.barcode || '', description: p.description || '', photoURL: p.photoURL || '' });
    setShowForm(true);
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try { await deleteDoc(doc(db, 'shops', selectedShop.id, 'products', p.id)); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  const filtered = products.filter(p => {
    const matchCat = filterCat === 'all' || p.category === filterCat;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const catOf = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[7];

  if (!selectedShop) return (
    <div className="page-container" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
      <Package size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
      <p>Select a shop to manage products</p>
    </div>
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 26, color: 'var(--text-primary)', margin: 0 }}>Product Catalog</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '4px 0 0' }}>{products.length} items · used in billing search</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => { setEditId(null); setForm(emptyForm()); setShowForm(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={{ paddingLeft: 36 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterCat('all')} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: filterCat === 'all' ? 'var(--gold)' : 'var(--surface)', color: filterCat === 'all' ? '#000' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: filterCat === 'all' ? 700 : 400 }}>All</button>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: filterCat === c.id ? 'var(--gold)' : 'var(--surface)', color: filterCat === c.id ? '#000' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: filterCat === c.id ? 700 : 400 }}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Package size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <p>{search ? 'No products match your search' : 'No products yet — add your first product'}</p>
          {canEdit && !search && <button className="btn-primary" onClick={() => setShowForm(true)} style={{ marginTop: 12 }}>+ Add Product</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(p => {
            const cat = catOf(p.category);
            return (
              <div key={p.id} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                {/* Photo */}
                <div style={{ height: 140, background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {p.photoURL
                    ? <img src={p.photoURL} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ fontSize: 48 }}>{cat.emoji}</div>
                  }
                  <div style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.6)', fontSize: 11, fontWeight: 600, color: '#fff' }}>
                    {cat.emoji} {cat.label}
                  </div>
                  {p.gstEnabled && (
                    <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 20, background: 'rgba(212,160,23,0.9)', fontSize: 11, fontWeight: 700, color: '#000' }}>
                      GST {p.gstRate}%
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  {p.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold)' }}>
                        ₹{p.price.toLocaleString('en-IN')}
                      </div>
                      {p.gstEnabled && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          ₹{(p.priceWithGst || p.price).toFixed(2)} with GST
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>per {p.unit || 'unit'}</div>
                  </div>
                </div>
                {/* Actions */}
                {canEdit && (
                  <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
                    <button onClick={() => handleEdit(p)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Edit2 size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(p)} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={14} color="#ff3b30" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? '✏️ Edit Product' : '➕ Add New Product'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Photo */}
              <div>
                <label className="form-label">Product Photo</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: 12, background: 'var(--surface-elevated)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {form.photoURL
                      ? <img src={form.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Camera size={24} color="var(--text-muted)" />
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, width: '100%' }}>
                      {uploading ? 'Uploading…' : '📷 Choose Photo'}
                    </button>
                    {form.photoURL && <button onClick={() => setForm(p => ({ ...p, photoURL: '' }))} style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.08)', color: '#ff3b30', cursor: 'pointer', fontSize: 12, width: '100%' }}>Remove Photo</button>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Max 2MB · JPG or PNG</div>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>

              {/* Name */}
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kingfisher Strong 650ml" autoFocus />
              </div>

              {/* Price + Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Price (₹) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-select" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                    {['bottle','glass','peg','plate','piece','pack','can','litre','ml','kg','g'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* GST Toggle */}
              <div style={{ background: 'var(--surface-elevated)', borderRadius: 12, padding: '14px 16px', border: `1px solid ${form.gstEnabled ? 'var(--gold)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.gstEnabled ? 12 : 0 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>GST Applicable</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Include GST in billing</div>
                  </div>
                  <button onClick={() => setForm(p => ({ ...p, gstEnabled: !p.gstEnabled }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28 }}>
                    {form.gstEnabled
                      ? <span style={{ color: 'var(--gold)' }}>✅</span>
                      : <span style={{ color: 'var(--text-muted)' }}>⬜</span>
                    }
                  </button>
                </div>
                {form.gstEnabled && (
                  <div>
                    <label className="form-label">GST Rate</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {GST_RATES.map(r => (
                        <button key={r} onClick={() => setForm(p => ({ ...p, gstRate: r }))} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${form.gstRate === r ? 'var(--gold)' : 'var(--border)'}`, background: form.gstRate === r ? 'rgba(212,160,23,0.15)' : 'var(--surface)', color: form.gstRate === r ? 'var(--gold)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: form.gstRate === r ? 700 : 400 }}>
                          {r}%
                        </button>
                      ))}
                    </div>
                    {form.price && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(212,160,23,0.08)', borderRadius: 8, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Price + GST = </span>
                        <span style={{ fontWeight: 700, color: 'var(--gold)' }}>₹{(parseFloat(form.price || 0) * (1 + form.gstRate / 100)).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Barcode + Description */}
              <div className="form-group">
                <label className="form-label">Barcode / SKU (optional)</label>
                <input className="form-input" value={form.barcode} onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))} placeholder="e.g. 8901063150225" />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Short note about this product" style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 120 }}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : editId ? '✅ Update' : '✅ Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
