import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const ROUTES = {
  dashboard:'dashboard', parties:'parties', items:'items',
  invoices:'invoices', quotations:'quotations', purchases:'purchases',
  expenses:'expenses', deposits:'bank-deposits',
  reports:'reports', dayend:'day-end',
  business:'business', shops:'shops', staff:'staff',
  settings:'settings', 'payment-methods':'payment-methods',
};

/* ── SVG Icons ── */
const Ic = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  parties:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  items:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  invoice:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  quote:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  purchase:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  expense:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  deposit:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  reports:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  clock:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  building:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  shop:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  shield:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  settings:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  payment:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  logout:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevron:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
};

const SECTIONS = [
  { num:1, id:'dashboard', label:'Dashboard',          icon:Ic.dashboard, route:'/dashboard' },
  { num:2, id:'parties',   label:'Parties',            icon:Ic.parties,   route:'/parties'   },
  { num:3, id:'items',     label:'Items',              icon:Ic.items,     route:'/items'      },
  { num:4, id:'sales',     label:'Sales / Purchases',  icon:Ic.invoice,   route:'/invoices',
    children:[
      { id:'invoices',  label:'Sales Invoices', icon:Ic.invoice,  route:'/invoices'   },
      { id:'quotations',label:'Quotations',      icon:Ic.quote,    route:'/quotations' },
      { id:'purchases', label:'Purchases',       icon:Ic.purchase, route:'/purchases'  },
    ]},
  { num:5, id:'expenses',  label:'Expenses & Payments', icon:Ic.expense,  route:'/expenses',
    children:[
      { id:'expenses', label:'Expenses',      icon:Ic.expense, route:'/expenses'      },
      { id:'deposits', label:'Bank Deposits', icon:Ic.deposit, route:'/bank-deposits' },
    ]},
  { num:6, id:'reports',   label:'Reports',             icon:Ic.reports,  route:'/reports',
    children:[
      { id:'reports', label:'Analytics & P&L', icon:Ic.reports, route:'/reports'  },
      { id:'dayend',  label:'Day End',          icon:Ic.clock,   route:'/day-end' },
    ]},
  { num:7, id:'business',  label:'Manage Business',     icon:Ic.building, route:'/business',
    children:[
      { id:'business', label:'Business Profile', icon:Ic.building, route:'/business' },
      { id:'shops',    label:'Shops',             icon:Ic.shop,     route:'/shops'    },
      { id:'staff',    label:'Staff & Access',    icon:Ic.shield,   route:'/staff'    },
    ]},
  { num:8, id:'settings',  label:'Settings',             icon:Ic.settings, route:'/settings',
    children:[
      { id:'settings',        label:'General Settings',  icon:Ic.settings, route:'/settings'          },
      { id:'payment-methods', label:'Payment Methods',   icon:Ic.payment,  route:'/payment-methods'   },
    ]},
];

export default function Sidebar({ isOpen, onClose }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, userProfile, selectedShop, userShops, selectShop, logout, isSuperAdmin } = useAuth();
  const [shopOpen, setShopOpen]       = useState(false);
  const [openSect, setOpenSect]       = useState(null);

  const go = route => { navigate('/'+route); onClose?.(); };

  const handleLogout = async () => {
    try { await logout(); } catch { toast.error('Sign out failed'); }
  };

  // Active detection
  const path = location.pathname.replace('/','');
  const activeSect = SECTIONS.find(s=>
    s.route.replace('/','')===path ||
    s.children?.some(c=>c.route.replace('/','')===path)
  );

  const expandedId = openSect ?? activeSect?.id;

  const isChildActive = id => {
    const sect = SECTIONS.find(s=>s.id===id);
    return sect?.children?.some(c=>c.route.replace('/','')===path);
  };

  return (
    <>
      {isOpen && (
        <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(13,27,46,0.55)',zIndex:99,backdropFilter:'blur(3px)'}}/>
      )}

      <div className={`sidebar${isOpen?' open':''}`}>
        {/* ── Brand ── */}
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,boxShadow:'0 4px 12px rgba(59,130,246,0.4)'}}>🍺</div>
            <div>
              <div style={{fontFamily:'Plus Jakarta Sans,sans-serif',fontWeight:800,fontSize:15.5,color:'#fff',letterSpacing:'-0.2px',lineHeight:1}}>Siruvani POS</div>
              <div style={{fontSize:10.5,color:isSuperAdmin?'#60a5fa':'rgba(255,255,255,0.42)',fontWeight:600,marginTop:3,textTransform:'uppercase',letterSpacing:'0.07em'}}>
                {isSuperAdmin?'Super Admin':'Restaurant'}
              </div>
            </div>
          </div>

          {/* Shop selector */}
          {selectedShop ? (
            <div onClick={()=>setShopOpen(v=>!v)} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 13px',cursor:'pointer',userSelect:'none',transition:'all 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.13)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontWeight:700,fontSize:13.5,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{selectedShop.name}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:1,fontWeight:500}}>{selectedShop.type?.replace('_',' ')||'Bar'}</div>
                </div>
                <div style={{width:16,height:16,flexShrink:0,marginLeft:8,color:'rgba(255,255,255,0.4)',transform:shopOpen?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s'}}>
                  {Ic.chevron}
                </div>
              </div>
              {shopOpen && userShops.length>1 && (
                <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.08)'}}>
                  {userShops.map(s=>(
                    <div key={s.id} onClick={e=>{e.stopPropagation();selectShop(s);setShopOpen(false);}}
                      style={{padding:'7px 10px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',color:s.id===selectedShop.id?'#fff':'rgba(255,255,255,0.6)',background:s.id===selectedShop.id?'rgba(255,255,255,0.15)':'transparent',transition:'all 0.12s',marginBottom:2}}
                      onMouseEnter={e=>{if(s.id!==selectedShop.id)e.currentTarget.style.background='rgba(255,255,255,0.08)';}}
                      onMouseLeave={e=>{if(s.id!==selectedShop.id)e.currentTarget.style.background='transparent';}}>
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div onClick={()=>go('shops')} style={{background:'rgba(255,255,255,0.06)',border:'1px dashed rgba(255,255,255,0.2)',borderRadius:12,padding:'10px 13px',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.10)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>No shop selected</div>
              <div style={{fontSize:12.5,color:'#60a5fa',fontWeight:700,marginTop:2}}>+ Select or create a shop</div>
            </div>
          )}
        </div>

        {/* ── Nav ── */}
        <div style={{flex:1,padding:'8px 10px',overflowY:'auto',overflowX:'hidden'}}>
          {SECTIONS.map(sect=>{
            const isExpanded  = expandedId===sect.id;
            const hasChildren = sect.children?.length>0;
            const isThisActive= sect.route.replace('/','')===path || isChildActive(sect.id);

            return (
              <div key={sect.id} style={{marginBottom:1}}>
                <button
                  onClick={()=>{
                    if(hasChildren) setOpenSect(isExpanded?null:sect.id);
                    else go(sect.route.replace('/',''));
                  }}
                  style={{
                    display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
                    borderRadius:10,border:'none',cursor:'pointer',width:'100%',textAlign:'left',
                    background: isThisActive&&!isExpanded
                      ? 'rgba(255,255,255,0.14)'
                      : isExpanded ? 'rgba(255,255,255,0.10)' : 'transparent',
                    color: isThisActive||isExpanded ? '#fff' : 'rgba(255,255,255,0.62)',
                    fontWeight: isThisActive ? 700 : 500,
                    fontSize:13.5,
                    transition:'all 0.13s',
                    position:'relative',
                  }}
                  onMouseEnter={e=>{ if(!isThisActive&&!isExpanded) e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.color='rgba(255,255,255,0.9)'; }}
                  onMouseLeave={e=>{ if(!isThisActive&&!isExpanded) e.currentTarget.style.background='transparent'; e.currentTarget.style.color=isThisActive||isExpanded?'#fff':'rgba(255,255,255,0.62)'; }}
                >
                  {/* Number badge */}
                  <div style={{width:22,height:22,borderRadius:7,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10.5,fontWeight:800,color:'#fff',background: isThisActive||isExpanded?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.10)',transition:'background 0.13s'}}>
                    {sect.num}
                  </div>
                  {/* Icon */}
                  <div style={{width:16,height:16,flexShrink:0,opacity:isThisActive||isExpanded?1:0.7}}>{sect.icon}</div>
                  {/* Label */}
                  <span style={{flex:1,lineHeight:1.2}}>{sect.label}</span>
                  {/* Chevron */}
                  {hasChildren && (
                    <div style={{width:14,height:14,flexShrink:0,opacity:0.5,transform:isExpanded?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s'}}>
                      {Ic.chevron}
                    </div>
                  )}
                  {/* Active indicator */}
                  {isThisActive&&!hasChildren && (
                    <div style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:'60%',borderRadius:'0 3px 3px 0',background:'#60a5fa'}}/>
                  )}
                </button>

                {/* Children */}
                {hasChildren && isExpanded && (
                  <div style={{marginLeft:8,paddingLeft:14,borderLeft:'1.5px solid rgba(255,255,255,0.10)',marginTop:2,marginBottom:2}}>
                    {sect.children.map(child=>{
                      const cActive = child.route.replace('/','')===path;
                      return (
                        <button key={child.id} onClick={()=>go(child.route.replace('/','' ))}
                          style={{display:'flex',alignItems:'center',gap:9,padding:'8px 12px',borderRadius:9,border:'none',cursor:'pointer',width:'100%',textAlign:'left',background:cActive?'rgba(255,255,255,0.16)':'transparent',color:cActive?'#fff':'rgba(255,255,255,0.55)',fontWeight:cActive?700:400,fontSize:13,marginBottom:1,transition:'all 0.12s',position:'relative'}}
                          onMouseEnter={e=>{ if(!cActive){e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.color='rgba(255,255,255,0.85)';} }}
                          onMouseLeave={e=>{ if(!cActive){e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(255,255,255,0.55)';} }}
                        >
                          <div style={{width:15,height:15,flexShrink:0,opacity:cActive?1:0.65}}>{child.icon}</div>
                          <span>{child.label}</span>
                          {cActive&&<div style={{position:'absolute',left:-14,top:'50%',transform:'translateY(-50%)',width:3,height:'60%',borderRadius:'0 2px 2px 0',background:'#93c5fd'}}/>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Divider + Sign out */}
          <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.07)'}}>
            <button onClick={handleLogout}
              style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'none',cursor:'pointer',width:'100%',textAlign:'left',background:'transparent',color:'rgba(255,255,255,0.45)',fontSize:13.5,fontWeight:500,transition:'all 0.13s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.15)';e.currentTarget.style.color='#fca5a5';}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(255,255,255,0.45)';}}>
              <div style={{width:16,height:16,flexShrink:0,opacity:0.7}}>{Ic.logout}</div>
              Sign Out
            </button>
          </div>
        </div>

        {/* ── User footer ── */}
        <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,rgba(96,165,250,0.5),rgba(29,78,216,0.5))',border:'1.5px solid rgba(255,255,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12.5,color:'#fff',flexShrink:0}}>
            {(userProfile?.displayName?.[0]||user?.email?.[0]||'A').toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12.5,fontWeight:700,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.2}}>
              {userProfile?.displayName||user?.email?.split('@')[0]}
            </div>
            <div style={{fontSize:10.5,color:'rgba(255,255,255,0.38)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:2}}>{user?.email}</div>
          </div>
        </div>
      </div>
    </>
  );
}
