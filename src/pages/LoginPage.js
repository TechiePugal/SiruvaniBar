import React, { useState } from 'react';
import { useAuth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { loginWithEmail } = useAuth();
  const [mode, setMode]         = useState('admin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Enter email and password');
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err) {
      const msg =
        err.code === 'auth/invalid-credential'     ? 'Wrong email or password' :
        err.code === 'auth/wrong-password'         ? 'Wrong password' :
        err.code === 'auth/user-not-found'         ? 'No account with this email' :
        err.code === 'auth/too-many-requests'      ? 'Too many attempts — try again later' :
        err.code === 'auth/network-request-failed' ? 'Network error — check connection' :
                                                     `Error: ${err.code || err.message}`;
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #0f2554 0%, #1a3a87 45%, #1a56db 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', fontFamily: 'Inter, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <div style={{ position:'absolute', top:'-10%', right:'-5%', width:340, height:340, borderRadius:'50%', background:'rgba(96,165,250,0.12)', filter:'blur(40px)' }}/>
      <div style={{ position:'absolute', bottom:'-15%', left:'-10%', width:400, height:400, borderRadius:'50%', background:'rgba(59,130,246,0.10)', filter:'blur(50px)' }}/>

      <div style={{ width: '100%', maxWidth: 420, position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(59,130,246,0.45)' }}>🍺</div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 28, color: '#fff', margin: '0 0 5px', letterSpacing: '-0.5px' }}>Siruvani POS</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0 }}>Bar &amp; Kitchen Management</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 24, padding: '28px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#f1f5fb', borderRadius: 14, padding: 4, marginBottom: 24 }}>
            {[
              { id: 'admin',      icon: '🛡️', label: 'Admin' },
              { id: 'restaurant', icon: '🍽️', label: 'Restaurant' },
            ].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setEmail(''); setPassword(''); }} style={{ flex: 1, padding: '11px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', background: mode === m.id ? '#1a56db' : 'transparent', color: mode === m.id ? '#fff' : '#6b7280', fontWeight: mode === m.id ? 700 : 500, fontSize: 14, transition: 'all 0.2s', fontFamily: 'Inter,sans-serif', boxShadow: mode === m.id ? '0 4px 12px rgba(26,86,219,0.3)' : 'none' }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 19, color: '#0d1b2e', margin: '0 0 4px', letterSpacing: '-0.2px' }}>
            {mode === 'admin' ? 'Admin Sign In' : 'Restaurant Sign In'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>
            {mode === 'admin' ? 'Full access to all shops, staff and reports' : 'Sign in with your shop credentials'}
          </p>

          {mode === 'admin' && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#1a56db', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Default Credentials</div>
                <div style={{ fontSize: 12.5, color: '#374151', fontFamily: 'monospace' }}>{SUPER_ADMIN_EMAIL}</div>
                <div style={{ fontSize: 12.5, color: '#374151', fontFamily: 'monospace' }}>{SUPER_ADMIN_PASS}</div>
              </div>
              <button onClick={() => { setEmail(SUPER_ADMIN_EMAIL); setPassword(SUPER_ADMIN_PASS); }} style={{ padding: '7px 13px', borderRadius: 9, border: '1.5px solid #1a56db', background: '#fff', color: '#1a56db', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Auto-fill
              </button>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={mode === 'admin' ? SUPER_ADMIN_EMAIL : 'your@email.com'} autoComplete="email" disabled={loading} />
            </div>
            <div className="form-group" style={{ marginBottom: 22 }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" disabled={loading} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 12, justifyContent: 'center' }}>
              {loading ? <><div className="spinner" style={{ width: 17, height: 17, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Signing in…</> : 'Sign In →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 18, lineHeight: 1.6 }}>
          Restaurant accounts are created by the Admin.
        </p>
      </div>
    </div>
  );
}
