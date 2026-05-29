import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Trash2, Eye, EyeOff, CheckCircle, XCircle, Shield, Store } from 'lucide-react';
import toast from 'react-hot-toast';

const ALL_PAGES = [
  { id: 'dashboard',     label: 'Dashboard',       emoji: '📊' },
  { id: 'billing',       label: 'Billing',          emoji: '🧾' },
  { id: 'sales',         label: 'Sales Entry',      emoji: '🛒' },
  { id: 'invoices',      label: 'Invoices',         emoji: '📄' },
  { id: 'quotations',    label: 'Quotations',       emoji: '💬' },
  { id: 'expenses',      label: 'Expenses',         emoji: '💸' },
  { id: 'purchases',     label: 'Purchases',        emoji: '🛍️' },
  { id: 'inventory',     label: 'Inventory',        emoji: '📦' },
  { id: 'products',      label: 'Product Catalog',  emoji: '🗂️' },
  { id: 'bank-deposits', label: 'Bank Deposits',    emoji: '🏦' },
  { id: 'day-end',       label: 'Day End',          emoji: '🌙' },
  { id: 'reports',       label: 'Reports',          emoji: '📈' },
  { id: 'settings',      label: 'Settings',         emoji: '⚙️' },
];

const DEFAULT_PERMISSIONS = ['dashboard', 'billing', 'sales'];
const ROLES = [
  { value: 'manager', label: 'Manager', color: '#7c3aed' },
  { value: 'cashier', label: 'Cashier', color: '#059669' },
  { value: 'staff',   label: 'Staff',   color: '#475569' },
];

/* ── Extracted sub-component so hooks are NEVER inside .map() ── */
function StaffCard({ m, onRemove, onRoleChange, onToggleStatus, onSavePerms, isEditingPerms, onToggleEdit }) {
  const role = ROLES.find(r => r.value === m.role) || ROLES[2];
  const initialPerms = m.permissions || DEFAULT_PERMISSIONS;

  // ✅ Hooks at component top level - safe
  const [localPerms, setLocalPerms] = useState(initialPerms);

  const toggleLocalPerm = (id) =>
    setLocalPerms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', opacity: m.status === 'inactive' ? 0.6 : 1 }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${role.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: role.color, flexShrink: 0, border: `2px solid ${role.color}30` }}>
          {(m.name?.[0] || '?').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{m.name}</div>
          <div style={{ color: '#64748b', fontSize: 13 }}>{m.email}</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
            {(m.permissions || DEFAULT_PERMISSIONS).length} pages · Added {m.invitedAt?.toDate ? m.invitedAt.toDate().toLocaleDateString() : '—'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select value={m.role} onChange={e => onRoleChange(m.id, e.target.value)}
            style={{ background: `${role.color}14`, color: role.color, border: `1.5px solid ${role.color}30`, borderRadius: 8, padding: '5px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: m.status === 'active' ? '#ecfdf5' : '#fef2f2', color: m.status === 'active' ? '#059669' : '#dc2626', border: `1px solid ${m.status === 'active' ? '#a7f3d0' : '#fecaca'}` }}>
            {m.status === 'active' ? '● Active' : '○ Off'}
          </span>
          <button onClick={onToggleEdit} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${isEditingPerms ? '#2563eb' : '#e2e8f0'}`, background: isEditingPerms ? '#eff6ff' : '#f8fafc', color: isEditingPerms ? '#2563eb' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            🔐 {isEditingPerms ? 'Close' : 'Permissions'}
          </button>
          <button onClick={() => onToggleStatus(m)} title="Toggle active" style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {m.status === 'active' ? <XCircle size={14} color="#dc2626" /> : <CheckCircle size={14} color="#059669" />}
          </button>
          <button onClick={() => onRemove(m)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={14} color="#dc2626" />
          </button>
        </div>
      </div>

      {/* Inline permissions editor */}
      {isEditingPerms && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>
            🔐 Page Access for <span style={{ color: '#2563eb' }}>{m.name}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 8, marginBottom: 14 }}>
            {ALL_PAGES.map(page => {
              const on = localPerms.includes(page.id);
              return (
                <div key={page.id} onClick={() => toggleLocalPerm(page.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, border: `1.5px solid ${on ? '#bfdbfe' : '#e2e8f0'}`, background: on ? '#eff6ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none' }}>
                  <span style={{ fontSize: 15 }}>{page.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: on ? '#2563eb' : '#475569' }}>{page.label}</span>
                  {on ? <CheckCircle size={14} color="#2563eb" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #cbd5e1' }} />}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSavePerms(m.id, localPerms)} className="btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>✅ Save</button>
            <button onClick={onToggleEdit} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
            <button onClick={() => setLocalPerms(ALL_PAGES.map(p => p.id))} style={{ padding: '8px 14px', fontSize: 12, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>
              All Pages
            </button>
            <button onClick={() => setLocalPerms(DEFAULT_PERMISSIONS)} style={{ padding: '8px 14px', fontSize: 12, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  const { selectedShop, user, isSuperAdmin, createRestaurantAccount, userShops } = useAuth();
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('staff');
  const [saving, setSaving]       = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [editPermsId, setEditPermsId] = useState(null);

  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'cashier', shopId: '',
    permissions: DEFAULT_PERMISSIONS,
  });

  useEffect(() => {
    if (!selectedShop) return;
    const unsub = onSnapshot(collection(db, 'shops', selectedShop.id, 'staff'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return unsub;
  }, [selectedShop]);

  const togglePerm = (id) => setForm(p => ({ ...p, permissions: p.permissions.includes(id) ? p.permissions.filter(x => x !== id) : [...p.permissions, id] }));

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return toast.error('Name, email and password required');
    if (form.password.length < 6) return toast.error('Password must be 6+ characters');
    setSaving(true);
    try {
      const newUser = await createRestaurantAccount({ name: form.name, email: form.email, password: form.password, shopId: form.shopId || selectedShop?.id });
      const targetShop = form.shopId || selectedShop?.id;
      if (targetShop) {
        await addDoc(collection(db, 'shops', targetShop, 'staff'), {
          email: form.email, name: form.name, role: form.role,
          permissions: form.permissions, status: 'active',
          uid: newUser.uid, invitedAt: new Date(), invitedBy: user.uid,
        });
        const shop = userShops.find(s => s.id === targetShop);
        await updateDoc(doc(db, 'shops', targetShop), {
          memberEmails: [...(shop?.memberEmails || []), form.email],
        });
      }
      toast.success(`✅ Account created for ${form.name}`);
      setForm({ name: '', email: '', password: '', role: 'cashier', shopId: '', permissions: DEFAULT_PERMISSIONS });
      setTab('staff');
    } catch (err) {
      toast.error(err.code === 'auth/email-already-in-use' ? 'Email already registered' : `Failed: ${err.message}`);
    } finally { setSaving(false); }
  };

  const handleRemove    = async (m) => { if (!window.confirm(`Remove ${m.name}?`)) return; try { await deleteDoc(doc(db, 'shops', selectedShop.id, 'staff', m.id)); toast.success('Removed'); } catch { toast.error('Failed'); } };
  const handleRoleChange = async (id, role) => { try { await updateDoc(doc(db, 'shops', selectedShop.id, 'staff', id), { role }); toast.success('Role updated'); } catch { toast.error('Failed'); } };
  const handleToggleStatus = async (m) => { const next = m.status === 'active' ? 'inactive' : 'active'; try { await updateDoc(doc(db, 'shops', selectedShop.id, 'staff', m.id), { status: next }); toast.success(`${m.name} ${next}`); } catch { toast.error('Failed'); } };
  const handleSavePerms  = async (memberId, perms) => { try { await updateDoc(doc(db, 'shops', selectedShop.id, 'staff', memberId), { permissions: perms }); toast.success('Permissions updated'); setEditPermsId(null); } catch { toast.error('Failed'); } };

  if (!isSuperAdmin) return (
    <div className="page-container" style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
      <Shield size={48} style={{ opacity: 0.25, marginBottom: 16 }} />
      <p style={{ fontSize: 15 }}>Only Super Admin can manage staff accounts.</p>
    </div>
  );

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 28, color: '#0f172a', margin: 0 }}>Staff & Accounts</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Create logins, assign shops, manage page access</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 12, padding: 4, border: '1.5px solid #e2e8f0', width: 'fit-content', marginBottom: 28, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
        {[['staff', '👥 Staff Members'], ['create', '➕ Create Login']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', background: tab === id ? '#2563eb' : 'transparent', color: tab === id ? '#fff' : '#64748b', fontWeight: tab === id ? 700 : 500, fontSize: 13, transition: 'all 0.18s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── CREATE TAB ── */}
      {tab === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Form */}
          <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #e2e8f0', padding: '28px', boxShadow: '0 2px 12px rgba(15,23,42,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={20} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 18, color: '#0f172a' }}>New Restaurant Login</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>Creates a Firebase account for this user</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Ravi Kumar" />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="ravi@siruvani.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Assign to Shop</label>
                <select className="form-select" value={form.shopId} onChange={e => setForm(p => ({ ...p, shopId: e.target.value }))}>
                  <option value="">— Select shop —</option>
                  {userShops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ROLES.map(r => (
                    <button key={r.value} onClick={() => setForm(p => ({ ...p, role: r.value }))} style={{ flex: 1, padding: '9px 6px', borderRadius: 10, border: `2px solid ${form.role === r.value ? r.color : '#e2e8f0'}`, background: form.role === r.value ? `${r.color}14` : '#f8fafc', color: form.role === r.value ? r.color : '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.15s' }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn-primary" onClick={handleCreate} disabled={saving} style={{ padding: '13px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, marginTop: 4 }}>
                {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} />Creating…</> : <><UserPlus size={16} />Create Account</>}
              </button>
            </div>
          </div>

          {/* Page Permissions for new user */}
          <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #e2e8f0', padding: '28px', boxShadow: '0 2px 12px rgba(15,23,42,0.07)' }}>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 17, color: '#0f172a', marginBottom: 5 }}>🔐 Page Access Rights</div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>Choose which pages this user can access</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {ALL_PAGES.map(page => {
                const enabled = form.permissions.includes(page.id);
                return (
                  <div key={page.id} onClick={() => togglePerm(page.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 10, border: `1.5px solid ${enabled ? '#bfdbfe' : '#e2e8f0'}`, background: enabled ? '#eff6ff' : '#f8fafc', cursor: 'pointer', transition: 'all 0.12s', userSelect: 'none' }}>
                    <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{page.emoji}</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: enabled ? '#1d4ed8' : '#475569' }}>{page.label}</span>
                    {enabled ? <CheckCircle size={16} color="#2563eb" /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #cbd5e1' }} />}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setForm(p => ({ ...p, permissions: ALL_PAGES.map(x => x.id) }))} style={{ marginTop: 14, width: '100%', padding: '9px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              ✅ Select All Pages
            </button>
          </div>
        </div>
      )}

      {/* ── STAFF LIST TAB ── */}
      {tab === 'staff' && (
        <>
          {!selectedShop ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <Store size={40} style={{ opacity: 0.2, marginBottom: 12 }} /><p>Select a shop to view staff</p>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
          ) : members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
              <Users size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p style={{ marginBottom: 16 }}>No staff yet</p>
              <button className="btn-primary" onClick={() => setTab('create')}>Create Restaurant Login</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {members.map(m => (
                <StaffCard
                  key={m.id}
                  m={m}
                  onRemove={handleRemove}
                  onRoleChange={handleRoleChange}
                  onToggleStatus={handleToggleStatus}
                  onSavePerms={handleSavePerms}
                  isEditingPerms={editPermsId === m.id}
                  onToggleEdit={() => setEditPermsId(editPermsId === m.id ? null : m.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
