import React, { useState, useEffect } from 'react';
import { useAuth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { loginWithEmail } = useAuth();
  const [mode, setMode]       = useState('admin');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [init, setInit]       = useState(true);

  useEffect(() => { const t = setTimeout(() => setInit(false), 2800); return () => clearTimeout(t); }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Enter email and password');
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err) {
      const msg =
        err.code === 'auth/invalid-credential'    ? 'Wrong email or password' :
        err.code === 'auth/wrong-password'        ? 'Wrong password' :
        err.code === 'auth/user-not-found'        ? 'No account with this email' :
        err.code === 'auth/too-many-requests'     ? 'Too many attempts — try later' :
        err.code === 'auth/network-request-failed'? 'Network error' :
                                                    `Error: ${err.code}`;
      toast.error(msg);
    } finally { setLoading(false); }
  };

  if (init) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)' }}>🍺</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 26, color: '#fff' }}>Siruvani POS</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6 }}>Initialising system…</div>
      </div>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 50%, #f0f9ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(37,99,235,0.35)' }}>🍺</div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 28, color: '#0f172a', margin: '0 0 6px' }}>Siruvani POS</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Bar & Kitchen Management</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#fff', borderRadius: 14, padding: 4, marginBottom: 24, border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          {[
            { id: 'admin',      icon: '🛡️', label: 'Admin Login',      sub: 'Super Administrator' },
            { id: 'restaurant', icon: '🍽️', label: 'Restaurant Login', sub: 'Shop Staff / Manager' },
          ].map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setEmail(''); setPassword(''); }} style={{ flex: 1, padding: '12px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', background: mode === m.id ? '#2563eb' : 'transparent', color: mode === m.id ? '#fff' : '#64748b', fontWeight: mode === m.id ? 700 : 500, fontSize: 13, transition: 'all 0.2s', lineHeight: 1.3, fontFamily: 'DM Sans,sans-serif' }}>
              <div>{m.icon} {m.label}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{m.sub}</div>
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 24, border: '1.5px solid #e2e8f0', padding: '32px 28px', boxShadow: '0 8px 40px rgba(37,99,235,0.10)' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 20, color: '#0f172a', margin: '0 0 5px' }}>
            {mode === 'admin' ? '🛡️ Admin Sign In' : '🍽️ Restaurant Sign In'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 22px' }}>
            {mode === 'admin' ? 'Full system access — shops, staff, reports.' : 'Sign in with your restaurant credentials.'}
          </p>

          {mode === 'admin' && (
            <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11.5, color: '#1d4ed8', fontWeight: 700, marginBottom: 4 }}>Default Admin Credentials</div>
                <div style={{ fontSize: 12.5, color: '#334155', fontFamily: 'monospace' }}>{SUPER_ADMIN_EMAIL}</div>
                <div style={{ fontSize: 12.5, color: '#334155', fontFamily: 'monospace' }}>{SUPER_ADMIN_PASS}</div>
              </div>
              <button onClick={() => { setEmail(SUPER_ADMIN_EMAIL); setPassword(SUPER_ADMIN_PASS); }} style={{ padding: '7px 14px', borderRadius: 9, border: '1.5px solid #2563eb', background: 'transparent', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                Auto-fill ↓
              </button>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={mode === 'admin' ? SUPER_ADMIN_EMAIL : 'your@email.com'} autoComplete="email" disabled={loading} />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" disabled={loading} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 12, justifyContent: 'center' }}>
              {loading ? <><div className="spinner" style={{ width: 17, height: 17, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Signing in…</> : mode === 'admin' ? '🛡️ Sign In as Admin' : '🍽️ Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20, lineHeight: 1.6 }}>
          Restaurant accounts are created by the Admin.<br />Contact your system administrator for access.
        </p>
      </div>
    </div>
  );
}
