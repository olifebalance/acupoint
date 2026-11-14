// Threads village — streets of small shops drawn in pen, one shop per resident.
// Drag the sun or moon to change the time for the whole village; move the pointer
// to make wind; tap a shop to read its owner's introduction and visit their Threads.
import { el, pen, shape, f, inkDefs } from './lib/ink.ts';
import { palette, applyPalette, rgb, type Palette } from './lib/daynight.ts';
import { pointerWind, smooth, lerp } from './lib/motion.ts';
import { H, BASE, LANE, KERB, SP, SHOP_W, GAP, MARGIN, sceneWidth, shopX, rnd, srnd, wl, box } from './kit.ts';
import { createSky } from './sky.ts';
import { buildShop, buildVacant, lightWindows, type Lit } from './shops.ts';
import { createWalker, type Walker } from './people.ts';
import { createCat, createSparrows } from './critters.ts';
import { STREETS, type Lot, type Street } from './village.ts';

const q = new URLSearchParams(location.search);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

// one clock for the whole village
const time = { tau: q.has('tau') ? +q.get('tau')! : 0.66, scrub: null as number | null, frozen: q.has('tau') };
const DAY_SECONDS = q.has('day') ? +q.get('day')! : 180;
const hintN = document.querySelector('#hint')!;
const hint = { shown: true, done() { if (this.shown) { this.shown = false; hintN.classList.add('gone'); } } };
setTimeout(() => hint.done(), 16000);

// ------------------------------------------------------------------ the resident card
const dialog = document.querySelector<HTMLDialogElement>('#card-dialog')!;
const $d = (s: string) => dialog.querySelector<HTMLElement>(s)!;
function openCard(lot: Lot, street: Street) {
  const [, n] = (lot.no ?? '-').split('-');
  $d('#c-addr').textContent = `스레드 마을 ${street.name} ${n}호`;
  const go = $d('#c-go') as HTMLAnchorElement;
  if (lot.vacant) {
    $d('#c-name').textContent = '빈 자리';
    $d('#c-handle').textContent = '';
    $d('#c-intro').textContent = '이 자리는 아직 비어 있어요.\n입점은 미모에게 물어보세요.';
    go.hidden = true;
  } else {
    $d('#c-name').textContent = lot.name ?? '';
    $d('#c-handle').textContent = lot.handle ?? '';
    $d('#c-intro').textContent = lot.intro ?? '';
    go.hidden = !lot.link;
    if (lot.link) { go.href = lot.link; go.textContent = lot.linkLabel ?? '스레드 보러 가기'; }
  }
  dialog.style.setProperty('--c', lot.color ?? '#8a8478');
  dialog.showModal();
  hint.done();
}
$d('#c-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

// ------------------------------------------------------------------ one street
function createStreet(street: Street, si: number, mount: HTMLElement) {
  const lots = street.lots, N = lots.length, W = sceneWidth(N);
  const card = document.createElement('section');
  card.className = 'card';
  card.style.setProperty('--ratio', String(W / H));
  card.innerHTML = `<div class="street"></div><p class="plate">${street.name}</p>${si === 0 ? '<div class="hud" id="clock"></div>' : ''}`;
  mount.appendChild(card);
  const stage = card.querySelector<HTMLElement>('.street')!;
  const filled = lots.filter((l) => !l.vacant).length;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `펜으로 그린 스레드 마을 ${street.name}. 가게 ${filled}곳과 빈 자리 ${N - filled}곳.` });
  const ink = inkDefs(svg, `s${si}`);
  stage.appendChild(svg);
  if (si === 0) {
    const warm = el('radialGradient', { id: 's-warmglow' }, ink.defs);
    el('stop', { offset: 0, 'stop-color': '#ffcf86', 'stop-opacity': 0.75 }, warm);
    el('stop', { offset: 1, 'stop-color': '#ffcf86', 'stop-opacity': 0 }, warm);
    const cone = el('linearGradient', { id: 's-cone', x1: 0, y1: 0, x2: 0, y2: 1 }, ink.defs);
    el('stop', { offset: 0, 'stop-color': '#fff1c2', 'stop-opacity': 0.5 }, cone);
    el('stop', { offset: 1, 'stop-color': '#fff1c2', 'stop-opacity': 0 }, cone);
  }
  const layer = (parent: Element = svg, attrs: Record<string, string> = {}) => el('g', attrs, parent);
  const skyL = layer();
  const scene = layer(svg, { filter: ink.filter });
  const back = layer(scene), houses = layer(scene), ground = layer(scene), front = layer(scene), wires = layer(scene), birdsL = layer(scene), catL = layer(scene), walkers = layer(scene);
  const glow = layer(svg, { style: 'mix-blend-mode:screen;pointer-events:none' });
  const hits = layer(svg);

  const sky = createSky(svg, skyL, ink.defs, W, (v) => { time.scrub = v; if (v !== null) { time.tau = v; time.frozen = false; hint.done(); kick(); } });

  // pavement, kerb, road
  pen(ground, SP).setAttribute('d', `${wl(-10, KERB, W + 10, KERB, 0.3)} ${wl(-10, KERB + 5, W + 10, KERB + 5, 0.3)}`);
  let tiles = '';
  for (let x = 8; x < W; x += 26) tiles += `M${f(x)} ${f(BASE + 4)} L${f(x - 3)} ${f(KERB)} `;
  pen(ground, SP * 0.4).setAttribute('d', tiles + wl(-10, BASE + 22, W + 10, BASE + 22, 0.3));
  let dash = '';
  for (let x = 10; x < W; x += 60) dash += `M${f(x)} 446 L${f(x + 28)} 446 `;
  pen(ground, SP * 0.9).setAttribute('d', dash);

  // shops and empty lots
  const shops = lots.map((lot, i) => (lot.vacant ? buildVacant : buildShop)(lot, shopX(i), { back, houses, front, glow, hits }, () => openCard(lot, street)));
  for (let i = 0; i < N - 1; i++) {
    if (lots[i].vacant || lots[i + 1].vacant) continue;
    const ax = shopX(i) + SHOP_W + GAP / 2;
    pen(houses, SP * 0.7).setAttribute('d', `M${f(ax)} ${f(BASE - 150)} L${f(ax)} ${f(BASE - 2)} M${f(ax - 2)} ${f(BASE - 2)} L${f(ax + 3)} ${f(BASE)}`);
  }

  // poles and wires
  const poleXs = [MARGIN / 2];
  for (let i = 1; i < N - 1; i += 2) poleXs.push(shopX(i) + SHOP_W + GAP / 2);
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
  let wd = '';
  for (let i = 0; i < poleXs.length - 1; i++) {
    const a = poleXs[i], b = poleXs[i + 1], m = (a + b) / 2;
    wd += `M${f(a)} ${f(POLE_TOP + 8)} Q${f(m)} ${f(POLE_TOP + 40)} ${f(b)} ${f(POLE_TOP + 8)} M${f(a)} ${f(POLE_TOP + 16)} Q${f(m)} ${f(POLE_TOP + 44)} ${f(b)} ${f(POLE_TOP + 16)} `;
  }
  pen(wires, SP * 0.6).setAttribute('d', wd);

  // a street lamp between two lots
  const lampX = shopX(Math.min(2, N - 1)) - GAP / 2;
  shape(front, SP).setAttribute('d', `M${f(lampX - 1.6)} ${f(LANE.back + 2)} L${f(lampX - 1.2)} ${f(BASE - 120)} Q${f(lampX + 2)} ${f(BASE - 134)} ${f(lampX + 18)} ${f(BASE - 132)} L${f(lampX + 18)} ${f(BASE - 129)} Q${f(lampX + 4)} ${f(BASE - 130)} ${f(lampX + 1.6)} ${f(BASE - 118)} L${f(lampX + 1.8)} ${f(LANE.back + 2)}Z`);
  const lampHead = el('path', { d: `M${f(lampX + 12)} ${f(BASE - 130)} L${f(lampX + 26)} ${f(BASE - 130)} L${f(lampX + 23)} ${f(BASE - 124)} L${f(lampX + 15)} ${f(BASE - 124)}Z`, stroke: 'currentColor', 'stroke-width': SP }, front);
  const lampCone = el('path', { d: `M${f(lampX + 15)} ${f(BASE - 124)} L${f(lampX + 23)} ${f(BASE - 124)} L${f(lampX + 52)} ${f(LANE.front + 6)} L${f(lampX - 14)} ${f(LANE.front + 6)}Z`, fill: 'url(#s-cone)', opacity: 0 }, glow);
  const lampGlow = el('circle', { cx: f(lampX + 19), cy: f(BASE - 124), r: 30, fill: 'url(#s-warmglow)', opacity: 0 }, glow);

  // a bench with a cat, in front of the last occupied shop of the first street
  let cat: ReturnType<typeof createCat> | null = null;
  if (si === 0) {
    const bi = lots.map((l, i) => (l.vacant ? -1 : i)).filter((i) => i >= 0).pop() ?? 0;
    const benchX = shopX(bi) + 30;
    shape(front, SP).setAttribute('d', box(benchX, BASE + 6, 46, 4, 0.2));
    pen(front, SP * 0.8).setAttribute('d', `M${f(benchX + 4)} ${f(BASE + 10)} L${f(benchX + 4)} ${f(BASE + 20)} M${f(benchX + 42)} ${f(BASE + 10)} L${f(benchX + 42)} ${f(BASE + 20)} M${f(benchX + 2)} ${f(BASE - 6)} L${f(benchX + 44)} ${f(BASE - 6)} M${f(benchX + 4)} ${f(BASE - 6)} L${f(benchX + 4)} ${f(BASE + 6)} M${f(benchX + 42)} ${f(BASE - 6)} L${f(benchX + 42)} ${f(BASE + 6)}`);
    cat = createCat(catL, glow, benchX + 22, BASE + 6);
  }
  const birdXs = [poleXs[0] + 40, poleXs[0] + 52, poleXs[0] + 70].map((x) => x + si * 120).filter((x) => x < poleXs[1] - 8);
  const sparrows = createSparrows(birdsL, wireAt, birdXs);

  // passers-by
  const people: Walker[] = [];
  const addPerson = (x?: number) => {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const p = createWalker(walkers, { dir, x: x ?? (dir > 0 ? -40 : W + 40), y: Math.random() < 0.5 ? LANE.back + rnd(-1, 1) : LANE.front + rnd(-1, 1), W });
    p.g.addEventListener('click', () => { p.poke(); hint.done(); });
    people.push(p);
  };
  let spawnIn = 2, started = false;

  const wind = pointerWind(svg, 0.3);
  const windows: Lit[] = shops.flatMap((s) => s.windows);
  const me = {
    card, svg, visible: true, people, sparrows, cat, shops,
    draw(t: number, dt: number, P: Palette) {
      applyPalette(svg, P);
      card.style.setProperty('--ink', rgb(P.ink));
      const wv = wind.step(t);
      sky.draw(time.tau, t, dt, P, wv);
      shops.forEach((s) => s.draw(t, dt, wv, P));
      lightWindows(windows, time.tau, P);
      const lampOn = smooth(0.2, 0.45, P.lamp);
      lampHead.setAttribute('fill', rgb(P.paper.map((v, i) => lerp(v, [255, 241, 201][i], lampOn)) as [number, number, number]));
      lampCone.setAttribute('opacity', f(lampOn * 0.7));
      lampGlow.setAttribute('opacity', f(lampOn));
      cat?.draw(t, dt, P);
      sparrows.draw(t, dt, P);
      if (!started) { started = true; [0.25, 0.6].forEach((u) => addPerson(W * u)); }
      spawnIn -= dt;
      if (spawnIn < 0) {
        const late = time.tau > 0.96 || time.tau < 0.22;
        spawnIn = rnd(5, 10) * (late ? 2.5 : 1) * (1180 / W);
        if (people.length < Math.ceil((W / 220) * (filled / N + 0.3))) addPerson();
      }
      for (let i = people.length - 1; i >= 0; i--) { const p = people[i]; p.draw(t, dt, P, wv); if (p.done) { p.remove(); people.splice(i, 1); } }
      people.slice().sort((a, b) => a.y - b.y).forEach((p) => walkers.appendChild(p.g));
    },
  };
  new IntersectionObserver(([e]) => { me.visible = e.isIntersecting; if (me.visible) wake(); }).observe(card);
  svg.addEventListener('click', kick);
  return me;
}

// ------------------------------------------------------------------ the village
const mount = document.querySelector<HTMLElement>('#village')!;
const streets = STREETS.map((s, i) => createStreet(s, i, mount));
const clock = document.querySelector('#clock')!;
const period = (h: number) => (h < 5 ? '새벽' : h < 9 ? '아침' : h < 12 ? '오전' : h < 14 ? '낮' : h < 17.5 ? '오후' : h < 20 ? '저녁' : '밤');
const total = STREETS.reduce((n, s) => n + s.lots.filter((l) => !l.vacant).length, 0);
const empty = STREETS.reduce((n, s) => n + s.lots.filter((l) => l.vacant).length, 0);
document.querySelector('#count')!.textContent = `입점 ${total}곳 · 빈 자리 ${empty}곳`;

function draw(t: number, dt: number, all = false) {
  if (time.scrub === null && !time.frozen) time.tau = (time.tau + dt / DAY_SECONDS) % 1;
  const P = palette(time.tau);
  streets.forEach((s) => { if (all || s.visible) s.draw(t, dt, P); });
  const hrs = time.tau * 24, h = Math.floor(hrs), m = Math.floor((hrs - h) * 60);
  clock.innerHTML = `<b>${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}</b> <span>${period(hrs)}</span>`;
}

// One loop for every street; it sleeps when no street is on screen. With reduced
// motion nothing moves on its own, but dragging the sun still redraws the village.
let t = 0, prev = 0, raf = 0;
const tick = (now: number) => {
  const dt = Math.min(0.05, (now - prev) / 1000 || 0); prev = now;
  t += dt; draw(t, dt);
  raf = !RM && streets.some((s) => s.visible) ? requestAnimationFrame(tick) : 0;
};
function wake() { if (!raf && !RM && !q.has('debug')) { prev = performance.now(); raf = requestAnimationFrame(tick); } }
function kick() { if (RM) requestAnimationFrame(() => draw(t, 0, true)); }
if (q.has('debug')) {
  draw(0, 1 / 60, true);
  (window as any).__step = (s = 1) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) draw((t += 1 / 60), 1 / 60, true); return t; };
} else if (RM) kick(); else wake();
(window as any).__village = { streets, time };
