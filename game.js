'use strict';

/* ═══════════════════════════════════════════
   Tiki Topple — Game Logic
   Rules summary:
   • 8 tikis stacked in a random totem pole
   • Each player is assigned 1 secret tiki
   • Play cards: Move Up, Move Down, or Topple
   • Topple removes the topmost tiki permanently
   • Game ends after 4 topples
   • Highest remaining tiki wins
═══════════════════════════════════════════ */

const TIKIS = [
  { id: 0, name: 'Red',    color: '#c0392b', bg: '#fadbd8' },
  { id: 1, name: 'Blue',   color: '#2471a3', bg: '#d6eaf8' },
  { id: 2, name: 'Green',  color: '#1e8449', bg: '#d5f5e3' },
  { id: 3, name: 'Yellow', color: '#b7950b', bg: '#fef9e7' },
  { id: 4, name: 'Orange', color: '#ca6f1e', bg: '#fdebd0' },
  { id: 5, name: 'Purple', color: '#6c3483', bg: '#e8daef' },
  { id: 6, name: 'Brown',  color: '#784212', bg: '#f5cba7' },
  { id: 7, name: 'White',  color: '#555555', bg: '#f2f3f4' },
];

/* Distinct face emoji per tiki */
const TIKI_FACES = ['😤', '😎', '😄', '😡', '😲', '😈', '🤩', '😊'];

/* Global game state */
let G = null;
let handVisible = false;

/* ══════════════════════════════════════
   Helpers
══════════════════════════════════════ */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck() {
  const deck = [];
  /* 2 × Move-Up + 2 × Move-Down for each of the 8 tikis = 32 cards */
  TIKIS.forEach(t => {
    deck.push({ type: 'up',   tikiId: t.id });
    deck.push({ type: 'up',   tikiId: t.id });
    deck.push({ type: 'down', tikiId: t.id });
    deck.push({ type: 'down', tikiId: t.id });
  });
  /* 12 Topple cards */
  for (let i = 0; i < 12; i++) {
    deck.push({ type: 'topple' });
  }
  return shuffle(deck);
}

function deal(deck, n) {
  return deck.splice(0, n);
}

function addLog(msg) {
  G.log.unshift(msg);
  if (G.log.length > 20) G.log.length = 20;
}

function cur() {
  return G.players[G.currentIdx];
}

function drawCard(player) {
  /* Reshuffle discard into deck if needed */
  if (G.deck.length === 0) {
    if (G.discard.length === 0) return;
    G.deck = shuffle(G.discard);
    G.discard = [];
    addLog('♻️ Deck reshuffled from discard pile.');
  }
  player.hand.push(G.deck.shift());
}

/* ══════════════════════════════════════
   Game Init
══════════════════════════════════════ */
function initGame(names) {
  const deck = createDeck();
  const n = names.length;

  /* Assign one unique tiki per player */
  const assignedIds = shuffle([...Array(8).keys()]).slice(0, n);

  const players = names.map((name, i) => ({
    name,
    tikiId: assignedIds[i],
    hand: deal(deck, 5),
  }));

  G = {
    players,
    currentIdx: 0,
    pole: shuffle([...Array(8).keys()]),  /* index 0 = bottom, last = top */
    toppled: [],
    deck,
    discard: [],
    toppleCount: 0,
    maxTopples: 4,
    log: [],
    over: false,
  };

  handVisible = false;
  addLog('🌴 Game started! Good luck!');
  showScreen('game-screen');
  renderAll();
}

/* ══════════════════════════════════════
   Card Playing
══════════════════════════════════════ */
function playCard(i) {
  if (G.over || !handVisible) return;

  const player = cur();
  const card = player.hand[i];

  /* Remove card from hand */
  player.hand.splice(i, 1);
  G.discard.push(card);

  if (card.type === 'topple') {
    /* ── TOPPLE: remove the topmost tiki ── */
    if (G.pole.length > 0) {
      const tId = G.pole.pop();
      G.toppled.push(tId);
      G.toppleCount++;
      addLog(`${player.name} toppled the ${TIKIS[tId].name} tiki! 💥`);
    } else {
      addLog(`${player.name} played Topple — nothing left to topple!`);
    }
  } else {
    /* ── MOVE UP / DOWN ── */
    const t = TIKIS[card.tikiId];
    const pos = G.pole.indexOf(card.tikiId);

    if (pos === -1) {
      addLog(`${player.name} played ${t.name} ${card.type === 'up' ? '↑' : '↓'} — already toppled!`);
    } else if (card.type === 'up') {
      if (pos < G.pole.length - 1) {
        [G.pole[pos], G.pole[pos + 1]] = [G.pole[pos + 1], G.pole[pos]];
        addLog(`${player.name} moved ${t.name} up ↑ (now #${pos + 2})`);
      } else {
        addLog(`${player.name} played ${t.name} ↑ — already at the top!`);
      }
    } else {  /* down */
      if (pos > 0) {
        [G.pole[pos], G.pole[pos - 1]] = [G.pole[pos - 1], G.pole[pos]];
        addLog(`${player.name} moved ${t.name} down ↓ (now #${pos})`);
      } else {
        addLog(`${player.name} played ${t.name} ↓ — already at the bottom!`);
      }
    }
  }

  /* Draw replacement card */
  drawCard(player);

  /* Check game-over condition */
  if (G.toppleCount >= G.maxTopples || G.pole.length === 0) {
    endGame();
    return;
  }

  /* Advance to next player */
  G.currentIdx = (G.currentIdx + 1) % G.players.length;
  handVisible = false;
  renderAll();
}

/* ══════════════════════════════════════
   Game Over
══════════════════════════════════════ */
function endGame() {
  G.over = true;
  addLog('🏆 Game over!');

  /* Rank players: higher pole position = better; toppled = worst */
  const ranked = G.players.map(p => ({
    ...p,
    polePos: G.pole.indexOf(p.tikiId),  /* -1 if toppled */
  })).sort((a, b) => b.polePos - a.polePos);

  showGameOver(ranked);
}

/* ══════════════════════════════════════
   UI — Screen switching
══════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ══════════════════════════════════════
   UI — Render helpers
══════════════════════════════════════ */
function tikiFaceHTML(id, size) {
  const t = TIKIS[id];
  return `<span style="font-size:${size}rem">${TIKI_FACES[id]}</span>`;
}

function renderAll() {
  renderHeader();
  renderPole();
  renderHand();
  renderPlayers();
  renderLog();
}

function renderHeader() {
  document.getElementById('cur-player-name').textContent = cur().name + "'s Turn";

  const t = TIKIS[cur().tikiId];
  const pos = G.pole.indexOf(cur().tikiId);
  const posStr = pos >= 0
    ? `position ${pos + 1} of ${G.pole.length}`
    : '<strong>TOPPLED!</strong>';
  document.getElementById('cur-tiki-info').innerHTML =
    `Your tiki: <span style="color:${t.color};font-weight:700">${TIKI_FACES[cur().tikiId]} ${t.name}</span>` +
    ` — ${posStr}`;

  document.getElementById('topple-counter').textContent =
    `💥 Topples: ${G.toppleCount} / ${G.maxTopples}`;
  document.getElementById('deck-counter').textContent =
    `Deck: ${G.deck.length} cards`;
}

function renderPole() {
  /* Totem pole: show top-first in the DOM */
  document.getElementById('pole-tikis').innerHTML =
    [...G.pole].reverse().map((id, dispIdx) => {
      const t = TIKIS[id];
      const isTop = dispIdx === 0;
      const realPos = G.pole.length - dispIdx;
      return `<div class="pole-tiki${isTop ? ' pole-top' : ''}"
                   style="background:${t.bg};border-color:${t.color}">
        ${isTop ? '<div class="top-label">TOP ⬆</div>' : ''}
        <div class="pt-pos">#${realPos}</div>
        <div class="pt-face">${TIKI_FACES[id]}</div>
        <div class="pt-name" style="color:${t.color}">${t.name}</div>
      </div>`;
    }).join('');

  /* Toppled area */
  const tel = document.getElementById('toppled-list');
  tel.innerHTML = G.toppled.length
    ? G.toppled.map(id => {
        const t = TIKIS[id];
        return `<span class="toppled-chip"
                      style="background:${t.bg};border-color:${t.color};color:${t.color}">
          ${TIKI_FACES[id]} ${t.name}
        </span>`;
      }).join('')
    : '<em>None yet</em>';
}

function renderHand() {
  const overlay = document.getElementById('hand-overlay');
  const handEl  = document.getElementById('hand-cards');

  if (!handVisible) {
    overlay.classList.remove('hidden');
    overlay.querySelector('.overlay-player').textContent = cur().name + "'s Turn";
    handEl.innerHTML = '';
    return;
  }

  overlay.classList.add('hidden');
  const player = cur();

  handEl.innerHTML = player.hand.map((card, i) => {
    if (card.type === 'topple') {
      return `<div class="card card-topple" onclick="window.playCard(${i})">
        <div class="card-big-icon">💥</div>
        <div class="card-title">TOPPLE</div>
        <div class="card-sub">Remove top tiki</div>
      </div>`;
    }

    const t   = TIKIS[card.tikiId];
    const isUp = card.type === 'up';
    const pos  = G.pole.indexOf(card.tikiId);
    const active = pos !== -1 && (isUp ? pos < G.pole.length - 1 : pos > 0);

    return `<div class="card card-move${active ? '' : ' card-dim'}"
                 style="border-color:${t.color};background:${t.bg}"
                 onclick="window.playCard(${i})"
                 title="${active ? '' : 'This card may have no effect'}">
      <div class="card-color-bar" style="background:${t.color}"></div>
      <div class="card-face">${TIKI_FACES[card.tikiId]}</div>
      <div class="card-title" style="color:${t.color}">${t.name}</div>
      <div class="card-dir">${isUp ? '↑ UP' : '↓ DOWN'}</div>
    </div>`;
  }).join('');
}

function renderPlayers() {
  document.getElementById('players-panel').innerHTML =
    G.players.map((p, i) => {
      const t   = TIKIS[p.tikiId];
      const pos = G.pole.indexOf(p.tikiId);
      const isCur = i === G.currentIdx;
      return `<div class="player-row${isCur ? ' player-cur' : ''}">
        <div class="pr-name">${isCur ? '▶ ' : ''}${p.name}</div>
        <div class="pr-tiki" style="color:${t.color}">${TIKI_FACES[p.tikiId]} ${t.name}</div>
        <div class="pr-pos">${pos >= 0 ? 'Position #' + (pos + 1) : '💀 Toppled'}</div>
      </div>`;
    }).join('');
}

function renderLog() {
  document.getElementById('log-list').innerHTML =
    G.log.map(m => `<div class="log-entry">${m}</div>`).join('');
}

/* ══════════════════════════════════════
   UI — Game Over
══════════════════════════════════════ */
function showGameOver(ranked) {
  showScreen('gameover-screen');

  const medals = ['🥇', '🥈', '🥉', '4️⃣'];

  document.getElementById('winner-name').textContent =
    `🎉 ${ranked[0].name} wins!`;

  document.getElementById('rankings').innerHTML =
    ranked.map((p, i) => {
      const t = TIKIS[p.tikiId];
      return `<div class="ranking-row${i === 0 ? ' rank-1' : ''}">
        <span>${medals[i] || (i + 1) + '.'}</span>
        <span class="rk-name">${p.name}</span>
        <span style="color:${t.color}">${TIKI_FACES[p.tikiId]} ${t.name}</span>
        <span>${p.polePos >= 0 ? 'Position ' + (p.polePos + 1) : 'Toppled 💀'}</span>
      </div>`;
    }).join('');

  document.getElementById('final-pole').innerHTML =
    [...G.pole].reverse().map((id, i) => {
      const t = TIKIS[id];
      return `<div class="result-pole-tiki" style="background:${t.bg};border-color:${t.color}">
        <span style="color:#888;font-size:.8rem">#${G.pole.length - i}</span>
        <span>${TIKI_FACES[id]}</span>
        <span style="color:${t.color};font-weight:700">${t.name}</span>
      </div>`;
    }).join('');
}

/* ══════════════════════════════════════
   Setup Screen Wiring
══════════════════════════════════════ */
function buildNameInputs(count) {
  document.getElementById('player-name-inputs').innerHTML =
    Array.from({ length: count }, (_, i) => `
      <div class="input-row">
        <label for="pname-${i}">Player ${i + 1}</label>
        <input id="pname-${i}" type="text" value="Player ${i + 1}" class="name-input">
      </div>`).join('');
}

function initSetupScreen() {
  let selectedCount = 2;

  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCount = +btn.dataset.n;
      buildNameInputs(selectedCount);
    });
  });

  buildNameInputs(2);

  document.getElementById('start-btn').addEventListener('click', () => {
    const names = Array.from({ length: selectedCount }, (_, i) => {
      const v = document.getElementById(`pname-${i}`).value.trim();
      return v || `Player ${i + 1}`;
    });
    initGame(names);
  });

  document.getElementById('reveal-btn').addEventListener('click', () => {
    handVisible = true;
    renderHand();
  });

  document.getElementById('play-again-btn').addEventListener('click', () => {
    showScreen('setup-screen');
  });
}

/* ══════════════════════════════════════
   Expose playCard globally (for onclick)
══════════════════════════════════════ */
window.playCard = playCard;

/* ══════════════════════════════════════
   Boot
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', initSetupScreen);
