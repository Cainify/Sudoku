import { getSudoku } from 'sudoku-gen';

export type PlayerId = 'p1' | 'p2';

export interface CellState {
  index: number;
  value: number | null;
  valueOwner: PlayerId | null;
  isGiven: boolean;
  notes: Record<number, PlayerId>;
}

export class SudokuGame {
  public cells: CellState[] = [];
  public solution: number[] = [];
  public difficulty: string = '';
  public preventWrongEntry: boolean = true;

  constructor() {
    this.initEmpty();
  }

  initEmpty() {
    this.cells = Array.from({ length: 81 }, (_, i) => ({
      index: i,
      value: null,
      valueOwner: null,
      isGiven: false,
      notes: {}
    }));
    this.solution = [];
  }

  generate(difficulty: 'easy' | 'medium' | 'hard', preventWrongEntry: boolean = true) {
    const sdk = getSudoku(difficulty);
    this.difficulty = difficulty;
    this.preventWrongEntry = preventWrongEntry;
    
    for (let i = 0; i < 81; i++) {
      const char = sdk.puzzle[i];
      const solChar = sdk.solution[i];
      
      this.solution[i] = parseInt(solChar, 10);
      
      if (char !== '-') {
        this.cells[i] = {
          index: i,
          value: parseInt(char, 10),
          valueOwner: null,
          isGiven: true,
          notes: {}
        };
      } else {
        this.cells[i] = {
          index: i,
          value: null,
          valueOwner: null,
          isGiven: false,
          notes: {}
        };
      }
    }
  }

  loadState(state: any) {
    this.cells = state.cells;
    this.solution = state.solution;
    this.difficulty = state.difficulty;
    this.preventWrongEntry = state.preventWrongEntry;
  }

  getState() {
    return {
      cells: this.cells,
      solution: this.solution,
      difficulty: this.difficulty,
      preventWrongEntry: this.preventWrongEntry
    };
  }

  setValue(index: number, value: number | null, player: PlayerId | null = null): boolean {
    if (this.cells[index].isGiven) return false;
    
    if (this.preventWrongEntry && value !== null && value !== this.solution[index]) {
      return false; // Error
    }
    
    this.cells[index].value = value;
    this.cells[index].valueOwner = player;
    
    if (value !== null) {
      this.cells[index].notes = {};
      this.clearRelatedNotes(index, value);
    }
    return true;
  }

  toggleNote(index: number, value: number, player: PlayerId) {
    if (this.cells[index].isGiven || this.cells[index].value !== null) return;
    
    const notes = this.cells[index].notes;
    if (notes[value]) {
      delete notes[value];
    } else {
      notes[value] = player;
    }
  }

  clearRelatedNotes(index: number, value: number) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    
    const relatedIndices = new Set<number>();
    
    for (let c = 0; c < 9; c++) relatedIndices.add(row * 9 + c);
    for (let r = 0; r < 9; r++) relatedIndices.add(r * 9 + col);
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        relatedIndices.add((boxR + r) * 9 + (boxC + c));
      }
    }
    
    relatedIndices.forEach(i => {
      if (this.cells[i].notes[value]) {
        delete this.cells[i].notes[value];
      }
    });
  }

  checkWin(): boolean {
    if (this.cells.length === 0 || this.solution.length === 0) return false;
    for (let i = 0; i < 81; i++) {
      if (this.cells[i].value !== this.solution[i]) return false;
    }
    return true;
  }
}
