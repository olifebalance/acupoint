// One shop per work: a two-storey street elevation with a signboard, an awning,
// a shop window that shows the work's poster, and props that tell you what the
// shop sells. Windows light up one by one at dusk; signs and awnings sway in the wind.
import { el, pen, shape, blot, paint, f, PAPER } from './lib/ink.ts';
import { rgb, mix, toRGB, nightTint, type Palette } from './lib/daynight.ts';
import { pendulum, spring, smooth, lerp } from './lib/motion.ts';
import { BASE, SP, SHOP_W, srnd, wl, box, oval } from './kit.ts';
import type { Work } from './works.ts';

export interface Lit { n: SVGElement; glow: SVGElement; thr: number; lateOff: number; warmth: number; lit: number }
export interface Layers { back: Element; houses: Element; front: Element; glow: Element; hits: Element }

let clipN = 0;
const WARM_A = toRGB('#ffd58a'), WARM_B = toRGB('#f0a24e');

export function buildShop(w: Work, x0: number, L: Layers, onOpen: () => void) {
  const g = el('g', {}, L.houses);
  const W = SHOP_W, x1 = x0 + W, cx = x0 + W / 2;
  const top = BASE - srnd(178, 204);
  const windows: Lit[] = [];
  const painted: Array<{ n: SVGElement; c: string }> = [];
  const colour = (n: SVGElement, c: string) => { painted.push({ n, c }); return n; };

  // ---- building body, parapet and roof clutter
  shape(g, SP).setAttribute('d', box(x0, top, W, BASE - top));
  pen(g, SP).setAttribute('d', `${wl(x0 - 3, top, x1 + 3, top)} ${wl(x0 - 3, top + 5, x1 + 3, top + 5)} M${f(x0 - 3)} ${f(top)} L${f(x0 - 3)} ${f(top + 5)} M${f(x1 + 3)} ${f(top)} L${f(x1 + 3)} ${f(top + 5)}`);
  // facade texture: faint brick or tile courses on the upper floor
  let tex = '';
  const floorY = BASE - 98;
  for (let y = top + 16; y < floorY - 6; y += 9) tex += `M${f(x0 + 4)} ${f(y)} L${f(x0 + srnd(14, 30))} ${f(y)} M${f(x1 - srnd(14, 30))} ${f(y)} L${f(x1 - 4)} ${f(y)} `;
  pen(g, SP * 0.4).setAttribute('d', tex);
  const roll = srnd(0, 1);
  if (roll < 0.45) { // water tank on legs
    const tx = x0 + srnd(24, W - 60);
    shape(g, SP).setAttribute('d', `M${f(tx)} ${f(top - 26)} Q${f(tx + 17)} ${f(top - 30)} ${f(tx + 34)} ${f(top - 26)} L${f(tx + 34)} ${f(top - 8)} Q${f(tx + 17)} ${f(top - 5)} ${f(tx)} ${f(top - 8)}Z`);
    pen(g, SP * 0.6).setAttribute('d', `M${f(tx + 4)} ${f(top - 8)} L${f(tx + 2)} ${f(top)} M${f(tx + 30)} ${f(top - 8)} L${f(tx + 32)} ${f(top)} M${f(tx)} ${f(top - 18)} Q${f(tx + 17)} ${f(top - 15)} ${f(tx + 34)} ${f(top - 18)}`);
  } else if (roll < 0.75) { // antenna
    const ax = x0 + srnd(30, W - 30);
    pen(g, SP * 0.7).setAttribute('d', `M${f(ax)} ${f(top)} L${f(ax)} ${f(top - 34)} M${f(ax - 12)} ${f(top - 28)} L${f(ax + 12)} ${f(top - 28)} M${f(ax - 8)} ${f(top - 20)} L${f(ax + 8)} ${f(top - 20)}`);
  }

  // ---- upper-floor windows: lit one by one at dusk; some with blinds, a plant, an AC unit
  const nWin = 2;
  for (let k = 0; k < nWin; k++) {
    const ww = srnd(46, 58), wh = srnd(38, 46);
    const wx = x0 + (k + 0.5) * (W / nWin) - ww / 2, wy = floorY - 20 - wh;
    const pane = el('path', { d: box(wx, wy, ww, wh, 0.3), stroke: 'currentColor', 'stroke-width': SP }, g);
    const glow = el('ellipse', { cx: f(wx + ww / 2), cy: f(wy + wh / 2), rx: f(ww * 0.95), ry: f(wh * 0.95), fill: 'url(#s-warmglow)', opacity: 0 }, L.glow);
    windows.push({ n: pane, glow, thr: srnd(0, 0.5), lateOff: srnd(0, 1) < 0.5 ? srnd(0.95, 1.2) : 9, warmth: srnd(0, 1), lit: 0 });
    let frame = `M${f(wx + ww / 2)} ${f(wy)} L${f(wx + ww / 2)} ${f(wy + wh)} `;
    if (srnd(0, 1) < 0.5) for (let y = wy + 5; y < wy + wh * 0.55; y += 3.4) frame += `M${f(wx + 2)} ${f(y)} L${f(wx + ww - 2)} ${f(y)} `;
    pen(g, SP * 0.55).setAttribute('d', frame);
    shape(g, SP).setAttribute('d', box(wx - 3, wy + wh, ww + 6, 3.5, 0.2)); // sill
    if (srnd(0, 1) < 0.5) { // plant pot on the sill
      const px = wx + srnd(6, ww - 12);
      shape(g, SP * 0.8).setAttribute('d', `M${f(px)} ${f(wy + wh)} L${f(px + 1)} ${f(wy + wh - 7)} L${f(px + 9)} ${f(wy + wh - 7)} L${f(px + 10)} ${f(wy + wh)}Z`);
      pen(g, SP * 0.7).setAttribute('d', `M${f(px + 5)} ${f(wy + wh - 7)} q-6 -6 -5 -12 M${f(px + 5)} ${f(wy + wh - 7)} q3 -9 8 -10 M${f(px + 5)} ${f(wy + wh - 7)} q1 -6 -1 -14`);
    } else if (k === 1) { // AC unit under the window
      const ax = wx + ww / 2 - 13, ay = wy + wh + 8;
      shape(g, SP * 0.8).setAttribute('d', box(ax, ay, 26, 16, 0.2));
      pen(g, SP * 0.5).setAttribute('d', `${oval(ax + 9, ay + 8, 5.5, 5.5)} M${f(ax + 18)} ${f(ay + 4)} L${f(ax + 24)} ${f(ay + 4)} M${f(ax + 18)} ${f(ay + 7)} L${f(ax + 24)} ${f(ay + 7)}`);
    }
  }

  // ---- signboard with the shop's name and a small colour mark
  const sy = floorY - 2, sh = 24;
  shape(g, SP).setAttribute('d', box(x0 + 6, sy, W - 12, sh, 0.3));
  colour(paint(g, w.color, SP * 0.6), w.color).setAttribute('d', box(x0 + 12, sy + 6, 12, 12, 0.2));
  const label = el('text', { x: f(cx + 7), y: f(sy + sh / 2 + 0.5), 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'currentColor', 'font-size': w.shop.length > 6 ? 13 : 15, 'font-weight': 800, 'letter-spacing': '0.02em', class: 'sign' }, g);
  label.textContent = w.shop;

  // ---- awning: striped, scalloped, flat or a small tiled eave depending on the shop
  const ay = sy + sh + 3, aw = W - 4;
  const kind = w.kind ?? '';
  const awn = el('g', {}, L.front);
  const sway = spring(30, 4);
  let awnDraw: (s: number) => void = () => {};
  if (kind === 'food' || kind === 'bakery' || kind === '') {
    const body = shape(awn, SP);
    const stripes = kind === 'food' ? colour(el('path', { fill: w.color, stroke: 'none' }, awn), w.color) : null;
    const edge = kind === 'bakery' ? colour(paint(awn, w.color, SP * 0.8), w.color) : shape(awn, SP);
    const n = 8;
    awnDraw = (s) => {
      const bx = x0 + 2, by = ay, drop = 13;
      body.setAttribute('d', `M${f(bx)} ${f(by)} L${f(bx + aw)} ${f(by)} L${f(bx + aw + 6 + s)} ${f(by + drop)} L${f(bx - 6 + s)} ${f(by + drop)}Z`);
      if (stripes) {
        let dd = '';
        for (let i = 0; i < n; i += 2) {
          const a = bx + (aw * i) / n, b = bx + (aw * (i + 1)) / n;
          const fa = (v: number) => bx - 6 + s + ((v - bx) / aw) * (aw + 12);
          dd += `M${f(a)} ${f(by + 0.6)} L${f(b)} ${f(by + 0.6)} L${f(fa(b))} ${f(by + drop - 0.6)} L${f(fa(a))} ${f(by + drop - 0.6)}Z `;
        }
        stripes.setAttribute('d', dd);
      }
      let sc = `M${f(bx - 6 + s)} ${f(by + drop)}`;
      for (let i = 0; i < n; i++) {
        const a = bx - 6 + s + ((aw + 12) * i) / n, b = bx - 6 + s + ((aw + 12) * (i + 1)) / n;
        sc += ` Q${f((a + b) / 2 + s * 0.4)} ${f(by + drop + 6)} ${f(b)} ${f(by + drop)}`;
      }
      edge.setAttribute('d', sc + 'Z');
    };
  } else if (kind === 'story') {
    const eave = shape(awn, SP), tiles = pen(awn, SP * 0.45);
    awnDraw = () => {
      eave.setAttribute('d', `M${f(x0 - 6)} ${f(ay + 16)} Q${f(cx)} ${f(ay + 10)} ${f(x1 + 6)} ${f(ay + 16)} L${f(x1 - 4)} ${f(ay)} L${f(x0 + 4)} ${f(ay)}Z`);
      let tl = '';
      for (let x = x0 + 2; x < x1; x += 7) tl += `M${f(x)} ${f(ay + 1)} L${f(x + (x - cx) * 0.06)} ${f(ay + 13.5)} `;
      tiles.setAttribute('d', tl + wl(x0 - 2, ay + 14, x1 + 2, ay + 14, 0.2));
    };
  } else {
    const plate = colour(paint(awn, kind === 'fashion' ? w.color : PAPER, SP), kind === 'fashion' ? w.color : '');
    awnDraw = (s) => plate.setAttribute('d', `M${f(x0 + 2)} ${f(ay)} L${f(x1 - 2)} ${f(ay)} L${f(x1 + 4 + s * 0.3)} ${f(ay + 8)} L${f(x0 - 4 + s * 0.3)} ${f(ay + 8)}Z`);
  }

  // ---- shopfront: window (with the poster inside), door, threshold
  const fy = ay + 4, wx0 = x0 + 10, wx1 = x0 + W - 58, dx0 = x1 - 48, dx1 = x1 - 10;
  const shop = el('path', { d: box(wx0, fy, wx1 - wx0, BASE - fy - 6, 0.3), stroke: 'currentColor', 'stroke-width': SP }, g);
  const shopGlow = el('ellipse', { cx: f((wx0 + wx1) / 2), cy: f((fy + BASE) / 2), rx: f((wx1 - wx0) * 0.8), ry: f((BASE - fy) * 0.75), fill: 'url(#s-warmglow)', opacity: 0 }, L.glow);
  windows.push({ n: shop, glow: shopGlow, thr: 0.05, lateOff: srnd(1.05, 1.2), warmth: 0.3, lit: 0 });
  const inside = el('g', {}, g);

  // the poster, framed on the back wall of the shop
  const ph = 42, pw = ph * 9 / 16, ppx = wx0 + 12, ppy = fy + 18;
  const clipId = `s-clip-${++clipN}`; // unique even if two works share a file
  const cp = el('clipPath', { id: clipId }, inside);
  el('rect', { x: f(ppx), y: f(ppy), width: f(pw), height: f(ph), rx: 1.5 }, cp);
  el('image', { href: `assets/${w.id}.webp`, x: f(ppx), y: f(ppy), width: f(pw), height: f(ph), preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${clipId})` }, inside);
  pen(inside, SP).setAttribute('d', box(ppx - 1.5, ppy - 1.5, pw + 3, ph + 3, 0.15));

  // what the shop sells, drawn inside the window
  const ix = ppx + pw + 8, iw = wx1 - ix - 6, floor = BASE - 7;
  if (kind === 'food') {
    shape(inside, SP).setAttribute('d', box(ix - 2, floor - 16, iw + 4, 16, 0.3));            // counter
    pen(inside, SP * 0.5).setAttribute('d', `M${f(ix)} ${f(floor - 11)} L${f(ix + iw)} ${f(floor - 11)}`);
    shape(inside, SP * 0.8).setAttribute('d', box(ix + 4, fy + 19, iw - 8, 14, 0.2));             // menu board
    pen(inside, SP * 0.45).setAttribute('d', [23, 27, 31].map((y) => `M${f(ix + 8)} ${f(fy + y)} L${f(ix + 8 + srnd(14, iw - 22))} ${f(fy + y)}`).join(' '));
    // a burger on the counter
    const bx = ix + iw / 2, by = floor - 16;
    shape(inside, SP * 0.7).setAttribute('d', `M${f(bx - 7)} ${f(by - 3)} Q${f(bx)} ${f(by - 12)} ${f(bx + 7)} ${f(by - 3)}Z`);
    colour(paint(inside, '#6b8f3a', SP * 0.5), '#6b8f3a').setAttribute('d', `M${f(bx - 7.5)} ${f(by - 3)} q2 1.6 4 0 q2 1.6 4 0 q2 1.6 4 0 q2 1.6 3 0 L${f(bx + 7.5)} ${f(by - 1.6)} L${f(bx - 7.5)} ${f(by - 1.6)}Z`);
    blot(inside).setAttribute('d', box(bx - 7, by - 1.6, 14, 1.6, 0.05));
  } else if (kind === 'fashion') {
    pen(inside, SP * 0.8).setAttribute('d', `M${f(ix)} ${f(fy + 20)} L${f(ix + iw)} ${f(fy + 20)}`);           // rail
    for (let k = 0; k < 4; k++) {
      const hx = ix + 6 + k * ((iw - 12) / 3);
      pen(inside, SP * 0.5).setAttribute('d', `M${f(hx)} ${f(fy + 20)} q2 -3 0 -4 M${f(hx - 5)} ${f(fy + 24)} L${f(hx)} ${f(fy + 20)} L${f(hx + 5)} ${f(fy + 24)}`);
      const c = k % 2 ? w.color : '#c9b79a';
      colour(paint(inside, c, SP * 0.6), c).setAttribute('d', `M${f(hx - 5)} ${f(fy + 24)} L${f(hx + 5)} ${f(fy + 24)} L${f(hx + 6)} ${f(fy + 40)} L${f(hx - 6)} ${f(fy + 40)}Z`);
    }
    // mannequin on a stand
    const mx = ix + iw / 2;
    shape(inside, SP * 0.8).setAttribute('d', `M${f(mx - 6)} ${f(floor - 34)} Q${f(mx)} ${f(floor - 37)} ${f(mx + 6)} ${f(floor - 34)} L${f(mx + 5)} ${f(floor - 20)} Q${f(mx)} ${f(floor - 17)} ${f(mx - 5)} ${f(floor - 20)}Z`);
    pen(inside, SP * 0.7).setAttribute('d', `M${f(mx)} ${f(floor - 18)} L${f(mx)} ${f(floor)} M${f(mx - 5)} ${f(floor)} L${f(mx + 5)} ${f(floor)} M${f(mx)} ${f(floor - 37)} L${f(mx)} ${f(floor - 40)}`);
  } else if (kind === 'bakery') {
    for (const sy2 of [fy + 30, fy + 47]) {
      pen(inside, SP * 0.8).setAttribute('d', wl(ix, sy2, ix + iw, sy2, 0.2));
      for (let bx = ix + 5; bx < ix + iw - 4; bx += srnd(8, 11)) {
        const r = srnd(3.2, 4.4);
        colour(paint(inside, '#c98b4a', SP * 0.6), '#c98b4a').setAttribute('d', `M${f(bx - r)} ${f(sy2)} Q${f(bx - r)} ${f(sy2 - r * 1.3)} ${f(bx)} ${f(sy2 - r * 1.3)} Q${f(bx + r)} ${f(sy2 - r * 1.3)} ${f(bx + r)} ${f(sy2)}Z`);
        pen(inside, SP * 0.4).setAttribute('d', `M${f(bx - 1.5)} ${f(sy2 - r * 0.6)} l1.4 -1.6 M${f(bx + 0.5)} ${f(sy2 - r * 0.5)} l1.4 -1.6`);
      }
    }
    // A-board on the pavement
    const ax = dx0 - 34;
    shape(L.front, SP).setAttribute('d', `M${f(ax)} ${f(BASE + 14)} L${f(ax + 4)} ${f(BASE - 14)} L${f(ax + 26)} ${f(BASE - 14)} L${f(ax + 30)} ${f(BASE + 14)}Z`);
    const t = el('text', { x: f(ax + 15), y: f(BASE - 2), 'text-anchor': 'middle', fill: 'currentColor', 'font-size': 4.4, 'font-weight': 700, class: 'sign' }, L.front);
    t.textContent = '오늘의 빵';
  } else if (kind === 'books') {
    for (const by of [fy + 32, fy + 48]) {
      pen(inside, SP * 0.8).setAttribute('d', wl(ix, by, ix + iw, by, 0.2));
      let sp = '';
      for (let bx = ix + 2; bx < ix + iw - 2; bx += srnd(2.4, 3.8)) sp += `M${f(bx)} ${f(by)} L${f(bx + srnd(-0.6, 0.6))} ${f(by - srnd(9, 14))} `;
      pen(inside, SP * 0.6).setAttribute('d', sp);
    }
    // a stack of books in front
    for (let k = 0; k < 4; k++) {
      const c = [w.color, '#c9b79a', '#7a6a55', w.color][k];
      colour(paint(inside, c, SP * 0.6), c).setAttribute('d', box(ix + 6 + srnd(-2, 2), floor - 4 - k * 4, 18, 4, 0.1));
    }
  } else if (kind === 'story') {
    // paper screen with a lattice, a lantern inside
    pen(inside, SP * 0.5).setAttribute('d', Array.from({ length: 5 }, (_, k) => `M${f(ix + (iw * k) / 4)} ${f(fy + 16)} L${f(ix + (iw * k) / 4)} ${f(floor)}`).join(' ') + Array.from({ length: 5 }, (_, k) => ` M${f(ix)} ${f(fy + 16 + ((floor - fy - 16) * k) / 4)} L${f(ix + iw)} ${f(fy + 16 + ((floor - fy - 16) * k) / 4)}`).join(''));
  } else {
    // a plant in a pot
    const px = ix + iw / 2;
    shape(inside, SP * 0.8).setAttribute('d', `M${f(px - 6)} ${f(floor)} L${f(px - 7)} ${f(floor - 10)} L${f(px + 7)} ${f(floor - 10)} L${f(px + 6)} ${f(floor)}Z`);
    pen(inside, SP * 0.7).setAttribute('d', `M${f(px)} ${f(floor - 10)} q-10 -8 -8 -20 M${f(px)} ${f(floor - 10)} q8 -10 12 -14 M${f(px)} ${f(floor - 10)} q1 -12 -2 -26`);
  }
  // glass: mullion and a few reflection strokes, drawn over the inside
  pen(g, SP * 0.6).setAttribute('d', `M${f(wx0)} ${f(fy + 4)} L${f(wx1)} ${f(fy + 4)} M${f(wx0 + 8)} ${f(BASE - 12)} l10 -14 M${f(wx0 + 14)} ${f(BASE - 12)} l6 -8 M${f(wx1 - 20)} ${f(fy + 22)} l10 -12`);

  // door
  const door = el('path', { d: box(dx0, fy, dx1 - dx0, BASE - fy, 0.3), stroke: 'currentColor', 'stroke-width': SP }, g);
  windows.push({ n: door, glow: el('circle', { r: 0, opacity: 0 }, L.glow), thr: 0.1, lateOff: 9, warmth: 0.2, lit: 0 });
  pen(g, SP * 0.6).setAttribute('d', `M${f(dx0 + 4)} ${f(fy + 4)} L${f(dx1 - 4)} ${f(fy + 4)} L${f(dx1 - 4)} ${f(BASE - 3)} L${f(dx0 + 4)} ${f(BASE - 3)}Z M${f(dx1 - 9)} ${f(fy + 38)} L${f(dx1 - 9)} ${f(fy + 52)}`);
  pen(g, SP).setAttribute('d', wl(x0 - 2, BASE, x1 + 2, BASE, 0.2) + ` ${wl(dx0 - 3, BASE + 3, dx1 + 3, BASE + 3, 0.2)}`);

  // ---- projecting blade sign with an icon, swinging on its bracket
  const bladeX = x1 - 2, bladeY = sy - 46;
  pen(g, SP).setAttribute('d', `M${f(bladeX)} ${f(bladeY)} L${f(bladeX + 22)} ${f(bladeY)} M${f(bladeX)} ${f(bladeY - 4)} L${f(bladeX)} ${f(bladeY + 4)}`);
  const blade = el('g', { style: 'cursor:pointer' }, L.front);
  const bladeBody = shape(blade, SP);
  bladeBody.setAttribute('d', box(-10, 6, 20, 26, 0.2));
  pen(blade, SP * 0.6).setAttribute('d', 'M-6 0 L-6 6 M6 0 L6 6');
  const icon = pen(blade, SP * 0.75);
  const icons: Record<string, string> = {
    food: `M-6 19 Q0 10 6 19Z M-6.5 21 L6.5 21 M-6 23.5 Q0 26 6 23.5`,
    fashion: `M0 13 q2 -2.5 0 -3.5 M-7 19 L0 13 L7 19Z`,
    bakery: `M-6 23 Q-6 14 0 14 Q6 14 6 23Z M-2.5 17 l2 -2 M1 18 l2 -2`,
    books: `M-6 13 L-6 25 L0 23 L6 25 L6 13 L0 15Z M0 15 L0 23`,
    story: `M-4 12 Q-6 19 -4 26 L4 26 Q6 19 4 12Z M-4.6 15 L4.6 15 M-4.6 23 L4.6 23`,
  };
  icon.setAttribute('d', icons[kind] ?? `M-5 14 L5 14 L5 24 L-5 24Z`);
  const swing = pendulum(9, 1.3);

  // ---- lanterns for the story shop
  const lanterns: Array<{ grp: SVGGElement; body: SVGElement; glow: SVGElement; x: number; y: number; p: ReturnType<typeof pendulum>; thr: number }> = [];
  if (kind === 'story') {
    for (const lx of [x0 + 18, x1 - 18]) {
      const grp = el('g', { style: 'cursor:pointer' }, L.front);
      pen(grp, SP * 0.6).setAttribute('d', 'M0 0 L0 6');
      const body = colour(paint(grp, w.color, SP * 0.8), w.color);
      body.setAttribute('d', 'M-6 6 Q-9 14 -6 22 L6 22 Q9 14 6 6Z');
      blot(grp).setAttribute('d', 'M-4 4.6 L4 4.6 L4 6.6 L-4 6.6Z M-4 21.4 L4 21.4 L4 23.4 L-4 23.4Z');
      pen(grp, SP * 0.4).setAttribute('d', 'M-7.6 10 Q0 11 7.6 10 M-8 14 Q0 15 8 14 M-7.6 18 Q0 19 7.6 18 M0 23.4 L0 29');
      const glow = el('circle', { cx: f(lx), cy: f(ay + 30), r: 26, fill: 'url(#s-warmglow)', opacity: 0 }, L.glow);
      lanterns.push({ grp, body, glow, x: lx, y: ay + 16, p: pendulum(10, 1.2), thr: srnd(0.05, 0.25) });
    }
  }

  // ---- hit area: the whole shopfront and sign open the work
  const hit = el('path', { d: `M${f(x0)} ${f(sy)} L${f(x1)} ${f(sy)} L${f(x1)} ${f(BASE)} L${f(x0)} ${f(BASE)}Z`, fill: 'transparent', style: 'cursor:pointer', tabindex: 0, role: 'button', 'aria-label': `${w.title} 영상 보기` }, L.hits);
  el('title', {}, hit).textContent = `${w.title} — ${w.shop}`;
  let pulse = 0;
  const open = () => { pulse = 1; swing.kick(3); lanterns.forEach((l) => l.p.kick(2.5)); onOpen(); };
  hit.addEventListener('click', open);
  hit.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); open(); } });
  blade.addEventListener('click', () => swing.kick(4));
  lanterns.forEach((l) => l.grp.addEventListener('click', () => l.p.kick(3)));

  return {
    x0, x1, windows, hit,
    draw(t: number, dt: number, wind: number, P: Palette) {
      awnDraw(sway.step(wind * 2.2 + Math.sin(t * 1.7) * 0.4, dt));
      const a = swing.step(-wind * 0.9 + Math.sin(t * 0.9) * 0.05, dt);
      blade.setAttribute('transform', `translate(${f(bladeX + 16)} ${f(bladeY)}) rotate(${f(a * 57.3)})`);
      lanterns.forEach((l) => {
        const la = l.p.step(-wind * 0.8, dt);
        l.grp.setAttribute('transform', `translate(${f(l.x)} ${f(l.y)}) rotate(${f(la * 57.3)})`);
        const on = smooth(l.thr, l.thr + 0.2, P.lamp);
        const base = toRGB(w.color); l.body.setAttribute('fill', rgb(mix(mix(base, mix(base, [12, 16, 30], 0.6), P.inkT * 0.55), toRGB('#ffb070'), on * 0.7)));
        l.glow.setAttribute('opacity', f(on * 0.9));
        l.glow.setAttribute('cx', f(l.x - Math.sin(la) * 14));
      });
      painted.forEach((p) => { if (p.c && p.n !== lanterns[0]?.body && p.n !== lanterns[1]?.body) p.n.setAttribute('fill', nightTint(p.c, P)); });
      pulse = Math.max(0, pulse - dt * 1.4);
      return pulse;
    },
  };
}

export type Shop = ReturnType<typeof buildShop>;

/** Fill each lit window with warm light, one by one; some go dark late at night. */
export function lightWindows(list: Lit[], tau: number, P: Palette, boost = 0): void {
  const sinceDusk = (tau - 0.75 + 1) % 1;
  for (const w of list) {
    let lit = smooth(w.thr, w.thr + 0.25, P.lamp);
    if (w.lateOff < 9 && sinceDusk > w.lateOff - 0.75 && sinceDusk < 0.5) lit = 0;
    w.lit = lerp(w.lit, Math.max(lit, boost), 0.08);
    w.n.style.fill = rgb(mix(P.paper, mix(WARM_A, WARM_B, w.warmth), w.lit * 0.9));
    w.glow.setAttribute('opacity', f(w.lit * 0.75));
  }
}
