import React, { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Settings, ToggleLeft, ToggleRight, Save, Store, User, DollarSign, Clock, Shield, Bell, Palette, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { selectedShop, user, isAdmin } = useAuth();
  const [shopData, setShopData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('lease');

  const [settings, setSettings] = useState({
    leaseMode: false,
    leaseDailyAmount: 0,
    lesseeName: '',
    lesseePhone: '',
    lesseeAddress: '',
    leaseStartDate: '',
    leaseEndDate: '',
    shopName: '',
    shopType: 'bar',
    address: '',
    phone: '',
    gstNumber: '',
    fssaiNumber: '',
    openingTime: '10:00',
    closingTime: '23:00',
    lowStockAlert: true,
    dayEndReminder: true,
    reminderTime: '22:00',
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    taxRate: 0,
    serviceCharge: 0,
  });

  useEffect(() => {
    if (!selectedShop) return;
    const unsub = onSnapshot(doc(db, 'shops', selectedShop.id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setShopData(data);
        const s = data.settings || {};
        setSettings(prev => ({
          ...prev,
          leaseMode: s.leaseMode || false,
          leaseDailyAmount: s.leaseDailyAmount || 0,
          lesseeName: s.lesseeName || '',
          lesseePhone: s.lesseePhone || '',
          lesseeAddress: s.lesseeAddress || '',
          leaseStartDate: s.leaseStartDate || '',
          leaseEndDate: s.leaseEndDate || '',
          shopName: data.name || '',
          shopType: data.type || 'bar',
          address: data.address || '',
          phone: data.phone || '',
          gstNumber: data.gstNumber || '',
          fssaiNumber: data.fssaiNumber || '',
          openingTime: s.openingTime || '10:00',
          closingTime: s.closingTime || '23:00',
          lowStockAlert: s.lowStockAlert !== false,
          dayEndReminder: s.dayEndReminder !== false,
          reminderTime: s.reminderTime || '22:00',
          currency: s.currency || 'INR',
          dateFormat: s.dateFormat || 'DD/MM/YYYY',
          taxRate: s.taxRate || 0,
          serviceCharge: s.serviceCharge || 0,
        }));
      }
    });
    return () => unsub();
  }, [selectedShop]);

  const handleSave = async () => {
    if (!selectedShop || !isAdmin) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id), {
        name: settings.shopName,
        type: settings.shopType,
        address: settings.address,
        phone: settings.phone,
        gstNumber: settings.gstNumber,
        fssaiNumber: settings.fssaiNumber,
        'settings.leaseMode': settings.leaseMode,
        'settings.leaseDailyAmount': Number(settings.leaseDailyAmount),
        'settings.lesseeName': settings.lesseeName,
        'settings.lesseePhone': settings.lesseePhone,
        'settings.lesseeAddress': settings.lesseeAddress,
        'settings.leaseStartDate': settings.leaseStartDate,
        'settings.leaseEndDate': settings.leaseEndDate,
        'settings.openingTime': settings.openingTime,
        'settings.closingTime': settings.closingTime,
        'settings.lowStockAlert': settings.lowStockAlert,
        'settings.dayEndReminder': settings.dayEndReminder,
        'settings.reminderTime': settings.reminderTime,
        'settings.currency': settings.currency,
        'settings.dateFormat': settings.dateFormat,
        'settings.taxRate': Number(settings.taxRate),
        'settings.serviceCharge': Number(settings.serviceCharge),
        updatedAt: new Date(),
      });
      toast.success('Settings saved successfully');
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const sections = [
    { id: 'lease', label: 'Lease Mode', icon: Store },
    { id: 'shop', label: 'Shop Details', icon: Shield },
    { id: 'operations', label: 'Operations', icon: Clock },
    { id: 'billing', label: 'Billing & Tax', icon: DollarSign },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  if (!selectedShop) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
          <Settings size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
          <p>Select a shop to manage settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Settings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '4px 0 0' }}>
            {shopData?.name || selectedShop.name}
          </p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Save size={16} />}
            Save Changes
          </button>
        )}
      </div>

      {!isAdmin && (
        <div style={{ background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertTriangle size={16} color="#ffc107" />
          <span style={{ color: '#ffc107', fontSize: 14 }}>You have view-only access. Contact the shop owner to make changes.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
        {/* Sidebar nav */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 8, height: 'fit-content', border: '1px solid var(--border)' }}>
          {sections.map(sec => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(212,160,23,0.15)' : 'transparent',
                  color: active ? 'var(--gold)' : 'var(--text-secondary)',
                  fontSize: 14, fontWeight: active ? 600 : 400, textAlign: 'left',
                  transition: 'all 0.2s', marginBottom: 2,
                }}
              >
                <Icon size={16} />
                {sec.label}
                {active && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, border: '1px solid var(--border)' }}>

          {/* ── LEASE MODE ── */}
          {activeSection === 'lease' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', fontFamily: 'Syne, sans-serif' }}>Lease Mode</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 28px' }}>
                When enabled, kitchen & food categories are hidden and daily lease income is auto-applied.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'var(--surface-elevated)', borderRadius: 14, marginBottom: 24, border: settings.leaseMode ? '1px solid var(--gold)' : '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16 }}>Lease Mode</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    {settings.leaseMode ? '🟢 Active — Kitchen categories hidden, lease income auto-applied' : '⚪ Inactive — Full owner operation mode'}
                  </div>
                </div>
                <button
                  onClick={() => isAdmin && set('leaseMode', !settings.leaseMode)}
                  style={{ background: 'none', border: 'none', cursor: isAdmin ? 'pointer' : 'not-allowed', opacity: isAdmin ? 1 : 0.5 }}
                >
                  {settings.leaseMode
                    ? <ToggleRight size={44} color="var(--gold)" />
                    : <ToggleLeft size={44} color="var(--text-muted)" />
                  }
                </button>
              </div>

              {settings.leaseMode && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Daily Lease Amount (₹)</label>
                    <input className="form-input" type="number" value={settings.leaseDailyAmount} onChange={e => set('leaseDailyAmount', e.target.value)} placeholder="e.g. 5000" disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lessee Name</label>
                    <input className="form-input" value={settings.lesseeName} onChange={e => set('lesseeName', e.target.value)} placeholder="Lessee full name" disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lessee Phone</label>
                    <input className="form-input" value={settings.lesseePhone} onChange={e => set('lesseePhone', e.target.value)} placeholder="+91 XXXXX XXXXX" disabled={!isAdmin} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Lessee Address</label>
                    <textarea className="form-input" value={settings.lesseeAddress} onChange={e => set('lesseeAddress', e.target.value)} rows={2} placeholder="Full address" disabled={!isAdmin} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lease Start Date</label>
                    <input className="form-input" type="date" value={settings.leaseStartDate} onChange={e => set('leaseStartDate', e.target.value)} disabled={!isAdmin} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lease End Date</label>
                    <input className="form-input" type="date" value={settings.leaseEndDate} onChange={e => set('leaseEndDate', e.target.value)} disabled={!isAdmin} />
                  </div>
                </div>
              )}

              {!settings.leaseMode && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                  <Store size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Enable lease mode to configure lessee details</p>
                </div>
              )}
            </div>
          )}

          {/* ── SHOP DETAILS ── */}
          {activeSection === 'shop' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', fontFamily: 'Syne, sans-serif' }}>Shop Details</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 28px' }}>Basic information about this outlet</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Shop Name</label>
                  <input className="form-input" value={settings.shopName} onChange={e => set('shopName', e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={settings.shopType} onChange={e => set('shopType', e.target.value)} disabled={!isAdmin}>
                    <option value="bar">Bar</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="bar_restaurant">Bar & Restaurant</option>
                    <option value="wine_shop">Wine Shop</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address</label>
                  <textarea className="form-input" value={settings.address} onChange={e => set('address', e.target.value)} rows={2} disabled={!isAdmin} style={{ resize: 'vertical' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={settings.phone} onChange={e => set('phone', e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input className="form-input" value={settings.gstNumber} onChange={e => set('gstNumber', e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="form-group">
                  <label className="form-label">FSSAI Number</label>
                  <input className="form-input" value={settings.fssaiNumber} onChange={e => set('fssaiNumber', e.target.value)} disabled={!isAdmin} />
                </div>
              </div>
            </div>
          )}

          {/* ── OPERATIONS ── */}
          {activeSection === 'operations' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', fontFamily: 'Syne, sans-serif' }}>Operations</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 28px' }}>Business hours and operational settings</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Opening Time</label>
                  <input className="form-input" type="time" value={settings.openingTime} onChange={e => set('openingTime', e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="form-group">
                  <label className="form-label">Closing Time</label>
                  <input className="form-input" type="time" value={settings.closingTime} onChange={e => set('closingTime', e.target.value)} disabled={!isAdmin} />
                </div>
              </div>
            </div>
          )}

          {/* ── BILLING & TAX ── */}
          {activeSection === 'billing' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', fontFamily: 'Syne, sans-serif' }}>Billing & Tax</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 28px' }}>Configure tax rates and billing defaults</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Default Tax Rate (%)</label>
                  <input className="form-input" type="number" min="0" max="100" step="0.5" value={settings.taxRate} onChange={e => set('taxRate', e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Charge (%)</label>
                  <input className="form-input" type="number" min="0" max="100" step="0.5" value={settings.serviceCharge} onChange={e => set('serviceCharge', e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={settings.currency} onChange={e => set('currency', e.target.value)} disabled={!isAdmin}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date Format</label>
                  <select className="form-select" value={settings.dateFormat} onChange={e => set('dateFormat', e.target.value)} disabled={!isAdmin}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeSection === 'notifications' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', fontFamily: 'Syne, sans-serif' }}>Notifications</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 28px' }}>Configure alerts and reminders</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { key: 'lowStockAlert', label: 'Low Stock Alerts', desc: 'Get notified when inventory falls below threshold' },
                  { key: 'dayEndReminder', label: 'Day End Reminder', desc: 'Reminder to complete daily reconciliation' },
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--surface-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{item.label}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>{item.desc}</div>
                    </div>
                    <button onClick={() => isAdmin && set(item.key, !settings[item.key])} style={{ background: 'none', border: 'none', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                      {settings[item.key]
                        ? <ToggleRight size={38} color="var(--gold)" />
                        : <ToggleLeft size={38} color="var(--text-muted)" />
                      }
                    </button>
                  </div>
                ))}
                {settings.dayEndReminder && (
                  <div className="form-group" style={{ maxWidth: 200 }}>
                    <label className="form-label">Reminder Time</label>
                    <input className="form-input" type="time" value={settings.reminderTime} onChange={e => set('reminderTime', e.target.value)} disabled={!isAdmin} />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
