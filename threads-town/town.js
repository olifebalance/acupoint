// 스친 마을: 위에서 내려다보는 마을을 작은 손님이 걸어 다닌다.
// 가고 싶은 집을 누르면 길을 따라 걸어가고, 문 앞에 서면 소개 카드가 열린다.
(() => {
  const { HOUSES, DECOR, lightsOf } = window.TOWN_ART;
  const RESIDENTS = window.RESIDENTS;
  const $ = (s, r = document) => r.querySelector(s);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ───── 마을 지도 ─────
     집은 모두 아래(남쪽)를 보고 선다. 집 앞 40 아래에 길이 지나간다.
     자리가 모자라면 SLOTS에 줄을 더하고 ROADS를 늘리면 마을이 바깥으로 커진다. */
  const COLS = 9, ROWS = 8, GX = 300, GY = 430, DX = 250, DY = 370, ROAD = 40;
  const W = 3520, H = 3220;
  const cx = (i) => GX + i * DX, cy = (j) => GY + j * DY;
  const MC = 4, MR = 3;                       // 미모 집: 가운데 칸
  const MIMO = [cx(MC), cy(MR)], PLAZA = [cx(MC), cy(MR - 1)], TEMPLE = [2800, 1510], CAFE = [3230, 1510];
  const L_X = 170, R_X = 2430, V1 = 925, V2 = 1675;   // 세로 길
  // 길: [x1, y1, x2, y2] (가로 또는 세로 직선). 가운뎃줄 길은 동쪽 쉼터까지 이어진다.
  const ROADS = [];
  for (let j = 0; j < ROWS; j++) ROADS.push([L_X, cy(j) + ROAD, j === MR ? CAFE[0] : R_X, cy(j) + ROAD]);
  [L_X, V1, V2, R_X].forEach((x) => ROADS.push([x, cy(0) + ROAD, x, cy(ROWS - 1) + ROAD]));
  const TERRACE = [CAFE[0], cy(MR) + ROAD + 120];           // 카페 앞마당: 길에서 짧은 길이 이어진다
  ROADS.push([CAFE[0], cy(MR) + ROAD, CAFE[0], cy(MR) + ROAD + 200]);

  // 자리: 미모 집에서 가까운 칸부터 목록 순서대로 채운다 (같은 줄을 조금 더 가깝게 친다)
  const cells = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if ((i === MC && j === MR) || (i === MC && j === MR - 1)) continue;
    cells.push({ slot: `r${j + 1}c${i + 1}`, x: cx(i), y: cy(j), name: `${j + 1}번길 ${i + 1}호`, d: Math.hypot(cx(i) - MIMO[0], (cy(j) - MIMO[1]) * 1.2) });
  }
  cells.sort((a, b) => a.d - b.d);
  const SLOT_NAME = { center: '한가운데', temple: '동쪽 쉼터', cafe: '쉼터 옆 카페' };
  const special = (house) => RESIDENTS.find((q) => q.house === house) || null;
  const others = RESIDENTS.filter((q) => q.house !== 'mimo' && q.house !== 'temple' && q.house !== 'cafe');
  const lots = [
    { slot: 'center', x: MIMO[0], y: MIMO[1], r: special('mimo'), door: [MIMO[0], MIMO[1] + ROAD], w: 280 },
    { slot: 'temple', x: TEMPLE[0], y: TEMPLE[1], r: special('temple'), door: [TEMPLE[0], cy(MR) + ROAD], w: 300 },
    { slot: 'cafe', x: CAFE[0], y: CAFE[1], r: special('cafe'), door: [CAFE[0], cy(MR) + ROAD], w: 250 },
    ...cells.map((c, k) => { SLOT_NAME[c.slot] = c.name; return { slot: c.slot, x: c.x, y: c.y, r: others[k] || null, door: [c.x, c.y + ROAD], w: 200 }; }),
  ];

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
  let seed = 7;
  const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + ((seed - 1) / 2147483646) * (b - a); };
  let ground = `<rect x="-3000" y="-3000" width="${W + 6000}" height="${H + 6000}" fill="#e6dcb6"/>`;
  // 풀밭 얼룩
  for (let k = 0; k < 22; k++) ground += `<ellipse cx="${rnd(0, W).toFixed(0)}" cy="${rnd(120, H).toFixed(0)}" rx="${rnd(180, 320).toFixed(0)}" ry="${rnd(70, 120).toFixed(0)}" fill="#dbcf9f"/>`;
  // 쉼터 마당
  ground += `<ellipse cx="${TEMPLE[0]}" cy="${TEMPLE[1] + 30}" rx="300" ry="250" fill="#e9e2cc"/><ellipse cx="${TEMPLE[0]}" cy="${TEMPLE[1] + 30}" rx="284" ry="236" fill="none" stroke="#cdbf9c" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>`;
  // 카페 앞마당
  ground += `<ellipse cx="${TERRACE[0]}" cy="${TERRACE[1]}" rx="215" ry="150" fill="#efe4cc"/><ellipse cx="${TERRACE[0]}" cy="${TERRACE[1]}" rx="200" ry="137" fill="none" stroke="#cdbf9c" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>`;
  // 길: 어두운 테두리를 먼저, 밝은 길을 위에
  const roadLines = ROADS.map(([x1, y1, x2, y2]) => `M${x1} ${y1} L${x2} ${y2}`).join(' ');
  const roadPath = roadLines + lots.map((l) => ` M${l.x} ${l.y - 4} L${l.door[0]} ${l.door[1]}`).join('');
  ground += `<path d="${roadPath}" fill="none" stroke="#cbbd9a" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/><path d="${roadPath}" fill="none" stroke="#f4ecd8" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>`;
  ground += `<path d="${roadLines}" fill="none" stroke="#e2d6b8" stroke-width="3" stroke-dasharray="14 18" stroke-linecap="round"/>`;
  ground += at(TEMPLE[0] - 230, TEMPLE[1] + 160, DECOR.pond()) + at(PLAZA[0], PLAZA[1] - 130, DECOR.fountain());
  // 늦가을: 바닥 여기저기에 떨어진 낙엽
  const FALL = ['#e0843a', '#d9a13a', '#c9562f', '#e3b23c', '#b9742e'];
  const fall = () => FALL[Math.floor(rnd(0, 4.999))];
  for (let k = 0; k < 260; k++) { const x = rnd(40, W - 40).toFixed(0), y = rnd(140, H - 30).toFixed(0); ground += `<path transform="translate(${x} ${y}) rotate(${rnd(0, 360).toFixed(0)})" d="M-7 0 q7 -8 14 0 q-7 8 -14 0Z" fill="${fall()}" opacity=".85"/>`; }

  // 세워 놓는 것들: 집과 꾸밈. y(발 위치)가 클수록 앞에 그린다.
  const things = [], lightItems = [];
  const light = (x, y, kind) => { const h = lightsOf(kind); if (h) lightItems.push({ x, y, html: at(x, y, h) }); };
  lots.forEach((l) => {
    const kind = l.r ? (l.r.house || 'kit') : 'vacant';
    const label = l.r ? `${l.r.name} 방문하기` : `빈 터 ${SLOT_NAME[l.slot]} 보기`;
    light(l.x, l.y, kind);
    things.push({ x: l.x, y: l.y, html: at(l.x, l.y, HOUSES[kind](l.r) + `<rect x="${-l.w / 2 - 10}" y="-200" width="${l.w + 20}" height="216" fill="transparent"/>`, `class="lot" data-slot="${l.slot}" tabindex="0" role="button" aria-label="${label.replace(/"/g, '')}"`) });
  });
  const put = (x, y, html) => things.push({ x, y, html: at(x, y, html) });
  put(PLAZA[0], PLAZA[1] - 32, DECOR.welcome());
  // 마을 둘레의 나무: 단풍과 은행 빛깔, 발치에는 낙엽 더미
  const fallTree = (x, y, s) => { put(x, y, DECOR.tree(s, fall())); if (rnd(0, 1) < 0.65) put(x + rnd(-28, 28), y + rnd(4, 14), DECOR.leaves(Math.floor(rnd(0, 9)))); };
  for (let x = 120; x < R_X + 120; x += 190) { fallTree(x + rnd(-40, 40), 300 + rnd(-50, 20), rnd(0.9, 1.25)); fallTree(x + rnd(-40, 40), H - 60 + rnd(-30, 20), rnd(0.9, 1.2)); }
  for (let y = 520; y < H - 200; y += 230) { fallTree(70 + rnd(-20, 20), y + rnd(-40, 40), rnd(0.9, 1.2)); if (Math.abs(y - (cy(MR) + ROAD)) > 260) fallTree(R_X + 100 + rnd(-20, 30), y + rnd(-40, 40), rnd(0.9, 1.2)); }
  for (let k = 0; k < 14; k++) put(rnd(100, R_X + 60), [300, H - 110][k % 2] + rnd(20, 70), k % 2 ? DECOR.bush(k % 4 === 1 ? '#c9a24a' : '#b8863a') : DECOR.leaves(k));
  // 가로등: 세로 길과 가로 길이 만나는 모퉁이마다
  for (let j = 0; j < ROWS; j++) [V1 + 58, V2 + 58].forEach((x) => { const y = cy(j) + ROAD + 52; put(x, y, DECOR.lamp()); light(x, y, 'lamp'); });
  // 쉼터: 소나무, 석등, 탑, 긴 의자
  [[-200, -110, 1.2], [190, -70, 1.3], [150, 210, 1.1], [-150, -210, 1]].forEach(([dx, dy, s]) => put(TEMPLE[0] + dx, TEMPLE[1] + dy, DECOR.pine(s)));
  [[-110, 30], [110, 30]].forEach(([dx, dy]) => { put(TEMPLE[0] + dx, TEMPLE[1] + dy, DECOR.stoneLamp()); light(TEMPLE[0] + dx, TEMPLE[1] + dy, 'stoneLamp'); });
  // 미모 카페 앞마당: 파라솔 탁자와 나무
  [[-135, -32, '#E7FC66'], [135, -32, '#ff7a59'], [-112, 78, '#ff7a59'], [118, 82, '#E7FC66']].forEach(([dx, dy, c]) => { put(TERRACE[0] + dx, TERRACE[1] + dy, DECOR.table(c)); light(TERRACE[0] + dx, TERRACE[1] + dy, 'table'); });
  put(TERRACE[0] + 52, TERRACE[1] - 62, DECOR.lamp()); light(TERRACE[0] + 52, TERRACE[1] - 62, 'lamp');
  fallTree(CAFE[0] + 235, CAFE[1] - 40, 1.15); fallTree(CAFE[0] + 250, TERRACE[1] + 150, 1.05); fallTree(CAFE[0] - 190, TERRACE[1] + 200, 1.1);
  put(TEMPLE[0] + 90, TEMPLE[1] + 180, DECOR.pagoda()); put(TEMPLE[0] - 100, TEMPLE[1] + 230, DECOR.bench()); put(TEMPLE[0] + 10, TEMPLE[1] + 240, DECOR.bench());
  things.sort((a, b) => a.y - b.y);
  const lights = lightItems.map((l) => l.html).join('');

  svg.innerHTML = `<defs><linearGradient id="t-iris" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#57e3d0"/><stop offset=".5" stop-color="#8b7cf6"/><stop offset="1" stop-color="#ff7ab8"/></linearGradient><radialGradient id="t-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>`
    + `<g id="ground">${ground}</g><g id="snowground" opacity="0" pointer-events="none"><rect x="-3000" y="-3000" width="${W + 6000}" height="${H + 6000}" fill="#c9d4e3" opacity=".62"/><path d="${roadPath}" fill="none" stroke="#ffffff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/></g><g id="marker"></g><g id="things">${things.map((t) => t.html).join('')}</g>`
    + `<g id="snowmenG" pointer-events="none"></g><g id="balls" pointer-events="none"></g><rect id="dark" x="-3000" y="-3000" width="${W + 6000}" height="${H + 6000}" fill="#0d1746" opacity="0" pointer-events="none"/><g id="lights" opacity="0" pointer-events="none">${lights}</g>`;
  const thingsG = $('#things'), thingEls = [...thingsG.children];
  const lightEls = [...$('#lights').children];
  const shown = new Map(); // 화면 밖의 집과 불빛은 그리지 않는다
  const marker = $('#marker');

  /* ───── 손님 캐릭터 ───── */
  const NS = 'http://www.w3.org/2000/svg';
  const me = document.createElementNS(NS, 'g');
  me.setAttribute('id', 'me');
  const esc = (t) => String(t).replace(/[<&>"]/g, '');
  const HAIR = {
    m: 'M-13 -50 a13 13 0 0 1 26 0 q-13 -8 -26 0Z',
    f: 'M-14 -34 q-3 -30 14 -29 q17 -1 14 29 q-3 -4 -4 -14 q-10 -9 -20 0 q-1 10 -4 14Z',
  };
  /** 손님 한 명의 그림. 나와 다른 손님이 같이 쓴다. */
  const charHTML = (color, name, look, mine) => `<ellipse cx="0" cy="2" rx="15" ry="5" fill="rgba(60,50,30,.22)"/>`
    + `<g class="legs"><rect class="leg l" x="-9" y="-13" width="7" height="14" rx="3" fill="#3d4650"/><rect class="leg r" x="2" y="-13" width="7" height="14" rx="3" fill="#3d4650"/></g>`
    + `<g class="body"><rect class="arm" x="9" y="-37" width="7" height="17" rx="3.5" fill="${esc(color)}"/><rect x="-13" y="-38" width="26" height="28" rx="10" fill="${esc(color)}"/><circle cx="0" cy="-48" r="13" fill="#ffe0bd"/><path d="${HAIR[look] || HAIR.m}" fill="#4a3728"/>`
    + `<circle cx="-4.5" cy="-47" r="1.7" fill="#3d4650"/><circle cx="4.5" cy="-47" r="1.7" fill="#3d4650"/></g>`
    + `<g transform="translate(0 -74)"><rect x="${-(name.length * 7 + 12)}" y="-11" width="${name.length * 14 + 24}" height="22" rx="11" fill="${mine ? '#fff' : '#fffbe6'}" stroke="#3d4650" stroke-width="2"/><text x="0" y="0.5" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="800" fill="#3d4650">${esc(name)}</text></g>`;
  const drawMe = (color, name, look) => { me.innerHTML = charHTML(color, name, look, true); };
  const placeChar = (el, x, y) => {
    el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    // 발 위치가 더 아래인 것 앞에 끼워 넣어, 집 뒤로 가면 가려지게 한다
    const before = thingEls[things.findIndex((t) => t.y > y)] || null;
    // 같은 자리에 손님이 여럿 서 있으면 서로를 건너뛰고 비교한다.
    // (매 프레임 다시 끼워 넣으면 손 흔들기 같은 움직임이 처음으로 되돌아가 멈춰 보인다)
    let next = el.nextSibling;
    while (next && next !== before && (next.id === 'me' || next.classList.contains('peer') || next.classList.contains('npc'))) next = next.nextSibling;
    if (next !== before) thingsG.insertBefore(el, before);
  };
  thingsG.appendChild(me);
  const pos = { x: MIMO[0], y: MIMO[1] + ROAD + 2 };
  let path = [], goal = null, walking = false, faceLeft = false, step = 0;
  const placeMe = () => placeChar(me, pos.x, pos.y);

  /* ───── 화면(카메라) ───── */
  const cam = { x: MIMO[0], y: MIMO[1] - 48, w: 1000, overview: false };
  const viewW = () => (cam.overview ? Math.max(W + 120, (H + 160) * (innerWidth / innerHeight)) : clamp(innerWidth * 0.82, 680, 1250));
  function frame(now) {
    const vw = viewW(), vh = vw * (innerHeight / innerWidth);
    const tx = cam.overview ? W / 2 : pos.x, ty = cam.overview ? H / 2 + 20 : pos.y - 90;
    const k = RM ? 1 : 0.12;
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.w += (vw - cam.w) * k;
    const h = cam.w * (innerHeight / innerWidth);
    svg.setAttribute('viewBox', `${(cam.x - cam.w / 2).toFixed(1)} ${(cam.y - h / 2).toFixed(1)} ${cam.w.toFixed(1)} ${h.toFixed(1)}`);
    const cull = (el, x, y) => {
      const on = Math.abs(x - cam.x) < cam.w / 2 + 280 && y > cam.y - h / 2 - 60 && y < cam.y + h / 2 + 300;
      if (shown.get(el) !== on) { shown.set(el, on); el.style.display = on ? '' : 'none'; }
    };
    things.forEach((t, i) => cull(thingEls[i], t.x, t.y));
    lightItems.forEach((l, i) => cull(lightEls[i], l.x, l.y));
  }

  /* ───── 걷기 ───── */
  const SPEED = 230; // 1초에 가는 거리
  const keys = new Set();
  const blocked = (x, y) => x < 40 || x > W - 40 || y < 120 || y > H - 40 || lots.some((l) => Math.abs(x - l.x) < l.w / 2 + 12 && y > l.y - 76 && y < l.y + 6);
  function walkTo(target, lot, keepHug) {
    path = route([pos.x, pos.y], target);
    if (!keepHug) { hugTarget = null; hugging = false; } // 다른 곳을 누르면 안아주러 가던 걸 멈춘다
    goal = lot || null;
    marker.innerHTML = `<g transform="translate(${target[0]} ${target[1]})"><ellipse rx="20" ry="8" fill="none" stroke="#ff7a59" stroke-width="4"/><ellipse rx="7" ry="3" fill="#ff7a59"/></g>`;
    hint.done();
  }
  function arrive() {
    marker.innerHTML = '';
    if (hugTarget) { const t = hugTarget; hugTarget = null; doHug(t); }
    if (goal) { const l = goal; goal = null; openCard(l); }
  }
  // 밤: 마을 위에 어두운 막을 덮고, 그 위에 창문·가로등 불빛을 켠다
  const darkEl = $('#dark'), lightsEl = $('#lights');
  let night = 0, nightTarget = 0;
  let last = performance.now(), near = null;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let moved = false;
    const kx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    const ky = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    if ((kx || ky) && !dialog.open) {
      path = []; goal = null; marker.innerHTML = ''; hugTarget = null; hugging = false;
      const n = Math.hypot(kx, ky), dx = (kx / n) * SPEED * dt, dy = (ky / n) * SPEED * dt;
      if (!blocked(pos.x + dx, pos.y)) { pos.x += dx; moved = true; }
      if (!blocked(pos.x, pos.y + dy)) { pos.y += dy; moved = true; }
      if (kx) faceLeft = kx < 0;
    } else if (path.length) {
      let left = SPEED * (hugTarget ? 2 : 1) * dt;
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
      showBuild();
    }
    if (Math.abs(nightTarget - night) > 0.001) {
      night = RM ? nightTarget : night + (nightTarget - night) * Math.min(1, dt * 1.6);
      darkEl.setAttribute('opacity', (night * 0.66).toFixed(3));
      lightsEl.setAttribute('opacity', clamp((night - 0.3) / 0.5, 0, 1).toFixed(3));
    }
    // 다른 손님들: 받은 위치로 부드럽게 따라간다
    peers.forEach((q) => {
      const d = Math.hypot(q.tx - q.x, q.ty - q.y);
      if (d > 600) { q.x = q.tx; q.y = q.ty; } else if (d > 0.5) { const k = Math.min(1, dt * 7); q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; }
      const moving = d > 3;
      if (moving !== q.moving) { q.moving = moving; q.el.classList.toggle('walking', moving && !RM); }
      placeChar(q.el, q.x, q.y);
    });
    // 내 위치 알리기: 움직이는 동안 0.25초마다, 멈추면 한 번 더
    snowTick(now);
    hugTick();
    if (net && (moved || tellSoon) && now - told > 250) { told = now; tellSoon = moved; tell(); }
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
  const nightBtn = $('#night');
  function setNight(on) { nightTarget = on ? 1 : 0; nightBtn.textContent = on ? '낮 보기' : '밤 보기'; nightBtn.setAttribute('aria-pressed', on); }
  nightBtn.addEventListener('click', () => setNight(!nightTarget));
  const mapBtn = $('#map');
  function setOverview(on) { cam.overview = on; mapBtn.textContent = on ? '내 자리로' : '전체 보기'; mapBtn.setAttribute('aria-pressed', on); }
  mapBtn.addEventListener('click', () => setOverview(!cam.overview));
  const filled = lots.filter((l) => l.r && !l.r.noHeart).length; // 카페 같은 쉼터는 세지 않는다

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
      cardLot = l; showHearts();
      if (net && !l.r.noHeart) net.visit(keyOf(l.r));
    } else {
      $('#c-name').textContent = '빈 터';
      $('#c-handle').textContent = '';
      $('#c-intro').textContent = '아직 준비 중인 자리예요.';
      go.hidden = true;
      dialog.style.setProperty('--c', '#ff7a59');
      cardLot = null; showHearts();
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
  let look = store.get('town-look') || 'f';
  document.querySelectorAll('#g-form input[name=look]').forEach((r) => { r.checked = r.value === look; });
  let myName = store.get('town-name') || '손님';
  const enter = (name) => { myName = name; drawMe(color, name, look); placeMe(); tellSoon = true; };
  $('#g-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (nameIn.value.trim() || '손님').slice(0, 8);
    const f = new FormData(e.target);
    color = f.get('color') || color; look = f.get('look') || look;
    store.set('town-name', name); store.set('town-color', color); store.set('town-look', look);
    enter(name);
    gate.close();
  });
  $('#rename').addEventListener('click', () => gate.showModal());

  /* ───── 출석: 이 기기에서 며칠째 들렀는지 (한국 시간 기준) ───── */
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() + 9 * 3600e3 - 864e5).toISOString().slice(0, 10);
  let days = { last: '', streak: 0, total: 0 };
  try { days = Object.assign(days, JSON.parse(store.get('town-days') || '{}')); } catch (e) {}
  if (days.last !== today) { days = { last: today, streak: days.last === yesterday ? days.streak + 1 : 1, total: days.total + 1 }; store.set('town-days', JSON.stringify(days)); }
  $('#count').textContent = `입점 ${filled}곳 · 출석 ${days.streak}일째`;

  /* ───── 손 흔들기 ───── */
  let waveAt = 0;
  // 손을 흔들면 팔이 움직이고 머리 위로 하트 세 개가 떠오른다 (인사 표시일 뿐, 집 하트와는 별개)
  const HEART = 'M0 9C-16 -2 -12 -14 -5 -14C-2 -14 0 -11 0 -9C0 -11 2 -14 5 -14C12 -14 16 -2 0 9Z';
  const puffHTML = (k) => `<g class="puff" pointer-events="none" transform="scale(${k})">` + [[0, 0], [-20, 0.22], [19, 0.44]].map(([dx, d]) => `<g transform="translate(${dx} -100)"><path class="h" d="${HEART}" fill="#ff5c8a" stroke="#fff" stroke-width="2.5" paint-order="stroke" style="animation-delay:${d}s"/></g>`).join('') + '</g>';
  const waveEl = (el) => {
    el.classList.remove('waving'); el.querySelectorAll('.puff').forEach((n) => n.remove()); void el.getBBox();
    el.classList.add('waving'); const svg = el.ownerSVGElement, k = Math.min(4, Math.max(1, svg.viewBox.baseVal.width / (svg.clientWidth || innerWidth) * 1.25));
    el.insertAdjacentHTML('beforeend', puffHTML(k.toFixed(2))); // 휴대폰이나 전체 보기처럼 화면이 작게 보일 때는 하트를 키운다
    clearTimeout(el._wave); el._wave = setTimeout(() => { el.classList.remove('waving'); el.querySelectorAll('.puff').forEach((n) => n.remove()); }, 2100);
  };
  $('#wave').addEventListener('click', () => { waveAt = Date.now(); waveEl(me); tellSoon = true; hint.done(); });

  /* ───── 늦가을: 화면 위에서 낙엽이 천천히 떨어진다 (움직임 줄이기 설정이면 넣지 않는다) ───── */
  const leavesEl = $('#leaves');
  if (leavesEl && !RM) leavesEl.innerHTML = Array.from({ length: innerWidth < 600 ? 9 : 16 }, (_, i) => `<i style="left:${(i * 61 + 7) % 100}%;--d:${10 + (i * 7) % 9}s;--w:-${(i * 13) % 17}s;--c:${FALL[i % 5]};--s:${13 + (i * 5) % 9}px"></i>`).join('');

  /* ───── 첫눈: 매일 밤 9시부터 10시까지(한국 시간) 눈이 내린다 ─────
     시계만 보고 정하므로 같은 시간에 들어온 사람은 모두 같은 눈을 본다.
     내리기 시작해 30분 동안 지붕과 길에 조금씩 쌓이고, 10시가 되면 10분 동안 녹는다.
     주소에 ?snow 를 붙이면 시간과 상관없이 눈을 볼 수 있다(?snow=0.5 처럼 쌓인 정도도 정할 수 있다). */
  const SNOW_FROM = 21, SNOW_MIN = 60;
  const snowEl = $('#snow'), snowTag = $('#snowtag'), snowGround = $('#snowground');
  // 지붕·나무·간판 윗면의 눈: 집 그림마다 한 번만 그림으로 떠서 맨 위 테두리만 흰 띠로 만든 뒤 겹쳐 둔다.
  // (매 화면 필터로 계산하면 휴대폰이 느려져서, 처음 눈이 올 때 한 번만 만든다)
  const CAP = { x: -230, y: -330, w: 460, h: 362, band: 9 };
  let capsBuilt = false;
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  async function buildCaps() {
    if (capsBuilt) return; capsBuilt = true;
    const cv = document.createElement('canvas'); cv.width = CAP.w; cv.height = CAP.h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const out = document.createElement('canvas'); out.width = CAP.w; out.height = CAP.h;
    const octx = out.getContext('2d');
    for (let i = 0; i < things.length; i++) {
      const el = thingEls[i];
      const src = `<svg xmlns="${NS}" width="${CAP.w}" height="${CAP.h}" viewBox="${CAP.x} ${CAP.y} ${CAP.w} ${CAP.h}">${el.innerHTML}</svg>`;
      const im = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src));
      if (!im) continue;
      try {
        ctx.clearRect(0, 0, CAP.w, CAP.h); ctx.drawImage(im, 0, 0);
        const a = ctx.getImageData(0, 0, CAP.w, CAP.h).data;
        const o = octx.createImageData(CAP.w, CAP.h), od = o.data;
        let any = false, x0 = CAP.w, y0 = CAP.h, x1 = -1, y1 = -1;
        for (let y = 0; y < CAP.h; y++) for (let x = 0; x < CAP.w; x++) {
          const k = (y * CAP.w + x) * 4;
          if (a[k + 3] < 140) continue;
          const inside = (yy) => yy >= 0 && a[(yy * CAP.w + x) * 4 + 3] >= 140;
          if (!inside(y - CAP.band)) { od[k] = od[k + 1] = od[k + 2] = 255; od[k + 3] = 250; any = true; }
          else if (!inside(y - CAP.band - 3)) { od[k] = 120; od[k + 1] = 138; od[k + 2] = 168; od[k + 3] = 120; }
          else continue;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (!any) continue;
        // 눈이 있는 부분만 잘라서 작은 그림으로 만든다(통째로 두면 휴대폰 메모리가 모자라 화면이 깜빡인다)
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        out.width = cw; out.height = ch;
        octx.putImageData(o, -x0, -y0, x0, y0, cw, ch);
        const cap = document.createElementNS(NS, 'image');
        cap.setAttribute('class', 'cap'); cap.setAttribute('pointer-events', 'none');
        cap.setAttribute('x', CAP.x + x0); cap.setAttribute('y', CAP.y + y0); cap.setAttribute('width', cw); cap.setAttribute('height', ch);
        cap.setAttribute('href', out.toDataURL());
        el.appendChild(cap);
      } catch (e) { return; } // 그림을 읽을 수 없는 브라우저면 지붕 눈은 건너뛴다(길의 눈과 내리는 눈은 그대로)
      if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
    }
  }
  // 겨울 마을: 눈이 늘 조금씩 내리고 쌓여 있다. 밤 9시부터 10시까지는 함박눈(눈송이가 많고 크다).
  // ?snow 를 붙이면 언제든 함박눈을 볼 수 있다.
  const snowParam = new URLSearchParams(location.search).get('snow');
  const flakes = (n, big) => Array.from({ length: n }, (_, i) => `<i style="left:${(i * 37 + 3) % 100}%;--d:${(big ? 6 : 9) + (i * 5) % 7}s;--w:-${(i * 11) % 13}s;--s:${(big ? 8 : 5) + (i * 3) % (big ? 8 : 5)}px;--x:${(i % 2 ? 1 : -1) * (2 + (i % 4))}vw"></i>`).join('');
  let snowState = '', snowFalling = false, heavyShown = null;
  function updateSnow() {
    const k = new Date(Date.now() + 9 * 3600e3);
    const m = k.getUTCHours() * 60 + k.getUTCMinutes() - SNOW_FROM * 60;
    const heavy = snowParam !== null || (m >= 0 && m < SNOW_MIN);
    const falling = true, amount = 1;
    if (snowEl && !RM && heavy !== heavyShown) { heavyShown = heavy; snowEl.innerHTML = heavy ? flakes(innerWidth < 600 ? 34 : 56, true) : flakes(innerWidth < 600 ? 14 : 22, false); }
    if (snowTag) snowTag.hidden = !heavy;
    const state = `${falling}|${amount.toFixed(2)}`;
    if (state === snowState) return;
    snowState = state;
    snowGround.setAttribute('opacity', amount.toFixed(2));
    thingsG.style.setProperty('--snow', Math.min(1, amount * 1.3).toFixed(2));
    if (amount > 0.02) buildCaps();
    if (snowEl) snowEl.hidden = !falling;
    if (leavesEl) leavesEl.hidden = true; // 겨울이라 낙엽은 날리지 않는다
    if (falling !== snowFalling) { snowFalling = falling; if (falling) snowballs = Math.max(snowballs, 1); showBalls(); showBuild(); }
  }

  /* ───── 눈싸움: 눈 오는 시간에만. 걸으면 눈덩이가 모이고(최대 3개), 가까운 손님에게 던진다 ─────
     점수나 순위는 없다. 맞은 사람 머리에 눈이 터지고, 맞은 사람 화면에는 누가 던졌는지 잠깐 뜬다. */
  const BALL_MAX = 3, BALL_WALK = 260, BALL_RANGE = 460;
  const throwBtn = $('#throw'), toastEl = $('#toast'), ballsG = $('#balls');
  let snowballs = 0, walked = 0, lastX = pos.x, lastY = pos.y;
  let throwAt = 0, throwX = 0, throwY = 0, throwTo = '';
  const flying = [];
  function showBalls() {
    throwBtn.hidden = !snowFalling;
    throwBtn.disabled = snowballs < 1;
    throwBtn.textContent = snowballs < 1 ? '걸으면 눈이 모여요' : `눈 던지기 ${'●'.repeat(snowballs)}${'○'.repeat(BALL_MAX - snowballs)}`;
  }
  let toastTimer = 0;
  function toast(text) { toastEl.textContent = text; toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600); }
  // 맞은 손님: 머리 위에 눈이 얹히고 몸이 흔들린다
  function hitChar(el) {
    if (!el) return;
    el.classList.remove('hit'); void el.getBBox(); el.classList.add('hit');
    el.querySelectorAll('.headsnow').forEach((n) => n.remove());
    el.insertAdjacentHTML('beforeend', '<g class="headsnow" pointer-events="none"><ellipse cx="0" cy="-60" rx="13" ry="6" fill="#fff" stroke="#9fb0c8" stroke-width="1.5"/><circle cx="-6" cy="-63" r="4" fill="#fff"/><circle cx="5" cy="-64" r="5" fill="#fff"/></g>');
    clearTimeout(el._hit); el._hit = setTimeout(() => { el.classList.remove('hit'); el.querySelectorAll('.headsnow').forEach((n) => n.remove()); }, 1800);
  }
  function launch(x0, y0, x1, y1, target) {
    const el = document.createElementNS(NS, 'g');
    el.innerHTML = '<ellipse class="sh" rx="7" ry="3" fill="rgba(60,70,90,.25)"/><circle class="b" r="10" fill="#fff" stroke="#7f95b5" stroke-width="2.5"/>';
    ballsG.appendChild(el);
    const dur = clamp(Math.hypot(x1 - x0, y1 - y0) * 1.5, 320, 760);
    flying.push({ el, x0, y0, x1, y1, t0: performance.now(), dur, target });
  }
  function splash(x, y) {
    const el = document.createElementNS(NS, 'g');
    el.setAttribute('transform', `translate(${x.toFixed(0)} ${y.toFixed(0)})`);
    el.innerHTML = [[-14, -6], [12, -10], [-4, -16], [16, 4], [-16, 6], [2, 8]].map(([dx, dy]) => `<circle cx="${dx}" cy="${dy - 30}" r="5" fill="#fff" stroke="#9fb0c8" stroke-width="1.2"/>`).join('');
    ballsG.appendChild(el);
    flying.push({ el, splash: true, t0: performance.now(), dur: 520 });
  }
  function snowTick(now) {
    if (snowFalling) {
      const dd = Math.hypot(pos.x - lastX, pos.y - lastY);
      if (dd < 200) walked += dd; // 순간이동(시험·재접속)은 세지 않는다
      if (walked >= BALL_WALK) { walked = 0; if (snowballs < BALL_MAX) { snowballs++; showBalls(); showBuild(); } }
    }
    lastX = pos.x; lastY = pos.y;
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i], t = Math.min(1, (now - f.t0) / f.dur);
      if (f.splash) { f.el.setAttribute('opacity', (1 - t).toFixed(2)); f.el.querySelectorAll('circle').forEach((c, k) => c.setAttribute('transform', `translate(${(t * 10 * Math.sign(+c.getAttribute('cx') || 1)).toFixed(1)} ${(t * 6).toFixed(1)})`)); }
      else {
        const x = f.x0 + (f.x1 - f.x0) * t, y = f.y0 + (f.y1 - f.y0) * t, lift = 34 + Math.sin(Math.PI * t) * 70;
        f.el.querySelector('.b').setAttribute('transform', `translate(${x.toFixed(1)} ${(y - lift).toFixed(1)})`);
        f.el.querySelector('.sh').setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      }
      if (t >= 1) {
        f.el.remove(); flying.splice(i, 1);
        if (!f.splash) { splash(f.x1, f.y1); hitChar(typeof f.target === 'function' ? f.target() : f.target); }
      }
    }
  }
  throwBtn.addEventListener('click', () => {
    if (!snowFalling || snowballs < 1) return;
    snowballs--; showBalls(); showBuild(); hint.done();
    // 가장 가까운 손님을 겨눈다. 없으면 바라보는 쪽 바닥으로.
    let best = null;
    peers.forEach((q, uid) => { const dd = Math.hypot(q.x - pos.x, q.y - pos.y); if (dd < BALL_RANGE && (!best || dd < best.d)) best = { q, uid, d: dd }; });
    const x1 = best ? best.q.x : clamp(pos.x + (faceLeft ? -170 : 170), 0, W), y1 = best ? best.q.y : pos.y;
    if (best) faceLeft = best.q.x < pos.x;
    throwAt = Date.now(); throwX = Math.round(x1); throwY = Math.round(y1); throwTo = best ? best.uid : '';
    launch(pos.x, pos.y, x1, y1, best ? best.q.el : null);
    tellSoon = true;
  });
  // 다른 손님이 던진 눈덩이
  function onPeerThrow(uid, q, d) {
    if (!(typeof d.s === 'number' && d.s && d.s !== q.s)) return;
    q.s = d.s;
    if (!snowFalling || Date.now() - d.s > 8000 || typeof d.sx !== 'number' || typeof d.sy !== 'number') return;
    const mine = net && d.su === net.uid;
    const target = mine ? me : (d.su && peers.get(d.su) ? peers.get(d.su).el : null);
    launch(q.x, q.y, mine ? pos.x : clamp(d.sx, 0, W), mine ? pos.y : clamp(d.sy, 0, H), target);
    if (mine) toast(`${String(d.n || '손님').slice(0, 8)}님이 눈을 던졌어요! ❄`);
  }
  showBalls();

  updateSnow();
  setInterval(updateSnow, 5000);

  /* ───── 함께: 다른 손님 보이기, 집마다 하트 (연결이 안 되면 혼자 다니는 마을 그대로) ───── */
  let net = null, told = 0, tellSoon = false;
  const peers = new Map();
  const tell = () => net.setPresence({ n: myName, c: color, g: look, x: Math.round(pos.x), y: Math.round(pos.y), f: faceLeft, w: waveAt, s: throwAt, sx: throwX, sy: throwY, su: throwTo, h: hugAt, hu: hugTo });
  const onlineEl = $('#online');
  const showOnline = () => { onlineEl.hidden = !net; if (net) onlineEl.textContent = `지금 ${peers.size + 1}명`; };
  function onPeer(uid, d) {
    let q = peers.get(uid);
    if (!d || typeof d.x !== 'number' || typeof d.y !== 'number') { if (q) { q.el.remove(); peers.delete(uid); showOnline(); } return; }
    if (!q) {
      if (peers.size >= 60) return; // 너무 많으면 더 그리지 않는다
      q = { el: document.createElementNS(NS, 'g'), x: d.x, y: d.y, tx: d.x, ty: d.y, w: d.w || 0, s: d.s || 0, h: d.h || 0, sig: '', moving: false };
      q.el.setAttribute('class', 'peer');
      q.el.setAttribute('pointer-events', 'none');
      peers.set(uid, q); showOnline();
    }
    const name = String(d.n || '손님').slice(0, 8), col = /^#[0-9a-f]{6}$/i.test(d.c) ? d.c : '#8a8f96', lk = d.g === 'm' ? 'm' : 'f';
    const sig = name + col + lk;
    if (sig !== q.sig) { q.sig = sig; q.el.innerHTML = charHTML(col, name, lk, false); }
    q.tx = clamp(d.x, 0, W); q.ty = clamp(d.y, 0, H);
    q.el.querySelector('.body')?.setAttribute('transform', d.f ? 'scale(-1 1)' : '');
    if (d.w && d.w !== q.w) { q.w = d.w; if (Date.now() - d.w < 8000) waveEl(q.el); }
    onPeerThrow(uid, q, d);
    onPeerHug(uid, q, d);
  }

  const TIERS = [10, 30, 100, 200]; // 200: 맞춤 업그레이드 대상(금빛 리본)
  const keyOf = (r) => r.handle.replace(/\./g, ',');
  let hearts = {}, cardLot = null;
  const perkEls = new Map();
  function showPerks() {
    lots.forEach((l) => {
      if (!l.r || l.r.noHeart) return;
      const n = hearts[keyOf(l.r)] || 0, tier = TIERS.filter((t) => n >= t).length;
      if ((perkEls.get(l.slot)?.tier || 0) === tier) return;
      let p = perkEls.get(l.slot);
      if (!p) { p = { g: document.createElementNS(NS, 'g'), tier: 0 }; p.g.setAttribute('pointer-events', 'none'); thingEls[things.findIndex((t) => t.x === l.x && t.y === l.y)].appendChild(p.g); perkEls.set(l.slot, p); }
      p.tier = tier; p.g.innerHTML = window.TOWN_ART.perks(tier, l.w);
      // 밤에는 전구와 별이 불빛으로 켜진다
      if (!p.l) { p.l = document.createElementNS(NS, 'g'); p.l.setAttribute('transform', `translate(${l.x} ${l.y})`); lightsEl.appendChild(p.l); }
      p.l.innerHTML = window.TOWN_ART.perkLights(tier, l.w);
    });
  }
  const heartBox = $('#c-hearts'), heartBtn = $('#c-heart'), heartNum = $('#c-heart-n'), cardNote = $('#c-note');
  function showHearts() {
    const on = !!(net && cardLot && !cardLot.r.noHeart); // 쉼터(카페)는 하트를 받지 않는다
    heartBox.hidden = !on;
    cardNote.hidden = !on;
    if (!on) return;
    const key = keyOf(cardLot.r), n = hearts[key] || 0;
    const v = visits[key] || 0, sm = liveSnowman(key);
    cardNote.textContent = [zombieNote(key), v ? `오늘 다녀간 손님 ${v}명` : '오늘 첫 손님이에요', sm ? `⛄ ${sm.n}님이 만든 눈사람이 있어요` : ''].filter(Boolean).join(' · ');
    const wait = Date.now() - net.lastGiven(key) < window.TownNet.COOLDOWN, left = net.heartsLeft();
    heartNum.textContent = `하트 ${n}개`;
    heartBtn.disabled = wait || left < 1;
    heartBtn.textContent = wait ? '오늘은 하트를 줬어요' : left < 1 ? '오늘 하트 5개를 다 줬어요' : `하트 주기 · 오늘 ${left}개 남음`;
  }
  heartBtn.addEventListener('click', async () => {
    if (!net || !cardLot) return;
    heartBtn.disabled = true;
    const res = await net.giveHeart(keyOf(cardLot.r));
    if (res === 'error') { heartBtn.textContent = '지금은 하트를 줄 수 없어요'; return; }
    if (res === 'ok' && net.heartsLeft() === 0) toast('오늘 하트를 다 줬어요. 내일 또 와요 💗');
    if (res === 'ok') cureHouse(cardLot);
    showHearts();
  });

  /* ───── 따뜻한 집: 하트를 받으면 그때부터 12시간 동안 연기가 피어오르고 창에 불이 켜진다 ─────
     하트를 못 받아도 낡지는 않는다. 그냥 조용한 집으로 있다. */
  const WARM_HOURS = 12;
  let warm = {}, visits = {}, snowmen = {};
  const warmEls = new Map();
  const thingOf = (l) => thingEls[things.findIndex((t) => t.x === l.x && t.y === l.y)];
  function showWarm() {
    const now = Date.now();
    lots.forEach((l) => {
      if (!l.r || l.r.noHeart) return;
      const on = now - (warm[keyOf(l.r)] || 0) < WARM_HOURS * 3600e3;
      let w = warmEls.get(l.slot);
      if (!!w === on) return;
      if (!on) { w.g.remove(); w.l.remove(); warmEls.delete(l.slot); return; }
      w = { g: document.createElementNS(NS, 'g'), l: document.createElementNS(NS, 'g') };
      w.g.setAttribute('pointer-events', 'none'); w.g.setAttribute('class', 'warm');
      w.g.innerHTML = `<g opacity=".55">${window.TOWN_ART.lightsOf(l.r.house || 'kit')}</g>` + window.TOWN_ART.smoke();
      thingOf(l).appendChild(w.g);
      w.l.setAttribute('transform', `translate(${l.x} ${l.y})`); w.l.innerHTML = window.TOWN_ART.smoke();
      lightsEl.appendChild(w.l);
      warmEls.set(l.slot, w);
    });
  }
  setInterval(showWarm, 60000);

  /* ───── 눈사람: 눈 오는 시간에 눈덩이 3개로 지금 서 있는 집 앞에 세운다. 집마다 하나, 만든 때부터 20시간 남는다 ───── */
  const SNOWMAN_LIFE = 20 * 3600e3; // 밤에 만든 눈사람이 다음 날 낮까지 남고, 그날 밤 눈 오기 전에 녹는다
  var buildBtn = $('#build'); // var: 눈 기능이 먼저 showBuild를 불러도 오류가 나지 않게
  var snowEls = new Map();
  const liveSnowman = (key) => { const s = snowmen[key]; return s && typeof s.t === 'number' && Date.now() - s.t < SNOWMAN_LIFE ? s : null; };
  function showSnowmen() {
    lots.forEach((l) => {
      if (!l.r || l.r.noHeart) return;
      const s = liveSnowman(keyOf(l.r)), sig = s ? `${s.n}|${s.c}|${s.t}` : '';
      const old = snowEls.get(l.slot);
      if ((old?.sig || '') === sig) return;
      if (old) old.g.remove();
      if (!s) { snowEls.delete(l.slot); return; }
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('pointer-events', 'none');
      const name = String(s.n || '손님').slice(0, 8).replace(/[<&>"]/g, ''), col = /^#[0-9a-f]{6}$/i.test(s.c) ? s.c : '#ff7a59';
      const label = `${name}님이 만든 눈사람`, lw = label.length * 10.5 + 14;
      g.setAttribute('transform', `translate(${l.x - l.w / 2 + 34} ${l.y + 16})`);
      g.innerHTML = window.TOWN_ART.snowman(col) + `<g transform="translate(0 22)"><rect x="${-lw / 2}" y="-10" width="${lw}" height="20" rx="10" fill="#fff" stroke="#9fb0c8" stroke-width="1.5"/><text x="0" y="0.5" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="800" fill="#3d4650">${label}</text></g>`;
      // 집과 나무보다 위 칸에 세운다(아랫줄 나무나 가로등에 가려 누가 만들었는지 안 보이던 문제)
      $('#snowmenG').appendChild(g);
      snowEls.set(l.slot, { g, sig });
    });
    showBuild();
  }
  setInterval(showSnowmen, 60000);
  function showBuild() {
    if (!buildBtn || !snowEls) return;
    const l = near && near.r && !near.r.noHeart ? near : null;
    buildBtn.hidden = !(net && snowFalling && l);
    if (buildBtn.hidden) return;
    const taken = liveSnowman(keyOf(l.r)), done = net.builtToday();
    buildBtn.disabled = !!taken || done || snowballs < BALL_MAX;
    buildBtn.textContent = taken ? '이미 눈사람이 있어요' : done ? '오늘 눈사람은 만들었어요' : snowballs < BALL_MAX ? `눈덩이 ${BALL_MAX}개 모으면 눈사람` : '⛄ 여기 눈사람 만들기';
  }
  buildBtn.addEventListener('click', async () => {
    const l = near;
    if (!net || !snowFalling || !l || !l.r || snowballs < BALL_MAX) return;
    buildBtn.disabled = true;
    const res = await net.buildSnowman(keyOf(l.r), { n: myName, c: color });
    if (res === 'ok') { snowballs = 0; showBalls(); toast(`${l.r.name} 앞에 눈사람을 세웠어요 ⛄`); }
    else if (res === 'taken') toast('누가 먼저 눈사람을 만들었어요');
    else if (res === 'limit') toast('눈사람은 하루에 하나만 만들 수 있어요');
    else toast('지금은 눈사람을 만들 수 없어요');
    showBuild();
  });

  /* ───── 안아주기: 가까이 있는 손님에게 달려가서 꼭 안아 준다. 둘 머리 위로 하트가 뜬다 ───── */
  const HUG_RANGE = 650;
  var hugBtn = $('#hug'), hugTarget = null, hugging = false, hugAt = 0, hugTo = '', hugReady = 0;
  const nearestPeer = (range) => { let best = null; peers.forEach((q, uid) => { const dd = Math.hypot(q.x - pos.x, q.y - pos.y); if (dd < range && (!best || dd < best.d)) best = { q, uid, d: dd }; }); return best; };
  function hugChar(el, faceTo) {
    if (!el) return;
    if (typeof faceTo === 'boolean') el.querySelector('.body')?.setAttribute('transform', faceTo ? 'scale(-1 1)' : '');
    el.classList.remove('hugging'); void el.getBBox(); el.classList.add('hugging');
    waveEl(el); el.classList.remove('waving');
    clearTimeout(el._hug); el._hug = setTimeout(() => el.classList.remove('hugging'), 1800);
  }
  function doHug(t) {
    if (t.zombie) { hugZombie(t.zombie); return; }
    const q = peers.get(t.uid);
    if (!q) { hugging = false; return; }
    faceLeft = q.x < pos.x;
    hugAt = Date.now(); hugTo = t.uid; tellSoon = true;
    hugChar(me, faceLeft); hugChar(q.el, !faceLeft);
    setTimeout(() => { hugging = false; }, 1800);
  }
  let hugShown = '';
  function hugTick() {
    if (!hugBtn) return;
    const best = net ? nearestHug() : null;
    const label = !best ? '' : hugging ? (hugTarget ? '달려가는 중…' : '꼭 안는 중 🤗') : best.zombie ? `${best.name} 좀비 안아서 구하기 🧟` : `${best.q.sig ? best.q.el.querySelector('text')?.textContent || '손님' : '손님'}님 안아주기 🤗`;
    if (label === hugShown) return;
    hugShown = label; hugBtn.hidden = !best; hugBtn.textContent = label; hugBtn.disabled = hugging;
  }
  hugBtn.addEventListener('click', () => {
    const best = nearestHug();
    if (!best || hugging || Date.now() < hugReady) return;
    hugReady = Date.now() + 2500; hint.done();
    const side = best.x < pos.x ? 1 : -1; // 상대의 내 쪽 옆에 선다
    hugging = true;
    const t = best.zombie ? { zombie: best.zombie } : { uid: best.uid };
    if (best.d < 46) { doHug(t); return; }
    walkTo([best.x + side * 30, best.y], null, true);
    hugTarget = t;
  });
  // 다른 손님이 누군가를 안아 줬을 때
  function onPeerHug(uid, q, d) {
    if (!(typeof d.h === 'number' && d.h && d.h !== q.h)) return;
    q.h = d.h;
    if (Date.now() - d.h > 8000) return;
    const mine = net && d.hu === net.uid;
    const other = mine ? null : peers.get(d.hu);
    const tx = mine ? pos.x : other ? other.x : q.x;
    hugChar(q.el, tx < q.x);
    if (mine) { faceLeft = q.x < pos.x; hugChar(me, faceLeft); toast(`${String(d.n || '손님').slice(0, 8)}님이 달려와서 안아줬어요 🤗`); }
    else if (other) hugChar(other.el, q.x < other.x);
  }

  /* ───── 좀비 집: 하트가 가장 적은 집 3곳이 좀비 바이러스에 걸린다 ─────
     화면에는 "감염된 집"으로만 보이고 왜 걸렸는지는 나오지 않는다. 집주인은 좀비가 되어 집 앞에서 비틀거린다.
     서로 다른 손님 5명이 하트를 주거나 좀비를 안아 주면 사람으로 돌아오고, 7일 동안은 다시 걸리지 않는다.
     구조가 시작된 집(1-4명)은 끝까지 좀비로 남아 있어, 다 구할 때까지 바뀌지 않는다.
     모두가 같은 하트·구조 기록을 보고 같은 규칙으로 고르므로 누구 화면에서나 같은 집이 좀비다. */
  const ZOMBIES = 3, CURE_NEED = 5, IMMUNE = 7 * 864e5, ZX = 66, ZY = 30;
  let cures = {}, cureLoaded = false;
  const zombieEls = new Map();
  let zombieKeys = new Set();
  const shortName = (r) => String(r.sign || r.name).replace(/[<&>"]/g, '').slice(0, 6);
  const curesOf = (key) => { const now = Date.now(); return Object.entries(cures[key] || {}).filter(([, v]) => v && typeof v.t === 'number' && now - v.t < IMMUNE).map(([u, v]) => ({ u, n: String(v.n || '손님'), t: v.t })).sort((a, b) => a.t - b.t); };
  function pickZombies() {
    const cand = lots.filter((l) => l.r && !l.r.noHeart && l.r.house !== 'mimo' && l.r.house !== 'temple')
      .map((l) => { const k = keyOf(l.r); return { l, k, c: curesOf(k).length, h: hearts[k] || 0 }; })
      .filter((x) => x.c < CURE_NEED);
    cand.sort((a, b) => (b.c > 0) - (a.c > 0) || a.h - b.h || (a.k < b.k ? -1 : 1));
    return cand.slice(0, ZOMBIES);
  }
  function zombieNote(key) {
    const c = curesOf(key);
    if (zombieKeys.has(key)) return `🧟 좀비 바이러스에 걸렸어요 · 구조 ${c.length}/${CURE_NEED} · 하트를 주거나 좀비를 안아 주면 구할 수 있어요`;
    if (c.length >= CURE_NEED) return `🎉 ${c[CURE_NEED - 1].n}님 외 ${c.length - 1}명이 구했어요`;
    return '';
  }
  function celebrate(l) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${l.x} ${l.y - 90})`); g.setAttribute('class', 'confetti'); g.setAttribute('pointer-events', 'none');
    g.innerHTML = Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2, r = 70 + (i % 3) * 30; return `<circle r="${5 + (i % 3)}" fill="${['#ff6f91', '#ffd24a', '#7fd0ea', '#8fdc9a', '#b8a5e3'][i % 5]}" style="--dx:${(Math.cos(a) * r).toFixed(0)}px;--dy:${(Math.sin(a) * r - 40).toFixed(0)}px"/>`; }).join('');
    ballsG.appendChild(g); setTimeout(() => g.remove(), 1600);
  }
  function showZombies() {
    if (!net || !cureLoaded) return;
    const picked = pickZombies(), next = new Set(picked.map((x) => x.k));
    // 사람으로 돌아온 집
    zombieEls.forEach((z, k) => {
      if (next.has(k)) return;
      z.house.remove(); z.npc.remove(); zombieEls.delete(k);
      if (curesOf(k).length >= CURE_NEED) { celebrate(z.l); toast(`${z.l.r.name} 사람으로 돌아왔어요! 🎉`); }
    });
    picked.forEach(({ l, k }) => {
      if (zombieEls.has(k)) return;
      const house = document.createElementNS(NS, 'g'); house.setAttribute('pointer-events', 'none');
      house.innerHTML = window.TOWN_ART.zombieHouse(l.w);
      thingOf(l).appendChild(house);
      const npc = document.createElementNS(NS, 'g'); npc.setAttribute('class', 'npc'); npc.setAttribute('pointer-events', 'none');
      npc.innerHTML = window.TOWN_ART.zombie(l.r.color, `${shortName(l.r)} 좀비`);
      npc.setAttribute('transform', `translate(${l.x + ZX} ${l.y + ZY})`);
      thingsG.insertBefore(npc, thingOf(l).nextSibling);
      zombieEls.set(k, { l, house, npc });
    });
    zombieKeys = next;
  }
  // 하트를 주거나 좀비를 안아 주면 구조에 참여한다(손님마다 한 번 센다)
  async function cureHouse(l) {
    if (!net || !l || !l.r) return;
    const k = keyOf(l.r);
    if (!zombieKeys.has(k)) return;
    if (curesOf(k).some((c) => c.u === net.uid)) { toast('이미 이 좀비를 구하는 데 함께했어요'); return; }
    const res = await net.cure(k, myName);
    if (res === 'ok') { const n = curesOf(k).length; if (n < CURE_NEED) toast(`🧟 구조 ${n}/${CURE_NEED}! 조금만 더`); }
  }
  function hugZombie(k) {
    const z = zombieEls.get(k);
    if (!z) { hugging = false; return; }
    faceLeft = z.l.x + ZX < pos.x;
    hugAt = Date.now(); hugTo = 'z:' + k; tellSoon = true;
    hugChar(me, faceLeft); hugChar(z.npc, false);
    cureHouse(z.l);
    setTimeout(() => { hugging = false; }, 1800);
  }
  // 안아 줄 수 있는 가장 가까운 대상: 손님이나 좀비
  function nearestHug() {
    let best = null;
    const p = nearestPeer(HUG_RANGE);
    if (p) best = { uid: p.uid, q: p.q, x: p.q.x, y: p.q.y, d: p.d };
    zombieEls.forEach((z, k) => {
      const x = z.l.x + ZX, y = z.l.y + ZY, dd = Math.hypot(x - pos.x, y - pos.y);
      if (dd < HUG_RANGE && (!best || dd < best.d)) best = { zombie: k, name: shortName(z.l.r), x, y, d: dd };
    });
    return best;
  }
  setInterval(showZombies, 60000);

  /* ───── 홈 화면에 마을 추가: 앱처럼 아이콘을 눌러 바로 들어오게 ─────
     안드로이드 크롬은 설치 창을 바로 띄우고, 아이폰 사파리는 순서를 보여 준다.
     스레드·인스타·카카오톡 안에서 열면 추가가 막혀 있어서, 브라우저로 여는 방법을 알려 준다. */
  const installEl = $('#install'), guideEl = $('#guide'), guideText = $('#gd-text'), guideChrome = $('#gd-chrome');
  const UA = navigator.userAgent;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const inApp = /Barcelona|Instagram|FBAN|FBAV|KAKAOTALK|NAVER|Line\//i.test(UA);
  const iOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(UA);
  const ownSite = /\.web\.app$|^localhost$|^127\./.test(location.hostname);
  let installPrompt = null;
  if ('serviceWorker' in navigator && ownSite) navigator.serviceWorker.register('sw.js').catch(() => {});
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; showInstall(); });
  addEventListener('appinstalled', () => { store.set('town-installed', '1'); installEl.hidden = true; toast('홈 화면에 스친 마을이 생겼어요 🏡'); });
  function showInstall() { installEl.hidden = !ownSite || standalone || store.get('town-installed') === '1' || store.get('town-install-x') === new Date().toISOString().slice(0, 10); }
  showInstall();
  $('#install-x').addEventListener('click', () => { store.set('town-install-x', new Date().toISOString().slice(0, 10)); installEl.hidden = true; }); // 닫으면 오늘 하루만 숨긴다
  $('#gd-close').addEventListener('click', () => guideEl.close());
  $('#install-go').addEventListener('click', async () => {
    guideChrome.hidden = true;
    if (installPrompt) { installPrompt.prompt(); const r = await installPrompt.userChoice.catch(() => null); installPrompt = null; if (r && r.outcome === 'accepted') store.set('town-installed', '1'); showInstall(); return; }
    if (inApp && android) {
      guideText.textContent = '스레드 안에서는 홈 화면에 추가할 수 없어요.\n아래 "크롬으로 열기"를 누르거나, 오른쪽 위 ⋯ 를 눌러 "브라우저에서 열기"를 고른 다음\n크롬 메뉴 ⋮ 에서 "홈 화면에 추가"를 눌러 주세요.';
      guideChrome.href = `intent://${location.host}/#Intent;scheme=https;package=com.android.chrome;end`;
      guideChrome.hidden = false;
    } else if (inApp) {
      guideText.textContent = '스레드 안에서는 홈 화면에 추가할 수 없어요.\n1. 오른쪽 위 ⋯ 를 눌러 "브라우저에서 열기"(사파리)를 골라요.\n2. 사파리 아래쪽 공유 버튼(□↑)을 눌러요.\n3. "홈 화면에 추가"를 누르면 끝!';
    } else if (iOS) {
      guideText.textContent = '1. 아래쪽 공유 버튼(□↑)을 눌러요.\n2. 목록을 내려서 "홈 화면에 추가"를 눌러요.\n3. 오른쪽 위 "추가"를 누르면 끝!';
    } else if (android) {
      guideText.textContent = '1. 오른쪽 위 메뉴 ⋮ 를 눌러요.\n2. "홈 화면에 추가" 또는 "앱 설치"를 눌러요.';
    } else {
      guideText.textContent = '휴대폰으로 이 주소를 열면 홈 화면에 마을을 추가할 수 있어요.\n컴퓨터에서는 주소창 오른쪽의 설치 아이콘이나 브라우저 메뉴의 "앱 설치"를 눌러 주세요.';
    }
    guideEl.showModal();
  });

  enter(myName);
  if (!store.get('town-name') && !new URLSearchParams(location.search).has('skip')) gate.showModal();
  window.TownNet.connect().then((n) => {
    if (!n) return;
    net = n; tellSoon = true; showOnline();
    net.onPeers(onPeer);
    net.onHearts((h) => { hearts = h; showPerks(); showHearts(); showZombies(); });
    net.onCures((c) => { cures = c || {}; cureLoaded = true; showZombies(); showHearts(); });
    net.onWarm((w) => { warm = w || {}; showWarm(); });
    net.onVisits((v) => { visits = v || {}; showHearts(); });
    net.onSnowmen((s) => { snowmen = s || {}; showSnowmen(); showHearts(); });
    showBuild();
  });

  window.__town = { pos, lots, walkTo, route, cam, setOverview, setNight, nodes, peers, get net() { return net; }, get hearts() { return hearts; }, get warm() { return warm; }, showWarm, get zombies() { return [...zombieKeys]; } };
  requestAnimationFrame(tick);
})();
