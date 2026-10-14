// Deterministic Cartela Generator for Numbers 1 to 300
// Guarantees every Cartela ID (#1 to #300) produces a unique, reproducible 5x5 Bingo card
// mapped across B (1-60), I (61-120), N (121-180), G (181-240), O (241-300).

export interface BingoCell {
  row: number;
  col: number;
  letter: 'B' | 'I' | 'N' | 'G' | 'O';
  number: number; // 0 for center FREE space
  daubed: boolean;
  isFree?: boolean;
}

export const BINGO_LETTERS: ('B' | 'I' | 'N' | 'G' | 'O')[] = ['B', 'I', 'N', 'G', 'O'];

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function getCartelaGrid(cartelaId: number): BingoCell[][] {
  const safeId = Math.max(1, Math.min(300, Math.floor(cartelaId)));
  const rng = seededRandom(safeId * 7919 + 104729);

  // Pool of numbers 1 to 300 evenly divided across B - I - N - G - O
  const ranges: [number, number][] = [
    [1, 60],     // B: 1-60
    [61, 120],   // I: 61-120
    [121, 180],  // N: 121-180
    [181, 240],  // G: 181-240
    [241, 300],  // O: 241-300
  ];

  const cols: number[][] = ranges.map(([min, max]) => {
    const pool: number[] = [];
    for (let i = min; i <= max; i++) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 5);
  });

  const grid: BingoCell[][] = [];
  for (let r = 0; r < 5; r++) {
    const rowCells: BingoCell[] = [];
    for (let c = 0; c < 5; c++) {
      const isCenter = r === 2 && c === 2;
      rowCells.push({
        row: r,
        col: c,
        letter: BINGO_LETTERS[c],
        number: isCenter ? 0 : cols[c][r],
        daubed: isCenter,
        isFree: isCenter,
      });
    }
    grid.push(rowCells);
  }
  return grid;
}

export function getLetterForNumber(n: number): 'B' | 'I' | 'N' | 'G' | 'O' {
  if (n <= 60) return 'B';
  if (n <= 120) return 'I';
  if (n <= 180) return 'N';
  if (n <= 240) return 'G';
  return 'O';
}

export function checkCartelaWinningPattern(
  board: BingoCell[][],
  calledSet: Set<number>,
  requireManualDaub: boolean
): { hasWon: boolean; pattern: string; cells: Set<string> } {
  const isCellMarked = (cell: BingoCell) => {
    if (cell.isFree) return true;
    if (!calledSet.has(cell.number)) return false;
    return requireManualDaub ? cell.daubed : true;
  };

  // Check 5 Horizontal Rows
  for (let r = 0; r < 5; r++) {
    if (board[r].every((c) => isCellMarked(c))) {
      const set = new Set<string>();
      for (let c = 0; c < 5; c++) set.add(`${r}-${c}`);
      return { hasWon: true, pattern: `Sarara Dalgee (Row ${r + 1})`, cells: set };
    }
  }

  // Check 5 Vertical Columns
  for (let c = 0; c < 5; c++) {
    let allCol = true;
    for (let r = 0; r < 5; r++) {
      if (!isCellMarked(board[r][c])) allCol = false;
    }
    if (allCol) {
      const set = new Set<string>();
      for (let r = 0; r < 5; r++) set.add(`${r}-${c}`);
      return { hasWon: true, pattern: `Sarara Dhaabbataa (Column ${BINGO_LETTERS[c]})`, cells: set };
    }
  }

  // Main Diagonal
  if ([0, 1, 2, 3, 4].every((i) => isCellMarked(board[i][i]))) {
    const set = new Set<string>(['0-0', '1-1', '2-2', '3-3', '4-4']);
    return { hasWon: true, pattern: 'Sarara Qaxxaamuraa (Diagonal X)', cells: set };
  }

  // Anti Diagonal
  if ([0, 1, 2, 3, 4].every((i) => isCellMarked(board[i][4 - i]))) {
    const set = new Set<string>(['0-4', '1-3', '2-2', '3-1', '4-0']);
    return { hasWon: true, pattern: 'Sarara Qaxxaamuraa (Cross Diagonal)', cells: set };
  }

  // 4 Corners
  if (
    isCellMarked(board[0][0]) &&
    isCellMarked(board[0][4]) &&
    isCellMarked(board[4][0]) &&
    isCellMarked(board[4][4])
  ) {
    const set = new Set<string>(['0-0', '0-4', '4-0', '4-4']);
    return { hasWon: true, pattern: 'Rogoota 4 (Four Corners)', cells: set };
  }

  return { hasWon: false, pattern: '', cells: new Set() };
}
