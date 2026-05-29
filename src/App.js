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
    <div style={{minHeight:'100vh',background:'#f0f4ff',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{width:64,height:64,borderRadius:20,background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,boxShadow:'0 8px 32px rgba(37,99,235,0.3)'}}>🍺</div>
      <div className="spinner" style={{width:24,height:24}}/>
      <p style={{color:'#64748b',fontSize:14,fontFamily:'DM Sans,sans-serif'}}>Loading…</p>
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
          <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:17,color:'#fff'}}>🍺 Siruvani POS</span>
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
        <Toaster position="top-right" toastOptions={{duration:3500,style:{background:'#fff',color:'#0f172a',border:'1.5px solid #e2e8f0',borderRadius:'14px',fontSize:'14px',fontFamily:'DM Sans,sans-serif',boxShadow:'0 8px 32px rgba(15,23,42,0.12)'},success:{iconTheme:{primary:'#059669',secondary:'#fff'}},error:{iconTheme:{primary:'#dc2626',secondary:'#fff'}}}}/>
      </AuthProvider>
    </Router>
  );
}
