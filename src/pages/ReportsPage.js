import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, subMonths } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Download, RefreshCw, FileText, TrendingUp, TrendingDown, Package, BarChart2 } from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────── */
const money  = n => `₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const moneyF = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const pct    = (a,b) => b>0?(((a-b)/b)*100).toFixed(1):null;
const safe   = v => isNaN(Number(v))?0:Number(v||0);
const COLORS  = ['#1a56db','#7c3aed','#059669','#dc2626','#d97706','#0e7490','#be185d','#374151','#0f766e','#c026d3'];

const ChartTip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'10px 14px',fontSize:13,boxShadow:'0 4px 20px rgba(13,27,46,0.10)'}}>
      <div style={{color:'#6b7280',fontWeight:600,marginBottom:5,fontSize:12}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,fontWeight:700}}>{p.name}: {typeof p.value==='number'&&p.value>100?money(p.value):p.value}</div>
      ))}
    </div>
  );
};

/* ─── CSV export ──────────────────────────────────────────────── */
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* ─── PDF/Print export ────────────────────────────────────────── */
function printReport(title, htmlContent, shopName) {
  const w = window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a;font-size:13px}
h1{font-size:20px;font-weight:900;margin-bottom:4px;color:#0f172a}
h2{font-size:15px;font-weight:700;margin:20px 0 10px;color:#1e40af;border-bottom:2px solid #dbeafe;padding-bottom:6px}
.meta{color:#6b7280;font-size:12px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
th{background:#f1f5f9;padding:8px 12px;text-align:left;font-weight:700;border:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:0.04em}
td{padding:8px 12px;border:1px solid #e2e8f0;vertical-align:middle}
tr:nth-child(even){background:#f8fafc}
.total-row{background:#eff6ff!important;font-weight:700}
.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center}
.kpi-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px}
.kpi-value{font-size:20px;font-weight:900;color:#0f172a}
.green{color:#059669}.red{color:#dc2626}.blue{color:#1a56db}.amber{color:#d97706}
.pl-row{display:flex;justify-content:space-between;padding:7px 12px;border-bottom:1px solid #f1f5f9}
.pl-row.bold{font-weight:700;background:#f1f5f9;border-radius:6px;margin:4px 0}
.pl-row.total{font-weight:900;font-size:15px;border-top:2px solid #1a1a1a;padding-top:10px;margin-top:6px}
@media print{body{padding:0}}
</style></head><body>
<h1>${title}</h1>
<div class="meta">${shopName} &nbsp;·&nbsp; Generated: ${format(new Date(),'d MMM yyyy, h:mm a')}</div>
${htmlContent}
<div style="margin-top:32px;text-align:center;font-size:11px;color:#9ca3af;border-top:1px dashed #e2e8f0;padding-top:12px">
  Siruvani POS — ${shopName}
</div>
</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(), 600);
}

/* ══════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const { selectedShop } = useAuth();
  const [tab,     setTab]     = useState('pnl');
  const [from,    setFrom]    = useState(format(startOfMonth(new Date()),'yyyy-MM-dd'));
  const [to,      setTo]      = useState(format(new Date(),'yyyy-MM-dd'));
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [exporting,setExporting]=useState(false);

  useEffect(()=>{ if(selectedShop) load(); },[selectedShop,from,to]);

  /* ── Load all data ── */
  const load = useCallback(async () => {
    if(!selectedShop) return;
    setLoading(true); setError('');
    try {
      const sid = selectedShop.id;
      const [invSnap,expSnap,purSnap,invItemSnap] = await Promise.all([
        getDocs(collection(db,'shops',sid,'invoices')),
        getDocs(collection(db,'shops',sid,'expenses')),
        getDocs(collection(db,'shops',sid,'purchases')),
        getDocs(collection(db,'shops',sid,'inventory_items')),
      ]);

      const inR = (d,f=from,t=to) => (d||'')>=f && (d||'')<=t;
      const invoices  = invSnap.docs.map(d=>d.data()).filter(d=>inR(d.date));
      const expenses  = expSnap.docs.map(d=>d.data()).filter(d=>inR(d.date));
      const purchases = purSnap.docs.map(d=>d.data()).filter(d=>inR(d.date));
      const invItems  = invItemSnap.docs.map(d=>({id:d.id,...d.data()}));

      // Revenue
      const totalRevenue  = invoices.reduce((s,d)=>s+safe(d.grandTotal),0);
      const totalReceived = invoices.filter(d=>d.status==='paid').reduce((s,d)=>s+safe(d.grandTotal),0);
      const totalUnpaid   = totalRevenue - totalReceived;

      // Expenses
      const totalExpenses  = expenses.reduce((s,e)=>s+safe(e.amount),0);
      const totalPurchases = purchases.reduce((s,p)=>s+safe(p.totalAmount||p.amount||0),0);
      const purchasePaid   = purchases.reduce((s,p)=>s+safe(p.paidAmount||0),0);
      const purchaseDue    = purchases.reduce((s,p)=>s+safe(p.remainingAmount||0),0);

      // P&L
      const grossProfit = totalRevenue - totalPurchases;
      const netProfit   = grossProfit  - totalExpenses;

      // Daily revenue
      const dailyMap = {};
      invoices.forEach(inv=>{ if(inv.date) dailyMap[inv.date]=(dailyMap[inv.date]||0)+safe(inv.grandTotal); });
      const dailyData = Object.entries(dailyMap).sort(([a],[b])=>a.localeCompare(b)).map(([date,revenue])=>({date:date.slice(5),revenue,fullDate:date}));

      // Category
      const catMap={}, itemMap={};
      invoices.forEach(inv=>(inv.items||[]).forEach(it=>{
        if(!it.itemName) return;
        const amt=safe(it.amount);
        catMap[it.category||'other']=(catMap[it.category||'other']||0)+amt;
        itemMap[it.itemName]=(itemMap[it.itemName]||0)+amt;
      }));
      const catData  = Object.entries(catMap).map(([name,value])=>({name:name.charAt(0).toUpperCase()+name.slice(1),value})).sort((a,b)=>b.value-a.value);
      const topItems = Object.entries(itemMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,10);

      // Payment modes
      const payMap={};
      invoices.filter(d=>d.status==='paid').forEach(inv=>{const m=inv.paymentMode||'Cash';payMap[m]=(payMap[m]||0)+safe(inv.grandTotal);});
      const payData = Object.entries(payMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);

      // Expense by category
      const expCatMap={};
      expenses.forEach(e=>{expCatMap[e.category||'Other']=(expCatMap[e.category||'Other']||0)+safe(e.amount);});
      const expCatData = Object.entries(expCatMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
      const expDailyMap={};
      expenses.forEach(e=>{if(e.date)expDailyMap[e.date]=(expDailyMap[e.date]||0)+safe(e.amount);});
      const expDailyData = Object.entries(expDailyMap).sort(([a],[b])=>a.localeCompare(b)).map(([date,amount])=>({date:date.slice(5),amount}));

      // Inventory value
      const stockPurchaseVal = invItems.reduce((s,i)=>s+safe(i.currentStock)*safe(i.purchasePrice),0);
      const stockSellingVal  = invItems.reduce((s,i)=>s+safe(i.currentStock)*(safe(i.sellingPrice)||safe(i.purchasePrice)),0);

      // Previous period growth
      const days = Math.max(1,Math.ceil((new Date(to)-new Date(from))/86400000));
      const pTo2 = format(new Date(new Date(from).getTime()-86400000),'yyyy-MM-dd');
      const pFrom2=format(new Date(new Date(from).getTime()-days*86400000),'yyyy-MM-dd');
      const allInv = invSnap.docs.map(d=>d.data());
      const allExp = expSnap.docs.map(d=>d.data());
      const prevRev = allInv.filter(d=>inR(d.date,pFrom2,pTo2)).reduce((s,d)=>s+safe(d.grandTotal),0);
      const prevExp = allExp.filter(d=>inR(d.date,pFrom2,pTo2)).reduce((s,d)=>s+safe(d.amount),0);

      // Full invoice list for export
      const invoiceList = invSnap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>inR(d.date)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const expenseList = expSnap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>inR(d.date)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const purchaseList= purSnap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>inR(d.date)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));

      setData({
        totalRevenue,totalReceived,totalUnpaid,
        totalExpenses,totalPurchases,purchasePaid,purchaseDue,
        grossProfit,netProfit,
        stockPurchaseVal,stockSellingVal,
        invoiceCount:invoices.length,
        paidCount:invoices.filter(d=>d.status==='paid').length,
        dailyData,catData,topItems,payData,
        expCatData,expDailyData,
        invItems,
        growthRevenue:pct(totalRevenue,prevRev),
        growthExpenses:pct(totalExpenses,prevExp),
        prevRev,prevExp,
        invoiceList,expenseList,purchaseList,
      });
    } catch(e) {
      console.error(e);
      setError('Failed to load: '+e.message);
    } finally { setLoading(false); }
  },[selectedShop,from,to]);

  /* ══ EXPORT FUNCTIONS ══════════════════════════════════════════ */
  const exportPnLPDF = () => {
    if (!data) return;
    const html = `
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-value blue">${money(data.totalRevenue)}</div></div>
  <div class="kpi"><div class="kpi-label">Expenses</div><div class="kpi-value red">${money(data.totalExpenses)}</div></div>
  <div class="kpi"><div class="kpi-label">Net Profit</div><div class="kpi-value ${data.netProfit>=0?'green':'red'}">${money(data.netProfit)}</div></div>
</div>
<h2>Profit & Loss Statement</h2>
<div style="max-width:480px">
  ${[
    {l:'Revenue from Invoices',v:data.totalRevenue,c:'green',b:false},
    {l:'  — Collected (Paid)',v:data.totalReceived,c:'green',b:false,sub:true},
    {l:'  — Pending (Unpaid)',v:data.totalUnpaid,c:'red',b:false,sub:true},
    {l:'Cost of Purchases (−)',v:data.totalPurchases,c:'red',b:false},
    {l:'Gross Profit (=)',v:data.grossProfit,c:data.grossProfit>=0?'green':'red',b:true},
    {l:'Operating Expenses (−)',v:data.totalExpenses,c:'red',b:false},
    {l:'Net Profit / Loss (=)',v:data.netProfit,c:data.netProfit>=0?'green':'red',b:true},
  ].map(r=>`<div class="pl-row${r.b?' bold':''}${r.b&&r.l.includes('Net')?' total':''}" style="${r.sub?'padding-left:24px':''}"><span style="color:#374151">${r.l}</span><span class="${r.c}">${money(Math.abs(r.v))}</span></div>`).join('')}
</div>
${data.topItems.length>0?`<h2>Top Selling Items</h2>
<table><thead><tr><th>#</th><th>Item Name</th><th>Revenue</th><th>% of Total</th></tr></thead><tbody>
${data.topItems.map((it,i)=>`<tr${i%2===0?'':' style="background:#f8fafc"'}><td>${i+1}</td><td>${it.name}</td><td class="blue">${money(it.value)}</td><td>${data.totalRevenue>0?(it.value/data.totalRevenue*100).toFixed(1):0}%</td></tr>`).join('')}
</tbody></table>`:''}`;
    printReport(`P&L Report — ${from} to ${to}`, html, selectedShop.name);
  };

  const exportInvoicesPDF = () => {
    if(!data) return;
    const html = `
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Invoiced</div><div class="kpi-value blue">${money(data.totalRevenue)}</div></div>
  <div class="kpi"><div class="kpi-label">Collected</div><div class="kpi-value green">${money(data.totalReceived)}</div></div>
  <div class="kpi"><div class="kpi-label">Pending</div><div class="kpi-value red">${money(data.totalUnpaid)}</div></div>
</div>
<h2>Invoice List (${from} to ${to})</h2>
<table><thead><tr><th>Date</th><th>Invoice No.</th><th>Customer</th><th>Items</th><th>Amount</th><th>Payment</th><th>Status</th></tr></thead><tbody>
${data.invoiceList.map((inv,i)=>`<tr${i%2===0?'':' style="background:#f8fafc"'}><td>${inv.date}</td><td style="font-family:monospace">${inv.number||'—'}</td><td>${inv.customerName||'Walk-in'}</td><td>${(inv.items||[]).length}</td><td class="blue" style="font-weight:700">${moneyF(inv.grandTotal)}</td><td>${inv.paymentMode||'—'}</td><td class="${inv.status==='paid'?'green':'red'}">${inv.status==='paid'?'✓ Paid':'⏳ Unpaid'}</td></tr>`).join('')}
<tr class="total-row"><td colspan="4">TOTAL (${data.invoiceList.length} invoices)</td><td class="blue">${moneyF(data.totalRevenue)}</td><td></td><td class="green">${data.paidCount} paid</td></tr>
</tbody></table>`;
    printReport(`Invoice Report — ${from} to ${to}`, html, selectedShop.name);
  };

  const exportExpensesPDF = () => {
    if(!data) return;
    const html = `
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Expenses</div><div class="kpi-value red">${money(data.totalExpenses)}</div></div>
  <div class="kpi"><div class="kpi-label">Entries</div><div class="kpi-value">${data.expenseList.length}</div></div>
  <div class="kpi"><div class="kpi-label">Daily Avg</div><div class="kpi-value amber">${money(data.expenseList.length>0?data.totalExpenses/Math.max(1,Object.keys(data.expDailyData||{}).length):0)}</div></div>
</div>
<h2>Expense Breakdown by Category</h2>
<table><thead><tr><th>Category</th><th>Amount</th><th>% Share</th></tr></thead><tbody>
${data.expCatData.map((c,i)=>`<tr${i%2===0?'':' style="background:#f8fafc"'}><td>${c.name}</td><td class="red" style="font-weight:700">${money(c.value)}</td><td>${data.totalExpenses>0?(c.value/data.totalExpenses*100).toFixed(1):0}%</td></tr>`).join('')}
<tr class="total-row"><td>TOTAL</td><td class="red">${money(data.totalExpenses)}</td><td>100%</td></tr>
</tbody></table>
<h2>Expense List (${from} to ${to})</h2>
<table><thead><tr><th>Date</th><th>Category</th><th>Sub-Category</th><th>Amount</th><th>Payment</th><th>Paid To</th></tr></thead><tbody>
${data.expenseList.map((e,i)=>`<tr${i%2===0?'':' style="background:#f8fafc"'}><td>${e.date}</td><td>${e.category||'—'}</td><td>${e.subCategory||'—'}</td><td class="red" style="font-weight:700">${moneyF(e.amount)}</td><td>${e.paymentMode||'—'}</td><td>${e.paidTo||'—'}</td></tr>`).join('')}
<tr class="total-row"><td colspan="3">TOTAL</td><td class="red">${moneyF(data.totalExpenses)}</td><td colspan="2"></td></tr>
</tbody></table>`;
    printReport(`Expenses Report — ${from} to ${to}`, html, selectedShop.name);
  };

  const exportPurchasesPDF = () => {
    if(!data) return;
    const html = `
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Purchased</div><div class="kpi-value amber">${money(data.totalPurchases)}</div></div>
  <div class="kpi"><div class="kpi-label">Paid</div><div class="kpi-value green">${money(data.purchasePaid)}</div></div>
  <div class="kpi"><div class="kpi-label">Balance Due</div><div class="kpi-value red">${money(data.purchaseDue)}</div></div>
</div>
<h2>Purchase List (${from} to ${to})</h2>
<table><thead><tr><th>Date</th><th>Vendor</th><th>Invoice No.</th><th>Items</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead><tbody>
${data.purchaseList.map((p,i)=>`<tr${i%2===0?'':' style="background:#f8fafc"'}><td>${p.date}</td><td style="font-weight:700">${p.vendorName||'—'}</td><td style="font-family:monospace">${p.invoiceNo||'—'}</td><td>${(p.items||[]).length}</td><td class="amber" style="font-weight:700">${moneyF(p.totalAmount||0)}</td><td class="green">${moneyF(p.paidAmount||0)}</td><td class="red">${moneyF(p.remainingAmount||0)}</td><td class="${p.status==='paid'?'green':p.status==='partial'?'amber':'red'}">${p.status||'—'}</td></tr>`).join('')}
<tr class="total-row"><td colspan="4">TOTAL</td><td class="amber">${moneyF(data.totalPurchases)}</td><td class="green">${moneyF(data.purchasePaid)}</td><td class="red">${moneyF(data.purchaseDue)}</td><td></td></tr>
</tbody></table>`;
    printReport(`Purchases Report — ${from} to ${to}`, html, selectedShop.name);
  };

  const exportInventoryPDF = () => {
    if(!data) return;
    const html = `
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Stock (Purchase Value)</div><div class="kpi-value blue">${money(data.stockPurchaseVal)}</div></div>
  <div class="kpi"><div class="kpi-label">Stock (Selling Value)</div><div class="kpi-value green">${money(data.stockSellingVal)}</div></div>
  <div class="kpi"><div class="kpi-label">Potential Profit</div><div class="kpi-value">${money(data.stockSellingVal-data.stockPurchaseVal)}</div></div>
</div>
<h2>Current Stock Levels</h2>
<table><thead><tr><th>Item Name</th><th>Category</th><th>Stock</th><th>Unit</th><th>Purchase Price</th><th>Selling Price</th><th>Stock Value</th><th>Status</th></tr></thead><tbody>
${data.invItems.map((it,i)=>{const isLow=(it.currentStock||0)<=(it.minStock||5);const isOut=(it.currentStock||0)===0;return`<tr${i%2===0?'':' style="background:#f8fafc"'}><td style="font-weight:700">${it.name}</td><td>${it.category||'—'}</td><td style="font-weight:700;color:${isOut?'#dc2626':isLow?'#d97706':'#059669'}">${it.currentStock||0}</td><td>${it.unit||'—'}</td><td>${moneyF(it.purchasePrice||0)}</td><td>${moneyF(it.sellingPrice||it.purchasePrice||0)}</td><td class="blue" style="font-weight:700">${money((it.currentStock||0)*(it.purchasePrice||0))}</td><td class="${isOut?'red':isLow?'amber':'green'}">${isOut?'Out of Stock':isLow?'Low Stock':'In Stock'}</td></tr>`;}).join('')}
<tr class="total-row"><td colspan="6">TOTAL STOCK VALUE</td><td class="blue">${money(data.stockPurchaseVal)}</td><td></td></tr>
</tbody></table>`;
    printReport(`Inventory Report`, html, selectedShop.name);
  };

  /* CSV exports */
  const exportInvoicesCSV = () => {
    if(!data) return;
    const rows = [
      ['Date','Invoice No','Customer','Customer Phone','Items','Subtotal','GST','Discount','Grand Total','Payment Mode','Status','Notes'],
      ...data.invoiceList.map(inv=>[
        inv.date||'',inv.number||'',inv.customerName||'Walk-in',inv.customerPhone||'',
        (inv.items||[]).length,
        safe(inv.subtotal).toFixed(2),safe(inv.gstTotal).toFixed(2),safe(inv.discountAmt).toFixed(2),
        safe(inv.grandTotal).toFixed(2),inv.paymentMode||'',inv.status||'',inv.notes||'',
      ]),
      ['','','','','TOTAL','','','',data.totalRevenue.toFixed(2),'','',''],
    ];
    downloadCSV(rows, `invoices_${from}_to_${to}.csv`);
  };

  const exportExpensesCSV = () => {
    if(!data) return;
    const rows = [
      ['Date','Category','Sub-Category','Amount','Payment Mode','Paid To','Notes'],
      ...data.expenseList.map(e=>[e.date||'',e.category||'',e.subCategory||'',safe(e.amount).toFixed(2),e.paymentMode||'',e.paidTo||'',e.notes||'']),
      ['TOTAL','','',data.totalExpenses.toFixed(2),'','',''],
    ];
    downloadCSV(rows, `expenses_${from}_to_${to}.csv`);
  };

  const exportPurchasesCSV = () => {
    if(!data) return;
    const rows = [
      ['Date','Vendor','Invoice No','Items Count','Total Amount','Paid Amount','Balance Due','Payment Mode','Status','Notes'],
      ...data.purchaseList.map(p=>[p.date||'',p.vendorName||'',p.invoiceNo||'',(p.items||[]).length,safe(p.totalAmount).toFixed(2),safe(p.paidAmount).toFixed(2),safe(p.remainingAmount).toFixed(2),p.paymentMode||'',p.status||'',p.notes||'']),
      ['TOTAL','','','',data.totalPurchases.toFixed(2),data.purchasePaid.toFixed(2),data.purchaseDue.toFixed(2),'','',''],
    ];
    downloadCSV(rows, `purchases_${from}_to_${to}.csv`);
  };

  const exportInventoryCSV = () => {
    if(!data) return;
    const rows = [
      ['Item Name','Category','Current Stock','Unit','Min Stock','Purchase Price','Selling Price','Stock Value (Purchase)','Stock Value (Selling)','Status'],
      ...data.invItems.map(it=>[
        it.name||'',it.category||'',it.currentStock||0,it.unit||'',it.minStock||5,
        safe(it.purchasePrice).toFixed(2),safe(it.sellingPrice||it.purchasePrice).toFixed(2),
        ((it.currentStock||0)*safe(it.purchasePrice)).toFixed(2),
        ((it.currentStock||0)*safe(it.sellingPrice||it.purchasePrice)).toFixed(2),
        (it.currentStock||0)===0?'Out of Stock':(it.currentStock||0)<=(it.minStock||5)?'Low Stock':'In Stock',
      ]),
      ['','','','','','','TOTAL PURCHASE VALUE',data.stockPurchaseVal.toFixed(2),data.stockSellingVal.toFixed(2),''],
    ];
    downloadCSV(rows, `inventory_${format(new Date(),'yyyy-MM-dd')}.csv`);
  };

  const exportPnLCSV = () => {
    if(!data) return;
    const rows = [
      ['Metric','Amount (₹)'],
      ['Revenue from Invoices', data.totalRevenue.toFixed(2)],
      ['  Collected (Paid)',    data.totalReceived.toFixed(2)],
      ['  Pending (Unpaid)',    data.totalUnpaid.toFixed(2)],
      ['Cost of Purchases',     data.totalPurchases.toFixed(2)],
      ['Gross Profit',          data.grossProfit.toFixed(2)],
      ['Operating Expenses',    data.totalExpenses.toFixed(2)],
      ['Net Profit / Loss',     data.netProfit.toFixed(2)],
      ['',''],
      ['Top Items','Revenue'],
      ...data.topItems.map(it=>[it.name, it.value.toFixed(2)]),
    ];
    downloadCSV(rows, `pnl_${from}_to_${to}.csv`);
  };

  /* ── Tab export map ── */
  const EXPORT_ACTIONS = {
    pnl:       { pdf:exportPnLPDF,       csv:exportPnLCSV,        label:'P&L Report'    },
    invoices:  { pdf:exportInvoicesPDF,  csv:exportInvoicesCSV,   label:'Invoices'      },
    expenses:  { pdf:exportExpensesPDF,  csv:exportExpensesCSV,   label:'Expenses'      },
    purchases: { pdf:exportPurchasesPDF, csv:exportPurchasesCSV,  label:'Purchases'     },
    inventory: { pdf:exportInventoryPDF, csv:exportInventoryCSV,  label:'Inventory'     },
  };

  /* ── UI helpers ── */
  const KPI = ({label,val,color,bg,icon,isCnt}) => (
    <div style={{background:'#fff',borderRadius:14,padding:'16px 18px',border:'1px solid #e5e7eb',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em'}}>{label}</div>
        <div style={{width:30,height:30,borderRadius:9,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>{icon}</div>
      </div>
      <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:22,color}}>{isCnt?val:money(val)}</div>
    </div>
  );

  const TABS = [
    {id:'pnl',       label:'P & L',     icon:'📊'},
    {id:'invoices',  label:'Invoices',  icon:'🧾'},
    {id:'expenses',  label:'Expenses',  icon:'💸'},
    {id:'purchases', label:'Purchases', icon:'🛍️'},
    {id:'inventory', label:'Inventory', icon:'📦'},
    {id:'growth',    label:'Growth',    icon:'📈'},
  ];

  const ea = EXPORT_ACTIONS[tab];

  if (!selectedShop) return (
    <div className="page-container fade-in" style={{textAlign:'center',padding:'80px 20px',color:'#9ca3af'}}>
      <BarChart2 size={48} style={{opacity:0.2,marginBottom:12}}/><p>Select a shop to view reports</p>
    </div>
  );

  return (
    <div className="page-container fade-in">
      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:26,color:'#0d1b2e',margin:0,letterSpacing:'-0.4px'}}>Reports</h1>
          <p style={{color:'#6b7280',fontSize:14,margin:'4px 0 0'}}>{selectedShop.name}</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* Date range */}
          <div style={{display:'flex',gap:6,alignItems:'center',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'7px 12px',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
            <input style={{border:'none',outline:'none',fontSize:13,color:'#374151',width:130,fontFamily:'Inter,sans-serif'}} type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
            <span style={{color:'#d1d5db',fontWeight:700}}>—</span>
            <input style={{border:'none',outline:'none',fontSize:13,color:'#374151',width:130,fontFamily:'Inter,sans-serif'}} type="date" value={to} onChange={e=>setTo(e.target.value)}/>
          </div>
          {/* Refresh */}
          <button onClick={load} disabled={loading} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:10,border:'1.5px solid #e5e7eb',background:'#fff',color:'#374151',cursor:'pointer',fontSize:13,fontWeight:600,boxShadow:'0 1px 4px rgba(13,27,46,0.05)',transition:'all 0.15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#bfdbfe';e.currentTarget.style.color='#1a56db';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.color='#374151';}}>
            <RefreshCw size={13} style={{animation:loading?'spin 0.7s linear infinite':''}}/>
            {loading?'Loading…':'Refresh'}
          </button>
          {/* Export buttons — only for reportable tabs */}
          {ea && data && (<>
            <button onClick={ea.csv} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:10,border:'1.5px solid #a7f3d0',background:'#ecfdf5',color:'#059669',cursor:'pointer',fontSize:13,fontWeight:600,transition:'all 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='#d1fae5'}
              onMouseLeave={e=>e.currentTarget.style.background='#ecfdf5'}>
              <Download size={13}/> CSV
            </button>
            <button onClick={ea.pdf} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:10,border:'1.5px solid #bfdbfe',background:'#eff6ff',color:'#1a56db',cursor:'pointer',fontSize:13,fontWeight:600,transition:'all 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='#dbeafe'}
              onMouseLeave={e=>e.currentTarget.style.background='#eff6ff'}>
              <FileText size={13}/> Print / PDF
            </button>
          </>)}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{display:'flex',gap:3,background:'#fff',borderRadius:14,padding:4,border:'1px solid #e5e7eb',width:'fit-content',marginBottom:24,flexWrap:'wrap',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'8px 16px',borderRadius:10,border:'none',cursor:'pointer',background:tab===t.id?'#1a56db':'transparent',color:tab===t.id?'#fff':'#6b7280',fontWeight:tab===t.id?700:500,fontSize:13.5,transition:'all 0.15s',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
            <span style={{fontSize:14}}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{padding:'12px 16px',background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,color:'#b91c1c',fontSize:13,marginBottom:20,display:'flex',gap:8,alignItems:'center'}}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:'80px 20px'}}>
          <div className="spinner" style={{width:32,height:32,margin:'0 auto'}}/>
          <p style={{color:'#9ca3af',marginTop:16}}>Loading report data…</p>
        </div>
      ) : !data ? (
        <div style={{textAlign:'center',padding:'60px 20px',color:'#9ca3af'}}>
          <BarChart2 size={48} style={{opacity:0.2,marginBottom:12}}/>
          <p>No data yet. Click Refresh to load.</p>
        </div>
      ) : (
        <div>

        {/* ════════════ P&L ════════════ */}
        {tab==='pnl' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:24}}>
              <KPI label="Revenue"        val={data.totalRevenue}   color="#1a56db" bg="#eff6ff"  icon="💰"/>
              <KPI label="Collected"      val={data.totalReceived}  color="#059669" bg="#ecfdf5"  icon="✅"/>
              <KPI label="Pending"        val={data.totalUnpaid}    color="#dc2626" bg="#fef2f2"  icon="⏳"/>
              <KPI label="Expenses"       val={data.totalExpenses}  color="#d97706" bg="#fffbeb"  icon="💸"/>
              <KPI label="Purchases"      val={data.totalPurchases} color="#7c3aed" bg="#f5f3ff"  icon="🛍️"/>
              <KPI label="Net Profit"     val={data.netProfit}      color={data.netProfit>=0?'#059669':'#dc2626'} bg={data.netProfit>=0?'#ecfdf5':'#fef2f2'} icon="📊"/>
            </div>
            {/* P&L Statement */}
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'22px 26px',marginBottom:20,boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:16,color:'#0d1b2e',letterSpacing:'-0.2px'}}>Profit & Loss Statement</div>
                <div style={{fontSize:12,color:'#9ca3af'}}>{from} — {to}</div>
              </div>
              {[
                {label:'(+) Revenue from Invoices',    val:data.totalRevenue,    color:'#059669', indent:0, bold:false},
                {label:'     ↳ Collected',             val:data.totalReceived,   color:'#059669', indent:1, bold:false},
                {label:'     ↳ Pending',               val:data.totalUnpaid,     color:'#dc2626', indent:1, bold:false},
                {label:'(−) Cost of Purchases',        val:data.totalPurchases,  color:'#dc2626', indent:0, bold:false},
                {label:'  = Gross Profit',             val:data.grossProfit,     color:data.grossProfit>=0?'#059669':'#dc2626', indent:0, bold:true},
                {label:'(−) Operating Expenses',       val:data.totalExpenses,   color:'#dc2626', indent:0, bold:false},
                {label:'  = Net Profit / Loss',        val:data.netProfit,       color:data.netProfit>=0?'#059669':'#dc2626', indent:0, bold:true, big:true},
              ].map((r,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:`${r.big?'14px 16px':r.bold?'10px 8px':'8px'} 0`,borderBottom:i<6?'1px solid #f3f4f6':'none',fontWeight:r.bold?800:400,background:r.big?'#f8faff':'',borderRadius:r.big?10:0,marginTop:r.big?6:0,paddingLeft:r.indent?20:0}}>
                  <span style={{color:r.bold?'#0d1b2e':'#374151',fontSize:r.big?15:r.bold?14.5:14}}>{r.label}</span>
                  <span style={{color:r.color,fontWeight:r.bold?800:600,fontSize:r.big?18:r.bold?15:14,fontFamily:r.bold?'Plus Jakarta Sans,sans-serif':''}}>{money(Math.abs(r.val))}</span>
                </div>
              ))}
            </div>
            {/* Top items */}
            {data.topItems.length>0&&(
              <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
                <div style={{padding:'16px 22px',fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',borderBottom:'1px solid #f3f4f6'}}>Top Selling Items</div>
                {data.topItems.map((it,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 22px',borderBottom:i<data.topItems.length-1?'1px solid #f9fafb':'none'}}>
                    <div style={{width:24,height:24,borderRadius:7,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:11,color:'#1a56db',flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,color:'#0d1b2e',fontSize:14,marginBottom:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.name}</div>
                      <div style={{height:5,borderRadius:99,background:'#f3f4f6',overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:99,background:COLORS[i%COLORS.length],width:`${data.topItems[0].value>0?(it.value/data.topItems[0].value*100):0}%`,transition:'width 0.5s ease'}}/>
                      </div>
                    </div>
                    <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:14,color:'#1a56db',flexShrink:0,minWidth:70,textAlign:'right'}}>{money(it.value)}</div>
                    <div style={{fontSize:12,color:'#9ca3af',minWidth:40,textAlign:'right',flexShrink:0}}>{data.totalRevenue>0?(it.value/data.totalRevenue*100).toFixed(1):0}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════ INVOICES ════════════ */}
        {tab==='invoices' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:14,marginBottom:20}}>
              <KPI label="Total Invoiced" val={data.totalRevenue}  color="#1a56db" bg="#eff6ff" icon="🧾"/>
              <KPI label="Collected"      val={data.totalReceived} color="#059669" bg="#ecfdf5" icon="✅"/>
              <KPI label="Pending"        val={data.totalUnpaid}   color="#dc2626" bg="#fef2f2" icon="⏳"/>
              <KPI label="Count"          val={data.invoiceCount}  color="#7c3aed" bg="#f5f3ff" icon="🔢" isCnt/>
              <KPI label="Paid"           val={data.paidCount}     color="#059669" bg="#ecfdf5" icon="✓"  isCnt/>
              <KPI label="Avg Invoice"    val={data.invoiceCount>0?Math.round(data.totalRevenue/data.invoiceCount):0} color="#0e7490" bg="#ecfeff" icon="📐"/>
            </div>
            {/* Daily chart */}
            {data.dailyData.length>0&&(
              <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'20px 22px',marginBottom:20,boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
                <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',marginBottom:16}}>Daily Revenue</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.dailyData} margin={{left:-20,right:4,top:4}}>
                    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1a56db" stopOpacity={0.18}/><stop offset="100%" stopColor="#1a56db" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                    <XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#9ca3af',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`₹${(v/1000).toFixed(0)}k`:0}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1a56db" strokeWidth={2.5} fill="url(#g1)" dot={{r:4,fill:'#1a56db',strokeWidth:0}} activeDot={{r:6,fill:'#1a56db',stroke:'#fff',strokeWidth:2}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Category + payment charts */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
              {data.catData.length>0&&(
                <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'20px',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
                  <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',marginBottom:16}}>By Category</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart><Pie data={data.catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={3}>
                      {data.catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie><Tooltip content={<ChartTip/>}/></PieChart>
                  </ResponsiveContainer>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginTop:6}}>
                    {data.catData.map((c,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:4,fontSize:11.5,color:'#374151'}}><div style={{width:8,height:8,borderRadius:'50%',background:COLORS[i%COLORS.length],flexShrink:0}}/>{c.name}</div>)}
                  </div>
                </div>
              )}
              {data.payData.length>0&&(
                <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'20px',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
                  <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',marginBottom:16}}>Payment Modes</div>
                  {data.payData.map((p,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:COLORS[i%COLORS.length],flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,color:'#0d1b2e',fontSize:13,marginBottom:3}}>{p.name}</div>
                        <div style={{height:5,borderRadius:99,background:'#f3f4f6',overflow:'hidden'}}>
                          <div style={{height:'100%',background:COLORS[i%COLORS.length],borderRadius:99,width:`${data.totalReceived>0?(p.value/data.totalReceived*100):0}%`}}/>
                        </div>
                      </div>
                      <div style={{fontWeight:800,color:'#0d1b2e',fontSize:13,flexShrink:0}}>{money(p.value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ EXPENSES ════════════ */}
        {tab==='expenses' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:14,marginBottom:20}}>
              <KPI label="Total Expenses" val={data.totalExpenses}  color="#d97706" bg="#fffbeb" icon="💸"/>
              <KPI label="Entries"        val={data.expenseList.length} color="#374151" bg="#f3f4f6" icon="📝" isCnt/>
              <KPI label="Largest Category" val={data.expCatData[0]?.value||0} color="#dc2626" bg="#fef2f2" icon="📊"/>
            </div>
            {data.expDailyData.length>0&&(
              <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'20px 22px',marginBottom:20,boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
                <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',marginBottom:16}}>Daily Expenses</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.expDailyData} margin={{left:-20,right:4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                    <XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#9ca3af',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`₹${(v/1000).toFixed(0)}k`:0}/>
                    <Tooltip content={<ChartTip/>}/>
                    <Bar dataKey="amount" name="Expenses" fill="#d97706" radius={[6,6,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {data.expCatData.length>0&&(
              <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
                <div style={{padding:'16px 22px',fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',borderBottom:'1px solid #f3f4f6'}}>By Category</div>
                {data.expCatData.map((c,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 22px',borderBottom:i<data.expCatData.length-1?'1px solid #f9fafb':'none'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,color:'#0d1b2e',fontSize:14,marginBottom:4}}>{c.name}</div>
                      <div style={{height:5,borderRadius:99,background:'#f3f4f6',overflow:'hidden'}}>
                        <div style={{height:'100%',background:COLORS[i%COLORS.length],borderRadius:99,width:`${data.totalExpenses>0?(c.value/data.totalExpenses*100):0}%`}}/>
                      </div>
                    </div>
                    <div style={{fontWeight:800,color:'#d97706',fontSize:14,flexShrink:0}}>{money(c.value)}</div>
                    <div style={{fontSize:12,color:'#9ca3af',flexShrink:0,minWidth:40,textAlign:'right'}}>{data.totalExpenses>0?(c.value/data.totalExpenses*100).toFixed(1):0}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════ PURCHASES ════════════ */}
        {tab==='purchases' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:14,marginBottom:20}}>
              <KPI label="Total Purchased" val={data.totalPurchases} color="#d97706" bg="#fffbeb" icon="🛍️"/>
              <KPI label="Paid"            val={data.purchasePaid}   color="#059669" bg="#ecfdf5" icon="✅"/>
              <KPI label="Balance Due"     val={data.purchaseDue}    color="#dc2626" bg="#fef2f2" icon="⚠️"/>
              <KPI label="Orders"          val={data.purchaseList.length} color="#374151" bg="#f3f4f6" icon="📋" isCnt/>
            </div>
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
              <div style={{padding:'16px 22px',fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',borderBottom:'1px solid #f3f4f6'}}>Purchase Records</div>
              {data.purchaseList.length===0 ? <div style={{padding:'40px',textAlign:'center',color:'#9ca3af'}}>No purchases in this period</div>
              : <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
                  <thead><tr style={{background:'#f9fafb'}}>{['Date','Vendor','Invoice No','Total','Paid','Due','Status'].map(h=><th key={h} style={{padding:'11px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'1.5px solid #e5e7eb',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                  <tbody>{data.purchaseList.map((p,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}} onMouseEnter={e=>e.currentTarget.style.background='#f8faff'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{padding:'11px 16px',fontSize:13,color:'#374151'}}>{p.date}</td>
                      <td style={{padding:'11px 16px',fontWeight:600,color:'#0d1b2e',fontSize:14}}>{p.vendorName||'—'}</td>
                      <td style={{padding:'11px 16px',fontFamily:'monospace',fontSize:12,color:'#6b7280'}}>{p.invoiceNo||'—'}</td>
                      <td style={{padding:'11px 16px',fontWeight:800,color:'#d97706',fontSize:14}}>{money(p.totalAmount||0)}</td>
                      <td style={{padding:'11px 16px',fontWeight:600,color:'#059669',fontSize:13}}>{money(p.paidAmount||0)}</td>
                      <td style={{padding:'11px 16px',fontWeight:600,color:'#dc2626',fontSize:13}}>{money(p.remainingAmount||0)}</td>
                      <td style={{padding:'11px 16px'}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:11.5,fontWeight:700,background:p.status==='paid'?'#ecfdf5':p.status==='partial'?'#fffbeb':'#fef2f2',color:p.status==='paid'?'#059669':p.status==='partial'?'#d97706':'#dc2626'}}>{p.status||'—'}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>}
            </div>
          </div>
        )}

        {/* ════════════ INVENTORY ════════════ */}
        {tab==='inventory' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:20}}>
              <KPI label="Stock Purchase Value" val={data.stockPurchaseVal}                    color="#1a56db" bg="#eff6ff" icon="📦"/>
              <KPI label="Stock Selling Value"  val={data.stockSellingVal}                     color="#059669" bg="#ecfdf5" icon="💰"/>
              <KPI label="Potential Profit"     val={data.stockSellingVal-data.stockPurchaseVal} color="#7c3aed" bg="#f5f3ff" icon="💹"/>
              <KPI label="Total Items"          val={data.invItems.length}                     color="#374151" bg="#f3f4f6" icon="🔢" isCnt/>
            </div>
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
              <div style={{padding:'16px 22px',fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',borderBottom:'1px solid #f3f4f6'}}>Current Stock</div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:680}}>
                  <thead><tr style={{background:'#f9fafb'}}>{['Item','Category','Stock','Unit','Purchase ₹','Selling ₹','Value','Status'].map(h=><th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'1.5px solid #e5e7eb',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                  <tbody>{data.invItems.map((it,i)=>{const isLow=(it.currentStock||0)<=(it.minStock||5);const isOut=(it.currentStock||0)===0;return(
                    <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}} onMouseEnter={e=>e.currentTarget.style.background='#f8faff'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{padding:'11px 14px',fontWeight:700,fontSize:14,color:'#0d1b2e'}}>{it.name}</td>
                      <td style={{padding:'11px 14px',fontSize:13,color:'#374151'}}>{it.category||'—'}</td>
                      <td style={{padding:'11px 14px',fontWeight:800,fontSize:15,color:isOut?'#dc2626':isLow?'#d97706':'#059669'}}>{it.currentStock||0}</td>
                      <td style={{padding:'11px 14px',fontSize:13,color:'#6b7280'}}>{it.unit||'—'}</td>
                      <td style={{padding:'11px 14px',fontSize:13,color:'#dc2626',fontWeight:600}}>{money(it.purchasePrice||0)}</td>
                      <td style={{padding:'11px 14px',fontSize:13,color:'#059669',fontWeight:600}}>{money(it.sellingPrice||it.purchasePrice||0)}</td>
                      <td style={{padding:'11px 14px',fontWeight:800,color:'#1a56db',fontSize:13}}>{money((it.currentStock||0)*(it.purchasePrice||0))}</td>
                      <td style={{padding:'11px 14px'}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:11.5,fontWeight:700,background:isOut?'#fef2f2':isLow?'#fffbeb':'#ecfdf5',color:isOut?'#dc2626':isLow?'#d97706':'#059669'}}>{isOut?'🚫 Out':isLow?'⚠️ Low':'✓ OK'}</span></td>
                    </tr>
                  )})}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ GROWTH ════════════ */}
        {tab==='growth' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:22}}>
              {[{label:'Revenue Growth',val:data.growthRevenue,pos:parseFloat(data.growthRevenue||0)>=0,icon:'📈',prev:data.prevRev,curr:data.totalRevenue},
                {label:'Expense Change',val:data.growthExpenses,pos:parseFloat(data.growthExpenses||0)<=0,icon:'📉',prev:data.prevExp,curr:data.totalExpenses}].map(k=>(
                <div key={k.label} style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',padding:'24px',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
                  <div style={{fontSize:28,marginBottom:12}}>{k.icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>{k.label} vs previous period</div>
                  {k.val!==null?(
                    <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:900,fontSize:36,color:k.pos?'#059669':'#dc2626',letterSpacing:'-1px'}}>
                      {parseFloat(k.val||0)>=0?'+':''}{k.val}%
                    </div>
                  ):<div style={{color:'#9ca3af',fontSize:15}}>No previous data</div>}
                  <div style={{marginTop:12,fontSize:13,color:'#6b7280'}}>
                    Previous period: <strong style={{color:'#374151'}}>{money(k.prev)}</strong>
                    <span style={{marginLeft:12}}>Current: <strong style={{color:'#0d1b2e'}}>{money(k.curr)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:'#fff',borderRadius:18,border:'1px solid #e5e7eb',overflow:'hidden',boxShadow:'0 1px 4px rgba(13,27,46,0.05)'}}>
              <div style={{padding:'16px 22px',fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:700,fontSize:15,color:'#0d1b2e',borderBottom:'1px solid #f3f4f6'}}>Period Summary</div>
              {[{l:'Total Revenue',v:data.totalRevenue,c:'#1a56db'},{l:'Collected',v:data.totalReceived,c:'#059669'},{l:'Pending',v:data.totalUnpaid,c:'#dc2626'},{l:'Expenses',v:data.totalExpenses,c:'#d97706'},{l:'Purchases',v:data.totalPurchases,c:'#7c3aed'},{l:'Net Profit',v:data.netProfit,c:data.netProfit>=0?'#059669':'#dc2626'}].map((r,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'12px 22px',borderBottom:'1px solid #f9fafb'}}>
                  <span style={{fontSize:14,color:'#374151',fontWeight:500}}>{r.l}</span>
                  <span style={{fontWeight:800,color:r.c,fontSize:15,fontFamily:'Plus Jakarta Sans,sans-serif'}}>{money(r.v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
      )}
    </div>
  );
}
