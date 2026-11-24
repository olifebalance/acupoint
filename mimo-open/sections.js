/* MIMO — 첫 화면 아래의 화면들: 작업물, 맡기는 방법, 미모 소개, 문의 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 소리 설정은 첫 화면의 "소리 끄기/켜기" 단추를 따른다 */
let muted = true;
document.addEventListener('mimo:sound', e => { muted = e.detail.muted; syncWorks(); });

/* 영상은 통째로 받아서 튼다(아이폰 대비). 안 되면 원래 주소로 튼다 */
function load(el, url) {
  if (el.dataset.asked) return;
  el.dataset.asked = '1';
  fetch(url).then(r => r.ok ? r.blob() : Promise.reject()).then(b => {
    el.addEventListener('error', () => { if (el.src.startsWith('blob:')) el.src = url; }, { once: true });
    el.src = URL.createObjectURL(new Blob([b], { type: 'video/mp4' }));
  }).catch(() => { el.src = url; });
}
function start(v, wantSound) {
  v.muted = !wantSound;
  const pr = v.play();
  if (pr) pr.catch(() => { v.muted = true; v.play().catch(() => {}); });
}

/* ───── 작업물 ─────
   영상 태그는 하나만 쓰고 작품이 바뀔 때 주소만 갈아 끼운다.
   폰은 "누르는 동작으로 한 번 허락받은 영상 태그"에만 소리를 허락하기 때문에, 태그가 작품마다 따로면 소리가 났다 안 났다 한다. */
// 작품을 바꾸려면 이 목록과 assets/works/ 의 파일을 바꾼다
const WORKS = [
  { id: 'burger', title: '한입의 상상', cat: '음식 · 제품 광고', by: '버거스테이지' },
  { id: 'andz', title: '새로운 시즌의 시작', cat: '패션 · 스토어 오픈', by: 'ANDZ' },
  { id: 'bakery', title: '빵이 건네는 온기', cat: '베이커리 · 브랜드 영상', by: '밤가시베이커리' },
  { id: 'book', title: '책에서, 일상으로', cat: '협업 브랜드 · 도서 소개', by: '오라이프밸런스' },
  { id: 'wuxia', title: '상상이 장면이 될 때', cat: '무협 · 스토리 영상', by: '창작 콘셉트' },
];
const works = $('works'), pin = $('worksPin'), stack = $('worksStack'), edge = $('worksEdge'), bg = $('worksBg'), tapSound = $('worksSound');
const N = WORKS.length;
works.style.setProperty('--n', N);
const src = w => `assets/works/${w.id}.mp4`, still = w => `assets/works/${w.id}.webp`;
const blobs = {};                                  // 통째로 받아 둔 작품(아이폰 대비)
function fetchWork(i) {
  const w = WORKS[i];
  if (!w || w.asked) return;
  w.asked = true;
  fetch(src(w)).then(r => r.ok ? r.blob() : Promise.reject())
    .then(b => { blobs[w.id] = URL.createObjectURL(new Blob([b], { type: 'video/mp4' })); }).catch(() => {});
}
const wv = document.createElement('video');
wv.setAttribute('playsinline', ''); wv.playsInline = true; wv.loop = true; wv.preload = 'auto';
wv.addEventListener('error', () => { const w = WORKS[active]; if (w && wv.src.startsWith('blob:')) { delete blobs[w.id]; wv.src = src(w); playWork(); } });
const layers = WORKS.map((w, i) => {
  const el = document.createElement('div');
  el.className = 'work'; el.style.zIndex = N - i;
  el.innerHTML = `<img src="${still(w)}" alt="" loading="lazy"><canvas hidden></canvas>`;
  stack.appendChild(el);
  $('workTicks').appendChild(document.createElement('i'));
  return { el, freeze: el.lastChild };
});
let active = -1, inView = false, wraf = 0, blocked = false;

function playWork() {
  if (active < 0) return;
  if (!inView) { wv.pause(); return; }
  wv.muted = muted || blocked;
  const pr = wv.play();
  if (pr) pr.catch(() => {
    if (wv.muted) return;
    blocked = true; wv.muted = true; tapSound.hidden = false;      // 소리가 막혔다: 소리 없이 틀고, 한 번 눌러 켜게 한다
    wv.play().catch(() => {});
  });
}
function syncWorks() {                              // 소리 단추가 바뀌었을 때
  if (!muted) { blocked = false; tapSound.hidden = true; }
  if (active >= 0 && inView) playWork(); else wv.muted = muted;
}
tapSound.addEventListener('click', () => { blocked = false; tapSound.hidden = true; wv.muted = muted; playWork(); });
document.addEventListener('mimo:open', () => {     // 셔터를 여는 동작 안에서 영상 태그를 미리 허락받아 둔다
  if (!wv.src) wv.src = src(WORKS[0]);
  wv.muted = false;
  const pr = wv.play(); wv.pause();
  if (pr) pr.catch(() => {});
  fetchWork(0);
});
function setActive(i) {
  if (i === active) return;
  const prev = layers[active];
  if (prev && wv.readyState >= 2 && wv.videoWidth) {               // 나가는 작품은 마지막 장면으로 멈춰 둔다
    const c = prev.freeze;
    c.width = wv.videoWidth; c.height = wv.videoHeight;
    c.getContext('2d').drawImage(wv, 0, 0, c.width, c.height);
    c.hidden = false;
  }
  active = i;
  const w = WORKS[i], l = layers[i];
  l.freeze.hidden = true;
  wv.poster = still(w); wv.src = blobs[w.id] || src(w);
  l.el.appendChild(wv);
  $('workNo').textContent = String(i + 1).padStart(2, '0');
  $('workTitle').textContent = w.title;
  $('workMeta').textContent = `${w.cat} · ${w.by}`;
  bg.style.backgroundImage = `url(${still(w)})`;
  [...$('workTicks').children].forEach((t, k) => t.classList.toggle('is-on', k === i));
  const ui = pin.querySelector('.works-ui');
  if (!reduce) { ui.classList.remove('is-in'); void ui.offsetWidth; ui.classList.add('is-in'); }
  fetchWork(i + 1); fetchWork(i - 1);              // 옆 작품을 미리 받아 둔다
  playWork();
}
function onScroll() {
  wraf = 0;
  const r = works.getBoundingClientRect(), vh = innerHeight;
  const total = r.height - vh;
  const f = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) * (N - 1) : 0;
  let moving = -1;
  layers.forEach((l, i) => {                       // i 번째 작품은 셔터처럼 위로 걷히며 아래 작품을 보여 준다
    const up = Math.min(1, Math.max(0, f - i));
    l.el.style.clipPath = up > 0 ? `inset(0 0 ${up * 100}% 0)` : '';
    l.el.style.visibility = up >= 1 ? 'hidden' : '';
    if (up > 0 && up < 1) moving = up;
  });
  edge.style.opacity = moving < 0 ? 0 : 1;
  if (moving >= 0) edge.style.transform = `translateY(${(1 - moving) * pin.clientHeight}px)`;
  const nowIn = r.top < vh * 0.6 && r.bottom > vh * 0.4;
  const was = inView; inView = nowIn;
  if (nowIn) fetchWork(0);
  const before = active;
  setActive(Math.round(f));
  if (was !== nowIn && before === active) playWork();
}
// 스크롤이 작품과 작품 사이에서 멈추면 한 작품에 딱 맞게 옮긴다
let snapT = 0, touching = false, dir = 0, lastY = scrollY;
function snap() {
  if (touching) return;
  const r = works.getBoundingClientRect(), vh = innerHeight;
  if (r.top > 0 || r.bottom < vh) return;                 // 작품 화면이 고정되어 있는 동안만
  const per = (r.height - vh) / (N - 1), f = -r.top / per, part = f - Math.floor(f);
  // 조금만 넘겨도 넘기려던 쪽으로 간다
  const to = dir > 0 && part > 0.14 ? Math.ceil(f) : dir < 0 && part < 0.86 ? Math.floor(f) : Math.round(f);
  if (Math.abs(f - to) > 0.01) scrollTo({ top: scrollY + r.top + to * per, behavior: reduce ? 'auto' : 'smooth' });
}
addEventListener('touchstart', () => { touching = true; clearTimeout(snapT); }, { passive: true });
addEventListener('touchend', () => { touching = false; clearTimeout(snapT); snapT = setTimeout(snap, 140); }, { passive: true });
const req = () => {
  dir = Math.sign(scrollY - lastY) || dir; lastY = scrollY;
  if (!wraf) wraf = requestAnimationFrame(onScroll);
  clearTimeout(snapT); snapT = setTimeout(snap, 140);
};
addEventListener('scroll', req, { passive: true });
addEventListener('resize', req);
onScroll();

/* ───── 견적서 ───── */
const SHEETS = {
  film: { title: '광고 영상 · 릴스', sub: '제품의 매력을 짧고 선명하게',
    basis: '영상 길이 · 장면 수 · 생성 및 편집 범위 · 자막과 음성 · 화면 비율',
    files: '협의한 해상도·비율의 최종 영상. 추가 비율과 편집 원본은 별도 협의합니다.' },
  page: { title: '상세페이지 · 제품 이미지', sub: '궁금한 정보를, 구매로 이어지게',
    basis: '제품 수 · 페이지 분량 · 촬영 자료 유무 · 합성 및 이미지 제작 범위',
    files: '협의한 크기의 최종 이미지. 문구 작성과 원본 파일 범위는 사전에 정합니다.' },
  store: { title: '스토어 콘텐츠 · 메뉴판', sub: '매일 만나는 브랜드의 인상',
    basis: '품목과 시안 수 · 문구 분량 · 게시 또는 인쇄 규격 · 제공 자료 상태',
    files: '선택한 채널에 맞는 최종 파일. 인쇄용 파일은 사양을 확인한 뒤 안내합니다.' },
};
const sheet = $('sheet');
function showSheet(k) {
  const s = SHEETS[k];
  $('sheetTitle').textContent = s.title; $('sheetSub').textContent = s.sub;
  $('sheetBasis').textContent = s.basis; $('sheetFiles').textContent = s.files;
  document.querySelectorAll('.est-tab').forEach(t => {
    const on = t.dataset.k === k;
    t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on));
  });
  if (!reduce) { sheet.classList.remove('is-in'); void sheet.offsetWidth; sheet.classList.add('is-in'); }
}
document.querySelectorAll('.est-tab').forEach(t => t.addEventListener('click', () => showSheet(t.dataset.k)));
showSheet('film');

/* ───── 미모 소개: 이음의 현재 사이트와 같은 순서. 인사 → 질문 → 손짓(손끝에서 케이크 영상) ───── */
const film = $('mimoFilm'), mv = $('mimoVideo'), cake = $('cake'), cv = $('cakeVideo'), cap = $('mimoCap'), offer = $('mimoOffer');
const clip = n => `assets/mimo/mimo-${n}.mp4`;
const STEPS = [
  { clip: 'welcome', cap: 'Welcome.', lead: 1.5, voice: true },                 // lead: 목소리가 시작되는 지점으로 건너뛴다
  { clip: 'question', cap: 'What can I do for you?', lead: 0.9, voice: true },
  { clip: 'hand', cap: '', lead: 0, voice: false },
];
const HAND_CONTACT = 2.0, HAND_PLAY = 2.65;   // 손끝이 닿는 시각, 케이크가 재생되는 시각(초)
let step = 0, now = 'idle', seen = false, hraf = 0;

function stopCake() { cancelAnimationFrame(hraf); cv.pause(); cake.hidden = true; cake.classList.remove('is-on'); }
function idle() {
  now = 'idle'; cap.textContent = '';
  mv.loop = true; mv.src = clip('idle'); start(mv, false);
}
function act(i) {
  const st = STEPS[i]; step = (i + 1) % STEPS.length; now = st.clip;
  stopCake(); offer.classList.remove('is-on'); cap.textContent = st.cap;
  mv.loop = false; mv.src = clip(st.clip);
  if (st.lead) mv.addEventListener('loadedmetadata', () => { try { mv.currentTime = st.lead; } catch (e) {} }, { once: true });
  start(mv, st.voice && !muted);
  if (st.clip === 'hand') {
    load(cv, 'assets/mimo/cake.mp4');
    if (cv.currentSrc) { cv.muted = false; const pr = cv.play(); cv.pause(); if (pr) pr.catch(() => {}); }   // 누른 김에 케이크 소리도 허락받는다
    watchHand();
  }
}
function watchHand() {                      // 손끝이 닿으면 창이 열리고, 이어서 케이크 영상이 나온다
  cancelAnimationFrame(hraf);
  const tick = () => {
    if (now !== 'hand') return;
    if (mv.currentTime >= HAND_CONTACT && cake.hidden) { cake.hidden = false; void cake.offsetWidth; cake.classList.add('is-on'); }
    if (mv.currentTime >= HAND_PLAY) {
      mv.pause();                           // 케이크가 나오는 동안 미모는 손짓한 채로 멈춘다(한 번에 영상 하나)
      const go = () => {
        if (now !== 'hand') return;
        if (!cv.currentSrc) { hraf = requestAnimationFrame(go); return; }   // 케이크 영상을 아직 받는 중이면 기다린다
        try { cv.currentTime = 0; } catch (e) {}
        start(cv, !muted);
      };
      go();
      return;
    }
    hraf = requestAnimationFrame(tick);
  };
  hraf = requestAnimationFrame(tick);
}
mv.addEventListener('ended', () => {
  if (now === 'question') offer.classList.add('is-on');
  if (now === 'hand') return;               // 손짓은 케이크가 끝난 뒤에 돌아간다
  idle();
});
cv.addEventListener('ended', () => { stopCake(); idle(); });
cv.addEventListener('error', () => { if (!cv.src.startsWith('blob:') && now === 'hand') { stopCake(); idle(); } });
$('mimoTouch').addEventListener('click', () => act(step));
document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => act(+b.dataset.step)));
new IntersectionObserver(es => {
  if (es[0].isIntersecting) { if (!seen) { seen = true; idle(); load(cv, 'assets/mimo/cake.mp4'); } else if (now === 'idle' && mv.paused) start(mv, false); }
  else { mv.pause(); cv.pause(); }
}, { threshold: 0.3 }).observe(film);

/* ───── 문의: 내용을 정리하고 복사만 한다. 보내지 않는다 ───── */
const ask = $('ask'), out = $('askOut'), text = $('askText');
ask.addEventListener('submit', e => {
  e.preventDefault();
  const kinds = [...ask.querySelectorAll('input[name=kind]:checked')].map(i => i.value);
  const lines = [
    '[MIMO 제작 문의]',
    `필요한 작업: ${kinds.length ? kinds.join(', ') : '아직 정하지 않았어요'}`,
    `사용할 곳: ${$('place').value || '아직 정하지 않았어요'}`,
    `희망 일정: ${$('when').value || '아직 정하지 않았어요'}`,
    '',
    '스토어와 만들고 싶은 이야기:',
    $('story').value.trim() || '(상담하면서 말씀드릴게요)',
  ];
  text.textContent = lines.join('\n');
  out.hidden = false;
  out.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
});
$('askCopy').addEventListener('click', () => {
  const done = () => { $('askCopy').textContent = '복사했어요'; setTimeout(() => { $('askCopy').textContent = '문의 내용 복사'; }, 1800); };
  const pick = () => { const r = document.createRange(); r.selectNodeContents(text); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('askCopy').textContent = '선택했어요. 길게 눌러 복사하세요'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text.textContent).then(done, pick); else pick();
});

/* 화면 안 이동 */
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = document.getElementById(a.getAttribute('href').slice(1));
  if (!t) return;
  e.preventDefault();
  t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}));
})();
