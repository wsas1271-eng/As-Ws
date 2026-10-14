import React, { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  Wallet,
  Trophy,
  ShieldCheck,
  Copy,
  Check,
  LogOut,
  User,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Smartphone,
  History,
  HelpCircle,
  Award,
  ChevronDown,
  ChevronUp,
  Crown,
  Gift,
  Users,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
} from './firebase';
import { BingoArena } from './BingoArena';
import { soundEngine } from './sound';

export interface UserProfileData {
  uid: string;
  displayName: string;
  phone: string;
  email: string;
  balance: number;
  totalWins: number;
  totalPlayed: number;
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  role: 'user' | 'admin';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReferralClaimData {
  referrerUid: string;
  referrerCode: string;
  newUserUid: string;
  newUserName: string;
  bonusAmount: number;
  referrerClaimed: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LeaderboardEntryData {
  uid: string;
  displayName: string;
  totalWins: number;
  totalPlayed: number;
  updatedAt?: Timestamp;
}

export interface TransactionData {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  type: 'deposit' | 'withdraw';
  method: 'CBE' | 'Awash' | 'Telebirr';
  amount: number;
  referenceCode: string;
  senderOrReceiverName: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GameHistoryData {
  id: string;
  userId: string;
  userName: string;
  stake: number;
  prize: number;
  result: 'won' | 'lost';
  bingoType: string;
  ballsCalledCount: number;
  createdAt?: Timestamp;
}

export const REFERRAL_BONUS_ETB = 15;

export const PAYMENT_ACCOUNTS = [
  {
    id: 'CBE' as const,
    bankName: 'Commercial Bank of Ethiopia (CBE)',
    shortName: 'CBE Bank',
    accountNumber: '1000218818424',
    holderName: 'Asefa Wasenu Tadese',
    badgeColor: 'from-purple-600 to-indigo-800',
    borderColor: 'border-purple-400/40',
    iconType: 'bank',
  },
  {
    id: 'Awash' as const,
    bankName: 'Awash Bank',
    shortName: 'Awash Bank',
    accountNumber: '01320561958100',
    holderName: 'Asefa Wasenu Tadese',
    badgeColor: 'from-amber-500 to-orange-700',
    borderColor: 'border-amber-400/40',
    iconType: 'bank',
  },
  {
    id: 'Telebirr' as const,
    bankName: 'Ethio Telecom Telebirr',
    shortName: 'Telebirr',
    accountNumber: '0929200166',
    holderName: 'Gabre shifaraa hayilu',
    badgeColor: 'from-sky-500 to-blue-700',
    borderColor: 'border-sky-400/40',
    iconType: 'phone',
  },
];

export const FAQ_ITEMS = [
  {
    id: 'min-deposit',
    question: 'Maallaqni xiqqaan galchuu (Minimum Deposit) meeqa?',
    answer:
      'Maallaqni xiqqaan kuufachuu (Minimum Deposit) dandeessan 10 ETB dha. Haa ta’u malee ramaddiiwwan taphaa hedduu irratti hirmaachuuf 50 ETB, 100 ETB ykn isaa ol CBE Bank, Awash Bank ykn Telebirr dhaan galchuu dandeessu.',
  },
  {
    id: 'referral-bonus',
    question: 'Hiriyoota koo afeeruun (Referral System) badhaasa meeqa naaf kenna?',
    answer:
      'Koodii Afeerraa (Referral Code) ykn liinkii keessan hiriyoota keessaniif yeroo qooddan, namni haaraan koodii keessaniin yeroo galmaa’u isinis ta’e hiriyaan keessan haaraan battalumatti badhaasa +15 ETB (waliigala 30 ETB) herrega keessan irratti argattu!',
  },
  {
    id: 'numbers-1-300',
    question: 'Lakkoofsi 1 hanga 300 akkamitti waamama?',
    answer:
      'Taphni keenya gabatee guddaa 1 hanga 300 (B: 1-60, I: 61-120, N: 121-180, G: 181-240, O: 241-300) qaba. Lakkoofsonni 300 hunduu gabatee gadii irratti ifatti mul’atu, kubbaan yeroo waamamus achii keessaa filatamee sagaleedhaan waamama.',
  },
  {
    id: 'deposit-approval-time',
    question: 'Birrii ergeen booda yeroo hangamii keessatti Admin mirkaneessa (Approve godha)?',
    answer:
      'Erguma maallaqa ergitanii Transaction Reference (FT ykn SMS ID) galchitaniin booda, Admin keenya daqiiqaa 1 hanga 5 keessatti ilaalee mirkaneessa (Approve godha). Akkuma Approved ta’een battalumatti herrega (Balance) keessan irratti dabalama.',
  },
  {
    id: 'withdrawal-time',
    question: 'Maallaqa mo’adhe yeroon baafadhu (Withdrawal Time) hangam fudhata?',
    answer:
      'Gaaffii baafannaa (Withdraw) kutaa "Birrii Galchi & Baasi" keessatti yeroo ergitan, Admin mirkaneessee daqiiqaa 5 hanga 15 keessatti kallattiin gara herrega CBE Bank, Awash Bank ykn Telebirr keessaniitti isiniif erga. Maallaqni xiqqaan baafachuu dandeessan (Minimum Withdrawal) 50 ETB dha.',
  },
  {
    id: 'publishing-free',
    question: 'Appii kana fayyadamuuf ykn Publish gochuuf kaffaltiin ykn Card baankii barbaachisaa?',
    answer:
      'LAKKI! Wanti kaffaltan tokkollee hin jiru! Card baankii (Credit/Debit Card) homaa hin barbaachisu. Appiin kun 100% BILISAAN (Free) kan hojjetame yoo ta\'u, liinkii qophaa\'ee jiru qofa qooddanii (Share gootanii) Telegram ykn WhatsApp irratti namootaaf erguun battalumatti taphachuu dandeessu!',
  },
];

const OFFICIAL_PUBLIC_SHARE_URL = 'https://ais-pre-db643kuftztifvbfehrc5g-345530332273.europe-west1.run.app';

function generateReferralCodeFromUid(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `FB${clean.slice(0, 6)}`;
}

function getCleanPublicSiteUrl(): string {
  if (typeof window === 'undefined') return OFFICIAL_PUBLIC_SHARE_URL;
  if (window.location.origin.includes('ais-dev-')) {
    return OFFICIAL_PUBLIC_SHARE_URL;
  }
  return `${window.location.origin}${window.location.pathname}`;
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<'play' | 'wallet' | 'history' | 'rules' | 'admin'>('play');

  // Onboarding / Profile setup state for new users
  const [setupName, setSetupName] = useState<string>('');
  const [setupPhone, setSetupPhone] = useState<string>('');
  const [setupReferralCode, setSetupReferralCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (params.get('ref') || '').toUpperCase().trim().slice(0, 20);
    }
    return '';
  });
  const [referralFeedback, setReferralFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [needsPhoneSetup, setNeedsPhoneSetup] = useState<boolean>(false);

  // Referral sharing state
  const [copiedRefCode, setCopiedRefCode] = useState<boolean>(false);
  const [copiedRefLink, setCopiedRefLink] = useState<boolean>(false);
  const [copiedSiteUrl, setCopiedSiteUrl] = useState<boolean>(false);
  const [lateReferralInput, setLateReferralInput] = useState<string>('');
  const [applyingLateRef, setApplyingLateRef] = useState<boolean>(false);
  const [myReferralsList, setMyReferralsList] = useState<ReferralClaimData[]>([]);

  // Wallet form states
  const [walletMode, setWalletMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedMethod, setSelectedMethod] = useState<'CBE' | 'Awash' | 'Telebirr'>('CBE');
  const [txAmount, setTxAmount] = useState<string>('100');
  const [txReference, setTxReference] = useState<string>('');
  const [txSenderName, setTxSenderName] = useState<string>('');
  const [submittingTx, setSubmittingTx] = useState<boolean>(false);
  const [walletNotice, setWalletNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // User transactions, game history, and Top 5 Winners Leaderboard
  const [myTransactions, setMyTransactions] = useState<TransactionData[]>([]);
  const [myGames, setMyGames] = useState<GameHistoryData[]>([]);
  const [topWinners, setTopWinners] = useState<LeaderboardEntryData[]>([]);

  // FAQ Accordion state
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0].id);

  // Global persistent sound toggle state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundEngine.isSoundEnabled());

  const handleToggleGlobalSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.setSoundEnabled(next);
    if (next) {
      soundEngine.playBallPop();
    }
  };

  // Admin state
  const [allTransactions, setAllTransactions] = useState<TransactionData[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfileData[]>([]);
  const [adminFilter, setAdminFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [processingTxId, setProcessingTxId] = useState<string | null>(null);
  const [adminStatusMsg, setAdminStatusMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin passcode unlock for owner on any device
  const [adminUnlockedByPin, setAdminUnlockedByPin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('frenzy_admin_unlocked') === 'true';
    }
    return false;
  });
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  const isUserAdmin =
    Boolean(firebaseUser?.email && firebaseUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ||
    profile?.role === 'admin' ||
    adminUnlockedByPin;

  // Helper to sync user's non-PII stats to /leaderboard/{uid}
  const syncLeaderboardEntry = async (uid: string, displayName: string, totalWins: number, totalPlayed: number) => {
    const lbPath = `leaderboard/${uid}`;
    try {
      await setDoc(doc(db, 'leaderboard', uid), {
        uid,
        displayName: displayName.slice(0, 75),
        totalWins,
        totalPlayed,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, lbPath);
    }
  };

  // Ensure user's unique referral code is registered in /referral_codes/{code}
  const ensureReferralCodeRegistered = async (uid: string, displayName: string, code: string) => {
    const codePath = `referral_codes/${code}`;
    try {
      const snap = await getDoc(doc(db, 'referral_codes', code));
      if (!snap.exists()) {
        await setDoc(doc(db, 'referral_codes', code), {
          code,
          ownerUid: uid,
          ownerName: displayName.slice(0, 75),
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, codePath);
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      const userPath = `users/${user.uid}`;
      const myOwnCode = generateReferralCodeFromUid(user.uid);

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          const initialRole =
            user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
          const defaultName = (user.displayName || user.email?.split('@')[0] || 'Taphataa Bingo').slice(0, 75);
          const newProfile = {
            uid: user.uid,
            displayName: defaultName,
            phone: '',
            email: (user.email || 'user@example.com').slice(0, 115),
            balance: 10,
            totalWins: 0,
            totalPlayed: 0,
            referralCode: myOwnCode,
            referredBy: '',
            referralCount: 0,
            role: initialRole,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          await ensureReferralCodeRegistered(user.uid, defaultName, myOwnCode);
          await syncLeaderboardEntry(user.uid, defaultName, 0, 0);
          setSetupName(defaultName);
          setNeedsPhoneSetup(true);
        } else {
          const data = snap.data() as UserProfileData;
          if (!data.phone) {
            setSetupName(data.displayName);
            setNeedsPhoneSetup(true);
          }
          // Backfill referralCode for older accounts if missing
          const activeCode = data.referralCode || myOwnCode;
          if (!data.referralCode) {
            await updateDoc(doc(db, 'users', user.uid), {
              referralCode: activeCode,
              referredBy: data.referredBy || '',
              referralCount: data.referralCount || 0,
              updatedAt: serverTimestamp(),
            });
          }
          await ensureReferralCodeRegistered(user.uid, data.displayName, activeCode);

          const lbSnap = await getDoc(doc(db, 'leaderboard', user.uid));
          if (!lbSnap.exists()) {
            await syncLeaderboardEntry(user.uid, data.displayName, data.totalWins || 0, data.totalPlayed || 0);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, userPath);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Listen to current user's profile in real-time
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfileData;
          setProfile(data);
          if (!txSenderName && data.displayName) {
            setTxSenderName(data.displayName);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`)
    );
    return () => unsub();
  }, [authReady, firebaseUser, txSenderName]);

  // Listen to Referrals where current user is the referrer, auto-crediting +15 ETB bonus for unclaimed referrals!
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const refQuery = query(collection(db, 'referrals'), where('referrerUid', '==', firebaseUser.uid));
    const unsubRef = onSnapshot(
      refQuery,
      async (snap) => {
        const claims: ReferralClaimData[] = snap.docs.map((d) => d.data() as ReferralClaimData);
        setMyReferralsList(claims);

        // Check for any unclaimed referral bonuses and credit them automatically to the referrer's balance
        const unclaimed = claims.filter((c) => !c.referrerClaimed);
        if (unclaimed.length > 0) {
          for (const claim of unclaimed) {
            try {
              const userRef = doc(db, 'users', firebaseUser.uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const uData = userSnap.data() as UserProfileData;
                const nextBal = Number((uData.balance + claim.bonusAmount).toFixed(2));
                const nextRefCount = (uData.referralCount || 0) + 1;
                await updateDoc(userRef, {
                  balance: nextBal,
                  referralCount: nextRefCount,
                  updatedAt: serverTimestamp(),
                });
                await updateDoc(doc(db, 'referrals', claim.newUserUid), {
                  referrerClaimed: true,
                  updatedAt: serverTimestamp(),
                });
              }
            } catch (err) {
              console.error('Error claiming referral reward:', err);
            }
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'referrals')
    );

    return () => unsubRef();
  }, [authReady, firebaseUser]);

  // Listen to Top 5 Winners Leaderboard, current user's transactions, and games
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const lbQuery = query(
      collection(db, 'leaderboard'),
      where('totalWins', '>=', 0),
      orderBy('totalWins', 'desc'),
      limit(5)
    );
    const unsubLb = onSnapshot(
      lbQuery,
      (snap) => {
        const list: LeaderboardEntryData[] = snap.docs.map((d) => d.data() as LeaderboardEntryData);
        list.sort((a, b) => b.totalWins - a.totalWins || b.totalPlayed - a.totalPlayed);
        setTopWinners(list.slice(0, 5));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'leaderboard')
    );

    const txQuery = query(collection(db, 'transactions'), where('userId', '==', firebaseUser.uid));
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        const list: TransactionData[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TransactionData, 'id'>),
        }));
        list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setMyTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const gamesQuery = query(collection(db, 'games'), where('userId', '==', firebaseUser.uid));
    const unsubGames = onSnapshot(
      gamesQuery,
      (snap) => {
        const list: GameHistoryData[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GameHistoryData, 'id'>),
        }));
        list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setMyGames(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'games')
    );

    return () => {
      unsubLb();
      unsubTx();
      unsubGames();
    };
  }, [authReady, firebaseUser]);

  // Listen to ALL transactions and users if Admin
  useEffect(() => {
    if (!authReady || !firebaseUser || !isUserAdmin) return;

    const unsubAllTx = onSnapshot(
      collection(db, 'transactions'),
      (snap) => {
        const list: TransactionData[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TransactionData, 'id'>),
        }));
        list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setAllTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const unsubAllUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfileData[] = snap.docs.map((d) => d.data() as UserProfileData);
        setAllUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => {
      unsubAllTx();
      unsubAllUsers();
    };
  }, [authReady, firebaseUser, isUserAdmin]);

  // Sign in with Google
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Sign in failed:', err);
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Pop-up browser keessaniin cufameera. Maaloo pop-up eeyyamaatii irra deebi\'aa yaalaa.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Funtilli Google sign-in cufameera. Maaloo irra deebi\'aa yaalaa.');
      } else {
        setAuthError('Seensii Google hin milkoofne: ' + (err?.message || 'Irra deebi\'aa yaalaa.'));
      }
    }
  };

  const handleUnlockAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPinError(null);
    const cleanPin = adminPinInput.trim().toLowerCase();
    if (cleanPin === '7788' || cleanPin === 'wsas1271' || cleanPin === 'admin2026') {
      setAdminUnlockedByPin(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('frenzy_admin_unlocked', 'true');
      }
      setShowAdminPinModal(false);
      setActiveTab('admin');
      setAdminPinInput('');
    } else {
      setAdminPinError('Koodiin Admin sirrii miti! (PIN dogoggora)');
    }
  };

  const handleLockAdminPin = () => {
    setAdminUnlockedByPin(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('frenzy_admin_unlocked');
    }
    setActiveTab('play');
  };

  // Validate and apply a friend's referral code for the current user
  const applyFriendReferralCode = async (rawCode: string, userNameToUse: string): Promise<{ applied: boolean; message: string }> => {
    if (!firebaseUser || !profile) return { applied: false, message: '' };
    const cleanCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) return { applied: false, message: '' };

    if (profile.referredBy) {
      return { applied: false, message: 'Koodii afeerraa duraan fayyadamtanii jirtu.' };
    }

    const myOwnCode = profile.referralCode || generateReferralCodeFromUid(firebaseUser.uid);
    if (cleanCode === myOwnCode) {
      return { applied: false, message: 'Koodii afeerraa ofii keessanii fayyadamuu hin dandeessan!' };
    }

    const codeRef = doc(db, 'referral_codes', cleanCode);
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) {
      return { applied: false, message: 'Koodiin afeerraa galchitan dogoggora ykn hin jiru.' };
    }

    const codeData = codeSnap.data() as { code: string; ownerUid: string; ownerName: string };
    if (codeData.ownerUid === firebaseUser.uid) {
      return { applied: false, message: 'Koodii afeerraa ofii keessanii fayyadamuu hin dandeessan!' };
    }

    // Check if referral doc already exists for this user
    const existingClaim = await getDoc(doc(db, 'referrals', firebaseUser.uid));
    if (existingClaim.exists()) {
      return { applied: false, message: 'Badhaasa afeerraa duraan fudhattanii jirtu.' };
    }

    // Create /referrals/{newUserId} claim document so referrer gets +15 ETB
    await setDoc(doc(db, 'referrals', firebaseUser.uid), {
      referrerUid: codeData.ownerUid,
      referrerCode: cleanCode,
      newUserUid: firebaseUser.uid,
      newUserName: userNameToUse.slice(0, 75),
      bonusAmount: REFERRAL_BONUS_ETB,
      referrerClaimed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Credit new user +15 ETB immediately and record referredBy
    const userRef = doc(db, 'users', firebaseUser.uid);
    const freshSnap = await getDoc(userRef);
    const currentBal = freshSnap.exists() ? (freshSnap.data() as UserProfileData).balance : profile.balance;

    await updateDoc(userRef, {
      balance: Number((currentBal + REFERRAL_BONUS_ETB).toFixed(2)),
      referredBy: cleanCode,
      updatedAt: serverTimestamp(),
    });

    return {
      applied: true,
      message: `Baga gammaddan! Koodii ${cleanCode} (${codeData.ownerName}) fayyadamuun isinii fi hiriyaa keessaniif badhaasni +${REFERRAL_BONUS_ETB} ETB dabalameera!`,
    };
  };

  // Complete Account Registration (Name + Phone Number + Optional Referral Code)
  const handleSaveAccountDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const cleanName = setupName.trim().slice(0, 75);
    const cleanPhone = setupPhone.trim().slice(0, 25);
    if (!cleanName || cleanPhone.length < 9) return;

    setSavingProfile(true);
    setReferralFeedback(null);

    try {
      const myOwnCode = profile?.referralCode || generateReferralCodeFromUid(firebaseUser.uid);
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        displayName: cleanName,
        phone: cleanPhone,
        referralCode: myOwnCode,
        updatedAt: serverTimestamp(),
      });
      await ensureReferralCodeRegistered(firebaseUser.uid, cleanName, myOwnCode);
      await syncLeaderboardEntry(
        firebaseUser.uid,
        cleanName,
        profile?.totalWins || 0,
        profile?.totalPlayed || 0
      );

      if (setupReferralCode.trim()) {
        const res = await applyFriendReferralCode(setupReferralCode, cleanName);
        if (!res.applied && res.message) {
          setReferralFeedback({ text: res.message, type: 'error' });
          setSavingProfile(false);
          return;
        }
        if (res.applied) {
          setReferralFeedback({ text: res.message, type: 'success' });
        }
      }

      setNeedsPhoneSetup(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    } finally {
      setSavingProfile(false);
    }
  };

  // Apply referral code later if user skipped during initial onboarding
  const handleApplyLateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile || !lateReferralInput.trim()) return;
    setApplyingLateRef(true);
    setReferralFeedback(null);
    try {
      const res = await applyFriendReferralCode(lateReferralInput, profile.displayName);
      if (res.applied) {
        setReferralFeedback({ text: res.message, type: 'success' });
        setLateReferralInput('');
      } else if (res.message) {
        setReferralFeedback({ text: res.message, type: 'error' });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `referrals/${firebaseUser.uid}`);
    } finally {
      setApplyingLateRef(false);
    }
  };

  // Copy bank account number
  const handleCopyAccount = (accNum: string) => {
    navigator.clipboard.writeText(accNum);
    setCopiedAccount(accNum);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  // Copy user's referral code or invite link
  const handleCopyMyReferralCode = () => {
    const code = profile?.referralCode || (firebaseUser ? generateReferralCodeFromUid(firebaseUser.uid) : '');
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedRefCode(true);
    setTimeout(() => setCopiedRefCode(false), 2000);
  };

  const handleCopyMyReferralLink = () => {
    const code = profile?.referralCode || (firebaseUser ? generateReferralCodeFromUid(firebaseUser.uid) : '');
    if (!code || typeof window === 'undefined') return;
    const inviteUrl = `${getCleanPublicSiteUrl()}?ref=${code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedRefLink(true);
    setTimeout(() => setCopiedRefLink(false), 2000);
  };

  const handleCopyPublicSiteUrl = () => {
    const cleanUrl = getCleanPublicSiteUrl();
    navigator.clipboard.writeText(cleanUrl);
    setCopiedSiteUrl(true);
    setTimeout(() => setCopiedSiteUrl(false), 2000);
  };

  // Submit Deposit or Withdrawal Request
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;

    const amountNum = Number(txAmount);
    if (isNaN(amountNum) || amountNum < 10 || amountNum > 500000) {
      setWalletNotice({ text: 'Maaloo maallaqa sirrii (10 ETB - 500,000 ETB) galchaa.', type: 'error' });
      return;
    }

    const cleanRef = txReference.trim().slice(0, 75);
    const cleanSender = txSenderName.trim().slice(0, 75);

    if (cleanRef.length < 2 || cleanSender.length < 2) {
      setWalletNotice({
        text:
          walletMode === 'deposit'
            ? 'Maqaa ergaa fi Lakkoofsa Mirkaneessaa (Transaction Ref / SMS ID) galchaa.'
            : 'Maqaa abbaa herregaa fi Lakkoofsa Baankii/Telebirr keessan galchaa.',
        type: 'error',
      });
      return;
    }

    if (walletMode === 'withdraw' && profile.balance < amountNum) {
      setWalletNotice({
        text: 'Herregni keessan gahaa miti! Maaloo hamma qabdan qofa baafadhaa.',
        type: 'error',
      });
      return;
    }

    setSubmittingTx(true);
    setWalletNotice(null);
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      if (walletMode === 'withdraw') {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          balance: Number((profile.balance - amountNum).toFixed(2)),
          totalWins: profile.totalWins,
          totalPlayed: profile.totalPlayed,
          updatedAt: serverTimestamp(),
        });
      }

      await setDoc(doc(db, 'transactions', txId), {
        userId: firebaseUser.uid,
        userName: profile.displayName.slice(0, 75),
        userPhone: (profile.phone || '0900000000').slice(0, 25),
        type: walletMode,
        method: selectedMethod,
        amount: amountNum,
        referenceCode: cleanRef,
        senderOrReceiverName: cleanSender,
        status: 'pending',
        adminNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTxReference('');
      setWalletNotice({
        text:
          walletMode === 'deposit'
            ? 'Gaaffiin kuufannaa (Deposit) keessan ergameera! Admin mirkaneessanii akkuma Approved godhaniin herrega keessan irratti ni dabalama.'
            : 'Gaaffiin baafannaa (Withdraw) keessan ergameera! Admin mirkaneessanii herrega keessatti isiniif ergu.',
        type: 'success',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `transactions/${txId}`);
    } finally {
      setSubmittingTx(false);
    }
  };

  // Admin: Approve or Reject a Transaction
  const handleAdminReviewTransaction = async (tx: TransactionData, decision: 'approved' | 'rejected') => {
    if (!isUserAdmin || processingTxId) return;
    setProcessingTxId(tx.id);
    setAdminStatusMsg(null);

    try {
      const userRef = doc(db, 'users', tx.userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfileData;
        if (tx.type === 'deposit' && decision === 'approved') {
          const nextBalance = Number((userData.balance + tx.amount).toFixed(2));
          await updateDoc(userRef, {
            balance: nextBalance,
            updatedAt: serverTimestamp(),
          });
        } else if (tx.type === 'withdraw' && decision === 'rejected') {
          const refundedBalance = Number((userData.balance + tx.amount).toFixed(2));
          await updateDoc(userRef, {
            balance: refundedBalance,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await updateDoc(doc(db, 'transactions', tx.id), {
        status: decision,
        adminNote: decision === 'approved' ? 'Confirmed by Admin' : 'Declined by Admin',
        updatedAt: serverTimestamp(),
      });

      setAdminStatusMsg(
        decision === 'approved'
          ? `Kaffaltiin ${tx.userName} (${tx.amount} ETB - ${tx.method}) mirkanaa'ee APPROVED ta'eera!`
          : `Gaaffiin ${tx.userName} (${tx.amount} ETB) REJECTED ta'eera.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${tx.id}`);
    } finally {
      setProcessingTxId(null);
    }
  };

  // Admin: Direct Top-Up (+50 ETB or +100 ETB) to any registered player's account
  const handleAdminQuickTopUp = async (targetUser: UserProfileData, addAmount: number) => {
    if (!isUserAdmin) return;
    setAdminStatusMsg(null);
    try {
      const nextBal = Number((targetUser.balance + addAmount).toFixed(2));
      await updateDoc(doc(db, 'users', targetUser.uid), {
        balance: nextBal,
        updatedAt: serverTimestamp(),
      });
      setAdminStatusMsg(
        `Herrega ${targetUser.displayName} irratti +${addAmount} ETB dabalameera! (Balance Haaraa: ${nextBal} ETB)`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  // Deduct stake when starting a Bingo Frenzy match
  const handleStartBingoMatch = async (stake: number): Promise<boolean> => {
    if (!firebaseUser || !profile) return false;
    if (profile.balance < stake) {
      setActiveTab('wallet');
      return false;
    }

    try {
      const nextBalance = Number((profile.balance - stake).toFixed(2));
      const nextPlayed = profile.totalPlayed + 1;
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        balance: nextBalance,
        totalWins: profile.totalWins,
        totalPlayed: nextPlayed,
        updatedAt: serverTimestamp(),
      });
      await syncLeaderboardEntry(firebaseUser.uid, profile.displayName, profile.totalWins, nextPlayed);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      return false;
    }
  };

  // Credit prize & log match history when Bingo match finishes
  const handleFinishBingoMatch = async (
    result: 'won' | 'lost',
    stake: number,
    prize: number,
    bingoType: string,
    ballsCount: number
  ) => {
    if (!firebaseUser || !profile) return;
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      if (result === 'won' && prize > 0) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const currentBal = snap.exists() ? (snap.data() as UserProfileData).balance : profile.balance;
        const currentWins = snap.exists() ? (snap.data() as UserProfileData).totalWins : profile.totalWins;
        const currentPlayed = snap.exists() ? (snap.data() as UserProfileData).totalPlayed : profile.totalPlayed;
        const nextWins = currentWins + 1;

        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          balance: Number((currentBal + prize).toFixed(2)),
          totalWins: nextWins,
          totalPlayed: currentPlayed,
          updatedAt: serverTimestamp(),
        });
        await syncLeaderboardEntry(firebaseUser.uid, profile.displayName, nextWins, currentPlayed);
      }

      await setDoc(doc(db, 'games', gameId), {
        userId: firebaseUser.uid,
        userName: profile.displayName.slice(0, 75),
        stake,
        prize,
        result,
        bingoType: bingoType.slice(0, 48),
        ballsCalledCount: Math.min(300, Math.max(1, ballsCount)),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `games/${gameId}`);
    }
  };

  const pendingCount = allTransactions.filter((t) => t.status === 'pending').length;
  const myActiveReferralCode =
    profile?.referralCode || (firebaseUser ? generateReferralCodeFromUid(firebaseUser.uid) : '');

  // Loading state
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full border-4 border-amber-400 border-t-transparent animate-spin mb-4" />
        <p className="font-display text-xl text-white">Frenzy Bingo Ethiopia Baniinsa Irra Jira...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('play');
          }}
          className="font-display text-xl sm:text-2xl font-bold tracking-tight text-amber-400 whitespace-nowrap"
        >
          Frenzy Bingo Ethiopia
        </a>

        {/* Zone 2: 4-5 Clean Text Navigation Links */}
        {firebaseUser && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-300">
            <button
              onClick={() => setActiveTab('play')}
              className={`hover:text-white transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'play' ? 'text-amber-400 underline underline-offset-8 decoration-2' : ''
              }`}
            >
              Tapha Bingo (1-300)
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`hover:text-white transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'wallet' ? 'text-amber-400 underline underline-offset-8 decoration-2' : ''
              }`}
            >
              Birrii Galchi & Baasi
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`hover:text-white transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'history' ? 'text-amber-400 underline underline-offset-8 decoration-2' : ''
              }`}
            >
              Seenaa Kaffaltii
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`hover:text-white transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'rules' ? 'text-amber-400 underline underline-offset-8 decoration-2' : ''
              }`}
            >
              Seera Taphaa
            </button>
            {isUserAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`hover:text-white transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'admin' ? 'text-emerald-400 underline underline-offset-8 decoration-2' : 'text-emerald-300'
                }`}
              >
                Admin Approval ({pendingCount})
              </button>
            )}
          </nav>
        )}

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Free Share App Link Button */}
          <button
            type="button"
            onClick={handleCopyPublicSiteUrl}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              copiedSiteUrl
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Liinkii Appii Garagalchi (Bilisaan Namootaaf Ergi)"
          >
            {copiedSiteUrl ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Garagalfameera!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Liinkii Qoodi</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleGlobalSound}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              soundEnabled
                ? 'bg-slate-900 border-emerald-500/40 text-emerald-300 hover:bg-slate-800'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800'
            }`}
            title={soundEnabled ? 'Sagalee Cufi (Sound Off)' : 'Sagalee Bani (Sound On)'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Sound: On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Sound: Off</span>
              </>
            )}
          </button>

          {firebaseUser && profile ? (
            <>
              <button
                onClick={() => setActiveTab('wallet')}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-extrabold text-xs sm:text-sm font-mono-num shadow-md hover:brightness-105 transition-all whitespace-nowrap cursor-pointer"
              >
                {profile.balance.toFixed(2)} ETB · +Galchi
              </button>
              <button
                onClick={() => signOut(auth)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Ba'i (Sign Out)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg hover:brightness-105 transition-all whitespace-nowrap cursor-pointer"
            >
              Akkaawuntii Bani / Seeni
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation Tabs when logged in */}
      {firebaseUser && (
        <div className="md:hidden flex items-center justify-around bg-slate-900 border-b border-white/10 px-2 py-2 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('play')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
              activeTab === 'play' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            Bingo (1-300)
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
              activeTab === 'wallet' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            Birrii Galchi
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
              activeTab === 'history' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            Seenaa
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
              activeTab === 'rules' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            Seera & FAQ
          </button>
          {isUserAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                activeTab === 'admin' ? 'bg-emerald-400 text-slate-950' : 'text-emerald-300 border border-emerald-500/40'
              }`}
            >
              Admin ({pendingCount})
            </button>
          )}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* IF NOT LOGGED IN: Welcome & Step-by-Step Account Creation + Bank Preview */}
        {!firebaseUser ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4">
            {/* Left Column: Hero Pitch & 3-Step Flow */}
            <div className="lg:col-span-7 space-y-6">
              <div className="text-xs sm:text-sm font-semibold text-amber-400 tracking-wide">
                Akkuma Seentaniin +10 ETB Welcome Bonus · Namni Tokko Kaartelaa 4 Qabachuu Danda&apos;a!
              </div>

              <h1
                className="font-display text-3xl sm:text-5xl font-extrabold text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Dura Akkaawuntii Uummadhaa (+10 ETB Bonus Fudhadhaa), Kaartelaa 1 Hanga 4 Filadhaatii Taphadhaa!
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                Akkuma dura seentaniin <strong>10 ETB Welcome Bonus</strong> battalumatti herrega keessan irratti argattu! Gabatee <strong>1 hanga 300</strong> keessaa yeroo tokkotti <strong>Kaartelaa 1 hanga 4</strong> filachuun taphattoota hedduu waliin dorgomtanii Derash guddaa mo&apos;adhaa.
              </p>

              {/* 3-Step Journey */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-900/90 p-4 rounded-2xl border border-white/10">
                  <div className="font-display font-bold text-amber-400 text-lg mb-1">01. +10 ETB Bonus</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Akkuma dura seentaniin 10 ETB Bonus bilisaa battalumatti argattu; dabalataan koodii hiriyaatiin +15 ETB fudhadhaa.
                  </p>
                </div>
                <div className="bg-slate-900/90 p-4 rounded-2xl border border-white/10">
                  <div className="font-display font-bold text-emerald-400 text-lg mb-1">02. Birrii Galfadhu</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    CBE, Awash Bank, ykn Telebirr irratti erguun Admin akkuma Approved godheen herregni ni guutama.
                  </p>
                </div>
                <div className="bg-slate-900/90 p-4 rounded-2xl border border-white/10">
                  <div className="font-display font-bold text-sky-400 text-lg mb-1">03. Kaartelaa 4 Filadhu</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Lakkoofsa 1 hanga 300 keessaa Kaartelaa 1 hanga 4 filachuun Auto-Mark dhaan Derash mo&apos;adhaa!
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col items-start gap-3">
                <button
                  onClick={handleGoogleSignIn}
                  className="px-7 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white font-display font-extrabold text-lg shadow-xl shadow-orange-500/25 hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
                >
                  Seeni & +10 ETB Bonus Fudhadhu
                </button>
                {authError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold max-w-md">
                    {authError}
                  </div>
                )}

                {/* Free Share Box - No payment/card needed */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 max-w-xl mt-2">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Liinkii Taphataa (100% Bilisa · Kaffaltii Hin Qabu)</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Card baankii malee Telegram ykn WhatsApp irratti namootaaf erguun battalumatti taphachiisaa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPublicSiteUrl}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    {copiedSiteUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSiteUrl ? 'Garagalfameera!' : 'Liinkii Garagalchi'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Official Payment Accounts */}
            <div className="lg:col-span-5 bg-slate-900/90 rounded-3xl p-6 border border-white/15 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="font-display font-bold text-xl text-white">Herrega Baankii Kaffaltii</h2>
                  <p className="text-xs text-slate-400">Maallaqa galchuuf herrega armaan gadii fayyadamaa</p>
                </div>
                <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
              </div>

              <div className="space-y-3">
                {PAYMENT_ACCOUNTS.map((acc) => (
                  <div
                    key={acc.id}
                    className={`p-4 rounded-2xl bg-gradient-to-r ${acc.badgeColor} border ${acc.borderColor} shadow-lg`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-white/90">
                        {acc.bankName}
                      </span>
                      <button
                        onClick={() => handleCopyAccount(acc.accountNumber)}
                        className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        {copiedAccount === acc.accountNumber ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" /> Waraabameera
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono-num text-xl sm:text-2xl font-extrabold text-white tracking-wider mt-1">
                      {acc.accountNumber}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-white/90 mt-0.5">
                      Maqaa: <strong className="font-bold text-amber-200">{acc.holderName}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-base shadow-lg transition-all cursor-pointer whitespace-nowrap"
              >
                Seenaatii Birrii Galfadhaa
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ONBOARDING MODAL FOR NEW USERS TO COMPLETE PHONE, NAME & REFERRAL CODE */}
            {needsPhoneSetup && (
              <div className="mb-8 bg-gradient-to-r from-amber-500/20 via-slate-900 to-emerald-500/20 rounded-3xl p-6 border-2 border-amber-400/50 shadow-2xl">
                <form onSubmit={handleSaveAccountDetails} className="max-w-3xl mx-auto space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-7 h-7 text-amber-400" />
                    <div>
                      <h2 className="font-display font-bold text-xl text-white">
                        Baga Nagaan Dhuftan! +10 ETB Welcome Bonus Herrega Keessan Irratti Dabalameera!
                      </h2>
                      <p className="text-xs text-slate-300">
                        Maqaa guutuu, lakkoofsa bilbilaa, fi yoo hiriyaan isin afeere Koodii Afeerraa (+15 ETB dabalataa) galchaa.
                      </p>
                    </div>
                  </div>

                  {referralFeedback && (
                    <div
                      className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold border ${
                        referralFeedback.type === 'success'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-rose-500/20 border-rose-400 text-rose-200'
                      }`}
                    >
                      {referralFeedback.text}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Maqaa Guutuu</label>
                      <input
                        type="text"
                        required
                        value={setupName}
                        onChange={(e) => setSetupName(e.target.value)}
                        placeholder="Fkn: Abebe Kebede"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Lakkoofsa Bilbilaa (Telebirr / Bilbila)
                      </label>
                      <input
                        type="tel"
                        required
                        value={setupPhone}
                        onChange={(e) => setSetupPhone(e.target.value)}
                        placeholder="Fkn: 0911223344"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-sm font-mono-num focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-emerald-300 mb-1">
                        Koodii Afeerraa / Referral Code (Filannoo)
                      </label>
                      <input
                        type="text"
                        value={setupReferralCode}
                        onChange={(e) => setSetupReferralCode(e.target.value.toUpperCase())}
                        placeholder="Fkn: FB1A2B3C (+15 ETB)"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-emerald-400/40 text-emerald-300 text-sm font-mono-num uppercase focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm shadow-lg cursor-pointer whitespace-nowrap"
                  >
                    {savingProfile ? 'Olkaa’aa Jira...' : 'Akkaawuntii Galmeessi & Badhaasa Fudhadhu'}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 1: PLAY BINGO FRENZY (1-300) + REFERRAL HUB + TOP WINNERS LEADERBOARD */}
            {activeTab === 'play' && (
              <div className="space-y-8">
                {/* Banner prompting deposit if balance is 0 */}
                {(profile?.balance || 0) === 0 && (
                  <div className="bg-slate-900/90 border border-amber-400/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Wallet className="w-6 h-6 text-amber-400 shrink-0" />
                      <div>
                        <h3 className="font-display font-bold text-base text-white">
                          Birrii Galfadhaa Ykn Hiriyoota Afeeruun +15 ETB Argadhaa!
                        </h3>
                        <p className="text-xs text-slate-300">
                          CBE Bank, Awash Bank ykn Telebirr dhaan birrii galchaa, ykn koodii afeerraa keessan qooduun badhaasaan taphadhaa.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('wallet')}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-slate-950 font-display font-extrabold text-sm shadow-md cursor-pointer whitespace-nowrap"
                    >
                      Amma Birrii Galchi (Deposit)
                    </button>
                  </div>
                )}

                <BingoArena
                  userId={firebaseUser?.uid || ''}
                  userBalance={profile?.balance || 0}
                  userName={profile?.displayName || 'Taphataa'}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleGlobalSound}
                  onStartMatch={handleStartBingoMatch}
                  onFinishMatch={handleFinishBingoMatch}
                  onOpenWallet={() => setActiveTab('wallet')}
                />

                {/* INVITE FRIENDS / REFERRAL BONUS SECTION */}
                <section className="w-full max-w-6xl mx-auto bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-xl space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-3">
                      <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                        <Gift className="w-4 h-4" />
                        Hiriyoota Afeeraa · Lachuu Keessan +{REFERRAL_BONUS_ETB} ETB Argadhaa
                      </div>
                      <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                        Koodii Afeerraa (Referral Code) Keessaniin Badhaasa Guurradhaa!
                      </h2>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Koodii afeerraa keessan hiriyoota keessaniif ergaa. Yeroo hiriyaan haaraan koodii keessan galchee galmaa&apos;u, <strong>isinis +{REFERRAL_BONUS_ETB} ETB</strong>, <strong>hiriyaan keessanis +{REFERRAL_BONUS_ETB} ETB</strong> battalumatti herrega (Balance) irratti argattu!
                      </p>

                      {referralFeedback && !needsPhoneSetup && (
                        <div
                          className={`p-3 rounded-xl text-xs font-bold border ${
                            referralFeedback.type === 'success'
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                              : 'bg-rose-500/20 border-rose-400 text-rose-200'
                          }`}
                        >
                          {referralFeedback.text}
                        </div>
                      )}

                      {/* If current user hasn't entered a referrer code yet, allow them to redeem one here */}
                      {!profile?.referredBy && (
                        <form onSubmit={handleApplyLateReferral} className="pt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={lateReferralInput}
                            onChange={(e) => setLateReferralInput(e.target.value.toUpperCase())}
                            placeholder="Koodii Hiriyaa Galchi (Fkn: FB1A2B3C)"
                            className="px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-mono-num text-xs sm:text-sm uppercase focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="submit"
                            disabled={applyingLateRef || !lateReferralInput.trim()}
                            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-display font-extrabold text-xs sm:text-sm cursor-pointer whitespace-nowrap"
                          >
                            {applyingLateRef ? 'Mirkaneessaa Jira...' : `+${REFERRAL_BONUS_ETB} ETB Fudhadhu`}
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Right Box: User's Code, Invite Link & Stats */}
                    <div className="lg:col-span-5 bg-slate-950/90 p-5 rounded-2xl border border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400">Koodii Afeerraa Keessan:</span>
                        <span className="text-xs font-mono-num text-emerald-400 font-bold">
                          Namoota Afeeraman: {myReferralsList.length} (+{myReferralsList.length * REFERRAL_BONUS_ETB} ETB)
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 rounded-xl border border-amber-400/40">
                        <span className="font-mono-num text-2xl font-extrabold text-amber-300 tracking-widest">
                          {myActiveReferralCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyMyReferralCode}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          {copiedRefCode ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy Code
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleCopyMyReferralLink}
                          className="py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {copiedRefLink ? (
                            <>
                              <Check className="w-4 h-4" /> Invite Link Copied!
                            </>
                          ) : (
                            <>
                              <Share2 className="w-4 h-4" /> Invite Link Copy
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyPublicSiteUrl}
                          className="py-2.5 px-3 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {copiedSiteUrl ? (
                            <>
                              <Check className="w-4 h-4" /> Website Link Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" /> Website Link Copy
                            </>
                          )}
                        </button>
                      </div>

                      {myReferralsList.length > 0 && (
                        <div className="pt-2 border-t border-white/10 space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-emerald-400" /> Hiriyoota Koodii Keessaniin Seenan:
                          </div>
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {myReferralsList.map((r) => (
                              <div
                                key={r.newUserUid}
                                className="flex items-center justify-between text-xs bg-slate-900/80 px-2.5 py-1 rounded-lg"
                              >
                                <span className="font-semibold text-white truncate">{r.newUserName}</span>
                                <span className="font-mono-num font-bold text-emerald-400">
                                  +{r.bonusAmount} ETB
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* TOP 5 WINNERS SECTION ON DASHBOARD */}
                <section className="w-full max-w-6xl mx-auto bg-slate-900/95 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
                        <Crown className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <h2 className="font-display font-bold text-xl sm:text-2xl text-white">
                          Top Winners — Mo&apos;attoota Ciccimoo 5
                        </h2>
                        <p className="text-xs text-slate-400">
                          Taphattoota lakkoofsa mo&apos;annaa (Total Wins) olaanaa galmeessisan
                        </p>
                      </div>
                    </div>

                    {profile && (
                      <div className="text-xs sm:text-sm text-slate-300 font-mono-num">
                        Sadarkaa Keessan: <strong className="text-amber-400">{profile.totalWins} Wins</strong> ·{' '}
                        <span>{profile.totalPlayed} Matches</span>
                      </div>
                    )}
                  </div>

                  {topWinners.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Hanga ammaatti taphattoonni dorgommii jalqaban hin jiran. Taphachuun sadarkaa 1ffaa qabadhaa!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      {topWinners.map((winner, index) => {
                        const rank = index + 1;
                        const isCurrentUser = winner.uid === firebaseUser?.uid;
                        const winRate =
                          winner.totalPlayed > 0
                            ? Math.round((winner.totalWins / winner.totalPlayed) * 100)
                            : 0;

                        return (
                          <div
                            key={winner.uid}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                              rank === 1
                                ? 'bg-gradient-to-b from-amber-500/20 to-slate-950 border-amber-400/60 shadow-lg'
                                : isCurrentUser
                                ? 'bg-slate-950 border-emerald-400/50'
                                : 'bg-slate-950/80 border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`font-mono-num text-sm font-extrabold ${
                                  rank === 1
                                    ? 'text-amber-400'
                                    : rank === 2
                                    ? 'text-slate-200'
                                    : rank === 3
                                    ? 'text-orange-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                #{rank} {rank === 1 ? 'CHAMPION' : 'PLACE'}
                              </span>
                              {rank === 1 && <Trophy className="w-4 h-4 text-amber-400" />}
                            </div>

                            <div>
                              <div className="font-display font-bold text-base text-white truncate">
                                {winner.displayName}
                                {isCurrentUser ? ' (Si)' : ''}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 font-mono-num">
                                {winner.totalPlayed} taphatame · {winRate}% win rate
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                              <span className="text-xs text-slate-400">Total Wins</span>
                              <span className="font-mono-num text-lg font-extrabold text-emerald-400">
                                {winner.totalWins}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 2: WALLET (DEPOSIT & WITHDRAW WITH CBE, AWASH BANK, TELEBIRR) */}
            {activeTab === 'wallet' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Official Payment Accounts */}
                <div className="lg:col-span-6 space-y-5">
                  <div className="bg-slate-900 rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display font-bold text-2xl text-white">
                          Herrega Baankii Official
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Tarkaanfii 1: Lakkoofsa herregaa armaan gadii keessaa tokko filadhaatii maallaqa ergaa
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Balance Keessan</span>
                        <span className="font-mono-num text-xl font-extrabold text-amber-400">
                          {(profile?.balance || 0).toFixed(2)} ETB
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {PAYMENT_ACCOUNTS.map((acc) => {
                        const isSelected = selectedMethod === acc.id;
                        return (
                          <div
                            key={acc.id}
                            onClick={() => setSelectedMethod(acc.id)}
                            className={`p-5 rounded-2xl bg-gradient-to-r ${acc.badgeColor} border-2 transition-all cursor-pointer ${
                              isSelected ? 'border-white ring-4 ring-amber-400/40 scale-[1.01]' : 'border-white/15 opacity-90'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {acc.iconType === 'bank' ? (
                                  <Building2 className="w-5 h-5 text-amber-200" />
                                ) : (
                                  <Smartphone className="w-5 h-5 text-amber-200" />
                                )}
                                <span className="font-display font-bold text-base text-white">
                                  {acc.bankName}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyAccount(acc.accountNumber);
                                }}
                                className="px-3 py-1 rounded-xl bg-black/35 hover:bg-black/55 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                              >
                                {copiedAccount === acc.accountNumber ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-300" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" /> Lakkoofsa Copy Godhi
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="font-mono-num text-2xl sm:text-3xl font-extrabold text-white tracking-wider my-1">
                              {acc.accountNumber}
                            </div>

                            <div className="text-sm text-white/95">
                              Maqaa Abbaa Herregaa:{' '}
                              <span className="font-extrabold text-amber-200 underline decoration-amber-300/50">
                                {acc.holderName}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Deposit / Withdraw Submission Form */}
                <div className="lg:col-span-6 space-y-5">
                  <div className="bg-slate-900 rounded-3xl p-6 border border-white/10 shadow-xl space-y-5">
                    {/* Mode Switcher */}
                    <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setWalletMode('deposit');
                          setWalletNotice(null);
                        }}
                        className={`py-2.5 px-4 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                          walletMode === 'deposit'
                            ? 'bg-emerald-500 text-slate-950 shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ArrowDownCircle className="w-4 h-4" />
                        Birrii Galchi (Deposit)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWalletMode('withdraw');
                          setWalletNotice(null);
                        }}
                        className={`py-2.5 px-4 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                          walletMode === 'withdraw'
                            ? 'bg-amber-400 text-slate-950 shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                        Birrii Baasi (Withdraw)
                      </button>
                    </div>

                    <div>
                      <h3 className="font-display font-bold text-xl text-white">
                        {walletMode === 'deposit'
                          ? 'Tarkaanfii 2: Mirkaneessa Kaffaltii Ergi'
                          : 'Maallaqa Mo’attan Baafadhaa'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {walletMode === 'deposit'
                          ? 'Erguma maallaqa ergitanii booda, hamma birrii fi Lakkoofsa Transaction (FT / SMS Ref) galchaatii ergaa. Admin mirkaneessanii Approved godhu.'
                          : 'Maallaqa baafachuu barbaaddanii fi lakkoofsa herrega keessanii galchaa.'}
                      </p>
                    </div>

                    {walletNotice && (
                      <div
                        className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold border ${
                          walletNotice.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                            : 'bg-rose-500/15 border-rose-400 text-rose-200'
                        }`}
                      >
                        {walletNotice.text}
                      </div>
                    )}

                    <form onSubmit={handleSubmitTransaction} className="space-y-4">
                      {/* Method Selection Pills */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Filannoo Baankii / Telebirr
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {PAYMENT_ACCOUNTS.map((acc) => (
                            <button
                              type="button"
                              key={acc.id}
                              onClick={() => setSelectedMethod(acc.id)}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                                selectedMethod === acc.id
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                                  : 'bg-slate-950 text-slate-300 border-white/10 hover:bg-slate-800'
                              }`}
                            >
                              {acc.shortName}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quick Amount Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Hamma Maallaqaa (ETB)
                        </label>
                        <div className="grid grid-cols-5 gap-2 mb-2">
                          {[50, 100, 200, 500, 1000].map((amt) => (
                            <button
                              type="button"
                              key={amt}
                              onClick={() => setTxAmount(String(amt))}
                              className={`py-1.5 rounded-lg text-xs font-mono-num font-bold border cursor-pointer ${
                                Number(txAmount) === amt
                                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                                  : 'bg-slate-950 border-white/10 text-slate-400'
                              }`}
                            >
                              {amt}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          min={10}
                          max={500000}
                          required
                          value={txAmount}
                          onChange={(e) => setTxAmount(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-mono-num text-base font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* Sender Name / Receiver Name */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          {walletMode === 'deposit'
                            ? 'Maqaa Nama Maallaqa Ergee (Sender Name)'
                            : 'Maqaa Abbaa Herregaa Maallaqni Itti Ergamu'}
                        </label>
                        <input
                          type="text"
                          required
                          value={txSenderName}
                          onChange={(e) => setTxSenderName(e.target.value)}
                          placeholder="Maqaa guutuu baankii irratti mul'atu"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white text-sm focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* Transaction Reference or Destination Account */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          {walletMode === 'deposit'
                            ? 'Lakkoofsa Mirkaneessaa (Transaction ID / FT / Telebirr Receipt No.)'
                            : `Lakkoofsa Herrega ${selectedMethod} Keessanii`}
                        </label>
                        <input
                          type="text"
                          required
                          value={txReference}
                          onChange={(e) => setTxReference(e.target.value)}
                          placeholder={
                            walletMode === 'deposit'
                              ? 'Fkn: FT26108XYZ ykn Lakkoofsa SMS Telebirr'
                              : 'Fkn: 1000... ykn 09...'
                          }
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-mono-num text-sm focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingTx}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-slate-950 font-display font-extrabold text-base shadow-xl transition-all cursor-pointer whitespace-nowrap"
                      >
                        {submittingTx
                          ? 'Ergaa Jira...'
                          : walletMode === 'deposit'
                          ? `Mirkaneessa Deposit (${txAmount} ETB) Admin-tti Ergi`
                          : `Gaaffii Baafannaa (${txAmount} ETB) Ergi`}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TRANSACTION & GAME HISTORY */}
            {activeTab === 'history' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Deposit / Withdraw Requests List */}
                <div className="lg:col-span-7 bg-slate-900 rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
                  <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-400" />
                    Seenaa Kaffaltii (Deposits & Withdrawals)
                  </h2>

                  {myTransactions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      Hanga ammaatti gaaffiin kaffaltii hin jiru.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span className="font-bold text-white uppercase">{tx.type}</span>
                              <span>·</span>
                              <span className="text-amber-300 font-semibold">{tx.method}</span>
                              <span>·</span>
                              <span className="font-mono-num">Ref: {tx.referenceCode}</span>
                            </div>
                            <div className="text-base font-extrabold text-white font-mono-num mt-1">
                              {tx.type === 'deposit' ? '+' : '-'}
                              {tx.amount.toFixed(2)} ETB
                            </div>
                            <div className="text-xs text-slate-400">
                              Maqaa: {tx.senderOrReceiverName}
                            </div>
                          </div>

                          <div className="text-right">
                            {tx.status === 'pending' && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                                <Clock className="w-4 h-4" /> Eegamaa Jira (Pending Admin)
                              </span>
                            )}
                            {tx.status === 'approved' && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" /> Mirkanaa&apos;eera (Approved)
                              </span>
                            )}
                            {tx.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400">
                                <XCircle className="w-4 h-4" /> Kufaa Ta&apos;e (Rejected)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Match History List */}
                <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
                  <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-400" />
                    Seenaa Tapha Bingo Keessanii
                  </h2>

                  {myGames.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      Hanga ammaatti taphni taphatame hin jiru.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myGames.slice(0, 15).map((g) => (
                        <div
                          key={g.id}
                          className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-bold text-white">{g.bingoType}</div>
                            <div className="text-xs text-slate-400 font-mono-num">
                              Stake: {g.stake} ETB · Kubbaa: {g.ballsCalledCount}
                            </div>
                          </div>
                          <div className="text-right font-mono-num">
                            {g.result === 'won' ? (
                              <span className="text-sm font-extrabold text-emerald-400">
                                +{g.prize} ETB (WON)
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400">
                                -{g.stake} ETB
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: GAME RULES & FAQ SECTION */}
            {activeTab === 'rules' && (
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Core Rules Section */}
                <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-6">
                  <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                    Akkaataa Tapha Frenzy Bingo Ethiopia (1–300) & Seera Kaffaltii
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="font-display font-bold text-lg text-amber-400">
                        01. Akkaataa Maallaqa Galchuu & Referral
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Herrega baankii keenya (CBE Bank: <strong>1000218818424</strong> Asefa Wasenu Tadese, Awash Bank: <strong>01320561958100</strong> Asefa Wasenu Tadese, ykn Telebirr: <strong>0929200166</strong> Gabre shifaraa hayilu) irratti birrii erguun Transaction ID galchitu. Dabalataan koodii afeerraa (Referral Code) keessaniin hiriyoota yeroo afeertan lachuu keessan <strong>+15 ETB Bonus</strong> argattu!
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-display font-bold text-lg text-emerald-400">
                        02. Akkaataa Tapha Bingo 1 Hanga 300
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Gabatee guddaa <strong>1 hanga 300</strong> irratti lakkoofsonni hunduu ifatti mul&apos;atu (`B: 1-60`, `I: 61-120`, `N: 121-180`, `G: 181-240`, `O: 241-300`). Kubbaan achii keessaa yeroo waamamu kaardii 5x5 keessan irratti rukutuun sarara 5 ykn Rogoota 4 guuttanii BINGO! cuqaastu.
                      </p>
                    </div>
                  </div>
                </div>

                {/* FAQ Section */}
                <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl space-y-6">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <HelpCircle className="w-7 h-7 text-amber-400 shrink-0" />
                    <div>
                      <h2 className="font-display font-bold text-2xl text-white">
                        Gaaffiiwwan Yeroo Baay&apos;ee Gaafataman (FAQ)
                      </h2>
                      <p className="text-xs text-slate-400">
                        Deebii gaaffiiwwan waa&apos;ee kuufannaa xiqqaa (Minimum Deposit), Referral Bonus, 1-300 Caller, fi yeroo baafannaa
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {FAQ_ITEMS.map((item) => {
                      const isOpen = openFaqId === item.id;
                      return (
                        <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                          <button
                            type="button"
                            onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                            className="w-full flex items-center justify-between gap-4 text-left py-1 cursor-pointer group"
                          >
                            <span className="font-display font-bold text-base sm:text-lg text-white group-hover:text-amber-300 transition-colors">
                              {item.question}
                            </span>
                            {isOpen ? (
                              <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white shrink-0" />
                            )}
                          </button>

                          {isOpen && (
                            <p className="mt-2.5 text-sm text-slate-300 leading-relaxed pr-6">
                              {item.answer}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ADMIN APPROVAL PANEL (ONLY FOR ADMIN) */}
            {activeTab === 'admin' && isUserAdmin && (
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-3xl p-6 border border-emerald-500/30 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="font-display font-bold text-2xl text-white flex items-center gap-2">
                        <ShieldCheck className="w-7 h-7 text-emerald-400" />
                        Bulchiinsa Admin — Mirkaneessa Kaffaltii (Payment Approvals)
                      </h2>
                      <p className="text-xs text-slate-300 mt-1">
                        Kaffaltii taphattoonni CBE, Awash Bank, fi Telebirr dhaan ergan mirkaneessaatii &ldquo;Approve&rdquo; cuqaasaa. Akkuma Approve gootaniin birriin herrega taphataa irratti battalumatti dabalama!
                      </p>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-white/10">
                      {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setAdminFilter(st)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer whitespace-nowrap ${
                            adminFilter === st
                              ? 'bg-emerald-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {st} (
                          {st === 'all'
                            ? allTransactions.length
                            : allTransactions.filter((t) => t.status === st).length}
                          )
                        </button>
                      ))}
                    </div>
                  </div>

                  {adminStatusMsg && (
                    <div className="mb-4 p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-sm font-bold">
                      {adminStatusMsg}
                    </div>
                  )}

                  {/* Transactions Table / List */}
                  <div className="space-y-3">
                    {allTransactions
                      .filter((t) => (adminFilter === 'all' ? true : t.status === adminFilter))
                      .map((tx) => (
                        <div
                          key={tx.id}
                          className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span
                                className={`font-extrabold uppercase ${
                                  tx.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                {tx.type === 'deposit' ? 'DEPOSIT (GALII)' : 'WITHDRAW (BAASII)'}
                              </span>
                              <span>·</span>
                              <span className="font-bold text-white">{tx.method}</span>
                              <span>·</span>
                              <span>Taphataa: {tx.userName}</span>
                              <span>·</span>
                              <span className="font-mono-num">Bilbila: {tx.userPhone}</span>
                            </div>

                            <div className="text-xl font-extrabold text-white font-mono-num">
                              {tx.amount.toFixed(2)} ETB
                            </div>

                            <div className="text-xs sm:text-sm text-slate-300">
                              Maqaa Ergaa/Fudhataa: <strong className="text-amber-300">{tx.senderOrReceiverName}</strong>{' '}
                              · Reference / Acc:{' '}
                              <strong className="font-mono-num text-emerald-300 bg-slate-900 px-2 py-0.5 rounded">
                                {tx.referenceCode}
                              </strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {tx.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleAdminReviewTransaction(tx, 'approved')}
                                  disabled={processingTxId === tx.id}
                                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm shadow-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Approve ({tx.amount} ETB)
                                </button>
                                <button
                                  onClick={() => handleAdminReviewTransaction(tx, 'rejected')}
                                  disabled={processingTxId === tx.id}
                                  className="px-4 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span
                                className={`text-xs font-extrabold uppercase px-3 py-1.5 rounded-xl ${
                                  tx.status === 'approved'
                                    ? 'text-emerald-400 bg-emerald-500/10'
                                    : 'text-rose-400 bg-rose-500/10'
                                }`}
                              >
                                {tx.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                    {allTransactions.filter((t) => (adminFilter === 'all' ? true : t.status === adminFilter))
                      .length === 0 && (
                      <div className="text-center py-12 text-slate-400 text-sm">
                        Gaaffiin kaffaltii kutaa kana keessatti hin argamne.
                      </div>
                    )}
                  </div>
                </div>

                {/* Registered Players Overview for Admin */}
                <div className="bg-slate-900 rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
                  <h3 className="font-display font-bold text-xl text-white">
                    Taphattoota Galmaa&apos;an ({allUsers.length}) — Admin Direct Balance Top-Up
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-slate-400">
                          <th className="py-3 px-3">Maqaa</th>
                          <th className="py-3 px-3">Bilbila</th>
                          <th className="py-3 px-3">Referral Code</th>
                          <th className="py-3 px-3">Balance (ETB)</th>
                          <th className="py-3 px-3">Tapha / Mo&apos;annaa</th>
                          <th className="py-3 px-3">Birrii Dabali (Admin)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {allUsers.map((u) => (
                          <tr key={u.uid} className="hover:bg-white/5">
                            <td className="py-3 px-3 font-bold text-white">{u.displayName}</td>
                            <td className="py-3 px-3 font-mono-num text-slate-300">{u.phone || '-'}</td>
                            <td className="py-3 px-3 font-mono-num text-emerald-400 text-xs">
                              {u.referralCode || '-'} ({u.referralCount || 0} invited)
                            </td>
                            <td className="py-3 px-3 font-mono-num font-extrabold text-amber-400">
                              {u.balance.toFixed(2)} ETB
                            </td>
                            <td className="py-3 px-3 font-mono-num text-slate-300">
                              {u.totalPlayed} played · {u.totalWins} wins
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleAdminQuickTopUp(u, 50)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-mono-num font-bold text-xs border border-emerald-400/40 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  +50 ETB
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdminQuickTopUp(u, 100)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-slate-950 font-mono-num font-bold text-xs border border-amber-400/40 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  +100 ETB
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-white/10 bg-slate-950 py-6 px-4 sm:px-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 Frenzy Bingo Ethiopia (1–300). Mirgi Hunduu Seeraan Kan Eegame.</span>
          <div className="flex items-center gap-4">
            <span>Kaffaltii Mirkanaa&apos;aa: CBE Bank · Awash Bank · Telebirr</span>
            <button
              type="button"
              onClick={() => setShowAdminPinModal(true)}
              className="text-[11px] text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
            >
              {isUserAdmin ? 'Admin Mode (Active)' : 'Admin Key'}
            </button>
          </div>
        </div>
      </footer>

      {/* Admin Passcode Modal */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" /> Bulchiinsa Admin
              </h3>
              <button
                type="button"
                onClick={() => setShowAdminPinModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Admin herrega kaffaltii mirkaneessuuf (CBE, Awash, Telebirr) koodii keessan galchaa.
            </p>

            {adminPinError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                {adminPinError}
              </div>
            )}

            <form onSubmit={handleUnlockAdminPin} className="space-y-3">
              <input
                type="password"
                required
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                placeholder="Passcode / PIN Galchaa"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white font-mono-num text-center text-lg tracking-widest focus:outline-none focus:border-amber-400"
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm shadow cursor-pointer"
                >
                  Bani (Unlock Admin)
                </button>
                {adminUnlockedByPin && (
                  <button
                    type="button"
                    onClick={handleLockAdminPin}
                    className="py-3 px-4 rounded-xl bg-slate-800 text-rose-400 font-bold text-sm hover:bg-slate-700 cursor-pointer"
                  >
                    Cufi
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
