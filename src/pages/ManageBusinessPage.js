import React, { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Upload, Save, MapPin, Phone, Mail, FileText, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ManageBusinessPage() {
  const { selectedShop, user, isAdmin } = useAuth();
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name:'', type:'bar', address:'', city:'', state:'Tamil Nadu', pincode:'', phone:'', email:'', website:'', gstNumber:'', fssaiNumber:'', panNumber:'', logoURL:'' });

  useEffect(() => {
    if (!selectedShop) return;
    const unsub = onSnapshot(doc(db,'shops',selectedShop.id), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setForm({ name:d.name||'', type:d.type||'bar', address:d.address||'', city:d.city||'', state:d.state||'Tamil Nadu', pincode:d.pincode||'', phone:d.phone||'', email:d.email||'', website:d.website||'', gstNumber:d.gstNumber||'', fssaiNumber:d.fssaiNumber||'', panNumber:d.panNumber||'', logoURL:d.logoURL||'' });
      }
    });
    return unsub;
  }, [selectedShop]);

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2*1024*1024) { toast.error('Logo must be under 2MB'); return; }
    setUploading(true);
    try {
      const sref = ref(storage,`shops/${selectedShop.id}/logo_${Date.now()}`);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      setForm(f=>({...f,logoURL:url}));
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!isAdmin) return toast.error('Only shop owner can edit business details');
    if (!form.name.trim()) return toast.error('Business name required');
    setSaving(true);
    try {
      await updateDoc(doc(db,'shops',selectedShop.id), { ...form, updatedAt:new Date() });
      toast.success('Business details saved ✅');
    } catch(e) { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  if (!selectedShop) return <div className="page-container" style={{textAlign:'center',padding:'80px 20px',color:'#94a3b8'}}><p>Select a shop first</p></div>;

  return (
    <div className="page-container fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>Manage Business</h1>
          <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>Business profile, GSTIN, logo & contact details</p>
        </div>
        {isAdmin && <button className="btn-primary" onClick={handleSave} disabled={saving} style={{display:'flex',alignItems:'center',gap:8}}>
          {saving?<><div className="spinner" style={{width:15,height:15,borderTopColor:'#fff'}}/>Saving…</>:<><Save size={15}/>Save Changes</>}
        </button>}
      </div>

      {!isAdmin && (
        <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'12px 16px',marginBottom:20,display:'flex',gap:10,alignItems:'center'}}>
          <Shield size={16} color="#d97706"/>
          <span style={{color:'#92400e',fontSize:14}}>View only — contact shop owner to make changes.</span>
        </div>
      )}

      <div className="grid-2-collapse" style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:24}}>
        {/* Logo */}
        <div>
          <div style={{background:'#fff',borderRadius:20,border:'1.5px solid #e2e8f0',padding:'24px',textAlign:'center',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0f172a',marginBottom:16}}>Business Logo</div>
            <div style={{width:120,height:120,borderRadius:20,border:'2px dashed #bfdbfe',background:'#f0f9ff',margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',cursor:'pointer'}} onClick={()=>isAdmin&&document.getElementById('logo-input').click()}>
              {form.logoURL ? <img src={form.logoURL} alt="Logo" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{textAlign:'center'}}><Building2 size={36} color="#bfdbfe"/><div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>Click to upload</div></div>}
            </div>
            {isAdmin && <>
              <input id="logo-input" type="file" accept="image/*" onChange={handleLogo} style={{display:'none'}}/>
              <button onClick={()=>document.getElementById('logo-input').click()} disabled={uploading} style={{padding:'8px 20px',borderRadius:10,border:'1.5px solid #bfdbfe',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6,margin:'0 auto'}}>
                <Upload size={13}/> {uploading?'Uploading…':'Upload Logo'}
              </button>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:8}}>PNG or JPG, max 2MB</div>
            </>}
          </div>
        </div>

        {/* Details */}
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          {/* Basic */}
          <div style={{background:'#fff',borderRadius:20,border:'1.5px solid #e2e8f0',padding:'24px',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',marginBottom:18,display:'flex',alignItems:'center',gap:8}}><Building2 size={18} color="#2563eb"/> Basic Information</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div className="form-group" style={{gridColumn:'1/-1'}}>
                <label className="form-label">Business Name *</label>
                <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Siruvani Bar & Kitchen" disabled={!isAdmin} style={{fontSize:16,fontWeight:600}}/>
              </div>
              <div className="form-group">
                <label className="form-label">Business Type</label>
                <select className="form-select" value={form.type} onChange={e=>set('type',e.target.value)} disabled={!isAdmin}>
                  {['bar','restaurant','bar_restaurant','wine_shop','hotel'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 XXXXX XXXXX" disabled={!isAdmin}/>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="business@email.com" disabled={!isAdmin}/>
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website} onChange={e=>set('website',e.target.value)} placeholder="www.example.com" disabled={!isAdmin}/>
              </div>
            </div>
          </div>

          {/* Address */}
          <div style={{background:'#fff',borderRadius:20,border:'1.5px solid #e2e8f0',padding:'24px',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',marginBottom:18,display:'flex',alignItems:'center',gap:8}}><MapPin size={18} color="#059669"/> Address</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div className="form-group" style={{gridColumn:'1/-1'}}>
                <label className="form-label">Street Address</label>
                <textarea className="form-input" value={form.address} onChange={e=>set('address',e.target.value)} rows={2} style={{resize:'vertical'}} disabled={!isAdmin} placeholder="Shop No., Street, Area"/>
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Tiruppur" disabled={!isAdmin}/>
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-input" value={form.state} onChange={e=>set('state',e.target.value)} placeholder="Tamil Nadu" disabled={!isAdmin}/>
              </div>
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input className="form-input" value={form.pincode} onChange={e=>set('pincode',e.target.value)} placeholder="641001" disabled={!isAdmin}/>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div style={{background:'#fff',borderRadius:20,border:'1.5px solid #e2e8f0',padding:'24px',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',marginBottom:18,display:'flex',alignItems:'center',gap:8}}><FileText size={18} color="#7c3aed"/> Tax & Compliance</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input className="form-input" value={form.gstNumber} onChange={e=>set('gstNumber',e.target.value)} placeholder="22AAAAA0000A1Z5" disabled={!isAdmin} style={{fontFamily:'monospace'}}/>
              </div>
              <div className="form-group">
                <label className="form-label">PAN Number</label>
                <input className="form-input" value={form.panNumber} onChange={e=>set('panNumber',e.target.value)} placeholder="AAAAA0000A" disabled={!isAdmin} style={{fontFamily:'monospace'}}/>
              </div>
              <div className="form-group">
                <label className="form-label">FSSAI License</label>
                <input className="form-input" value={form.fssaiNumber} onChange={e=>set('fssaiNumber',e.target.value)} placeholder="FSSAI number" disabled={!isAdmin} style={{fontFamily:'monospace'}}/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
