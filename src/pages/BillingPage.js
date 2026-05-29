import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
  doc, updateDoc, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import {
  Search, Plus, Trash2, X, Printer, CheckCircle,
  User, Phone, MapPin, FileText, ShoppingBag, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── helpers ──────────────────────────────────────────────────────────── */
const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const uid = () => `INV-${Date.now().toString().slice(-7)}`;

const PAYMENT_MODES = [
  { id: 'cash',   label: 'Cash',      emoji: '💵', color: '#34c759' },
  { id: 'gpay',   label: 'GPay',      emoji: '📱', color: '#4285f4' },
  { id: 'upi',    label: 'UPI',       emoji: '📲', color: '#5e5ce6' },
  { id: 'card',   label: 'Card',      emoji: '💳', color: '#ff9f0a' },
  { id: 'split',  label: 'Split',     emoji: '✂️', color: '#bf5af2' },
];

const CAT_EMOJI = { liquor:'🍶', beer:'🍺', wine:'🍷', food:'🍛', cigarette:'🚬', cooldrink:'🥤', water:'💧', other:'📦' };

/* ─── Bill preview / print ─────────────────────────────────────────────── */
function printBill(sale, invoice, shop) {
  const rows = (invoice.items || []).map(it =>
    `<tr>
      <td>${it.name}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">₹${it.price.toFixed(2)}</td>
      ${it.gstEnabled ? `<td style="text-align:right">${it.gstRate}%</td>` : '<td style="text-align:center">—</td>'}
      <td style="text-align:right">₹${it.subtotal.toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Bill ${invoice.number}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;padding:20px;color:#1a1a1a;max-width:400px;margin:0 auto;font-size:13px}
  .brand{text-align:center;margin-bottom:14px}
  .brand h2{font-size:20px;font-weight:900;letter-spacing:1px}
  .brand p{font-size:11px;color:#555;margin-top:2px}
  .divider{border:none;border-top:1px dashed #bbb;margin:10px 0}
  .meta{font-size:11px;color:#555;margin-bottom:10px;display:flex;justify-content:space-between}
  .client{background:#f7f7f7;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  thead tr{border-bottom:2px solid #1a1a1a}
  th{padding:5px 4px;font-size:11px;font-weight:700;text-align:left}
  td{padding:5px 4px;font-size:12px;border-bottom:1px solid #eee;vertical-align:top}
  .total-section{margin-top:8px}
  .total-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
  .grand{display:flex;justify-content:space-between;padding:8px 0 4px;border-top:2px solid #1a1a1a;font-weight:900;font-size:15px}
  .payment-badge{display:inline-block;padding:3px 10px;border-radius:12px;background:#e8f5e9;color:#2e7d32;font-weight:700;font-size:12px;margin-top:6px}
  .footer{text-align:center;margin-top:14px;font-size:11px;color:#888}
  @media print{body{padding:0}}
</style>
</head><body>
<div class="brand">
  <h2>🍺 ${shop?.name || 'Siruvani'}</h2>
  ${shop?.address ? `<p>${shop.address}</p>` : ''}
  ${shop?.phone ? `<p>📞 ${shop.phone}</p>` : ''}
  ${shop?.gstNumber ? `<p>GSTIN: ${shop.gstNumber}</p>` : ''}
</div>
<hr class="divider">
<div class="meta">
  <span><strong>Bill #</strong> ${invoice.number}</span>
  <span>${sale.date} ${sale.time}</span>
</div>
${invoice.client?.name ? `<div class="client"><strong>To:</strong> ${invoice.client.name}${invoice.client.phone ? ' · ' + invoice.client.phone : ''}${invoice.client.address ? '<br>' + invoice.client.address : ''}${invoice.client.gstin ? '<br>GSTIN: ' + invoice.client.gstin : ''}</div>` : ''}
<hr class="divider">
<table>
  <thead>
    <tr>
      <th>Item</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Price</th>
      <th style="text-align:right">GST</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="total-section">
  <div class="total-row"><span>Subtotal</span><span>₹${sale.subtotal.toFixed(2)}</span></div>
  ${sale.discountAmt > 0 ? `<div class="total-row" style="color:#c62828"><span>Discount (${invoice.discountPct}%)</span><span>-₹${sale.discountAmt.toFixed(2)}</span></div>` : ''}
  ${sale.gst_total > 0 ? `<div class="total-row" style="color:#1565c0"><span>GST</span><span>₹${sale.gst_total.toFixed(2)}</span></div>` : ''}
  <div class="grand"><span>TOTAL</span><span>₹${sale.total_amount.toFixed(2)}</span></div>
</div>
<div class="payment-badge">${sale.payment_modes?.map(m => `${m.emoji || ''} ${m.label}: ₹${m.amount.toFixed(2)}`).join(' + ') || ''}</div>
<hr class="divider">
<div class="footer">Thank you for visiting ${shop?.name || ''}!<br>Please come again 🙏</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=420,height=700');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════════════════ */
export default function BillingPage() {
  const { selectedShop, user } = useAuth();
  const [products, setProducts]       = useState([]);
  const [cartItems, setCartItems]     = useState([]);
  const [search, setSearch]           = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug]         = useState(false);
  const [tab, setTab]                 = useState('new');   // 'new' | 'history'
  const [step, setStep]               = useState('cart');  // 'cart' | 'client' | 'payment' | 'preview'
  const [bills, setBills]             = useState([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [viewBill, setViewBill]       = useState(null);

  // Form state
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [client, setClient] = useState({ name: '', phone: '', address: '', gstin: '' });
  const [discountPct, setDiscountPct] = useState(0);
  const [payments, setPayments] = useState([{ mode: 'cash', amount: '' }]);
  const [notes, setNotes] = useState('');
  const [billNo, setBillNo] = useState(uid());

  const searchRef = useRef();

  /* ── Load products ── */
  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'products'), orderBy('name'));
    return onSnapshot(q, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [selectedShop]);

  /* ── Load bill history ── */
  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'sales'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, snap => { setBills(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingBills(false); });
  }, [selectedShop]);

  /* ── Search suggestions ── */
  useEffect(() => {
    if (!search.trim()) { setSuggestions([]); return; }
    const q = search.toLowerCase();
    setSuggestions(products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q)).slice(0, 8));
    setShowSug(true);
  }, [search, products]);

  /* ── Cart helpers ── */
  const addToCart = (product) => {
    setCartItems(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.price } : i);
      return [...prev, { productId: product.id, name: product.name, category: product.category, price: product.price, gstEnabled: !!product.gstEnabled, gstRate: product.gstRate || 0, qty: 1, subtotal: product.price, unit: product.unit || 'unit', photoURL: product.photoURL || '' }];
    });
    setSearch(''); setSuggestions([]); setShowSug(false);
    searchRef.current?.focus();
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) { setCartItems(p => p.filter(i => i.productId !== id)); return; }
    setCartItems(p => p.map(i => i.productId === id ? { ...i, qty, subtotal: qty * i.price } : i));
  };

  /* ── Totals ── */
  const cartSubtotal  = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const gstTotal      = cartItems.reduce((s, i) => i.gstEnabled ? s + i.subtotal * i.gstRate / 100 : s, 0);
  const discountAmt   = cartSubtotal * (parseFloat(discountPct) || 0) / 100;
  const grandTotal    = cartSubtotal - discountAmt + gstTotal;

  /* ── Payment helpers ── */
  const totalPaid  = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const payBalance = grandTotal - totalPaid;
  const isBalanced = Math.abs(payBalance) < 0.5;

  const updatePayment = (idx, field, val) => setPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  const addPaymentRow = () => setPayments(prev => [...prev, { mode: 'upi', amount: '' }]);
  const removePayRow  = (idx) => setPayments(prev => prev.filter((_, i) => i !== idx));

  /* ── Auto-fill remaining balance into first empty ── */
  const autoFillBalance = () => {
    if (payBalance > 0) {
      const emptyIdx = payments.findIndex(p => !p.amount);
      if (emptyIdx >= 0) { updatePayment(emptyIdx, 'amount', payBalance.toFixed(2)); }
      else { updatePayment(0, 'amount', grandTotal.toFixed(2)); setPayments([{ mode: payments[0].mode, amount: grandTotal.toFixed(2) }]); }
    }
  };

  /* ── Submit ─────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!selectedShop) return toast.error('No shop selected');
    if (cartItems.length === 0) return toast.error('Cart is empty');
    if (!isBalanced) return toast.error(`Payment mismatch: ₹${Math.abs(payBalance).toFixed(2)} ${payBalance > 0 ? 'short' : 'extra'}`);
    setSubmitting(true);
    try {
      const paymentModes = payments.filter(p => parseFloat(p.amount) > 0).map(p => ({
        ...p, amount: parseFloat(p.amount),
        label: PAYMENT_MODES.find(m => m.id === p.mode)?.label || p.mode,
        emoji: PAYMENT_MODES.find(m => m.id === p.mode)?.emoji || '',
      }));

      const catTotals = {};
      cartItems.forEach(i => { catTotals[i.category] = (catTotals[i.category] || 0) + i.subtotal; });

      const cashAmount  = payments.filter(p => p.mode === 'cash').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const bankAmount  = payments.filter(p => p.mode !== 'cash').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

      // ── 1. Save Sale (financial record for reports/day-end) ──
      const saleData = {
        date, time,
        bill_no:         billNo,
        has_invoice:     true,
        cart_items:      cartItems,
        category_totals: catTotals,
        // legacy fields
        liquor_sales:    catTotals.liquor  || 0,
        beer_sales:      catTotals.beer    || 0,
        food_sales:      catTotals.food    || 0,
        cigarette_sales: catTotals.cigarette || 0,
        cooldrink_sales: catTotals.cooldrink || 0,
        other_sales:     (catTotals.water || 0) + (catTotals.other || 0),
        subtotal:        cartSubtotal,
        discount_pct:    parseFloat(discountPct) || 0,
        discountAmt,
        gst_total:       gstTotal,
        total_amount:    grandTotal,
        payment_cash:    cashAmount,
        payment_bank:    bankAmount,
        payment_modes:   paymentModes,
        client:          client.name ? client : null,
        notes,
        lease_mode_snapshot: selectedShop.settings?.leaseMode || false,
        createdBy: user.uid,
        createdAt: new Date(),
      };
      const saleRef = await addDoc(collection(db, 'shops', selectedShop.id, 'sales'), saleData);

      // ── 2. Save Invoice (deep record with full line items & client) ──
      const invoiceData = {
        number:      billNo,
        sale_id:     saleRef.id,
        date,
        type:        'invoice',
        status:      'paid',
        client:      client.name ? client : null,
        items:       cartItems.map(i => ({
          name:        i.name,
          category:    i.category,
          qty:         i.qty,
          price:       i.price,
          unit:        i.unit,
          gstEnabled:  i.gstEnabled,
          gstRate:     i.gstRate,
          gstAmount:   i.gstEnabled ? i.subtotal * i.gstRate / 100 : 0,
          subtotal:    i.subtotal,
        })),
        subtotal:    cartSubtotal,
        discountPct: parseFloat(discountPct) || 0,
        discountAmt,
        gstTotal,
        grandTotal,
        paymentModes,
        notes,
        shopName:    selectedShop.name,
        shopAddress: selectedShop.address || '',
        shopPhone:   selectedShop.phone   || '',
        shopGst:     selectedShop.gstNumber || '',
        createdBy:   user.uid,
        createdAt:   new Date(),
      };
      await addDoc(collection(db, 'shops', selectedShop.id, 'invoices'), invoiceData);

      toast.success('✅ Bill saved!');

      // Auto-print option
      printBill(saleData, invoiceData, selectedShop);

      // Reset
      setCartItems([]); setPayments([{ mode: 'cash', amount: '' }]);
      setClient({ name: '', phone: '', address: '', gstin: '' });
      setDiscountPct(0); setNotes(''); setBillNo(uid());
      setStep('cart'); setTab('history');
    } catch (e) { toast.error('Failed to save bill'); console.error(e); }
    finally { setSubmitting(false); }
  };

  /* ── Reset new bill ── */
  const resetBill = () => {
    setCartItems([]); setPayments([{ mode: 'cash', amount: '' }]);
    setClient({ name: '', phone: '', address: '', gstin: '' });
    setDiscountPct(0); setNotes(''); setBillNo(uid());
    setStep('cart'); setTab('new');
  };

  if (!selectedShop) return (
    <div className="page-container" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
      <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
      <p>Select a shop to start billing</p>
    </div>
  );

  /* ── Step labels ── */
  const STEPS = [
    { id: 'cart',    label: '🛒 Cart',    num: 1 },
    { id: 'client',  label: '👤 Client',  num: 2 },
    { id: 'payment', label: '💳 Payment', num: 3 },
    { id: 'preview', label: '👁️ Preview', num: 4 },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 26, color: 'var(--text-primary)', margin: 0 }}>Billing</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '4px 0 0' }}>{format(new Date(date), 'EEEE, d MMM yyyy')}</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
          {[['new', '🧾 New Bill'], ['history', '📋 History']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: tab === id ? 'var(--gold)' : 'transparent', color: tab === id ? '#000' : 'var(--text-secondary)', fontWeight: tab === id ? 700 : 400, fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════ NEW BILL ════════════════ */}
      {tab === 'new' && (
        <>
          {/* Step progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 0 }}>
            {STEPS.map((s, i) => {
              const done    = STEPS.findIndex(x => x.id === step) > i;
              const current = s.id === step;
              return (
                <React.Fragment key={s.id}>
                  <div onClick={() => done && setStep(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: done ? 'pointer' : 'default' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, background: done ? '#34c759' : current ? 'var(--gold)' : 'var(--surface-elevated)', color: done || current ? '#000' : 'var(--text-muted)', border: `2px solid ${done ? '#34c759' : current ? 'var(--gold)' : 'var(--border)'}`, flexShrink: 0 }}>
                      {done ? '✓' : s.num}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: current ? 700 : 400, color: current ? 'var(--gold)' : done ? '#34c759' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, margin: '0 8px', background: done ? '#34c759' : 'var(--border)' }} />}
                </React.Fragment>
              );
            })}
          </div>

          {/* ── STEP 1: CART ── */}
          {step === 'cart' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
              {/* Left */}
              <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ width: 110, margin: 0 }}>
                    <input className="form-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <input className="form-input" value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="Bill No." style={{ fontFamily: 'monospace', fontWeight: 700 }} />
                  </div>
                </div>

                {/* Product search */}
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                  <input
                    ref={searchRef}
                    className="form-input"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={() => search && setShowSug(true)}
                    onBlur={() => setTimeout(() => setShowSug(false), 180)}
                    placeholder="🔍 Type to search products…"
                    style={{ paddingLeft: 40, fontSize: 15, fontWeight: 500 }}
                    autoComplete="off"
                  />
                  {showSug && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: '#1c1c1e', border: '1px solid var(--border)', borderRadius: 14, marginTop: 6, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                      {suggestions.map(p => (
                        <div key={p.id} onMouseDown={() => addToCart(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #2c2c2e' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#2c2c2e'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {p.photoURL
                            ? <img src={p.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 40, height: 40, borderRadius: 8, background: '#2c2c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{CAT_EMOJI[p.category] || '📦'}</div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#f5f5f7', fontSize: 14 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: '#8e8e93' }}>{CAT_EMOJI[p.category]} {p.category} · {p.unit}{p.gstEnabled ? ` · GST ${p.gstRate}%` : ''}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 800, color: '#d4a017', fontSize: 16 }}>₹{p.price}</div>
                            {p.gstEnabled && <div style={{ fontSize: 11, color: '#8e8e93' }}>+₹{(p.price * p.gstRate / 100).toFixed(2)} GST</div>}
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(212,160,23,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Plus size={14} color="#d4a017" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showSug && search && !suggestions.length && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: '#1c1c1e', border: '1px solid var(--border)', borderRadius: 12, marginTop: 6, padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      No product found for "<strong style={{ color: '#f5f5f7' }}>{search}</strong>"
                    </div>
                  )}
                </div>

                {/* Cart */}
                {cartItems.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 16, border: '2px dashed var(--border)' }}>
                    <ShoppingBag size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                    <p style={{ fontSize: 14 }}>Search and add products above</p>
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>🛒 {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => setCartItems([])} style={{ fontSize: 12, color: '#ff3b30', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
                    </div>
                    {cartItems.map(item => (
                      <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)' }}>
                        {item.photoURL
                          ? <img src={item.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{CAT_EMOJI[item.category] || '📦'}</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>₹{item.price} × {item.qty}{item.gstEnabled ? ` + ${item.gstRate}% GST` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => updateQty(item.productId, item.qty - 1)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <input type="number" min="1" value={item.qty} onChange={e => updateQty(item.productId, parseInt(e.target.value) || 1)} style={{ width: 38, textAlign: 'center', background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, padding: '4px' }} />
                          <button onClick={() => updateQty(item.productId, item.qty + 1)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                        <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>₹{item.subtotal.toFixed(2)}</div>
                        <button onClick={() => updateQty(item.productId, 0)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(255,59,48,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X size={13} color="#ff3b30" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Mini summary */}
              <div style={{ position: 'sticky', top: 20 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '20px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 14 }}>📋 Bill Summary</div>
                  <div style={{ marginBottom: 12 }}>
                    {[
                      ['Subtotal', `₹${cartSubtotal.toFixed(2)}`],
                      ...(gstTotal > 0 ? [['GST', `₹${gstTotal.toFixed(2)}`]] : []),
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        <span>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div className="form-group" style={{ marginTop: 10 }}>
                      <label className="form-label">Discount %</label>
                      <input className="form-input" type="number" min="0" max="100" value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="0" style={{ textAlign: 'center', fontWeight: 600 }} />
                    </div>
                    {discountAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#ff453a', marginBottom: 6 }}>
                      <span>Discount</span><span>−₹{discountAmt.toFixed(2)}</span>
                    </div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: 'var(--gold)', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
                      <span>Total</span><span>{fmt(grandTotal)}</span>
                    </div>
                  </div>
                  <button className="btn-primary" disabled={cartItems.length === 0} onClick={() => setStep('client')} style={{ width: '100%', padding: '13px', fontSize: 15, fontWeight: 700, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Next: Client Details <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: CLIENT ── */}
          {step === 'client' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 6 }}>👤 Client / Customer Details</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 22px' }}>Optional — leave blank for walk-in customers. Filling this creates a named invoice.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Client Name</label>
                    <div style={{ position: 'relative' }}>
                      <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input className="form-input" value={client.name} onChange={e => setClient(p => ({ ...p, name: e.target.value }))} placeholder="Walk-in customer" style={{ paddingLeft: 34 }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input className="form-input" value={client.phone} onChange={e => setClient(p => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" style={{ paddingLeft: 34 }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Address</label>
                    <div style={{ position: 'relative' }}>
                      <MapPin size={14} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                      <textarea className="form-input" value={client.address} onChange={e => setClient(p => ({ ...p, address: e.target.value }))} placeholder="Optional address" rows={2} style={{ paddingLeft: 34, resize: 'none' }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN (optional)</label>
                    <input className="form-input" value={client.gstin} onChange={e => setClient(p => ({ ...p, gstin: e.target.value }))} placeholder="GST Number" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={() => setStep('cart')} className="btn-secondary" style={{ flex: 1, padding: '12px', fontWeight: 600 }}>← Back</button>
                  <button onClick={() => setStep('payment')} className="btn-primary" style={{ flex: 2, padding: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Next: Payment <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              {/* Bill total card */}
              <BillTotalCard cartItems={cartItems} cartSubtotal={cartSubtotal} gstTotal={gstTotal} discountAmt={discountAmt} grandTotal={grandTotal} />
            </div>
          )}

          {/* ── STEP 3: PAYMENT ── */}
          {step === 'payment' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 6 }}>💳 Payment Mode</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>Choose how the customer paid. Add multiple rows for split payment.</p>

                {payments.map((pay, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-end' }}>
                    {/* Mode buttons */}
                    <div style={{ flex: 2 }}>
                      {idx === 0 && <label className="form-label">Mode</label>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {PAYMENT_MODES.filter(m => m.id !== 'split').map(m => (
                          <button key={m.id} onClick={() => updatePayment(idx, 'mode', m.id)} style={{
                            padding: '8px 12px', borderRadius: 10, border: `2px solid ${pay.mode === m.id ? m.color : 'var(--border)'}`,
                            background: pay.mode === m.id ? `${m.color}22` : 'var(--surface-elevated)',
                            color: pay.mode === m.id ? m.color : 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                          }}>
                            {m.emoji} {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Amount */}
                    <div style={{ flex: 1 }}>
                      {idx === 0 && <label className="form-label">Amount ₹</label>}
                      <input className="form-input" type="number" min="0" step="0.01" value={pay.amount} onChange={e => updatePayment(idx, 'amount', e.target.value)} placeholder="0.00" style={{ fontWeight: 700, fontSize: 16 }} />
                    </div>
                    {payments.length > 1 && (
                      <button onClick={() => removePayRow(idx)} style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 1 }}>
                        <X size={14} color="#ff3b30" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Balance indicator */}
                <div style={{ padding: '12px 16px', borderRadius: 10, margin: '8px 0 16px', background: isBalanced ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)', border: `1px solid ${isBalanced ? 'rgba(52,199,89,0.3)' : 'rgba(255,59,48,0.3)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bill total: <strong style={{ color: 'var(--gold)' }}>{fmt(grandTotal)}</strong> · Paid: <strong>{fmt(totalPaid)}</strong></div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isBalanced ? '#34c759' : '#ff3b30', marginTop: 2 }}>
                      {isBalanced ? '✅ Fully paid' : `${payBalance > 0 ? '⚠️ Pending' : '↩️ Excess'}: ₹${Math.abs(payBalance).toFixed(2)}`}
                    </div>
                  </div>
                  {!isBalanced && <button onClick={autoFillBalance} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--gold)', background: 'rgba(212,160,23,0.1)', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Auto-fill ↓</button>}
                </div>

                <button onClick={addPaymentRow} style={{ width: '100%', padding: '9px', borderRadius: 9, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}>
                  + Add another payment row (split)
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStep('client')} className="btn-secondary" style={{ flex: 1, padding: '12px', fontWeight: 600 }}>← Back</button>
                  <button onClick={() => setStep('preview')} disabled={!isBalanced} className="btn-primary" style={{ flex: 2, padding: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Preview Bill <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <BillTotalCard cartItems={cartItems} cartSubtotal={cartSubtotal} gstTotal={gstTotal} discountAmt={discountAmt} grandTotal={grandTotal} />
            </div>
          )}

          {/* ── STEP 4: PREVIEW & CONFIRM ── */}
          {step === 'preview' && (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <div style={{ background: 'var(--surface)', borderRadius: 20, border: '2px solid var(--gold)', overflow: 'hidden' }}>
                {/* Bill header */}
                <div style={{ background: 'rgba(212,160,23,0.08)', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>🍺 {selectedShop.name}</div>
                      {selectedShop.address && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedShop.address}</div>}
                      {selectedShop.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📞 {selectedShop.phone}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>{billNo}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{date} {time}</div>
                    </div>
                  </div>
                </div>
                {/* Client */}
                {client.name && (
                  <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-elevated)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <User size={14} color="var(--text-muted)" />
                    <div style={{ fontSize: 13 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{client.name}</strong>
                      {client.phone && <span style={{ color: 'var(--text-secondary)', marginLeft: 10 }}>📞 {client.phone}</span>}
                    </div>
                  </div>
                )}
                {/* Items table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)' }}>
                        {['Item', 'Qty', 'Rate', 'GST', 'Total'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Item' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{CAT_EMOJI[item.category]} {item.unit}</div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{item.qty}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: 13 }}>₹{item.price.toFixed(2)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: item.gstEnabled ? '#0a84ff' : 'var(--text-muted)' }}>{item.gstEnabled ? `${item.gstRate}%` : '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--gold)', fontSize: 14 }}>₹{(item.subtotal + (item.gstEnabled ? item.subtotal * item.gstRate / 100 : 0)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Totals */}
                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-elevated)' }}>
                  {cartSubtotal !== grandTotal && [
                    gstTotal > 0 && ['GST', `₹${gstTotal.toFixed(2)}`, '#0a84ff'],
                    discountAmt > 0 && [`Discount (${discountPct}%)`, `−₹${discountAmt.toFixed(2)}`, '#ff453a'],
                  ].filter(Boolean).map(([label, val, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <span>{label}</span><span style={{ color, fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 20, color: 'var(--gold)', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <span>TOTAL</span><span>{fmt(grandTotal)}</span>
                  </div>
                </div>
                {/* Payment breakdown */}
                <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {payments.filter(p => parseFloat(p.amount) > 0).map((p, i) => {
                    const m = PAYMENT_MODES.find(x => x.id === p.mode);
                    return (
                      <div key={i} style={{ padding: '6px 14px', borderRadius: 20, background: `${m?.color || '#888'}22`, border: `1px solid ${m?.color || '#888'}44`, fontSize: 13, fontWeight: 700, color: m?.color || '#888' }}>
                        {m?.emoji} {m?.label}: ₹{parseFloat(p.amount).toFixed(2)}
                      </div>
                    );
                  })}
                </div>
                {notes && <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>📝 {notes}</div>}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setStep('payment')} className="btn-secondary" style={{ flex: 1, padding: '13px', fontWeight: 600 }}>← Edit</button>
                <button onClick={resetBill} className="btn-secondary" style={{ padding: '13px 16px', fontWeight: 600 }}>🗑️</button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary" style={{ flex: 3, padding: '13px', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {submitting ? <><div className="spinner" style={{ width: 16, height: 16 }} />Saving…</> : '✅ Confirm & Print Bill'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════ HISTORY ════════════════ */}
      {tab === 'history' && (
        <div>
          {loadingBills ? (
            <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
          ) : bills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <FileText size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No bills yet</p>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)' }}>
                      {['Bill #', 'Date', 'Client', 'Items', 'Total', 'Payment', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b, i) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'var(--surface-elevated)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--gold)', fontSize: 13 }}>{b.bill_no || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{b.date} {b.time}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
                          {b.client?.name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}
                          {b.client?.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.client.phone}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{b.cart_items?.length || '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--gold)', fontSize: 15 }}>{fmt(b.total_amount)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(b.payment_modes || []).map((pm, j) => (
                              <span key={j} style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                {pm.emoji} {pm.label}
                              </span>
                            ))}
                            {!b.payment_modes?.length && (
                              <>
                                {b.payment_cash > 0 && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: 'rgba(52,199,89,0.15)', color: '#34c759', fontWeight: 600 }}>💵 Cash</span>}
                                {b.payment_bank > 0 && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: 'rgba(10,132,255,0.15)', color: '#0a84ff', fontWeight: 600 }}>📱 UPI</span>}
                              </>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => setViewBill(b)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            👁️ View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── View Bill Modal ── */}
      {viewBill && (
        <div className="modal-overlay" onClick={() => setViewBill(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Bill {viewBill.bill_no}</h3>
              <button className="modal-close" onClick={() => setViewBill(null)}>✕</button>
            </div>
            <div style={{ padding: '16px 24px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{viewBill.date} {viewBill.time}</span>
                <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 16 }}>{fmt(viewBill.total_amount)}</span>
              </div>
              {viewBill.client?.name && (
                <div style={{ padding: '8px 14px', background: 'var(--surface-elevated)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                  👤 {viewBill.client.name} {viewBill.client.phone && `· ${viewBill.client.phone}`}
                </div>
              )}
              {(viewBill.cart_items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> × {item.qty}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>₹{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(viewBill.payment_modes || []).map((pm, j) => (
                  <span key={j} style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--surface-elevated)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {pm.emoji} {pm.label}: ₹{pm.amount?.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
              <button onClick={() => setViewBill(null)} className="btn-secondary" style={{ flex: 1 }}>Close</button>
              <button onClick={() => printBill(viewBill, { items: viewBill.cart_items?.map(i => ({ ...i, name: i.name, gstEnabled: i.gstEnabled, gstRate: i.gstRate || 0 })) }, selectedShop)} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer size={14} /> Reprint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reusable bill total card ── */
function BillTotalCard({ cartItems, cartSubtotal, gstTotal, discountAmt, grandTotal }) {
  return (
    <div style={{ position: 'sticky', top: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '20px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>📋 Bill Preview</div>
        {cartItems.slice(0, 5).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5, color: 'var(--text-secondary)' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{item.name} ×{item.qty}</span>
            <span style={{ fontWeight: 600, flexShrink: 0 }}>₹{item.subtotal.toFixed(2)}</span>
          </div>
        ))}
        {cartItems.length > 5 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>+{cartItems.length - 5} more items…</div>}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
          {gstTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#0a84ff', marginBottom: 4 }}><span>GST</span><span>₹{gstTotal.toFixed(2)}</span></div>}
          {discountAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ff453a', marginBottom: 4 }}><span>Discount</span><span>−₹{discountAmt.toFixed(2)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18, color: 'var(--gold)' }}>
            <span>Total</span><span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
