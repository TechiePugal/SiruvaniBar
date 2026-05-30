import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
  doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import PaymentSelector from '../components/PaymentSelector';
import { format } from 'date-fns';
import {
  Plus, Search, X, Edit2, Trash2, CreditCard,
  ChevronDown, ChevronUp, Package, TrendingDown,
  CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const money = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const moneyShort = n => `₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const CAT_EMOJI = {liquor:'🍶',beer:'🍺',wine:'🍷',food:'🍛',cigarette:'🚬',cooldrink:'🥤',water:'💧',other:'📦'};

const STATUS = {
  paid:    {label:'Paid',     icon:'✓', color:'#059669', bg:'#ecfdf5', border:'#a7f3d0'},
  partial: {label:'Partial',  icon:'⏳',color:'#d97706', bg:'#fffbeb', border:'#fde68a'},
  unpaid:  {label:'Unpaid',   icon:'!', color:'#dc2626', bg:'#fef2f2', border:'#fecaca'},
};

const blankItem = () => ({itemId:'',itemName:'',category:'other',unit:'unit',qty:'',rate:'',amount:0});

/* ═══════════════════════════════════════════════════════════════════════
   Item Search Dropdown
══════════════════════════════════════════════════════════════════════ */
function ItemSearch({ value, invItems, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState(value||'');
  useEffect(()=>setQ(value||''),[value]);

  const hits = q.trim()
    ? invItems.filter(i=>i.name.toLowerCase().includes(q.toLowerCase())||(i.barcode||'').includes(q)).slice(0,8)
    : invItems.slice(0,8);

  return (
    <div style={{position:'relative',flex:1}}>
      <div style={{position:'relative'}}>
        <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',pointerEvents:'none'}}/>
        <input
          value={q}
          onChange={e=>{setQ(e.target.value);setOpen(true);}}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),180)}
          placeholder="Search inventory item…"
          style={{width:'100%',padding:'9px 10px 9px 30px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:13.5,outline:'none',color:'#0f172a',fontFamily:'Inter,sans-serif',background:'#fff'}}
        />
      </div>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:9999,background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,boxShadow:'0 12px 40px rgba(15,23,42,0.15)',overflow:'hidden',maxHeight:280,overflowY:'auto'}}>
          {hits.length===0
            ? <div style={{padding:'14px 16px',color:'#94a3b8',fontSize:13,textAlign:'center'}}>No items found</div>
            : hits.map(item=>(
              <div key={item.id}
                onMouseDown={()=>{onSelect(item);setOpen(false);}}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #f8fafc'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f0f9ff'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{width:34,height:34,borderRadius:9,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>
                  {CAT_EMOJI[item.category]||'📦'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13.5,color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.name}</div>
                  <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>Stock: {item.currentStock||0} {item.unit}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontWeight:800,color:'#d97706',fontSize:14}}>{money(item.purchasePrice||0)}</div>
                  <div style={{fontSize:10,color:'#94a3b8'}}>per {item.unit}</div>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Vendor Dropdown
══════════════════════════════════════════════════════════════════════ */
function VendorSearch({ value, vendors, onChange }) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState(value||'');
  useEffect(()=>setQ(value||''),[value]);

  const hits = vendors.filter(v=>v.name.toLowerCase().includes(q.toLowerCase())).slice(0,8);

  return (
    <div style={{position:'relative'}}>
      <div style={{position:'relative'}}>
        <Search size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',pointerEvents:'none'}}/>
        <input
          value={q}
          onChange={e=>{setQ(e.target.value);setOpen(true);onChange({name:e.target.value,id:'',balance:0});}}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),180)}
          placeholder="Type or select vendor…"
          style={{width:'100%',padding:'10px 12px 10px 36px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:14,outline:'none',color:'#0f172a',fontFamily:'Inter,sans-serif',fontWeight:600}}
        />
      </div>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:9999,background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,boxShadow:'0 12px 40px rgba(15,23,42,0.15)',overflow:'hidden',maxHeight:260,overflowY:'auto'}}>
          {vendors.length===0
            ? <div style={{padding:'14px',color:'#94a3b8',fontSize:13,textAlign:'center'}}>No vendors — add vendors in Parties first</div>
            : hits.length===0
            ? <div style={{padding:'14px',color:'#94a3b8',fontSize:13}}>No match for "{q}"</div>
            : hits.map(v=>{
                const bal = v.balance||v.openingBalance||0;
                return (
                  <div key={v.id}
                    onMouseDown={()=>{onChange(v);setQ(v.name);setOpen(false);}}
                    style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',cursor:'pointer',borderBottom:'1px solid #f8fafc'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#fffbeb'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>{v.name}</div>
                      {v.phone&&<div style={{fontSize:11,color:'#94a3b8'}}>📞 {v.phone}</div>}
                    </div>
                    {bal>0&&(
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:10,color:'#94a3b8',fontWeight:600}}>BALANCE DUE</div>
                        <div style={{fontWeight:800,color:'#dc2626',fontSize:14}}>{moneyShort(bal)}</div>
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Payment Modal
══════════════════════════════════════════════════════════════════════ */
function PaymentModal({ purchase, shopId, payMethods, onClose }) {
  const [amount, setAmount] = useState('');
  const [mode,   setMode]   = useState(payMethods[0]?.name||'Cash');
  const [date,   setDate]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  const remaining = (purchase.totalAmount||0)-(purchase.paidAmount||0);

  const handlePay = async () => {
    const amt = parseFloat(amount)||0;
    if(amt<=0) return toast.error('Enter a valid amount');
    if(amt>remaining+0.01) return toast.error(`Max payable: ${money(remaining)}`);
    setSaving(true);
    try {
      const newPaid   = (purchase.paidAmount||0)+amt;
      const newRemain = Math.max(0,(purchase.totalAmount||0)-newPaid);
      const newStatus = newRemain<=0.01?'paid':'partial';

      await updateDoc(doc(db,'shops',shopId,'purchases',purchase.id),{
        paidAmount:     newPaid,
        remainingAmount:newRemain,
        status:         newStatus,
        payments:[...(purchase.payments||[]),{amount:amt,mode,date,note,recordedAt:new Date().toISOString()}],
        updatedAt:new Date(),
      });

      // Update vendor balance
      if(purchase.vendorId){
        try {
          const { getDoc } = await import('firebase/firestore');
          const vSnap = await getDoc(doc(db,'shops',shopId,'parties',purchase.vendorId));
          if(vSnap.exists()){
            const curBal = vSnap.data().balance||vSnap.data().openingBalance||0;
            await updateDoc(doc(db,'shops',shopId,'parties',purchase.vendorId),{
              balance:Math.max(0,curBal-amt), updatedAt:new Date()
            });
          }
        } catch(e){console.warn('Vendor balance update failed:',e);}
      }

      toast.success(`Payment of ${money(amt)} recorded ✅`);
      onClose();
    } catch(e){toast.error('Failed: '+e.message);}
    finally{setSaving(false);}
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0',overflow:'hidden'}}>
        {/* Gradient header */}
        <div style={{background:'linear-gradient(135deg,#d97706,#f59e0b)',padding:'20px 24px'}}>
          <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:18,color:'#fff'}}>💳 Record Payment</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.85)',marginTop:3}}>
            {purchase.vendorName} {purchase.invoiceNo?`· ${purchase.invoiceNo}`:''}
          </div>
        </div>

        <div style={{padding:'22px 24px'}}>
          {/* Balance strip */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:22}}>
            {[
              {label:'Total Bill',  val:purchase.totalAmount||0,  color:'#0f172a'},
              {label:'Paid',        val:purchase.paidAmount||0,   color:'#059669'},
              {label:'Remaining',   val:remaining,                 color:remaining>0?'#dc2626':'#059669'},
            ].map(k=>(
              <div key={k.label} style={{textAlign:'center',padding:'10px 8px',background:'#f8fafc',borderRadius:12,border:'1.5px solid #e2e8f0'}}>
                <div style={{fontSize:10,color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4}}>{k.label}</div>
                <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:15,color:k.color}}>{moneyShort(k.val)}</div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {/* Amount */}
            <div className="form-group">
              <label className="form-label">Amount to Pay (₹) *</label>
              <div style={{display:'flex',gap:8}}>
                <input
                  className="form-input"
                  type="number" min="0.01" step="0.01"
                  value={amount}
                  onChange={e=>setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{flex:1,fontWeight:800,fontSize:18}}
                  autoFocus
                />
                <button
                  onClick={()=>setAmount(remaining.toFixed(2))}
                  style={{padding:'0 14px',borderRadius:10,border:'1.5px solid #d97706',background:'#fffbeb',color:'#d97706',cursor:'pointer',fontSize:12,fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
                  Full {moneyShort(remaining)}
                </button>
              </div>
            </div>

            {/* Mode */}
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {payMethods.map(m=>(
                  <button
                    key={m.id||m.name}
                    onClick={()=>setMode(m.name)}
                    style={{padding:'8px 14px',borderRadius:10,border:`1.5px solid ${mode===m.name?'#d97706':'#e2e8f0'}`,background:mode===m.name?'#fffbeb':'#f8fafc',color:mode===m.name?'#d97706':'#64748b',cursor:'pointer',fontSize:13,fontWeight:mode===m.name?700:500,transition:'all 0.13s'}}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Reference / Note</label>
                <input className="form-input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Cheque no, ref…"/>
              </div>
            </div>
          </div>
        </div>

        <div style={{padding:'4px 24px 22px',display:'flex',gap:10}}>
          <button onClick={onClose} className="btn-secondary" style={{flex:1,padding:'12px',fontWeight:600}}>Cancel</button>
          <button onClick={handlePay} disabled={saving} style={{flex:2,padding:'12px',fontWeight:700,fontSize:15,background:'#d97706',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 14px rgba(217,119,6,0.35)',transition:'all 0.15s'}}>
            {saving?<><div className="spinner" style={{width:15,height:15,borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.3)'}}/>Saving…</>:<><CheckCircle size={16}/>Record Payment</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Purchase Form (Add / Edit)
══════════════════════════════════════════════════════════════════════ */
function PurchaseForm({ initial, vendors, invItems, payMethods, shopId, user, onClose, onSaved }) {
  const isEdit = !!initial?.id;

  const empty = {
    date:        format(new Date(),'yyyy-MM-dd'),
    vendorName:  '', vendorId: '',
    invoiceNo:   '', invoiceDate: format(new Date(),'yyyy-MM-dd'),
    items:       [blankItem()],
    paidAmount:  '', paymentMode: payMethods[0]?.name||'Cash',
    notes:       '',
  };

  const [form,   setForm]   = useState(initial && isEdit ? {
    date:        initial.date||format(new Date(),'yyyy-MM-dd'),
    vendorName:  initial.vendorName||'',
    vendorId:    initial.vendorId||'',
    invoiceNo:   initial.invoiceNo||'',
    invoiceDate: initial.invoiceDate||format(new Date(),'yyyy-MM-dd'),
    items:       initial.items?.length ? initial.items : [blankItem()],
    paidAmount:  initial.paidAmount||'',
    paymentMode: initial.paymentMode||payMethods[0]?.name||'Cash',
    notes:       initial.notes||'',
  } : empty);

  const [saving, setSaving] = useState(false);

  const totalAmt  = form.items.reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
  const paidAmt   = parseFloat(form.paidAmount)||0;
  const remaining = Math.max(0,totalAmt-paidAmt);

  const setVendor  = v => setForm(f=>({...f,vendorName:v.name||v,vendorId:v.id||''}));
  const addRow     = () => setForm(f=>({...f,items:[...f.items,blankItem()]}));
  const removeRow  = idx => setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
  const updateRow  = (idx,field,val) => setForm(f=>{
    const items=[...f.items];
    items[idx]={...items[idx],[field]:val};
    if(field==='qty'||field==='rate') items[idx].amount=(parseFloat(items[idx].qty)||0)*(parseFloat(items[idx].rate)||0);
    return{...f,items};
  });
  const pickItem   = (idx,inv) => setForm(f=>{
    const items=[...f.items];
    const q=parseFloat(items[idx].qty)||1;
    items[idx]={...items[idx],itemId:inv.id,itemName:inv.name,category:inv.category,unit:inv.unit||'unit',rate:inv.purchasePrice||0,amount:q*(inv.purchasePrice||0)};
    return{...f,items};
  });

  const handleSave = async () => {
    const valid = form.items.filter(i=>i.itemName&&(parseFloat(i.qty)||0)>0);
    if(!valid.length) return toast.error('Add at least one item with quantity');
    if(!form.vendorName.trim()) return toast.error('Select or enter vendor name');
    setSaving(true);
    try {
      if(isEdit) {
        /* ── EDIT: only update metadata, not stock ── */
        await updateDoc(doc(db,'shops',shopId,'purchases',initial.id),{
          date:form.date, vendorName:form.vendorName, vendorId:form.vendorId,
          invoiceNo:form.invoiceNo, invoiceDate:form.invoiceDate,
          items:valid, totalAmount:totalAmt,
          paymentMode:form.paymentMode, notes:form.notes,
          updatedAt:new Date(),
        });
        toast.success('Purchase updated ✅');
      } else {
        /* ── NEW: create + update stock ── */
        const purchase = {
          date:form.date, vendorName:form.vendorName, vendorId:form.vendorId,
          invoiceNo:form.invoiceNo, invoiceDate:form.invoiceDate,
          items:valid, totalAmount:totalAmt,
          paidAmount:paidAmt, remainingAmount:remaining,
          status: paidAmt<=0?'unpaid':remaining<=0.01?'paid':'partial',
          paymentMode:form.paymentMode, notes:form.notes,
          payments: paidAmt>0?[{amount:paidAmt,mode:form.paymentMode,date:form.date,note:'Initial payment',recordedAt:new Date().toISOString()}]:[],
          createdBy:user.uid, createdAt:new Date(),
        };
        const ref = await addDoc(collection(db,'shops',shopId,'purchases'),purchase);

        // Update inventory stock
        for(const item of valid){
          if(item.itemId){
            const snap = invItems.find(i=>i.id===item.itemId);
            if(snap){
              const newStock=(snap.currentStock||0)+(parseFloat(item.qty)||0);
              await updateDoc(doc(db,'shops',shopId,'inventory_items',item.itemId),{currentStock:newStock,updatedAt:new Date()});
              await addDoc(collection(db,'shops',shopId,'inventory_entries'),{
                itemId:item.itemId,itemName:item.itemName,category:item.category,
                type:'purchase',qty:parseFloat(item.qty)||0,
                stockBefore:snap.currentStock||0,stockAfter:newStock,
                purchasePrice:parseFloat(item.rate)||0,
                totalValue:(parseFloat(item.qty)||0)*(parseFloat(item.rate)||0),
                supplier:form.vendorName,invoiceNo:form.invoiceNo,
                purchaseId:ref.id,date:form.date,createdAt:new Date(),
              });
            }
          }
        }

        // Update vendor balance if amount remains
        if(form.vendorId&&remaining>0.01){
          try{
            const { getDoc } = await import('firebase/firestore');
            const vSnap = await getDoc(doc(db,'shops',shopId,'parties',form.vendorId));
            if(vSnap.exists()){
              const cur = vSnap.data().balance||vSnap.data().openingBalance||0;
              await updateDoc(doc(db,'shops',shopId,'parties',form.vendorId),{balance:cur+remaining,updatedAt:new Date()});
            }
          } catch(e){console.warn('Vendor balance update:',e);}
        }

        toast.success('Purchase saved ✅');
      }
      onSaved();
      onClose();
    } catch(e){toast.error('Failed: '+e.message);console.error(e);}
    finally{setSaving(false);}
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:800,maxHeight:'95vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0',display:'flex',flexDirection:'column'}}>

        {/* Sticky header */}
        <div style={{padding:'18px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#fff',zIndex:20}}>
          <div>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:20,color:'#0f172a'}}>
              {isEdit?'✏️ Edit Purchase':'🛍️ New Purchase'}
            </div>
            <div style={{fontSize:12.5,color:'#64748b',marginTop:2}}>
              {isEdit?'Update details — stock will not be re-adjusted':'Items auto-added to inventory stock on save'}
            </div>
          </div>
          <button onClick={onClose} style={{width:34,height:34,borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:18,flexShrink:0}}>✕</button>
        </div>

        <div style={{padding:'22px 24px',flex:1}}>
          {/* Row 1: Vendor + dates */}
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:14,marginBottom:20}}>
            <div className="form-group">
              <label className="form-label">Vendor Name * <span style={{fontSize:10,color:'#94a3b8',fontWeight:400}}>(from Parties)</span></label>
              <VendorSearch value={form.vendorName} vendors={vendors} onChange={setVendor}/>
              {vendors.length===0&&<div style={{fontSize:11,color:'#d97706',marginTop:4}}>⚠️ Add vendors in Parties page first</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Vendor Invoice No.</label>
              <input className="form-input" value={form.invoiceNo} onChange={e=>setForm(f=>({...f,invoiceNo:e.target.value}))} placeholder="INV-001"/>
            </div>
          </div>

          {/* Items table */}
          <div style={{marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <label className="form-label" style={{margin:0}}>Items — Search from Inventory</label>
              {!isEdit&&<div style={{fontSize:11.5,color:'#059669',fontWeight:600,background:'#ecfdf5',padding:'3px 10px',borderRadius:20,border:'1px solid #a7f3d0'}}>✅ Stock auto-added on save</div>}
              {isEdit&&<div style={{fontSize:11.5,color:'#d97706',fontWeight:600,background:'#fffbeb',padding:'3px 10px',borderRadius:20,border:'1px solid #fde68a'}}>ℹ️ Stock not re-adjusted on edit</div>}
            </div>

            {/* Table */}
            <div style={{borderRadius:14,overflow:'hidden',border:'1.5px solid #fde68a',background:'#fffbeb'}}>
              {/* Header */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 80px 110px 110px 36px',gap:0,padding:'9px 14px',background:'#fef3c7',borderBottom:'1px solid #fde68a'}}>
                {['Item','Qty','Rate (₹)','Amount',''].map((h,i)=>(
                  <div key={i} style={{fontSize:11,fontWeight:700,color:'#92400e',textTransform:'uppercase',letterSpacing:'0.04em',textAlign:i>=2&&i<4?'right':i===1?'center':'left'}}>{h}</div>
                ))}
              </div>

              {form.items.map((item,idx)=>(
                <div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 80px 110px 110px 36px',gap:6,padding:'8px 10px',borderBottom:'1px solid #fef3c7',alignItems:'center',background:idx%2===0?'#fff':'#fffbeb'}}>
                  {/* Item search */}
                  <ItemSearch value={item.itemName} invItems={invItems} onSelect={inv=>pickItem(idx,inv)}/>
                  {/* Qty */}
                  <input
                    type="number" min="0" step="0.01"
                    value={item.qty}
                    onChange={e=>updateRow(idx,'qty',e.target.value)}
                    style={{padding:'8px',border:'1.5px solid #fde68a',borderRadius:9,textAlign:'center',fontWeight:700,fontSize:14,outline:'none',color:'#0f172a',background:'#fff',width:'100%'}}
                    placeholder="0"
                  />
                  {/* Rate */}
                  <input
                    type="number" min="0" step="0.01"
                    value={item.rate}
                    onChange={e=>updateRow(idx,'rate',e.target.value)}
                    style={{padding:'8px',border:'1.5px solid #fde68a',borderRadius:9,textAlign:'right',fontWeight:700,fontSize:14,outline:'none',color:'#0f172a',background:'#fff',width:'100%'}}
                    placeholder="0.00"
                  />
                  {/* Amount */}
                  <div style={{textAlign:'right',fontWeight:800,color:'#d97706',fontSize:15,paddingRight:2}}>
                    {moneyShort(parseFloat(item.amount)||0)}
                  </div>
                  {/* Remove */}
                  <button onClick={()=>removeRow(idx)} disabled={form.items.length<=1} style={{width:28,height:28,borderRadius:8,border:'none',background:form.items.length<=1?'#f1f5f9':'#fef2f2',cursor:form.items.length<=1?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:form.items.length<=1?0.4:1}}>
                    <X size={13} color="#dc2626"/>
                  </button>
                </div>
              ))}

              {/* Add row */}
              <div style={{padding:'10px 14px',borderTop:'1px solid #fde68a'}}>
                <button onClick={addRow} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:9,border:'1.5px dashed #d97706',background:'transparent',color:'#d97706',cursor:'pointer',fontSize:13,fontWeight:600}}>
                  <Plus size={13}/> Add Row
                </button>
              </div>
            </div>
          </div>

          {/* Bill total + payment */}
          <div className="grid-2-collapse" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
            {/* Payment */}
            <div style={{background:'#f8faff',borderRadius:14,padding:'16px 18px',border:'1.5px solid #e0e7ff'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:14}}>💳 Initial Payment {isEdit?'(read-only)':''}</div>
              {isEdit ? (
                <div style={{padding:'12px 14px',background:'#eff6ff',borderRadius:10,border:'1px solid #bfdbfe',fontSize:13,color:'#1d4ed8'}}>
                  Use the <strong>Pay</strong> button on the purchase card to record additional payments.
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div className="form-group" style={{margin:0}}>
                    <label className="form-label">Amount Paid Now (₹)</label>
                    <input className="form-input" type="number" min="0" step="0.01" value={form.paidAmount} onChange={e=>setForm(f=>({...f,paidAmount:e.target.value}))} placeholder="0 — leave blank if not paid yet" style={{fontWeight:700}}/>
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label className="form-label">Payment Mode</label>
                    <select className="form-select" value={form.paymentMode} onChange={e=>setForm(f=>({...f,paymentMode:e.target.value}))}>
                      {payMethods.map(m=><option key={m.id||m.name} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{background:'#fffbeb',borderRadius:14,padding:'16px 18px',border:'1.5px solid #fde68a'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#92400e',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:14}}>📋 Summary</div>
              {[
                {label:'Total Bill',  val:totalAmt,   color:'#d97706',   bold:false},
                {label:'Paid Now',    val:paidAmt,    color:'#059669',   bold:false},
                {label:'Remaining',   val:remaining,  color:remaining>0.01?'#dc2626':'#059669', bold:true},
              ].map(r=>(
                <div key={r.label} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #fef3c7'}}>
                  <span style={{color:'#92400e',fontWeight:r.bold?700:500,fontSize:14}}>{r.label}</span>
                  <span style={{fontWeight:800,color:r.color,fontSize:r.bold?17:14,fontFamily:r.bold?'Plus Jakarta Sans,sans-serif':'inherit'}}>{money(r.val)}</span>
                </div>
              ))}
              <div style={{marginTop:10,padding:'8px 12px',borderRadius:9,background:remaining<=0.01?'#ecfdf5':'#fef2f2',border:`1px solid ${remaining<=0.01?'#a7f3d0':'#fecaca'}`,textAlign:'center',fontWeight:700,fontSize:13,color:remaining<=0.01?'#059669':'#dc2626'}}>
                {isEdit?'Edit mode — use Pay button for payments':remaining<=0.01?'✅ Fully Paid':`⏳ ${money(remaining)} pending`}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional remarks…"/>
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:'14px 24px 22px',borderTop:'1px solid #e2e8f0',background:'#f8fafc',display:'flex',gap:10,position:'sticky',bottom:0}}>
          <button onClick={onClose} className="btn-secondary" style={{flex:1,padding:'13px',fontWeight:600}}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{flex:2,padding:'13px',fontWeight:700,fontSize:15,justifyContent:'center',background:'#d97706',boxShadow:'0 4px 14px rgba(217,119,6,0.3)'}}>
            {saving?<><div className="spinner" style={{width:15,height:15,borderTopColor:'#fff',borderColor:'rgba(255,255,255,0.3)'}}/>Saving…</>:isEdit?'✅ Update Purchase':'✅ Save Purchase'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════ */
export default function PurchasePage() {
  const { selectedShop, user } = useAuth();
  const payMethods = usePaymentMethods(selectedShop?.id);

  const [purchases, setPurchases] = useState([]);
  const [vendors,   setVendors]   = useState([]);
  const [invItems,  setInvItems]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [payModal,  setPayModal]  = useState(null);
  const [expanded,  setExpanded]  = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');

  /* Load all */
  useEffect(()=>{
    if(!selectedShop)return;
    const u1=onSnapshot(query(collection(db,'shops',selectedShop.id,'purchases'),orderBy('createdAt','desc'),limit(200)),
      s=>{setPurchases(s.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},()=>setLoading(false));
    const u2=onSnapshot(query(collection(db,'shops',selectedShop.id,'parties'),orderBy('name')),
      s=>setVendors(s.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.type==='vendor')));
    const u3=onSnapshot(query(collection(db,'shops',selectedShop.id,'inventory_items'),orderBy('name')),
      s=>setInvItems(s.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();};
  },[selectedShop]);

  const handleDelete = async p => {
    if(!window.confirm(`Delete purchase from ${p.vendorName}?\nNote: inventory stock will NOT be reversed.`)) return;
    try{await deleteDoc(doc(db,'shops',selectedShop.id,'purchases',p.id));toast.success('Deleted');}
    catch{toast.error('Failed to delete');}
  };

  /* Derived */
  const filtered = purchases
    .filter(p=>filter==='all'||p.status===filter)
    .filter(p=>!search||(p.vendorName||'').toLowerCase().includes(search.toLowerCase())||(p.invoiceNo||'').toLowerCase().includes(search.toLowerCase()));

  const totalBill  = purchases.reduce((s,p)=>s+(p.totalAmount||0),0);
  const totalPaid  = purchases.reduce((s,p)=>s+(p.paidAmount||0),0);
  const totalDue   = purchases.reduce((s,p)=>s+(p.remainingAmount||0),0);

  if(!selectedShop) return (
    <div className="page-container" style={{textAlign:'center',padding:'80px 20px',color:'#94a3b8'}}>
      <Package size={48} style={{opacity:0.2,marginBottom:12}}/><p>Select a shop first</p>
    </div>
  );

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>Purchases</h1>
          <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>Vendor purchases — stock auto-updated, payment tracking</p>
        </div>
        <button className="btn-primary" onClick={()=>{setEditItem(null);setShowForm(true);}} style={{display:'flex',alignItems:'center',gap:8,background:'#d97706',boxShadow:'0 4px 14px rgba(217,119,6,0.3)'}}>
          <Plus size={16}/> New Purchase
        </button>
      </div>

      {/* KPI cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:24}}>
        {[
          {label:'Total Purchases', val:totalBill,                                       color:'#d97706', bg:'#fffbeb', icon:'🛍️'},
          {label:'Total Paid',      val:totalPaid,                                       color:'#059669', bg:'#ecfdf5', icon:'✅'},
          {label:'Balance Due',     val:totalDue,                                        color:'#dc2626', bg:'#fef2f2', icon:'⚠️'},
          {label:'Vendors',         val:vendors.length,                                  color:'#7c3aed', bg:'#f5f3ff', icon:'🏢', isCnt:true},
          {label:'Unpaid Bills',    val:purchases.filter(p=>p.status==='unpaid').length, color:'#dc2626', bg:'#fef2f2', icon:'📋', isCnt:true},
          {label:'This Month',      val:purchases.filter(p=>(p.date||'').startsWith(format(new Date(),'yyyy-MM'))).reduce((s,p)=>s+(p.totalAmount||0),0), color:'#0891b2', bg:'#ecfeff', icon:'📅'},
        ].map(k=>(
          <div key={k.label} style={{background:'#fff',borderRadius:14,padding:'14px 18px',border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(15,23,42,0.05)',transition:'box-shadow 0.2s'}}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(15,23,42,0.10)'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(15,23,42,0.05)'}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em'}}>{k.label}</div>
              <div style={{width:30,height:30,borderRadius:9,background:k.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{k.icon}</div>
            </div>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:22,color:k.color}}>
              {k.isCnt?k.val:moneyShort(k.val)}
            </div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        {/* Status tabs */}
        <div style={{display:'flex',gap:4,background:'#fff',borderRadius:12,padding:3,border:'1.5px solid #e2e8f0',flexShrink:0}}>
          {[['all','All'],[' unpaid','Unpaid'],['partial','Partial'],['paid','Paid']].map(([val,label])=>{
            const v=val.trim();
            const cnt=v==='all'?purchases.length:purchases.filter(p=>p.status===v).length;
            const s=STATUS[v]||{color:'#64748b',bg:'#f1f5f9'};
            return (
              <button key={v} onClick={()=>setFilter(v)} style={{padding:'7px 14px',borderRadius:9,border:'none',cursor:'pointer',background:filter===v?s.color:'transparent',color:filter===v?'#fff':'#64748b',fontWeight:filter===v?700:500,fontSize:13,transition:'all 0.15s',display:'flex',alignItems:'center',gap:5}}>
                {label} <span style={{fontSize:11,opacity:0.8}}>({cnt})</span>
              </button>
            );
          })}
        </div>
        {/* Search */}
        <div style={{position:'relative',flex:'1 1 200px',minWidth:160}}>
          <Search size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}/>
          <input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor or invoice no…" style={{paddingLeft:36}}/>
        </div>
      </div>

      {/* Purchase cards */}
      {loading ? (
        <div style={{textAlign:'center',padding:80}}><div className="spinner" style={{width:28,height:28,margin:'0 auto'}}/></div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 20px',background:'#fff',borderRadius:20,border:'1.5px dashed #e2e8f0'}}>
          <div style={{fontSize:56,opacity:0.2,marginBottom:14}}>🛍️</div>
          <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:18,color:'#475569',marginBottom:8}}>
            {search?`No results for "${search}"`:'No purchases yet'}
          </div>
          <button className="btn-primary" onClick={()=>setShowForm(true)} style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:4,background:'#d97706',boxShadow:'0 4px 14px rgba(217,119,6,0.3)'}}><Plus size={14}/>New Purchase</button>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {filtered.map(p=>{
            const st = STATUS[p.status]||STATUS.unpaid;
            const pct = p.totalAmount>0 ? Math.min(100,((p.paidAmount||0)/p.totalAmount)*100) : 0;
            const isExp = expanded===p.id;

            return (
              <div key={p.id} style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 2px 10px rgba(15,23,42,0.05)',transition:'box-shadow 0.2s'}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(15,23,42,0.10)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='0 2px 10px rgba(15,23,42,0.05)'}>

                {/* Progress bar */}
                <div style={{height:4,background:'#f1f5f9'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:st.color,borderRadius:4,transition:'width 0.4s ease'}}/>
                </div>

                {/* Main row */}
                <div style={{padding:'16px 20px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:14,flexWrap:'wrap'}}>
                    {/* Vendor + meta */}
                    <div style={{flex:'1 1 200px',minWidth:160}}>
                      <div style={{fontWeight:800,fontSize:17,color:'#0f172a',marginBottom:3}}>{p.vendorName||'—'}</div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                        <span style={{fontSize:12,color:'#64748b'}}>{p.date}</span>
                        {p.invoiceNo&&<span style={{fontSize:12,color:'#94a3b8',fontFamily:'monospace'}}>#{p.invoiceNo}</span>}
                        <span style={{fontSize:12,color:'#94a3b8'}}>{(p.items||[]).length} item{(p.items||[]).length!==1?'s':''}</span>
                      </div>
                    </div>

                    {/* Amounts */}
                    <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
                      <div style={{textAlign:'center',minWidth:70}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:2}}>Total</div>
                        <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:17,color:'#0f172a'}}>{moneyShort(p.totalAmount)}</div>
                      </div>
                      <div style={{textAlign:'center',minWidth:70}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:2}}>Paid</div>
                        <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:17,color:'#059669'}}>{moneyShort(p.paidAmount||0)}</div>
                      </div>
                      {(p.remainingAmount||0)>0.01&&(
                        <div style={{textAlign:'center',minWidth:70}}>
                          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:2}}>Due</div>
                          <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:17,color:'#dc2626'}}>{moneyShort(p.remainingAmount)}</div>
                        </div>
                      )}
                    </div>

                    {/* Status + actions */}
                    <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,flexWrap:'wrap'}}>
                      <span style={{padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:700,background:st.bg,color:st.color,border:`1px solid ${st.border}`}}>
                        {st.icon} {st.label}
                      </span>

                      {/* Pay button */}
                      {p.status!=='paid'&&(
                        <button onClick={()=>setPayModal(p)}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:10,border:'1.5px solid #fde68a',background:'#fffbeb',color:'#d97706',cursor:'pointer',fontSize:13,fontWeight:700,transition:'all 0.13s',whiteSpace:'nowrap'}}
                          onMouseEnter={e=>e.currentTarget.style.background='#fef3c7'}
                          onMouseLeave={e=>e.currentTarget.style.background='#fffbeb'}>
                          <CreditCard size={13}/> Pay
                        </button>
                      )}

                      {/* Edit */}
                      <button onClick={()=>{setEditItem(p);setShowForm(true);}}
                        style={{width:34,height:34,borderRadius:10,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.13s'}}
                        title="Edit"
                        onMouseEnter={e=>{e.currentTarget.style.background='#eff6ff';e.currentTarget.style.borderColor='#bfdbfe';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#f8fafc';e.currentTarget.style.borderColor='#e2e8f0';}}>
                        <Edit2 size={14} color="#2563eb"/>
                      </button>

                      {/* Delete */}
                      <button onClick={()=>handleDelete(p)}
                        style={{width:34,height:34,borderRadius:10,border:'1.5px solid #fecaca',background:'#fef2f2',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.13s'}}
                        title="Delete"
                        onMouseEnter={e=>e.currentTarget.style.background='#fee2e2'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fef2f2'}>
                        <Trash2 size={14} color="#dc2626"/>
                      </button>

                      {/* Expand */}
                      <button onClick={()=>setExpanded(isExp?null:p.id)}
                        style={{width:34,height:34,borderRadius:10,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {isExp?<ChevronUp size={14} color="#475569"/>:<ChevronDown size={14} color="#475569"/>}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExp&&(
                    <div style={{marginTop:16,paddingTop:16,borderTop:'1.5px solid #f1f5f9'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                        {/* Items */}
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:10}}>Items Purchased</div>
                          <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #e2e8f0'}}>
                            {(p.items||[]).map((item,i)=>(
                              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:i<(p.items.length-1)?'1px solid #f1f5f9':'none',background:i%2===0?'#fff':'#f8fafc'}}>
                                <div style={{width:30,height:30,borderRadius:8,background:'#fffbeb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>
                                  {CAT_EMOJI[item.category]||'📦'}
                                </div>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:600,color:'#0f172a',fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.itemName}</div>
                                  <div style={{fontSize:11,color:'#94a3b8'}}>{item.qty} {item.unit} × {money(item.rate)}</div>
                                </div>
                                <div style={{fontWeight:800,color:'#d97706',fontSize:14,flexShrink:0}}>{moneyShort(item.amount)}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Payments */}
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:10}}>Payment History</div>
                          {(p.payments||[]).length===0
                            ? <div style={{padding:'14px',background:'#fef2f2',borderRadius:12,border:'1px solid #fecaca',color:'#dc2626',fontSize:13,fontWeight:600,textAlign:'center'}}>⚠️ No payment recorded</div>
                            : (p.payments||[]).map((pay,i)=>(
                                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderRadius:10,border:'1px solid #e2e8f0',marginBottom:7,background:'#fff'}}>
                                  <div>
                                    <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>{moneyShort(pay.amount)}</div>
                                    <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{pay.mode||'—'}{pay.note?` · ${pay.note}`:''}</div>
                                  </div>
                                  <div style={{fontSize:12,color:'#94a3b8',textAlign:'right'}}>
                                    <div>{pay.date||'—'}</div>
                                    <span style={{padding:'2px 7px',borderRadius:20,background:'#ecfdf5',color:'#059669',fontWeight:600,fontSize:10}}>✓ Paid</span>
                                  </div>
                                </div>
                              ))
                          }
                        </div>
                      </div>

                      {p.notes&&(
                        <div style={{marginTop:12,padding:'10px 14px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0',fontSize:13,color:'#64748b'}}>
                          <strong>Notes:</strong> {p.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm&&(
        <PurchaseForm
          initial={editItem}
          vendors={vendors}
          invItems={invItems}
          payMethods={payMethods}
          shopId={selectedShop.id}
          user={user}
          onClose={()=>{setShowForm(false);setEditItem(null);}}
          onSaved={()=>{}}
        />
      )}

      {payModal&&(
        <PaymentSelector
          methods={payMethods}
          amount={(payModal.remainingAmount||0).toFixed(2)}
          maxAmount={payModal.remainingAmount||0}
          title="💳 Record Payment"
          subtitle={`${payModal.vendorName}${payModal.invoiceNo?' · '+payModal.invoiceNo:''} — Due: ₹${(payModal.remainingAmount||0).toFixed(2)}`}
          confirmLabel="Record Payment"
          accentColor="#d97706"
          onConfirm={async({method,amount,date,note})=>{
            try{
              const newPaid   = (payModal.paidAmount||0)+amount;
              const newRemain = Math.max(0,(payModal.totalAmount||0)-newPaid);
              const newStatus = newRemain<=0.01?'paid':'partial';
              await updateDoc(doc(db,'shops',selectedShop.id,'purchases',payModal.id),{
                paidAmount:newPaid, remainingAmount:newRemain, status:newStatus,
                payments:[...(payModal.payments||[]),{amount,mode:method,date,note,recordedAt:new Date().toISOString()}],
                updatedAt:new Date(),
              });
              if(payModal.vendorId){
                try{
                  const {getDoc}=await import('firebase/firestore');
                  const vs=await getDoc(doc(db,'shops',selectedShop.id,'parties',payModal.vendorId));
                  if(vs.exists()){const cur=vs.data().balance||vs.data().openingBalance||0;await updateDoc(doc(db,'shops',selectedShop.id,'parties',payModal.vendorId),{balance:Math.max(0,cur-amount),updatedAt:new Date()});}
                }catch(e){console.warn(e);}
              }
              toast.success(`₹${amount.toFixed(2)} recorded via ${method} ✅`);
              setPayModal(null);
            }catch(e){toast.error('Failed: '+e.message);}
          }}
          onCancel={()=>setPayModal(null)}
        />
      )}
    </div>
  );
}
