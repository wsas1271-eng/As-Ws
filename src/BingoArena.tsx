import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Volume2,
  VolumeX,
  Trophy,
  Play,
  ArrowLeft,
  X,
  Crown,
  Megaphone,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import { soundEngine, numberToAmharicGeez } from './sound';
import {
  BingoCell,
  BINGO_LETTERS,
  getCartelaGrid,
  getLetterForNumber,
  checkCartelaWinningPattern,
} from './cartelas';

export interface CalledBall {
  id: string;
  letter: 'B' | 'I' | 'N' | 'G' | 'O';
  number: number;
  timestamp: number;
}

export interface RoomTakenInfo {
  uid: string;
  name: string;
  timestamp?: number;
}

export interface LiveRoomDoc {
  id: string;
  stake: number;
  status: 'LOBBY' | 'PLAYING' | 'RESULT';
  roundId: string;
  roundStartTime: number;
  countdownEndTime: number;
  takenCartelas?: Record<string, RoomTakenInfo>;
  derash: number;
  ballPool?: number[];
  winner?: {
    uid: string;
    name: string;
    cartelaId: number;
    winningPattern: string;
    derashWon: number;
    ballsCount: number;
  } | null;
  nextGameTime: number;
  updatedAt?: any;
}

interface BingoArenaProps {
  userId: string;
  userBalance: number;
  userName: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onStartMatch: (totalStake: number) => Promise<boolean>;
  onFinishMatch: (
    result: 'won' | 'lost',
    stake: number,
    prize: number,
    bingoType: string,
    ballsCount: number
  ) => Promise<void>;
  onOpenWallet: () => void;
}

const COLUMN_STYLES: Record<
  'B' | 'I' | 'N' | 'G' | 'O',
  {
    headerBg: string;
    range: string;
  }
> = {
  B: {
    headerBg: 'bg-[#1d9bf0] text-white',
    range: '1-60',
  },
  I: {
    headerBg: 'bg-[#10b981] text-white',
    range: '61-120',
  },
  N: {
    headerBg: 'bg-[#8b5cf6] text-white',
    range: '121-180',
  },
  G: {
    headerBg: 'bg-[#ec4899] text-white',
    range: '181-240',
  },
  O: {
    headerBg: 'bg-[#f97316] text-white',
    range: '241-300',
  },
};

const STAKE_ROOMS = [
  {
    id: 'room_10',
    stake: 10,
    title: '10 ETB',
    badge: 'Good Choice',
    subtitle: 'Most players choice',
    popular: true,
    speedMs: 2800,
    borderClass: 'border-emerald-500/40 bg-[#131c2e]',
    btnClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950',
  },
  {
    id: 'room_20',
    stake: 20,
    title: '20 ETB',
    badge: 'Best Value',
    subtitle: 'Good for regular players',
    popular: false,
    speedMs: 2700,
    borderClass: 'border-sky-500/40 bg-[#131c2e]',
    btnClass: 'bg-sky-500/20 text-sky-400 border border-sky-500/40 hover:bg-sky-500 hover:text-slate-950',
  },
  {
    id: 'room_50',
    stake: 50,
    title: '50 ETB',
    badge: 'High Stake',
    subtitle: 'For high rollers',
    popular: false,
    speedMs: 2600,
    borderClass: 'border-amber-500/40 bg-[#131c2e]',
    btnClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950',
  },
  {
    id: 'room_100',
    stake: 100,
    title: '100 ETB',
    badge: 'VIP Jackpot',
    subtitle: 'Massive Derash pool',
    popular: false,
    speedMs: 2500,
    borderClass: 'border-purple-500/40 bg-[#131c2e]',
    btnClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500 hover:text-slate-950',
  },
];

// Pool of numbers from 1 to 300 for calling and Cartelas
const ALL_CARTELAS_1_TO_300 = Array.from({ length: 300 }, (_, i) => i + 1);
const ALL_BALLS_1_TO_300 = Array.from({ length: 300 }, (_, i) => i + 1);

// Strictly enforced: A person cannot hold more than 4 cartelas
const MAX_PLAYER_CARTELLAS = 4;

const COMPETITOR_NAMES = [
  'Tolasa B.',
  'Chala M.',
  'Bontu K.',
  'Hawwi D.',
  'Abdi G.',
  'Sena T.',
  'Lensa A.',
  'Gemechu W.',
  'Bikila T.',
  'Kiya O.',
  'Derartu R.',
  'Girma B.',
];

export const BingoArena: React.FC<BingoArenaProps> = ({
  userId,
  userBalance,
  userName,
  soundEnabled,
  onToggleSound,
  onStartMatch,
  onFinishMatch,
  onOpenWallet,
}) => {
  const [phase, setPhase] = useState<'STAKE_MENU' | 'CARTELA_ROOM' | 'PLAYING' | 'RESULT'>('STAKE_MENU');
  const [selectedRoom, setSelectedRoom] = useState(STAKE_ROOMS[0]);

  // Live Room State from Firestore
  const [liveRoom, setLiveRoom] = useState<LiveRoomDoc | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Up to 4 Cartelas selected by current user
  const [myCartelaIds, setMyCartelaIds] = useState<number[]>([]);
  const [myBoards, setMyBoards] = useState<Record<number, BingoCell[][]>>({});

  // Active Game State
  const [autoMark, setAutoMark] = useState<boolean>(true);
  const [showFullBoard, setShowFullBoard] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [currentCalledBalls, setCurrentCalledBalls] = useState<CalledBall[]>([]);
  const [hasDeductedStakeForRound, setHasDeductedStakeForRound] = useState<string | null>(null);
  const [hasFinishedRoundId, setHasFinishedRoundId] = useState<string | null>(null);

  // Prevents the "stuck in result screen" trap when the user dismisses the result
  const dismissedRoundIdRef = useRef<string | null>(null);
  const isResettingRef = useRef<boolean>(false);
  const simulatedWinnerClaimedRef = useRef<boolean>(false);

  // Clock tick state for synchronized timers
  const [nowMs, setNowMs] = useState<number>(Date.now());

  const calledSetRef = useRef<Set<number>>(new Set());
  const lastAnnouncedBallRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  // Clock tick every 250ms for smooth real-time synchronized timer and ball progression
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Enter Stake Room: Subscribe to Firestore `/rooms/{roomId}`
  const handleEnterRoom = (room: (typeof STAKE_ROOMS)[0]) => {
    setSelectedRoom(room);
    setMyCartelaIds([]);
    setMyBoards({});
    dismissedRoundIdRef.current = null;
    simulatedWinnerClaimedRef.current = false;
    setPhase('CARTELA_ROOM');
  };

  // Real-time Firestore Room Synchronization
  useEffect(() => {
    if (phase === 'STAKE_MENU') return;

    const roomId = selectedRoom.id;
    const roomRef = doc(db, 'rooms', roomId);

    const unsub = onSnapshot(
      roomRef,
      async (snap) => {
        if (!snap.exists()) {
          // Initialize room in Firestore with numbers 1 to 300
          const initialCountdown = Date.now() + 20000;
          const newRoom: LiveRoomDoc = {
            id: roomId,
            stake: selectedRoom.stake,
            status: 'LOBBY',
            roundId: `#${Math.floor(10000000000 + Math.random() * 89999999999)}`,
            roundStartTime: 0,
            countdownEndTime: initialCountdown,
            takenCartelas: {},
            derash: 0,
            ballPool: [],
            winner: null,
            nextGameTime: 0,
          };
          try {
            await setDoc(roomRef, {
              ...newRoom,
              updatedAt: serverTimestamp(),
            });
            setLiveRoom(newRoom);
          } catch (e) {
            console.error('Failed to init room in firestore:', e);
          }
          return;
        }

        const data = snap.data() as LiveRoomDoc;
        setLiveRoom(data);

        // Keep local cartelas in sync with Firestore takenCartelas for current user
        if (data.takenCartelas && userId) {
          const myClaimedIds: number[] = [];
          Object.entries(data.takenCartelas).forEach(([cidStr, info]) => {
            if (info.uid === userId) {
              const numId = Number(cidStr);
              myClaimedIds.push(numId);
            }
          });
          setMyCartelaIds(myClaimedIds);
          setMyBoards((prev) => {
            const next = { ...prev };
            myClaimedIds.forEach((id) => {
              if (!next[id]) {
                next[id] = getCartelaGrid(id);
              }
            });
            return next;
          });
        }
      },
      (err) => {
        console.error('Room onSnapshot error:', err);
        setRoomError('Dogoggora walitti dhufeenyaa (Connection error): ' + err.message);
      }
    );

    return () => unsub();
  }, [phase, selectedRoom.id, selectedRoom.stake, userId]);

  // Synchronize phase based on live room status with trap-protection
  useEffect(() => {
    if (!liveRoom || phase === 'STAKE_MENU') return;

    if (liveRoom.status === 'LOBBY') {
      if (phase !== 'CARTELA_ROOM') {
        setPhase('CARTELA_ROOM');
        calledSetRef.current = new Set();
        setCurrentCalledBalls([]);
        lastAnnouncedBallRef.current = null;
        simulatedWinnerClaimedRef.current = false;
      }
    } else if (liveRoom.status === 'PLAYING') {
      if (phase !== 'PLAYING') {
        setPhase('PLAYING');
        soundEngine.playMatchStartAmbient();
        simulatedWinnerClaimedRef.current = false;
      }
    } else if (liveRoom.status === 'RESULT') {
      // TRAP PROTECTION: If user already dismissed this round's result, do NOT force them back to RESULT!
      if (dismissedRoundIdRef.current === liveRoom.roundId) {
        return;
      }
      if (phase !== 'RESULT') {
        setPhase('RESULT');
      }
    }
  }, [liveRoom?.status, liveRoom?.roundId, phase, liveRoom]);

  // Deduct stake when match starts for current user
  useEffect(() => {
    if (!liveRoom || liveRoom.status !== 'PLAYING' || !userId) return;
    if (hasDeductedStakeForRound === liveRoom.roundId) return;

    const myStakes = myCartelaIds.length * selectedRoom.stake;
    if (myStakes > 0) {
      onStartMatch(myStakes);
      setHasDeductedStakeForRound(liveRoom.roundId);
    }
  }, [liveRoom?.status, liveRoom?.roundId, myCartelaIds.length, selectedRoom.stake, onStartMatch, userId, hasDeductedStakeForRound]);

  // Handle Lobby Countdown Expiration -> System transitions room to PLAYING with 1-300 balls
  useEffect(() => {
    if (!liveRoom || phase !== 'CARTELA_ROOM' || liveRoom.status !== 'LOBBY') return;

    const timeLeft = Math.max(0, Math.ceil((liveRoom.countdownEndTime - nowMs) / 1000));
    if (timeLeft <= 0) {
      // Countdown reached 0: Transition room to PLAYING in Firestore with balls 1 to 300
      const roomRef = doc(db, 'rooms', selectedRoom.id);
      const shuffled300 = [...ALL_BALLS_1_TO_300].sort(() => Math.random() - 0.5);

      updateDoc(roomRef, {
        status: 'PLAYING',
        roundStartTime: Date.now() + 3000, // 3-second pre-call warning
        ballPool: shuffled300,
        updatedAt: serverTimestamp(),
      }).catch((err) => console.error('Error starting game:', err));
    }
  }, [liveRoom, phase, nowMs, selectedRoom.id]);

  // Directly resets the room to LOBBY state and clears current card state (Never gets stuck)
  const handleResetToNextGame = async () => {
    if (isResettingRef.current) return;
    isResettingRef.current = true;

    if (liveRoom?.roundId) {
      dismissedRoundIdRef.current = liveRoom.roundId;
    }
    setPhase('CARTELA_ROOM');
    setMyCartelaIds([]);
    setMyBoards({});
    calledSetRef.current = new Set();
    setCurrentCalledBalls([]);
    lastAnnouncedBallRef.current = null;
    setHasDeductedStakeForRound(null);
    setHasFinishedRoundId(null);
    simulatedWinnerClaimedRef.current = false;

    const roomRef = doc(db, 'rooms', selectedRoom.id);
    const newRound = `#${Math.floor(10000000000 + Math.random() * 89999999999)}`;
    const nextCountdown = Date.now() + 20000;

    try {
      await updateDoc(roomRef, {
        status: 'LOBBY',
        roundId: newRound,
        countdownEndTime: nextCountdown,
        takenCartelas: {},
        derash: 0,
        ballPool: [],
        winner: null,
        nextGameTime: 0,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error resetting room to lobby:', err);
    } finally {
      setTimeout(() => {
        isResettingRef.current = false;
      }, 1000);
    }
  };

  // Exit back to Stake selection screen (Never gets stuck)
  const handleExitToStakeMenu = () => {
    if (liveRoom?.roundId) {
      dismissedRoundIdRef.current = liveRoom.roundId;
    }
    setPhase('STAKE_MENU');
    setMyCartelaIds([]);
    setMyBoards({});
    calledSetRef.current = new Set();
    setCurrentCalledBalls([]);
    lastAnnouncedBallRef.current = null;
    setHasDeductedStakeForRound(null);
    setHasFinishedRoundId(null);
    simulatedWinnerClaimedRef.current = false;
  };

  // Start match immediately without waiting for timer if player already selected cards
  const handleStartMatchNow = async () => {
    if (!liveRoom || liveRoom.status !== 'LOBBY' || myCartelaIds.length === 0) return;
    const roomRef = doc(db, 'rooms', selectedRoom.id);
    const shuffled300 = [...ALL_BALLS_1_TO_300].sort(() => Math.random() - 0.5);
    try {
      await updateDoc(roomRef, {
        status: 'PLAYING',
        roundStartTime: Date.now() + 3000,
        ballPool: shuffled300,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error starting match now:', err);
    }
  };

  // Handle Result Countdown Expiration -> Reset room to LOBBY
  const resultCountdownSeconds = liveRoom?.nextGameTime
    ? Math.max(0, Math.ceil((liveRoom.nextGameTime - nowMs) / 1000))
    : 6;

  useEffect(() => {
    if (!liveRoom || phase !== 'RESULT') return;

    if (resultCountdownSeconds <= 0 && !isResettingRef.current) {
      handleResetToNextGame();
    }
  }, [resultCountdownSeconds, phase, liveRoom]);

  // System-governed Real-time Called Balls during PLAYING phase from 1 to 300 with synchronized Female Voice calling
  useEffect(() => {
    if (!liveRoom || liveRoom.status !== 'PLAYING' || !liveRoom.ballPool || liveRoom.ballPool.length === 0) return;

    const elapsed = nowMs - liveRoom.roundStartTime;
    if (elapsed < 0) return; // In 3-second countdown

    const speed = selectedRoom.speedMs || 2800;
    const currentIdx = Math.floor(elapsed / speed);
    const countToCall = Math.min(liveRoom.ballPool.length, currentIdx + 1);

    if (countToCall <= 0) return;

    const ballsList: CalledBall[] = [];
    const newCalledSet = new Set<number>();

    for (let i = 0; i < countToCall; i++) {
      const num = liveRoom.ballPool[i];
      const letter = getLetterForNumber(num);
      newCalledSet.add(num);
      ballsList.unshift({
        id: `${letter}-${num}`,
        letter,
        number: num,
        timestamp: liveRoom.roundStartTime + i * speed,
      });
    }

    calledSetRef.current = newCalledSet;
    setCurrentCalledBalls(ballsList);

    // Announce the latest called ball once with loud female Amharic announcer (1 to 300)
    const latestNum = liveRoom.ballPool[countToCall - 1];
    if (latestNum && lastAnnouncedBallRef.current !== latestNum) {
      lastAnnouncedBallRef.current = latestNum;
      soundEngine.playBallPop();
      soundEngine.announceBall(getLetterForNumber(latestNum), latestNum);
    }

    // Auto-mark player's 1 to 4 boards simultaneously and check for victory!
    if (autoMark && myCartelaIds.length > 0 && liveRoom.status === 'PLAYING') {
      setMyBoards((prevBoards) => {
        const nextBoards: Record<number, BingoCell[][]> = {};
        let winningCartela: { id: number; pattern: string; cells: Set<string> } | null = null;

        for (const cId of myCartelaIds) {
          const grid = prevBoards[cId] || getCartelaGrid(cId);
          const markedGrid = grid.map((row) =>
            row.map((cell) => {
              if (cell.isFree || newCalledSet.has(cell.number)) {
                return { ...cell, daubed: true };
              }
              return cell;
            })
          );
          nextBoards[cId] = markedGrid;

          if (!winningCartela) {
            const check = checkCartelaWinningPattern(markedGrid, newCalledSet, true);
            if (check.hasWon) {
              winningCartela = { id: cId, pattern: check.pattern, cells: check.cells };
            }
          }
        }

        // If current player hits BINGO on any of their held cartelas, claim it in Firestore!
        if (winningCartela && liveRoom.status === 'PLAYING') {
          handleClaimBingo(winningCartela.id, winningCartela.pattern, countToCall);
        }

        return nextBoards;
      });
    }

    // SYSTEM GOVERNANCE: If ball count reaches between 52 and 65 and no one has claimed Bingo yet,
    // simulate one of the other taken cartelas / competitor in the room winning so the round finishes cleanly
    if (
      countToCall >= 52 &&
      !simulatedWinnerClaimedRef.current &&
      liveRoom.status === 'PLAYING' &&
      !liveRoom.winner
    ) {
      const otherTaken = Object.entries(liveRoom.takenCartelas || {}).filter(
        ([cid, info]) => info.uid !== userId
      );

      let winnerName = COMPETITOR_NAMES[Math.floor(Math.random() * COMPETITOR_NAMES.length)];
      let winnerCartelaId = 17;
      let winnerUid = 'rival_' + Math.floor(Math.random() * 9999);

      if (otherTaken.length > 0) {
        const picked = otherTaken[Math.floor(Math.random() * otherTaken.length)];
        winnerCartelaId = Number(picked[0]);
        winnerName = picked[1].name;
        winnerUid = picked[1].uid;
      } else {
        winnerCartelaId = Math.floor(1 + Math.random() * 299);
        while (myCartelaIds.includes(winnerCartelaId)) {
          winnerCartelaId = Math.floor(1 + Math.random() * 299);
        }
      }

      simulatedWinnerClaimedRef.current = true;
      handleDeclareRoomWinner(winnerUid, winnerName, winnerCartelaId, 'Horizontal Line', countToCall);
    } else if (countToCall >= 300 && liveRoom.status === 'PLAYING' && !liveRoom.winner) {
      // All balls called without winner -> Conclude match cleanly
      handleDeclareRoomWinner(
        'system',
        'Tapha Xumurameera',
        0,
        'Balls Exhausted',
        300
      );
    }
  }, [liveRoom, nowMs, selectedRoom.speedMs, autoMark, myCartelaIds]);

  // Handle claiming BINGO for current player
  const handleClaimBingo = async (cartelaId: number, patternName: string, ballsCount: number) => {
    if (!liveRoom || liveRoom.status !== 'PLAYING') return;

    soundEngine.playBingoFanfare();
    soundEngine.announceBingo();
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.6 },
    });

    const potWon = liveRoom.derash > 0 ? liveRoom.derash : selectedRoom.stake * 10;
    const roomRef = doc(db, 'rooms', selectedRoom.id);

    try {
      await updateDoc(roomRef, {
        status: 'RESULT',
        winner: {
          uid: userId,
          name: userName,
          cartelaId,
          winningPattern: patternName,
          derashWon: potWon,
          ballsCount,
        },
        nextGameTime: Date.now() + 6000,
        updatedAt: serverTimestamp(),
      });

      if (hasFinishedRoundId !== liveRoom.roundId) {
        setHasFinishedRoundId(liveRoom.roundId);
        await onFinishMatch(
          'won',
          myCartelaIds.length * selectedRoom.stake,
          potWon,
          `Cartella #${cartelaId} (${userName}) · ${patternName}`,
          ballsCount
        );
      }
    } catch (err) {
      console.error('Error claiming bingo in Firestore:', err);
    }
  };

  // System declares winner for competitor or end-of-round
  const handleDeclareRoomWinner = async (
    winUid: string,
    winName: string,
    cId: number,
    patternName: string,
    ballsCount: number
  ) => {
    if (!liveRoom || liveRoom.status !== 'PLAYING') return;

    const potWon = liveRoom.derash > 0 ? liveRoom.derash : selectedRoom.stake * 8;
    const roomRef = doc(db, 'rooms', selectedRoom.id);

    try {
      await updateDoc(roomRef, {
        status: 'RESULT',
        winner:
          cId > 0
            ? {
                uid: winUid,
                name: winName,
                cartelaId: cId,
                winningPattern: patternName,
                derashWon: potWon,
                ballsCount,
              }
            : null,
        nextGameTime: Date.now() + 6000,
        updatedAt: serverTimestamp(),
      });

      if (hasFinishedRoundId !== liveRoom.roundId && myCartelaIds.length > 0) {
        setHasFinishedRoundId(liveRoom.roundId);
        await onFinishMatch(
          'lost',
          myCartelaIds.length * selectedRoom.stake,
          0,
          `Round ${liveRoom.roundId} concluded`,
          ballsCount
        );
      }
    } catch (err) {
      console.error('Error declaring room winner:', err);
    }
  };

  // Toggle Cartela Selection in Firestore (1 to 300) - Strictly Enforce Max 4 Cartellas
  const handleToggleCartela = async (id: number) => {
    if (!liveRoom || phase !== 'CARTELA_ROOM' || liveRoom.status !== 'LOBBY') return;

    const taken = liveRoom.takenCartelas || {};
    const existing = taken[String(id)];

    // If taken by someone else
    if (existing && existing.uid !== userId) {
      showToast(`Kaartelaa #${id} ${existing.name} tiin qabameera!`);
      soundEngine.playMissPenalty();
      return;
    }

    const roomRef = doc(db, 'rooms', selectedRoom.id);

    // If already taken by current user, deselect it
    if (existing && existing.uid === userId) {
      soundEngine.playBallPop();
      try {
        const nextTakenCount = Math.max(0, Object.keys(taken).length - 1);
        await updateDoc(roomRef, {
          [`takenCartelas.${id}`]: deleteField(),
          derash: Math.round(nextTakenCount * selectedRoom.stake * 0.8),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error deselecting cartela:', err);
      }
      return;
    }

    // STRICT RULE: Namni tokko Kaartelaa 4 ol qabachuu hin danda'u
    if (myCartelaIds.length >= MAX_PLAYER_CARTELLAS) {
      showToast(`Namni tokko Kaartelaa ${MAX_PLAYER_CARTELLAS} ol qabachuu hin danda'u!`);
      soundEngine.playMissPenalty();
      return;
    }

    const totalCostNext = (myCartelaIds.length + 1) * selectedRoom.stake;
    if (userBalance < totalCostNext) {
      showToast(`Kaartelaa ${myCartelaIds.length + 1} qabachuuf ${totalCostNext} ETB barbaachisa!`);
      soundEngine.playMissPenalty();
      return;
    }

    // Select Cartela in Firestore
    soundEngine.playDaubHit();
    try {
      const nextTakenCount = Object.keys(taken).length + 1;
      await updateDoc(roomRef, {
        [`takenCartelas.${id}`]: {
          uid: userId,
          name: userName,
          timestamp: Date.now(),
        },
        derash: Math.round(nextTakenCount * selectedRoom.stake * 0.8),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error claiming cartela in Firestore:', err);
      showToast('Kaartelaa qabachuun hin danda’amne, irra deebi’aa yaalaa.');
    }
  };

  // Remove all cartelas selected by this user
  const handleRemoveAllCartelas = async () => {
    if (!liveRoom || !liveRoom.takenCartelas) return;
    const updates: Record<string, any> = {};
    Object.entries(liveRoom.takenCartelas).forEach(([cidStr, info]) => {
      if (info.uid === userId) {
        updates[`takenCartelas.${cidStr}`] = deleteField();
      }
    });

    const roomRef = doc(db, 'rooms', selectedRoom.id);
    try {
      await updateDoc(roomRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      setMyCartelaIds([]);
      setMyBoards({});
    } catch (err) {
      console.error('Error removing all cartelas:', err);
    }
  };

  // Manual cell click when Auto-Mark is OFF
  const handleManualCellClick = (cartelaId: number, r: number, c: number) => {
    if (phase !== 'PLAYING') return;
    const grid = myBoards[cartelaId];
    if (!grid) return;
    const cell = grid[r][c];
    if (cell.daubed) return;

    if (calledSetRef.current.has(cell.number)) {
      soundEngine.playDaubHit();
      const nextGrid = grid.map((row) => row.map((item) => ({ ...item })));
      nextGrid[r][c].daubed = true;
      setMyBoards((prev) => ({ ...prev, [cartelaId]: nextGrid }));

      const check = checkCartelaWinningPattern(nextGrid, calledSetRef.current, true);
      if (check.hasWon) {
        handleClaimBingo(cartelaId, check.pattern, currentCalledBalls.length);
      }
    } else {
      soundEngine.playMissPenalty();
      showToast(`${cell.letter}-${cell.number} hin waamamne!`);
    }
  };

  // Manual BINGO Claim Button
  const handleManualBingoClaim = () => {
    if (phase !== 'PLAYING') return;
    for (const cId of myCartelaIds) {
      const grid = myBoards[cId];
      if (!grid) continue;
      const check = checkCartelaWinningPattern(grid, calledSetRef.current, false);
      if (check.hasWon) {
        handleClaimBingo(cId, check.pattern, currentCalledBalls.length);
        return;
      }
    }
    soundEngine.playMissPenalty();
    showToast('Sararri BINGO hin guutamne! Itti fufaa.');
  };

  // Live Calculations
  const takenCount = liveRoom?.takenCartelas ? Object.keys(liveRoom.takenCartelas).length : 0;
  const currentDerash = liveRoom?.derash && liveRoom.derash > 0
    ? liveRoom.derash
    : Math.max(selectedRoom.stake * 8, Math.round(takenCount * selectedRoom.stake * 0.8));

  const roomCountdownSeconds = liveRoom?.countdownEndTime
    ? Math.max(0, Math.ceil((liveRoom.countdownEndTime - nowMs) / 1000))
    : 15;

  const preCallCountdown = liveRoom?.roundStartTime
    ? Math.max(0, Math.ceil((liveRoom.roundStartTime - nowMs) / 1000))
    : 0;

  // Responsive Grid Class based on number of held Cartellas (1, 2, 3, or 4)
  const cartelaGridClass = useMemo(() => {
    const count = myCartelaIds.length;
    if (count <= 1) return 'grid grid-cols-1 max-w-[380px] mx-auto';
    if (count === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto';
    if (count === 3) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-w-6xl mx-auto';
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-7xl mx-auto';
  }, [myCartelaIds.length]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      {/* Toast notification */}
      {feedbackToast && (
        <div className="fixed top-20 right-4 z-50 bg-amber-400 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs shadow-2xl border border-white/20 animate-bounce">
          {feedbackToast}
        </div>
      )}

      {/* Connection / Room Error Banner */}
      {roomError && (
        <div className="bg-rose-500/20 border border-rose-500/40 rounded-2xl p-3 text-rose-300 text-xs flex items-center justify-between">
          <span>{roomError}</span>
          <button
            onClick={() => setRoomError(null)}
            className="p-1 rounded bg-black/30 hover:bg-black/50 text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Arena Subheader with Voice Test & Sound Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {phase !== 'STAKE_MENU' && (
            <button
              type="button"
              onClick={handleExitToStakeMenu}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kutaalee (Rooms)</span>
            </button>
          )}
          <span className="text-xs text-slate-400 font-semibold">
            Kutaa: <strong className="text-amber-400">{selectedRoom.title}</strong>
          </span>
          {myCartelaIds.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold font-mono-num">
              {myCartelaIds.length}/{MAX_PLAYER_CARTELLAS} Cartellas
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Female Voice Test Button */}
          <button
            type="button"
            onClick={() => soundEngine.testVoice()}
            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Sagalee Dubartii Amhariffaa Yaali (1-300)"
          >
            <Megaphone className="w-3.5 h-3.5 text-purple-400" />
            <span>Sagalee Yaali</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 hover:bg-amber-400/30'
                : 'bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700'
            }`}
            title="Sagalee (Audio On/Off)"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* =====================================================================
          SCREEN 1: STAKE MENU (10, 20, 50, 100 ETB)
         ===================================================================== */}
      {phase === 'STAKE_MENU' && (
        <div className="bg-[#0f172a] rounded-3xl p-5 sm:p-7 border border-white/15 shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                  LIVE BINGO (1 - 300)
                </span>
              </div>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white mt-0.5">
                Kutaa Taphaa Filadhaa (Stake Selection)
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Kutaa seenaatii lakkoofsa <strong>1 hanga 300</strong> keessaa Kaartelaa <strong>1 hanga 4</strong> filachuun taphadhaa!
              </p>
            </div>

            <div className="bg-[#162032] border border-amber-400/30 rounded-2xl px-4 py-2.5 text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Herrega Keessan</span>
              <span className="font-mono-num font-extrabold text-lg sm:text-xl text-amber-400">
                {userBalance.toFixed(2)} ETB
              </span>
            </div>
          </div>

          {/* 4 Official Stake Rooms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STAKE_ROOMS.map((room) => {
              const isAffordable = userBalance >= room.stake;
              return (
                <div
                  key={room.id}
                  className={`rounded-3xl p-5 border flex flex-col justify-between transition-all hover:scale-[1.02] shadow-xl ${room.borderClass}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-white/10 text-white tracking-wider">
                        {room.badge}
                      </span>
                      {room.popular && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                          POPULAR
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-mono-num font-extrabold text-3xl sm:text-4xl text-white">
                        {room.title}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{room.subtitle}</p>
                    </div>

                    <div className="space-y-1.5 pt-2 text-xs text-slate-300 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Gatii Kaartelaa:</span>
                        <strong className="text-white font-mono-num">{room.stake} ETB</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Kaartelaa Qabatan:</span>
                        <strong className="text-amber-400 font-bold">1 hanga 4 qofa</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Waamicha Kubbaa:</span>
                        <strong className="text-emerald-400 font-bold">1 hanga 300</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5">
                    {isAffordable ? (
                      <button
                        type="button"
                        onClick={() => handleEnterRoom(room)}
                        className={`w-full py-3 rounded-2xl font-display font-extrabold text-sm transition-all cursor-pointer shadow-md ${room.btnClass}`}
                      >
                        Kutaa Seeni (Enter Room)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenWallet}
                        className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs transition-all cursor-pointer shadow-md"
                      >
                        +Birrii Galchi ({room.stake} ETB)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: CARTELA SELECTION ROOM (1-300 Grid + Countdown + Pot)
         ===================================================================== */}
      {phase === 'CARTELA_ROOM' && (
        <div className="bg-[#0f172a] rounded-3xl p-4 sm:p-6 border border-white/15 shadow-2xl space-y-4">
          {/* Header Row: Room Info, Countdown, Derash Pot */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#162032] p-4 rounded-2xl border border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-extrabold border border-emerald-500/30">
                  {selectedRoom.title} STAKE
                </span>
                <span className="text-xs text-slate-300 font-mono-num font-bold">
                  {liveRoom?.roundId || '#ROUND'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Kaartelaa <strong>1 hanga 4</strong> filadhaa · Namni tokko kaartelaa 4 ol qabachuu hin danda&apos;u!
              </p>
            </div>

            {/* Live Synchronized Countdown Timer */}
            <div className="flex items-center gap-3">
              <div className="bg-[#0f172a] border border-amber-400/40 rounded-2xl px-4 py-2 text-center">
                <span className="text-[10px] font-bold uppercase text-amber-300 block leading-tight">
                  TAPHA EGGALUUF
                </span>
                <span className="font-mono-num font-extrabold text-2xl text-white block leading-tight">
                  {roomCountdownSeconds}s
                </span>
              </div>

              {/* Derash (Pot) */}
              <div className="bg-[#0f172a] border border-emerald-400/40 rounded-2xl px-4 py-2 text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-300 block leading-tight">
                  DERASH (POT)
                </span>
                <span className="font-mono-num font-extrabold text-2xl text-emerald-400 block leading-tight">
                  {currentDerash} ETB
                </span>
              </div>
            </div>
          </div>

          {/* User's Cartela Status Bar & Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="text-xs">
                <span className="text-slate-400 block">Kaartelaawwan Keessan:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono-num font-extrabold text-base text-amber-400">
                    {myCartelaIds.length}/{MAX_PLAYER_CARTELLAS}
                  </span>
                  {myCartelaIds.length > 0 && (
                    <span className="text-xs text-slate-300 font-mono-num">
                      (#{myCartelaIds.join(', #')})
                    </span>
                  )}
                </div>
              </div>

              {myCartelaIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleRemoveAllCartelas}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold cursor-pointer"
                >
                  Hunda Haqaa
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {myCartelaIds.length > 0 ? (
                <button
                  type="button"
                  onClick={handleStartMatchNow}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 hover:brightness-110 text-slate-950 font-display font-extrabold text-xs sm:text-sm shadow-lg transition-all cursor-pointer flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Amma Jalqabi ({myCartelaIds.length * selectedRoom.stake} ETB)
                </button>
              ) : (
                <div className="text-xs text-amber-300 font-semibold italic">
                  Tapha seenuuf gabatee gadii irraa Kaartelaa (1 hanga 4) cuqaasaa
                </div>
              )}
            </div>
          </div>

          {/* 1 to 300 Visual Cartela Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Lakkoofsa 1 hanga 300 (Max 4 Cartellas):</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Kaartelaa Keessan
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-slate-700 inline-block" /> Kan Qabame
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#1e293b] border border-white/20 inline-block" /> Bilisa
                </span>
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto bg-[#131c2e] p-3 rounded-2xl border border-white/10 grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 gap-1.5 scrollbar-thin">
              {ALL_CARTELAS_1_TO_300.map((num) => {
                const isSelectedByMe = myCartelaIds.includes(num);
                const takenInfo = liveRoom?.takenCartelas?.[String(num)];
                const isTakenByOther = takenInfo && takenInfo.uid !== userId;

                let cellClass =
                  'bg-[#1e293b] text-slate-200 border-white/10 hover:border-amber-400 hover:bg-slate-700';

                if (isSelectedByMe) {
                  cellClass =
                    'bg-amber-400 text-slate-950 font-black ring-2 ring-white scale-105 shadow-lg';
                } else if (isTakenByOther) {
                  cellClass = 'bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed';
                }

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleToggleCartela(num)}
                    disabled={Boolean(isTakenByOther)}
                    className={`aspect-square rounded-xl text-xs sm:text-sm font-mono-num font-bold flex flex-col items-center justify-center border transition-all cursor-pointer ${cellClass}`}
                    title={
                      isSelectedByMe
                        ? `Kaartelaa #${num} (Keessan)`
                        : isTakenByOther
                        ? `Kaartelaa #${num} (${takenInfo?.name})`
                        : `Kaartelaa #${num} Filadhu`
                    }
                  >
                    <span>{num}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: ACTIVE PLAYING ARENA
          - Calls numbers from 1 to 300 with loud female Amharic announcer
          - Displays ALL 1, 2, 3, or 4 held Cartelas simultaneously on screen!
         ===================================================================== */}
      {phase === 'PLAYING' && (
        <div className="bg-[#0f172a] rounded-3xl p-3 sm:p-5 border border-white/15 shadow-2xl space-y-4">
          {/* Top Bar: DERASH, GAME #, CALLED BALLS (1 to 300) */}
          <div className="grid grid-cols-3 gap-2 bg-[#162032] p-3 rounded-2xl border border-white/10 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">DERASH</span>
              <span className="font-mono-num font-extrabold text-base sm:text-lg text-emerald-400">
                {currentDerash} ETB
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">GAME</span>
              <span className="font-mono-num font-extrabold text-base sm:text-lg text-amber-400">
                {liveRoom?.roundId || '#1'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">CALLED (1-300)</span>
              <span className="font-mono-num font-extrabold text-base sm:text-lg text-white">
                {currentCalledBalls.length}/300
              </span>
            </div>
          </div>

          {/* Pre-Call 3-Second Warning */}
          {preCallCountdown > 0 && (
            <div className="p-3 rounded-2xl bg-amber-400/20 border border-amber-400/50 text-amber-300 text-center font-bold text-sm animate-pulse">
              Kubbaan jalqabaa lakkoofsa 1 hanga 300 keessaa sekondii {preCallCountdown} keessatti waamama... Qophaa&apos;aa!
            </div>
          )}

          {/* Center Call Out: BIG WHITE BALL with Ethiopian Female Announcer Audio (1 to 300) */}
          <div className="flex flex-col items-center justify-center py-1">
            {currentCalledBalls.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-white via-slate-100 to-slate-300 shadow-2xl border-4 border-amber-400 flex flex-col items-center justify-center text-slate-950 font-black animate-scale-in">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-600">
                    {currentCalledBalls[0].letter}
                  </span>
                  <span className="font-mono-num text-3xl sm:text-4xl leading-none">
                    {currentCalledBalls[0].number}
                  </span>
                </div>
                <div className="mt-2 text-xs font-bold text-amber-300 bg-amber-500/20 px-3.5 py-1 rounded-full border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                  <span>{currentCalledBalls[0].letter} - {currentCalledBalls[0].number}</span>
                  <span className="text-white/80 font-normal">({numberToAmharicGeez(currentCalledBalls[0].number)})</span>
                </div>
              </div>
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#162032] border-2 border-dashed border-white/20 flex items-center justify-center text-slate-500 text-xs font-bold">
                Eeggachaa...
              </div>
            )}
          </div>

          {/* Recent Called Balls Ticker (1 to 300) */}
          <div className="flex items-center justify-between gap-2 bg-[#131c2e] p-2 rounded-2xl border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0 pl-1">
              DHIHOO WAAMAMAN:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 justify-center sm:justify-start">
              {currentCalledBalls.slice(0, 7).map((b, idx) => (
                <div
                  key={b.id}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono-num font-extrabold flex items-center gap-1 shrink-0 ${
                    idx === 0
                      ? 'bg-amber-400 text-slate-950 scale-105 shadow-md ring-1 ring-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="font-bold opacity-80">{b.letter}</span>
                  <span>{b.number}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowFullBoard(!showFullBoard)}
              className="text-[11px] font-bold text-slate-400 hover:text-amber-300 flex items-center gap-1 shrink-0 pr-1 cursor-pointer"
            >
              {showFullBoard ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showFullBoard ? 'Dhooksi' : 'Gabatee (1-300)'}</span>
            </button>
          </div>

          {/* Optional Expandable Master Board for 1 - 300 */}
          {showFullBoard && (
            <div className="bg-[#131c2e] p-3 rounded-2xl border border-white/10 space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
              <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                <span>Gabatee Kubbaa 1 hanga 300:</span>
                <span className="text-amber-400 font-mono-num">{calledSetRef.current.size} / 300 Waamameera</span>
              </div>
              <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-20 gap-1">
                {ALL_BALLS_1_TO_300.map((num) => {
                  const isCalled = calledSetRef.current.has(num);
                  return (
                    <div
                      key={num}
                      className={`aspect-square rounded text-[9px] font-mono-num font-bold flex items-center justify-center ${
                        isCalled
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-400 opacity-60'
                      }`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              SIMULTANEOUS DISPLAY OF ALL HELD CARTELAS (1, 2, 3, or 4 Cartelas)
              "cartela 1yoon qabadhe tokkoo agarsisuu qabaa yoon 2 qabade 2agarsisuu qaba"
             ================================================================= */}
          {myCartelaIds.length > 0 ? (
            <div className={cartelaGridClass}>
              {myCartelaIds.map((cId) => {
                const board = myBoards[cId];
                if (!board) return null;

                // Count marked cells on this cartela
                let daubedCount = 0;
                board.forEach((r) =>
                  r.forEach((c) => {
                    if (c.daubed || c.isFree) daubedCount++;
                  })
                );

                return (
                  <div
                    key={cId}
                    className="w-full bg-[#162032] border border-white/15 rounded-3xl p-3 sm:p-3.5 shadow-2xl flex flex-col justify-between"
                  >
                    {/* Cartela Header Badge */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">CARTELLA</span>
                        <span className="font-mono-num font-extrabold text-sm sm:text-base text-amber-400">
                          #{cId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono-num font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{daubedCount}/25</span>
                      </div>
                    </div>

                    {/* B - I - N - G - O Colored Header Columns */}
                    <div className="grid grid-cols-5 gap-1.5 mb-2">
                      {BINGO_LETTERS.map((l) => (
                        <div
                          key={l}
                          className={`${COLUMN_STYLES[l].headerBg} rounded-xl py-1 text-center font-display font-extrabold text-sm shadow flex flex-col items-center justify-center`}
                        >
                          <span className="leading-tight">{l}</span>
                          <span className="text-[8px] font-mono-num opacity-80 leading-none">
                            {COLUMN_STYLES[l].range}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 5x5 Grid with Numbers (1 to 300) */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {board.map((row, r) =>
                        row.map((cell, c) => (
                          <button
                            key={`${r}-${c}`}
                            type="button"
                            onClick={() => handleManualCellClick(cId, r, c)}
                            className={`aspect-square rounded-xl font-mono-num font-extrabold text-xs sm:text-sm flex items-center justify-center transition-all select-none cursor-pointer ${
                              cell.isFree
                                ? 'bg-[#f59e0b] text-slate-950 shadow-md font-black'
                                : cell.daubed
                                ? 'bg-[#10b981] text-white shadow-md scale-[1.02] ring-1 ring-white/50'
                                : 'bg-[#1e293b] hover:bg-slate-700 text-white border border-white/5'
                            }`}
                          >
                            {cell.isFree ? '★' : cell.number}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-8 bg-[#162032] rounded-3xl border border-white/15 text-slate-400">
              Kaartelaan hin filatamne. Tapha itti aanuuf eegaa!
            </div>
          )}

          {/* Bottom Bar: CARTELLA COUNT + AUTO MARK / BINGO Claim Button */}
          <div className="flex items-center gap-3 pt-1">
            <div className="bg-[#162032] border border-white/15 rounded-2xl px-4 py-2.5 text-center shrink-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block leading-none">
                CARTELLAS
              </span>
              <span className="font-mono-num font-extrabold text-base sm:text-lg text-amber-400 block leading-tight">
                {myCartelaIds.length}/{MAX_PLAYER_CARTELLAS}
              </span>
              <span className="font-mono-num text-[10px] text-slate-400 block leading-none">
                {myCartelaIds.length > 0 ? `#${myCartelaIds.join(', #')}` : 'None'}
              </span>
            </div>

            {autoMark ? (
              <button
                type="button"
                onClick={handleManualBingoClaim}
                className="flex-1 py-4 rounded-2xl bg-[#1e293b] hover:bg-emerald-500 hover:text-slate-950 text-slate-200 font-display font-extrabold text-sm sm:text-base tracking-wider uppercase border border-white/15 transition-colors cursor-pointer"
              >
                AUTO MARK ON (BINGO!)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleManualBingoClaim}
                className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-display font-extrabold text-sm sm:text-base tracking-wider uppercase shadow-xl cursor-pointer"
              >
                CLAIM BINGO!
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 4: VICTORY / BINGO RESULT SCREEN
          (Guaranteed Smooth Back Navigation, Auto-Countdown, Next Game Reset)
         ===================================================================== */}
      {phase === 'RESULT' && (
        <div className="bg-[#0f172a] rounded-3xl p-5 sm:p-7 border border-white/15 shadow-2xl space-y-5 text-center max-w-md mx-auto">
          {/* Top Return Button */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={handleResetToNextGame}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Gara Kaartelaa</span>
            </button>
            <span className="text-xs text-amber-400 font-bold">Xumura Taphaa</span>
            <button
              type="button"
              onClick={handleExitToStakeMenu}
              className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              Kutaa Jijjiiri
            </button>
          </div>

          {liveRoom?.winner ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-2xl">
                  <Trophy className="w-8 h-8 text-amber-400" />
                </div>
                <h2 className="font-display font-extrabold text-3xl text-amber-400 tracking-wide">
                  🏆 BINGO!
                </h2>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs sm:text-sm">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-emerald-300">
                    {liveRoom.winner.name} {liveRoom.winner.uid === userId ? '(SI!)' : ''}
                  </span>
                  <span className="text-slate-300">won {liveRoom.winner.derashWon} ETB</span>
                </div>
              </div>

              {/* Winning Cartella Card Display */}
              <div className="bg-[#162032] border border-white/15 rounded-3xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-amber-400">Cartella #{liveRoom.winner.cartelaId}</span>{' '}
                    <span className="text-emerald-400 font-semibold">Won {liveRoom.winner.derashWon} ETB</span>
                  </div>
                  <span className="text-slate-400 font-semibold">{liveRoom.winner.winningPattern}</span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {BINGO_LETTERS.map((l) => (
                    <div
                      key={l}
                      className={`${COLUMN_STYLES[l].headerBg} rounded-lg py-1.5 text-center font-display font-extrabold text-sm`}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {/* Display Winning Cartella Grid (1 to 300) */}
                <div className="grid grid-cols-5 gap-1.5">
                  {getCartelaGrid(liveRoom.winner.cartelaId).map((row, r) =>
                    row.map((cell, c) => (
                      <div
                        key={`${r}-${c}`}
                        className={`aspect-square rounded-lg font-mono-num font-extrabold text-xs flex items-center justify-center ${
                          cell.isFree
                            ? 'bg-[#f59e0b] text-slate-950 font-extrabold'
                            : calledSetRef.current.has(cell.number)
                            ? 'bg-[#10b981] text-white ring-2 ring-white'
                            : 'bg-[#1e293b] text-slate-300'
                        }`}
                      >
                        {cell.isFree ? '★' : cell.number}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3 py-4">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-amber-400 font-bold text-xl">
                300
              </div>
              <h2 className="font-display font-extrabold text-2xl text-white">
                Taphi Xumurameera!
              </h2>
              <p className="text-xs text-slate-400">
                Kubbaan waamamee xumurameera. Tapha itti aanuuf qophaa&apos;aa!
              </p>
            </div>
          )}

          {/* NEXT GAME Countdown Box with Guaranteed Automatic Advance */}
          <div className="bg-[#162032] border border-white/10 rounded-2xl p-4 space-y-1">
            <span className="text-[11px] font-bold uppercase text-slate-400 block">
              NEXT GAME
            </span>
            <span className="font-mono-num font-extrabold text-3xl text-white block">
              {resultCountdownSeconds}
            </span>
            <span className="text-xs text-slate-400 block">
              Sekondii {resultCountdownSeconds} keessatti ofumaan deebi&apos;a
            </span>
          </div>

          {/* Actionable Next Game & Back Navigation Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleResetToNextGame}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 hover:brightness-110 text-slate-950 font-display font-extrabold text-sm sm:text-base shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Tapha Itti Aanuu Jalqabi ({resultCountdownSeconds}s)
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleResetToNextGame}
                className="py-2.5 px-3 rounded-xl bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/15 transition-colors cursor-pointer"
              >
                Gara Kaartelaa Deebi&apos;i
              </button>
              <button
                type="button"
                onClick={handleExitToStakeMenu}
                className="py-2.5 px-3 rounded-xl bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/15 transition-colors cursor-pointer"
              >
                Kutaa Jijjiiri (Stake)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
