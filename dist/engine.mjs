export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Exact cell closures, continuous enemy movement, frame-rate-independent simulation.
export class SwarmGame {
  constructor({ cols = 48, rows = 64, random = Math.random, onEvent = () => {} } = {}) {
    this.cols = cols; this.rows = rows; this.random = random; this.onEvent = onEvent;
    this.level = 1; this.lives = 3; this.state = 'ready'; this.setLevel(1);
  }
  index(x, y) { return y * this.cols + x; }
  cell(x, y) { return x < 0 || y < 0 || x >= this.cols || y >= this.rows ? 1 : this.grid[this.index(x, y)]; }
  setLevel(level) {
    this.level = level; this.grid = new Uint8Array(this.cols * this.rows);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      if (x === 0 || y === 0 || x === this.cols - 1 || y === this.rows - 1) this.grid[this.index(x, y)] = 1;
    }
    this.player = { x: Math.floor(this.cols / 2), y: 0 };
    this.lastSafe = { ...this.player }; this.direction = null; this.trail = [];
    this.progress = 0; this.tick = 0; this.time = 0; this.revision = (this.revision || 0) + 1;
    this.beetles = Array.from({ length: level }, (_, i) => {
      const angle = this.random() * Math.PI * 2;
      const speed = 4.2 + Math.min(level - 1, 16) * .12 + this.random() * 1.2;
      return { x: 3 + this.random() * (this.cols - 6), y: 7 + this.random() * (this.rows - 11), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, phase: i * 2, turnIn: 1 + this.random() * 3 };
    });
  }
  start() { this.level = 1; this.lives = 3; this.setLevel(1); this.state = 'playing'; this.emit('start'); }
  nextLevel() { if (this.state !== 'won') return; this.setLevel(this.level + 1); this.state = 'playing'; this.emit('level'); }
  resume() { if (this.state === 'paused' || this.state === 'hit') { this.state = 'playing'; this.direction = null; this.tick = 0; this.emit('resume'); } }
  pause() { if (this.state === 'playing') { this.state = 'paused'; this.emit('pause'); } }
  steer(direction) {
    if (this.state !== 'playing' || !DIRS[direction]) return;
    const d = DIRS[direction];
    if (this.trail.length > 1 && this.index(this.player.x + d[0], this.player.y + d[1]) === this.trail[this.trail.length - 2]) return;
    this.direction = direction;
  }
  emit(type, extra = {}) { this.onEvent({ type, ...extra }); }
  step(dt) {
    if (this.state !== 'playing') return;
    let remaining = Math.max(0, Math.min(dt, .1));
    while (remaining > 0 && this.state === 'playing') {
      const h = Math.min(remaining, 1 / 120); remaining -= h; this.time += h;
      this.moveBeetles(h);
      if (this.state !== 'playing') break;
      this.tick += h;
      if (this.tick >= 1 / 18) { this.tick -= 1 / 18; this.movePlayer(); }
    }
  }
  movePlayer() {
    if (!this.direction) return;
    const [dx, dy] = DIRS[this.direction];
    const x = this.player.x + dx, y = this.player.y + dy;
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) { this.direction = null; return; }
    const cell = this.cell(x, y);
    if (cell === 2) { this.loseLife('You crossed your unfinished trail.'); return; }
    if (cell === 0) {
      this.grid[this.index(x, y)] = 2; this.trail.push(this.index(x, y));
      this.player = { x, y }; this.revision++;
      if (this.beetles.some(b => this.touchesCell(b, x, y))) this.loseLife('A beetle caught your trail.');
    } else {
      this.player = { x, y }; this.lastSafe = { x, y };
      if (this.trail.length) this.capture();
    }
  }
  touchesCell(b, x, y, radius = .42) {
    const px = Math.max(x, Math.min(b.x, x + 1)), py = Math.max(y, Math.min(b.y, y + 1));
    return (b.x - px) ** 2 + (b.y - py) ** 2 <= radius ** 2;
  }
  blocked(x, y) {
    const radius = .43;
    for (let cy = Math.floor(y - radius); cy <= Math.floor(y + radius); cy++) {
      for (let cx = Math.floor(x - radius); cx <= Math.floor(x + radius); cx++) {
        if (this.cell(cx, cy) === 1 && this.touchesCell({ x, y }, cx, cy, radius)) return true;
      }
    }
    return false;
  }
  moveBeetles(dt) {
    for (const b of this.beetles) {
      b.turnIn -= dt;
      if (b.turnIn <= 0) {
        const angle = (this.random() - .5) * .65;
        const cos = Math.cos(angle), sin = Math.sin(angle), vx = b.vx;
        b.vx = vx * cos - b.vy * sin; b.vy = vx * sin + b.vy * cos;
        b.turnIn = 1.3 + this.random() * 2.7;
      }
      let nx = b.x + b.vx * dt;
      if (this.blocked(nx, b.y)) { b.vx *= -1; nx = b.x + b.vx * dt; }
      if (!this.blocked(nx, b.y)) b.x = nx;
      let ny = b.y + b.vy * dt;
      if (this.blocked(b.x, ny)) { b.vy *= -1; ny = b.y + b.vy * dt; }
      if (!this.blocked(b.x, ny)) b.y = ny;
      if (this.trail.length) {
        for (let y = Math.floor(b.y - .42); y <= Math.floor(b.y + .42); y++) {
          for (let x = Math.floor(b.x - .42); x <= Math.floor(b.x + .42); x++) {
            if (this.cell(x, y) === 2 && this.touchesCell(b, x, y)) { this.loseLife('A beetle caught your trail.'); return; }
          }
        }
      }
    }
  }
  capture() {
    for (const i of this.trail) this.grid[i] = 1;
    // Preserve all regions containing beetles, including disconnected regions.
    const reachable = new Uint8Array(this.grid.length), queue = new Int32Array(this.grid.length);
    let head = 0, tail = 0;
    for (const b of this.beetles) {
      const i = this.index(Math.floor(b.x), Math.floor(b.y));
      if (!reachable[i] && this.grid[i] === 0) { reachable[i] = 1; queue[tail++] = i; }
    }
    while (head < tail) {
      const i = queue[head++], x = i % this.cols, y = Math.floor(i / this.cols);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const j = this.index(nx, ny);
        if (!reachable[j] && this.grid[j] === 0) { reachable[j] = 1; queue[tail++] = j; }
      }
    }
    let filled = 0;
    for (let y = 1; y < this.rows - 1; y++) for (let x = 1; x < this.cols - 1; x++) {
      const i = this.index(x, y);
      if (this.grid[i] === 0 && !reachable[i]) this.grid[i] = 1;
      if (this.grid[i] === 1) filled++;
    }
    const before = this.progress;
    this.progress = filled / ((this.cols - 2) * (this.rows - 2));
    this.trail = []; this.direction = null; this.revision++;
    if (this.progress >= .8) { this.state = 'won'; this.emit('win'); }
    else this.emit('capture', { gained: this.progress - before });
  }
  loseLife(reason) {
    if (this.state !== 'playing') return;
    for (const i of this.trail) this.grid[i] = 0;
    this.trail = []; this.player = { ...this.lastSafe }; this.direction = null;
    this.lives--; this.revision++; this.tick = 0;
    this.state = this.lives > 0 ? 'hit' : 'over'; this.emit('hit', { reason });
  }
}
