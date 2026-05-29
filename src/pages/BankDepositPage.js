import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Landmark, Plus, CheckCircle, Clock, Filter, Download, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DEPOSIT_TYPES = ['Cash Deposit', 'Demand Draft (DD)', 'NEFT/RTGS', 'Cheque'];
const BANKS = ['SBI', 'HDFC', 'ICICI', 'Axis', 'Canara', 'Union Bank', 'Indian Bank', 'Other'];

export default function BankDepositPage() {
  const { selectedShop, user } = useAuth();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    depositType: 'Cash Deposit',
    amount: '',
    bankName: 'SBI',
    accountNumber: '',
    referenceNumber: '',
    depositedBy: '',
    linkedTo: 'sales',
    linkedDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    status: 'pending',
  });

  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db, 'shops', selectedShop.id, 'bank_deposits'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setDeposits(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [selectedShop]);

  const handleSubmit = async () => {
    if (!form.amount || !form.bankName) return toast.error('Fill amount and bank name');
    setSaving(true);
    try {
      await addDoc(collection(db, 'shops', selectedShop.id, 'bank_deposits'), {
        ...form,
        amount: Number(form.amount),
        createdBy: user.uid,
        createdAt: new Date(),
        status: 'pending',
      });
      toast.success('Deposit recorded');
      setShowForm(false);
      setForm(prev => ({ ...prev, amount: '', referenceNumber: '', notes: '' }));
    } catch (e) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const markConfirmed = async (id) => {
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id, 'bank_deposits', id), {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: user.uid,
      });
      toast.success('Marked as confirmed');
    } catch {
      toast.error('Failed to update');
    }
  };

  const filtered = filterStatus === 'all' ? deposits : deposits.filter(d => d.status === filterStatus);
  const totalDeposited = deposits.filter(d => d.status === 'confirmed').reduce((s, d) => s + d.amount, 0);
  const totalPending = deposits.filter(d => d.status === 'pending').reduce((s, d) => s + d.amount, 0);
  const totalAll = deposits.reduce((s, d) => s + d.amount, 0);

  if (!selectedShop) return (
    <div className="page-container">
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
        <Landmark size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
        <p>Select a shop to view bank deposits</p>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Bank Deposits
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '4px 0 0' }}>Track cash & DD deposits to bank</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> New Deposit
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Deposited', value: totalAll, icon: DollarSign, color: 'var(--gold)' },
          { label: 'Confirmed', value: totalDeposited, icon: CheckCircle, color: '#34c759' },
          { label: 'Pending Confirmation', value: totalPending, icon: Clock, color: '#ff9f0a' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${k.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <k.icon size={22} color={k.color} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>₹{k.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">New Bank Deposit</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 24 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Deposit Type</label>
                <select className="form-select" value={form.depositType} onChange={e => setForm(p => ({ ...p, depositType: e.target.value }))}>
                  {DEPOSIT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input className="form-input" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <select className="form-select" value={form.bankName} onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))}>
                  {BANKS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input className="form-input" value={form.accountNumber} onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))} placeholder="Last 4 digits" />
              </div>
              <div className="form-group">
                <label className="form-label">Reference / Challan No.</label>
                <input className="form-input" value={form.referenceNumber} onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Deposited By</label>
                <input className="form-input" value={form.depositedBy} onChange={e => setForm(p => ({ ...p, depositedBy: e.target.value }))} placeholder="Staff name" />
              </div>
              <div className="form-group">
                <label className="form-label">Linked To</label>
                <select className="form-select" value={form.linkedTo} onChange={e => setForm(p => ({ ...p, linkedTo: e.target.value }))}>
                  <option value="sales">Daily Sales</option>
                  <option value="purchase">Purchase Payment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Linked Date</label>
                <input className="form-input" type="date" value={form.linkedDate} onChange={e => setForm(p => ({ ...p, linkedDate: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional notes" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving...' : 'Record Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'pending', 'confirmed'].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
            background: filterStatus === f ? 'var(--gold)' : 'var(--surface)',
            color: filterStatus === f ? '#000' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: filterStatus === f ? 600 : 400, textTransform: 'capitalize',
          }}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Landmark size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>No deposits found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-elevated)' }}>
                  {['Date', 'Type', 'Amount', 'Bank', 'Reference', 'Deposited By', 'Linked To', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((dep, i) => (
                  <tr key={dep.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-elevated)' }}>
                    <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{dep.date}</td>
                    <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-secondary)' }}>{dep.depositType}</td>
                    <td style={{ padding: '14px 16px', fontSize: 15, fontWeight: 700, color: 'var(--gold)', whiteSpace: 'nowrap' }}>₹{Number(dep.amount).toLocaleString()}</td>
                    <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-secondary)' }}>{dep.bankName}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{dep.referenceNumber || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-secondary)' }}>{dep.depositedBy || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{dep.linkedTo} · {dep.linkedDate}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: dep.status === 'confirmed' ? 'rgba(52,199,89,0.15)' : 'rgba(255,159,10,0.15)',
                        color: dep.status === 'confirmed' ? '#34c759' : '#ff9f0a',
                      }}>
                        {dep.status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {dep.status === 'pending' && (
                        <button onClick={() => markConfirmed(dep.id)} style={{
                          padding: '6px 12px', borderRadius: 8, border: '1px solid #34c759',
                          background: 'rgba(52,199,89,0.1)', color: '#34c759', fontSize: 12,
                          cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          <CheckCircle size={12} style={{ marginRight: 4 }} />Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
