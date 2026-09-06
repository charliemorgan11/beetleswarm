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
test('paused games freeze; moving beyond a safe border stops; three hits ends a run', () => {
  const game = setup(); game.steer('up'); game.movePlayer(); assert.equal(game.direction, null);
  const before = JSON.stringify(game.beetles); game.pause(); game.step(.1);
  assert.equal(JSON.stringify(game.beetles), before); game.resume();
  for (let i = 0; i < 3; i++) { game.loseLife('Test collision'); if (i < 2) game.resume(); }
  assert.equal(game.state, 'over'); assert.equal(game.lives, 0);
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
