/* MIMO — 셔터가 올라가면
   앞: 셔터 프레임을 캔버스에 그리고, 열린 만큼 구멍을 뚫는다.
   뒤: 구멍으로 쇼릴 영상이 보인다. 손을 떼면 영상과 음악이 시작된다. */
(() => {
'use strict';
const M = window.SHUTTER, R = window.REEL;
const $ = id => document.getElementById(id);
const stage = $('stage'), front = $('front'), cv = $('shutter'), cx = cv.getContext('2d');
const sign = $('sign'), slat = $('slat'), slatCopy = $('slatCopy'), pullWrap = $('pullWrap'), pull = $('pull');
const video = $('video'), glow = $('glow'), gx = glow.getContext('2d');
const top = $('top'), sound = $('sound'), title = $('title'), say = $('say'), sayL = $('sayL'), tap = $('tap');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 영상 프레임 안에서의 자리 (프레임 크기에 대한 비율)
const SIGN = { x: 66 / 480, y: 28 / 854, w: 346 / 480, h: 160 / 854 }; // 빈 간판
const SLAT_TOP = 275 / 854;   // 셔터가 말려 들어가는 윗단
const CROP = 22 / 480;        // 좁은 화면에서 좌우로 잘라도 되는 폭
const TITLE_AT = R.titleAt;   // 쇼릴에서 제목이 박히는 시각(초)
// 넓은 화면에서 영상 왼쪽에 박자마다 바뀌는 낱말. 오른쪽에는 "광고로."가 고정으로 있다
const WORDS = { burger: '버거를', andz: '옷을', bakery: '빵을', book: '책을', wuxia: '이야기를' };
const LAST_WORD = '스토어를';
// 넓은 화면에서 양옆 스토어의 간판에 적는 말(MIMO 가 하는 일). 가운데에서 가까운 순서: 왼쪽, 오른쪽, 그 옆 왼쪽, 오른쪽
const SIDE_SIGNS = [['광고 영상', 'AD FILM'], ['상세페이지', 'DETAIL PAGE'], ['스토어 콘텐츠', 'STORE CONTENTS'], ['메뉴판', 'MENU']];
const OPEN_AT = 0.28;         // 이만큼 올리고 손을 떼면 끝까지 올라간다

/* ── 프레임 ── */
const frames = new Array(M.n);
for (let i = 0; i < M.n; i++) {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => { frames[i] = im; if (i === 0 || i === cur) draw(); };
  im.src = `assets/shutter/f_${String(i).padStart(3, '0')}.webp`;
}

/* ── 배치 ── */
let vw = 0, vh = 0, dpr = 1, s = 1, ox = 0, oy = 0, fw = 0, fh = 0;
let p = 0, cur = 0, done = false, drag = null, raf = 0, anim = 0, muted = false;

function place(el, x, y, w, h) {
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
}
function layout() {
  vw = stage.clientWidth; vh = stage.clientHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  s = vh / M.h;                                   // 기본: 높이에 맞춘다
  if (M.w * s > vw) s = Math.max(vw / M.w, Math.min(s, vw / (M.w * (1 - 2 * CROP))));
  fw = M.w * s; fh = M.h * s; ox = (vw - fw) / 2; oy = (vh - fh) * 0.4;
  stage.classList.toggle('wide', vw / vh > 0.72);
  stage.classList.toggle('roomy', (vw - fw) / 2 > 240);   // 영상 양옆에 큰 글자를 놓을 자리가 있는가
  stage.style.setProperty('--half', fw / 2 + 'px');
  if (vw / vh > 0.72) { glow.width = 320; glow.height = Math.max(90, Math.round(320 * vh / vw)); }
  const u = fw / 480;
  place(sign, ox + SIGN.x * fw, oy + SIGN.y * fh, SIGN.w * fw, SIGN.h * fh);
  sign.style.fontSize = 13.5 * u + 'px';
  front.querySelectorAll('.sign-side').forEach(el => el.remove());
  for (let k = 1, n = 0; ox - (k - 1) * fw > 0 && n < SIDE_SIGNS.length; k++) {
    const sx = (k % 2 === 1 ? 1 - SIGN.x - SIGN.w : SIGN.x) * fw;   // 홀수 번째 스토어는 좌우를 뒤집어 그린다
    if (ox - k * fw + sx < 8) break;                                  // 간판이 화면에 다 들어올 때만 적는다
    for (const dir of [-1, 1]) {
      const el = document.createElement('div');
      el.className = 'sign sign-side'; el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `<b>${SIDE_SIGNS[n][0]}</b><span>${SIDE_SIGNS[n][1]}</span>`;
      place(el, ox + dir * k * fw + sx, oy + SIGN.y * fh, SIGN.w * fw, SIGN.h * fh);
      el.style.fontSize = 13.5 * u + 'px';
      front.insertBefore(el, sign); n++;
    }
  }
  const hx = ox + M.hole.x0 * s, hw = (M.hole.x1 - M.hole.x0) * s;
  const ht = oy + SLAT_TOP * fh, hb = oy + M.hole.yb * s;
  place(slat, hx, ht, hw, hb - ht);
  slatCopy.style.fontSize = 66 * u + 'px';
  front.style.transformOrigin = `${hx + hw / 2}px ${(oy + M.edges[M.n - 1] * s + hb) / 2}px`;
  draw();
}

/* ── 그리기 ── */
function drawFrame(im, x, mirror) {
  cx.save();
  if (mirror) { cx.translate(x + fw, 0); cx.scale(-1, 1); x = 0; }
  cx.drawImage(im, x, oy, fw + 0.6, fh);
  if (oy > 0.5) cx.drawImage(im, 0, 1, im.naturalWidth, 1, x, 0, fw + 0.6, oy + 1);                 // 위: 벽을 이어 붙인다
  const below = vh - (oy + fh);
  if (below > 0.5) cx.drawImage(im, 0, im.naturalHeight - 2, im.naturalWidth, 1, x, oy + fh - 1, fw + 0.6, below + 1); // 아래: 길을 이어 붙인다
  cx.restore();
}
function draw() {
  const i = Math.round(p * (M.n - 1)); cur = i;
  let im = frames[i];
  for (let k = i; !im && k >= 0; k--) im = frames[k];
  if (!im) return;
  const f0 = frames[0] || im;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, vw, vh);
  if (ox > 0.5) {                                  // 넓은 화면: 양옆에 닫힌 가게를 이어 세운다
    for (let k = 1; ox - (k - 1) * fw > 0; k++) {
      drawFrame(f0, ox - k * fw, k % 2 === 1);
      drawFrame(f0, ox + k * fw, k % 2 === 1);
    }
    cx.fillStyle = 'rgba(14,21,36,.28)';       // 양옆은 살짝만 눌러 가운데가 먼저 보이게 한다
    cx.fillRect(0, 0, ox, vh); cx.fillRect(ox + fw, 0, vw - ox - fw, vh);
  }
  drawFrame(im, ox, false);
  const e = M.edges[i];
  if (e < M.edges[0] - 2) {                        // 열린 만큼 구멍을 뚫어 뒤의 영상을 보인다
    const hx = ox + M.hole.x0 * s, hw = (M.hole.x1 - M.hole.x0) * s, hy = oy + e * s, hh = (M.hole.yb - e) * s;
    cx.clearRect(hx, hy, hw, hh);
    const sh = Math.min(hh, 70 * s);
    const g = cx.createLinearGradient(0, hy, 0, hy + sh);
    g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(hx, hy, hw, sh);
  }
  slatCopy.style.transform = `translateY(${-(M.edges[0] - e) * s}px)`;   // 글자는 셔터에 붙어 같이 올라간다
  pullWrap.style.opacity = String(Math.max(0, 1 - p * 3));
}

/* ── 움직임 ── */
const easeOut = t => 1 - Math.pow(1 - t, 3);
function setP(v) {
  p = Math.min(1, Math.max(0, v));
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); });
}
function tween(to, ms, then) {
  cancelAnimationFrame(anim);
  const from = p, t0 = performance.now();
  const step = now => {
    const t = Math.min(1, (now - t0) / ms);
    setP(from + (to - from) * easeOut(t));
    if (t < 1) anim = requestAnimationFrame(step); else if (then) then();
  };
  anim = requestAnimationFrame(step);
}

let primed = false;
function prime() {                         // 손이 닿는 순간 영상을 미리 깨워 둔다. 손을 뗄 때 음악이 바로 나오게 하기 위해서다
  if (primed || done) return;
  primed = true;
  video.muted = true;
  const pr = video.play();
  if (pr) pr.then(() => { if (!done) { video.pause(); video.currentTime = 0; } }, () => {});
}
stage.addEventListener('pointerdown', e => {
  if (!done) prime();
  if (done || e.target.closest('button')) return;
  cancelAnimationFrame(anim);
  drag = { y: e.clientY, p, moved: false };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (!drag) return;
  const dy = drag.y - e.clientY;
  if (Math.abs(dy) > 4) drag.moved = true;
  setP(drag.p + dy / (vh * 0.4));
});
function release() {
  if (!drag) return;
  const moved = drag.moved; drag = null;
  if (done) return;
  if (p > OPEN_AT) open();
  else if (!moved) tween(0.1, 160, () => tween(0, 380));   // 톡 치면 살짝 들썩인다
  else tween(0, 380);
}
// 손가락은 touchend 에서 받는다. 아이폰 사파리가 소리 재생을 허락하는 동작이 touchend 이기 때문이다
stage.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') release(); });
stage.addEventListener('touchend', release);
stage.addEventListener('pointercancel', () => { if (drag) { drag = null; if (!done) tween(0, 380); } });
pull.addEventListener('click', () => { if (!done) open(); });
stage.addEventListener('wheel', e => {
  if (done) return;
  e.preventDefault();
  setP(p + e.deltaY / 900);
  if (p >= 1) open();
}, { passive: false });
addEventListener('keydown', e => { if (!done && e.key === 'ArrowUp') { e.preventDefault(); open(); } });

/* ── 열림 ── */
let watch = 0, blobUrl = '';
function askTap(text) { tap.textContent = text; tap.hidden = false; }
function play() {
  tap.hidden = true;
  try { video.currentTime = 0; } catch (e) {}
  video.muted = muted;
  const pr = video.play();
  if (pr) pr.catch(() => {               // 소리가 막힌 경우: 소리 없이 재생하고, 한 번 눌러 켜게 한다
    muted = true; video.muted = true; syncSound(true);
    video.play().then(() => askTap('눌러서 소리 켜기'), () => askTap('눌러서 영상과 소리 켜기'));
  });
  clearTimeout(watch);                   // 재생이 시작되지 않은 경우(아이폰 등): 눌러서 시작하게 한다
  watch = setTimeout(() => { if (done && video.currentTime < 0.05) askTap('눌러서 영상과 소리 켜기'); }, 1500);
}
function open() {
  done = true; cut = -1;
  cancelAnimationFrame(anim);
  play();
  top.hidden = false; say.hidden = false;
  tween(1, 240 + 360 * (1 - p), enter);
}
function enter() {                        // 가게 안으로 들어간다
  if (reduce) {
    front.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).onfinish = () => { front.hidden = true; };
    return;
  }
  const hw = (M.hole.x1 - M.hole.x0) * s, hh = (M.hole.yb - M.edges[M.n - 1]) * s;
  const z = Math.max(vw / hw, vh / hh) * 1.08;
  front.animate(
    [{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${z})`, opacity: 1, offset: 0.8 }, { transform: `scale(${z * 1.1})`, opacity: 0 }],
    { duration: 620, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' }
  ).onfinish = () => { front.hidden = true; };
}

/* ── 쇼릴 ── */
function showTitle() { title.hidden = false; stage.classList.add('titled'); }
function hideTitle() { title.hidden = true; stage.classList.remove('titled'); }
let cut = -1;
function word() {                          // 지금 컷에 맞는 낱말을 왼쪽에 박는다
  const t = video.currentTime;
  let i = 0;
  while (i + 1 < R.cuts.length && R.cuts[i + 1][0] <= t + 0.02) i++;
  if (i === cut) return;
  cut = i;
  sayL.textContent = i === R.cuts.length - 1 ? LAST_WORD : WORDS[R.cuts[i][1]];
  sayL.classList.remove('is-in'); void sayL.offsetWidth; sayL.classList.add('is-in');
}
function tick() {
  if (video.paused || video.ended) return;
  if (done && title.hidden && video.currentTime >= TITLE_AT) showTitle();
  if (done) word();
  if (stage.classList.contains('wide') && video.videoWidth) {   // 넓은 화면: 같은 영상을 화면 가득 깔아 배경으로 쓴다
    const sh = video.videoWidth * glow.height / glow.width;
    gx.drawImage(video, 0, (video.videoHeight - sh) * 0.42, video.videoWidth, sh, 0, 0, glow.width, glow.height);
  }
  requestAnimationFrame(tick);
}
video.addEventListener('play', () => requestAnimationFrame(tick));
video.addEventListener('ended', () => { if (done && title.hidden) showTitle(); });

function syncSound(nudge) {
  sound.textContent = muted ? '소리 켜기' : '소리 끄기';
  sound.setAttribute('aria-pressed', String(!muted));
  sound.classList.toggle('is-nudge', !!nudge && muted);
}
sound.addEventListener('click', () => { muted = !muted; video.muted = muted; syncSound(); });
$('replay').addEventListener('click', () => { hideTitle(); cut = -1; play(); });
tap.addEventListener('click', () => {    // 누르는 동작은 어느 브라우저에서나 소리 재생이 허락된다
  if (blobUrl && video.src !== blobUrl && video.currentTime < 0.05) video.src = blobUrl;
  muted = false; syncSound(); hideTitle(); cut = -1;
  play();
});
$('reset').addEventListener('click', () => {
  video.pause(); video.currentTime = 0;
  hideTitle(); top.hidden = true; say.hidden = true; tap.hidden = true; cut = -1; clearTimeout(watch);
  front.getAnimations().forEach(a => a.cancel());
  front.hidden = false; done = false;
  setP(0);
});

// 영상을 통째로 받아 둔다. 아이폰은 서버가 부분 전송을 지원하지 않으면 영상을 재생하지 못하기 때문이다
fetch('assets/showreel.mp4').then(r => r.ok ? r.blob() : Promise.reject()).then(b => {
  blobUrl = URL.createObjectURL(new Blob([b], { type: 'video/mp4' }));
  if (!done) video.src = blobUrl;
}).catch(() => {});
video.addEventListener('error', () => {  // 받아 둔 영상을 쓸 수 없는 환경이면 원래 주소로 돌아간다
  if (blobUrl && video.src === blobUrl) { blobUrl = ''; video.src = 'assets/showreel.mp4'; }
});

addEventListener('resize', layout);
layout();
})();
