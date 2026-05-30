import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import LoginPage          from './pages/LoginPage';
import Dashboard          from './pages/Dashboard';
import PartiesPage        from './pages/PartiesPage';
import InventoryPage      from './pages/InventoryPage';
import InvoicePage        from './pages/InvoicePage';
import PurchasePage       from './pages/PurchasePage';
import ExpensePage        from './pages/ExpensePage';
import BankDepositPage    from './pages/BankDepositPage';
import ReportsPage        from './pages/ReportsPage';
import DayEndPage         from './pages/DayEndPage';
import ManageBusinessPage from './pages/ManageBusinessPage';
import ShopsPage          from './pages/ShopsPage';
import StaffPage          from './pages/StaffPage';
import SettingsPage          from './pages/SettingsPage';
import PaymentMethodsPage  from './pages/PaymentMethodsPage';
import Sidebar            from './components/Sidebar';
import './styles/globals.css';

function AppLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  if (loading) return (
    <div style={{minHeight:'100vh',minHeight:'100dvh',background:'linear-gradient(135deg,#0f2554,#1a3a87)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:18}}>
      <div style={{width:68,height:68,borderRadius:22,background:'linear-gradient(135deg,#3b82f6,#60a5fa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,boxShadow:'0 8px 32px rgba(59,130,246,0.45)',animation:'pulse 1.6s ease infinite'}}>🍺</div>
      <div style={{textAlign:'center'}}>
        <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:20,color:'#fff',letterSpacing:'-0.3px',marginBottom:10}}>Siruvani POS</div>
        <div className="spinner" style={{width:22,height:22,margin:'0 auto',borderColor:'rgba(255,255,255,0.2)',borderTopColor:'#fff'}}/>
        <p style={{color:'rgba(255,255,255,0.6)',fontSize:13,fontFamily:'Inter,sans-serif',marginTop:14}}>Restoring your session…</p>
      </div>
    </div>
  );
  if (!user) return <LoginPage />;
  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f0f4ff'}}>
      <Sidebar isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
      <div className="main-content" style={{flex:1,display:'flex',flexDirection:'column',minHeight:'100vh',overflow:'hidden'}}>
        <div className="mobile-topbar">
          <button onClick={()=>setSidebarOpen(true)} style={{width:38,height:38,borderRadius:10,background:'rgba(255,255,255,0.18)',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4}}>
            <span style={{width:16,height:2,background:'#fff',borderRadius:2,display:'block'}}/>
            <span style={{width:12,height:2,background:'#fff',borderRadius:2,display:'block'}}/>
            <span style={{width:16,height:2,background:'#fff',borderRadius:2,display:'block'}}/>
          </button>
          <span style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:16,color:'#fff',letterSpacing:'-0.2px'}}>🍺 Siruvani POS</span>
        </div>
        <div style={{flex:1,overflowY:'auto',overflowX:'hidden'}}>
          <Routes>
            <Route path="/"              element={<Navigate to="/dashboard" replace/>}/>
            <Route path="/dashboard"     element={<Dashboard/>}/>
            <Route path="/parties"       element={<PartiesPage/>}/>
            <Route path="/items"         element={<InventoryPage/>}/>
            <Route path="/invoices"      element={<InvoicePage mode="invoice"/>}/>
            <Route path="/quotations"    element={<InvoicePage mode="quotation"/>}/>
            <Route path="/purchases"     element={<PurchasePage/>}/>
            <Route path="/expenses"      element={<ExpensePage/>}/>
            <Route path="/bank-deposits" element={<BankDepositPage/>}/>
            <Route path="/reports"       element={<ReportsPage/>}/>
            <Route path="/day-end"       element={<DayEndPage/>}/>
            <Route path="/business"      element={<ManageBusinessPage/>}/>
            <Route path="/shops"         element={<ShopsPage/>}/>
            <Route path="/staff"         element={<StaffPage/>}/>
            <Route path="/settings"      element={<SettingsPage/>}/>
            <Route path="*"              element={<Navigate to="/dashboard" replace/>}/>
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout/>
        <Toaster position="top-center" toastOptions={{duration:3000,style:{background:'#fff',color:'#0d1b2e',border:'1px solid #e5e7eb',borderRadius:'14px',fontSize:'13.5px',fontWeight:500,fontFamily:'Inter,sans-serif',boxShadow:'0 8px 32px rgba(13,27,46,0.14)',padding:'12px 16px',maxWidth:'90vw'},success:{iconTheme:{primary:'#059669',secondary:'#fff'}},error:{iconTheme:{primary:'#dc2626',secondary:'#fff'}}}}/>
      </AuthProvider>
    </Router>
  );
}
