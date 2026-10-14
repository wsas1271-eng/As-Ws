// Web Audio API Synthesizer & Ethiopian Amharic/English Loud Female Voice Announcer for Frenzy Bingo Ethiopia (1 - 300)

const SOUND_PREF_KEY = 'frenzy_bingo_sound_enabled';

// Amharic Geez Numerals / Words for native Amharic TTS
const AMHARIC_GEEZ_NUMBERS: Record<number, string> = {
  1: 'አንድ',
  2: 'ሁለት',
  3: 'ሦስት',
  4: 'አራት',
  5: 'አምስት',
  6: 'ስድስት',
  7: 'ሰባት',
  8: 'ስምንት',
  9: 'ዘጠኝ',
  10: 'አስር',
  11: 'አስራ አንድ',
  12: 'አስራ ሁለት',
  13: 'አስራ ሦስት',
  14: 'አስራ አራት',
  15: 'አስራ አምስት',
  16: 'አስራ ስድስት',
  17: 'አስራ ሰባት',
  18: 'አስራ ስምንት',
  19: 'አስራ ዘጠኝ',
  20: 'ሀያ',
  30: 'ሰላሳ',
  40: 'አርባ',
  50: 'ሃምሳ',
  60: 'ስልሳ',
  70: 'ሰባ',
  80: 'ሰማንያ',
  90: 'ዘጠና',
  100: 'መቶ',
  200: 'ሁለት መቶ',
  300: 'ሦስት መቶ',
};

// Clean Phonetic Amharic for English / Multilingual Female Voices
// Engineered specifically so browser TTS voices pronounce authentic Ethiopian vowels:
// 'Ahnd', 'Hoo-let', 'Sost', 'Ah-raht', 'Ah-meest', etc.
const AMHARIC_UNITS_PHONETIC: Record<number, string> = {
  1: 'Ahnd',
  2: 'Hoo-let',
  3: 'Sost',
  4: 'Ah-raht',
  5: 'Ah-meest',
  6: 'See-deest',
  7: 'Seh-baht',
  8: 'See-mint',
  9: 'Zeh-tegn',
};

const AMHARIC_TENS_PHONETIC: Record<number, string> = {
  10: 'Ah-seer',
  20: 'Hah-yah',
  30: 'Seh-lah-sah',
  40: 'Ahr-bah',
  50: 'Hahm-sah',
  60: 'Seel-sah',
  70: 'Seh-bah',
  80: 'Seh-mahn-yah',
  90: 'Zeh-teh-nah',
};

// Accurately converts any number 1 - 300 to Geez Amharic script
export function numberToAmharicGeez(n: number): string {
  if (n <= 0) return '';
  if (n in AMHARIC_GEEZ_NUMBERS) return AMHARIC_GEEZ_NUMBERS[n];

  // 300
  if (n === 300) return 'ሦስት መቶ';

  // 201 - 299
  if (n > 200 && n < 300) {
    const rem = n - 200;
    return `ሁለት መቶ ${numberToAmharicGeez(rem)}`;
  }

  // 101 - 199
  if (n > 100 && n < 200) {
    const rem = n - 100;
    return `መቶ ${numberToAmharicGeez(rem)}`;
  }

  // 11 - 19
  if (n >= 11 && n <= 19) {
    return `አስራ ${AMHARIC_GEEZ_NUMBERS[n - 10]}`;
  }

  // 21 - 99
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const tensWord = AMHARIC_GEEZ_NUMBERS[tens] || String(tens);
  return unit === 0 ? tensWord : `${tensWord} ${AMHARIC_GEEZ_NUMBERS[unit]}`;
}

// Accurately converts any number 1 - 300 to phonetic female English-friendly Amharic
export function numberToAmharicPhonetic(n: number): string {
  if (n <= 0) return '';
  if (n >= 1 && n <= 9) return AMHARIC_UNITS_PHONETIC[n];
  if (n === 10) return 'Ah-seer';

  // 300
  if (n === 300) return 'Sost Meh-toh';

  // 200 - 299
  if (n === 200) return 'Hoo-let Meh-toh';
  if (n > 200 && n < 300) {
    const rem = n - 200;
    return `Hoo-let Meh-toh ${numberToAmharicPhonetic(rem)}`;
  }

  // 100 - 199
  if (n === 100) return 'Meh-toh';
  if (n > 100 && n < 200) {
    const rem = n - 100;
    return `Meh-toh ${numberToAmharicPhonetic(rem)}`;
  }

  // 11 - 19
  if (n >= 11 && n <= 19) {
    return `Asra ${AMHARIC_UNITS_PHONETIC[n - 10]}`;
  }

  // 21 - 99
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const tensWord = AMHARIC_TENS_PHONETIC[tens] || String(tens);
  return unit === 0 ? tensWord : `${tensWord} ${AMHARIC_UNITS_PHONETIC[unit]}`;
}

const LETTER_AMHARIC_GEEZ: Record<'B' | 'I' | 'N' | 'G' | 'O', string> = {
  B: 'ቢ',
  I: 'አይ',
  N: 'ኤን',
  G: 'ጂ',
  O: 'ኦ',
};

const LETTER_PHONETIC: Record<'B' | 'I' | 'N' | 'G' | 'O', string> = {
  B: 'Bee',
  I: 'Aay',
  N: 'En',
  G: 'Jee',
  O: 'Oh',
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  public voiceEnabled: boolean = true;
  private cachedFemaleVoice: SpeechSynthesisVoice | null = null;
  private isUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(SOUND_PREF_KEY);
        if (saved !== null) {
          this.muted = saved === 'false';
        }
      } catch {
        // Ignore
      }

      // Unlock on first interaction
      const unlockAudio = () => {
        if (!this.isUnlocked) {
          this.isUnlocked = true;
          this.getContext();
          this.refreshVoices();
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio);
      window.addEventListener('touchstart', unlockAudio);

      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.refreshVoices();
        };
      }
    }
  }

  public refreshVoices() {
    this.cachedFemaleVoice = this.pickBestFemaleVoice();
  }

  // Locates the clearest, loudest female voice (Amharic if available, or high-fidelity female voice)
  private pickBestFemaleVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Check for native Amharic voice first
    const amharicVoice = voices.find((v) => v.lang.toLowerCase().startsWith('am'));
    if (amharicVoice) return amharicVoice;

    // 2. High-priority female voice names
    const femaleRank = [
      'google us english',
      'google uk english female',
      'zira',
      'jenny',
      'samantha',
      'victoria',
      'karen',
      'moira',
      'tessa',
      'fiona',
      'susan',
      'ava',
      'allison',
      'female',
      'natural',
    ];

    for (const rank of femaleRank) {
      const match = voices.find((v) => v.name.toLowerCase().includes(rank));
      if (match) return match;
    }

    // 3. Fallback to English female if flagged
    const anyFemale = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman'))
    );
    if (anyFemale) return anyFemale;

    // Default
    return voices.find((v) => v.default) || voices[0] || null;
  }

  public setSoundEnabled(enabled: boolean) {
    this.muted = !enabled;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SOUND_PREF_KEY, String(enabled));
      } catch {
        // Ignore
      }
      if (this.muted && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore
        }
      }
    }
  }

  public isSoundEnabled(): boolean {
    return !this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Pre-call attention chime: crisp dual-tone acoustic chime that makes the audio noticeable and loud
  public playAttentionChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.23);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.08); // A5
    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.36);
  }

  public playMatchStartAmbient() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { f: 261.63, t: 0.0, d: 0.35 },
      { f: 329.63, t: 0.08, d: 0.35 },
      { f: 392.0, t: 0.16, d: 0.4 },
      { f: 523.25, t: 0.24, d: 0.55 },
      { f: 659.25, t: 0.34, d: 0.65 },
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, now + n.t);

      gain.gain.setValueAtTime(0.001, now + n.t);
      gain.gain.linearRampToValueAtTime(0.3, now + n.t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    });
  }

  public playBallPop() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playDaubHit() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.32, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.19);
    });
  }

  public playMissPenalty() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.22);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playBingoFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [261.63, 329.63, 392.0, 523.25];
    chord.forEach((freq) => {
      const pad = ctx.createOscillator();
      const padGain = ctx.createGain();
      pad.type = 'sine';
      pad.frequency.setValueAtTime(freq, now);
      padGain.gain.setValueAtTime(0.001, now);
      padGain.gain.linearRampToValueAtTime(0.2, now + 0.1);
      padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      pad.connect(padGain);
      padGain.connect(ctx.destination);
      pad.start(now);
      pad.stop(now + 1.45);
    });

    const melody = [
      { f: 523.25, t: 0, d: 0.14 },
      { f: 659.25, t: 0.12, d: 0.14 },
      { f: 783.99, t: 0.24, d: 0.14 },
      { f: 1046.5, t: 0.36, d: 0.55 },
      { f: 1318.51, t: 0.52, d: 0.65 },
    ];

    melody.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now + note.t);
      gain.gain.setValueAtTime(0.35, now + note.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.t);
      osc.stop(now + note.t + note.d + 0.02);
    });
  }

  // High-volume, crystal clear Female Voice announcing Letter, Number, and Amharic translation (1 to 300)
  public announceBall(letter: 'B' | 'I' | 'N' | 'G' | 'O', number: number) {
    if (this.muted || !this.voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      // Play acoustic chime first to raise acoustic presence
      this.playAttentionChime();

      window.speechSynthesis.cancel();

      if (!this.cachedFemaleVoice) {
        this.cachedFemaleVoice = this.pickBestFemaleVoice();
      }

      const isAmharic = Boolean(this.cachedFemaleVoice?.lang?.toLowerCase().startsWith('am'));

      const letterAmharic = LETTER_AMHARIC_GEEZ[letter] || letter;
      const letterPhonetic = LETTER_PHONETIC[letter] || letter;
      const geezNumber = numberToAmharicGeez(number);
      const phoneticNumber = numberToAmharicPhonetic(number);

      // PURE AMHARIC ANNOUNCEMENT ONLY (No English numbers or English words)
      // When native Amharic TTS voice exists: e.g. "ቢ ... አርባ አምስት"
      // When general browser female voice: phonetic Ethiopian Geez Amharic: e.g. "Bee ... Ahr-bah Ah-meest!"
      const phrase = isAmharic
        ? `${letterAmharic} ... ${geezNumber}`
        : `${letterPhonetic} ... ${phoneticNumber}`;

      const utterance = new SpeechSynthesisUtterance(phrase);

      if (this.cachedFemaleVoice) {
        utterance.voice = this.cachedFemaleVoice;
      }

      // Maximum loudness (1.0), clear distinct cadence (0.85), bright female pitch (1.2)
      utterance.volume = 1.0;
      utterance.rate = 0.85;
      utterance.pitch = isAmharic ? 1.05 : 1.2;

      window.speechSynthesis.speak(utterance);
    } catch {
      // Fallback
    }
  }

  // Announces BINGO loudly with female celebratory voice
  public announceBingo() {
    if (this.muted || !this.voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      if (!this.cachedFemaleVoice) {
        this.cachedFemaleVoice = this.pickBestFemaleVoice();
      }

      const utterance = new SpeechSynthesisUtterance('BINGO! BINGO! Baga Gammaddan! BINGO!');
      if (this.cachedFemaleVoice) {
        utterance.voice = this.cachedFemaleVoice;
      }
      utterance.volume = 1.0;
      utterance.rate = 0.95;
      utterance.pitch = 1.25;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore
    }
  }

  // Allows testing the loud female Amharic voice on demand
  public testVoice() {
    this.announceBall('B', 45);
  }
}

export const soundEngine = new SoundEngine();
