import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const SUPER_ADMIN_EMAIL = 'admin@siruvani.com';
export const SUPER_ADMIN_PASS  = 'Admin@2026';

// Auto-create admin on first load
const ensureAdminExists = async () => {
  try {
    await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const result = await createUserWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS);
        await updateProfile(result.user, { displayName: 'Super Admin' });
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid, email: SUPER_ADMIN_EMAIL,
          displayName: 'Super Admin', role: 'superadmin', createdAt: new Date(),
        });
      } catch (e) { console.error('Admin create error:', e); }
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [selectedShop, setSelectedShop] = useState(null);
  const [userShops, setUserShops]     = useState([]);

  useEffect(() => {
    let unsubAuth = null;
    const init = async () => {
      await ensureAdminExists();
      await signOut(auth);
      unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          setUser(fbUser);
          await loadUserProfile(fbUser);
        } else {
          setUser(null); setUserProfile(null); setUserShops([]); setSelectedShop(null);
        }
        setLoading(false);
      });
    };
    init();
    return () => { if (unsubAuth) unsubAuth(); };
  }, []);

  const loadUserProfile = async (fbUser) => {
    try {
      const ref  = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(ref);
      let profile;
      if (!snap.exists()) {
        profile = {
          uid: fbUser.uid, email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email.split('@')[0],
          role: fbUser.email === SUPER_ADMIN_EMAIL ? 'superadmin' : 'restaurant',
          createdAt: new Date(),
        };
        await setDoc(ref, profile);
      } else {
        profile = snap.data();
      }
      setUserProfile(profile);
      await loadShops(fbUser.uid, profile);
    } catch (err) {
      console.error('loadUserProfile error:', err);
      setLoading(false);
    }
  };

  const loadShops = async (uid, profile) => {
    try {
      let allShops = [];
      if (profile?.role === 'superadmin') {
        // Super admin — get all shops
        const snap = await getDocs(collection(db, 'shops'));
        allShops = snap.docs.map(d => ({ id: d.id, ...d.data(), access: 'owner' }));
      } else {
        // Regular user — get owned + member shops
        const [ownedSnap, memberSnap] = await Promise.all([
          getDocs(query(collection(db, 'shops'), where('ownerId', '==', uid))),
          getDocs(query(collection(db, 'shops'), where('memberEmails', 'array-contains', profile?.email || ''))),
        ]);
        const owned  = ownedSnap.docs.map(d => ({ id: d.id, ...d.data(), access: 'owner' }));
        const member = memberSnap.docs.map(d => ({ id: d.id, ...d.data(), access: 'member' }));
        // Deduplicate
        const seen = new Set(owned.map(s => s.id));
        allShops = [...owned, ...member.filter(s => !seen.has(s.id))];
      }
      setUserShops(allShops);
      if (allShops.length > 0) {
        const saved = localStorage.getItem('selectedShopId');
        const found = allShops.find(s => s.id === saved);
        setSelectedShop(found || allShops[0]);
      }
    } catch (err) {
      // Firestore rules may block — show empty gracefully
      console.warn('loadShops permission issue (check Firestore rules):', err.code, err.message);
      setUserShops([]);
    }
  };

  const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const createRestaurantAccount = async ({ name, email, password, shopId }) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid, email, displayName: name,
      role: 'restaurant', shopId: shopId || null, createdAt: new Date(),
    });
    // Sign back in as admin
    await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS);
    return result.user;
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('selectedShopId');
  };

  const selectShop = (shop) => {
    setSelectedShop(shop);
    localStorage.setItem('selectedShopId', shop.id);
  };

  const refreshShops = () => { if (user && userProfile) loadShops(user.uid, userProfile); };

  const isSuperAdmin = userProfile?.role === 'superadmin';
  const isAdmin = isSuperAdmin || selectedShop?.ownerId === user?.uid;

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, selectedShop, userShops, loginWithEmail, createRestaurantAccount, logout, selectShop, refreshShops, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
