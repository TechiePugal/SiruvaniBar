import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { Plus, Trash2, Edit2, Filter } from 'lucide-react';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import toast from 'react-hot-toast';

const CATS = {
  Utilities:   ['Electricity','Water','Internet','Phone/Mobile','Cable TV'],
  Staff:       ['Salaries','Advance','Bonus','Casual Labour','PF/ESI'],
  Kitchen:     ['Gas','Groceries','Fruits','Vegetables','Other Kitchen'],
  Maintenance: ['Repair','Cleaning','Pest Control','AC Service','Equipment'],
  Transport:   ['Auto/Cab','Delivery','Fuel','Vehicle Maintenance'],
  Rent:        ['Shop Rent','Storage Rent'],
  Admin:       ['Printing','Stationery','License Fees','Bank Charges','Legal'],
  Other:       ['Miscellaneous'],
};
const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`;

export default function ExpensePage() {
  const { selectedShop } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const payMethods = usePaymentMethods(selectedShop?.id);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState({
    date: format(new Date(),'yyyy-MM-dd'), category:'Utilities',
    subCategory:'Electricity', amount:'', paymentMode:'cash', paidTo:'', notes:'',
  });

  useEffect(() => {
    if (!selectedShop) return;
    const q = query(collection(db,'shops',selectedShop.id,'expenses'), orderBy('createdAt','desc'), limit(100));
    const u = onSnapshot(q, snap => { setExpenses(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }, ()=>setLoading(false));
    return u;
  }, [selectedShop]);

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(form.amount)<=0) return toast.error('Enter valid amount');
    setSaving(true);
    try {
      const data = { ...form, amount:parseFloat(form.amount) };
      if (editId) {
        await updateDoc(doc(db,'shops',selectedShop.id,'expenses',editId), { ...data, updatedAt:new Date() });
        toast.success('Expense updated ✅');
      } else {
        await addDoc(collection(db,'shops',selectedShop.id,'expenses'), { ...data, createdAt:new Date() });
        toast.success('Expense recorded ✅');
      }
      setShowForm(false); setEditId(null);
      setForm(f=>({ ...f, amount:'', paidTo:'', notes:'' }));
    } catch(e) { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const handleEdit = async (expense) => {
    setEditId(expense.id);
    setForm({ date:expense.date, category:expense.category, subCategory:expense.subCategory||'', amount:expense.amount, paymentMode:expense.paymentMode||'cash', paidTo:expense.paidTo||'', notes:expense.notes||'' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await deleteDoc(doc(db,'shops',selectedShop.id,'expenses',id));
    toast.success('Deleted');
  };

  const filtered = filterCat ? expenses.filter(e=>e.category===filterCat) : expenses;
  const total = filtered.reduce((s,e)=>s+(e.amount||0),0);
  const cats  = Object.keys(CATS);

  if (!selectedShop) return <div className="page-container" style={{textAlign:'center',padding:'80px 20px',color:'#94a3b8'}}><p>Select a shop first</p></div>;

  return (
    <div className="page-container fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>Expenses</h1>
          <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>Track all operating expenses</p>
        </div>
        <button className="btn-primary" onClick={()=>setShowForm(true)} style={{display:'flex',alignItems:'center',gap:8}}>
          <Plus size={16}/> Add Expense
        </button>
      </div>

      {/* Summary + filters */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{background:'linear-gradient(135deg,#dc2626,#ef4444)',borderRadius:14,padding:'14px 22px',color:'#fff',minWidth:180}}>
          <div style={{fontSize:11.5,fontWeight:700,textTransform:'uppercase',opacity:0.8,marginBottom:4}}>Total Showing</div>
          <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:24}}>{fmt(total)}</div>
          <div style={{fontSize:11,opacity:0.7,marginTop:2}}>{filtered.length} entries</div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button onClick={()=>setFilterCat('')} style={{padding:'7px 14px',borderRadius:20,border:`1.5px solid ${!filterCat?'#2563eb':'#e2e8f0'}`,background:!filterCat?'#eff6ff':'#fff',color:!filterCat?'#2563eb':'#64748b',cursor:'pointer',fontSize:12.5,fontWeight:!filterCat?700:500}}>All</button>
          {cats.map(c=><button key={c} onClick={()=>setFilterCat(c===filterCat?'':c)} style={{padding:'7px 14px',borderRadius:20,border:`1.5px solid ${filterCat===c?'#dc2626':'#e2e8f0'}`,background:filterCat===c?'#fef2f2':'#fff',color:filterCat===c?'#dc2626':'#64748b',cursor:'pointer',fontSize:12.5,fontWeight:filterCat===c?700:500}}>{c}</button>)}
        </div>
      </div>

      {/* Table */}
      {loading ? <div style={{textAlign:'center',padding:60}}><div className="spinner"/></div>
      : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 20px',background:'#fff',borderRadius:20,border:'1.5px dashed #e2e8f0'}}>
          <div style={{fontSize:48,marginBottom:12,opacity:0.3}}>💸</div>
          <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:18,color:'#475569',marginBottom:8}}>No expenses yet</div>
          <button className="btn-primary" onClick={()=>setShowForm(true)} style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:4}}><Plus size={15}/>Add First Expense</button>
        </div>
      ) : (
        <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
          <div className="table-wrap">
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:560}}>
            <thead>
              <tr style={{background:'#f8faff'}}>
                {['Date','Category','Sub-Category','Amount','Payment','Paid To','Notes',''].map(h=>(
                  <th key={h} style={{padding:'12px 14px',textAlign:'left',fontSize:11.5,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1.5px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e,i)=>(
                <tr key={e.id} style={{borderBottom:'1px solid #f1f5f9'}}
                  onMouseEnter={el=>el.currentTarget.style.background='#f8faff'}
                  onMouseLeave={el=>el.currentTarget.style.background='#fff'}>
                  <td style={{padding:'11px 14px',fontSize:13,color:'#475569',whiteSpace:'nowrap'}}>{e.date}</td>
                  <td style={{padding:'11px 14px'}}><span style={{padding:'3px 8px',borderRadius:20,fontSize:12,fontWeight:600,background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca'}}>{e.category}</span></td>
                  <td style={{padding:'11px 14px',fontSize:13,color:'#475569'}}>{e.subCategory||'—'}</td>
                  <td style={{padding:'11px 14px',fontWeight:800,color:'#dc2626',fontSize:15}}>{fmt(e.amount)}</td>
                  <td style={{padding:'11px 14px'}}><span style={{padding:'3px 8px',borderRadius:20,fontSize:12,fontWeight:600,background:'#f8fafc',color:'#475569',border:'1px solid #e2e8f0',textTransform:'capitalize'}}>{e.paymentMode}</span></td>
                  <td style={{padding:'11px 14px',fontSize:13,color:'#475569'}}>{e.paidTo||'—'}</td>
                  <td style={{padding:'11px 14px',fontSize:12,color:'#94a3b8',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.notes||'—'}</td>
                  <td style={{padding:'11px 14px'}}>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>handleEdit(e)} style={{width:30,height:30,borderRadius:8,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <Edit2 size={13} color="#475569"/>
                      </button>
                      <button onClick={()=>handleDelete(e.id)} style={{width:30,height:30,borderRadius:8,border:'1.5px solid #fecaca',background:'#fef2f2',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <Trash2 size={13} color="#dc2626"/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:500,boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0'}}>
            <div style={{padding:'22px 26px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:20,color:'#0f172a'}}>{editId?'✏️ Edit Expense':'💸 Add Expense'}</div>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{width:32,height:32,borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:18}}>✕</button>
            </div>
            <div style={{padding:'22px 26px',display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" style={{fontWeight:700,fontSize:16}}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-select" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value,subCategory:CATS[e.target.value]?.[0]||''}))}>
                    {cats.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Sub-Category</label>
                  <select className="form-select" value={form.subCategory} onChange={e=>setForm(f=>({...f,subCategory:e.target.value}))}>
                    {(CATS[form.category]||[]).map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-select" value={form.paymentMode} onChange={e=>setForm(f=>({...f,paymentMode:e.target.value}))}>
                    {payMethods.map(m=><option key={m.id||m.name} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Paid To</label>
                  <input className="form-input" value={form.paidTo} onChange={e=>setForm(f=>({...f,paidTo:e.target.value}))} placeholder="Vendor / person name"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional remarks…"/>
              </div>
            </div>
            <div style={{padding:'0 26px 24px',display:'flex',gap:10}}>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} className="btn-secondary" style={{flex:1,padding:'12px',fontWeight:600}}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary" style={{flex:2,padding:'12px',fontWeight:700,justifyContent:'center'}}>
                {saving?<><div className="spinner" style={{width:15,height:15,borderTopColor:'#fff'}}/>Saving…</>:editId?'✅ Update Expense':'✅ Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
