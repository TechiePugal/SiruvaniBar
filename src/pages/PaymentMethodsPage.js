import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, CreditCard, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PRESET_TYPES = [
  {id:'cash',    label:'Cash',         emoji:'💵', color:'#059669'},
  {id:'upi',     label:'UPI / GPay',   emoji:'📱', color:'#2563eb'},
  {id:'card',    label:'Card',         emoji:'💳', color:'#7c3aed'},
  {id:'bank',    label:'Bank Transfer',emoji:'🏦', color:'#0891b2'},
  {id:'cheque',  label:'Cheque / DD',  emoji:'📝', color:'#475569'},
  {id:'credit',  label:'Credit',       emoji:'📋', color:'#dc2626'},
];

const EMPTY = () => ({name:'', type:'cash', description:'', isActive:true});

export default function PaymentMethodsPage() {
  const { selectedShop } = useAuth();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState(EMPTY());
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db,'shops',selectedShop.id,'payment_methods'), orderBy('name'));
    return onSnapshot(q,
      snap => { setMethods(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false)
    );
  }, [selectedShop]);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Method name required');
    setSaving(true);
    try {
      const data = { ...form, name:form.name.trim(), updatedAt:new Date() };
      if (editId) {
        await updateDoc(doc(db,'shops',selectedShop.id,'payment_methods',editId), data);
        toast.success('Updated ✅');
      } else {
        await addDoc(collection(db,'shops',selectedShop.id,'payment_methods'), { ...data, createdAt:new Date() });
        toast.success('Payment method added ✅');
      }
      setShowForm(false); setEditId(null); setForm(EMPTY());
    } catch(e) { toast.error('Failed: '+e.message); }
    finally { setSaving(false); }
  };

  const openEdit = m => {
    setEditId(m.id);
    setForm({ name:m.name, type:m.type||'cash', description:m.description||'', isActive:m.isActive!==false });
    setShowForm(true);
  };

  const handleDelete = async m => {
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    await deleteDoc(doc(db,'shops',selectedShop.id,'payment_methods',m.id));
    toast.success('Deleted');
  };

  const toggleActive = async m => {
    await updateDoc(doc(db,'shops',selectedShop.id,'payment_methods',m.id), { isActive:!m.isActive });
  };

  const addPresets = async () => {
    if (!window.confirm('Add default payment methods (Cash, GPay, UPI, Card, Bank Transfer)?')) return;
    const defaults = [
      {name:'Cash',          type:'cash',   description:'Physical cash payment'},
      {name:'GPay',          type:'upi',    description:'Google Pay UPI'},
      {name:'PhonePe',       type:'upi',    description:'PhonePe UPI'},
      {name:'Paytm',         type:'upi',    description:'Paytm UPI / Wallet'},
      {name:'UPI',           type:'upi',    description:'Any UPI payment'},
      {name:'Cash Counter 1',type:'cash',   description:'Front counter cash'},
      {name:'Cash Counter 2',type:'cash',   description:'Back counter cash'},
      {name:'Card (Visa/MC)',type:'card',   description:'Debit/Credit card'},
      {name:'Bank Transfer', type:'bank',   description:'NEFT/RTGS/IMPS'},
      {name:'Cheque',        type:'cheque', description:'Cheque payment'},
      {name:'Credit (Party)',type:'credit', description:'On credit — pay later'},
    ];
    try {
      for (const d of defaults) {
        await addDoc(collection(db,'shops',selectedShop.id,'payment_methods'), { ...d, isActive:true, createdAt:new Date(), updatedAt:new Date() });
      }
      toast.success('Default methods added ✅');
    } catch(e) { toast.error('Failed: '+e.message); }
  };

  const typeInfo = t => PRESET_TYPES.find(p=>p.id===t)||PRESET_TYPES[0];

  if (!selectedShop) return (
    <div className="page-container" style={{textAlign:'center',padding:'80px 20px',color:'#94a3b8'}}>
      <div style={{fontSize:48,opacity:0.3,marginBottom:12}}>💳</div><p>Select a shop first</p>
    </div>
  );

  return (
    <div className="page-container fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>Payment Methods</h1>
          <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>Define all payment modes used across billing, invoices & purchases</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          {methods.length===0&&(
            <button onClick={addPresets} style={{padding:'10px 18px',borderRadius:10,border:'1.5px solid #bfdbfe',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
              ⚡ Add Defaults
            </button>
          )}
          <button className="btn-primary" onClick={()=>{setEditId(null);setForm(EMPTY());setShowForm(true);}} style={{display:'flex',alignItems:'center',gap:8}}>
            <Plus size={16}/> Add Method
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'12px 16px',marginBottom:24,display:'flex',gap:10,alignItems:'flex-start'}}>
        <CreditCard size={18} color="#2563eb" style={{flexShrink:0,marginTop:1}}/>
        <div style={{fontSize:13,color:'#1d4ed8'}}>
          <strong>Payment methods defined here appear in dropdowns throughout the app</strong> — invoices, purchases, expenses, and day-end reconciliation. Add names like "Cash Counter 1", "Paytm", "Acc-1234" etc.
        </div>
      </div>

      {loading ? <div style={{textAlign:'center',padding:60}}><div className="spinner"/></div>
      : methods.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 20px',background:'#fff',borderRadius:20,border:'1.5px dashed #e2e8f0'}}>
          <div style={{fontSize:56,marginBottom:14,opacity:0.25}}>💳</div>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:18,color:'#475569',marginBottom:8}}>No payment methods yet</div>
          <p style={{color:'#94a3b8',fontSize:14,marginBottom:16}}>Add payment methods like "Cash", "GPay", "Cash Counter 1", "Acc-1234"</p>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <button onClick={addPresets} style={{padding:'10px 20px',borderRadius:10,border:'1.5px solid #bfdbfe',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:13,fontWeight:700}}>⚡ Add Default Methods</button>
            <button className="btn-primary" onClick={()=>setShowForm(true)} style={{display:'inline-flex',alignItems:'center',gap:8}}><Plus size={14}/>Custom Method</button>
          </div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
          {methods.map(m=>{
            const t = typeInfo(m.type);
            return (
              <div key={m.id} style={{background:'#fff',borderRadius:14,border:`1.5px solid ${m.isActive===false?'#f1f5f9':'#e2e8f0'}`,boxShadow:'0 2px 8px rgba(15,23,42,0.05)',padding:'14px 16px',opacity:m.isActive===false?0.55:1,transition:'all 0.2s'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                  <div style={{width:42,height:42,borderRadius:12,background:t.color+'14',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,border:`1.5px solid ${t.color}25`}}>
                    {t.emoji}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15,color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.name}</div>
                    <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:t.color+'14',color:t.color}}>{t.label}</span>
                  </div>
                </div>
                {m.description&&<div style={{fontSize:12,color:'#94a3b8',marginBottom:10}}>{m.description}</div>}
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <button onClick={()=>toggleActive(m)} style={{padding:'5px 10px',borderRadius:8,border:`1.5px solid ${m.isActive!==false?'#a7f3d0':'#e2e8f0'}`,background:m.isActive!==false?'#ecfdf5':'#f8fafc',color:m.isActive!==false?'#059669':'#94a3b8',cursor:'pointer',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>
                    <CheckCircle size={11}/> {m.isActive!==false?'Active':'Inactive'}
                  </button>
                  <div style={{flex:1}}/>
                  <button onClick={()=>openEdit(m)} style={{width:30,height:30,borderRadius:8,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Edit2 size={13} color="#475569"/>
                  </button>
                  <button onClick={()=>handleDelete(m)} style={{width:30,height:30,borderRadius:8,border:'1.5px solid #fecaca',background:'#fef2f2',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Trash2 size={13} color="#dc2626"/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm&&(
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:19,color:'#0f172a'}}>{editId?'✏️ Edit Method':'💳 Add Payment Method'}</div>
              <button onClick={()=>setShowForm(false)} style={{width:32,height:32,borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:18}}>✕</button>
            </div>
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
              <div className="form-group">
                <label className="form-label">Method Name * (what appears in dropdowns)</label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Cash Counter 1, Paytm, Acc-1234" autoFocus style={{fontSize:15,fontWeight:600}}/>
              </div>
              <div className="form-group">
                <label className="form-label">Type (for grouping)</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                  {PRESET_TYPES.map(t=>(
                    <button key={t.id} onClick={()=>setForm(f=>({...f,type:t.id}))} style={{padding:'8px 6px',borderRadius:10,border:`2px solid ${form.type===t.id?t.color:'#e2e8f0'}`,background:form.type===t.id?t.color+'14':'#f8fafc',color:form.type===t.id?t.color:'#64748b',cursor:'pointer',fontSize:12,fontWeight:form.type===t.id?700:500,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                      {t.emoji} {t.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Front desk cash register"/>
              </div>
            </div>
            <div style={{padding:'0 24px 22px',display:'flex',gap:10}}>
              <button onClick={()=>setShowForm(false)} className="btn-secondary" style={{flex:1,padding:'12px',fontWeight:600}}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{flex:2,padding:'12px',fontWeight:700,justifyContent:'center'}}>
                {saving?<><div className="spinner" style={{width:15,height:15,borderTopColor:'#fff'}}/>Saving…</>:`✅ ${editId?'Update':'Add'} Method`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
