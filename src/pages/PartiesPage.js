import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, getDocs, where
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Edit2, Trash2, Phone, MapPin, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

const money = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:0})}`;
const emptyForm = () => ({
  name:'', type:'customer', phone:'', email:'',
  address:'', gstin:'', openingBalance:0, balanceType:'receivable', notes:''
});

/* ─── Party Ledger Modal ──────────────────────────────────────────────── */
function PartyLedger({ party, shopId, onClose }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Load invoices for this customer
        const snap = await getDocs(
          query(collection(db,'shops',shopId,'invoices'), where('customerName','==',party.name))
        );
        // Load purchases for this vendor
        const pSnap = await getDocs(
          query(collection(db,'shops',shopId,'purchases'), where('vendorName','==',party.name))
        );
        const invDocs = snap.docs.map(d=>({id:d.id,...d.data(),docType:'invoice'}));
        const purDocs = pSnap.docs.map(d=>({id:d.id,...d.data(),docType:'purchase'}));
        const all = [...invDocs,...purDocs].sort((a,b)=>new Date(b.date)-new Date(a.date));
        setInvoices(all);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [party.name, shopId]);

  const totalInvoiced  = invoices.filter(d=>d.docType==='invoice').reduce((s,d)=>s+(d.grandTotal||0),0);
  const totalPaidInv   = invoices.filter(d=>d.docType==='invoice'&&d.status==='paid').reduce((s,d)=>s+(d.grandTotal||0),0);
  const totalPurchased = invoices.filter(d=>d.docType==='purchase').reduce((s,d)=>s+(d.totalAmount||0),0);
  const totalPaidPur   = invoices.filter(d=>d.docType==='purchase').reduce((s,d)=>s+(d.paidAmount||0),0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:620,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0'}}>
        <div style={{padding:'20px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'#fff',zIndex:10}}>
          <div>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:18,color:'#0f172a'}}>{party.name}</div>
            <div style={{fontSize:13,color:'#64748b',marginTop:1}}>{party.type==='customer'?'Customer':'Vendor'} Ledger</div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:18}}>✕</button>
        </div>
        {/* Balance strip */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,padding:'16px 24px',borderBottom:'1px solid #e2e8f0'}}>
          {party.type==='customer'
            ? [
                {label:'Total Invoiced',  val:totalInvoiced,           color:'#2563eb'},
                {label:'Paid',            val:totalPaidInv,            color:'#059669'},
                {label:'Outstanding',     val:totalInvoiced-totalPaidInv, color:(totalInvoiced-totalPaidInv)>0?'#dc2626':'#059669'},
                {label:'Opening Balance', val:party.openingBalance||0, color:'#d97706'},
              ]
            : [
                {label:'Total Purchased', val:totalPurchased,             color:'#d97706'},
                {label:'Paid to Vendor',  val:totalPaidPur,              color:'#059669'},
                {label:'Balance Due',     val:party.balance||totalPurchased-totalPaidPur, color:'#dc2626'},
                {label:'Opening Balance', val:party.openingBalance||0,   color:'#7c3aed'},
              ]
          }.map(k=>(
            <div key={k.label} style={{textAlign:'center',padding:'10px',background:'#f8faff',borderRadius:12,border:'1px solid #e0e7ff'}}>
              <div style={{fontSize:11,color:'#64748b',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>{k.label}</div>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:17,color:k.color}}>{money(k.val)}</div>
            </div>
          ))}
        </div>
        {/* Transaction list */}
        <div style={{padding:'16px 24px'}}>
          <div style={{fontWeight:700,fontSize:14,color:'#0f172a',marginBottom:12}}>
            Transaction History ({invoices.length})
          </div>
          {loading ? <div style={{textAlign:'center',padding:30}}><div className="spinner"/></div>
          : invoices.length===0
            ? <div style={{textAlign:'center',padding:'30px',color:'#94a3b8',fontSize:14}}>No transactions yet</div>
            : invoices.map(d=>(
              <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderRadius:12,border:'1.5px solid #f1f5f9',marginBottom:8,background:'#f8fafc'}}>
                <div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:d.docType==='invoice'?'#eff6ff':'#fffbeb',color:d.docType==='invoice'?'#2563eb':'#d97706'}}>
                      {d.docType==='invoice'?'Invoice':'Purchase'}
                    </span>
                    <span style={{fontFamily:'monospace',fontWeight:700,color:'#475569',fontSize:13}}>{d.number||d.invoiceNo||'—'}</span>
                  </div>
                  <div style={{fontSize:12,color:'#94a3b8',marginTop:3}}>{d.date}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:800,color:'#0f172a',fontSize:15}}>{money(d.grandTotal||d.totalAmount||0)}</div>
                  <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
                    background:d.status==='paid'?'#ecfdf5':d.status==='partial'?'#fffbeb':'#fef2f2',
                    color:d.status==='paid'?'#059669':d.status==='partial'?'#d97706':'#dc2626'}}>
                    {d.status==='paid'?'Paid':d.status==='partial'?'Partial':'Unpaid'}
                  </span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════ */
export default function PartiesPage() {
  const { selectedShop } = useAuth();
  const [parties, setParties]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(emptyForm());
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewParty, setViewParty]   = useState(null);

  useEffect(() => {
    if (!selectedShop) return;
    // NO composite index needed — just order by name, filter client-side
    const q = query(collection(db,'shops',selectedShop.id,'parties'), orderBy('name'));
    return onSnapshot(q,
      snap => { setParties(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      err  => { console.error('Parties load error:',err); setLoading(false); }
    );
  }, [selectedShop]);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      const data = { ...form, openingBalance:parseFloat(form.openingBalance)||0, updatedAt:new Date() };
      if (editId) {
        await updateDoc(doc(db,'shops',selectedShop.id,'parties',editId), data);
        toast.success('Party updated ✅');
      } else {
        await addDoc(collection(db,'shops',selectedShop.id,'parties'), { ...data, balance:parseFloat(data.openingBalance)||0, createdAt:new Date() });
        toast.success('Party added ✅');
      }
      setShowForm(false); setEditId(null); setForm(emptyForm());
    } catch(e) { toast.error('Failed to save: '+e.message); }
    finally { setSaving(false); }
  };

  const openEdit = p => {
    setEditId(p.id);
    setForm({ name:p.name||'', type:p.type||'customer', phone:p.phone||'', email:p.email||'', address:p.address||'', gstin:p.gstin||'', openingBalance:p.openingBalance||0, balanceType:p.balanceType||'receivable', notes:p.notes||'' });
    setShowForm(true);
  };

  const handleDelete = async p => {
    if (!window.confirm(`Delete "${p.name}"? This will not affect existing invoices/purchases.`)) return;
    try { await deleteDoc(doc(db,'shops',selectedShop.id,'parties',p.id)); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  // Client-side filter — no composite index needed
  const filtered = parties.filter(p => {
    const matchType = filterType==='all' || p.type===filterType;
    const matchQ    = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || (p.phone||'').includes(search);
    return matchType && matchQ;
  });

  const totalReceivable = parties.filter(p=>p.type==='customer').reduce((s,p)=>s+(p.openingBalance||0),0);
  const totalPayable    = parties.filter(p=>p.type==='vendor').reduce((s,p)=>s+(p.balance||p.openingBalance||0),0);

  if (!selectedShop) return (
    <div className="page-container" style={{textAlign:'center',padding:'80px 20px',color:'#94a3b8'}}>
      <div style={{fontSize:48,opacity:0.3,marginBottom:12}}>👥</div><p>Select a shop first</p>
    </div>
  );

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>Parties</h1>
          <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>Customers & Vendors — ledger, balances, statements</p>
        </div>
        <button className="btn-primary" onClick={()=>{setEditId(null);setForm(emptyForm());setShowForm(true);}} style={{display:'flex',alignItems:'center',gap:8}}>
          <Plus size={16}/> Add Party
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:24}}>
        {[
          {label:'Total Parties',  val:parties.length,   color:'#2563eb', bg:'#eff6ff', icon:'👥', isCnt:true},
          {label:'Customers',      val:parties.filter(p=>p.type==='customer').length, color:'#7c3aed', bg:'#f5f3ff', icon:'👤', isCnt:true},
          {label:'Vendors',        val:parties.filter(p=>p.type==='vendor').length,   color:'#d97706', bg:'#fffbeb', icon:'🏢', isCnt:true},
          {label:'Vendor Balance Due', val:totalPayable, color:'#dc2626', bg:'#fef2f2', icon:'💸'},
        ].map(k=>(
          <div key={k.label} style={{background:'#fff',borderRadius:14,padding:'14px 18px',border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(15,23,42,0.05)'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em'}}>{k.label}</div>
              <div style={{fontSize:20}}>{k.icon}</div>
            </div>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:22,color:k.color}}>{k.isCnt?k.val:money(k.val)}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:'1 1 200px',minWidth:180}}>
          <Search size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}/>
          <input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or phone…" style={{paddingLeft:36}}/>
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          {[['all','All'],['customer','Customers'],['vendor','Vendors']].map(([val,label])=>(
            <button key={val} onClick={()=>setFilterType(val)} style={{padding:'9px 18px',borderRadius:10,border:`1.5px solid ${filterType===val?'#2563eb':'#e2e8f0'}`,background:filterType===val?'#2563eb':'#fff',color:filterType===val?'#fff':'#64748b',cursor:'pointer',fontSize:13,fontWeight:filterType===val?700:500,transition:'all 0.15s',whiteSpace:'nowrap'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? <div style={{textAlign:'center',padding:60}}><div className="spinner"/></div>
      : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 20px',background:'#fff',borderRadius:20,border:'1.5px dashed #e2e8f0'}}>
          <div style={{fontSize:56,marginBottom:14,opacity:0.25}}>👥</div>
          <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:18,color:'#475569',marginBottom:8}}>{search?`No results for "${search}"`:'No parties yet'}</div>
          <button className="btn-primary" onClick={()=>setShowForm(true)} style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:4}}><Plus size={14}/>Add Party</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {filtered.map(party=>{
            const isC = party.type==='customer';
            const bal = party.balance||party.openingBalance||0;
            return (
              <div key={party.id} style={{background:'#fff',borderRadius:16,border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(15,23,42,0.05)',overflow:'hidden',transition:'box-shadow 0.2s'}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(37,99,235,0.12)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(15,23,42,0.05)'}>
                <div style={{height:4,background:isC?'#2563eb':'#d97706'}}/>
                <div style={{padding:'14px 16px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                      <div style={{width:40,height:40,borderRadius:12,background:isC?'#eff6ff':'#fffbeb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                        {isC?'👤':'🏢'}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:15,color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{party.name}</div>
                        <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:isC?'#eff6ff':'#fffbeb',color:isC?'#2563eb':'#d97706',border:`1px solid ${isC?'#bfdbfe':'#fde68a'}`}}>
                          {isC?'Customer':'Vendor'}
                        </span>
                      </div>
                    </div>
                    {bal>0&&<div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:15,color:isC?'#059669':'#dc2626'}}>{money(bal)}</div>
                      <div style={{fontSize:10,color:'#94a3b8',fontWeight:600}}>{isC?'RECEIVABLE':'BALANCE DUE'}</div>
                    </div>}
                  </div>
                  {party.phone&&<div style={{fontSize:12,color:'#64748b',marginBottom:3,display:'flex',alignItems:'center',gap:5}}><Phone size={11} color="#94a3b8"/> {party.phone}</div>}
                  {party.address&&<div style={{fontSize:12,color:'#94a3b8',display:'flex',alignItems:'center',gap:5}}><MapPin size={11} color="#cbd5e1"/> {party.address}</div>}
                </div>
                <div style={{padding:'10px 16px',borderTop:'1px solid #f1f5f9',display:'flex',gap:6}}>
                  <button onClick={()=>setViewParty(party)} style={{flex:1,padding:'7px',borderRadius:9,border:'1.5px solid #e0e7ff',background:'#f8faff',color:'#2563eb',cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                    <FileText size={12}/> Ledger
                  </button>
                  <button onClick={()=>openEdit(party)} style={{width:32,height:32,borderRadius:9,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',marginLeft:6}}>
                    <Edit2 size={13} color="#475569"/>
                  </button>
                  <button onClick={()=>handleDelete(party)} style={{width:32,height:32,borderRadius:9,border:'1.5px solid #fecaca',background:'#fef2f2',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',marginLeft:6}}>
                    <Trash2 size={13} color="#dc2626"/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm&&(
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:520,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'#fff',zIndex:10}}>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:19,color:'#0f172a'}}>{editId?'✏️ Edit Party':'👥 Add Party'}</div>
              <button onClick={()=>setShowForm(false)} style={{width:32,height:32,borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:18}}>✕</button>
            </div>
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
              {/* Type toggle */}
              <div>
                <label className="form-label">Party Type</label>
                <div style={{display:'flex',gap:8}}>
                  {[['customer','👤 Customer','#2563eb'],['vendor','🏢 Vendor','#d97706']].map(([val,label,color])=>(
                    <button key={val} onClick={()=>setForm(f=>({...f,type:val}))} style={{flex:1,padding:'10px',borderRadius:12,border:`2px solid ${form.type===val?color:'#e2e8f0'}`,background:form.type===val?color+'14':'#f8fafc',color:form.type===val?color:'#64748b',cursor:'pointer',fontSize:14,fontWeight:700,transition:'all 0.15s'}}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder={form.type==='customer'?'Customer name':'Vendor / company name'} autoFocus/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91 XXXXX XXXXX"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="optional@email.com"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-input" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} rows={2} style={{resize:'vertical'}} placeholder="Full address"/>
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN (optional)</label>
                <input className="form-input" value={form.gstin} onChange={e=>setForm(f=>({...f,gstin:e.target.value}))} placeholder="22AAAAA0000A1Z5" style={{fontFamily:'monospace'}}/>
              </div>
              <div style={{background:'#f8faff',borderRadius:12,padding:'14px',border:'1.5px solid #e0e7ff',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label">Opening Balance (₹)</label>
                  <input className="form-input" type="number" min="0" value={form.openingBalance} onChange={e=>setForm(f=>({...f,openingBalance:e.target.value}))} placeholder="0"/>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label">Balance Type</label>
                  <select className="form-select" value={form.balanceType} onChange={e=>setForm(f=>({...f,balanceType:e.target.value}))}>
                    <option value="receivable">To Receive</option>
                    <option value="payable">To Pay</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes…"/>
              </div>
            </div>
            <div style={{padding:'0 24px 22px',display:'flex',gap:10}}>
              <button onClick={()=>setShowForm(false)} className="btn-secondary" style={{flex:1,padding:'12px',fontWeight:600}}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{flex:2,padding:'12px',fontWeight:700,justifyContent:'center'}}>
                {saving?<><div className="spinner" style={{width:15,height:15,borderTopColor:'#fff'}}/>Saving…</>:`✅ ${editId?'Update':'Add'} Party`}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewParty&&<PartyLedger party={viewParty} shopId={selectedShop.id} onClose={()=>setViewParty(null)}/>}
    </div>
  );
}
