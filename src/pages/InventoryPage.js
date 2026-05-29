import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy, doc,
  updateDoc, deleteDoc, getDocs, where, limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import {
  Plus, Search, Edit2, Trash2, Package, Camera, X,
  ChevronDown, ChevronUp, AlertTriangle, TrendingDown,
  TrendingUp, BarChart2, RefreshCw, Filter, Download,
  ArrowUpRight, ArrowDownRight, Eye, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── Constants ────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'all',        label: 'All Items',        emoji: '📦', color: '#64748b' },
  { id: 'liquor',     label: 'Liquor / TASMAC',  emoji: '🍶', color: '#7c3aed' },
  { id: 'beer',       label: 'Beer',             emoji: '🍺', color: '#d97706' },
  { id: 'wine',       label: 'Wine',             emoji: '🍷', color: '#be185d' },
  { id: 'food',       label: 'Food',             emoji: '🍛', color: '#059669' },
  { id: 'cigarette',  label: 'Cigarettes',       emoji: '🚬', color: '#475569' },
  { id: 'cooldrink',  label: 'Cool Drinks',      emoji: '🥤', color: '#0891b2' },
  { id: 'water',      label: 'Water / Juice',    emoji: '💧', color: '#0284c7' },
  { id: 'other',      label: 'Other',            emoji: '📦', color: '#64748b' },
];
const GST_RATES  = [0, 5, 12, 18, 28];
const UNITS      = ['bottle', 'glass', 'peg', 'plate', 'piece', 'pack', 'can', 'litre', 'ml', 'kg', 'g', 'box', 'carton'];
const catOf = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[8];
const fmt   = (n, dec = 0) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;

const emptyItem = () => ({
  name: '', category: 'liquor', purchasePrice: '', sellingPrice: '',
  gstEnabled: false, gstRate: 18, unit: 'bottle',
  minStock: 5, currentStock: 0, description: '', barcode: '', photoURL: '',
});

/* ══════════════════════════════════════════════════════════════════════
   TABS: Items | Stock Entry | History | Reports
══════════════════════════════════════════════════════════════════════ */
export default function InventoryPage() {
  const { selectedShop } = useAuth();
  const [tab, setTab]             = useState('items');
  const [items, setItems]         = useState([]);
  const [entries, setEntries]     = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch]       = useState('');
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [itemForm, setItemForm]   = useState(emptyItem());
  const [savingItem, setSavingItem] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showStockModal, setShowStockModal] = useState(null); // item to update stock for
  const [expandedItem, setExpandedItem] = useState(null);
  const fileRef = useRef();

  /* ── Load items ── */
  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'inventory_items'), orderBy('name'));
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingItems(false);
    }, () => setLoadingItems(false));
    return unsub;
  }, [selectedShop]);

  /* ── Load stock entries ── */
  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'inventory_entries'), orderBy('date', 'desc'), limit(60));
    const unsub = onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [selectedShop]);

  /* ── Photo upload ── */
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    setUploading(true);
    try {
      const sref = ref(storage, `shops/${selectedShop.id}/inventory/${Date.now()}_${file.name}`);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      setItemForm(p => ({ ...p, photoURL: url }));
      toast.success('Photo uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  /* ── Save item ── */
  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) return toast.error('Item name required');
    if (!itemForm.purchasePrice) return toast.error('Purchase price required');
    setSavingItem(true);
    try {
      const data = {
        name:          itemForm.name.trim(),
        category:      itemForm.category,
        purchasePrice: parseFloat(itemForm.purchasePrice),
        sellingPrice:  parseFloat(itemForm.sellingPrice) || parseFloat(itemForm.purchasePrice),
        gstEnabled:    itemForm.gstEnabled,
        gstRate:       itemForm.gstEnabled ? Number(itemForm.gstRate) : 0,
        unit:          itemForm.unit,
        minStock:      Number(itemForm.minStock) || 5,
        currentStock:  editItemId
          ? (items.find(i => i.id === editItemId)?.currentStock || 0)
          : Number(itemForm.currentStock) || 0,
        description:   itemForm.description,
        barcode:       itemForm.barcode,
        photoURL:      itemForm.photoURL,
        updatedAt:     new Date(),
      };
      if (editItemId) {
        await updateDoc(doc(db, 'shops', selectedShop.id, 'inventory_items', editItemId), data);
        toast.success('Item updated ✅');
      } else {
        await addDoc(collection(db, 'shops', selectedShop.id, 'inventory_items'), { ...data, createdAt: new Date() });
        toast.success('Item added ✅');
      }
      setShowItemForm(false); setEditItemId(null); setItemForm(emptyItem());
    } catch (e) { toast.error('Failed to save'); console.error(e); }
    finally { setSavingItem(false); }
  };

  const handleEditItem = (item) => {
    setEditItemId(item.id);
    setItemForm({ name: item.name, category: item.category, purchasePrice: item.purchasePrice, sellingPrice: item.sellingPrice, gstEnabled: item.gstEnabled || false, gstRate: item.gstRate || 18, unit: item.unit || 'bottle', minStock: item.minStock || 5, currentStock: item.currentStock || 0, description: item.description || '', barcode: item.barcode || '', photoURL: item.photoURL || '' });
    setShowItemForm(true);
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    await deleteDoc(doc(db, 'shops', selectedShop.id, 'inventory_items', item.id));
    toast.success('Item deleted');
  };

  /* ── Filter ── */
  const filtered = items.filter(it => {
    const matchCat = filterCat === 'all' || it.category === filterCat;
    const matchQ   = it.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  /* ── Stats ── */
  const totalItems    = items.length;
  const totalValue    = items.reduce((s, i) => s + (i.currentStock || 0) * (i.purchasePrice || 0), 0);
  const lowStockCount = items.filter(i => (i.currentStock || 0) <= (i.minStock || 5)).length;
  const outOfStock    = items.filter(i => (i.currentStock || 0) === 0).length;

  if (!selectedShop) return (
    <div className="page-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <Package size={48} style={{ opacity: 0.2, color: '#94a3b8', marginBottom: 16 }} />
      <p style={{ color: '#94a3b8' }}>Select a shop to manage inventory</p>
    </div>
  );

  const TABS = [
    { id: 'items',   icon: '📦', label: 'Items'       },
    { id: 'entry',   icon: '📝', label: 'Stock Entry' },
    { id: 'history', icon: '📋', label: 'History'     },
    { id: 'reports', icon: '📊', label: 'Reports'     },
  ];

  return (
    <div className="page-container fade-in">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 28, color: '#0f172a', margin: 0 }}>Inventory</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '3px 0 0' }}>Item-wise stock tracking, COGS & purchase management</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditItemId(null); setItemForm(emptyItem()); setShowItemForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', fontSize: 14 }}>
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Items',    value: totalItems,    icon: '📦', color: '#2563eb', bg: '#eff6ff',  isCnt: true },
          { label: 'Stock Value',    value: totalValue,    icon: '💰', color: '#059669', bg: '#ecfdf5',  isCnt: false },
          { label: 'Low Stock',      value: lowStockCount, icon: '⚠️', color: '#d97706', bg: '#fffbeb',  isCnt: true },
          { label: 'Out of Stock',   value: outOfStock,    icon: '🚫', color: '#dc2626', bg: '#fef2f2',  isCnt: true },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{k.icon}</div>
              <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            </div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 24, color: k.color }}>
              {k.isCnt ? k.value : fmt(k.value)}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 2, background: '#fff', borderRadius: 14, padding: 4, border: '1.5px solid #e2e8f0', width: 'fit-content', marginBottom: 24, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '9px 20px', borderRadius: 11, border: 'none', cursor: 'pointer', background: tab === t.id ? '#2563eb' : 'transparent', color: tab === t.id ? '#fff' : '#64748b', fontWeight: tab === t.id ? 700 : 500, fontSize: 13.5, transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ════ TAB: ITEMS ════════════════════════════════════════════════ */}
      {tab === 'items' && (
        <>
          {/* Search + category filter */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" style={{ paddingLeft: 38 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setFilterCat(c.id)} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${filterCat === c.id ? c.color : '#e2e8f0'}`, background: filterCat === c.id ? c.color + '14' : '#fff', color: filterCat === c.id ? c.color : '#64748b', cursor: 'pointer', fontSize: 12.5, fontWeight: filterCat === c.id ? 700 : 500, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {loadingItems ? (
            <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20, border: '1.5px dashed #e2e8f0' }}>
              <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>📦</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 18, color: '#475569', marginBottom: 8 }}>
                {search ? `No items match "${search}"` : 'No items yet'}
              </div>
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>Add your first inventory item to get started</p>
              <button className="btn-primary" onClick={() => setShowItemForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Plus size={15} /> Add Your First Item
              </button>
            </div>
          ) : (
            /* ── Item cards grid ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {filtered.map(item => {
                const cat       = catOf(item.category);
                const isLow     = (item.currentStock || 0) <= (item.minStock || 5);
                const isOut     = (item.currentStock || 0) === 0;
                const stockVal  = (item.currentStock || 0) * (item.purchasePrice || 0);
                const isExpanded = expandedItem === item.id;

                return (
                  <div key={item.id} style={{ background: '#fff', borderRadius: 18, border: `1.5px solid ${isOut ? '#fecaca' : isLow ? '#fde68a' : '#e2e8f0'}`, boxShadow: '0 2px 10px rgba(15,23,42,0.06)', overflow: 'hidden', transition: 'all 0.2s' }}>
                    {/* Card header */}
                    <div style={{ display: 'flex', gap: 14, padding: '16px 18px 12px' }}>
                      {/* Photo / emoji */}
                      <div style={{ width: 56, height: 56, borderRadius: 14, background: cat.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${cat.color}25` }}>
                        {item.photoURL
                          ? <img src={item.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 26 }}>{cat.emoji}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', lineHeight: 1.3 }}>{item.name}</div>
                          {(isOut || isLow) && (
                            <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: isOut ? '#fef2f2' : '#fffbeb', color: isOut ? '#dc2626' : '#d97706', border: `1px solid ${isOut ? '#fecaca' : '#fde68a'}` }}>
                              {isOut ? '🚫 Out' : '⚠️ Low'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cat.color + '14', color: cat.color, border: `1px solid ${cat.color}25` }}>{cat.emoji} {cat.label}</span>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.unit}</span>
                          {item.gstEnabled && <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>GST {item.gstRate}%</span>}
                        </div>
                      </div>
                    </div>

                    {/* Stock gauge */}
                    <div style={{ padding: '0 18px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Current Stock</span>
                        <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 22, color: isOut ? '#dc2626' : isLow ? '#d97706' : '#059669' }}>
                          {item.currentStock || 0}
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', marginLeft: 4 }}>{item.unit}</span>
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 6, borderRadius: 6, background: '#f1f5f9', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 6, background: isOut ? '#dc2626' : isLow ? '#f59e0b' : '#2563eb', width: `${Math.min(100, Math.max(5, ((item.currentStock || 0) / Math.max(item.minStock * 3 || 15, 1)) * 100))}%`, transition: 'width 0.4s ease' }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Min: {item.minStock || 5} {item.unit}</div>
                    </div>

                    {/* Price row */}
                    <div style={{ padding: '10px 18px', background: '#f8faff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>PURCHASE</div>
                        <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 16 }}>{fmt(item.purchasePrice, 2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>SELLING</div>
                        <div style={{ fontWeight: 800, color: '#059669', fontSize: 16 }}>{fmt(item.sellingPrice || item.purchasePrice, 2)}</div>
                      </div>
                      <div style={{ marginLeft: 'auto' }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>STOCK VALUE</div>
                        <div style={{ fontWeight: 800, color: '#2563eb', fontSize: 16 }}>{fmt(stockVal, 0)}</div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => setShowStockModal(item)} style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                        onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}>
                        <RefreshCw size={13} /> Update Stock
                      </button>
                      <button onClick={() => handleEditItem(item)} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit2 size={14} color="#475569" />
                      </button>
                      <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isExpanded ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}
                      </button>
                      <button onClick={() => handleDeleteItem(item)} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={14} color="#dc2626" />
                      </button>
                    </div>

                    {/* Expanded: recent movements */}
                    {isExpanded && (
                      <ItemHistory itemId={item.id} shopId={selectedShop.id} item={item} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ════ TAB: STOCK ENTRY ══════════════════════════════════════════ */}
      {tab === 'entry' && (
        <StockEntryTab shopId={selectedShop.id} items={items} />
      )}

      {/* ════ TAB: HISTORY ══════════════════════════════════════════════ */}
      {tab === 'history' && (
        <HistoryTab entries={entries} items={items} />
      )}

      {/* ════ TAB: REPORTS ══════════════════════════════════════════════ */}
      {tab === 'reports' && (
        <ReportsTab items={items} entries={entries} />
      )}

      {/* ════ MODAL: ADD/EDIT ITEM ═══════════════════════════════════════ */}
      {showItemForm && (
        <ItemFormModal
          editItemId={editItemId}
          form={itemForm}
          setForm={setItemForm}
          onSave={handleSaveItem}
          onClose={() => { setShowItemForm(false); setEditItemId(null); setItemForm(emptyItem()); }}
          saving={savingItem}
          uploading={uploading}
          fileRef={fileRef}
          handlePhoto={handlePhoto}
        />
      )}

      {/* ════ MODAL: UPDATE STOCK ════════════════════════════════════════ */}
      {showStockModal && (
        <UpdateStockModal
          item={showStockModal}
          shopId={selectedShop.id}
          onClose={() => setShowStockModal(null)}
        />
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ITEM FORM MODAL
══════════════════════════════════════════════════════════════════════ */
function ItemFormModal({ editItemId, form, setForm, onSave, onClose, saving, uploading, fileRef, handlePhoto }) {
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const cat = catOf(form.category);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(15,23,42,0.18)', border: '1.5px solid #e2e8f0' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 20, marginBottom: 0 }}>
          <div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: '#0f172a' }}>
              {editItemId ? '✏️ Edit Item' : '➕ Add New Item'}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Fill details to track this item in inventory</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#64748b' }}>✕</button>
        </div>

        <div style={{ padding: '24px 28px 0' }}>
          {/* Photo + basic info */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
            {/* Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ width: 90, height: 90, borderRadius: 18, background: cat.color + '14', border: `2px dashed ${cat.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                {form.photoURL
                  ? <img src={form.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 28 }}>{cat.emoji}</span>
                      <div style={{ fontSize: 10, color: cat.color, fontWeight: 600, marginTop: 2 }}>Add Photo</div>
                    </div>
                }
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                {uploading ? '⏳ Uploading…' : '📷 Photo'}
              </button>
            </div>

            {/* Name + category */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Item Name *</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Kingfisher Strong 650ml" style={{ fontSize: 15, fontWeight: 600 }} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Category quick-select pills */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Quick Select Category</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                <button key={c.id} onClick={() => set('category', c.id)} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${form.category === c.id ? c.color : '#e2e8f0'}`, background: form.category === c.id ? c.color : '#fff', color: form.category === c.id ? '#fff' : '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prices */}
          <div style={{ background: '#f8faff', borderRadius: 14, padding: '16px 18px', marginBottom: 20, border: '1.5px solid #e0e7ff' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>💰 Pricing</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Purchase Price ₹ *</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} placeholder="0.00" style={{ fontWeight: 700 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price ₹</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} placeholder="0.00" style={{ fontWeight: 700 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* GST */}
          <div style={{ background: form.gstEnabled ? '#eff6ff' : '#f8fafc', borderRadius: 14, padding: '14px 18px', marginBottom: 20, border: `1.5px solid ${form.gstEnabled ? '#bfdbfe' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.gstEnabled ? 14 : 0 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>GST Applicable</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>Apply GST on this item's billing</div>
              </div>
              <button onClick={() => set('gstEnabled', !form.gstEnabled)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26 }}>
                {form.gstEnabled ? '✅' : '⬜'}
              </button>
            </div>
            {form.gstEnabled && (
              <>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 8 }}>Select GST Rate</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {GST_RATES.map(r => (
                    <button key={r} onClick={() => set('gstRate', r)} style={{ flex: 1, padding: '9px 4px', borderRadius: 10, border: `2px solid ${form.gstRate === r ? '#2563eb' : '#e2e8f0'}`, background: form.gstRate === r ? '#2563eb' : '#fff', color: form.gstRate === r ? '#fff' : '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.15s' }}>
                      {r}%
                    </button>
                  ))}
                </div>
                {form.purchasePrice && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Selling price + GST</span>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>
                      {fmt((parseFloat(form.sellingPrice || form.purchasePrice || 0)) * (1 + form.gstRate / 100), 2)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Stock levels */}
          <div style={{ display: 'grid', gridTemplateColumns: editItemId ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">⚠️ Min Stock Alert (when to warn)</label>
              <input className="form-input" type="number" min="0" value={form.minStock} onChange={e => set('minStock', e.target.value)} placeholder="5" />
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Alert when stock falls below this number</div>
            </div>
            {!editItemId && (
              <div className="form-group">
                <label className="form-label">Opening Stock</label>
                <input className="form-input" type="number" min="0" value={form.currentStock} onChange={e => set('currentStock', e.target.value)} placeholder="0" />
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>How many {form.unit}s do you have now?</div>
              </div>
            )}
          </div>

          {/* Barcode + notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <div className="form-group">
              <label className="form-label">Barcode / SKU</label>
              <input className="form-input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Optional barcode" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short note (optional)" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: 12, borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '12px', fontWeight: 600 }}>Cancel</button>
          <button onClick={onSave} disabled={saving} className="btn-primary" style={{ flex: 2, padding: '12px', fontWeight: 700, fontSize: 15, justifyContent: 'center' }}>
            {saving ? <><div className="spinner" style={{ width: 15, height: 15, borderTopColor: '#fff' }} /> Saving…</> : editItemId ? '✅ Update Item' : '✅ Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   UPDATE STOCK MODAL (MyBillBook style)
══════════════════════════════════════════════════════════════════════ */
function UpdateStockModal({ item, shopId, onClose }) {
  const [type, setType]       = useState('purchase');  // purchase | adjustment | wastage | return
  const [qty, setQty]         = useState('');
  const [price, setPrice]     = useState(item.purchasePrice || '');
  const [supplier, setSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [notes, setNotes]     = useState('');
  const [date, setDate]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving]   = useState(false);

  const cat       = catOf(item.category);
  const newStock  = type === 'adjustment'
    ? Number(qty) || item.currentStock
    : type === 'wastage' || type === 'return_to_supplier'
    ? (item.currentStock || 0) - (Number(qty) || 0)
    : (item.currentStock || 0) + (Number(qty) || 0);

  const TYPES = [
    { id: 'purchase',            label: 'Purchase / Restock', icon: '📥', color: '#059669', desc: 'Add stock from supplier' },
    { id: 'adjustment',          label: 'Physical Count',     icon: '🔢', color: '#2563eb', desc: 'Set actual counted stock' },
    { id: 'wastage',             label: 'Wastage / Damage',   icon: '🗑️', color: '#dc2626', desc: 'Remove damaged/expired' },
    { id: 'return_to_supplier',  label: 'Return to Supplier', icon: '↩️', color: '#d97706', desc: 'Return items back' },
  ];

  const handleSave = async () => {
    if (!qty && type !== 'adjustment') return toast.error('Enter quantity');
    if (type === 'adjustment' && (qty === '' || isNaN(Number(qty)))) return toast.error('Enter actual stock count');
    setSaving(true);
    try {
      const actualQty = Number(qty);
      const stockDelta = type === 'adjustment' ? actualQty - (item.currentStock || 0)
        : type === 'purchase' ? actualQty
        : -actualQty;

      // Update item stock
      await updateDoc(doc(db, 'shops', shopId, 'inventory_items', item.id), {
        currentStock: Math.max(0, (item.currentStock || 0) + stockDelta),
        updatedAt: new Date(),
      });

      // Save movement record
      await addDoc(collection(db, 'shops', shopId, 'inventory_entries'), {
        itemId:       item.id,
        itemName:     item.name,
        category:     item.category,
        type,
        qty:          actualQty,
        stockBefore:  item.currentStock || 0,
        stockAfter:   Math.max(0, (item.currentStock || 0) + stockDelta),
        purchasePrice: parseFloat(price) || item.purchasePrice,
        totalValue:   actualQty * (parseFloat(price) || item.purchasePrice),
        supplier, invoiceNo, notes, date,
        createdAt: new Date(),
      });

      toast.success(`Stock updated! Now: ${Math.max(0, (item.currentStock || 0) + stockDelta)} ${item.unit}`);
      onClose();
    } catch (e) { toast.error('Failed to update'); console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(15,23,42,0.18)', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Header with item info */}
        <div style={{ background: `linear-gradient(135deg, ${cat.color}15, ${cat.color}08)`, padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: cat.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {item.photoURL ? <img src={item.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 26 }}>{cat.emoji}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 17, color: '#0f172a' }}>{item.name}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                Current: <strong style={{ color: '#0f172a' }}>{item.currentStock || 0} {item.unit}</strong> · Purchase: <strong style={{ color: '#dc2626' }}>{fmt(item.purchasePrice, 2)}</strong>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#64748b' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Transaction type */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Transaction Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TYPES.map(t => (
                <button key={t.id} onClick={() => setType(t.id)} style={{ padding: '10px 12px', borderRadius: 12, border: `2px solid ${type === t.id ? t.color : '#e2e8f0'}`, background: type === t.id ? t.color + '12' : '#f8fafc', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: type === t.id ? t.color : '#0f172a' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Qty + price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">{type === 'adjustment' ? 'Actual Count (physical)' : `Quantity (${item.unit})`}</label>
              <input className="form-input" type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} placeholder={type === 'adjustment' ? 'e.g. 24' : 'e.g. 10'} style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }} autoFocus />
            </div>
            {type === 'purchase' && (
              <div className="form-group">
                <label className="form-label">Purchase Price ₹</label>
                <input className="form-input" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} style={{ fontWeight: 700 }} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {type === 'purchase' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Supplier Name</label>
                <input className="form-input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="TASMAC / vendor name" />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice / Bill No.</label>
                <input className="form-input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-001" />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Notes</label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>

          {/* Preview result */}
          {qty && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: newStock < 0 ? '#fef2f2' : '#f0fdf4', border: `1.5px solid ${newStock < 0 ? '#fecaca' : '#bbf7d0'}`, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>After this transaction</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: newStock < 0 ? '#dc2626' : '#059669', fontFamily: 'Syne,sans-serif' }}>
                  {Math.max(0, newStock)} {item.unit}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  {type === 'purchase' ? 'Purchase Value' : 'Stock Change'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: type === 'purchase' ? '#dc2626' : '#475569' }}>
                  {type === 'purchase' ? `${fmt(Number(qty) * parseFloat(price || 0), 2)}` : `${Number(qty) > 0 ? (type === 'purchase' ? '+' : '−') : ''}${qty} ${item.unit}`}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '12px', fontWeight: 600 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, padding: '12px', fontWeight: 700, justifyContent: 'center' }}>
            {saving ? <><div className="spinner" style={{ width: 15, height: 15, borderTopColor: '#fff' }} /> Saving…</> : '✅ Update Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STOCK ENTRY TAB — bulk daily entry like old form but item-wise
══════════════════════════════════════════════════════════════════════ */
function StockEntryTab({ shopId, items }) {
  const [date, setDate]     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rows, setRows]     = useState([]);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('all');

  const filtered = items.filter(i => filterCat === 'all' || i.category === filterCat);

  useEffect(() => {
    setRows(filtered.map(i => ({ itemId: i.id, name: i.name, category: i.category, unit: i.unit, opening: i.currentStock || 0, purchases: '', closing: '', notes: '' })));
  }, [items, filterCat]);

  const update = (idx, k, v) => setRows(p => p.map((r, i) => i === idx ? { ...r, [k]: v } : r));

  const totalCogs = rows.reduce((s, r) => {
    const o = parseFloat(r.opening) || 0, p = parseFloat(r.purchases) || 0, c = parseFloat(r.closing) || 0;
    return s + (o + p - c);
  }, 0);

  const handleSave = async () => {
    const toSave = rows.filter(r => r.closing !== '');
    if (!toSave.length) return toast.error('Enter at least one closing stock');
    setSaving(true);
    try {
      for (const row of toSave) {
        const o = parseFloat(row.opening) || 0, p = parseFloat(row.purchases) || 0, c = parseFloat(row.closing) || 0;
        const cogs = o + p - c;
        // Save entry
        await addDoc(collection(db, 'shops', shopId, 'inventory_entries'), {
          itemId: row.itemId, itemName: row.name, category: row.category,
          type: 'day_close', qty: c, stockBefore: o, stockAfter: c,
          purchasesAdded: p, cogs, notes: row.notes, date, createdAt: new Date(),
        });
        // Update item current stock
        await updateDoc(doc(db, 'shops', shopId, 'inventory_items', row.itemId), {
          currentStock: c, updatedAt: new Date(),
        });
      }
      toast.success(`✅ ${toSave.length} items updated`);
    } catch (e) { toast.error('Failed'); console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setFilterCat(c.id)} style={{ padding: '7px 12px', borderRadius: 20, border: `1.5px solid ${filterCat === c.id ? c.color : '#e2e8f0'}`, background: filterCat === c.id ? c.color + '14' : '#fff', color: filterCat === c.id ? c.color : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: filterCat === c.id ? 700 : 500 }}>
                {c.emoji}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving ? <><div className="spinner" style={{ width: 15, height: 15, borderTopColor: '#fff' }} />Saving…</> : '💾 Save Day Close'}
        </button>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: '#fff', borderRadius: 16, border: '1.5px dashed #e2e8f0' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📦</div>
          <p>No items in this category. Add items first.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(15,23,42,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8faff' }}>
                {['Item', 'Opening', 'Purchases Added', 'Closing (Count)', 'COGS', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const o = parseFloat(row.opening) || 0, p = parseFloat(row.purchases) || 0, c = parseFloat(row.closing);
                const cogs = !isNaN(c) ? o + p - c : null;
                const cat  = catOf(row.category);
                return (
                  <tr key={row.itemId} style={{ borderBottom: '1px solid #e2e8f0' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 8, background: cat.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{cat.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{row.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>{row.opening}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <input type="number" min="0" value={row.purchases} onChange={e => update(idx, 'purchases', e.target.value)}
                        style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f0fdf4', fontWeight: 600, color: '#059669', outline: 'none', fontSize: 13 }}
                        placeholder="0" />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <input type="number" min="0" value={row.closing} onChange={e => update(idx, 'closing', e.target.value)}
                        style={{ width: 100, padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${row.closing !== '' ? '#2563eb' : '#e2e8f0'}`, background: row.closing !== '' ? '#eff6ff' : '#fff', fontWeight: 700, color: '#2563eb', outline: 'none', fontSize: 14 }}
                        placeholder="Count…" />
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: cogs !== null ? (cogs > 0 ? '#dc2626' : '#059669') : '#94a3b8', fontSize: 14 }}>
                      {cogs !== null ? `${cogs > 0 ? '−' : '+'}${Math.abs(cogs)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <input value={row.notes} onChange={e => update(idx, 'notes', e.target.value)}
                        style={{ width: 110, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, outline: 'none', color: '#475569' }}
                        placeholder="Note…" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8faff', borderTop: '2px solid #e2e8f0' }}>
                <td colSpan={4} style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Total COGS for the day</td>
                <td style={{ padding: '12px 14px', fontWeight: 900, color: '#dc2626', fontSize: 16, fontFamily: 'Syne,sans-serif' }}>
                  {fmt(totalCogs)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HISTORY TAB
══════════════════════════════════════════════════════════════════════ */
function HistoryTab({ entries, items }) {
  const [filterType, setFilterType] = useState('all');
  const filtered = filterType === 'all' ? entries : entries.filter(e => e.type === filterType);
  const TYPE_LABELS = { purchase: '📥 Purchase', day_close: '📊 Day Close', adjustment: '🔢 Adjustment', wastage: '🗑️ Wastage', return_to_supplier: '↩️ Return' };
  const TYPE_COLORS = { purchase: '#059669', day_close: '#2563eb', adjustment: '#7c3aed', wastage: '#dc2626', return_to_supplier: '#d97706' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'purchase', 'day_close', 'adjustment', 'wastage', 'return_to_supplier'].map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${filterType === t ? (TYPE_COLORS[t] || '#2563eb') : '#e2e8f0'}`, background: filterType === t ? (TYPE_COLORS[t] || '#2563eb') + '14' : '#fff', color: filterType === t ? (TYPE_COLORS[t] || '#2563eb') : '#64748b', cursor: 'pointer', fontSize: 12.5, fontWeight: filterType === t ? 700 : 500 }}>
            {t === 'all' ? '📋 All' : TYPE_LABELS[t] || t}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: '#fff', borderRadius: 16, border: '1.5px dashed #e2e8f0' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📋</div><p>No entries yet</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8faff' }}>
                {['Date', 'Item', 'Type', 'Qty', 'Before → After', 'Value', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1.5px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const cat = catOf(e.category);
                const tColor = TYPE_COLORS[e.type] || '#64748b';
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #e2e8f0' }}
                    onMouseEnter={el => el.currentTarget.style.background = '#f8faff'}
                    onMouseLeave={el => el.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{e.itemName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{cat.emoji} {cat.label}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: tColor + '14', color: tColor, border: `1px solid ${tColor}30` }}>
                        {TYPE_LABELS[e.type] || e.type}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{e.qty}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>
                      <span style={{ color: '#94a3b8' }}>{e.stockBefore}</span>
                      <span style={{ margin: '0 6px', color: '#cbd5e1' }}>→</span>
                      <span style={{ fontWeight: 700, color: e.stockAfter > e.stockBefore ? '#059669' : '#dc2626' }}>{e.stockAfter}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: '#2563eb', fontSize: 13 }}>
                      {e.totalValue ? fmt(e.totalValue) : e.cogs ? fmt(Math.abs(e.cogs)) : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b', maxWidth: 120 }}>
                      {e.supplier && <div style={{ fontWeight: 600 }}>📦 {e.supplier}</div>}
                      {e.notes && <div>{e.notes}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ITEM HISTORY (expanded card)
══════════════════════════════════════════════════════════════════════ */
function ItemHistory({ itemId, shopId, item }) {
  const [hist, setHist] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'shops', shopId, 'inventory_entries'), where('itemId', '==', itemId), orderBy('createdAt', 'desc'), limit(8));
    const unsub = onSnapshot(q, snap => setHist(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [itemId, shopId]);
  return (
    <div style={{ borderTop: '1px solid #e2e8f0', padding: '12px 18px', background: '#f8faff' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Recent Movements</div>
      {hist.length === 0 ? <div style={{ fontSize: 13, color: '#94a3b8' }}>No movements yet</div> : hist.map(e => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>
          <div style={{ color: '#475569' }}>{e.date} · <span style={{ fontWeight: 600 }}>{e.type}</span></div>
          <div style={{ fontWeight: 700, color: e.stockAfter > e.stockBefore ? '#059669' : '#dc2626' }}>
            {e.stockBefore} → {e.stockAfter} {item.unit}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   REPORTS TAB
══════════════════════════════════════════════════════════════════════ */
function ReportsTab({ items, entries }) {
  const totalValue    = items.reduce((s, i) => s + (i.currentStock || 0) * (i.purchasePrice || 0), 0);
  const totalSelling  = items.reduce((s, i) => s + (i.currentStock || 0) * (i.sellingPrice || i.purchasePrice || 0), 0);
  const potential     = totalSelling - totalValue;
  const lowStock      = items.filter(i => (i.currentStock || 0) <= (i.minStock || 5) && (i.currentStock || 0) > 0);
  const outOfStock    = items.filter(i => (i.currentStock || 0) === 0);
  const totalPurchases = entries.filter(e => e.type === 'purchase').reduce((s, e) => s + (e.totalValue || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {[
          { label: 'Purchase Value', val: totalValue,     icon: '💰', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Selling Value',  val: totalSelling,   icon: '📈', color: '#059669', bg: '#ecfdf5' },
          { label: 'Profit Potential', val: potential,    icon: '💹', color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Total Purchases', val: totalPurchases, icon: '📥', color: '#dc2626', bg: '#fef2f2' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
            <div style={{ fontSize: 11.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 22, color: k.color }}>{fmt(k.val)}</div>
          </div>
        ))}
      </div>

      {/* Item-wise stock table */}
      <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
          📦 Current Stock Levels
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8faff' }}>
              {['Item', 'Category', 'Stock', 'Purchase Price', 'Sell Price', 'Stock Value', 'Status'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1.5px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const cat   = catOf(item.category);
              const isLow = (item.currentStock || 0) <= (item.minStock || 5);
              const isOut = (item.currentStock || 0) === 0;
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{item.name}</div>
                    {item.barcode && <div style={{ fontSize: 11, color: '#94a3b8' }}>#{item.barcode}</div>}
                  </td>
                  <td style={{ padding: '11px 14px' }}><span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: cat.color + '14', color: cat.color }}>{cat.emoji} {cat.label}</span></td>
                  <td style={{ padding: '11px 14px', fontWeight: 800, fontSize: 15, color: isOut ? '#dc2626' : isLow ? '#d97706' : '#059669' }}>{item.currentStock || 0} <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>{item.unit}</span></td>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#dc2626' }}>{fmt(item.purchasePrice, 2)}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#059669' }}>{fmt(item.sellingPrice || item.purchasePrice, 2)}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 800, color: '#2563eb' }}>{fmt((item.currentStock || 0) * (item.purchasePrice || 0))}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {isOut ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>🚫 Out of Stock</span>
                      : isLow ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>⚠️ Low Stock</span>
                      : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>✅ In Stock</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Low stock alerts */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #fde68a', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#d97706" />
            <span style={{ fontWeight: 700, color: '#d97706', fontSize: 15 }}>Stock Alerts — {outOfStock.length} out · {lowStock.length} low</span>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...outOfStock.map(i => ({ ...i, _alert: 'out' })), ...lowStock.map(i => ({ ...i, _alert: 'low' }))].map(item => (
              <div key={item.id} style={{ padding: '8px 14px', borderRadius: 12, border: `1.5px solid ${item._alert === 'out' ? '#fecaca' : '#fde68a'}`, background: item._alert === 'out' ? '#fef2f2' : '#fffbeb', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{catOf(item.category).emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: item._alert === 'out' ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                    {item._alert === 'out' ? '🚫 Out of stock' : `⚠️ Only ${item.currentStock} left (min: ${item.minStock})`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
