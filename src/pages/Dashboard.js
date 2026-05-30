import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  CreditCard, AlertCircle, ArrowRight, RefreshCw,
  FileText, DollarSign, ShoppingBag, Activity
} from 'lucide-react';

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const fmtK = n => { const v=Number(n||0); return v>=100000?`₹${(v/100000).toFixed(1)}L`:v>=1000?`₹${(v/1000).toFixed(1)}k`:fmt(v); };
const CHART_COLORS = ['#1a56db','#7c3aed','#059669','#dc2626','#d97706','#0e7490','#be185d','#374151'];

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'10px 14px',fontSize:13,boxShadow:'0 4px 20px rgba(13,27,46,0.12)'}}>
      <div style={{color:'#6b7280',fontWeight:600,marginBottom:5,fontSize:12}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,fontWeight:700,fontSize:13}}>
          {p.name}: {typeof p.value==='number'&&p.value>100?fmt(p.value):p.value}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { selectedShop, userShops, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(()=>{ if(selectedShop) load(); else setLoading(false); },[selectedShop]);

  const load = async () => {
    setLoading(true);
    try {
      const sid = selectedShop.id;
      const last7 = Array.from({length:7},(_,i)=>format(subDays(new Date(),6-i),'yyyy-MM-dd'));

      const [invSnap, expSnap, purSnap, recentInvSnap] = await Promise.all([
        getDocs(collection(db,'shops',sid,'invoices')),
        getDocs(collection(db,'shops',sid,'expenses')),
        getDocs(collection(db,'shops',sid,'purchases')),
        getDocs(query(collection(db,'shops',sid,'invoices'),orderBy('createdAt','desc'),limit(6))),
      ]);

      const allInvoices = invSnap.docs.map(d=>d.data());
      const allExpenses = expSnap.docs.map(d=>d.data());
      const allPurchases= purSnap.docs.map(d=>d.data());

      const inRange = (d,f,t)=>d>=f&&d<=t;
      const todayInv = allInvoices.filter(d=>d.date===today);
      const todayExp = allExpenses.filter(d=>d.date===today);
      const todayPur = allPurchases.filter(d=>d.date===today);
      const week7Inv  = allInvoices.filter(d=>inRange(d.date||'',last7[0],last7[6]));

      // Today metrics
      const todayRevenue  = todayInv.reduce((s,d)=>s+(d.grandTotal||0),0);
      const todayReceived = todayInv.filter(d=>d.status==='paid').reduce((s,d)=>s+(d.grandTotal||0),0);
      const todayExpenses = todayExp.reduce((s,d)=>s+(d.amount||0),0);
      const todayPurchases= todayPur.reduce((s,d)=>s+(d.totalAmount||0),0);
      const netProfitToday= todayRevenue - todayExpenses - todayPurchases;

      // Month totals
      const monthPrefix = format(new Date(),'yyyy-MM');
      const monthInv = allInvoices.filter(d=>(d.date||'').startsWith(monthPrefix));
      const monthExp = allExpenses.filter(d=>(d.date||'').startsWith(monthPrefix));
      const monthPur = allPurchases.filter(d=>(d.date||'').startsWith(monthPrefix));
      const monthRevenue  = monthInv.reduce((s,d)=>s+(d.grandTotal||0),0);
      const monthExpenses = monthExp.reduce((s,d)=>s+(d.amount||0),0);
      const monthPurchases= monthPur.reduce((s,d)=>s+(d.totalAmount||0),0);
      const monthProfit   = monthRevenue - monthExpenses - monthPurchases;

      // Unpaid invoices
      const unpaidTotal = allInvoices.filter(d=>d.status!=='paid').reduce((s,d)=>s+(d.grandTotal||0),0);
      const unpaidCount = allInvoices.filter(d=>d.status!=='paid').length;

      // 7-day daily trend
      const dailyMap = {};
      last7.forEach(d=>dailyMap[d]=0);
      week7Inv.forEach(inv=>{if(dailyMap[inv.date]!==undefined)dailyMap[inv.date]+=(inv.grandTotal||0);});
      const dailyData = last7.map(d=>({date:d.slice(5),revenue:dailyMap[d]||0}));
      const weekRevenue = Object.values(dailyMap).reduce((a,b)=>a+b,0);

      // Payment method split (paid invoices this month)
      const payMap={};
      monthInv.filter(d=>d.status==='paid').forEach(inv=>{
        const m=inv.paymentMode||'Cash';
        payMap[m]=(payMap[m]||0)+(inv.grandTotal||0);
      });
      const payData = Object.entries(payMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,5);

      // Top items this month
      const itemMap={};
      monthInv.forEach(inv=>(inv.items||[]).forEach(i=>{if(i.itemName){itemMap[i.itemName]=(itemMap[i.itemName]||0)+(i.amount||0);}}));
      const topItems = Object.entries(itemMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,5);

      // Recent invoices
      const recentInvoices = recentInvSnap.docs.map(d=>({id:d.id,...d.data()}));

      // Previous month for comparison
      const prevMonth = format(subDays(new Date(monthPrefix+'-01'),1),'yyyy-MM');
      const prevInv = allInvoices.filter(d=>(d.date||'').startsWith(prevMonth));
      const prevRevenue = prevInv.reduce((s,d)=>s+(d.grandTotal||0),0);
      const revGrowth = prevRevenue>0 ? (((monthRevenue-prevRevenue)/prevRevenue)*100).toFixed(0) : null;

      setData({
        todayRevenue, todayReceived, todayExpenses, todayPurchases, netProfitToday,
        monthRevenue, monthExpenses, monthPurchases, monthProfit,
        weekRevenue, unpaidTotal, unpaidCount,
        dailyData, payData, topItems, recentInvoices, revGrowth,
      });
    } catch(e){ console.error(e); }
    finally{ setLoading(false); }
  };

  /* ── KPI card component ── */
  const KpiCard = ({label, value, sub, icon:Icon, iconColor, iconBg, trend, trendUp, onClick, accent}) => (
    <div
      onClick={onClick}
      style={{
        background:'#fff',
        borderRadius:16,
        padding:'20px 20px 18px',
        border:'1px solid #e5e7eb',
        boxShadow:'0 1px 4px rgba(13,27,46,0.05),0 2px 8px rgba(13,27,46,0.04)',
        cursor:onClick?'pointer':'default',
        transition:'all 0.18s',
        position:'relative',
        overflow:'hidden',
      }}
      onMouseEnter={e=>{ if(onClick){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 4px 20px rgba(13,27,46,0.10),0 1px 4px rgba(13,27,46,0.06)';e.currentTarget.style.borderColor='#bfdbfe';}}}
      onMouseLeave={e=>{ if(onClick){e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 1px 4px rgba(13,27,46,0.05),0 2px 8px rgba(13,27,46,0.04)';e.currentTarget.style.borderColor='#e5e7eb';}}}
    >
      {/* Accent line */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:accent||'transparent',borderRadius:'16px 16px 0 0'}}/>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
        <div style={{width:40,height:40,borderRadius:12,background:iconBg||'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {Icon && <Icon size={18} color={iconColor||'#1a56db'} strokeWidth={2.2}/>}
        </div>
        {trend!==null&&trend!==undefined&&(
          <div style={{display:'flex',alignItems:'center',gap:3,padding:'3px 8px',borderRadius:20,background:trendUp?'#ecfdf5':'#fef2f2',fontSize:11.5,fontWeight:700,color:trendUp?'#047857':'#b91c1c'}}>
            {trendUp?<TrendingUp size={11}/>:<TrendingDown size={11}/>}
            {trendUp?'+':''}{trend}%
          </div>
        )}
      </div>

      <div style={{fontSize:11.5,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>{label}</div>
      <div style={{fontFamily:'Plus Jakarta Sans,Inter,sans-serif',fontWeight:800,fontSize:26,color:'#0d1b2e',letterSpacing:'-0.5px',lineHeight:1}}>{fmtK(value)}</div>
      {sub&&<div style={{fontSize:12.5,color:'#9ca3af',marginTop:6}}>{sub}</div>}
    </div>
  );

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="page-container fade-in">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28}}>
        <div>
          <div style={{width:160,height:28,borderRadius:8,background:'#e5e7eb',marginBottom:8}} className="skeleton"/>
          <div style={{width:220,height:16,borderRadius:6,background:'#f3f4f6'}} className="skeleton"/>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        {[0,1,2,3,4,5,6,7].map(i=><div key={i} style={{height:120,borderRadius:16,background:'#f3f4f6'}} className="skeleton"/>)}
      </div>
    </div>
  );

  /* ── No shop state ── */
  if (!selectedShop) return (
    <div className="page-container fade-in">
      <div style={{background:'linear-gradient(135deg,#1a3a87,#1a56db)',borderRadius:24,padding:'52px 40px',textAlign:'center',color:'#fff',boxShadow:'0 8px 40px rgba(26,86,219,0.35)'}}>
        <div style={{fontSize:56,marginBottom:18}}>🍺</div>
        <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:26,marginBottom:10,letterSpacing:'-0.4px'}}>Welcome to Siruvani POS</div>
        <div style={{fontSize:15,opacity:0.75,marginBottom:28,maxWidth:400,margin:'0 auto 28px'}}>{isSuperAdmin?'Create your first shop to start managing your business':'Contact your administrator to get shop access'}</div>
        {isSuperAdmin&&<button onClick={()=>navigate('/shops')} style={{padding:'12px 28px',background:'#fff',color:'#1a56db',border:'none',borderRadius:12,fontWeight:800,fontSize:15,cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,0.15)'}}>Create Your First Shop →</button>}
      </div>
    </div>
  );

  /* ── Empty data ── */
  if (!data) return (
    <div className="page-container fade-in">
      <div style={{textAlign:'center',padding:'80px 20px',color:'#9ca3af'}}>
        <Activity size={48} style={{opacity:0.3,marginBottom:16}}/>
        <p style={{fontSize:15}}>No data yet — start creating invoices to see your dashboard.</p>
        <button className="btn-primary" onClick={()=>navigate('/invoices')} style={{marginTop:16,display:'inline-flex',alignItems:'center',gap:8}}>
          <FileText size={14}/> Create Invoice
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-container fade-in">
      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:26,color:'#0d1b2e',margin:0,letterSpacing:'-0.5px'}}>
            Dashboard
          </h1>
          <p style={{color:'#6b7280',fontSize:14,margin:'4px 0 0'}}>
            {selectedShop.name} &nbsp;·&nbsp; {format(new Date(),'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <button onClick={load} style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',borderRadius:10,border:'1.5px solid #e5e7eb',background:'#fff',color:'#374151',cursor:'pointer',fontSize:13.5,fontWeight:600,boxShadow:'0 1px 4px rgba(13,27,46,0.06)',transition:'all 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#bfdbfe';e.currentTarget.style.color='#1a56db';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.color='#374151';}}>
          <RefreshCw size={13}/> Refresh
        </button>
      </div>

      {/* ── TODAY KPIs ── */}
      <div style={{marginBottom:4}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.1em'}}>Today's Summary</div>
          <div style={{flex:1,height:1,background:'linear-gradient(90deg,#e5e7eb,transparent)'}}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14,marginBottom:24}}>
          <KpiCard label="Revenue"  value={data.todayRevenue}   sub="Invoiced today"          icon={DollarSign}  iconColor="#1a56db" iconBg="#eff6ff"  accent="#1a56db"/>
          <KpiCard label="Collected" value={data.todayReceived} sub="Payments received"       icon={CreditCard}  iconColor="#047857" iconBg="#ecfdf5"  accent="#059669"/>
          <KpiCard label="Expenses" value={data.todayExpenses}  sub="Operating costs"         icon={TrendingDown} iconColor="#b91c1c" iconBg="#fef2f2" accent="#dc2626"/>
          <KpiCard label="Purchases" value={data.todayPurchases} sub="Vendor purchases"       icon={ShoppingBag} iconColor="#b45309" iconBg="#fffbeb"  accent="#d97706"/>
        </div>
      </div>

      {/* ── MONTH KPIs ── */}
      <div style={{marginBottom:4}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.1em'}}>This Month</div>
          <div style={{flex:1,height:1,background:'linear-gradient(90deg,#e5e7eb,transparent)'}}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14,marginBottom:28}}>
          <KpiCard label="Monthly Revenue"  value={data.monthRevenue}   sub={`${format(new Date(),'MMMM')} total`} icon={Activity}     iconColor="#1a56db" iconBg="#eff6ff"  accent="#1a56db" trend={data.revGrowth} trendUp={parseFloat(data.revGrowth)>=0} onClick={()=>navigate('/reports')}/>
          <KpiCard label="Monthly Expenses" value={data.monthExpenses}  sub="All expense types"  icon={TrendingDown} iconColor="#b91c1c" iconBg="#fef2f2"  accent="#dc2626"/>
          <KpiCard label="Net Profit"       value={data.monthProfit}    sub="Revenue − costs"    icon={TrendingUp}   iconColor={data.monthProfit>=0?"#047857":"#b91c1c"} iconBg={data.monthProfit>=0?"#ecfdf5":"#fef2f2"} accent={data.monthProfit>=0?'#059669':'#dc2626'}/>
          <KpiCard label="Unpaid Invoices"  value={data.unpaidTotal}    sub={`${data.unpaidCount} invoice${data.unpaidCount!==1?'s':''} pending`} icon={AlertCircle} iconColor="#b45309" iconBg="#fffbeb" accent="#d97706" onClick={()=>navigate('/invoices')}/>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="chart-row" style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20,marginBottom:20}}>

        {/* Revenue trend */}
        <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'22px 24px',boxShadow:'0 1px 4px rgba(13,27,46,0.05),0 2px 8px rgba(13,27,46,0.04)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
            <div>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',letterSpacing:'-0.2px'}}>Revenue Trend</div>
              <div style={{fontSize:12.5,color:'#9ca3af',marginTop:2}}>Last 7 days</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:20,color:'#1a56db',letterSpacing:'-0.3px'}}>{fmtK(data.weekRevenue)}</div>
              <div style={{fontSize:11.5,color:'#9ca3af'}}>7-day total</div>
            </div>
          </div>
          {data.dailyData.every(d=>d.revenue===0) ? (
            <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:14,flexDirection:'column',gap:8,background:'#f9fafb',borderRadius:12}}>
              <Activity size={28} style={{opacity:0.3}}/>
              <span>No billing data yet</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.dailyData} margin={{top:4,right:4,left:-20,bottom:0}}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#1a56db" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#1a56db" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#9ca3af',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v===0?'₹0':`₹${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<ChartTooltip/>}/>
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1a56db" strokeWidth={2.5} fill="url(#areaGrad)" dot={{r:4,fill:'#1a56db',strokeWidth:0}} activeDot={{r:6,fill:'#1a56db',stroke:'#fff',strokeWidth:2}}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment split */}
        <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'22px 24px',boxShadow:'0 1px 4px rgba(13,27,46,0.05),0 2px 8px rgba(13,27,46,0.04)'}}>
          <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',letterSpacing:'-0.2px',marginBottom:4}}>Payment Modes</div>
          <div style={{fontSize:12.5,color:'#9ca3af',marginBottom:18}}>This month (paid)</div>
          {data.payData.length===0 ? (
            <div style={{height:160,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:13,flexDirection:'column',gap:8,background:'#f9fafb',borderRadius:12}}>
              <CreditCard size={24} style={{opacity:0.3}}/>
              <span>No paid invoices</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={data.payData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3}>
                    {data.payData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip content={<ChartTooltip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
                {data.payData.map((item,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                    <span style={{flex:1,color:'#374151',fontWeight:500}}>{item.name}</span>
                    <span style={{fontWeight:700,color:'#0d1b2e'}}>{fmtK(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="chart-row" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

        {/* Recent invoices */}
        <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 4px rgba(13,27,46,0.05),0 2px 8px rgba(13,27,46,0.04)'}}>
          <div style={{padding:'18px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #f3f4f6'}}>
            <div>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',letterSpacing:'-0.2px'}}>Recent Invoices</div>
              <div style={{fontSize:12,color:'#9ca3af',marginTop:1}}>Latest transactions</div>
            </div>
            <button onClick={()=>navigate('/invoices')} style={{display:'flex',alignItems:'center',gap:4,fontSize:12.5,color:'#1a56db',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontWeight:600}}>
              View all <ArrowRight size={11}/>
            </button>
          </div>
          {data.recentInvoices.length===0 ? (
            <div style={{padding:'40px 20px',textAlign:'center',color:'#9ca3af',fontSize:13}}>
              <FileText size={28} style={{opacity:0.25,marginBottom:8}}/>
              <p>No invoices yet</p>
            </div>
          ) : data.recentInvoices.map((inv,i)=>(
            <div key={inv.id} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 22px',borderBottom:i<data.recentInvoices.length-1?'1px solid #f9fafb':'none',transition:'background 0.1s',cursor:'pointer'}}
              onClick={()=>navigate('/invoices')}
              onMouseEnter={e=>e.currentTarget.style.background='#f8faff'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{width:36,height:36,borderRadius:10,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <FileText size={15} color="#1a56db"/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13.5,color:'#0d1b2e',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{inv.customerName||'Walk-in'}</div>
                <div style={{fontSize:11.5,color:'#9ca3af',marginTop:1,fontFamily:'monospace'}}>{inv.number} · {inv.date}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:15,color:'#0d1b2e'}}>{fmtK(inv.grandTotal)}</div>
                <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:inv.status==='paid'?'#ecfdf5':'#fef2f2',color:inv.status==='paid'?'#047857':'#b91c1c'}}>
                  {inv.status==='paid'?'Paid':'Unpaid'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions + top items */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Quick actions */}
          <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'18px 20px',boxShadow:'0 1px 4px rgba(13,27,46,0.05),0 2px 8px rgba(13,27,46,0.04)'}}>
            <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',letterSpacing:'-0.2px',marginBottom:14}}>Quick Actions</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[
                {label:'New Invoice',  emoji:'🧾', route:'/invoices',    bg:'#eff6ff',  color:'#1a56db',  border:'#bfdbfe'},
                {label:'Quotation',   emoji:'💬', route:'/quotations',  bg:'#f5f3ff',  color:'#6d28d9',  border:'#ddd6fe'},
                {label:'Add Expense', emoji:'💸', route:'/expenses',    bg:'#fef2f2',  color:'#b91c1c',  border:'#fecaca'},
                {label:'New Purchase',emoji:'🛍️', route:'/purchases',   bg:'#fffbeb',  color:'#b45309',  border:'#fde68a'},
                {label:'Inventory',   emoji:'📦', route:'/items',       bg:'#ecfdf5',  color:'#047857',  border:'#a7f3d0'},
                {label:'Day End',     emoji:'🌙', route:'/day-end',     bg:'#f5f3ff',  color:'#6d28d9',  border:'#ddd6fe'},
              ].map(a=>(
                <button key={a.label} onClick={()=>navigate(a.route)}
                  style={{padding:'11px 10px',borderRadius:12,border:`1.5px solid ${a.border}`,background:a.bg,cursor:'pointer',display:'flex',alignItems:'center',gap:8,transition:'all 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 4px 12px ${a.border}`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                  <span style={{fontSize:18}}>{a.emoji}</span>
                  <span style={{fontSize:12.5,fontWeight:700,color:a.color}}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Top items */}
          {data.topItems.length>0&&(
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'18px 20px',boxShadow:'0 1px 4px rgba(13,27,46,0.05),0 2px 8px rgba(13,27,46,0.04)'}}>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',letterSpacing:'-0.2px',marginBottom:14}}>Top Items This Month</div>
              {data.topItems.map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:i<data.topItems.length-1?10:0}}>
                  <div style={{width:22,height:22,borderRadius:7,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:11,color:'#1a56db',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:'#0d1b2e',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:3}}>{item.name}</div>
                    <div style={{height:4,borderRadius:99,background:'#f3f4f6',overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:99,background:CHART_COLORS[i%CHART_COLORS.length],width:`${data.topItems[0].value>0?(item.value/data.topItems[0].value*100):0}%`,transition:'width 0.6s ease'}}/>
                    </div>
                  </div>
                  <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:13,color:'#0d1b2e',flexShrink:0}}>{fmtK(item.value)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
