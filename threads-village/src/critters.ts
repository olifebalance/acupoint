// A cat on the bench and sparrows on the wire.
import { el, pen, shape, blot, f, PAPER } from './lib/ink.ts';
import { ease, smooth, lerp } from './lib/motion.ts';
import type { Palette } from './lib/daynight.ts';
import { SP, rnd, oval } from './kit.ts';

/** A sitting cat. Tap: it wakes, stands and stretches, then sits back down. */
export function createCat(parent: Element, glow: Element, x: number, y: number) {
  const g = el('g', { style: 'cursor:pointer' }, parent);
  const tail = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': SP * 1.6, 'stroke-linecap': 'round' }, g);
  const body = shape(g, SP);
  const patch = blot(g);
  const ears = shape(g, SP * 0.8);
  const eyes = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': SP * 0.6 }, g);
  const eyeGlow = el('g', { opacity: 0 }, glow);
  el('circle', { cx: f(x + 9), cy: f(y - 19), r: 5, fill: '#e8ff9a', opacity: 0.6 }, eyeGlow);
  const hit = el('rect', { x: f(x - 18), y: f(y - 30), width: 40, height: 32, fill: 'transparent' }, g);
  el('title', {}, hit).textContent = '고양이 깨우기';
  let pokeT = -1;
  g.addEventListener('click', () => { if (pokeT < 0) pokeT = 0; });
  // sit and stretch poses as matching point lists, blended
  const SIT = [[-12, 0], [-13, -12], [-6, -20], [3, -22], [8, -26], [14, -23], [14, -15], [8, -12], [6, 0]];
  const STR = [[-16, 0], [-17, -14], [-8, -16], [2, -12], [10, -10], [17, -11], [17, -4], [11, -2], [12, 0]];
  return {
    draw(t: number, dt: number, P: Palette) {
      let k = 0;
      if (pokeT >= 0) { pokeT += dt; k = pokeT < 0.6 ? ease(pokeT / 0.6) : pokeT < 2.2 ? 1 : 1 - ease((pokeT - 2.2) / 0.8); if (pokeT > 3) pokeT = -1; }
      const pts = SIT.map((s, i) => [x + lerp(s[0], STR[i][0], k), y + lerp(s[1], STR[i][1], k)]);
      let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
      for (let i = 1; i < pts.length; i++) { const m = [(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2]; d += ` Q${f(pts[i - 1][0])} ${f(pts[i - 1][1])} ${f(m[0])} ${f(m[1])}`; }
      body.setAttribute('d', d + ` L${f(pts[pts.length - 1][0])} ${f(pts[pts.length - 1][1])}Z`);
      const hx = pts[5][0] - 4, hy = pts[5][1] - 1;
      ears.setAttribute('d', `M${f(hx - 1)} ${f(hy - 2)} L${f(hx)} ${f(hy - 7)} L${f(hx + 3)} ${f(hy - 3)}Z M${f(hx + 4)} ${f(hy - 3)} L${f(hx + 6.4)} ${f(hy - 7.4)} L${f(hx + 7.4)} ${f(hy - 2)}Z`);
      patch.setAttribute('d', oval(pts[2][0] + 3, pts[2][1] + 5, 4, 2.6));
      const awake = Math.max(k, P.night);
      eyes.setAttribute('d', awake > 0.5 ? `${oval(hx + 2.2, hy + 1.4, 0.7, 0.9)} ${oval(hx + 5.6, hy + 1.4, 0.7, 0.9)}` : `M${f(hx + 1.2)} ${f(hy + 1.6)} l2 0 M${f(hx + 4.6)} ${f(hy + 1.6)} l2 0`);
      eyeGlow.setAttribute('opacity', f(P.night * 0.8));
      const flick = Math.sin(t * (k > 0 ? 6 : 1.4)) * (k > 0 ? 4 : 2);
      const tx = pts[0][0], ty = pts[0][1] - 2;
      tail.setAttribute('d', k > 0.3
        ? `M${f(tx)} ${f(ty - 6)} Q${f(tx - 10)} ${f(ty - 12)} ${f(tx - 8 + flick)} ${f(ty - 26)}`
        : `M${f(tx)} ${f(ty)} Q${f(tx - 10)} ${f(ty + 1)} ${f(tx - 14 + flick * 0.5)} ${f(ty - 6 + flick)}`);
    },
  };
}

/** Sparrows perched on a wire. Tap the wire: they flush, circle off, and come back. */
export function createSparrows(parent: Element, wireAt: (x: number) => number, xs: number[]) {
  const birds = xs.map((x) => {
    const g = el('g', {}, parent);
    const body = shape(g, SP * 0.7), cap = blot(g), wing = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': SP * 0.8, 'stroke-linecap': 'round' }, g);
    body.setAttribute('d', 'M-5 -1 Q-4.6 -6.6 0.6 -6.6 Q4.6 -6.4 4.4 -2.8 Q3.4 -0.4 -1.6 0.2 L-8.4 1.8Z');
    cap.setAttribute('d', 'M1 -6 Q3.6 -6.4 4 -3.6 L2 -4Z');
    return { g, wing, x, home: x, y: wireAt(x), vx: 0, vy: 0, away: 0, dir: Math.random() < 0.5 ? 1 : -1 };
  });
  const hit = el('path', { d: `M${xs[0] - 30} ${wireAt(xs[0]) - 14} L${xs[xs.length - 1] + 30} ${wireAt(xs[xs.length - 1]) - 14} L${xs[xs.length - 1] + 30} ${wireAt(xs[xs.length - 1]) + 6} L${xs[0] - 30} ${wireAt(xs[0]) + 6}Z`, fill: 'transparent', style: 'cursor:pointer' }, parent);
  el('title', {}, hit).textContent = '참새 날리기';
  const flush = () => birds.forEach((b) => { if (b.away <= 0) { b.away = rnd(5, 8); b.vx = rnd(30, 60) * (Math.random() < 0.5 ? 1 : -1); b.vy = rnd(-70, -45); } });
  hit.addEventListener('click', flush);
  return {
    flush,
    draw(t: number, dt: number, P: Palette) {
      birds.forEach((b) => {
        b.g.style.display = P.night > 0.7 ? 'none' : ''; // they roost at night
        if (b.away > 0) {
          b.away -= dt;
          if (b.away > 2.2) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 10 * dt; }
          else { const k = smooth(2.2, 0, b.away); b.x = lerp(b.x, b.home, k * 0.08); b.y = lerp(b.y, wireAt(b.home), k * 0.08); }
          const flap = Math.sin(t * 28);
          b.wing.setAttribute('d', `M-1 -4 L-5 ${f(-9 * flap)} M1 -4 L4 ${f(-8 * flap)}`);
          b.dir = b.vx > 0 ? 1 : -1;
        } else {
          b.wing.setAttribute('d', 'M-3 -3 L1 -2');
          b.y = wireAt(b.x) - 1;
          if (Math.random() < dt * 0.3) b.dir = -b.dir as 1 | -1; // hop around now and then
        }
        b.g.setAttribute('transform', `translate(${f(b.x)} ${f(b.y)}) scale(${b.dir} 1)`);
      });
    },
  };
}
