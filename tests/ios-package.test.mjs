import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = path.join(root, 'ios/BeetleSwarm/Web');

test('offline package references existing local resources without modules or remote assets', async () => {
  const html = await readFile(path.join(web, 'index.html'), 'utf8');
  const css = await readFile(path.join(web, 'style.css'), 'utf8');
  const script = await readFile(path.join(web, 'game.js'), 'utf8');
  assert.ok(!/(?:src|href)="\/|type="module"/.test(html));
  assert.ok(!/^\s*(?:import |export )/m.test(script));
  assert.ok(!/(?:fetch\(|XMLHttpRequest|WebSocket|https?:\/\/)/.test(script));
  const refs = [
    ...[...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)].map(m => m[1]),
    ...[...css.matchAll(/url\(['"]?(\.\/[^)'"?#]+)['"]?\)/g)].map(m => m[1]),
    ...[...script.matchAll(/\.src = '(\.\/[^']+)'/g)].map(m => m[1])
  ];
  assert.ok(refs.length > 10);
  for (const ref of refs) await access(path.resolve(web, ref));
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /id="legal-open"/);
  assert.match(html, /id="legal-dialog"/);
});

test('bundled game boots, starts, pauses through the native bridge and resumes explicitly', async () => {
  const source = await readFile(path.join(web, 'game.js'), 'utf8');
  const elements = new Map();
  const context2d = new Proxy({}, { get: (o, k) => o[k] ?? (() => {}), set: (o, k, v) => { o[k] = v; return true; } });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, hidden: false, disabled: false, dataset: {}, style: {}, listeners: {},
      classList: { remove() {}, add() {} },
      getContext: () => context2d, setAttribute() {}, focus() {},
      addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); },
      click() { for (const fn of this.listeners.click ?? []) fn({}); },
      showModal() { this.open = true; }, close() { this.open = false; }
    });
    return elements.get(id);
  }
  const frames = [];
  const sandbox = {
    document: { getElementById: element, createElement: () => element(Symbol()),
      querySelector: element, addEventListener() {}, hidden: false, fullscreenEnabled: false },
    window: { addEventListener() {} },
    Image: class { constructor() { this.complete = true; this.naturalWidth = 1254; this.naturalHeight = 1254; }
      set src(value) { this.url = value; this.onload?.(); } },
    ResizeObserver: class { observe() {} },
    matchMedia: () => ({ matches: false }), performance: { now: () => 1000 },
    requestAnimationFrame: callback => { frames.push(callback); }, location: { reload() {} }
  };
  // Access simulation state only in this test harness, without shipping debug hooks.
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.simulation = game;\n})();'), sandbox);
  assert.equal(element('action').disabled, false);
  assert.equal(element('action').textContent, 'Set Sail');
  element('action').click();
  assert.equal(sandbox.simulation.state, 'playing');
  assert.equal(element('overlay').hidden, true);
  sandbox.window.beetleNative.pause();
  assert.equal(sandbox.simulation.state, 'paused');
  assert.equal(element('overlay').hidden, false);
  const before = JSON.stringify(sandbox.simulation.beetles);
  sandbox.simulation.step(0.1);
  assert.equal(JSON.stringify(sandbox.simulation.beetles), before);
  element('action').click();
  assert.equal(sandbox.simulation.state, 'playing');
  element('legal-open').click();
  assert.equal(sandbox.simulation.state, 'paused');
  assert.equal(element('legal-dialog').open, true);
  element('legal-close').click();
  assert.equal(element('legal-dialog').open, false);
  assert.equal(sandbox.simulation.state, 'paused');
});

test('store text meets Apple field character limits', async () => {
  const listing = JSON.parse(await readFile(path.join(root, 'app-store/listing.json'), 'utf8'));
  for (const [field, limit] of Object.entries({ name: 30, subtitle: 30, keywords: 100, promotional_text: 170, description: 4000 })) {
    assert.ok(listing[field].length <= limit, `${field} exceeds ${limit}`);
  }
});
