/**
 * PaymentSelector — Reusable "Select Payment Method + Amount + Date" component
 * Used in: InvoicePage (mark paid), PurchasePage (pay button), any payment flow
 *
 * Props:
 *  methods      — array from usePaymentMethods()
 *  amount       — pre-filled amount (editable)
 *  maxAmount    — maximum allowed (e.g. invoice total)
 *  onConfirm(data) — callback with { method, amount, date, note }
 *  onCancel     — close handler
 *  title        — modal title
 *  subtitle     — e.g. "Invoice INV-123456"
 *  confirmLabel — button text
 *  accentColor  — e.g. '#059669' for green
 *  showAmount   — bool (default true)
 */
import React, { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_EMOJI = { cash:'💵', upi:'📱', card:'💳', bank:'🏦', cheque:'📝', credit:'📋' };
const TYPE_COLOR = { cash:'#059669', upi:'#2563eb', card:'#7c3aed', bank:'#0891b2', cheque:'#475569', credit:'#dc2626' };

export default function PaymentSelector({
  methods = [],
  amount: initialAmount = '',
  maxAmount,
  onConfirm,
  onCancel,
  title        = '💳 Select Payment Method',
  subtitle     = '',
  confirmLabel = 'Confirm Payment',
  accentColor  = '#2563eb',
  showAmount   = true,
}) {
  const [selected, setSelected]   = useState(methods[0]?.name || '');
  const [amount,   setAmount]     = useState(initialAmount?.toString() || '');
  const [date,     setDate]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note,     setNote]       = useState('');
  const [error,    setError]      = useState('');

  // Auto-select first method when methods load
  useEffect(() => {
    if (methods.length > 0 && !selected) setSelected(methods[0].name);
  }, [methods]);

  // Auto-fill amount
  useEffect(() => {
    if (initialAmount) setAmount(initialAmount.toString());
  }, [initialAmount]);

  const getTypeInfo = name => {
    const m = methods.find(x => x.name === name);
    const type = m?.type || 'cash';
    return { emoji: TYPE_EMOJI[type] || '💳', color: TYPE_COLOR[type] || accentColor };
  };

  const handleConfirm = () => {
    if (!selected) { setError('Please select a payment method'); return; }
    if (showAmount) {
      const amt = parseFloat(amount);
      if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
      if (maxAmount && amt > maxAmount + 0.01) { setError(`Amount cannot exceed ₹${maxAmount.toFixed(2)}`); return; }
    }
    setError('');
    onConfirm({ method: selected, amount: parseFloat(amount) || 0, date, note });
  };

  const { emoji: selEmoji, color: selColor } = getTypeInfo(selected);

  return (
    <div
      className="modal-overlay"
      onClick={onCancel}
      style={{ zIndex: 700 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 24,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 60px rgba(13,27,46,0.2)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          animation: 'modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* ── Header gradient ── */}
        <div style={{
          background: `linear-gradient(135deg, ${accentColor}ee, ${accentColor})`,
          padding: '20px 24px 18px',
          position: 'relative',
        }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.2px' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{subtitle}</div>
          )}
          <button
            onClick={onCancel}
            style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <X size={14}/>
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* ── Payment method grid ── */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Choose Payment Method
            </div>
            {methods.length === 0 ? (
              <div style={{ padding: '14px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
                ⚠️ No payment methods configured. Go to <strong>Settings → Payment Methods</strong> to add them.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {methods.map(m => {
                  const { emoji, color } = getTypeInfo(m.name);
                  const isActive = selected === m.name;
                  return (
                    <button
                      key={m.id || m.name}
                      onClick={() => { setSelected(m.name); setError(''); }}
                      style={{
                        padding: '11px 10px',
                        borderRadius: 12,
                        border: `2px solid ${isActive ? color : '#e5e7eb'}`,
                        background: isActive ? color + '12' : '#f9fafb',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.14s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = color + '80'; e.currentTarget.style.background = color + '08'; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#f9fafb'; } }}
                    >
                      <span style={{ fontSize: 22 }}>{emoji}</span>
                      <span style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? color : '#374151', textAlign: 'center', lineHeight: 1.2 }}>{m.name}</span>
                      {isActive && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle size={10} color="#fff" strokeWidth={3}/>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Selected method pill ── */}
          {selected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: selColor + '10', borderRadius: 10, border: `1px solid ${selColor}30`, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>{selEmoji}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: selColor }}>Paying with: {selected}</span>
            </div>
          )}

          {/* ── Amount ── */}
          {showAmount && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setError(''); }}
                  placeholder="0.00"
                  style={{ fontWeight: 700, fontSize: 16 }}
                  autoFocus
                />
                {maxAmount && (
                  <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 4, display: 'flex', gap: 6 }}>
                    <span>Total: ₹{maxAmount.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setAmount(maxAmount.toFixed(2))}
                      style={{ color: accentColor, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11.5, padding: 0 }}
                    >
                      ← Fill full
                    </button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)}/>
              </div>
            </div>
          )}

          {/* ── Note ── */}
          <div className="form-group" style={{ marginBottom: 4 }}>
            <label className="form-label">Note / Reference (optional)</label>
            <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Cheque no., transaction ref…"/>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop: 10, padding: '9px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '0 24px 22px', display: 'flex', gap: 10 }}>
          <button onClick={onCancel} className="btn-secondary" style={{ flex: 1, padding: '12px', fontWeight: 600, borderRadius: 12 }}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || methods.length === 0}
            style={{
              flex: 2, padding: '12px', fontWeight: 700, fontSize: 14.5,
              borderRadius: 12, border: 'none', cursor: selected ? 'pointer' : 'not-allowed',
              background: selected ? accentColor : '#d1d5db',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: selected ? `0 4px 14px ${accentColor}40` : 'none',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (selected) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => e.currentTarget.style.transform = ''}
          >
            <CheckCircle size={15}/> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
