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

/* Persistence is configured in firebase.js (browserLocalPersistence),
   so the session always survives refreshes. Nothing to do here. */
const persistenceReady = Promise.resolve();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                 = useState(null);
  const [userProfile, setUserProfile]   = useState(null);
  const [loading, setLoading]           = useState(true);
  const [selectedShop, setSelectedShop] = useState(null);
  const [userShops, setUserShops]       = useState([]);

  /* ──────────────────────────────────────────────────────────────────
     Auth listener — the SINGLE source of truth.
     On refresh, Firebase restores the persisted session and fires this
     with the real user. We NEVER sign anyone out here, so a refresh
     always keeps the user logged in. Logout only happens via logout().
  ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let unsub = null;
    (async () => {
      await persistenceReady;
      unsub = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          setUser(fbUser);
          await loadUserProfile(fbUser);
        } else {
          setUser(null);
          setUserProfile(null);
          setUserShops([]);
          setSelectedShop(null);
        }
        setLoading(false);
      });
    })();
    return () => { if (unsub) unsub(); };
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
    }
  };

  const loadShops = async (uid, profile) => {
    try {
      let allShops = [];
      if (profile?.role === 'superadmin') {
        const snap = await getDocs(collection(db, 'shops'));
        allShops = snap.docs.map(d => ({ id: d.id, ...d.data(), access: 'owner' }));
      } else {
        const [ownedSnap, memberSnap] = await Promise.all([
          getDocs(query(collection(db, 'shops'), where('ownerId', '==', uid))),
          getDocs(query(collection(db, 'shops'), where('memberEmails', 'array-contains', profile?.email || ''))),
        ]);
        const owned  = ownedSnap.docs.map(d => ({ id: d.id, ...d.data(), access: 'owner' }));
        const member = memberSnap.docs.map(d => ({ id: d.id, ...d.data(), access: 'member' }));
        const seen   = new Set(owned.map(s => s.id));
        allShops = [...owned, ...member.filter(s => !seen.has(s.id))];
      }
      setUserShops(allShops);
      if (allShops.length > 0) {
        const saved = localStorage.getItem('selectedShopId');
        const found = allShops.find(s => s.id === saved);
        setSelectedShop(found || allShops[0]);
      } else {
        setSelectedShop(null);
      }
    } catch (err) {
      console.warn('loadShops issue:', err.code, err.message);
      setUserShops([]);
    }
  };

  /* ──────────────────────────────────────────────────────────────────
     Login — also bootstraps the super-admin account on demand.
     If the user is trying to log in as admin and the account doesn't
     exist yet, create it transparently then sign in.
  ────────────────────────────────────────────────────────────────── */
  const loginWithEmail = async (email, password) => {
    await persistenceReady;
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // Auto-create the super-admin on first login attempt
      const isAdminLogin = email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASS;
      if (isAdminLogin && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
        const result = await createUserWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS);
        await updateProfile(result.user, { displayName: 'Super Admin' });
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid, email: SUPER_ADMIN_EMAIL,
          displayName: 'Super Admin', role: 'superadmin', createdAt: new Date(),
        });
        return result;
      }
      throw err;
    }
  };

  const createRestaurantAccount = async ({ name, email, password, shopId }) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid, email, displayName: name,
      role: 'restaurant', shopId: shopId || null, createdAt: new Date(),
    });
    // Sign back in as admin (createUser switched the active user)
    await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASS);
    return result.user;
  };

  /* Explicit logout — the ONLY way to end the session */
  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('selectedShopId');
    setUser(null); setUserProfile(null); setUserShops([]); setSelectedShop(null);
  };

  const selectShop = (shop) => {
    setSelectedShop(shop);
    localStorage.setItem('selectedShopId', shop.id);
  };

  const refreshShops = () => { if (user && userProfile) loadShops(user.uid, userProfile); };

  const isSuperAdmin = userProfile?.role === 'superadmin';
  const isAdmin = isSuperAdmin || selectedShop?.ownerId === user?.uid;

  return (
    <AuthContext.Provider value={{
      user, userProfile, loading, selectedShop, userShops,
      loginWithEmail, createRestaurantAccount, logout,
      selectShop, refreshShops, isAdmin, isSuperAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
