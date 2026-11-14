// Sky: gradient, stars, a draggable sun and moon, drifting clouds and a far
// skyline of apartment blocks in diluted ink.
// Time of day τ ∈ [0,1): 0 midnight · 0.25 dawn · 0.5 noon · 0.75 dusk.
import { el, pen, shape, f } from './lib/ink.ts';
import { rgb, mix, toRGB, type Palette } from './lib/daynight.ts';
import { clamp, smooth } from './lib/motion.ts';
import { SP, srnd } from './kit.ts';

const SUN_SPAN = [0.225, 0.55] as const, MOON_SPAN = [0.775, 0.45] as const;

export function createSky(svg: SVGSVGElement, root: Element, defs: Element, W: number, onScrub: (tau: number | null) => void) {
  const arc = (u: number, h: number): [number, number] => [50 + (W - 100) * u, 104 - h * Math.sin(Math.PI * u)];

  const grad = el('linearGradient', { id: 's-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  const s0 = el('stop', { offset: 0 }, grad), s1 = el('stop', { offset: 1 }, grad);
  const glowSun = el('radialGradient', { id: 's-sunglow' }, defs);
  el('stop', { offset: 0, 'stop-color': '#ffd9a0', 'stop-opacity': 0.6 }, glowSun);
  el('stop', { offset: 1, 'stop-color': '#ffd9a0', 'stop-opacity': 0 }, glowSun);

  const g = el('g', {}, root);
  el('rect', { x: -20, y: -20, width: W + 40, height: 520, fill: 'url(#s-sky)' }, g);

  const starG = el('g', {}, g);
  const stars = Array.from({ length: Math.round(W / 11) }, () => ({
    n: el('circle', { cx: f(srnd(0, W)), cy: f(srnd(8, 210)), r: f(srnd(0.35, 1.05)), fill: '#f5efda' }, starG),
    ph: srnd(0, 6), sp: srnd(0.6, 2.2),
  }));

  // far skyline: apartment blocks with window ticks, in diluted ink
  const far = el('g', { opacity: 0.32 }, g);
  let d = '', ticks = '';
  for (let x = -10; x < W + 10;) {
    const w = srnd(46, 92), h = srnd(70, 150), top = 262 - h;
    d += `M${f(x)} 262 L${f(x)} ${f(top)} L${f(x + w)} ${f(top)} L${f(x + w)} 262 `;
    for (let y = top + 10; y < 252; y += 11) ticks += `M${f(x + 6)} ${f(y)} L${f(x + w - 6)} ${f(y)} `;
    x += w + srnd(6, 30);
  }
  pen(far, SP * 0.8).setAttribute('d', d);
  pen(far, SP * 0.35).setAttribute('d', ticks);

  // clouds: soft scalloped outlines filled with paper, drifting with the wind
  const clouds = [[0.12, 74, 1], [0.48, 52, 1.3], [0.8, 96, 0.9]].map(([u, y, s]) => {
    const n = shape(g, SP * 0.7);
    n.setAttribute('d', `M0 0 q4 -10 14 -8 q6 -12 20 -8 q10 -8 20 2 q12 -2 12 8 Z`);
    n.setAttribute('opacity', '0.9');
    return { n, x: u * W, y, s };
  });

  // sun and moon, both draggable along their arcs
  const sunG = el('g', { style: 'cursor:grab;touch-action:none' }, g);
  el('circle', { r: 74, fill: 'url(#s-sunglow)' }, sunG);
  const sunDisk = el('circle', { r: 20, stroke: 'currentColor', 'stroke-width': SP }, sunG);
  el('circle', { r: 34, fill: 'transparent' }, sunG); // a bigger target for fingers
  el('title', {}, sunG).textContent = '해를 끌어 시간을 바꾸기';
  const moonG = el('g', { style: 'cursor:grab;touch-action:none' }, g);
  el('circle', { r: 30, fill: 'transparent' }, moonG);
  el('path', { d: 'M-10 -14 A17 17 0 1 0 -10 14 A13 13 0 1 1 -10 -14Z', fill: '#f3ecd6', stroke: '#f3ecd6', 'stroke-width': 0.6 }, moonG);
  el('title', {}, moonG).textContent = '달을 끌어 시간을 바꾸기';

  let dragging: 'sun' | 'moon' | null = null;
  const toSvgX = (e: PointerEvent) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM()!.inverse()).x; };
  const start = (which: 'sun' | 'moon') => (e: PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    dragging = which; svg.classList.add('scrubbing');
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const u = clamp((toSvgX(e) - 50) / (W - 100), 0, 1);
    const span = dragging === 'sun' ? SUN_SPAN : MOON_SPAN;
    onScrub((span[0] + span[1] * u) % 1);
  };
  const end = () => { if (!dragging) return; dragging = null; svg.classList.remove('scrubbing'); onScrub(null); };
  for (const [n, w] of [[sunG, 'sun'], [moonG, 'moon']] as const) {
    n.addEventListener('pointerdown', start(w));
    // touch-action on SVG children is not honoured everywhere; stop the street from scrolling while dragging
    n.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    n.addEventListener('pointermove', move);
    n.addEventListener('pointerup', end);
    n.addEventListener('pointercancel', end);
  }

  return {
    draw(tau: number, t: number, dt: number, P: Palette, wind: number) {
      s0.setAttribute('stop-color', rgb(P.top));
      s1.setAttribute('stop-color', rgb(mix(P.bottom, toRGB('#f0a379'), P.sunset * 0.25)));
      stars.forEach((s) => s.n.setAttribute('opacity', f(P.night * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph)))));
      const su = (tau - SUN_SPAN[0]) / SUN_SPAN[1];
      sunG.style.display = su > -0.02 && su < 1.02 ? '' : 'none';
      const [sx, sy] = arc(clamp(su, 0, 1), 78);
      sunG.setAttribute('transform', `translate(${f(sx)} ${f(sy)})`);
      sunDisk.setAttribute('fill', rgb(mix(toRGB('#fff6df'), toRGB('#f6b27a'), P.sunset)));
      const mu = (((tau - MOON_SPAN[0]) % 1) + 1) % 1 / MOON_SPAN[1];
      moonG.style.display = mu < 1.02 ? '' : 'none';
      const [mx, my] = arc(clamp(mu, 0, 1), 70);
      moonG.setAttribute('transform', `translate(${f(mx)} ${f(my)})`);
      moonG.setAttribute('opacity', f(smooth(0, 0.08, mu) * smooth(1, 0.92, mu)));
      clouds.forEach((c) => {
        c.x += (6 + wind * 10) * dt;
        if (c.x > W + 60) c.x = -90;
        if (c.x < -100) c.x = W + 50;
        c.n.setAttribute('transform', `translate(${f(c.x)} ${f(c.y)}) scale(${f(c.s * 1.6)})`);
        c.n.setAttribute('opacity', f(0.9 - P.night * 0.6));
      });
    },
  };
}
