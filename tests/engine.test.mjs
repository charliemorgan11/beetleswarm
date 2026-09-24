import test from 'node:test';
import assert from 'node:assert/strict';
import { SwarmGame } from '../dist/engine.mjs';

function setup() {
  const game = new SwarmGame({ cols: 12, rows: 16, random: () => .25 });
  game.start();
  game.beetles = [{ x: 9.5, y: 9.5, vx: 0, vy: 0, turnIn: 999 }];
  return game;
}
function cut(game, x) {
  game.player = { x, y: 0 }; game.lastSafe = { ...game.player }; game.steer('down');
  for (let i = 0; i < 15 && game.state === 'playing'; i++) game.movePlayer();
}

test('starts with one beetle, three lives and zero claimed interior', () => {
  const game = setup();
  assert.equal(game.beetles.length, 1); assert.equal(game.lives, 3); assert.equal(game.progress, 0);
  assert.equal(game.cell(0, 9), 1); assert.equal(game.cell(4, 9), 0);
});
test('a closed trail claims the beetle-free side and keeps the occupied side', () => {
  const game = setup(); cut(game, 5);
  assert.equal(game.progress, .5); assert.equal(game.cell(2, 6), 1); assert.equal(game.cell(8, 6), 0);
  assert.equal(game.trail.length, 0); assert.equal(game.direction, null);
});
test('beetles in both components preserve both sides, only the trail is claimed', () => {
  const game = setup(); game.beetles.push({ x: 2.5, y: 7.5, vx: 0, vy: 0, turnIn: 999 }); cut(game, 5);
  assert.equal(game.progress, .1); assert.equal(game.cell(2, 6), 0); assert.equal(game.cell(8, 6), 0);
});
test('80% completes the level and the next level adds exactly one beetle', () => {
  const game = setup(); cut(game, 8);
  assert.equal(game.progress, .8); assert.equal(game.state, 'won');
  game.nextLevel(); assert.equal(game.level, 2); assert.equal(game.beetles.length, 2);
  assert.equal(game.state, 'playing'); assert.equal(game.progress, 0); assert.equal(game.lives, 3);
});
test('beetle contact removes the unfinished trail and preserves safe land', () => {
  const game = setup(); cut(game, 5); game.player = { x: 5, y: 5 }; game.lastSafe = { ...game.player };
  game.steer('right'); game.movePlayer();
  game.beetles[0].x = 6.5; game.beetles[0].y = 5.5;
  game.step(.02);
  assert.equal(game.state, 'hit'); assert.equal(game.lives, 2); assert.equal(game.cell(6, 5), 0);
  assert.equal(game.cell(3, 5), 1); assert.deepEqual(game.player, { x: 5, y: 5 });
  assert.equal(game.progress, .5); assert.equal(game.trail.length, 0);
});
test('touching a beetle while laying new trail costs one life immediately', () => {
  const game = setup(); game.beetles[0].x = 6.5; game.beetles[0].y = 1.5;
  game.steer('down'); game.movePlayer(); assert.equal(game.state, 'hit'); assert.equal(game.lives, 2);
});
test('crossing an unfinished trail loses a life, direct reversal is ignored', () => {
  const game = setup(); game.steer('down'); game.movePlayer(); game.movePlayer();
  game.steer('up'); assert.equal(game.direction, 'down');
  game.steer('right'); game.movePlayer(); game.steer('up'); game.movePlayer();
  game.steer('left'); game.movePlayer(); assert.equal(game.state, 'hit'); assert.equal(game.lives, 2);
});
test('paused games freeze; exhausted lives can retry the same chapter or explicitly start over', () => {
  const game = setup(); game.steer('up'); game.movePlayer(); assert.equal(game.direction, null);
  const before = JSON.stringify(game.beetles); game.pause(); game.step(.1);
  assert.equal(JSON.stringify(game.beetles), before); game.resume();
  game.setLevel(12);
  for (const beetle of game.beetles) Object.assign(beetle, { x: 9.5, y: 9.5, vx: 0, vy: 0, turnIn: 999 });
  cut(game, 5);
  assert.equal(game.progress, .5);
  for (let i = 0; i < 3; i++) {
    game.loseLife('Test collision');
    assert.equal(game.level, 12); assert.equal(game.progress, .5);
    if (i < 2) {
      game.retryLevel(); assert.equal(game.lives, 2 - i); assert.equal(game.state, 'hit');
      game.resume(); assert.equal(game.level, 12);
    }
  }
  assert.equal(game.state, 'over'); assert.equal(game.lives, 0);
  game.retryLevel();
  assert.equal(game.state, 'playing'); assert.equal(game.level, 12);
  assert.equal(game.lives, 3); assert.equal(game.beetles.length, 12);
  assert.equal(game.progress, 0); assert.equal(game.trail.length, 0);
  assert.equal(game.direction, null); assert.equal(game.tick, 0);
  assert.equal(game.cell(3, 5), 0);
  assert.deepEqual(game.player, { x: 6, y: 0 });
  assert.deepEqual(game.lastSafe, game.player);
  game.steer('down'); game.step(.07); assert.equal(game.player.y, 1);
  game.start(); assert.equal(game.lives, 3); assert.equal(game.level, 1);
});
test('continuous beetle movement respects claimed territory over many steps', () => {
  const game = setup(); cut(game, 5);
  Object.assign(game.beetles[0], { vx: 4.7, vy: -3.8, turnIn: 100 });
  for (let i = 0; i < 3600; i++) {
    game.step(1 / 60);
    const b = game.beetles[0]; assert.equal(game.cell(Math.floor(b.x), Math.floor(b.y)), 0);
    assert.ok(!game.blocked(b.x, b.y));
  }
});

test('every chapter keeps the original Chapter 1 speed range and adds only beetle count', () => {
  for (const sample of [0, .25, .5, .999999]) {
    const game = new SwarmGame({ random: () => sample });
    const expected = (4.2 + sample * 1.2) * (8 / 9);
    for (const level of [1, 2, 12, 17, 25, 26, 50, 100]) {
      game.setLevel(level);
      assert.equal(game.beetles.length, level);
      for (const beetle of game.beetles) {
        assert.ok(Math.abs(Math.hypot(beetle.vx, beetle.vy) - expected) < 1e-12,
          `Chapter ${level} must use Chapter 1 speeds`);
      }
    }
  }
});
test('beetles do not accelerate when turning or bouncing during Chapter 25', () => {
  const game = new SwarmGame({ random: () => .25 });
  game.start(25);
  const speeds = game.beetles.map(b => Math.hypot(b.vx, b.vy));
  for (const beetle of game.beetles) beetle.turnIn = 0;
  for (let frame = 0; frame < 1200; frame++) game.step(1 / 60);
  game.beetles.forEach((beetle, i) => {
    assert.ok(Math.abs(Math.hypot(beetle.vx, beetle.vy) - speeds[i]) < 1e-10);
  });
});
test('head start opens Chapter 25 with 25 beetles, three lives and a fresh map', () => {
  const events = [];
  const game = new SwarmGame({ random: () => .25, onEvent: event => events.push(event.type) });
  game.start(25);
  assert.equal(game.state, 'playing'); assert.equal(game.level, 25);
  assert.equal(game.beetles.length, 25); assert.equal(game.lives, 3);
  assert.equal(game.progress, 0); assert.equal(game.trail.length, 0);
  assert.equal(game.direction, null); assert.equal(game.tick, 0);
  assert.deepEqual(game.player, game.lastSafe); assert.equal(game.player.y, 0);
  assert.deepEqual(events, ['start']);
  game.start();
  assert.equal(game.level, 1); assert.equal(game.beetles.length, 1); assert.equal(game.lives, 3);
});
test('head start retains Chapter 25 after life loss and after all lives are exhausted', () => {
  const game = new SwarmGame({ random: () => .25 });
  game.start(25);
  for (let i = 0; i < 3; i++) {
    game.loseLife('Test collision');
    assert.equal(game.level, 25); assert.equal(game.beetles.length, 25);
    assert.equal(game.lives, 2 - i);
    if (i < 2) game.resume();
  }
  assert.equal(game.state, 'over');
  game.retryLevel();
  assert.equal(game.level, 25); assert.equal(game.lives, 3);
  assert.equal(game.beetles.length, 25); assert.equal(game.state, 'playing');
  // Complete a real 80% capture with all beetles in the remaining strip.
  for (const beetle of game.beetles) Object.assign(beetle, { x: 44.5, y: 30.5, vx: 0, vy: 0, turnIn: 999 });
  game.player = { x: 38, y: 0 }; game.lastSafe = { ...game.player }; game.steer('down');
  for (let i = 0; i < game.rows - 1 && game.state === 'playing'; i++) game.movePlayer();
  assert.ok(game.progress >= .8); assert.equal(game.state, 'won');
  game.nextLevel();
  assert.equal(game.level, 26); assert.equal(game.beetles.length, 26);
  assert.equal(game.lives, 3); assert.equal(game.state, 'playing');
  for (const beetle of game.beetles) assert.ok(Math.abs(Math.hypot(beetle.vx, beetle.vy) - 4) < 1e-12);
});
test('normal and head-start games retain the same unchanged cursor pace', () => {
  for (const level of [1, 25]) {
    const game = new SwarmGame({ random: () => .25 });
    game.start(level);
    const startX = game.player.x;
    game.steer('right');
    game.step(.1); game.step(.1); game.step(.1); game.step(.1);
    assert.equal(game.player.x - startX, 6); assert.equal(game.player.y, 0);
    assert.equal(game.lives, 3);
  }
});
test('invalid head-start values are rejected without changing the current run', () => {
  const game = new SwarmGame({ random: () => .25 });
  game.start(25);
  for (const value of [0, -1, 2, 26, 1.5, NaN, Infinity, '25', null]) {
    assert.throws(() => game.start(value), RangeError);
    assert.equal(game.level, 25); assert.equal(game.lives, 3); assert.equal(game.state, 'playing');
  }
});
