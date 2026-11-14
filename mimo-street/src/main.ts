// MIMO street — a row of small shops drawn in pen, one shop per work.
// Drag the sun or moon to change the time; move the pointer to make wind;
// tap a shop to play its work; tap people, the cat or the sparrows.
import { el, pen, shape, f, inkDefs } from './lib/ink.ts';
import { palette, applyPalette, rgb } from './lib/daynight.ts';
import { pointerWind, smooth, lerp } from './lib/motion.ts';
import { H, BASE, LANE, KERB, SP, SHOP_W, GAP, MARGIN, sceneWidth, shopX, rnd, srnd, wl, box } from './kit.ts';
import { createSky } from './sky.ts';
import { buildShop, lightWindows, type Shop, type Lit } from './shops.ts';
import { createWalker, type Walker } from './people.ts';
import { createCat, createSparrows } from './critters.ts';
import { WORKS } from './works.ts';

const q = new URLSearchParams(location.search);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = WORKS.length, W = sceneWidth(N);

const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `펜으로 그린 작은 상점가. 가게 ${N}곳이 미모의 작품 ${N}편이고, 해를 끌면 낮과 밤이 바뀝니다.` });
const ink = inkDefs(svg, 's');
const card = document.querySelector<HTMLElement>('#card')!;
const stage = document.querySelector<HTMLElement>('#street')!;
stage.appendChild(svg);
card.style.setProperty('--ratio', String(W / H));
const warm = el('radialGradient', { id: 's-warmglow' }, ink.defs);
el('stop', { offset: 0, 'stop-color': '#ffcf86', 'stop-opacity': 0.75 }, warm);
el('stop', { offset: 1, 'stop-color': '#ffcf86', 'stop-opacity': 0 }, warm);
const cone = el('linearGradient', { id: 's-cone', x1: 0, y1: 0, x2: 0, y2: 1 }, ink.defs);
el('stop', { offset: 0, 'stop-color': '#fff1c2', 'stop-opacity': 0.5 }, cone);
el('stop', { offset: 1, 'stop-color': '#fff1c2', 'stop-opacity': 0 }, cone);

const layer = (parent: Element = svg, attrs: Record<string, string> = {}) => el('g', attrs, parent);
const skyL = layer();
const scene = layer(svg, { filter: ink.filter });
const back = layer(scene), houses = layer(scene), street = layer(scene), front = layer(scene), wires = layer(scene), birdsL = layer(scene), catL = layer(scene), walkers = layer(scene);
const glow = layer(svg, { style: 'mix-blend-mode:screen;pointer-events:none' });
const hits = layer(svg);

// ------------------------------------------------------------------ time
let tau = q.has('tau') ? +q.get('tau')! : 0.66, scrub: number | null = null;
const frozen = q.has('tau');
const DAY_SECONDS = q.has('day') ? +q.get('day')! : 180;
const sky = createSky(svg, skyL, ink.defs, W, (v) => { scrub = v; if (v !== null) { tau = v; hint.done(); kick(); } });

// ------------------------------------------------------------------ the street: pavement, kerb, road
pen(street, SP).setAttribute('d', `${wl(-10, KERB, W + 10, KERB, 0.3)} ${wl(-10, KERB + 5, W + 10, KERB + 5, 0.3)}`);
let tiles = '';
for (let x = 8; x < W; x += 26) tiles += `M${f(x)} ${f(BASE + 4)} L${f(x - 3)} ${f(KERB)} `;
tiles += wl(-10, BASE + 22, W + 10, BASE + 22, 0.3);
pen(street, SP * 0.4).setAttribute('d', tiles);
let dash = '';
for (let x = 10; x < W; x += 60) dash += `M${f(x)} 446 L${f(x + 28)} 446 `;
pen(street, SP * 0.9).setAttribute('d', dash);
pen(street, SP * 0.35).setAttribute('d', Array.from({ length: Math.round(W / 40) }, () => { const x = srnd(0, W), y = srnd(410, 476); return `M${f(x)} ${f(y)} l${f(srnd(4, 10))} 0`; }).join(' '));

// ------------------------------------------------------------------ shops, one per work
const shops: Shop[] = WORKS.map((w, i) => buildShop(w, shopX(i), { back, houses, front, glow, hits }, () => openPlayer(i)));
// narrow alleys between shops: a drainpipe and shadowed gap
for (let i = 0; i < N - 1; i++) {
  const ax = shopX(i) + SHOP_W;
  pen(houses, SP * 0.7).setAttribute('d', `M${f(ax + GAP / 2)} ${f(BASE - 150)} L${f(ax + GAP / 2)} ${f(BASE - 2)} M${f(ax + GAP / 2 - 2)} ${f(BASE - 2)} L${f(ax + GAP / 2 + 3)} ${f(BASE)}`);
}

// ------------------------------------------------------------------ poles, wires, a street lamp
const poleXs = [MARGIN / 2];
for (let i = 1; i < N; i += 2) poleXs.push(shopX(i) + SHOP_W + GAP / 2);
poleXs.push(W - MARGIN / 2);
const POLE_TOP = 128;
poleXs.forEach((px) => {
  shape(front, SP).setAttribute('d', `M${f(px - 3)} ${f(LANE.back + 4)} L${f(px - 2)} ${f(POLE_TOP)} L${f(px + 2)} ${f(POLE_TOP)} L${f(px + 3)} ${f(LANE.back + 4)}Z`);
  pen(front, SP * 0.8).setAttribute('d', `M${f(px - 12)} ${f(POLE_TOP + 8)} L${f(px + 12)} ${f(POLE_TOP + 8)} M${f(px - 9)} ${f(POLE_TOP + 16)} L${f(px + 9)} ${f(POLE_TOP + 16)}`);
});
const wireAt = (x: number): number => {
  for (let i = 0; i < poleXs.length - 1; i++) {
    const a = poleXs[i], b = poleXs[i + 1];
    if (x >= a && x <= b) { const u = (x - a) / (b - a); return POLE_TOP + 8 + 16 * 4 * u * (1 - u); }
  }
  return POLE_TOP + 8;
};
let wd = '', wd2 = '';
for (let i = 0; i < poleXs.length - 1; i++) {
  const a = poleXs[i], b = poleXs[i + 1], m = (a + b) / 2;
  wd += `M${f(a)} ${f(POLE_TOP + 8)} Q${f(m)} ${f(POLE_TOP + 8 + 32)} ${f(b)} ${f(POLE_TOP + 8)} `;
  wd2 += `M${f(a)} ${f(POLE_TOP + 16)} Q${f(m)} ${f(POLE_TOP + 16 + 28)} ${f(b)} ${f(POLE_TOP + 16)} `;
}
pen(wires, SP * 0.6).setAttribute('d', wd + wd2);

const lampX = N > 2 ? shopX(2) - GAP / 2 : W - MARGIN / 2 - 30;
shape(front, SP).setAttribute('d', `M${f(lampX - 1.6)} ${f(LANE.back + 2)} L${f(lampX - 1.2)} ${f(BASE - 120)} Q${f(lampX + 2)} ${f(BASE - 134)} ${f(lampX + 18)} ${f(BASE - 132)} L${f(lampX + 18)} ${f(BASE - 129)} Q${f(lampX + 4)} ${f(BASE - 130)} ${f(lampX + 1.6)} ${f(BASE - 118)} L${f(lampX + 1.8)} ${f(LANE.back + 2)}Z`);
const lampHead = el('path', { d: `M${f(lampX + 12)} ${f(BASE - 130)} L${f(lampX + 26)} ${f(BASE - 130)} L${f(lampX + 23)} ${f(BASE - 124)} L${f(lampX + 15)} ${f(BASE - 124)}Z`, stroke: 'currentColor', 'stroke-width': SP }, front);
const lampCone = el('path', { d: `M${f(lampX + 15)} ${f(BASE - 124)} L${f(lampX + 23)} ${f(BASE - 124)} L${f(lampX + 52)} ${f(LANE.front + 6)} L${f(lampX - 14)} ${f(LANE.front + 6)}Z`, fill: 'url(#s-cone)', opacity: 0 }, glow);
const lampGlow = el('circle', { cx: f(lampX + 19), cy: f(BASE - 124), r: 30, fill: 'url(#s-warmglow)', opacity: 0 }, glow);

// a bench against a shop wall, with a cat on it
const benchX = shopX(Math.min(3, N - 1)) + 30;
shape(front, SP).setAttribute('d', box(benchX, BASE + 6, 46, 4, 0.2));
pen(front, SP * 0.8).setAttribute('d', `M${f(benchX + 4)} ${f(BASE + 10)} L${f(benchX + 4)} ${f(BASE + 20)} M${f(benchX + 42)} ${f(BASE + 10)} L${f(benchX + 42)} ${f(BASE + 20)} M${f(benchX + 2)} ${f(BASE - 6)} L${f(benchX + 44)} ${f(BASE - 6)} M${f(benchX + 4)} ${f(BASE - 6)} L${f(benchX + 4)} ${f(BASE + 6)} M${f(benchX + 42)} ${f(BASE - 6)} L${f(benchX + 42)} ${f(BASE + 6)}`);
const cat = createCat(catL, glow, benchX + 22, BASE + 6);
const birdXs = [poleXs[0] + 40, poleXs[0] + 52, poleXs[0] + 70, poleXs[1] - 30].filter((x) => x < poleXs[1] - 8);
const sparrows = createSparrows(birdsL, wireAt, birdXs);

// ------------------------------------------------------------------ passers-by
const people: Walker[] = [];
function addPerson(x?: number) {
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const p = createWalker(walkers, { dir, x: x ?? (dir > 0 ? -40 : W + 40), y: Math.random() < 0.5 ? LANE.back + rnd(-1, 1) : LANE.front + rnd(-1, 1), W });
  p.g.addEventListener('click', () => { p.poke(); hint.done(); });
  people.push(p);
}
let spawnIn = 2;

// ------------------------------------------------------------------ hud, hint, player
const clock = document.querySelector('#clock')!;
const hintN = document.querySelector('#hint')!;
const hint = { shown: true, done() { if (this.shown) { this.shown = false; hintN.classList.add('gone'); } } };
setTimeout(() => hint.done(), 16000);
const period = (h: number) => (h < 5 ? '새벽' : h < 9 ? '아침' : h < 12 ? '오전' : h < 14 ? '낮' : h < 17.5 ? '오후' : h < 20 ? '저녁' : '밤');

const dialog = document.querySelector<HTMLDialogElement>('#player')!;
const video = dialog.querySelector('video')!;
function openPlayer(i: number) {
  const w = WORKS[i];
  dialog.querySelector('#p-title')!.textContent = w.title;
  dialog.querySelector('#p-meta')!.textContent = `${w.shop} · ${w.type}`;
  video.poster = `assets/${w.id}.webp`;
  video.src = `assets/${w.id}.mp4`;
  dialog.showModal();
  video.play().catch(() => {});
  hint.done();
}
dialog.addEventListener('close', () => { video.pause(); video.removeAttribute('src'); video.load(); });
dialog.querySelector('#p-close')!.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

// ------------------------------------------------------------------ frame
const wind = pointerWind(svg, 0.3);
const allWindows: Lit[] = shops.flatMap((s) => s.windows);
let started = false;
function draw(t: number, dt: number) {
  if (scrub === null && !frozen) tau = (tau + dt / DAY_SECONDS) % 1;
  const P = palette(tau);
  applyPalette(svg, P);
  card.style.setProperty('--ink', rgb(P.ink));
  const wv = wind.step(t);

  sky.draw(tau, t, dt, P, wv);
  let boost = 0;
  shops.forEach((s) => { const pulse = s.draw(t, dt, wv, P); boost = Math.max(boost, pulse); });
  lightWindows(allWindows, tau, P);
  const lampOn = smooth(0.2, 0.45, P.lamp);
  lampHead.setAttribute('fill', rgb(P.paper.map((v, i) => lerp(v, [255, 241, 201][i], lampOn)) as [number, number, number]));
  lampCone.setAttribute('opacity', f(lampOn * 0.7));
  lampGlow.setAttribute('opacity', f(lampOn));
  cat.draw(t, dt, P);
  sparrows.draw(t, dt, P);

  if (!started) { started = true; [0.22, 0.55, 0.8].forEach((u) => addPerson(W * u)); }
  spawnIn -= dt;
  if (spawnIn < 0) {
    const late = tau > 0.96 || tau < 0.22;
    spawnIn = rnd(4, 9) * (late ? 2.5 : 1) * (1180 / W);
    if (people.length < Math.ceil(W / 160)) addPerson();
  }
  for (let i = people.length - 1; i >= 0; i--) { const p = people[i]; p.draw(t, dt, P, wv); if (p.done) { p.remove(); people.splice(i, 1); } }
  people.slice().sort((a, b) => a.y - b.y).forEach((p) => walkers.appendChild(p.g));

  const hrs = tau * 24, h = Math.floor(hrs), m = Math.floor((hrs - h) * 60);
  clock.innerHTML = `<b>${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}</b> <span>${period(hrs)}</span>`;
}

// Own loop: runs only while the street is on screen. With reduced motion nothing
// moves on its own, but dragging the sun still redraws the scene.
let t = 0, prev = 0, raf = 0, visible = true;
const tick = (now: number) => {
  const dt = Math.min(0.05, (now - prev) / 1000 || 0); prev = now;
  t += dt; draw(t, RM ? 0 : dt);
  raf = visible && !RM ? requestAnimationFrame(tick) : 0;
};
function kick() { if (RM) requestAnimationFrame((now) => { prev = now; draw(t, 0); }); }
if (q.has('debug')) {
  draw(0, 1 / 60);
  (window as any).__step = (s = 1) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) draw((t += 1 / 60), 1 / 60); return t; };
} else {
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(tick); }
  }).observe(card);
  if (RM) kick();
  svg.addEventListener('click', kick);
}
(window as any).__street = { shops, people, cat, sparrows, setTau: (v: number) => { tau = v; }, get tau() { return tau; }, addPerson };

// start the scroll on the first shop on narrow screens
requestAnimationFrame(() => { if (stage.scrollWidth > stage.clientWidth) stage.scrollLeft = 0; });
