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
  assert.ok(!html.includes('offline.js') && !html.includes('offline-status'));
});

test('web cache serves the complete game offline and reports failed downloads honestly', async () => {
  const handlers = {}, stores = new Map();
  let online = true, networkCalls = 0, claimed = false, failPath = null;
  const origin = 'https://game.test';
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).pathname;
  const network = async request => {
    networkCalls++;
    const pathname = key(request);
    if (!online || pathname === failPath) throw new Error('Network unavailable');
    return new Response(await readFile(path.join(root, 'dist', pathname.slice(1))));
  };
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(request) { return entries.get(key(request))?.clone(); },
        async addAll(requests) {
          const responses = await Promise.all(requests.map(network));
          requests.forEach((request, i) => entries.set(key(request), responses[i]));
        }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  const sandbox = {
    self: { location: { origin }, clients: { async claim() { claimed = true; } },
      addEventListener(name, handler) { handlers[name] = handler; } },
    caches, fetch: network, URL,
    Request: class extends Request { constructor(url, options) { super(new URL(url, origin), options); } }
  };
  vm.runInNewContext(await readFile(path.join(root, 'dist/sw.js'), 'utf8'), sandbox);
  async function lifecycle(name) { let task; handlers[name]({ waitUntil(promise) { task = promise; } }); await task; }
  async function offlineStatus() {
    let result, task;
    handlers.message({ data: { type: 'PREPARE_OFFLINE' },
      ports: [{ postMessage(value) { result = value.ready; } }], waitUntil(promise) { task = promise; } });
    await task; return result;
  }
  // A failed asset must reject installation, not mark a partial game ready.
  failPath = '/assets/beetle.png';
  await assert.rejects(lifecycle('install'));
  assert.equal(await offlineStatus(), false);
  failPath = null;
  await lifecycle('install');
  stores.set('beetle-swarm-offline-old', new Map());
  stores.set('unrelated-cache', new Map());
  await lifecycle('activate');
  assert.equal(claimed, true);
  assert.equal(stores.has('beetle-swarm-offline-old'), false);
  assert.equal(stores.has('unrelated-cache'), true);

  online = false;
  const callsBefore = networkCalls;
  async function cached(pathname) {
    let response;
    handlers.fetch({ request: { url: origin + pathname, method: 'GET' }, respondWith(promise) { response = promise; } });
    assert.ok(response, `worker handles ${pathname}`);
    return (await response).text();
  }
  const html = await cached('/?from=homescreen');
  assert.match(html, /Beetle Swarm/);
  const required = new Set([...html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)].map(match => match[1]));
  const css = await cached('/style.css'), game = await cached('/game.mjs');
  for (const match of css.matchAll(/url\(['"]?(\/[^)'"?#]+)/g)) required.add(match[1]);
  for (const match of game.matchAll(/\.src = '(\/[^']+)'/g)) required.add(match[1]);
  for (const match of game.matchAll(/from '\.\/([^']+)'/g)) required.add('/' + match[1]);
  for (const resource of required) await cached(resource);
  assert.equal(await offlineStatus(), true);
  assert.equal(networkCalls, callsBefore, 'offline boot needs no network requests');
  // Cache eviction is recoverable online and is not reported as offline-ready.
  const gameCache = [...stores.entries()].find(([name]) => name.startsWith('beetle-swarm-offline-'))[1];
  gameCache.delete('/assets/chart.png');
  assert.equal(await offlineStatus(), false);
  online = true;
  assert.equal(await offlineStatus(), true);
});

test('bundled game supports pause, same-chapter retries and an explicit new voyage', async () => {
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

  element('action').click();
  sandbox.simulation.setLevel(12);
  for (let life = 2; life >= 0; life--) {
    sandbox.simulation.loseLife('A beetle caught your trail.');
    assert.equal(element('overlay').hidden, false);
    assert.equal(element('action').textContent, life ? 'Continue Chapter 12' : 'Retry Chapter 12');
    element('action').click();
    assert.equal(sandbox.simulation.level, 12);
    assert.equal(sandbox.simulation.state, 'playing');
    assert.equal(sandbox.simulation.lives, life || 3);
    assert.equal(sandbox.simulation.beetles.length, 12);
    assert.equal(element('overlay').hidden, true);
    assert.equal(element('level').textContent, '12');
  }
  for (let life = 2; life >= 0; life--) {
    sandbox.simulation.loseLife('A beetle caught your trail.');
    if (life) element('action').click();
  }
  assert.equal(element('restart').hidden, false);
  element('restart').click();
  assert.equal(sandbox.simulation.level, 12); assert.equal(sandbox.simulation.state, 'over');
  element('restart').click();
  assert.equal(sandbox.simulation.level, 1); assert.equal(sandbox.simulation.lives, 3);
  assert.equal(sandbox.simulation.state, 'playing'); assert.equal(element('overlay').hidden, true);
});

test('store text meets Apple field character limits', async () => {
  const listing = JSON.parse(await readFile(path.join(root, 'app-store/listing.json'), 'utf8'));
  for (const [field, limit] of Object.entries({ name: 30, subtitle: 30, keywords: 100, promotional_text: 170, description: 4000 })) {
    assert.ok(listing[field].length <= limit, `${field} exceeds ${limit}`);
  }
});
