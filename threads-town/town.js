// 스친 마을: 위에서 내려다보는 마을을 작은 손님이 걸어 다닌다.
// 가고 싶은 집을 누르면 길을 따라 걸어가고, 문 앞에 서면 소개 카드가 열린다.
(() => {
  const { HOUSES, DECOR } = window.TOWN_ART;
  const RESIDENTS = window.RESIDENTS;
  const $ = (s, r = document) => r.querySelector(s);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ───── 마을 지도 ─────
     집은 모두 아래(남쪽)를 보고 선다. 집 앞 40 아래에 길이 지나간다.
     자리가 모자라면 SLOTS에 줄을 더하고 ROADS를 늘리면 마을이 바깥으로 커진다. */
  const W = 2300, H = 1400, ROAD = 40;
  const SLOTS = {
    A1: [330, 430], A2: [600, 430], A4: [1140, 430], A5: [1410, 430],
    B1: [300, 800], B2: [540, 800], center: [870, 800], B3: [1200, 800], B4: [1440, 800],
    C1: [330, 1170], C2: [560, 1170], C3: [870, 1170], C4: [1180, 1170], C5: [1410, 1170],
    temple: [2000, 770],
  };
  const SLOT_NAME = { center: '한가운데', temple: '동쪽 쉼터', A1: '윗길 1호', A2: '윗길 2호', A4: '윗길 3호', A5: '윗길 4호', B1: '가운뎃길 1호', B2: '가운뎃길 2호', B3: '가운뎃길 3호', B4: '가운뎃길 4호', C1: '아랫길 1호', C2: '아랫길 2호', C3: '아랫길 3호', C4: '아랫길 4호', C5: '아랫길 5호' };
  // 길: [x1, y1, x2, y2] (가로 또는 세로 직선)
  const ROADS = [
    [170, 470, 1600, 470], [170, 840, 2000, 840], [170, 1210, 1600, 1210],
    [170, 470, 170, 1210], [1600, 470, 1600, 1210], [700, 470, 700, 1210], [1040, 470, 1040, 1210],
  ];

  const lots = Object.keys(SLOTS).map((slot) => {
    const [x, y] = SLOTS[slot];
    const r = RESIDENTS.find((q) => q.slot === slot) || null;
    const roadY = slot === 'temple' ? 840 : y + ROAD;
    return { slot, x, y, r, door: [x, roadY], w: slot === 'center' ? 300 : slot === 'temple' ? 300 : 200 };
  });

  /* ───── 길 그래프: 교차점과 문 앞을 점으로, 길을 따라 이웃한 점끼리 잇는다 ───── */
  const nodes = [], edges = [];
  const nodeAt = (x, y) => { let n = nodes.find((p) => Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1); if (!n) { n = { x, y, id: nodes.length, adj: [] }; nodes.push(n); } return n; };
  ROADS.forEach(([x1, y1, x2, y2]) => {
    const horiz = y1 === y2;
    const pts = [[x1, y1], [x2, y2]];
    ROADS.forEach(([a1, b1, a2, b2]) => { // 다른 길과 만나는 곳
      if (horiz && a1 === a2 && a1 >= x1 && a1 <= x2 && y1 >= b1 && y1 <= b2) pts.push([a1, y1]);
      if (!horiz && b1 === b2 && b1 >= y1 && b1 <= y2 && x1 >= a1 && x1 <= a2) pts.push([x1, b1]);
    });
    if (horiz) lots.forEach((l) => { if (l.door[1] === y1 && l.door[0] >= x1 && l.door[0] <= x2) pts.push(l.door); });
    const sorted = pts.map(([x, y]) => nodeAt(x, y)).sort((p, q) => (horiz ? p.x - q.x : p.y - q.y));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (a === b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      a.adj.push([b, d]); b.adj.push([a, d]); edges.push([a, b]);
    }
  });
  const project = (px, py) => { // 가장 가까운 길 위의 점
    let best = null;
    edges.forEach(([a, b]) => {
      const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      const x = a.x + dx * t, y = a.y + dy * t, d = Math.hypot(px - x, py - y);
      if (!best || d < best.d) best = { x, y, d, a, b };
    });
    return best;
  };
  function route(from, to) { // 길을 따라가는 가장 짧은 경로 (점 목록)
    const s = project(from[0], from[1]), e = project(to[0], to[1]);
    if ((s.a === e.a && s.b === e.b) || (s.a === e.b && s.b === e.a)) return [[s.x, s.y], [e.x, e.y]];
    const dist = new Map(), prev = new Map(), todo = new Set(nodes);
    nodes.forEach((n) => dist.set(n, Infinity));
    [s.a, s.b].forEach((n) => dist.set(n, Math.hypot(n.x - s.x, n.y - s.y)));
    while (todo.size) {
      let u = null;
      todo.forEach((n) => { if (!u || dist.get(n) < dist.get(u)) u = n; });
      todo.delete(u);
      u.adj.forEach(([v, d]) => { if (dist.get(u) + d < dist.get(v)) { dist.set(v, dist.get(u) + d); prev.set(v, u); } });
    }
    const endN = dist.get(e.a) + Math.hypot(e.a.x - e.x, e.a.y - e.y) <= dist.get(e.b) + Math.hypot(e.b.x - e.x, e.b.y - e.y) ? e.a : e.b;
    const path = [[e.x, e.y]];
    for (let n = endN; n; n = prev.get(n)) path.unshift([n.x, n.y]);
    path.unshift([s.x, s.y]);
    return path;
  }

  /* ───── 그리기 ───── */
  const svg = $('#town');
  const at = (x, y, inner, o = '') => `<g transform="translate(${x} ${y})" ${o}>${inner}</g>`;
  let ground = `<rect x="-600" y="-600" width="${W + 1200}" height="${H + 1200}" fill="#dbe7c3"/>`;
  // 풀밭 얼룩
  [[420, 250, 300, 90], [1250, 640, 260, 80], [520, 1010, 320, 90], [1500, 1330, 300, 70], [1900, 420, 260, 110], [2080, 1080, 240, 120], [80, 760, 120, 260]].forEach(([x, y, rx, ry]) => { ground += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#cfdfb2"/>`; });
  // 쉼터 마당
  ground += `<ellipse cx="2000" cy="800" rx="300" ry="250" fill="#e9e2cc"/><ellipse cx="2000" cy="800" rx="284" ry="236" fill="none" stroke="#cdbf9c" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>`;
  // 길: 어두운 테두리를 먼저, 밝은 길을 위에
  const roadPath = ROADS.map(([x1, y1, x2, y2]) => `M${x1} ${y1} L${x2} ${y2}`).join(' ') + lots.map((l) => ` M${l.x} ${l.y - 4} L${l.door[0]} ${l.door[1]}`).join('');
  ground += `<path d="${roadPath}" fill="none" stroke="#cbbd9a" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/><path d="${roadPath}" fill="none" stroke="#f4ecd8" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>`;
  ground += `<path d="${ROADS.map(([x1, y1, x2, y2]) => `M${x1} ${y1} L${x2} ${y2}`).join(' ')}" fill="none" stroke="#e2d6b8" stroke-width="3" stroke-dasharray="14 18" stroke-linecap="round"/>`;
  ground += at(1770, 930, DECOR.pond()) + at(870, 300, DECOR.fountain());

  // 세워 놓는 것들: 집과 꾸밈. y(발 위치)가 클수록 앞에 그린다.
  const things = [];
  lots.forEach((l) => {
    const kind = l.r ? l.r.house : 'vacant';
    const label = l.r ? `${l.r.name} 방문하기` : `빈 터 ${SLOT_NAME[l.slot]} 입점 안내 보기`;
    things.push({ y: l.y, html: at(l.x, l.y, HOUSES[kind]() + `<rect x="${-l.w / 2 - 10}" y="-200" width="${l.w + 20}" height="216" fill="transparent"/>`, `class="lot" data-slot="${l.slot}" tabindex="0" role="button" aria-label="${label}"`) });
  });
  const put = (x, y, html) => things.push({ y, html: at(x, y, html) });
  put(870, 398, DECOR.welcome());
  [[130, 390, 1.1], [1700, 380, 1.2], [110, 1010, 1], [1690, 1090, 1.1], [1000, 250, 0.9], [740, 250, 0.9], [220, 1330, 1.1], [1010, 1350, 1]].forEach(([x, y, s], i) => put(x, y, DECOR.tree(s, i % 2 ? '#8fbb6a' : '#7fae5e')));
  [[250, 520], [1500, 520], [640, 900], [1110, 900], [1300, 1270], [480, 1270], [90, 620], [1680, 700]].forEach(([x, y], i) => put(x, y, i % 3 === 0 ? DECOR.flowers(['#ff9aa2', '#ffd166', '#b8a5e3'][i % 3]) : DECOR.bush(i % 2 ? '#9cc57a' : '#8fbb6a')));
  [[760, 520], [980, 520], [760, 900], [980, 900], [452, 1262], [1480, 890]].forEach(([x, y]) => put(x, y, DECOR.lamp()));
  // 쉼터: 소나무, 석등, 탑, 긴 의자
  [[1800, 660, 1.2], [2190, 700, 1.3], [2150, 980, 1.1], [1850, 560, 1]].forEach(([x, y, s]) => put(x, y, DECOR.pine(s)));
  put(1890, 800, DECOR.stoneLamp()); put(2110, 800, DECOR.stoneLamp()); put(2090, 950, DECOR.pagoda()); put(1900, 1000, DECOR.bench()); put(2010, 1010, DECOR.bench());
  things.sort((a, b) => a.y - b.y);

  svg.innerHTML = `<defs><linearGradient id="t-iris" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#57e3d0"/><stop offset=".5" stop-color="#8b7cf6"/><stop offset="1" stop-color="#ff7ab8"/></linearGradient></defs>`
    + `<g id="ground">${ground}</g><g id="marker"></g><g id="things">${things.map((t) => t.html).join('')}</g>`;
  const thingsG = $('#things'), thingEls = [...thingsG.children];
  const marker = $('#marker');

  /* ───── 손님 캐릭터 ───── */
  const NS = 'http://www.w3.org/2000/svg';
  const me = document.createElementNS(NS, 'g');
  me.setAttribute('id', 'me');
  const drawMe = (color, name) => {
    me.innerHTML = `<ellipse cx="0" cy="2" rx="15" ry="5" fill="rgba(60,50,30,.22)"/>`
      + `<g class="legs"><rect class="leg l" x="-9" y="-13" width="7" height="14" rx="3" fill="#3d4650"/><rect class="leg r" x="2" y="-13" width="7" height="14" rx="3" fill="#3d4650"/></g>`
      + `<g class="body"><rect x="-13" y="-38" width="26" height="28" rx="10" fill="${color}"/><circle cx="0" cy="-48" r="13" fill="#ffe0bd"/><path d="M-13 -50 a13 13 0 0 1 26 0 q-13 -8 -26 0Z" fill="#4a3728"/>`
      + `<circle cx="-4.5" cy="-47" r="1.7" fill="#3d4650"/><circle cx="4.5" cy="-47" r="1.7" fill="#3d4650"/></g>`
      + `<g transform="translate(0 -74)"><rect x="${-(name.length * 7 + 12)}" y="-11" width="${name.length * 14 + 24}" height="22" rx="11" fill="#fff" stroke="#3d4650" stroke-width="2"/><text x="0" y="0.5" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="800" fill="#3d4650">${name.replace(/[<&>]/g, '')}</text></g>`;
  };
  thingsG.appendChild(me);
  const pos = { x: 870, y: 842 };
  let path = [], goal = null, walking = false, faceLeft = false, step = 0;
  const placeMe = () => {
    me.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`);
    // 발 위치가 더 아래인 것 앞에 끼워 넣어, 집 뒤로 가면 가려지게 한다
    const before = thingEls[things.findIndex((t) => t.y > pos.y)] || null;
    if (me.nextSibling !== before) thingsG.insertBefore(me, before);
  };

  /* ───── 화면(카메라) ───── */
  const cam = { x: 870, y: 752, w: 1000, overview: false };
  const viewW = () => (cam.overview ? Math.max(W + 120, (H + 160) * (innerWidth / innerHeight)) : clamp(innerWidth * 0.82, 680, 1250));
  function frame(now) {
    const vw = viewW(), vh = vw * (innerHeight / innerWidth);
    const tx = cam.overview ? W / 2 : pos.x, ty = cam.overview ? H / 2 + 20 : pos.y - 90;
    const k = RM ? 1 : 0.12;
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.w += (vw - cam.w) * k;
    const h = cam.w * (innerHeight / innerWidth);
    svg.setAttribute('viewBox', `${(cam.x - cam.w / 2).toFixed(1)} ${(cam.y - h / 2).toFixed(1)} ${cam.w.toFixed(1)} ${h.toFixed(1)}`);
  }

  /* ───── 걷기 ───── */
  const SPEED = 230; // 1초에 가는 거리
  const keys = new Set();
  const blocked = (x, y) => x < 40 || x > W - 40 || y < 120 || y > H - 40 || lots.some((l) => Math.abs(x - l.x) < l.w / 2 + 12 && y > l.y - 76 && y < l.y + 6);
  function walkTo(target, lot) {
    path = route([pos.x, pos.y], target);
    goal = lot || null;
    marker.innerHTML = `<g transform="translate(${target[0]} ${target[1]})"><ellipse rx="20" ry="8" fill="none" stroke="#ff7a59" stroke-width="4"/><ellipse rx="7" ry="3" fill="#ff7a59"/></g>`;
    hint.done();
  }
  function arrive() {
    marker.innerHTML = '';
    if (goal) { const l = goal; goal = null; openCard(l); }
  }
  let last = performance.now(), near = null;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let moved = false;
    const kx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    const ky = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    if ((kx || ky) && !dialog.open) {
      path = []; goal = null; marker.innerHTML = '';
      const n = Math.hypot(kx, ky), dx = (kx / n) * SPEED * dt, dy = (ky / n) * SPEED * dt;
      if (!blocked(pos.x + dx, pos.y)) { pos.x += dx; moved = true; }
      if (!blocked(pos.x, pos.y + dy)) { pos.y += dy; moved = true; }
      if (kx) faceLeft = kx < 0;
    } else if (path.length) {
      let left = SPEED * dt;
      while (left > 0 && path.length) {
        const [tx, ty] = path[0], d = Math.hypot(tx - pos.x, ty - pos.y);
        if (d <= left) { pos.x = tx; pos.y = ty; left -= d; path.shift(); }
        else { if (Math.abs(tx - pos.x) > 1) faceLeft = tx < pos.x; pos.x += ((tx - pos.x) / d) * left; pos.y += ((ty - pos.y) / d) * left; left = 0; }
      }
      moved = true;
      if (!path.length) arrive();
    }
    if (moved !== walking) { walking = moved; me.classList.toggle('walking', walking && !RM); }
    me.querySelector('.body')?.setAttribute('transform', faceLeft ? 'scale(-1 1)' : '');
    placeMe();
    // 가까운 문 앞이면 "방문하기" 버튼을 띄운다
    let best = null;
    lots.forEach((l) => { const d = Math.hypot(l.door[0] - pos.x, l.door[1] - pos.y); if (d < 70 && (!best || d < best.d)) best = { l, d }; });
    const n = best ? best.l : null;
    if (n !== near) {
      near = n;
      visitBtn.hidden = !n;
      if (n) visitBtn.textContent = n.r ? `${n.r.name} 방문하기` : '빈 터 둘러보기';
    }
    frame(now);
    requestAnimationFrame(tick);
  }

  /* ───── 누르기 ───── */
  const toWorld = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
  const lotOf = (el) => { const g = el.closest?.('.lot'); return g ? lots.find((l) => l.slot === g.dataset.slot) : null; };
  let down = null;
  svg.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  svg.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 12) return;
    const lot = lotOf(e.target);
    if (cam.overview) setOverview(false);
    if (lot) walkTo(lot.door, lot); else walkTo(toWorld(e), null);
  });
  svg.addEventListener('keydown', (e) => {
    const lot = lotOf(e.target);
    if (lot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (cam.overview) setOverview(false); walkTo(lot.door, lot); }
  });
  addEventListener('keydown', (e) => {
    if (e.target.matches?.('input,textarea')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); if (k.startsWith('Arrow')) e.preventDefault(); hint.done(); }
    if (k === 'Enter' && near && !dialog.open && document.activeElement === document.body) openCard(near);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => keys.clear());

  /* ───── 화면 위 버튼들 ───── */
  const hintN = $('#hint');
  const hint = { done() { hintN.classList.add('gone'); } };
  const visitBtn = $('#visit');
  visitBtn.addEventListener('click', () => { if (near) openCard(near); });
  const mapBtn = $('#map');
  function setOverview(on) { cam.overview = on; mapBtn.textContent = on ? '내 자리로' : '마을 전체 보기'; mapBtn.setAttribute('aria-pressed', on); }
  mapBtn.addEventListener('click', () => setOverview(!cam.overview));
  const filled = lots.filter((l) => l.r).length;
  $('#count').textContent = `입점 ${filled}곳 · 빈 터 ${lots.length - filled}곳`;

  /* ───── 소개 카드 ───── */
  const dialog = $('#card');
  function openCard(l) {
    $('#c-addr').textContent = `스친 마을 · ${SLOT_NAME[l.slot]}`;
    const go = $('#c-go');
    if (l.r) {
      $('#c-name').textContent = l.r.name;
      $('#c-handle').textContent = `@${l.r.handle}`;
      $('#c-intro').textContent = l.r.intro;
      go.href = l.r.link || `https://www.threads.com/@${l.r.handle}`;
      go.textContent = l.r.linkLabel || '스레드 보러 가기';
      go.hidden = false;
      dialog.style.setProperty('--c', l.r.color);
    } else {
      $('#c-name').textContent = '빈 터';
      $('#c-handle').textContent = '';
      $('#c-intro').textContent = '이 자리는 아직 비어 있어요.\n입점은 미모에게 물어보세요.';
      go.hidden = true;
      dialog.style.setProperty('--c', '#ff7a59');
    }
    keys.clear();
    dialog.showModal();
  }
  $('#c-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  /* ───── 들어오기: 닉네임과 옷 색 (이 기기에만 저장) ───── */
  const COLORS = ['#ff7a59', '#3f7fd1', '#5fb28a', '#e58fb0', '#8b7cf6', '#f2b93b'];
  const gate = $('#gate'), nameIn = $('#g-name'), swatches = $('#g-colors');
  let color = store.get('town-color') || COLORS[0];
  swatches.innerHTML = COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''}><span style="background:${c}"></span><b class="sr">옷 색 ${c}</b></label>`).join('');
  nameIn.value = store.get('town-name') || '';
  const enter = (name) => { drawMe(color, name); placeMe(); };
  $('#g-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (nameIn.value.trim() || '손님').slice(0, 8);
    color = new FormData(e.target).get('color') || color;
    store.set('town-name', name); store.set('town-color', color);
    enter(name);
    gate.close();
  });
  $('#rename').addEventListener('click', () => gate.showModal());
  enter(store.get('town-name') || '손님');
  if (!store.get('town-name') && !new URLSearchParams(location.search).has('skip')) gate.showModal();

  window.__town = { pos, lots, walkTo, route, cam, setOverview, nodes };
  requestAnimationFrame(tick);
})();
