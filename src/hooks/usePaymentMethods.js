import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

// Default fallback methods when none are configured
const DEFAULTS = [
  { id:'_cash',    name:'Cash',           type:'cash',   emoji:'💵' },
  { id:'_gpay',    name:'GPay',           type:'upi',    emoji:'📱' },
  { id:'_upi',     name:'UPI',            type:'upi',    emoji:'📲' },
  { id:'_card',    name:'Card',           type:'card',   emoji:'💳' },
  { id:'_bank',    name:'Bank Transfer',  type:'bank',   emoji:'🏦' },
  { id:'_cheque',  name:'Cheque / DD',    type:'cheque', emoji:'📝' },
  { id:'_credit',  name:'Credit',         type:'credit', emoji:'📋' },
];

export function usePaymentMethods(shopId) {
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    if (!shopId) { setMethods(DEFAULTS); return; }
    const q = query(collection(db,'shops',shopId,'payment_methods'), orderBy('name'));
    const unsub = onSnapshot(q,
      snap => {
        const loaded = snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.isActive!==false);
        setMethods(loaded.length > 0 ? loaded : DEFAULTS);
      },
      () => setMethods(DEFAULTS)
    );
    return unsub;
  }, [shopId]);

  return methods;
}
