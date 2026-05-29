import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, subMonths } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#be185d','#475569'];
const money  = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:0})}`;
const pct    = (a,b) => b>0 ? (((a-b)/b)*100).toFixed(1) : null;

const Tip = ({ active, payload, label }) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'10px 14px',fontSize:13,boxShadow:'0 4px 16px rgba(15,23,42,0.10)'}}>
      <div style={{color:'#64748b',marginBottom:4,fontWeight:600}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||'#2563eb',fontWeight:700}}>
          {p.name}: {typeof p.value==='number'&&p.value>99 ? money(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const { selectedShop } = useAuth();
  const [tab,      setTab]      = useState('pnl');
  const [from,     setFrom]     = useState(format(startOfMonth(new Date()),'yyyy-MM-dd'));
  const [to,       setTo]       = useState(format(new Date(),'yyyy-MM-dd'));
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(()=>{ if(selectedShop) load(); },[selectedShop,from,to]);

  const safe = v => isNaN(Number(v)) ? 0 : Number(v||0);

  const load = async () => {
    if(!selectedShop) return;
    setLoading(true); setError('');
    try {
      const sid = selectedShop.id;

      /* ── Load all collections (simple queries, no composite index) ── */
      const [invSnap, quoSnap, expSnap, purSnap, invItemSnap] = await Promise.all([
        getDocs(collection(db,'shops',sid,'invoices')),
        getDocs(collection(db,'shops',sid,'quotations')),
        getDocs(collection(db,'shops',sid,'expenses')),
        getDocs(collection(db,'shops',sid,'purchases')),
        getDocs(collection(db,'shops',sid,'inventory_items')),
      ]);

      /* ── Filter by date range client-side (avoids composite index) ── */
      const inRange = (d, f=from, t=to) => d >= f && d <= t;

      const invoices  = invSnap.docs.map(d=>d.data()).filter(d=>inRange(d.date||''));
      const expenses  = expSnap.docs.map(d=>d.data()).filter(d=>inRange(d.date||''));
      const purchases = purSnap.docs.map(d=>d.data()).filter(d=>inRange(d.date||''));
      const invItems  = invItemSnap.docs.map(d=>({id:d.id,...d.data()}));

      /* ── Revenue from invoices ── */
      const totalRevenue  = invoices.reduce((s,inv)=>s+(safe(inv.grandTotal)),0);
      const totalReceived = invoices.filter(i=>i.status==='paid').reduce((s,inv)=>s+(safe(inv.grandTotal)),0);
      const totalUnpaid   = invoices.filter(i=>i.status!=='paid').reduce((s,inv)=>s+(safe(inv.grandTotal)),0);

      /* ── Payment mode breakdown ── */
      const payMap = {};
      invoices.filter(i=>i.status==='paid').forEach(inv => {
        const mode = inv.paymentMode || 'Cash';
        payMap[mode] = (payMap[mode]||0) + safe(inv.grandTotal);
      });
      const payData = Object.entries(payMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);

      /* ── Item / category sales ── */
      const itemMap = {};
      const catMap  = {};
      invoices.forEach(inv=>{
        (inv.items||[]).forEach(item=>{
          if(!item.itemName) return;
          const amt = safe(item.amount);
          itemMap[item.itemName] = (itemMap[item.itemName]||0) + amt;
          const cat = item.category||'other';
          catMap[cat] = (catMap[cat]||0) + amt;
        });
      });
      const topItems = Object.entries(itemMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,10);
      const catData  = Object.entries(catMap).map(([name,value])=>({name:name.charAt(0).toUpperCase()+name.slice(1),value})).sort((a,b)=>b.value-a.value);

      /* ── Daily revenue trend ── */
      const dailyMap = {};
      invoices.forEach(inv=>{
        const d = inv.date||'';
        if(d) dailyMap[d] = (dailyMap[d]||0) + safe(inv.grandTotal);
      });
      const dailyData = Object.entries(dailyMap).sort(([a],[b])=>a.localeCompare(b)).map(([date,revenue])=>({date:date.slice(5),revenue}));

      /* ── Expenses ── */
      const totalExpenses = expenses.reduce((s,e)=>s+safe(e.amount),0);
      const expCatMap = {};
      expenses.forEach(e=>{ expCatMap[e.category||'Other']=(expCatMap[e.category||'Other']||0)+safe(e.amount); });
      const expCatData = Object.entries(expCatMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
      const expDailyMap = {};
      expenses.forEach(e=>{ if(e.date) expDailyMap[e.date]=(expDailyMap[e.date]||0)+safe(e.amount); });
      const expDailyData = Object.entries(expDailyMap).sort(([a],[b])=>a.localeCompare(b)).map(([date,amount])=>({date:date.slice(5),amount}));

      /* ── Purchases ── */
      const totalPurchases = purchases.reduce((s,p)=>s+safe(p.totalAmount||p.amount||0),0);
      const purchasePaid   = purchases.reduce((s,p)=>s+safe(p.paidAmount||0),0);
      const purchaseDue    = purchases.reduce((s,p)=>s+safe(p.remainingAmount||0),0);

      /* ── P&L ── */
      const grossProfit = totalRevenue - totalPurchases;
      const netProfit   = grossProfit  - totalExpenses;

      /* ── Inventory value ── */
      const stockValue   = invItems.reduce((s,i)=>s+(safe(i.currentStock)*safe(i.purchasePrice)),0);
      const sellingValue = invItems.reduce((s,i)=>s+(safe(i.currentStock)*(safe(i.sellingPrice)||safe(i.purchasePrice))),0);

      /* ── Previous period for growth ── */
      const days    = Math.max(1,Math.ceil((new Date(to)-new Date(from))/86400000));
      const prevTo2 = format(new Date(new Date(from).getTime()-86400000),'yyyy-MM-dd');
      const prevFrom2=format(new Date(new Date(from).getTime()-days*86400000),'yyyy-MM-dd');

      const allInvoices = invSnap.docs.map(d=>d.data());
      const allExpenses = expSnap.docs.map(d=>d.data());
      const prevRevenue = allInvoices.filter(d=>inRange(d.date||'',prevFrom2,prevTo2)).reduce((s,d)=>s+safe(d.grandTotal),0);
      const prevExpense = allExpenses.filter(d=>inRange(d.date||'',prevFrom2,prevTo2)).reduce((s,d)=>s+safe(d.amount),0);

      setData({
        totalRevenue, totalReceived, totalUnpaid,
        totalExpenses, totalPurchases, purchasePaid, purchaseDue,
        grossProfit, netProfit,
        stockValue, sellingValue,
        invoiceCount: invoices.length,
        paidCount:    invoices.filter(i=>i.status==='paid').length,
        dailyData, catData, topItems, payData,
        expCatData, expDailyData,
        growthRevenue:  pct(totalRevenue, prevRevenue),
        growthExpenses: pct(totalExpenses, prevExpense),
        prevRevenue, prevExpense,
      });
    } catch(e) {
      console.error('Report error:', e);
      setError(e.message||'Failed to load');
    } finally { setLoading(false); }
  };

  const TABS = [
    {id:'pnl',      label:'📊 P&L'},
    {id:'invoices', label:'🧾 Invoices'},
    {id:'expenses', label:'💸 Expenses'},
    {id:'inventory',label:'📦 Inventory'},
    {id:'growth',   label:'📈 Growth'},
  ];

  /* ── Shared KPI card ── */
  const KPI = ({label,val,color='#2563eb',bg='#eff6ff',icon,isCnt}) => (
    <div style={{background:'#fff',borderRadius:14,padding:'14px 18px',border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(15,23,42,0.05)'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</div>
        {icon&&<div style={{width:32,height:32,borderRadius:9,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{icon}</div>}
      </div>
      <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:22,color}}>{isCnt?val:money(val)}</div>
    </div>
  );

  if(!selectedShop) return (
    <div className="page-container" style={{textAlign:'center',padding:'80px 20px',color:'#94a3b8'}}>
      <div style={{fontSize:48,opacity:0.3,marginBottom:12}}>📊</div><p>Select a shop to view reports</p>
    </div>
  );

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:28,color:'#0f172a',margin:0}}>Reports</h1>
          <p style={{color:'#64748b',fontSize:14,margin:'3px 0 0'}}>{selectedShop.name}</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input className="form-input" type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{width:150}}/>
          <span style={{color:'#64748b',fontWeight:600}}>to</span>
          <input className="form-input" type="date" value={to}   onChange={e=>setTo(e.target.value)}   style={{width:150}}/>
          <button className="btn-primary" onClick={load} disabled={loading} style={{whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
            {loading?<><div className="spinner" style={{width:14,height:14,borderTopColor:'#fff'}}/>Loading…</>:'🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:3,background:'#fff',borderRadius:14,padding:4,border:'1.5px solid #e2e8f0',width:'fit-content',marginBottom:24,flexWrap:'wrap',boxShadow:'0 1px 4px rgba(15,23,42,0.06)'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'9px 16px',borderRadius:10,border:'none',cursor:'pointer',background:tab===t.id?'#2563eb':'transparent',color:tab===t.id?'#fff':'#64748b',fontWeight:tab===t.id?700:500,fontSize:13,transition:'all 0.15s',whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div style={{padding:'12px 16px',background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,color:'#dc2626',fontSize:13,marginBottom:20}}>⚠️ {error}</div>}

      {loading ? (
        <div style={{textAlign:'center',padding:'80px 20px'}}><div className="spinner" style={{width:32,height:32,margin:'0 auto'}}/><p style={{color:'#94a3b8',marginTop:16}}>Loading report…</p></div>
      ) : !data ? (
        <div style={{textAlign:'center',padding:'60px 20px',color:'#94a3b8'}}>
          <div style={{fontSize:48,opacity:0.3,marginBottom:12}}>📊</div>
          <p>No data yet. Create invoices to see reports.</p>
        </div>
      ) : (

        /* ════════════════════════════════════ TABS ════════════════════════════════ */
        <>

        {/* ── P&L ── */}
        {tab==='pnl'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12,marginBottom:22}}>
              <KPI label="Total Revenue"    val={data.totalRevenue}   color="#2563eb" bg="#eff6ff"  icon="💰"/>
              <KPI label="Total Received"   val={data.totalReceived}  color="#059669" bg="#ecfdf5"  icon="✅"/>
              <KPI label="Unpaid"           val={data.totalUnpaid}    color="#dc2626" bg="#fef2f2"  icon="⏳"/>
              <KPI label="Total Expenses"   val={data.totalExpenses}  color="#d97706" bg="#fffbeb"  icon="💸"/>
              <KPI label="Purchases"        val={data.totalPurchases} color="#7c3aed" bg="#f5f3ff"  icon="🛍️"/>
              <KPI label="Net Profit"       val={data.netProfit}      color={data.netProfit>=0?'#059669':'#dc2626'} bg={data.netProfit>=0?'#ecfdf5':'#fef2f2'} icon="📊"/>
            </div>

            {/* P&L statement */}
            <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',padding:'22px 24px',marginBottom:20,boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:17,color:'#0f172a',marginBottom:18,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                Profit & Loss Statement
                <span style={{fontSize:12,color:'#64748b',fontWeight:400}}>{from} to {to}</span>
              </div>
              {[
                {label:'(+) Revenue from Invoices',   val:data.totalRevenue,   color:'#059669', bold:false},
                {label:'(−) Cost of Purchases',       val:data.totalPurchases, color:'#dc2626', bold:false},
                {label:'  = Gross Profit',            val:data.grossProfit,    color:data.grossProfit>=0?'#059669':'#dc2626', bold:true},
                {label:'(−) Operating Expenses',      val:data.totalExpenses,  color:'#d97706', bold:false},
                {label:'  = Net Profit / Loss',       val:data.netProfit,      color:data.netProfit>=0?'#059669':'#dc2626', bold:true, big:true},
              ].map((r,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:`${r.big?'14px':r.bold?'10px':'8px'} 0`,borderBottom:i<4?'1px solid #f1f5f9':'none',fontWeight:r.bold?800:400,background:r.big?'#f8faff':'transparent',borderRadius:r.big?10:0,marginTop:r.big?4:0,padding:r.big?'12px 14px':'',paddingBottom:r.big?'12px':''}}>
                  <span style={{color:r.bold?'#0f172a':'#475569',fontSize:r.big?16:r.bold?15:14,paddingLeft:r.label.startsWith(' ')?16:0}}>{r.label.trim()}</span>
                  <span style={{color:r.color,fontWeight:r.bold?800:600,fontSize:r.big?18:r.bold?15:14}}>{money(Math.abs(r.val))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INVOICES ── */}
        {tab==='invoices'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12,marginBottom:22}}>
              <KPI label="Total Invoiced"  val={data.totalRevenue}   color="#2563eb" bg="#eff6ff"  icon="🧾"/>
              <KPI label="Collected"       val={data.totalReceived}  color="#059669" bg="#ecfdf5"  icon="✅"/>
              <KPI label="Pending"         val={data.totalUnpaid}    color="#dc2626" bg="#fef2f2"  icon="⏳"/>
              <KPI label="Invoice Count"   val={data.invoiceCount}   color="#7c3aed" bg="#f5f3ff"  icon="🔢" isCnt/>
              <KPI label="Paid Invoices"   val={data.paidCount}      color="#059669" bg="#ecfdf5"  icon="✓"  isCnt/>
              <KPI label="Avg Invoice"     val={data.invoiceCount>0?Math.round(data.totalRevenue/data.invoiceCount):0} color="#0891b2" bg="#ecfeff" icon="📐"/>
            </div>

            {/* Daily trend */}
            {data.dailyData.length>0&&(
              <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',padding:'20px 22px',marginBottom:20,boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',marginBottom:16}}>Daily Revenue Trend</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.dailyData}>
                    <defs>
                      <linearGradient id="blueG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="date" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                    <Tooltip content={<Tip/>}/>
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" fill="url(#blueG)" strokeWidth={2.5} dot={{r:3,fill:'#2563eb'}} activeDot={{r:6}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              {/* Category breakdown */}
              {data.catData.length>0&&(
                <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',marginBottom:16}}>Sales by Category</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data.catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={3}
                        label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {data.catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip content={<Tip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Payment mode */}
              {data.payData.length>0&&(
                <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',padding:'20px',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',marginBottom:16}}>By Payment Mode</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data.payData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={3}
                        label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {data.payData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip content={<Tip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Top items */}
            {data.topItems.length>0&&(
              <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
                <div style={{padding:'16px 20px',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',borderBottom:'1px solid #f1f5f9'}}>Top Selling Items</div>
                {data.topItems.map((item,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 20px',borderBottom:'1px solid #f8faff'}}>
                    <div style={{width:26,height:26,borderRadius:8,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:12,color:'#2563eb',flexShrink:0}}>
                      {i+1}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,color:'#0f172a',fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.name}</div>
                      <div style={{height:4,borderRadius:2,background:'#f1f5f9',marginTop:5,overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:2,background:COLORS[i%COLORS.length],width:`${data.topItems[0].value>0?(item.value/data.topItems[0].value*100):0}%`}}/>
                      </div>
                    </div>
                    <div style={{fontWeight:800,color:'#2563eb',fontSize:15,flexShrink:0}}>{money(item.value)}</div>
                    <div style={{fontSize:12,color:'#94a3b8',flexShrink:0,minWidth:40,textAlign:'right'}}>
                      {data.totalRevenue>0?(item.value/data.totalRevenue*100).toFixed(1):0}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── EXPENSES ── */}
        {tab==='expenses'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12,marginBottom:22}}>
              <KPI label="Total Expenses"  val={data.totalExpenses}  color="#d97706" bg="#fffbeb"  icon="💸"/>
              <KPI label="Total Purchases" val={data.totalPurchases} color="#dc2626" bg="#fef2f2"  icon="🛍️"/>
              <KPI label="Purchase Paid"   val={data.purchasePaid}   color="#059669" bg="#ecfdf5"  icon="✅"/>
              <KPI label="Purchase Due"    val={data.purchaseDue}    color="#dc2626" bg="#fef2f2"  icon="⏳"/>
            </div>

            {data.expDailyData.length>0&&(
              <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',padding:'20px 22px',marginBottom:20,boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',marginBottom:16}}>Daily Expenses</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.expDailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="date" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="amount" name="Expenses" fill="#d97706" radius={[5,5,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {data.expCatData.length>0&&(
              <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
                <div style={{padding:'16px 20px',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',borderBottom:'1px solid #f1f5f9'}}>Expense Breakdown</div>
                {data.expCatData.map((c,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 20px',borderBottom:'1px solid #f8faff'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,color:'#0f172a',fontSize:14,marginBottom:5}}>{c.name}</div>
                      <div style={{height:5,borderRadius:3,background:'#f1f5f9',overflow:'hidden'}}>
                        <div style={{height:'100%',background:COLORS[i%COLORS.length],borderRadius:3,width:`${data.totalExpenses>0?(c.value/data.totalExpenses*100):0}%`}}/>
                      </div>
                    </div>
                    <div style={{fontWeight:800,color:'#d97706',fontSize:15,flexShrink:0}}>{money(c.value)}</div>
                    <div style={{fontSize:12,color:'#94a3b8',minWidth:40,textAlign:'right',flexShrink:0}}>
                      {data.totalExpenses>0?(c.value/data.totalExpenses*100).toFixed(1):0}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INVENTORY ── */}
        {tab==='inventory'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:22}}>
              <KPI label="Stock Purchase Value" val={data.stockValue}   color="#2563eb" bg="#eff6ff" icon="📦"/>
              <KPI label="Stock Selling Value"  val={data.sellingValue} color="#059669" bg="#ecfdf5" icon="💰"/>
              <KPI label="Potential Profit"     val={data.sellingValue-data.stockValue} color="#7c3aed" bg="#f5f3ff" icon="💹"/>
              <KPI label="Purchases (Period)"   val={data.totalPurchases} color="#d97706" bg="#fffbeb" icon="🛍️"/>
            </div>

            {/* Stock levels notice */}
            <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'12px 16px',marginBottom:20,fontSize:13,color:'#1d4ed8'}}>
              ℹ️ Stock levels reflect current counts. Go to <strong>Items → Stock Management</strong> for full inventory details and movement history.
            </div>
          </div>
        )}

        {/* ── GROWTH ── */}
        {tab==='growth'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:22}}>
              {[
                {label:'Revenue Growth',  val:data.growthRevenue,  pos:parseFloat(data.growthRevenue)>=0,   icon:'📈', prev:data.prevRevenue,  curr:data.totalRevenue},
                {label:'Expense Change',  val:data.growthExpenses, pos:parseFloat(data.growthExpenses)<=0,  icon:'📉', prev:data.prevExpense,  curr:data.totalExpenses},
              ].map(k=>(
                <div key={k.label} style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',padding:'22px',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
                  <div style={{fontSize:24,marginBottom:10}}>{k.icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>{k.label} vs previous period</div>
                  {k.val!==null ? (
                    <div style={{fontFamily:'Syne,sans-serif',fontWeight:900,fontSize:32,color:k.pos?'#059669':'#dc2626'}}>
                      {parseFloat(k.val)>=0?'+':''}{k.val}%
                    </div>
                  ) : (
                    <div style={{color:'#94a3b8',fontSize:15}}>No previous data</div>
                  )}
                  <div style={{marginTop:10,fontSize:13,color:'#64748b'}}>
                    <span>Previous: <strong>{money(k.prev)}</strong></span>
                    <span style={{marginLeft:16}}>Current: <strong style={{color:'#0f172a'}}>{money(k.curr)}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary table */}
            <div style={{background:'#fff',borderRadius:18,border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 2px 10px rgba(15,23,42,0.05)'}}>
              <div style={{padding:'16px 20px',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'#0f172a',borderBottom:'1px solid #f1f5f9'}}>Period Summary</div>
              {[
                {label:'Invoiced (Total)',   val:data.totalRevenue,   color:'#2563eb'},
                {label:'Collected (Paid)',   val:data.totalReceived,  color:'#059669'},
                {label:'Pending (Unpaid)',   val:data.totalUnpaid,    color:'#dc2626'},
                {label:'Operating Expenses', val:data.totalExpenses,  color:'#d97706'},
                {label:'Purchases',          val:data.totalPurchases, color:'#7c3aed'},
                {label:'Net Profit / Loss',  val:data.netProfit,      color:data.netProfit>=0?'#059669':'#dc2626'},
              ].map((r,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'12px 20px',borderBottom:'1px solid #f8faff'}}>
                  <span style={{fontSize:14,color:'#475569',fontWeight:500}}>{r.label}</span>
                  <span style={{fontWeight:800,color:r.color,fontSize:15}}>{money(r.val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        </>
      )}
    </div>
  );
}
