import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'dist');
const target = path.join(root, 'ios/BeetleSwarm/Web');
const engine = await readFile(path.join(source, 'engine.mjs'), 'utf8');
const game = await readFile(path.join(source, 'game.mjs'), 'utf8');
assert.equal((engine.match(/^export /gm) || []).length, 2, 'Review bundling after engine exports change');
assert.ok(game.startsWith("import { SwarmGame } from './engine.mjs';"), 'Unexpected game import');
// A classic bundle avoids file:// ES-module CORS restrictions in WKWebView.
const localPaths = text => text.replace(/(["'])\/(assets\/|style\.css|manifest\.webmanifest)/g, '$1./$2');
const script = `(() => {\n'use strict';\n${engine.replace(/^export /gm, '')}\n${localPaths(game.replace(/^import .*?;\r?\n/, '')).replace('&& !document.hidden) game.nextLevel()', '&& !document.hidden && !nativeSuspended) game.nextLevel()')}\n
let nativeSuspended = false;
window.beetleNative = Object.freeze({ pause() {
  nativeSuspended = true;
  pointer = null;
  game.pause();
  lastTime = 0;
}});
window.addEventListener('focus', () => { nativeSuspended = false; });
document.addEventListener('visibilitychange', () => { if (!document.hidden) nativeSuspended = false; });
const originalFrameStep = game.step.bind(game);
game.step = dt => { if (!nativeSuspended) originalFrameStep(dt); };
// Explicit resume from the existing pause menu also clears app suspension.
$('action').addEventListener('click', () => { nativeSuspended = false; });
$('pause').addEventListener('click', () => { nativeSuspended = false; });
$('restart').addEventListener('click', () => { nativeSuspended = false; });
const legal = $('legal-dialog');
$('legal-open').addEventListener('click', () => { game.pause(); legal.showModal(); });
$('legal-close').addEventListener('click', () => legal.close());
})();\n`;
assert.ok(!/^\s*(import |export )/m.test(script), 'Native bundle must be self-contained');
assert.ok(!/(?:fetch\(|XMLHttpRequest|WebSocket|https?:\/\/)/.test(script), 'Review network use and privacy before bundling');
let html = localPaths(await readFile(path.join(source, 'index.html'), 'utf8'));
html = html.replace('<script type="module" src="/game.mjs"></script>', '<script src="./game.js"></script>');
html = html.replace(/\s*<link rel="manifest"[^>]+>/, '');
html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'">`);
html = html.replace('</section>\n        </div>', '<button class="text-button" id="legal-open">Privacy &amp; Support</button>\n          </section>\n        </div>');
html = html.replace('  <script src="./game.js">', `  <dialog id="legal-dialog" class="legal-dialog" aria-labelledby="legal-title">
    <h2 id="legal-title">Privacy &amp; Support</h2>
    <p>Beetle Swarm runs on your iPhone. No account, adverts, tracking or analytics are included. The game does not send personal information to us. Your current voyage stays in memory and ends when the app is closed or restarted.</p>
    <p>If you email for help, we receive your email address and the information you choose to send, and use it to reply and resolve your request. Apple may process App Store and device information under its own privacy policy.</p>
    <p>Swipe up, down, left or right to steer. Return to safe land to close your trail. Claim 80% to reach the next chapter. Each chapter adds a beetle. You begin with three lives.</p>
    <p>For help or a privacy request, email <a href="mailto:charlie@cm95.co.uk?subject=Beetle%20Swarm%20support">charlie@cm95.co.uk</a>.</p>
    <p>Version 1.0 · 6 September 2026</p>
    <button class="primary-button" id="legal-close">Back to the Chart</button>
  </dialog>
  <script src="./game.js">`);
assert.ok(html.includes('id="legal-open"') && html.includes('id="legal-dialog"'));
assert.ok(!html.includes('type="module"') && !/(?:src|href)="\//.test(html));
const css = localPaths(await readFile(path.join(source, 'style.css'), 'utf8')) + `
.legal-dialog{width:calc(100% - 32px);max-width:480px;max-height:85dvh;overflow:auto;background:#ead2a0 url('./assets/chart.png') center/cover;color:#352014;border:4px double #624123;padding:24px;font-family:var(--copy);font-size:18px;line-height:1.4}
.legal-dialog::backdrop{background:#1b100be6}.legal-dialog h2{font-family:var(--display);font-size:32px;font-weight:400;margin:0 0 16px}.legal-dialog a{color:#782e1f;overflow-wrap:anywhere}.legal-dialog .primary-button{font-size:25px}
`;
await mkdir(target, { recursive: true });
await rm(path.join(target, 'assets'), { recursive: true, force: true });
await cp(path.join(source, 'assets'), path.join(target, 'assets'), { recursive: true });
await writeFile(path.join(target, 'index.html'), html);
await writeFile(path.join(target, 'style.css'), css);
await writeFile(path.join(target, 'game.js'), script);
console.log('Prepared offline iPhone game resources. Xcode compilation and device testing still required.');
