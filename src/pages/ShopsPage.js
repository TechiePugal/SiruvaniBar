import React, { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Store, Crown, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const SHOP_TYPES = ['bar','restaurant','bar_restaurant','wine_shop'];

export default function ShopsPage() {
  const { user, userShops, refreshShops, selectShop, selectedShop, isSuperAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editShop, setEditShop]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ name:'', address:'', phone:'', gstNumber:'', fssaiNumber:'', type:'bar' });

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Shop name is required');
    setSaving(true);
    try {
      if (editShop) {
        await updateDoc(doc(db,'shops',editShop.id), { ...form, updatedAt:serverTimestamp() });
        toast.success('Shop updated ✅');
      } else {
        await addDoc(collection(db,'shops'), {
          ...form, ownerId:user.uid, ownerEmail:user.email,
          members:[], memberEmails:[],
          settings:{ leaseMode:false, leaseDailyAmount:0 },
          createdAt:serverTimestamp(),
        });
        toast.success(`"${form.name}" created ✅`);
      }
      await refreshShops();
      setShowModal(false); setEditShop(null);
      setForm({ name:'', address:'', phone:'', gstNumber:'', fssaiNumber:'', type:'bar' });
    } catch(e) { toast.error('Failed to save'); console.error(e); }
    finally { setSaving(false); }
  };

  const openEdit = (shop) => {
    setEditShop(shop);
    setForm({ name:shop.name||'', address:shop.address||'', phone:shop.phone||'', gstNumber:shop.gstNumber||'', fssaiNumber:shop.fssaiNumber||'', type:shop.type||'bar' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shop? All data will be lost.')) return;
    try { await deleteDoc(doc(db,'shops',id)); await refreshShops(); toast.success('Shop deleted'); }
    catch { toast.error('Delete failed'); }
  };

  const myShops   = isSuperAdmin ? userShops : userShops.filter(s=>s.ownerId===user?.uid);
  const memberOf  = isSuperAdmin ? [] : userShops.filter(s=>s.ownerId!==user?.uid);

  return (
    <div className="page-container fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>Manage Shops</h1>
          <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>{userShops.length} shop{userShops.length!==1?'s':''} total</p>
        </div>
        {isSuperAdmin && <button className="btn-primary" onClick={()=>{setEditShop(null);setForm({name:'',address:'',phone:'',gstNumber:'',fssaiNumber:'',type:'bar'});setShowModal(true);}} style={{display:'flex',alignItems:'center',gap:8}}>
          <Plus size={16}/> New Shop
        </button>}
      </div>

      {userShops.length===0 ? (
        <div style={{textAlign:'center',padding:'80px 20px',background:'#fff',borderRadius:20,border:'1.5px dashed #e2e8f0'}}>
          <div style={{fontSize:56,marginBottom:16,opacity:0.3}}>🏪</div>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:20,color:'#475569',marginBottom:10}}>No shops yet</div>
          <button className="btn-primary" onClick={()=>setShowModal(true)} style={{display:'inline-flex',alignItems:'center',gap:8}}><Plus size={15}/>Create Your First Shop</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
          {userShops.map(shop=>{
            const isOwner = shop.ownerId===user?.uid || isSuperAdmin;
            const isActive = selectedShop?.id===shop.id;
            return (
              <div key={shop.id} style={{background:'#fff',borderRadius:20,border:`2px solid ${isActive?'#2563eb':'#e2e8f0'}`,boxShadow:isActive?'0 4px 24px rgba(37,99,235,0.15)':'0 2px 10px rgba(15,23,42,0.06)',overflow:'hidden',transition:'all 0.2s'}}>
                <div style={{height:8,background:isActive?'linear-gradient(90deg,#2563eb,#3b82f6)':'#f1f5f9'}}/>
                <div style={{padding:'20px 22px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div>
                      <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:18,color:'#0f172a',marginBottom:4}}>{shop.name}</div>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11.5,fontWeight:600,background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',textTransform:'capitalize'}}>{shop.type?.replace('_',' ')||'Bar'}</span>
                    </div>
                    {isOwner ? <span style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:20,background:'#fffbeb',color:'#d97706',border:'1px solid #fde68a',fontSize:12,fontWeight:700}}><Crown size={12}/>Owner</span>
                      : <span style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:20,background:'#f0fdf4',color:'#059669',border:'1px solid #bbf7d0',fontSize:12,fontWeight:700}}><Users size={12}/>Member</span>}
                  </div>
                  {shop.address && <div style={{fontSize:13,color:'#64748b',marginBottom:4}}>📍 {shop.address}</div>}
                  {shop.phone   && <div style={{fontSize:13,color:'#64748b',marginBottom:4}}>📞 {shop.phone}</div>}
                  {shop.gstNumber && <div style={{fontSize:12,color:'#94a3b8',fontFamily:'monospace'}}>GST: {shop.gstNumber}</div>}
                  <div style={{display:'flex',gap:8,marginTop:16}}>
                    <button onClick={()=>selectShop(shop)} disabled={isActive} style={{flex:1,padding:'9px',borderRadius:10,border:`1.5px solid ${isActive?'#bfdbfe':'#e2e8f0'}`,background:isActive?'#eff6ff':'#f8fafc',color:isActive?'#2563eb':'#64748b',cursor:isActive?'not-allowed':'pointer',fontSize:13,fontWeight:700}}>
                      {isActive?'✓ Active':'Select'}
                    </button>
                    {isOwner && <>
                      <button onClick={()=>openEdit(shop)} style={{width:38,height:38,borderRadius:10,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <Edit2 size={14} color="#475569"/>
                      </button>
                      <button onClick={()=>handleDelete(shop.id)} style={{width:38,height:38,borderRadius:10,border:'1.5px solid #fecaca',background:'#fef2f2',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <Trash2 size={14} color="#dc2626"/>
                      </button>
                    </>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0'}}>
            <div style={{padding:'22px 26px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:20,color:'#0f172a'}}>{editShop?'✏️ Edit Shop':'🏪 New Shop'}</div>
              <button onClick={()=>setShowModal(false)} style={{width:32,height:32,borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:18}}>✕</button>
            </div>
            <div style={{padding:'22px 26px',display:'flex',flexDirection:'column',gap:14}}>
              <div className="form-group">
                <label className="form-label">Shop Name *</label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Siruvani Bar & Kitchen" autoFocus/>
              </div>
              <div className="form-group">
                <label className="form-label">Shop Type</label>
                <select className="form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {SHOP_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-input" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} rows={2} placeholder="Full address" style={{resize:'vertical'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91 XXXXX XXXXX"/>
                </div>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input className="form-input" value={form.gstNumber} onChange={e=>setForm(f=>({...f,gstNumber:e.target.value}))} placeholder="GSTIN"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">FSSAI Number</label>
                <input className="form-input" value={form.fssaiNumber} onChange={e=>setForm(f=>({...f,fssaiNumber:e.target.value}))} placeholder="Optional"/>
              </div>
            </div>
            <div style={{padding:'0 26px 24px',display:'flex',gap:10}}>
              <button onClick={()=>setShowModal(false)} className="btn-secondary" style={{flex:1,padding:'12px',fontWeight:600}}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary" style={{flex:2,padding:'12px',fontWeight:700,justifyContent:'center'}}>
                {saving?<><div className="spinner" style={{width:15,height:15,borderTopColor:'#fff'}}/>Saving…</> : editShop?'✅ Update Shop':'✅ Create Shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
