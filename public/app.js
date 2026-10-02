const $ = s => document.querySelector(s), H = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let ws, S, tab = 'scene', tool = '', want = 'K';
let STATIC = null; // 서버가 입장 때 한 번만 보내는 정적 데이터를 보관 (이후 메시지에는 D가 없음)
const TABS = [['scene', '장면'], ['journal', '수첩'], ['sky', '천문탑'], ['stairs', '계단'], ['dream', '꿈세계'], ['bag', '소지품'], ['letters', '편지']];
document.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { want = b.dataset.role;
  document.querySelectorAll('[data-role]').forEach(x => x.classList.toggle('on', x === b)); });
$('#go').onclick = () => {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => ws.send(JSON.stringify({ a: 'join', code: $('#code').value.trim(), role: want }));
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.err) { $('#err').textContent = m.err; return; }
    if (m.D) STATIC = m.D; m.D = STATIC; S = m; $('#lobby').hidden = true; $('#app').hidden = false; draw(); };
  ws.onclose = () => { if (S) $('#off').hidden = false; };
};
const tx = o => ws.send(JSON.stringify(o));
const distort = t => [...t].map((c, i) => /[가-힣]/.test(c) && (i * 7 + t.length) % 5 === 0 ? '<span class="w">██</span>' : H(c)).join('');

function draw() {
  const s = S.s, other = S.role === 'K' ? 'M' : 'K', dr = s.grid.filter(v => '☁♜✦'.includes(v) && v).length;
  $('#rc').textContent = S.code; $('#who').textContent = `${S.RN[S.role]}${S.fac ? ' · ' + S.fac[S.role] : ''} · 상대 ${S.online.includes(other) ? '접속 중' : '대기 중'}`;
  const mt = (n, v, mx, c = '') => `<div class="mt ${c}">${n} ${v}<div class="bar"><i style="width:${Math.min(100, v / mx * 100)}%"></i></div></div>`;
  $('#meters').innerHTML = mt('유대', s.bond, 30) + mt('마음', s.heart || 0, 480, 'heart') + mt('기억', s.mem, 10, 'mem') + mt('꿈세계', dr, 20) + mt('플랜', s.plan, 3);
  $('#pips').innerHTML = ['1학년', '4학년', '7학년', '성인'].map((n, i) => `<i class="${i === Math.min(s.ch, 3) ? 'on' : i < s.ch ? 'past' : ''}">${n}</i>`).join('');
  const hs = (S.D || {}).heartStages, hst = hs ? hs.filter(x => (s.heart || 0) >= x[0]).pop() : null;
  $('#bal').innerHTML = (hst ? `<div class="hst" style="font-size:12px;color:#e58fa8;margin:8px 0 0">♥ ${H(hst[1])} — ${H(hst[2])}</div>` : '') + (s.ch >= 3 ? `<div class="bal"><span>컨티눔 · 현재</span><div class="bt"><i style="left:${(s.argos + 6) / 12 * 100}%"></i></div><span>판테온 · 회귀</span></div>` : '');
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('');
  const keep = ['#pt', '#ht'].map(i => $(i) && $(i).value);
  $('#panel').innerHTML = { scene, journal, sky, stairs, dream, bag, letters }[tab](s, other);
  ['#pt', '#ht'].forEach((i, n) => { if (keep[n] && $(i)) $(i).value = keep[n]; });
}
function scene(s, other) {
  if (s.phase === 'end') return `<h2>${H(s.end[0])}</h2><p class="narr">${H(s.end[1])}</p>${(s.end[2] || []).map(l => `<div class="line ${l[0].toLowerCase()}">${S.RN[l[0]]}: ${H(l[1])}</div>`).join('')}<p class="mu">유대 ${s.bond} · 기억 ${s.mem}</p>`;
  const e = S.ev, lock = e.t === '성 뭉고의 밤' && s.tri && !s.tri.done; let h = `${S.ei === 0 && s.phase === 'scene' && S.intro ? `<p class="intro">${H(S.chy)}<br>${H(S.intro)}</p>` : ''}<p class="chap">${S.ch} · ${S.ei + 1}/${S.n}</p><h2>${H(e.t)}</h2><p class="narr">${H(e.s)}</p>${s.tri && s.tri.done && e.t === '성 뭉고의 밤' ? `<p class="sync">치료 완료 ${s.tri.saved}/6명</p>` : ''}`;
  if (s.phase === 'scene') h += lock ? triBoard(s) : S.my == null ? e.o.map((o, i) => `<button class="opt" data-pick="${i}">${H(o)}</button>`).join('')
    : `<p class="wait">${S.picked[other] ? '' : `${S.RN[other]}의 선택을 기다리는 중…`}</p>`;
  else h += `<div class="line k">${S.RN.K}: ${H(s.res.k)}</div><div class="line m">${S.RN.M}: ${H(s.res.m)}</div>`
    + (s.res.sync ? `<p class="sync">두 사람의 마음이 같은 쪽을 향했다. (공명 +1 · ${s.res.streak}연속)</p>` : '') + (s.res.det ? '<p class="sync">플랜 B 발동 — 기억이 어긋나는 것을 막았다.</p>' : '') + (s.res.item ? `<p class="sync">소지품 획득: ${H(S.D.items[s.res.item][0])}</p>` : '') + (s.res.han != null ? '<p class="sync">한소가 열렸다. (소지품 탭)</p>' : '') + '<button class="opt" data-next="1">다음 장면</button>';
  return h;
}
function triBoard(s) {
  const t = s.tri, K = S.role === 'K';
  return `<h2>상황판</h2><p class="mu">${K ? '케야티: 환자를 눌러 치료해요. 모르포가 옮겨 둔 환자는 비용이 줄어요.' : '모르포: 환자를 눌러 안전한 곳으로 옮겨요.'} 남은 손 — 케야티 ${t.ap.K} · 모르포 ${t.ap.M}</p>`
    + t.pts.map((p, i) => `<button class="opt tri ${p.st}" data-tri="${i}" ${p.st === 'saved' || (!K && p.st) ? 'disabled' : ''}>${H(p.n)} · ${p.lv} — ${p.st === 'saved' ? '치료 완료' : p.st === 'carried' ? '옮겨짐' : '대기'}</button>`).join('')
    + '<button class="opt" data-triend="1">여기까지 하기</button>';
}
function journal(s) {
  const w = s.journal.some(j => j.w);
  let h = S.role === 'K' ? `<button class="opt" data-verify="1" ${w ? '' : 'disabled'}>${w ? '어긋난 기록 대조하기 (기억 +1)' : '어긋난 기록이 없다'}</button>` : '<p class="mu">수첩은 케야티가 대조할 수 있어요. 기억이 흐려지면 기록이 어긋나요.</p>';
  h += s.journal.map(j => { const t = `${j.t} — ${S.RN.K}: ${j.k} / ${S.RN.M}: ${j.m}`;
    return `<div class="paper ${j.w ? 'warp' : ''}"><small>[${H(j.d)}. 이건 오늘 내가 적었다.]</small>${j.w ? distort(t) : H(t)}</div>`; }).join('');
  return h || '<p class="mu">아직 적힌 기록이 없다. 장면을 마치면 수첩에 남는다.</p>';
}


// ── 계단 주기 맞추기: 움직이는 계단이 층계참에 닿는 순간 눌러 5번 중 몇 번을 맞히는지 겨룬다
// 케야티의 황동 줄자와 회중시계(tape)가 있으면 판정 구간이 넓어진다. 3번 이상이면 유대 +1, 5번 모두면 기억 +1 (최고 기록 기준 한 번씩)
const SP = [3200, 2700, 2300, 1900, 1600];
let sg = { r: 0, hit: 0, run: false, t0: 0, msg: '' };
const spos = (t, r) => (Math.sin(2 * Math.PI * t / SP[r] - Math.PI / 2) + 1) / 2;
const swin = () => S && S.s.items.includes('tape') ? 0.14 : 0.09;
function stairs(s) {
  const best = s.stairs || 0, w = swin();
  const body = !sg.run ? `<p class="mu">${sg.msg || '움직이는 계단이 층계참과 겹치는 순간에 누르자. 5번의 시도, 갈수록 주기가 짧아진다.'}</p><button class="opt" data-st="start">${sg.r >= 5 ? '다시 재 보기' : '주기 재기 시작'}</button>`
    : `<p class="mu">${sg.r + 1}/5번째 · 맞힌 횟수 ${sg.hit}</p><button class="opt" data-st="hit">지금!</button>`;
  return `<div class="stairs"><p class="mu">최고 기록 ${best}/5${s.items.includes('tape') ? ' · 황동 줄자와 회중시계 덕에 판정이 넓다' : ''}</p>
  <div class="trk"><i class="zone" style="left:${(0.5 - w) * 100}%;width:${w * 200}%"></i><i id="stp" class="stp"></i></div>${body}</div>`;
}
(function loop() { const el = document.getElementById('stp'); if (el && sg.run) el.style.left = spos(performance.now() - sg.t0, sg.r) * 100 + '%'; requestAnimationFrame(loop); })();
document.addEventListener('click', e => {
  const b = e.target.closest('[data-st]'); if (!b || !ws || !S) return;
  if (b.dataset.st === 'start') { sg = { r: 0, hit: 0, run: true, t0: performance.now(), msg: '' }; draw(); return; }
  if (!sg.run) return;
  const ok = Math.abs(spos(performance.now() - sg.t0, sg.r) - 0.5) <= swin();
  sg.hit += ok ? 1 : 0; sg.r++; sg.t0 = performance.now();
  if (sg.r >= 5) { sg.run = false; sg.msg = `기록 ${sg.hit}/5 — ${sg.hit >= 5 ? '완벽한 주기 계산이다.' : sg.hit >= 3 ? '이 정도면 계단은 신뢰할 만하다.' : '오차가 크다. 다시 재 보자.'}`; tx({ a: 'stairs', sc: sg.hit }); }
  draw();
});

// ── 별자리 잇기: 이름으로 모양을 정하는 미니게임. 번호 순서대로 별을 눌러 잇는다
let tr = { n: '', k: 0 };
const rng = n => { let h = 2166136261; for (const c of n) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ h >>> 15, 2246822519) >>> 0; return (h % 1000) / 1000; }; };
const shape = n => { const r = rng(n), c = 5 + Math.floor(r() * 3); return Array.from({ length: c }, (_, i) => [28 + i * (244 / (c - 1)), 30 + r() * 120]); };
function trace(s) {
  const left = S.D.sky.filter(c => s.sky.includes(c[0]) && !s.traced.includes(c[0])), tg = left[0];
  if (!tg) return `<div class="trace"><p class="mu">별자리 잇기 ${s.traced.length}/${S.D.sky.length}${s.sky.length ? ' · 올려다본 별자리를 모두 이었다' : ' · 먼저 하늘을 올려다보자'}</p></div>`;
  if (tr.n !== tg[0]) tr = { n: tg[0], k: 0 };
  const P = shape(tg[0]), seg = P.slice(0, tr.k + 1).slice(1).map((p, i) => `<line x1="${P[i][0]}" y1="${P[i][1]}" x2="${p[0]}" y2="${p[1]}" stroke="#d4af6a" stroke-width="1.4"/>`).join('');
  const dots = P.map((p, i) => `<g data-star="${i}" class="${i < tr.k ? 'on' : i === tr.k ? 'next' : ''}"><circle cx="${p[0]}" cy="${p[1]}" r="11" fill="transparent"/><circle class="st" style="color:#fff" cx="${p[0]}" cy="${p[1]}" r="${i < tr.k ? 4.5 : 3.2}" fill="${i < tr.k ? '#d4af6a' : '#fff'}"/><text x="${p[0] + 7}" y="${p[1] - 7}" font-size="8" fill="#a89a84">${i + 1}</text></g>`).join('');
  return `<div class="trace"><p class="mu">별자리 잇기 ${s.traced.length}/${S.D.sky.length} · <b>${H(tg[0])}</b> — 번호 순서대로 별을 눌러 이어 보자 (완성하면 유대 +1)</p><svg viewBox="0 0 300 180">${seg}${dots}</svg></div>`;
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-star]'); if (!g || !ws || !S) return;
  const i = +g.dataset.star;
  if (!tr.n) return;
  if (i === tr.k) { tr.k++; if (tr.k >= shape(tr.n).length) { tx({ a: 'trace', n: tr.n }); tr = { n: '', k: 0 }; return; } } else tr.k = 0;
  draw();
});
function sky(s) {
  const pts = s.promises, W = 300, Hh = 200;
  const lines = pts.slice(1).map((p, i) => `<line x1="${pts[i].x * W}" y1="${pts[i].y * Hh}" x2="${p.x * W}" y2="${p.y * Hh}" stroke="#b9a88a" stroke-opacity=".5" stroke-width=".6"/>`).join('');
  const stars = pts.map(p => `<circle class="st" style="color:${p.r === 'K' ? '#a8ab8a' : '#f2a0c0'}" cx="${p.x * W}" cy="${p.y * Hh}" r="3.2" fill="${p.r === 'K' ? '#a8ab8a' : '#f2a0c0'}"><title>${H(p.t)}</title></circle>`).join('');
  return `<svg class="sky" viewBox="0 0 ${W} ${Hh}"><circle class="st" style="color:#fff" cx="150" cy="22" r="4.5" fill="#fff"/><text x="160" y="26" fill="#a89a84" font-size="9">북극성</text>${lines}${stars}</svg>
  <p class="mu">별자리 ${s.sky.length}/${S.D.sky.length}</p><div class="chips">${S.D.sky.map(c => `<button title="${H(c[1])}" class="${s.sky.includes(c[0]) ? 'got' : ''}" data-tip="${H(c[1])}">${s.sky.includes(c[0]) ? H(c[0]) : '？'}</button>`).join('')}</div>
  ${trace(s)}
  <button class="opt" data-look="1" ${S.looked.includes(S.role) ? 'disabled' : ''}>${S.looked.includes(S.role) ? '오늘은 이미 올려다봤다' + (S.looked.length < 2 ? ' (상대를 기다리는 중)' : '') : '같은 하늘을 올려다보기'}</button>
  <ul class="mu">${pts.map(p => `<li>${p.r === 'K' ? '케야티' : '모르포'}: ${H(p.t)}</li>`).join('') || '<li>약속을 남기면 별이 하나씩 뜬다.</li>'}</ul>
  <div class="row"><input id="pt" maxlength="40" placeholder="약속 한 줄 (예: 다시 보자)"><button data-promise="1">별로 남기기</button></div>
  <p class="mu">서로를 부른 이름 (처음 부를 때 유대 +1)</p><div class="chips">${S.names.map(n => `<button data-name="${H(n)}" class="${s.names.includes(n) ? 'got' : ''}">${H(n)}</button>`).join('')}</div>`;
}
function bag(s) {
  const it = s.items.map(k => `<div class="paper"><small>${H(S.D.items[k][0])}</small>${H(S.D.items[k][1])}</div>`).join('') || '<p class="mu">사건을 진행하면 소지품이 늘어난다.</p>';
  const hs = S.D.hanso.slice(0, s.hanso).map(h => `<div class="line m">${H(h[0])}</div><div class="line k">${H(h[1])}</div>`).join('');
  const cs = s.custom.map((c, i) => `<div class="line ${c.r.toLowerCase()}">${S.RN[c.r]}: ${H(c.t)}${c.r === S.role ? ` <button class="x" data-hdel="${i}">삭제</button>` : ''}</div>`).join('');
  const form = `<h2>한소 쓰기</h2><p class="mu">직접 한 줄씩 적어 저장해요. 두 사람이 번갈아 쓰면 대화가 돼요.</p>${cs || '<p class="mu">아직 저장된 한소가 없다.</p>'}
  <div class="row"><input id="ht" maxlength="120" placeholder="${S.RN[S.role]}의 한 줄"><button data-hadd="1">저장</button></div>
  <button class="opt" data-hcopy="1" ${cs ? '' : 'disabled'}>한소 복사하기</button>`;
  const tl = S.D.timeline.filter(t => t[0] <= S.yr).map(t => `<div class="line"><b>${t[0]}</b> ${H(t[1])}</div>`).join('');
  return it + '<h2>연표</h2>' + tl + (hs ? '<h2>한소</h2>' + hs : '<p class="mu">같은 선택을 3·5·7번 연속으로 고르면 짧은 대화(한소)가 열린다.</p>') + form;
}
function dream(s) {
  const T = { K: ['⌂', '✧'], M: ['☁', '♜', '✦'] }[S.role], dr = s.grid.filter(v => '☁♜✦'.includes(v) && v).length, ex = s.grid.filter(v => v === '⌂').length;
  const bad = dr >= 6 && ex < dr / 3;
  return `<p class="mu">모르포는 성을, 케야티는 비상구를 짓는다. 출입구 없이 커지는 성은 감옥이 된다.</p>
  <div class="tools">${T.map(t => `<button data-tool="${t}" class="${tool === t ? 'on' : ''}">${t}</button>`).join('')}<button data-tool="">지우개</button></div>
  <div class="grid">${s.grid.map((v, i) => `<button data-cell="${i}">${v || '·'}</button>`).join('')}</div>
  <p class="${bad ? 'warn' : 'mu'}">성 ${dr} · 비상구 ${ex}${bad ? ' — 비상구가 부족해요 (3칸당 1개 이상)' : ''}</p>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t || !ws) return; const d = t.dataset;
  if (d.tab) { tab = d.tab; draw(); }
  else if (d.pick) tx({ a: 'pick', i: +d.pick });
  else if (d.hadd) { const v = $('#ht').value.trim(); if (v) { tx({ a: 'hadd', t: v }); $('#ht').value = ''; } }
  else if (d.hdel) tx({ a: 'hdel', i: +d.hdel })
  else if (d.hcopy) { navigator.clipboard.writeText(S.s.custom.map(c => S.RN[c.r] + ': ' + c.t).join('\n')).then(() => alert('복사했어요.')).catch(() => alert('복사에 실패했어요. 직접 선택해 복사해 주세요.')); }
  else if (d.tri) tx({ a: 'tri', i: +d.tri });
  else if (d.triend) tx({ a: 'triend' });
  else if (d.look) tx({ a: 'look' });
  else if (d.tip) alert(d.tip);
  else if (d.next) tx({ a: 'next' });
  else if (d.verify) tx({ a: 'verify' });
  else if (d.name) tx({ a: 'name', n: d.name });
  else if (d.promise) { const v = $('#pt').value.trim(); if (v) { tx({ a: 'promise', t: v }); $('#pt').value = ''; } }
  else if (d.tool !== undefined) { tool = d.tool; draw(); }
  else if (d.cell) { const i = +d.cell, cur = S.s.grid[i]; tx({ a: 'place', i, v: cur === tool ? '' : tool }); }
});

// ── 직접 그린 SVG 아이콘: 내부 키(기호)는 그대로 두고, 화면에는 아이콘으로 바꿔 보여 준다
(function () {
  const P = {
    '☁': '<circle cx="12" cy="9" r="5.5"/><path d="M9 7.5c2-1.3 4.5-.6 4.5 1.4S10.5 11 10.8 9.4M12 14.5V21"/>',
    '♜': '<path d="M5 21V9l2 1V6h2v3h2V5h2v4h2V6h2v4l2-1v12zM10.5 21v-4a1.5 1.5 0 0 1 3 0v4"/>',
    '✦': '<path d="M12 2.5c.8 4.6 2.9 6.7 9.5 9.5-6.6 2.8-8.7 4.9-9.5 9.5-.8-4.6-2.9-6.7-9.5-9.5 6.6-2.8 8.7-4.9 9.5-9.5z"/>',
    '⌂': '<path d="M6 21V10a6 6 0 0 1 12 0v11zM3 21h18M14.5 14.5v.1"/>',
    '✧': '<path d="M9.5 6h5M12 2.5V6M8 6h8l1.5 12h-11zM9 18c0 2 6 2 6 0M12 9.5c-1 1.6-1 3 0 4 1-1 1-2.4 0-4z"/>',
    '▤': '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 9h14M5 15h14M12 3v18"/>',
    '❂': '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.500l-2 5-5 2 2-5z"/>',
    '❀': '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.800C9.5 6 10 3 12 3s2.5 3 0 6.800zM12 14.200c2.5 3.8 2 6.8 0 6.800s-2.5-3 0-6.800zM9.8 12C6 9.5 3 10 3 12s3 2.5 6.8 0zM14.2 12c3.8 2.5 6.8 2 6.8 0s-3-2.5-6.8 0z"/>',
    '◈': '<rect x="3.5" y="7" width="17" height="13" rx="2"/><path d="M9 7V5.500h6V7M12 10.500v6M9 13.500h6"/>',
    '❦': '<path d="M12 20.500C4 14.5 3.5 9 7 6.800c2.2-1.3 4 0 5 1.7 1-1.7 2.8-3 5-1.7 3.5 2.2 3 7.7-5 13.700z"/>',
    '◎': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.500L21 21"/>'
  };
  const MK = { '☁': 'm', '♜': 'm', '✦': 'm', '▤': 'm', '❀': 'm', '⌂': 'k', '✧': 'k', '❂': 'k' };
  const re = new RegExp('[' + Object.keys(P).join('') + ']', 'g');
  const svg = g => `<svg class="ic ${MK[g] ? 'ic-' + MK[g] : ''}" viewBox="0 0 24 24" aria-hidden="true">${P[g]}</svg>`;
  let busy = false;
  const run = () => {
    if (busy) return; busy = true;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), hit = [], t1 = new RegExp(re.source);
    for (let n; (n = w.nextNode());) if (t1.test(n.nodeValue) && !n.parentElement.closest('svg,script,style')) hit.push(n);
    hit.forEach(n => { re.lastIndex = 0; const sp = document.createElement('span'); sp.innerHTML = n.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(re, svg); n.replaceWith(...sp.childNodes); });
    busy = false;
  };
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true });
  run();
})();

// ── 편지 탭 · 밀랍 도장 · 부엉이 배달 · 기록 저장
function letters(s) {
  const mine = S.role, seal = r => `<svg class="seal ${r.toLowerCase()}" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2c4 0 5 3 9 4s6 4 5 8 2 6 1 10-4 5-6 8-6 5-9 5-6-3-9-5-5-4-6-8-2-6-1-10 3-5 5-8 5-4 9-4z"/><path d="M20 10c.7 4 2.5 5.8 8 8-5.5 2.2-7.3 4-8 8-.7-4-2.5-5.8-8-8 5.5-2.2 7.3-4 8-8z"/></svg>`;
  let h = '<p class="mu">편지는 부엉이가 배달해요. 쓰면 상대의 수첩에도 도착해요.</p>';
  for (let c = 0; c <= s.ch; c++) (S.D.letters[c] || []).forEach((q, i) => {
    const got = s.letters.filter(l => l.c === c && l.i === i), me = got.find(l => l.r === mine);
    h += `<div class="paper letter"><small>${H(q)}</small>${got.map(l => `<div class="lt ${l.r.toLowerCase()}">${seal(l.r)}<b>${S.RN[l.r]}</b> ${H(l.t)}</div>`).join('')}`
      + (me ? '' : `<div class="row"><input id="lt-${c}-${i}" maxlength="160" placeholder="한 줄을 적어요"><button data-lsend="${c}-${i}">보내기</button></div>`) + '</div>';
  });
  return h + '<button class="opt" data-export="1">기록 저장 (.txt)</button>';
}
function owl() {
  const d = document.createElement('div'); d.className = 'owl';
  d.innerHTML = '<svg viewBox="0 0 60 50" aria-hidden="true"><path class="wl" d="M8 22c-6 2-8 8-6 14 6-2 10-6 12-10zM52 22c6 2 8 8 6 14-6-2-10-6-12-10z"/><ellipse cx="30" cy="28" rx="13" ry="17"/><path d="M19 14l4 5M41 14l-4 5"/><circle cx="25" cy="23" r="4"/><circle cx="35" cy="23" r="4"/><path d="M30 27l-2 3h4z"/></svg>';
  document.body.appendChild(d); setTimeout(() => d.remove(), 2400);
}
function exportLog() {
  const s = S.s, L = [`루미아 — 방 ${S.code || ''}`, '', '[수첩]'];
  s.journal.forEach(j => L.push(`[${j.d}] ${j.t} — ${S.RN.K}: ${j.k} / ${S.RN.M}: ${j.m}`));
  L.push('', '[편지]'); s.letters.forEach(l => L.push(`(${S.D.letters[l.c][l.i]}) ${S.RN[l.r]}: ${l.t}`));
  L.push('', '[약속의 별]'); (s.promises || []).forEach(p => L.push('- ' + (p.t || '')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' }));
  a.download = 'lumia-log.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lsend],[data-export]'); if (!b) return;
  if (b.dataset.export) return exportLog();
  const [c, i] = b.dataset.lsend.split('-').map(Number), t = ($('#lt-' + c + '-' + i).value || '').trim();
  if (!t) return; owl(); setTimeout(() => tx({ a: 'letter', c, i, t }), 1500);
});
