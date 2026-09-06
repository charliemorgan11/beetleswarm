import { SwarmGame } from './engine.mjs';

const $ = id => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d', { alpha: false });
let W = 720, H = 960;
const base = document.createElement('canvas'); base.width = W; base.height = H;
const bctx = base.getContext('2d', { alpha: false });
const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
const lctx = layer.getContext('2d');
const chart = new Image(), beetle = new Image();
let cachedRevision = -1, levelAdvanceAt = 0, flashUntil = 0, startTime = 0, lastTime = 0, artReady = false, assetError = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const game = new SwarmGame({ onEvent: handleEvent });
let cw = W / game.cols, ch = H / game.rows;

function makeBase() {
  bctx.fillStyle = '#d8bc80'; bctx.fillRect(0, 0, W, H);
  if (chart.complete && chart.naturalWidth) {
    const scale = Math.max(W / chart.naturalWidth, H / chart.naturalHeight);
    const width = chart.naturalWidth * scale, height = chart.naturalHeight * scale;
    bctx.drawImage(chart, (W - width) / 2, (H - height) / 2, width, height);
  }
  bctx.fillStyle = '#fff0c51a'; bctx.fillRect(0, 0, W, H);
  bctx.strokeStyle = '#473c2420'; bctx.lineWidth = .6;
  for (let x = cw; x < W; x += cw) { bctx.beginPath(); bctx.moveTo(x, 0); bctx.lineTo(x, H); bctx.stroke(); }
  for (let y = ch; y < H; y += ch) { bctx.beginPath(); bctx.moveTo(0, y); bctx.lineTo(W, y); bctx.stroke(); }
  cachedRevision = -1;
}
$('action').disabled = true; $('action').textContent = 'Unfurling the Chart…';
function assetsLoaded() {
  if (!chart.naturalWidth || !beetle.naturalWidth) return;
  artReady = true; $('action').disabled = false; $('action').textContent = 'Set Sail';
}
function assetFailed() {
  assetError = true; $('action').disabled = false; $('action').textContent = 'Try Again';
  $('dialog-description').textContent = 'The map could not load. Check your connection, then try again.';
}
chart.onload = () => { makeBase(); assetsLoaded(); }; beetle.onload = assetsLoaded;
chart.onerror = assetFailed; beetle.onerror = assetFailed;
chart.src = '/assets/chart.png'; beetle.src = '/assets/beetle.png';
makeBase();

function drawTerritory() {
  if (cachedRevision === game.revision) return;
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = 'rgba(92,44,24,.72)';
  for (let y = 0; y < game.rows; y++) {
    let run = -1;
    for (let x = 0; x <= game.cols; x++) {
      const safe = x < game.cols && game.cell(x, y) === 1;
      if (safe && run < 0) run = x;
      if (!safe && run >= 0) { lctx.fillRect(run * cw, y * ch, (x - run) * cw, ch); run = -1; }
    }
  }
  lctx.strokeStyle = '#bfa56c'; lctx.lineWidth = 1.5; lctx.beginPath();
  for (let y = 0; y < game.rows; y++) for (let x = 0; x < game.cols; x++) {
    if (game.cell(x, y) !== 1) continue;
    if (x + 1 < game.cols && game.cell(x + 1, y) !== 1) { lctx.moveTo((x + 1) * cw, y * ch); lctx.lineTo((x + 1) * cw, (y + 1) * ch); }
    if (x > 0 && game.cell(x - 1, y) !== 1) { lctx.moveTo(x * cw, y * ch); lctx.lineTo(x * cw, (y + 1) * ch); }
    if (y + 1 < game.rows && game.cell(x, y + 1) !== 1) { lctx.moveTo(x * cw, (y + 1) * ch); lctx.lineTo((x + 1) * cw, (y + 1) * ch); }
    if (y > 0 && game.cell(x, y - 1) !== 1) { lctx.moveTo(x * cw, y * ch); lctx.lineTo((x + 1) * cw, y * ch); }
  }
  lctx.stroke(); cachedRevision = game.revision;
}

function render(now) {
  drawTerritory(); ctx.drawImage(base, 0, 0); ctx.drawImage(layer, 0, 0);
  const unit = Math.min(cw, ch);
  if (game.trail.length) {
    ctx.beginPath(); ctx.moveTo((game.lastSafe.x + .5) * cw, (game.lastSafe.y + .5) * ch);
    for (const i of game.trail) ctx.lineTo((i % game.cols + .5) * cw, (Math.floor(i / game.cols) + .5) * ch);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = unit * .68; ctx.strokeStyle = '#704817'; ctx.stroke();
    ctx.lineWidth = unit * .40; ctx.strokeStyle = '#f9d273'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff3c4'; ctx.setLineDash([3, 8]); ctx.lineDashOffset = reducedMotion ? 0 : -game.time * 12; ctx.stroke(); ctx.setLineDash([]);
  }
  for (const b of game.beetles) {
    if (!beetle.complete || !beetle.naturalWidth) continue;
    ctx.save(); ctx.translate(b.x * cw, b.y * ch);
    ctx.rotate(Math.atan2(b.vy * ch, b.vx * cw) + Math.PI / 2 + (reducedMotion ? 0 : Math.sin(game.time * 22 + b.phase) * .07));
    const size = unit * 2.5, gait = reducedMotion ? 1 : 1 + Math.sin(game.time * 22 + b.phase) * .035;
    ctx.scale(gait, 1 / gait); ctx.shadowColor = '#20130699'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 3;
    ctx.drawImage(beetle, -size / 2, -size / 2, size, size); ctx.restore();
  }
  const px = (game.player.x + .5) * cw, py = (game.player.y + .5) * ch;
  ctx.save(); ctx.translate(px, py);
  ctx.beginPath(); ctx.arc(0, 0, unit * (1.05 + (reducedMotion ? 0 : Math.sin(now / 220) * .10)), 0, Math.PI * 2);
  ctx.fillStyle = '#fff0b429'; ctx.fill();
  ctx.shadowColor = '#fff0a4'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(0, -unit * .67); ctx.lineTo(unit * .52, 0); ctx.lineTo(0, unit * .67); ctx.lineTo(-unit * .52, 0); ctx.closePath();
  ctx.fillStyle = '#fff2be'; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#493210'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#9b3b29'; ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
  if (game.state === 'playing' && !game.direction && !game.trail.length && game.progress === 0 && now - startTime < 8000) {
    ctx.save(); ctx.font = 'italic 26px "IM Fell English", Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ead19bd9'; ctx.fillRect(W / 2 - 168, 38, 336, 45);
    ctx.fillStyle = '#3d2516'; ctx.fillText('Swipe to chart your course', W / 2, 69); ctx.restore();
  }
  if (now < flashUntil) { ctx.fillStyle = '#d2efcc22'; ctx.fillRect(0, 0, W, H); }
}

function updateHud() {
  $('level').textContent = String(game.level).padStart(2, '0');
  $('beetles').textContent = String(game.beetles.length).padStart(2, '0');
  $('lives').innerHTML = [0, 1, 2].map(i => `<span class="${i >= game.lives ? 'lost' : ''}" aria-hidden="true">♥</span>`).join('');
  $('lives').setAttribute('aria-label', `${game.lives} ${game.lives === 1 ? 'life' : 'lives'}`);
  const percent = Math.floor(game.progress * 1000) / 10;
  $('percent').textContent = `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
  $('progress-fill').style.width = `${percent}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', String(Math.min(percent, 80)));
  $('pause').disabled = !['playing', 'paused'].includes(game.state);
  $('pause').setAttribute('aria-label', game.state === 'paused' ? 'Resume game' : 'Pause game');
}

function showDialog({ eyebrow, title, description, action, restart = false }) {
  $('cover-icon').hidden = true; $('start-rules').hidden = true; $('danger-note').hidden = true;
  $('dialog-eyebrow').textContent = eyebrow; $('dialog-title').textContent = title;
  $('dialog-description').textContent = description; $('action').textContent = action;
  $('restart').hidden = !restart; $('restart').dataset.confirm = ''; $('restart').textContent = 'New Voyage'; $('overlay').hidden = false;
  canvas.setAttribute('tabindex', '-1');
  $('action').focus({ preventScroll: true });
}
function hideDialog() {
  $('overlay').hidden = true; canvas.setAttribute('tabindex', '0');
  canvas.focus({ preventScroll: true });
}
function handleEvent(event) {
  updateHud();
  if (['start', 'level', 'resume'].includes(event.type)) {
    hideDialog(); startTime = performance.now(); levelAdvanceAt = 0;
    $('announcer').textContent = `Chapter ${game.level}. ${game.beetles.length} ${game.beetles.length === 1 ? 'beetle' : 'beetles'}. Claim 80% of the map.`;
  }
  if (event.type === 'capture') {
    flashUntil = performance.now() + (reducedMotion ? 0 : 180);
    $('announcer').textContent = `${Math.floor(game.progress * 100)} percent claimed.`;
  }
  if (event.type === 'win') {
    levelAdvanceAt = performance.now() + 650;
    $('announcer').textContent = `Chapter ${game.level} complete. Starting chapter ${game.level + 1}.`;
  }
  if (event.type === 'pause') showDialog({ eyebrow: 'Captain’s Log', title: 'At Anchor', description: 'The voyage is paused.', action: 'Resume Voyage', restart: true });
  if (event.type === 'hit') {
    $('board-frame').classList.remove('hit'); requestAnimationFrame(() => $('board-frame').classList.add('hit'));
    showDialog(game.state === 'over'
      ? { eyebrow: 'The Swarm Prevails', title: 'Shipwrecked', description: `Chapter ${game.level} · ${(game.progress * 100).toFixed(1)}% of the chart claimed.`, action: 'New Voyage' }
      : { eyebrow: `${game.lives} ${game.lives === 1 ? 'LIFE' : 'LIVES'} REMAINING`, title: 'Trail Lost', description: `${event.reason} Claimed land remains yours.`, action: 'Sail On' });
    $('announcer').textContent = `${event.reason} ${game.lives} lives remaining.`;
  }
}

function act() {
  if (assetError) { location.reload(); return; }
  if (!artReady) return;
  enterFullscreen();
  if (game.state === 'ready' || game.state === 'over') game.start();
  else if (game.state === 'won') game.nextLevel();
  else game.resume();
}
$('action').addEventListener('click', act);
$('restart').addEventListener('click', () => {
  if ($('restart').dataset.confirm === 'yes') { $('restart').dataset.confirm = ''; game.start(); }
  else { $('restart').dataset.confirm = 'yes'; $('restart').textContent = 'Begin anew from Chapter 1?'; }
});
$('pause').addEventListener('click', () => { if (game.state === 'paused') game.resume(); else game.pause(); });
function steer(direction) { game.steer(direction); }

const keyDirections = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
document.addEventListener('keydown', e => {
  if (!$('overlay').hidden && e.key === 'Tab') {
    const focusable = [$('action'), ...(!$('restart').hidden ? [$('restart')] : [])];
    if (e.shiftKey && document.activeElement === focusable[0]) { e.preventDefault(); focusable.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === focusable.at(-1)) { e.preventDefault(); focusable[0].focus(); }
    return;
  }
  if (keyDirections[e.key] && game.state === 'playing') { e.preventDefault(); steer(keyDirections[e.key]); }
  else if (e.key === 'Escape' || (e.key === ' ' && $('overlay').hidden)) { e.preventDefault(); if (game.state === 'playing') game.pause(); else if (game.state === 'paused') game.resume(); }
});

let pointer = null;
canvas.addEventListener('pointerdown', e => {
  if (game.state !== 'playing' || pointer || !e.isPrimary) return;
  e.preventDefault(); canvas.setPointerCapture(e.pointerId);
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', e => {
  if (!pointer || pointer.id !== e.pointerId || game.state !== 'playing') return;
  e.preventDefault();
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= 14) {
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    pointer.x = e.clientX; pointer.y = e.clientY;
  }
});
function endPointer(e) { if (pointer?.id === e.pointerId) pointer = null; }
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer); canvas.addEventListener('lostpointercapture', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) { pointer = null; game.pause(); lastTime = 0; } });
window.addEventListener('pagehide', () => game.pause());
// Use all available space while keeping sprites and the cursor proportional.
// Resizing the rendering surface preserves the current map, trail and lives.
new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  if (width <= 0 || height <= 0) return;
  W = 720; H = Math.max(240, Math.round(W * height / width));
  cw = W / game.cols; ch = H / game.rows;
  for (const surface of [canvas, base, layer]) { surface.width = W; surface.height = H; }
  makeBase();
}).observe(document.querySelector('.board-region'));
function enterFullscreen() {
  if (document.fullscreenElement || !document.fullscreenEnabled) return;
  // A supported browser can hide its chrome following the player's tap.
  try { document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch {}
}
$('fullscreen').hidden = !document.fullscreenEnabled;
$('fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else enterFullscreen();
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen');
});
function frame(now) {
  const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0; lastTime = now;
  if (game.state === 'won' && levelAdvanceAt && now >= levelAdvanceAt && !document.hidden) game.nextLevel();
  game.step(dt); render(now); requestAnimationFrame(frame);
}
updateHud(); canvas.tabIndex = -1;
requestAnimationFrame(frame);
