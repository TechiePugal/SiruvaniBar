import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import PaymentSelector from '../components/PaymentSelector';
import { format } from 'date-fns';
import { Plus, Search, Printer, CheckCircle, Eye, X, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const money = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const genNo  = pre => `${pre}-${Date.now().toString().slice(-6)}`;
const CAT_EMOJI = {liquor:'🍶',beer:'🍺',wine:'🍷',food:'🍛',cigarette:'🚬',cooldrink:'🥤',water:'💧',other:'📦'};

/* ─── Print ─────────────────────────────────────────────────────────── */
function printDoc(d, shop, isQ) {
  const rows = (d.items||[]).filter(i=>i.itemName).map(i=>`
    <tr>
      <td>${i.itemName}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">₹${Number(i.rate||0).toFixed(2)}</td>
      ${!isQ?`<td style="text-align:right">${i.gstEnabled?(i.gstRate+'%'):'—'}</td>`:''}
      <td style="text-align:right">₹${Number(i.amount||0).toFixed(2)}</td>
    </tr>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${isQ?'Quotation':'Invoice'} ${d.number}</title>
<style>
body{font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;font-size:13px;color:#111}
.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:12px}
.brand{font-size:18px;font-weight:900}
.doctype{font-size:22px;font-weight:900;color:${isQ?'#7c3aed':'#2563eb'};letter-spacing:2px}
.meta{font-size:12px;color:#555;margin-top:3px}
.bill-to{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:12px}
table{width:100%;border-collapse:collapse;margin:12px 0}
th{background:#f1f5f9;padding:8px;font-size:11px;font-weight:700;border-bottom:2px solid #111;text-align:left}
td{padding:7px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
.totals{float:right;width:250px;margin-top:4px}
.tr{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid #e2e8f0}
.grand{display:flex;justify-content:space-between;font-weight:900;font-size:17px;padding:8px 0;border-top:2px solid #111;margin-top:4px}
.footer{text-align:center;margin-top:28px;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:10px;clear:both}
@media print{body{padding:0}}
</style></head><body>
<div class="hdr">
  <div>
    <div class="brand">${shop?.name||'Siruvani'}</div>
    ${shop?.address?`<div class="meta">${shop.address}</div>`:''}
    ${shop?.phone?`<div class="meta">📞 ${shop.phone}</div>`:''}
    ${shop?.gstNumber?`<div class="meta">GSTIN: ${shop.gstNumber}</div>`:''}
  </div>
  <div style="text-align:right">
    <div class="doctype">${isQ?'QUOTATION':'INVOICE'}</div>
    <div class="meta">No: <strong>${d.number}</strong></div>
    <div class="meta">Date: ${d.date}</div>
    ${isQ&&d.validTill?`<div class="meta">Valid Till: ${d.validTill}</div>`:''}
    ${!isQ?`<div class="meta">Payment: <strong>${d.paymentMode||'Cash'}</strong></div>`:''}
  </div>
</div>
${d.customerName?`<div class="bill-to"><strong>${isQ?'To':'Bill To'}:</strong> ${d.customerName}${d.customerPhone?` | 📞 ${d.customerPhone}`:''}</div>`:''}
<table><thead><tr>
  <th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th>
  ${!isQ?'<th style="text-align:right">GST</th>':''}
  <th style="text-align:right">Amount</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="totals">
  <div class="tr"><span>Subtotal</span><span>₹${(d.subtotal||0).toFixed(2)}</span></div>
  ${(d.discountAmt||0)>0?`<div class="tr" style="color:#dc2626"><span>Discount (${d.discountPct}%)</span><span>-₹${(d.discountAmt||0).toFixed(2)}</span></div>`:''}
  ${(d.gstTotal||0)>0?`<div class="tr" style="color:#1d4ed8"><span>GST</span><span>₹${(d.gstTotal||0).toFixed(2)}</span></div>`:''}
  <div class="grand"><span>GRAND TOTAL</span><span>₹${(d.grandTotal||0).toFixed(2)}</span></div>
</div>
<div style="clear:both"></div>
${d.notes?`<div style="margin-top:14px;padding:8px 12px;background:#f8fafc;border-radius:6px;font-size:12px"><strong>Notes:</strong> ${d.notes}</div>`:''}
<div class="footer">Thank you for your business! — ${shop?.name||'Siruvani'}</div>
</body></html>`;
  const w=window.open('','_blank','width=720,height=900');
  if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),450);}
}

/* ─── Item search dropdown ──────────────────────────────────────────── */
function ItemSearch({ value, inventoryItems, freeItems, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState(value||'');
  useEffect(()=>setQ(value||''),[value]);

  // Combine inventory items + free-text items (no stock tracking)
  // If search matches inventory → show with stock. Also allow free text entry.
  const invFiltered = q.trim()
    ? inventoryItems.filter(i=>
        i.name.toLowerCase().includes(q.toLowerCase()) ||
        (i.barcode||'').includes(q)
      ).slice(0,6)
    : inventoryItems.slice(0,6);

  // Show "Add as free item" option when query doesn't exactly match any inventory item
  const exactMatch = inventoryItems.find(i=>i.name.toLowerCase()===q.toLowerCase());

  return (
    <div style={{position:'relative'}}>
      <div style={{position:'relative'}}>
        <Search size={13} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',pointerEvents:'none'}}/>
        <input
          value={q}
          onChange={e=>{setQ(e.target.value);setOpen(true);}}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),200)}
          placeholder="Type item name…"
          style={{width:'100%',padding:'8px 10px 8px 28px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,outline:'none',background:'#fff',color:'#0f172a',fontFamily:'DM Sans,sans-serif'}}
        />
      </div>
      {open && (q.trim() || invFiltered.length>0) && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:9999,background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,boxShadow:'0 8px 32px rgba(15,23,42,0.15)',marginTop:4,overflow:'hidden',maxHeight:300,overflowY:'auto'}}>
          {/* Inventory items */}
          {invFiltered.length>0 && (
            <>
              <div style={{padding:'6px 12px',fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',background:'#f8faff',borderBottom:'1px solid #f1f5f9'}}>From Inventory</div>
              {invFiltered.map(item=>{
                const isOut = (item.currentStock||0)<=0;
                return (
                  <div key={item.id} onMouseDown={()=>onSelect({
                    type:'inventory', itemId:item.id, itemName:item.name,
                    category:item.category, unit:item.unit||'unit',
                    rate:item.sellingPrice||item.purchasePrice||0,
                    gstEnabled:item.gstEnabled||false, gstRate:item.gstRate||0,
                    currentStock:item.currentStock||0, photoURL:item.photoURL||''
                  })}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',cursor:'pointer',borderBottom:'1px solid #f8fafc',opacity:1}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0f9ff'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <div style={{width:32,height:32,borderRadius:8,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{CAT_EMOJI[item.category]||'📦'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:'#0f172a'}}>{item.name}</div>
                      <div style={{fontSize:11,color: isOut?'#dc2626':'#94a3b8'}}>
                        Stock: <strong style={{color:isOut?'#dc2626':'#059669'}}>{item.currentStock||0}</strong> {item.unit}
                        {isOut&&<span style={{marginLeft:6,color:'#dc2626',fontWeight:700}}>⚠️ OUT</span>}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontWeight:800,color:'#2563eb',fontSize:14}}>₹{item.sellingPrice||item.purchasePrice||0}</div>
                      {item.gstEnabled&&<div style={{fontSize:10,color:'#94a3b8'}}>+{item.gstRate}% GST</div>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {/* Free text option — for food/items not in inventory */}
          {q.trim() && !exactMatch && (
            <>
              <div style={{padding:'6px 12px',fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',background:'#f8faff',borderTop:'1px solid #f1f5f9'}}>Add as Custom Item (no stock tracking)</div>
              <div onMouseDown={()=>onSelect({
                type:'free', itemId:'', itemName:q.trim(),
                category:'other', unit:'unit',
                rate:0, gstEnabled:false, gstRate:0,
                currentStock:-1 // -1 = no stock tracking
              })}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',background:'#fffbeb',borderTop:'1px solid #fef3c7'}}
                onMouseEnter={e=>e.currentTarget.style.background='#fef3c7'}
                onMouseLeave={e=>e.currentTarget.style.background='#fffbeb'}>
                <div style={{width:32,height:32,borderRadius:8,background:'#fef3c7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>➕</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#0f172a'}}>"{q.trim()}"</div>
                  <div style={{fontSize:11,color:'#d97706'}}>Custom item — no stock deduction, enter price manually</div>
                </div>
              </div>
            </>
          )}
          {invFiltered.length===0 && !q.trim() && (
            <div style={{padding:'14px',color:'#94a3b8',fontSize:13,textAlign:'center'}}>Type to search inventory items…</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Line item row ─────────────────────────────────────────────────── */
function LineItemRow({ item, idx, inventoryItems, onUpdate, onRemove }) {
  const handleSelect = inv => {
    onUpdate(idx, {
      ...item,
      type:       inv.type,
      itemId:     inv.itemId,
      itemName:   inv.itemName,
      category:   inv.category,
      unit:       inv.unit,
      rate:       inv.rate,
      gstEnabled: inv.gstEnabled,
      gstRate:    inv.gstRate,
      currentStock: inv.currentStock,
      amount:     inv.rate * (parseFloat(item.qty)||1),
      qty:        item.qty||1,
    });
  };
  const updateField = (field, val) => {
    const qty  = field==='qty'  ? (parseFloat(val)||0) : (parseFloat(item.qty)||0);
    const rate = field==='rate' ? (parseFloat(val)||0) : (parseFloat(item.rate)||0);
    onUpdate(idx, { ...item, [field]:val, amount: qty*rate });
  };
  const isFree    = item.type==='free';
  const isOutStock= item.type==='inventory' && (item.currentStock||0)<=0;

  return (
    <tr style={{borderBottom:'1px solid #f1f5f9',background: isOutStock?'#fff8f8':'#fff'}}>
      <td style={{padding:'8px 10px',minWidth:180}}>
        <ItemSearch value={item.itemName||''} inventoryItems={inventoryItems} onSelect={handleSelect}/>
        {isOutStock && <div style={{fontSize:11,color:'#dc2626',marginTop:3,fontWeight:600}}>⚠️ Out of stock — will still bill</div>}
        {isFree     && <div style={{fontSize:11,color:'#d97706',marginTop:3}}>📝 Custom item</div>}
      </td>
      <td style={{padding:'8px 6px',width:72}}>
        <input type="number" min="0.01" step="0.01" value={item.qty}
          onChange={e=>updateField('qty',e.target.value)}
          style={{width:'100%',padding:'7px',border:'1.5px solid #e2e8f0',borderRadius:9,textAlign:'center',fontWeight:700,fontSize:14,outline:'none',color:'#0f172a'}}/>
      </td>
      <td style={{padding:'8px 6px',width:100}}>
        <input type="number" min="0" step="0.01" value={item.rate}
          onChange={e=>updateField('rate',e.target.value)}
          style={{width:'100%',padding:'7px',border:'1.5px solid #e2e8f0',borderRadius:9,textAlign:'right',fontWeight:700,fontSize:14,outline:'none',color:'#0f172a'}}/>
      </td>
      <td style={{padding:'8px 6px',width:60,textAlign:'center',fontSize:12,color:item.gstEnabled?'#1d4ed8':'#94a3b8'}}>
        {item.gstEnabled?`${item.gstRate}%`:'—'}
      </td>
      <td style={{padding:'8px 10px',width:100,fontWeight:800,color:'#2563eb',fontSize:15,textAlign:'right'}}>
        ₹{(parseFloat(item.amount)||0).toFixed(2)}
      </td>
      <td style={{padding:'8px 6px',width:34}}>
        <button onClick={()=>onRemove(idx)} style={{width:28,height:28,borderRadius:7,border:'none',background:'#fef2f2',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <X size={13} color="#dc2626"/>
        </button>
      </td>
    </tr>
  );
}

/* ─── blank row ─────────────────────────────────────────────────────── */
const blankRow = () => ({type:'inventory',itemId:'',itemName:'',category:'',unit:'unit',qty:1,rate:'',gstEnabled:false,gstRate:0,amount:0,currentStock:0});

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════ */
export default function InvoicePage({ mode='invoice' }) {
  const { selectedShop, user } = useAuth();
  const isQuo = mode==='quotation';
  const COLL  = isQuo?'quotations':'invoices';
  const payMethods = usePaymentMethods(selectedShop?.id);

  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDocId, setEditDocId] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [search, setSearch]   = useState('');
  const [viewDoc, setViewDoc] = useState(null);
  const [inventoryItems, setInvItems] = useState([]);

  const emptyForm = () => ({
    number: genNo(isQuo?'QUO':'INV'),
    date:   format(new Date(),'yyyy-MM-dd'),
    validTill: '',
    customerName: '',
    customerPhone: '',
    items: [blankRow()],
    discountPct: 0,
    paymentMode: payMethods[0]?.name||'Cash',
    notes: '',
  });
  const [form, setForm] = useState(emptyForm());

  // Update default payment mode when methods load
  useEffect(()=>{
    if(payMethods.length>0 && !form.paymentMode)
      setForm(f=>({...f, paymentMode:payMethods[0].name}));
  },[payMethods]);

  /* Load docs */
  useEffect(()=>{
    if(!selectedShop)return;
    const q=query(collection(db,'shops',selectedShop.id,COLL),orderBy('createdAt','desc'),limit(200));
    return onSnapshot(q,snap=>{setDocs(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},()=>setLoading(false));
  },[selectedShop,COLL]);

  /* Load inventory */
  useEffect(()=>{
    if(!selectedShop)return;
    const q=query(collection(db,'shops',selectedShop.id,'inventory_items'),orderBy('name'));
    return onSnapshot(q,snap=>setInvItems(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[selectedShop]);

  /* Totals */
  const subtotal   = form.items.reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
  const gstTotal   = form.items.reduce((s,i)=>i.gstEnabled?s+(parseFloat(i.amount)||0)*i.gstRate/100:s,0);
  const discountAmt= subtotal*(parseFloat(form.discountPct)||0)/100;
  const grandTotal = subtotal-discountAmt+gstTotal;

  const updateItem = (idx,patch) => setForm(f=>({...f,items:f.items.map((it,i)=>i===idx?{...it,...patch}:it)}));
  const addItem    = () => setForm(f=>({...f,items:[...f.items,blankRow()]}));
  const removeItem = (idx) => setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));

  /* Save / Update */
  const handleSave = async () => {
    const validItems = form.items.filter(i=>i.itemName&&(parseFloat(i.qty)||0)>0);
    if(validItems.length===0) return toast.error('Add at least one item with name and quantity');
    setSaving(true);
    try {
      const data = {
        ...form, items:validItems,
        subtotal, gstTotal, discountAmt,
        discountPct:parseFloat(form.discountPct)||0,
        grandTotal, mode,
        status: isQuo?'draft':'unpaid',
        shopName:selectedShop.name||'',
        shopAddress:selectedShop.address||'',
        shopPhone:selectedShop.phone||'',
        shopGst:selectedShop.gstNumber||'',
        updatedAt:new Date(),
      };

      if(editDocId) {
        await updateDoc(doc(db,'shops',selectedShop.id,COLL,editDocId), data);
        toast.success(`${isQuo?'Quotation':'Invoice'} updated ✅`);
      } else {
        // NEW invoice — reduce inventory stock for inventory-type items
        const ref = await addDoc(collection(db,'shops',selectedShop.id,COLL),
          {...data, createdBy:user.uid, createdAt:new Date()});

        if(!isQuo) {
          // Reduce stock for each inventory item
          for(const item of validItems) {
            if(item.type==='inventory' && item.itemId) {
              const invItem = inventoryItems.find(i=>i.id===item.itemId);
              if(invItem) {
                const newStock = Math.max(0,(invItem.currentStock||0)-(parseFloat(item.qty)||0));
                await updateDoc(doc(db,'shops',selectedShop.id,'inventory_items',item.itemId),{
                  currentStock: newStock, updatedAt:new Date()
                });
                // Log stock movement
                await addDoc(collection(db,'shops',selectedShop.id,'inventory_entries'),{
                  itemId:item.itemId, itemName:item.itemName, category:item.category,
                  type:'sale', qty:parseFloat(item.qty)||0,
                  stockBefore:invItem.currentStock||0, stockAfter:newStock,
                  salePrice:parseFloat(item.rate)||0,
                  totalValue:(parseFloat(item.qty)||0)*(parseFloat(item.rate)||0),
                  invoiceId:ref.id, invoiceNo:form.number,
                  date:form.date, createdAt:new Date(),
                });
              }
            }
          }
        }
      }

      setShowForm(false); setEditDocId(null); setForm(emptyForm());
    } catch(e){toast.error('Failed: '+e.message);console.error(e);}
    finally{setSaving(false);}
  };

  const openEdit = d => {
    setEditDocId(d.id);
    setForm({
      number:d.number||'', date:d.date||format(new Date(),'yyyy-MM-dd'),
      validTill:d.validTill||'', customerName:d.customerName||'',
      customerPhone:d.customerPhone||'',
      items:(d.items||[]).map(i=>({...i, type:i.type||'inventory', currentStock:i.currentStock??0})),
      discountPct:d.discountPct||0, paymentMode:d.paymentMode||payMethods[0]?.name||'Cash', notes:d.notes||''
    });
    setShowForm(true);
  };

  const handleDelete = async d => {
    if(!window.confirm(`Delete ${isQuo?'quotation':'invoice'} ${d.number}?`)) return;
    try {
      await deleteDoc(doc(db,'shops',selectedShop.id,COLL,d.id));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  // Open payment method selector instead of 1-click
  const openPayModal = d => setPayingDoc(d);

  const handleMarkPaid = async ({ method, amount, date, note }) => {
    if (!payingDoc) return;
    try {
      await updateDoc(doc(db,'shops',selectedShop.id,COLL,payingDoc.id),{
        status:      'paid',
        paymentMode: method,
        paidAt:      new Date(),
        paymentNote: note||'',
        paidAmount:  amount,
      });
      toast.success(`Paid via ${method} ✅`);
      setPayingDoc(null);
    } catch(e) { toast.error('Failed: '+e.message); }
  };

  const filtered = docs.filter(d=>
    (d.customerName||'').toLowerCase().includes(search.toLowerCase())||
    (d.number||'').toLowerCase().includes(search.toLowerCase())
  );

  const totalInvoiced = docs.reduce((s,d)=>s+(d.grandTotal||0),0);
  const totalUnpaid   = docs.filter(d=>d.status==='unpaid').reduce((s,d)=>s+(d.grandTotal||0),0);
  const totalPaid     = docs.filter(d=>d.status==='paid').reduce((s,d)=>s+(d.grandTotal||0),0);

  if(!selectedShop) return (
    <div className="page-container" style={{textAlign:'center',padding:'80px 20px',color:'#94a3b8'}}>
      <div style={{fontSize:48,opacity:0.3,marginBottom:12}}>{isQuo?'💬':'🧾'}</div>
      <p>Select a shop first</p>
    </div>
  );

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>
            {isQuo?'💬 Quotations':'🧾 Sales Invoices'}
          </h1>
          <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>
            {isQuo?'Price quotes — no stock deduction':'Invoices — stock auto-deducted for inventory items'}
          </p>
        </div>
        <button className="btn-primary" onClick={()=>{setEditDocId(null);setForm(emptyForm());setShowForm(true);}} style={{display:'flex',alignItems:'center',gap:8}}>
          <Plus size={16}/> New {isQuo?'Quotation':'Invoice'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:22}}>
        {[
          {label:'Total',   val:totalInvoiced, color:'#2563eb', bg:'#eff6ff', icon:'💰'},
          {label:isQuo?'Drafts':'Unpaid', val:isQuo?docs.filter(d=>d.status==='draft').length:totalUnpaid, color:'#dc2626', bg:'#fef2f2', icon:'⏳', isCnt:isQuo},
          {label:isQuo?'Sent':'Collected', val:isQuo?docs.filter(d=>d.status==='sent').length:totalPaid, color:'#059669', bg:'#ecfdf5', icon:'✅', isCnt:isQuo},
          {label:'Count',   val:docs.length,  color:'#7c3aed', bg:'#f5f3ff', icon:'🧾', isCnt:true},
        ].map(k=>(
          <div key={k.label} style={{background:'#fff',borderRadius:14,padding:'14px 16px',border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(15,23,42,0.05)'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em'}}>{k.icon} {k.label}</div>
            </div>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:22,color:k.color}}>
              {k.isCnt ? k.val : money(k.val)}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{position:'relative',maxWidth:380,marginBottom:18}}>
        <Search size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}/>
        <input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by customer name or number…" style={{paddingLeft:36}}/>
      </div>

      {/* Table */}
      {loading ? <div style={{textAlign:'center',padding:60}}><div className="spinner"/></div>
      : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 20px',background:'#fff',borderRadius:20,border:'1.5px dashed #e2e8f0'}}>
          <div style={{fontSize:56,opacity:0.2,marginBottom:14}}>{isQuo?'💬':'🧾'}</div>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:18,color:'#475569',marginBottom:8}}>{search?`No results for "${search}"`:`No ${isQuo?'quotations':'invoices'} yet`}</div>
          <button className="btn-primary" onClick={()=>setShowForm(true)} style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:4}}><Plus size={14}/>Create First</button>
        </div>
      ) : (
        <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
              <thead>
                <tr style={{background:'#f8faff'}}>
                  {['Number','Date','Customer',isQuo?'Valid Till':'Status','Amount','Actions'].map(h=>(
                    <th key={h} style={{padding:'12px 14px',textAlign:'left',fontSize:11.5,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em',borderBottom:'1.5px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d=>(
                  <tr key={d.id} style={{borderBottom:'1px solid #f1f5f9'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8faff'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <td style={{padding:'12px 14px',fontFamily:'monospace',fontWeight:700,color:isQuo?'#7c3aed':'#2563eb',fontSize:13,whiteSpace:'nowrap'}}>{d.number}</td>
                    <td style={{padding:'12px 14px',fontSize:13,color:'#475569',whiteSpace:'nowrap'}}>{d.date}</td>
                    <td style={{padding:'12px 14px'}}>
                      <div style={{fontWeight:600,color:'#0f172a',fontSize:14}}>{d.customerName||<span style={{color:'#94a3b8',fontWeight:400}}>Walk-in</span>}</div>
                      {d.customerPhone&&<div style={{fontSize:11,color:'#94a3b8'}}>{d.customerPhone}</div>}
                    </td>
                    <td style={{padding:'12px 14px'}}>
                      {isQuo ? <span style={{fontSize:13,color:'#64748b'}}>{d.validTill||'—'}</span>
                        : <span style={{padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700,
                            background:d.status==='paid'?'#ecfdf5':'#fef2f2',
                            color:d.status==='paid'?'#059669':'#dc2626',
                            border:`1px solid ${d.status==='paid'?'#a7f3d0':'#fecaca'}`}}>
                            {d.status==='paid'?'✓ Paid':'⏳ Unpaid'}
                          </span>}
                    </td>
                    <td style={{padding:'12px 14px',fontWeight:800,color:'#0f172a',fontSize:15,whiteSpace:'nowrap'}}>{money(d.grandTotal)}</td>
                    <td style={{padding:'12px 14px'}}>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        <button onClick={()=>setViewDoc(d)} title="View" style={{width:30,height:30,borderRadius:8,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <Eye size={13} color="#475569"/>
                        </button>
                        <button onClick={()=>printDoc(d,selectedShop,isQuo)} title="Print" style={{width:30,height:30,borderRadius:8,border:'1.5px solid #bfdbfe',background:'#eff6ff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <Printer size={13} color="#2563eb"/>
                        </button>
                        <button onClick={()=>openEdit(d)} title="Edit" style={{width:30,height:30,borderRadius:8,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <Edit2 size={13} color="#475569"/>
                        </button>
                        {!isQuo&&d.status==='unpaid'&&(
                          <button onClick={()=>markPaid(d.id)} title="Mark Paid" style={{width:30,height:30,borderRadius:8,border:'1.5px solid #a7f3d0',background:'#ecfdf5',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <CheckCircle size={13} color="#059669"/>
                          </button>
                        )}
                        <button onClick={()=>handleDelete(d)} title="Delete" style={{width:30,height:30,borderRadius:8,border:'1.5px solid #fecaca',background:'#fef2f2',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
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

      {/* ── Form modal ── */}
      {showForm&&(
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:24,width:'100%',maxWidth:820,maxHeight:'95vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0'}}>
            {/* Sticky header */}
            <div style={{padding:'18px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#fff',zIndex:10}}>
              <div>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:19,color:'#0f172a'}}>
                  {editDocId?(isQuo?'✏️ Edit Quotation':'✏️ Edit Invoice'):(isQuo?'💬 New Quotation':'🧾 New Invoice')}
                </div>
                <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                  {isQuo?'Price quote only — stock NOT deducted':'Stock auto-deducted for inventory items when saved'}
                </div>
              </div>
              <button onClick={()=>setShowForm(false)} style={{width:32,height:32,borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:18}}>✕</button>
            </div>

            <div style={{padding:'20px 24px'}}>
              {/* Doc info */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:18}}>
                <div className="form-group">
                  <label className="form-label">{isQuo?'Quotation':'Invoice'} No.</label>
                  <input className="form-input" value={form.number} onChange={e=>setForm(f=>({...f,number:e.target.value}))} style={{fontFamily:'monospace',fontWeight:700}}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
                </div>
                {isQuo ? (
                  <div className="form-group">
                    <label className="form-label">Valid Till</label>
                    <input className="form-input" type="date" value={form.validTill} onChange={e=>setForm(f=>({...f,validTill:e.target.value}))}/>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Payment Mode</label>
                      <select className="form-select" value={form.paymentMode} onChange={e=>setForm(f=>({...f,paymentMode:e.target.value}))}>
                        {payMethods.map(m=><option key={m.id||m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Discount %</label>
                      <input className="form-input" type="number" min="0" max="100" value={form.discountPct} onChange={e=>setForm(f=>({...f,discountPct:e.target.value}))} placeholder="0"/>
                    </div>
                  </>
                )}
              </div>

              {/* Customer */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'12px 14px',background:'#f8faff',borderRadius:12,border:'1.5px solid #e0e7ff',marginBottom:18}}>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label">Customer Name (optional)</label>
                  <input className="form-input" value={form.customerName} onChange={e=>setForm(f=>({...f,customerName:e.target.value}))} placeholder="Walk-in / customer name"/>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label">Phone (optional)</label>
                  <input className="form-input" value={form.customerPhone} onChange={e=>setForm(f=>({...f,customerPhone:e.target.value}))} placeholder="+91 XXXXX XXXXX"/>
                </div>
              </div>

              {/* Items */}
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                    Items — Search inventory or type custom
                  </div>
                  {!isQuo && <div style={{fontSize:12,color:'#059669',fontWeight:600}}>✅ Inventory items will auto-deduct stock</div>}
                </div>
                <div style={{borderRadius:14,overflow:'hidden',border:'1.5px solid #e0e7ff',background:'#f8faff'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 72px 100px 60px 100px 34px',padding:'8px 10px',background:'#e8f0fe',fontSize:11,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.04em',borderBottom:'1px solid #e0e7ff'}}>
                    <span>Item / Service</span><span style={{textAlign:'center'}}>Qty</span><span style={{textAlign:'right'}}>Rate ₹</span><span style={{textAlign:'center'}}>GST</span><span style={{textAlign:'right'}}>Amount</span><span/>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <tbody>
                      {form.items.map((item,idx)=>(
                        <LineItemRow key={idx} item={item} idx={idx} inventoryItems={inventoryItems} onUpdate={updateItem} onRemove={removeItem}/>
                      ))}
                    </tbody>
                  </table>
                  <div style={{padding:'10px 12px',borderTop:'1px solid #e0e7ff'}}>
                    <button onClick={addItem} style={{padding:'7px 14px',borderRadius:8,border:'1.5px dashed #bfdbfe',background:'transparent',color:'#2563eb',cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                      <Plus size={13}/> Add Row
                    </button>
                  </div>
                </div>
              </div>

              {/* Totals + notes */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:16}}>
                <div className="form-group">
                  <label className="form-label">Notes / Terms</label>
                  <textarea className="form-input" rows={3} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder={isQuo?"Validity, delivery terms…":"Payment terms, bank details…"} style={{resize:'vertical'}}/>
                </div>
                <div style={{background:'#f8faff',borderRadius:12,padding:'14px 16px',border:'1.5px solid #e0e7ff'}}>
                  {[
                    {label:'Subtotal',val:`₹${subtotal.toFixed(2)}`,color:'#475569'},
                    ...(gstTotal>0?[{label:'GST',val:`+₹${gstTotal.toFixed(2)}`,color:'#1d4ed8'}]:[]),
                    ...(discountAmt>0?[{label:`Disc (${form.discountPct}%)`,val:`-₹${discountAmt.toFixed(2)}`,color:'#dc2626'}]:[]),
                  ].map(r=>(
                    <div key={r.label} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
                      <span style={{color:'#64748b'}}>{r.label}</span>
                      <span style={{fontWeight:600,color:r.color}}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{borderTop:'2px solid #e2e8f0',paddingTop:10,marginTop:6,display:'flex',justifyContent:'space-between',fontWeight:900,fontSize:20}}>
                    <span style={{color:'#0f172a'}}>Total</span>
                    <span style={{color:isQuo?'#7c3aed':'#2563eb'}}>₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{padding:'14px 24px 22px',borderTop:'1px solid #e2e8f0',background:'#f8fafc',display:'flex',gap:10}}>
              <button onClick={()=>setShowForm(false)} className="btn-secondary" style={{flex:1,padding:'12px',fontWeight:600}}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{flex:2,padding:'12px',fontWeight:700,fontSize:15,justifyContent:'center'}}>
                {saving?<><div className="spinner" style={{width:15,height:15,borderTopColor:'#fff'}}/>Saving…</>:editDocId?`✅ Update ${isQuo?'Quotation':'Invoice'}`:`✅ Save ${isQuo?'Quotation':'Invoice'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {/* ── Payment method selector ── */}
      {payingDoc&&(
        <PaymentSelector
          methods={payMethods}
          amount={payingDoc.grandTotal}
          maxAmount={payingDoc.grandTotal}
          title="💳 Record Payment"
          subtitle={`Invoice ${payingDoc.number}${payingDoc.customerName?' · '+payingDoc.customerName:''} — ₹${(payingDoc.grandTotal||0).toFixed(2)}`}
          confirmLabel="Mark as Paid"
          accentColor="#059669"
          onConfirm={handleMarkPaid}
          onCancel={()=>setPayingDoc(null)}
        />
      )}

      {viewDoc&&(
        <div className="modal-overlay" onClick={()=>setViewDoc(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:500,maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(15,23,42,0.18)',border:'1.5px solid #e2e8f0'}}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'#fff'}}>
              <div>
                <div style={{fontFamily:'monospace',fontWeight:700,fontSize:16,color:isQuo?'#7c3aed':'#2563eb'}}>{viewDoc.number}</div>
                <div style={{fontSize:13,color:'#64748b',marginTop:1}}>{viewDoc.customerName||'Walk-in'} · {viewDoc.date}</div>
              </div>
              <button onClick={()=>setViewDoc(null)} style={{width:32,height:32,borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontSize:18}}>✕</button>
            </div>
            <div style={{padding:'16px 22px'}}>
              {(viewDoc.items||[]).filter(i=>i.itemName).map((item,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:14}}>
                  <div>
                    <span style={{fontWeight:600,color:'#0f172a'}}>{item.itemName}</span>
                    <span style={{color:'#94a3b8',fontSize:12}}> ×{item.qty} @ ₹{item.rate}</span>
                    {item.gstEnabled&&<span style={{color:'#1d4ed8',fontSize:12}}> +{item.gstRate}% GST</span>}
                    {item.type==='free'&&<span style={{fontSize:11,color:'#d97706',marginLeft:6}}>📝</span>}
                  </div>
                  <span style={{fontWeight:700,color:'#2563eb'}}>₹{(parseFloat(item.amount)||0).toFixed(2)}</span>
                </div>
              ))}
              <div style={{marginTop:12}}>
                {(viewDoc.gstTotal||0)>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#1d4ed8',marginBottom:4}}><span>GST</span><span style={{fontWeight:600}}>₹{viewDoc.gstTotal.toFixed(2)}</span></div>}
                {(viewDoc.discountAmt||0)>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#dc2626',marginBottom:4}}><span>Discount</span><span style={{fontWeight:600}}>-₹{viewDoc.discountAmt.toFixed(2)}</span></div>}
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:900,fontSize:18,color:'#0f172a',borderTop:'1.5px solid #e2e8f0',paddingTop:10,marginTop:6}}>
                  <span>Total</span><span style={{color:isQuo?'#7c3aed':'#2563eb'}}>₹{(viewDoc.grandTotal||0).toFixed(2)}</span>
                </div>
              </div>
              {!isQuo&&<div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:13,color:'#64748b'}}>Payment:</span>
                <span style={{fontWeight:700,color:'#0f172a'}}>{viewDoc.paymentMode}</span>
                <span style={{padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:700,background:viewDoc.status==='paid'?'#ecfdf5':'#fef2f2',color:viewDoc.status==='paid'?'#059669':'#dc2626'}}>{viewDoc.status==='paid'?'Paid':'Unpaid'}</span>
              </div>}
              {viewDoc.notes&&<div style={{marginTop:10,padding:'8px 12px',background:'#f8fafc',borderRadius:8,fontSize:13,color:'#64748b'}}><strong>Notes:</strong> {viewDoc.notes}</div>}
            </div>
            <div style={{padding:'12px 22px 20px',display:'flex',gap:8}}>
              <button onClick={()=>setViewDoc(null)} className="btn-secondary" style={{flex:1}}>Close</button>
              <button onClick={()=>printDoc(viewDoc,selectedShop,isQuo)} className="btn-primary" style={{flex:1,justifyContent:'center',display:'flex',alignItems:'center',gap:6}}>
                <Printer size={14}/> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
