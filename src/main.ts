import './style.css';
import { SudokuGame } from './game';
import { NetworkManager } from './network';

const game = new SudokuGame();
const net = new NetworkManager();

let selectedIndex: number | null = null;
let notesMode = false;
let partnerCursorIndex: number | null = null;
let timerSeconds = 0;
let timerInterval: any = null;

function startTimer() {
  clearInterval(timerInterval);
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    if (document.getElementById('win-overlay')?.classList.contains('show')) return;
    timerSeconds++;
    updateTimerDisplay();
    if (net.isHost && timerSeconds % 3 === 0) {
      net.send({ type: 'TIMER_SYNC', seconds: timerSeconds });
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('timer');
  if (!el) return;
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  el.innerText = `${m}:${s}`;
}

const appDiv = document.getElementById('app')!;

function renderSetup() {
  appDiv.innerHTML = `
    <h1>SudoKoop</h1>
    <p class="subtitle">Real-time multiplayer co-op Sudoku</p>
    <div class="glass-panel setup-container">
      <div class="setup-section">
        <h3>Host a Game</h3>
        <select id="difficulty-select">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <label style="display:flex; align-items:center; gap:0.5rem; justify-content:center; margin:0.5rem 0; cursor:pointer; user-select:none;">
          <input type="checkbox" id="prevent-wrong-entry" checked />
          Prevent Wrong Entry
        </label>
        <button id="host-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          Host Game
        </button>
      </div>
      <div class="divider"><span>OR</span></div>
      <div class="setup-section">
        <h3>Join a Game</h3>
        <input type="text" id="room-code" placeholder="ROOM CODE" maxlength="4" />
        <button id="join-btn" class="secondary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
          Join Game
        </button>
      </div>
    </div>
  `;

  document.getElementById('host-btn')!.addEventListener('click', async () => {
    const diff = (document.getElementById('difficulty-select') as HTMLSelectElement).value as any;
    const preventWrong = (document.getElementById('prevent-wrong-entry') as HTMLInputElement).checked;
    const btn = document.getElementById('host-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Creating Room...';
    
    try {
      const code = await net.hostGame();
      game.generate(diff, preventWrong);
      renderLobby(code);
    } catch (e) {
      showToast('Failed to host game');
      btn.disabled = false;
      btn.innerText = 'Host Game';
    }
  });

  document.getElementById('join-btn')!.addEventListener('click', async () => {
    const code = (document.getElementById('room-code') as HTMLInputElement).value;
    if (code.length !== 4) return showToast('Enter 4-letter room code');
    
    const btn = document.getElementById('join-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerText = 'Joining...';
    
    try {
      await net.joinGame(code);
      // Wait for INIT_STATE event to render game
    } catch (e) {
      showToast('Failed to join game');
      btn.disabled = false;
      btn.innerText = 'Join Game';
    }
  });
}

function renderLobby(code: string) {
  appDiv.innerHTML = `
    <h1>SudoKoop</h1>
    <div class="glass-panel setup-container">
      <h3>Waiting for partner...</h3>
      <div class="room-info">
        <span>Room Code:</span>
        <span class="room-code-display">${code}</span>
      </div>
      <p style="color: var(--text-color); opacity: 0.7; font-size: 0.9rem;">
        Share this code with your co-op partner.
      </p>
    </div>
  `;
}

function renderGame() {
  appDiv.className = net.isHost ? 'is-host' : 'is-guest';
  
  appDiv.innerHTML = `
    <div class="game-layout">
      <div class="board-container">
        <div class="sudoku-board" id="board"></div>
      </div>

      <div class="controls">
        <div class="players-info">
          <div class="player-badge p1">Player 1 (Host)</div>
          <div class="player-badge p2">Player 2 (Guest)</div>
        </div>
        <div id="timer" class="timer-display">00:00</div>
        <div class="action-bar">
          <button id="notes-btn" class="action-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            Notes: OFF
          </button>
          <button id="erase-btn" class="action-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20"></path></svg>
            Erase
          </button>
        </div>
        <div class="numpad" id="numpad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="num-btn" data-val="${n}">${n}</button>`).join('')}
        </div>
      </div>
    </div>
    
    <div class="win-overlay" id="win-overlay">
      <h2>Puzzle Solved!</h2>
      <p style="color: white; margin-bottom: 2rem;">Great teamwork!</p>
      ${net.isHost ? `
      <div style="display:flex; gap:1rem;">
        <button id="btn-restart-easy" class="secondary">New Easy</button>
        <button id="btn-restart-medium" class="secondary">New Medium</button>
        <button id="btn-restart-hard" class="secondary">New Hard</button>
      </div>` : `<p style="color:white; opacity: 0.7;">Waiting for host to start a new game...</p>`}
    </div>
    <div class="toast" id="toast"></div>
    <div class="troll-modal" id="troll-modal">
      <h3>Troll Menu</h3>
      <p style="margin-bottom: 1rem;">Unleash chaos on your partner!</p>
      <button class="troll-btn" data-action="earthquake">The Earthquake</button>
      <button class="troll-btn" data-action="australian">Australian Mode</button>
      <button class="troll-btn" data-action="bsod">Fake BSOD</button>
      <button class="troll-btn" data-action="ghost">Ghost Inputs</button>
      <button class="troll-btn" style="margin-top: 1rem; background: var(--surface-color); border:none;" onclick="document.getElementById('troll-modal').classList.remove('show')">Close</button>
    </div>
  `;

  drawBoard();

  // Events
  document.querySelectorAll('.troll-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;
      if (!action) return;
      net.send({ type: 'TROLL_ACTION', action });
      showToast(`Sent ${action} troll!`);
      document.getElementById('troll-modal')?.classList.remove('show');
    });
  });
  document.getElementById('board')!.addEventListener('click', (e) => {
    const cellEl = (e.target as HTMLElement).closest('.cell') as HTMLElement;
    if (!cellEl) return;
    const index = parseInt(cellEl.dataset.index!);
    selectedIndex = index;
    
    net.send({ type: 'CURSOR_MOVE', index });
    drawBoard();
  });

  document.getElementById('notes-btn')!.addEventListener('click', (e) => {
    notesMode = !notesMode;
    const btn = e.currentTarget as HTMLButtonElement;
    btn.classList.toggle('active', notesMode);
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Notes: ${notesMode ? 'ON' : 'OFF'}`;
  });

  document.getElementById('erase-btn')!.addEventListener('click', () => {
    if (selectedIndex === null) return;
    handleInput(null);
  });

  document.getElementById('numpad')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.num-btn') as HTMLButtonElement;
    if (!btn || selectedIndex === null) return;
    const val = parseInt(btn.dataset.val!);
    handleInput(val);
  });

  if (net.isHost) {
    ['easy', 'medium', 'hard'].forEach(diff => {
      document.getElementById(`btn-restart-${diff}`)?.addEventListener('click', () => {
        game.generate(diff as any, game.preventWrongEntry);
        document.getElementById('win-overlay')?.classList.remove('show');
        net.send({ type: 'RESTART', difficulty: diff as any });
        net.send({ type: 'INIT_STATE', state: game.getState() });
        drawBoard();
      });
    });
  }
}

function handleInput(val: number | null) {
  if (selectedIndex === null) return;
  const cell = game.cells[selectedIndex];
  if (cell.isGiven) return;

  if (notesMode && val !== null) {
    game.toggleNote(selectedIndex, val, net.isHost ? 'p1' : 'p2');
    net.send({ type: 'TOGGLE_NOTE', index: selectedIndex, value: val, player: net.isHost ? 'p1' : 'p2' });
  } else {
    const player = net.isHost ? 'p1' : 'p2';
    const success = game.setValue(selectedIndex, val, player);
    if (val !== null && !success) {
      // Error - shake cell
      const el = document.getElementById(`cell-${selectedIndex}`);
      el?.classList.add('error');
      setTimeout(() => el?.classList.remove('error'), 400);
      return;
    }
    net.send({ type: 'SET_VALUE', index: selectedIndex, value: val, player });
  }

  drawBoard();
  checkWin();
}

function checkWin() {
  if (game.checkWin()) {
    document.getElementById('win-overlay')?.classList.add('show');
  }
}

function drawBoard() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  let html = '';
  for (let i = 0; i < 81; i++) {
    const cell = game.cells[i];
    
    let classes = ['cell'];
    if (cell.isGiven) classes.push('given');
    else if (cell.value !== null) classes.push('input');
    
    if (selectedIndex === i) classes.push('selected');
    else if (selectedIndex !== null && cell.value !== null && game.cells[selectedIndex].value === cell.value) {
      classes.push('highlight');
    }
    
    if (selectedIndex !== null && selectedIndex !== i) {
      const sRow = Math.floor(selectedIndex / 9);
      const sCol = selectedIndex % 9;
      const cRow = Math.floor(i / 9);
      const cCol = i % 9;
      const sBoxR = Math.floor(sRow / 3);
      const sBoxC = Math.floor(sCol / 3);
      const cBoxR = Math.floor(cRow / 3);
      const cBoxC = Math.floor(cCol / 3);
      
      if (sRow === cRow || sCol === cCol || (sBoxR === cBoxR && sBoxC === cBoxC)) {
        classes.push('highlight-crosshair');
      }
    }

    if (partnerCursorIndex === i) classes.push('partner-hover');

    html += `<div class="${classes.join(' ')}" id="cell-${i}" data-index="${i}">`;
    
    if (cell.value !== null) {
      let valClass = '';
      if (cell.valueOwner === 'p1') valClass = 'owner-p1';
      else if (cell.valueOwner === 'p2') valClass = 'owner-p2';
      html += `<span class="${valClass}">${cell.value}</span>`;
    } else {
      // Draw notes
      html += `<div class="notes-grid">`;
      for (let n = 1; n <= 9; n++) {
        const owner = cell.notes[n];
        if (owner) {
          html += `<div class="note ${owner}">${n}</div>`;
        } else {
          html += `<div></div>`;
        }
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  
  boardEl.innerHTML = html;
}

let toastTimeout: any;
function showToast(msg: string) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 3000);
}

let keyBuffer = '';
// Global Keyboard support
window.addEventListener('keydown', (e) => {
  if (e.key && e.key.length === 1) {
    keyBuffer += e.key.toLowerCase();
    if (keyBuffer.length > 5) keyBuffer = keyBuffer.slice(-5);
    if (keyBuffer === 'troll') {
      document.getElementById('troll-modal')?.classList.add('show');
      keyBuffer = '';
    }
  }

  if (selectedIndex === null) return;
  if (e.key >= '1' && e.key <= '9') {
    handleInput(parseInt(e.key));
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    handleInput(null);
  } else if (e.key === 'ArrowUp' && selectedIndex >= 9) {
    selectedIndex -= 9; drawBoard(); net.send({ type: 'CURSOR_MOVE', index: selectedIndex });
  } else if (e.key === 'ArrowDown' && selectedIndex <= 71) {
    selectedIndex += 9; drawBoard(); net.send({ type: 'CURSOR_MOVE', index: selectedIndex });
  } else if (e.key === 'ArrowLeft' && selectedIndex % 9 !== 0) {
    selectedIndex -= 1; drawBoard(); net.send({ type: 'CURSOR_MOVE', index: selectedIndex });
  } else if (e.key === 'ArrowRight' && selectedIndex % 9 !== 8) {
    selectedIndex += 1; drawBoard(); net.send({ type: 'CURSOR_MOVE', index: selectedIndex });
  } else if (e.key.toLowerCase() === 'n') {
    document.getElementById('notes-btn')?.click();
  }
});

// Network events
net.onConnect = () => {
  showToast('Partner connected!');
  if (net.isHost) {
    net.send({ type: 'INIT_STATE', state: game.getState() });
    renderGame();
    startTimer();
  }
};

net.onDisconnect = () => {
  showToast('Partner disconnected!');
};

net.onEvent = (e) => {
  if (e.type === 'INIT_STATE') {
    game.loadState(e.state);
    if (!document.getElementById('board')) {
      renderGame();
      startTimer();
    } else {
      drawBoard();
    }
  } else if (e.type === 'SET_VALUE') {
    game.setValue(e.index, e.value, e.player);
    drawBoard();
    checkWin();
  } else if (e.type === 'TOGGLE_NOTE') {
    game.toggleNote(e.index, e.value, e.player);
    drawBoard();
  } else if (e.type === 'CURSOR_MOVE') {
    partnerCursorIndex = e.index;
    drawBoard();
  } else if (e.type === 'RESTART') {
    document.getElementById('win-overlay')?.classList.remove('show');
    showToast(`Host restarted with ${e.difficulty} difficulty`);
    startTimer();
  } else if (e.type === 'TIMER_SYNC') {
    timerSeconds = e.seconds;
    updateTimerDisplay();
  } else if (e.type === 'TROLL_ACTION') {
    executeTroll(e.action);
  }
};

function executeTroll(action: string) {
  if (action === 'earthquake') {
    document.body.classList.add('earthquake');
    setTimeout(() => document.body.classList.remove('earthquake'), 5000);
  } else if (action === 'australian') {
    document.getElementById('board')?.classList.add('australian');
    setTimeout(() => document.getElementById('board')?.classList.remove('australian'), 10000);
  } else if (action === 'bsod') {
    const bsod = document.createElement('div');
    bsod.className = 'fake-bsod';
    bsod.innerHTML = `
      <h1>:(</h1>
      <p>Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.</p>
      <p>20% complete</p>
    `;
    document.body.appendChild(bsod);
    setTimeout(() => bsod.remove(), 4000);
  } else if (action === 'ghost') {
    let flashes = 0;
    const ghostInterval = setInterval(() => {
      if (flashes++ > 15) {
        clearInterval(ghostInterval);
        drawBoard();
        return;
      }
      const randIndex = Math.floor(Math.random() * 81);
      if (game.cells[randIndex].value === null && !game.cells[randIndex].isGiven) {
        const el = document.getElementById(`cell-${randIndex}`);
        if (el) {
          el.innerHTML = `<span style="color:var(--error-color); font-weight:bold; font-size:1.5rem;">${Math.floor(Math.random() * 9) + 1}</span>`;
          setTimeout(() => drawBoard(), 150);
        }
      }
    }, 250);
  }
}

// Init
renderSetup();
