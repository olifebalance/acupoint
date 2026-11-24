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

/* ───── 작업물 ───── */
// 작품을 바꾸려면 이 목록과 assets/works/ 의 파일을 바꾼다
const WORKS = [
  { id: 'burger', title: '한입의 상상', cat: '음식 · 제품 광고', by: '버거스테이지' },
  { id: 'andz', title: '새로운 시즌의 시작', cat: '패션 · 스토어 오픈', by: 'ANDZ' },
  { id: 'bakery', title: '빵이 건네는 온기', cat: '베이커리 · 브랜드 영상', by: '밤가시베이커리' },
  { id: 'book', title: '책에서, 일상으로', cat: '협업 브랜드 · 도서 소개', by: '오라이프밸런스' },
  { id: 'wuxia', title: '상상이 장면이 될 때', cat: '무협 · 스토리 영상', by: '창작 콘셉트' },
];
const works = $('works'), pin = $('worksPin'), stack = $('worksStack'), edge = $('worksEdge'), bg = $('worksBg');
const N = WORKS.length;
works.style.setProperty('--n', N);
const layers = WORKS.map((w, i) => {
  const el = document.createElement('div');
  el.className = 'work'; el.style.zIndex = N - i;
  el.innerHTML = `<video poster="assets/works/${w.id}.webp" playsinline loop preload="none" aria-label="${w.title}"></video>`;
  stack.appendChild(el);
  $('workTicks').appendChild(document.createElement('i'));
  return { el, v: el.firstChild, url: `assets/works/${w.id}.mp4` };
});
let active = -1, inView = false, wraf = 0;

function syncWorks() {
  layers.forEach((l, i) => {
    if (inView && i === active) {
      load(l.v, l.url);
      if (l.v.paused || l.v.muted !== muted) start(l.v, !muted);
    } else if (!l.v.paused) l.v.pause();
  });
}
function setActive(i) {
  if (i === active) return;
  active = i;
  const w = WORKS[i];
  $('workNo').textContent = String(i + 1).padStart(2, '0');
  $('workTitle').textContent = w.title;
  $('workMeta').textContent = `${w.cat} · ${w.by}`;
  bg.style.backgroundImage = `url(assets/works/${w.id}.webp)`;
  [...$('workTicks').children].forEach((t, k) => t.classList.toggle('is-on', k === i));
  const ui = pin.querySelector('.works-ui');
  if (!reduce) { ui.classList.remove('is-in'); void ui.offsetWidth; ui.classList.add('is-in'); }
  if (layers[i + 1]) load(layers[i + 1].v, layers[i + 1].url);   // 다음 작품을 미리 받아 둔다
  syncWorks();
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
  if (nowIn !== inView) { inView = nowIn; syncWorks(); }
  setActive(Math.round(f));
}
const req = () => { if (!wraf) wraf = requestAnimationFrame(onScroll); };
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

/* ───── 미모 소개 ───── */
const mv = $('mimoVideo');
const clip = n => `assets/mimo/mimo-${n}.mp4`;
function idle() { mv.loop = true; mv.src = clip('idle'); start(mv, false); }
new IntersectionObserver(es => {
  if (es[0].isIntersecting) { if (!mv.currentSrc) idle(); else if (mv.paused) start(mv, mv.loop ? false : !mv.muted); }
  else mv.pause();
}, { threshold: 0.3 }).observe(mv);
document.querySelectorAll('[data-clip]').forEach(b => b.addEventListener('click', () => {
  mv.loop = false; mv.src = clip(b.dataset.clip);
  start(mv, b.dataset.clip === 'welcome');       // 인사만 목소리가 있다
}));
mv.addEventListener('ended', idle);

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
