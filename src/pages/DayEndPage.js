import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`;

export default function DayEndPage() {
  const { selectedShop } = useAuth();
  const [date, setDate]           = useState(format(new Date(),'yyyy-MM-dd'));
  const [todaySales, setTodaySales] = useState(null);
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [form, setForm] = useState({ cash_opening:'', cash_closing:'', paytm1_actual:'', paytm2_actual:'', notes:'' });

  useEffect(() => { if (selectedShop) { loadSales(); loadRecords(); } }, [selectedShop, date]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const q = query(collection(db,'shops',selectedShop.id,'sales'), where('date','==',date));
      const snap = await getDocs(q);
      let cash=0, bank=0, total=0;
      snap.forEach(d => { const s=d.data(); cash+=s.payment_cash||0; bank+=s.payment_bank||0; total+=s.total_amount||0; });
      setTodaySales({ cash, bank, total, count:snap.size });
      setForm(f=>({...f, paytm1_actual: bank.toString()}));

      // Check if day end already submitted
      const deQ = query(collection(db,'shops',selectedShop.id,'day_end'), where('date','==',date));
      const deSnap = await getDocs(deQ);
      setAlreadyDone(!deSnap.empty);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const loadRecords = async () => {
    const q = query(collection(db,'shops',selectedShop.id,'day_end'), orderBy('createdAt','desc'), limit(10));
    const snap = await getDocs(q);
    setRecords(snap.docs.map(d=>({id:d.id,...d.data()})));
  };

  const cashSales   = todaySales?.cash || 0;
  const co = parseFloat(form.cash_opening)||0;
  const cc = parseFloat(form.cash_closing)||0;
  const expectedCash = co + cashSales;
  const cashVar = cc - expectedCash;

  const p1act = parseFloat(form.paytm1_actual)||0;
  const p1exp = todaySales?.bank || 0;
  const p1var = p1act - p1exp;

  const p2act = parseFloat(form.paytm2_actual)||0;
  const p2var = p2act;

  const handleSubmit = async () => {
    if (!form.cash_closing) return toast.error('Enter closing cash');
    if (Math.abs(cashVar)>500 && !form.notes) return toast.error('Cash variance >₹500 — add a note');
    if (alreadyDone) return toast.error('Day end already submitted for this date');
    setSaving(true);
    try {
      await addDoc(collection(db,'shops',selectedShop.id,'day_end'), {
        date, cash_opening:co, cash_closing:cc, cash_expected:expectedCash,
        cash_variance:cashVar, paytm1_expected:p1exp, paytm1_actual:p1act, paytm1_variance:p1var,
        paytm2_actual:p2act, paytm2_variance:p2var, notes:form.notes,
        sales_total:todaySales?.total||0, sales_count:todaySales?.count||0,
        locked:true, createdAt:new Date(),
      });
      toast.success('Day end submitted & locked ✅');
      setAlreadyDone(true); loadRecords();
    } catch(e) { toast.error('Failed'); } finally { setSaving(false); }
  };

  const VarBadge = ({val}) => (
    <span style={{padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700,
      background:Math.abs(val)<1?'#ecfdf5':Math.abs(val)<=500?'#fffbeb':'#fef2f2',
      color:Math.abs(val)<1?'#059669':Math.abs(val)<=500?'#d97706':'#dc2626',
      border:`1px solid ${Math.abs(val)<1?'#a7f3d0':Math.abs(val)<=500?'#fde68a':'#fecaca'}`}}>
      {Math.abs(val)<1?'✅ Balanced':val>0?`+${fmt(val)} Extra`:`${fmt(val)} Short`}
    </span>
  );

  if (!selectedShop) return <div className="page-container" style={{textAlign:'center',padding:'80px 20px',color:'#94a3b8'}}><p>Select a shop first</p></div>;

  return (
    <div className="page-container fade-in">
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>Day End Reconciliation</h1>
        <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>Lock the day's cash and digital payments</p>
      </div>

      {/* Date picker */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:180}}/>
        {alreadyDone && <span style={{padding:'6px 14px',borderRadius:20,background:'#ecfdf5',color:'#059669',border:'1px solid #a7f3d0',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}><CheckCircle size={14}/>Day End Submitted</span>}
      </div>

      {/* Today summary */}
      {todaySales && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
          {[
            {label:'Total Billing',value:todaySales.total,icon:'💰',color:'#2563eb',bg:'#eff6ff'},
            {label:'Cash Sales',   value:todaySales.cash, icon:'💵',color:'#059669',bg:'#ecfdf5'},
            {label:'Digital / UPI',value:todaySales.bank, icon:'📱',color:'#7c3aed',bg:'#f5f3ff'},
          ].map(k=>(
            <div key={k.label} style={{background:'#fff',borderRadius:16,padding:'16px 20px',border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(15,23,42,0.05)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <div style={{fontSize:11.5,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em'}}>{k.label}</div>
                <div style={{fontSize:20}}>{k.icon}</div>
              </div>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:24,color:k.color}}>{fmt(k.value)}</div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>{todaySales.count} bill{todaySales.count!==1?'s':''} today</div>
            </div>
          ))}
        </div>
      )}

      {!alreadyDone ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
          {/* Cash reconciliation */}
          <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',padding:'24px',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:17,color:'#0f172a',marginBottom:18,display:'flex',alignItems:'center',gap:8}}>💵 Cash Drawer</div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="form-group">
                <label className="form-label">Opening Cash (₹)</label>
                <input className="form-input" type="number" min="0" value={form.cash_opening} onChange={e=>setForm(f=>({...f,cash_opening:e.target.value}))} placeholder="Cash at start of day"/>
              </div>
              <div style={{padding:'12px 16px',background:'#f8faff',borderRadius:10,border:'1px solid #e0e7ff',fontSize:13}}>
                <div style={{display:'flex',justifyContent:'space-between',color:'#64748b',marginBottom:4}}><span>Opening</span><span style={{fontWeight:600}}>{fmt(co)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',color:'#059669',marginBottom:4}}><span>+ Cash Sales</span><span style={{fontWeight:600}}>+{fmt(cashSales)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',color:'#0f172a',fontWeight:800,borderTop:'1px solid #e2e8f0',paddingTop:8}}><span>Expected Cash</span><span>{fmt(expectedCash)}</span></div>
              </div>
              <div className="form-group">
                <label className="form-label">Closing Cash — Physically Counted (₹) *</label>
                <input className="form-input" type="number" min="0" value={form.cash_closing} onChange={e=>setForm(f=>({...f,cash_closing:e.target.value}))} placeholder="Count and enter" style={{fontWeight:700,fontSize:16}}/>
              </div>
              {form.cash_closing && <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:13,color:'#64748b'}}>Variance</span><VarBadge val={cashVar}/></div>}
            </div>
          </div>

          {/* Digital reconciliation */}
          <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',padding:'24px',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:17,color:'#0f172a',marginBottom:18}}>📱 Digital Payments</div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <div style={{fontSize:12,color:'#64748b',fontWeight:600,marginBottom:6}}>GPay / UPI QR (Primary)</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>Expected (from sales)</div>
                    <div style={{padding:'10px 14px',background:'#f8faff',borderRadius:10,fontWeight:700,color:'#7c3aed',fontSize:15,border:'1px solid #e0e7ff'}}>{fmt(p1exp)}</div>
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>Actual in App</div>
                    <input className="form-input" type="number" min="0" value={form.paytm1_actual} onChange={e=>setForm(f=>({...f,paytm1_actual:e.target.value}))} style={{fontWeight:700}}/>
                  </div>
                </div>
                {form.paytm1_actual && <div style={{marginTop:6,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:13,color:'#64748b'}}>Variance</span><VarBadge val={p1var}/></div>}
              </div>
              <div>
                <div style={{fontSize:12,color:'#64748b',fontWeight:600,marginBottom:6}}>Secondary UPI (Optional)</div>
                <div className="form-group" style={{margin:0}}>
                  <input className="form-input" type="number" min="0" value={form.paytm2_actual} onChange={e=>setForm(f=>({...f,paytm2_actual:e.target.value}))} placeholder="0"/>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!alreadyDone && (
        <>
          {(Math.abs(cashVar)>500 || Math.abs(p1var)>500) && (
            <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',gap:10,alignItems:'flex-start'}}>
              <AlertTriangle size={18} color="#d97706" style={{flexShrink:0,marginTop:1}}/>
              <div style={{fontSize:13,color:'#92400e'}}>Large variance detected. Please add a note explaining the difference.</div>
            </div>
          )}
          <div className="form-group" style={{marginBottom:20,maxWidth:600}}>
            <label className="form-label">Notes {Math.abs(cashVar)>500?'*':''}</label>
            <textarea className="form-input" rows={3} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any remarks about today's operations, variances, issues…" style={{resize:'vertical'}}/>
          </div>
          <button onClick={handleSubmit} disabled={saving||!form.cash_closing} className="btn-primary" style={{padding:'14px 32px',fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}>
            {saving?<><div className="spinner" style={{width:16,height:16,borderTopColor:'#fff'}}/>Saving…</>:<><CheckCircle size={16}/>🔒 Lock Day End</>}
          </button>
        </>
      )}

      {/* History */}
      {records.length>0 && (
        <div style={{marginTop:32}}>
          <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:17,color:'#0f172a',marginBottom:16}}>📋 Recent Day Ends</div>
          <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f8faff'}}>
                  {['Date','Sales Total','Cash Variance','UPI Variance','Notes','Status'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:11.5,fontWeight:700,color:'#64748b',textTransform:'uppercase',borderBottom:'1.5px solid #e2e8f0'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r=>(
                  <tr key={r.id} style={{borderBottom:'1px solid #f1f5f9'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8faff'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <td style={{padding:'11px 14px',fontWeight:700,color:'#0f172a'}}>{r.date}</td>
                    <td style={{padding:'11px 14px',fontWeight:700,color:'#2563eb'}}>{fmt(r.sales_total)}</td>
                    <td style={{padding:'11px 14px'}}><VarBadge val={r.cash_variance||0}/></td>
                    <td style={{padding:'11px 14px'}}><VarBadge val={r.paytm1_variance||0}/></td>
                    <td style={{padding:'11px 14px',fontSize:12,color:'#64748b',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.notes||'—'}</td>
                    <td style={{padding:'11px 14px'}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700,background:'#ecfdf5',color:'#059669',border:'1px solid #a7f3d0'}}>🔒 Locked</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
