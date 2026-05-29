import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { Search, Plus, Trash2, ShoppingCart, X } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const CATEGORY_LABELS = {
  liquor: '🍶 Liquor', beer: '🍺 Beer', wine: '🍷 Wine',
  food: '🍛 Food', cigarette: '🚬 Cigarettes', cooldrink: '🥤 Cool Drinks',
  water: '💧 Water/Juice', other: '📦 Other',
};

export default function SalesPage() {
  const { selectedShop } = useAuth();
  const [products, setProducts]   = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [search, setSearch]       = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [paymentCash, setPaymentCash] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [notes, setNotes]         = useState('');
  const [date, setDate]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime]           = useState(format(new Date(), 'HH:mm'));
  const [saving, setSaving]       = useState(false);
  const [salesList, setSalesList] = useState([]);
  const [activeTab, setActiveTab] = useState('new');
  const [loadingSales, setLoadingSales] = useState(true);
  const searchRef = useRef();

  const leaseMode = selectedShop?.settings?.leaseMode || false;

  // Load products
  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'products'), orderBy('name'));
    const unsub = onSnapshot(q, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [selectedShop]);

  // Load recent sales
  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'sales'), orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => { setSalesList(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingSales(false); });
    return unsub;
  }, [selectedShop]);

  // Product search suggestions
  useEffect(() => {
    if (!search.trim()) { setSuggestions([]); return; }
    const q = search.toLowerCase();
    const results = products.filter(p => {
      if (leaseMode && ['food', 'cigarette', 'cooldrink'].includes(p.category)) return false;
      return p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q) || (CATEGORY_LABELS[p.category] || '').toLowerCase().includes(q);
    }).slice(0, 8);
    setSuggestions(results);
    setShowSuggestions(true);
  }, [search, products]);

  const addToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.price } : i);
      return [...prev, { productId: product.id, name: product.name, category: product.category, price: product.price, gstEnabled: product.gstEnabled, gstRate: product.gstRate || 0, qty: 1, subtotal: product.price, photoURL: product.photoURL || '' }];
    });
    setSearch('');
    setSuggestions([]);
    setShowSuggestions(false);
    searchRef.current?.focus();
  };

  const updateQty = (productId, qty) => {
    if (qty <= 0) { removeItem(productId); return; }
    setCartItems(prev => prev.map(i => i.productId === productId ? { ...i, qty, subtotal: qty * i.price } : i));
  };

  const removeItem = (productId) => setCartItems(prev => prev.filter(i => i.productId !== productId));

  const cartTotal   = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const gstTotal    = cartItems.reduce((s, i) => i.gstEnabled ? s + (i.subtotal * i.gstRate / 100) : s, 0);
  const grandTotal  = cartTotal + gstTotal;
  const totalPaid   = (parseFloat(paymentCash) || 0) + (parseFloat(paymentBank) || 0);
  const balance     = grandTotal - totalPaid;

  const handleSubmit = async () => {
    if (!selectedShop) return toast.error('No shop selected');
    if (cartItems.length === 0) return toast.error('Add at least one product');
    if (Math.abs(balance) > 0.5) return toast.error(`Balance mismatch: ${fmt(Math.abs(balance))} ${balance > 0 ? 'short' : 'excess'}`);
    setSaving(true);
    try {
      // Build category totals from cart
      const catTotals = {};
      cartItems.forEach(i => {
        catTotals[i.category] = (catTotals[i.category] || 0) + i.subtotal;
      });

      await addDoc(collection(db, 'shops', selectedShop.id, 'sales'), {
        date, time,
        cart_items: cartItems,
        category_totals: catTotals,
        // Legacy flat fields for report compatibility
        liquor_sales:    catTotals.liquor || 0,
        beer_sales:      catTotals.beer || 0,
        express_sales:   catTotals.wine || 0,
        token_sales:     0,
        food_sales:      catTotals.food || 0,
        cigarette_sales: catTotals.cigarette || 0,
        cooldrink_sales: catTotals.cooldrink || 0,
        other_sales:     (catTotals.water || 0) + (catTotals.other || 0),
        ac_charges:      0,
        subtotal:        cartTotal,
        gst_total:       gstTotal,
        total_amount:    grandTotal,
        payment_cash:    parseFloat(paymentCash) || 0,
        payment_bank:    parseFloat(paymentBank) || 0,
        notes,
        lease_mode_snapshot: leaseMode,
        createdAt: new Date(),
      });
      toast.success('Sale recorded! 🎉');
      setCartItems([]); setPaymentCash(''); setPaymentBank(''); setNotes('');
      setDate(format(new Date(), 'yyyy-MM-dd')); setTime(format(new Date(), 'HH:mm'));
      setActiveTab('list');
    } catch (e) { toast.error('Failed to save'); console.error(e); }
    finally { setSaving(false); }
  };

  if (!selectedShop) return (
    <div className="page-container" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
      <ShoppingCart size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
      <p>Select a shop to record sales</p>
    </div>
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 26, color: 'var(--text-primary)', margin: 0 }}>Sales Entry</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '4px 0 0' }}>{format(new Date(), 'EEEE, d MMM yyyy')}</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
          {[['new','🛒 New Sale'],['list','📋 History']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === id ? 'var(--gold)' : 'transparent', color: activeTab === id ? '#000' : 'var(--text-secondary)', fontWeight: activeTab === id ? 700 : 400, fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── NEW SALE TAB ── */}
      {activeTab === 'new' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

          {/* Left: Product Search + Cart */}
          <div>
            {/* Date/Time row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Time</label>
                <input className="form-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>

            {/* Product search */}
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 12 }}>🔍 Search & Add Products</div>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                <input
                  ref={searchRef}
                  className="form-input"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => search && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Type product name to search…"
                  style={{ paddingLeft: 40, fontSize: 15 }}
                  autoComplete="off"
                />
                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#1c1c1e', border: '1px solid var(--border)', borderRadius: 12,
                    marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}>
                    {suggestions.map(p => (
                      <div
                        key={p.id}
                        onMouseDown={() => addToCart(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-elevated)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {p.photoURL
                          ? <img src={p.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                              {CATEGORY_LABELS[p.category]?.slice(0,2) || '📦'}
                            </div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{CATEGORY_LABELS[p.category]} · {p.unit}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>₹{p.price}</div>
                          {p.gstEnabled && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{p.gstRate}% GST</div>}
                        </div>
                        <Plus size={16} color="var(--gold)" />
                      </div>
                    ))}
                  </div>
                )}
                {showSuggestions && search && suggestions.length === 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#1c1c1e', border: '1px solid var(--border)', borderRadius: 12, marginTop: 4, padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No products match "{search}" · <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = '#/products'; }} style={{ color: 'var(--gold)' }}>Add to catalog?</a>
                  </div>
                )}
              </div>
              {products.length === 0 && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(212,160,23,0.07)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  ⚠️ No products in catalog. Go to <strong>Product Catalog</strong> to add items first.
                </div>
              )}
            </div>

            {/* Cart items */}
            {cartItems.length > 0 && (
              <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  🛒 Cart ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})
                </div>
                {cartItems.map(item => (
                  <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    {item.photoURL
                      ? <img src={item.photoURL} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {CATEGORY_LABELS[item.category]?.slice(0,2) || '📦'}
                        </div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>₹{item.price} each{item.gstEnabled ? ` + ${item.gstRate}% GST` : ''}</div>
                    </div>
                    {/* Qty controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => updateQty(item.productId, item.qty - 1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.productId, item.qty + 1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <div style={{ minWidth: 72, textAlign: 'right', fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>
                      ₹{item.subtotal.toLocaleString('en-IN')}
                    </div>
                    <button onClick={() => removeItem(item.productId)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,59,48,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={14} color="#ff3b30" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Payment & Summary */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>💳 Payment</div>

              {/* Bill summary */}
              {cartItems.length > 0 && (
                <div style={{ background: 'var(--surface-elevated)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    <span>Subtotal</span><span>₹{cartTotal.toFixed(2)}</span>
                  </div>
                  {gstTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <span>GST</span><span>₹{gstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--text-primary)', fontSize: 16, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <span>Total</span><span style={{ color: 'var(--gold)' }}>₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">💵 Cash Received</label>
                <input className="form-input" type="number" min="0" step="0.01" value={paymentCash} onChange={e => setPaymentCash(e.target.value)} placeholder="0.00" style={{ fontSize: 16, fontWeight: 600 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">📱 UPI / Bank</label>
                <input className="form-input" type="number" min="0" step="0.01" value={paymentBank} onChange={e => setPaymentBank(e.target.value)} placeholder="0.00" style={{ fontSize: 16, fontWeight: 600 }} />
              </div>

              {/* Balance indicator */}
              {cartItems.length > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, background: Math.abs(balance) < 0.5 ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', border: `1px solid ${Math.abs(balance) < 0.5 ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Balance</span>
                    <span style={{ color: Math.abs(balance) < 0.5 ? '#34c759' : '#ff3b30' }}>
                      {Math.abs(balance) < 0.5 ? '✅ Balanced' : `₹${Math.abs(balance).toFixed(2)} ${balance > 0 ? 'short' : 'extra'}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" style={{ resize: 'none' }} />
              </div>

              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={saving || cartItems.length === 0}
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 12 }}
              >
                {saving ? <><div className="spinner" style={{ width: 16, height: 16, display: 'inline-block', marginRight: 8 }} />Saving…</> : '✅ Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'list' && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {loadingSales ? (
            <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>
          ) : salesList.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShoppingCart size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No sales yet</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)' }}>
                    {['Date','Time','Items','Total','Cash','Bank','Mode'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salesList.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'var(--surface-elevated)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)' }}>{s.date}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{s.time}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{s.cart_items?.length || '—'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>{fmt(s.total_amount)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{fmt(s.payment_cash)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{fmt(s.payment_bank)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.lease_mode_snapshot ? 'rgba(212,160,23,0.15)' : 'rgba(10,132,255,0.15)', color: s.lease_mode_snapshot ? 'var(--gold)' : '#0a84ff' }}>
                          {s.lease_mode_snapshot ? '🏢 Lease' : '🏪 Own'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
