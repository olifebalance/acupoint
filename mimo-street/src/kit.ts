// Shared sizes and small drawing helpers for the street.
import { f } from './lib/ink.ts';
import { seeded } from './lib/motion.ts';

export const H = 480;
export const BASE = 352;                      // shop fronts meet the pavement
export const LANE = { back: 370, front: 382 }; // feet lines on the pavement
export const KERB = 396;                      // kerb top; the road below
export const SP = 0.8;                        // scene pen (pen × figure scale)
export const FS = 0.5;                        // figure scale (figures ≈ 48 px tall)
export const SHOP_W = 196, GAP = 14, MARGIN = 76;

/** Scene width grows with the number of works, so the street gets longer. */
export const sceneWidth = (n: number): number => MARGIN * 2 + n * SHOP_W + Math.max(0, n - 1) * GAP;
export const shopX = (i: number): number => MARGIN + i * (SHOP_W + GAP);

/** Seeded random, so the street is drawn the same on every load. */
export const srnd = seeded(23);
export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];

/** A slightly bowed line: nothing in this style is ruler-straight. */
export const wl = (x1: number, y1: number, x2: number, y2: number, amp = 0.55): string => {
  const mx = (x1 + x2) / 2 + srnd(-amp, amp), my = (y1 + y2) / 2 + srnd(-amp, amp);
  return `M${f(x1)} ${f(y1)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
};

/** A closed box with gently bowed edges. */
export const box = (x: number, y: number, w: number, h: number, amp = 0.45): string => {
  const b = () => srnd(-amp, amp);
  return `M${f(x)} ${f(y)} Q${f(x + w / 2)} ${f(y + b())} ${f(x + w)} ${f(y)} Q${f(x + w + b())} ${f(y + h / 2)} ${f(x + w)} ${f(y + h)} Q${f(x + w / 2)} ${f(y + h + b())} ${f(x)} ${f(y + h)} Q${f(x + b())} ${f(y + h / 2)} ${f(x)} ${f(y)}Z`;
};

export const oval = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${f(cx - rx)} ${f(cy)} a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0 a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
