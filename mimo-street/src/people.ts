// Passers-by on the pavement. Each walks on the library's gait solver (planted
// feet, hip rising over each step), wears a jacket drawn around the forward knee,
// and may carry a shopping bag that swings on a pendulum. Tap one and they stop,
// turn their head a little and wave, then walk on.
import { el, pen, shape, blot, paint, limb, solid, shoe, place, f, pt, PEN, PAPER, type Vec } from './lib/ink.ts';
import { gait } from './lib/gait.ts';
import { spring, pendulum, ease, clamp } from './lib/motion.ts';
import { nightTint, type Palette } from './lib/daynight.ts';
import { FS, rnd, pick } from './kit.ts';

const lerpP = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const OUTFITS = [
  { top: '#c9b79a', bottom: '#2f3a4a' }, { top: '#4f6b55', bottom: '#1c1c1c' },
  { top: '#e6dccb', bottom: '#6b4a32' }, { top: '#8a5a3c', bottom: '#3a3a3a' }, { top: '#34507a', bottom: '#c9b79a' },
];

export function createWalker(parent: Element, opts: { dir: 1 | -1; x: number; y: number; W: number }) {
  const { dir, W } = opts;
  const g = el('g', { style: 'cursor:pointer' }, parent);
  const outfit = pick(OUTFITS);
  const hair = pick(['short', 'bun', 'cap', 'long']);
  const bagC = Math.random() < 0.65 ? pick(['#b3412d', '#d9902b', '#e6dccb', '#2f6b66']) : null;
  const walk = gait({ kind: 'walk', period: rnd(1.0, 1.15) });

  const farArm = limb(g, 3.4);
  const legs = [solid(limb(g, 4.2), outfit.bottom), solid(limb(g, 4.2), outfit.bottom)];
  const shoes = [blot(g), blot(g)];
  const jacket = paint(g, outfit.top);
  const seam = pen(g, PEN * 0.55);
  const neck = limb(g, 3);
  const head = el('ellipse', { rx: 3.7, ry: 4.6, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN }, g);
  const hairN = blot(g);
  const nearArm = limb(g, 3.4);
  const hand = el('ellipse', { rx: 1.7, ry: 1.4, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN * 0.7 }, g);
  const bagG = el('g', {}, g);
  const bag = bagC ? paint(bagG, bagC, PEN * 0.8) : null;
  const strap = bagC ? pen(bagG, PEN * 0.7) : null;

  const swing = [spring(60, 9), spring(60, 9)];
  const bagSwing = pendulum(14, 1.8);
  let phase = rnd(0, 1), waveT = -1;

  const me = {
    g, x: opts.x, y: opts.y, done: false,
    poke() { if (waveT < 0) waveT = 0; },
    remove() { g.remove(); },
    draw(t: number, dt: number, P: Palette, wind: number) {
      // a wave: slow to a stop, raise the near hand, wave, lower it, walk on
      let wave = 0;
      if (waveT >= 0) { waveT += dt; wave = waveT < 0.4 ? ease(waveT / 0.4) : waveT < 1.9 ? 1 : 1 - ease((waveT - 1.9) / 0.45); if (waveT > 2.4) waveT = -1; }
      const go = clamp(1 - wave * 1.4, 0, 1);
      phase += (dt / walk.period) * go;
      me.x += dir * walk.speed * FS * dt * go;
      if (me.x < -60 || me.x > W + 60) me.done = true;
      place(g, me.x, me.y, dir, FS);

      const p = walk.pose(phase, go);
      const b = p.bob;
      p.feet.forEach((fo, i) => { legs[i].draw([p.hip, fo.knee, fo.ankle], [0.3, 0.8]); shoe(shoes[i] as SVGPathElement, fo.ankle, fo.pitch); });
      g.insertBefore(legs[p.front].g, jacket); g.insertBefore(shoes[p.front], jacket);

      // jacket hem follows the forward knee, so it opens and closes with the stride
      const kF = p.feet[p.front].knee;
      const sh: Vec = [41, 41 + b];
      const fx = Math.max(kF[0] + 1.6, 46);
      jacket.setAttribute('d', `M${f(sh[0] - 6)} ${f(sh[1] + 1)} Q${f(sh[0])} ${f(sh[1] - 2.4)} ${f(sh[0] + 5.4)} ${f(sh[1] + 1)} L${f(fx - 1)} ${f(66 + b)} Q${f(fx)} ${f(72 + b)} ${f(fx - 0.4)} ${f(78 + b)} L${f(32.4)} ${f(78.6 + b)} L${f(33.2)} ${f(64 + b)}Z`);
      jacket.setAttribute('fill', nightTint(outfit.top, P));
      seam.setAttribute('d', `M${f(sh[0] + 2.6)} ${f(sh[1] + 4)} L${f(sh[0] + 3.4)} ${f(77 + b)}`);
      neck.draw([[41, 41 + b], [41.4, 35.6 + b]], [0.2, 0.2]);

      const turn = wave * 1.2;
      const hc: Vec = [42.4 + turn, 31.4 + b];
      head.setAttribute('cx', f(hc[0])); head.setAttribute('cy', f(hc[1]));
      const [hx, hy] = hc;
      const hairD: Record<string, string> = {
        short: `M${f(hx - 4)} ${f(hy - 0.6)} Q${f(hx - 4.6)} ${f(hy - 6)} ${f(hx)} ${f(hy - 5.6)} Q${f(hx + 4.4)} ${f(hy - 5.4)} ${f(hx + 3.8)} ${f(hy - 1.8)} Q${f(hx + 1)} ${f(hy - 3.6)} ${f(hx - 1.6)} ${f(hy - 2.6)} Q${f(hx - 3)} ${f(hy - 1.6)} ${f(hx - 4)} ${f(hy - 0.6)}Z`,
        bun: `M${f(hx - 4)} ${f(hy)} Q${f(hx - 4.6)} ${f(hy - 6)} ${f(hx)} ${f(hy - 5.6)} Q${f(hx + 4.4)} ${f(hy - 5.2)} ${f(hx + 3.6)} ${f(hy - 1.6)} Q${f(hx)} ${f(hy - 3.6)} ${f(hx - 4)} ${f(hy)}Z M${f(hx - 6.6)} ${f(hy - 3.4)} a2.4 2.4 0 1 0 4.8 0 a2.4 2.4 0 1 0 -4.8 0Z`,
        cap: `M${f(hx - 4.2)} ${f(hy - 1.4)} Q${f(hx - 4)} ${f(hy - 6.6)} ${f(hx + 0.6)} ${f(hy - 6.2)} Q${f(hx + 4)} ${f(hy - 5.6)} ${f(hx + 3.8)} ${f(hy - 2.4)} L${f(hx + 8)} ${f(hy - 1.8)} L${f(hx + 3.6)} ${f(hy - 1.2)}Z`,
        long: `M${f(hx - 4)} ${f(hy + 5)} Q${f(hx - 5.4)} ${f(hy - 5.6)} ${f(hx)} ${f(hy - 5.6)} Q${f(hx + 4.4)} ${f(hy - 5.4)} ${f(hx + 3.8)} ${f(hy - 1.6)} Q${f(hx)} ${f(hy - 3.4)} ${f(hx - 1.4)} ${f(hy + 4.6)}Z`,
      };
      hairN.setAttribute('d', hairD[hair]);

      // arms swing opposite the legs through springs; the near arm waves when tapped
      const legSwing = (p.feet[0].ankle[0] - 40) / (walk.stride / 2);
      const farA = (swing[0].step(-legSwing * 15 * go, dt) * Math.PI) / 180;
      const nearA = (swing[1].step(legSwing * 13 * go, dt) * Math.PI) / 180;
      const shF: Vec = [sh[0] - 1, sh[1] + 2], shN: Vec = [sh[0] + 1.4, sh[1] + 2.4];
      const elbF: Vec = [shF[0] + 16.5 * Math.sin(farA), shF[1] + 16.5 * Math.cos(farA)];
      farArm.draw([shF, elbF, [elbF[0] + 15.5 * Math.sin(farA + 0.2), elbF[1] + 15.5 * Math.cos(farA + 0.2)]], [0.2, 0.5]);
      const elbN: Vec = [shN[0] + 16.5 * Math.sin(nearA), shN[1] + 16.5 * Math.cos(nearA)];
      const restHand: Vec = [elbN[0] + 15.5 * Math.sin(nearA + 0.1), elbN[1] + 15.5 * Math.cos(nearA + 0.1)];
      const wag = waveT > 0.4 && waveT < 1.9 ? Math.sin((waveT - 0.4) * 11) * 3.4 : 0;
      const upHand: Vec = [shN[0] + 10 + wag, shN[1] - 18];
      const upElb: Vec = [shN[0] + 11, shN[1] + 2];
      const handP = lerpP(restHand, upHand, wave);
      nearArm.draw([shN, lerpP(elbN, upElb, wave), handP], [0.2, 0.4]);
      hand.setAttribute('cx', f(handP[0])); hand.setAttribute('cy', f(handP[1]));

      // the bag stays in the far hand so it never fights the wave
      if (bag && strap) {
        const fh: Vec = [elbF[0] + 15.5 * Math.sin(farA + 0.2), elbF[1] + 15.5 * Math.cos(farA + 0.2)];
        const accel = Math.cos(4 * Math.PI * phase) * 1.4 * go;
        const ba = bagSwing.step(-accel - wind * 0.3, dt);
        bagG.setAttribute('transform', `rotate(${f(ba * 57.3)} ${pt(fh)})`);
        strap.setAttribute('d', `M${f(fh[0] - 3)} ${f(fh[1] + 6)} Q${pt(fh)} ${f(fh[0] + 3)} ${f(fh[1] + 6)}`);
        bag.setAttribute('d', `M${f(fh[0] - 6)} ${f(fh[1] + 5)} L${f(fh[0] + 6)} ${f(fh[1] + 5)} L${f(fh[0] + 6.6)} ${f(fh[1] + 18)} L${f(fh[0] - 6.6)} ${f(fh[1] + 18)}Z`);
        bag.setAttribute('fill', nightTint(bagC!, P));
        g.insertBefore(bagG, farArm.g.nextSibling);
      }
    },
  };
  return me;
}
export type Walker = ReturnType<typeof createWalker>;
