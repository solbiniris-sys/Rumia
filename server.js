// server.js — 루미아 2인 역극 게임 서버. node server.js → http://localhost:3000
// 방 상태는 rooms.json 에 저장된다 (Railway 에서 유지하려면 볼륨을 붙이고 DATA_DIR 환경변수로 경로 지정).
const express = require('express'), http = require('http'), fs = require('fs'), path = require('path'), { WebSocketServer } = require('ws');
const D = require('./data');
const app = express(); app.use(express.static(path.join(__dirname, 'public')));
const srv = http.createServer(app), wss = new WebSocketServer({ server: srv });
const rooms = {}, RN = { K: '케야티', M: '모르포' }, VER = 4, TRI = '성 뭉고의 밤';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const OWN = { K: D.tools.filter(t => t.r === 'K').map(t => t.v), M: D.tools.filter(t => t.r === 'M').map(t => t.v) };
const TAGS = () => ({ safe: 0, near: 0, know: 0 });
const fresh = () => ({ ver: VER, ch: 0, ei: 0, intro: true, bond: 3, heart: 0, mem: 10, plan: 0, argos: 0, streak: 0, hanso: 0,
  phase: 'scene', res: null, end: null, pick: {}, items: [], flags: {}, un: [...D.baseNames], names: [], tags: { K: TAGS(), M: TAGS() },
  sky: [], looked: {}, lb: {}, journal: [], custom: [], letters: [], promises: [], grid: Array(48).fill(''), bp: { K: 2, M: 2 },
  quests: [], qlast: '', nudge: null, again: {}, endings: [], runs: 0, tri: null, traced: [], stairs: 0 });

// ── 저장: 서버를 껐다 켜도 이어진다 (구버전 상태는 호환되지 않아 새로 시작)
const FILE = path.join(process.env.DATA_DIR || __dirname, 'rooms.json');
try { const o = JSON.parse(fs.readFileSync(FILE)); for (const c in o) if (o[c].ver === VER) rooms[c] = { s: Object.assign(fresh(), o[c]), ws: {} }; } catch {}
let tm; const save = () => { clearTimeout(tm); tm = setTimeout(() => { const o = {}; for (const c in rooms) o[c] = rooms[c].s; fs.writeFile(FILE, JSON.stringify(o), () => {}); }, 300); };

const cur = s => { const c = D.ch[s.ch]; return c && c.ev[s.ei]; };

// ── 조건 검사 (선택지의 if / 사건의 if 공용). role 이 있으면 그 사람의 성향 횟수로 센다
function chk(s, c, role) {
  if (!c) return true;
  if (c.item && !s.items.includes(c.item)) return false;
  if (c.flag && !s.flags[c.flag]) return false;
  if (c.bond != null && s.bond < c.bond) return false;
  if (c.mem != null && s.mem < c.mem) return false;
  if (c.heart != null && (s.heart || 0) < c.heart) return false;
  if (c.tag) { const [t, n] = c.tag, v = role ? s.tags[role][t] : s.tags.K[t] + s.tags.M[t]; if (v < n) return false; }
  if (c.name && !s.un.includes(c.name)) return false;
  if (c.sky != null && s.sky.length < c.sky) return false;
  if (c.promises != null && s.promises.length < c.promises) return false;
  if (c.letters != null && s.letters.length < c.letters) return false;
  return true;
}
const FLAGHINT = { tri_all: '성 뭉고의 밤에 환자 전원을 치료했다면', witness: '복도의 증언을 모았다면', virgo: '처녀자리를 함께 올려다봤다면' };
function hintOf(c) {
  const p = [];
  if (c.item) p.push(`소지품 「${D.items[c.item][0]}」`);
  if (c.flag) p.push(FLAGHINT[c.flag] || '어떤 기억이 남아 있다면');
  if (c.bond != null) p.push(`유대 ${c.bond} 이상`);
  if (c.mem != null) p.push(`기억 ${c.mem} 이상`);
  if (c.heart != null) p.push(`마음 ${c.heart} 이상`);
  if (c.tag) p.push(`${D.tagInfo[c.tag[0]][0]}${D.tagInfo[c.tag[0]][1]} 선택 ${c.tag[1]}번 이상`);
  if (c.name) p.push(`‘${c.name}’ 호칭을 알게 되면`);
  if (c.sky != null) p.push(`별자리 ${c.sky}개 이상`);
  if (c.promises != null) p.push(`약속의 별 ${c.promises}개 이상`);
  return p.join(' · ');
}

function giveItem(s, k, notes) { if (D.items[k] && !s.items.includes(k)) { s.items.push(k); notes.push('소지품 획득: ' + D.items[k][0]); } }
function unlock(s, n, notes) { if (!s.un.includes(n)) { s.un.push(n); notes.push(`호칭이 열렸다: ${n} (천문탑)`); } }
function setFlag(s, f, notes) { if (!s.flags[f]) { s.flags[f] = 1; if (D.friends[f]) notes.push(`친구 도감: ${D.friends[f][0]} (소지품 탭)`); } }

function checkQuests(s) {
  const st = D.dreamStat(s.grid);
  for (const q of D.quests) if (!s.quests.includes(q.id) && s.ch >= q.ch && q.ok(st)) {
    s.quests.push(q.id); s.bond += q.bond; s.bp.K += q.bp; s.bp.M += q.bp; s.qlast = `의뢰 완료 — ${q.t} (유대 +${q.bond})`; }
}

function resolve(s, ev) {
  const ko = ev.K[s.pick.K], mo = ev.M[s.pick.M], sync = ko.tag === mo.tag, notes = [];
  s.bond += ko.b + mo.b + (sync ? 1 : 0);
  // 마음(로맨스): 곁에(near) 선택은 +1, 선택지의 r 은 추가, 같은 마음이면 +1. 단계가 오르면 알림
  const h0 = s.heart || 0, hs = D.heartStages, stage = v => hs.filter(x => v >= x[0]).length - 1;
  const hg = (ko.tag === 'near' ? 1 : 0) + (mo.tag === 'near' ? 1 : 0) + (ko.r || 0) + (mo.r || 0) + (sync && (ko.r || mo.r) ? 1 : 0);
  s.heart = h0 + hg;
  if (stage(s.heart) > stage(h0)) notes.push(`마음의 단계: ${hs[stage(s.heart)][1]}`);
  let pen = ev.hit ? 2 : 0, det = false;
  if (pen && s.promises.length >= 3) pen--;        // 약속이 기억의 닻이 된다
  if (pen && s.plan > 0) { s.plan--; pen = 0; det = true; } // 플랜 B 발동
  if (ko.tag === 'safe') s.plan = Math.min(3, s.plan + 1);
  s.mem = clamp(s.mem + ko.m + mo.m - pen, 0, 10);
  s.argos = clamp(s.argos + (ko.a || 0) + (mo.a || 0), -6, 6);
  for (const [r, op] of [['K', ko], ['M', mo]]) {
    s.tags[r][op.tag]++;
    if (op.flag) setFlag(s, op.flag, notes);
    if (op.give) giveItem(s, op.give, notes);
    (op.un || []).forEach(n => unlock(s, n, notes));
  }
  if (ev.flag) setFlag(s, ev.flag, notes);
  [].concat(ev.item || []).forEach(k => giveItem(s, k, notes));
  (ev.un || []).forEach(n => unlock(s, n, notes));
  s.streak = sync ? s.streak + 1 : 0;
  let han = null; if (sync && s.streak >= 3 && s.streak % 2 === 1 && s.hanso < D.hanso.length) { han = s.hanso++; notes.push('한소가 열렸다 (소지품 탭)'); }
  const gain = 1 + (sync ? 1 : 0); s.bp.K += gain; s.bp.M += gain;
  s.journal.push({ d: `${D.ch[s.ch].n} ${s.ei + 1}`, t: ev.t, k: ko.say, m: mo.say, w: 0 });
  if (s.mem <= 6 && s.journal.length > 1) { // 회귀의 여파: 지난 기록 하나가 어긋난다
    const c = s.journal.slice(0, -1).filter(j => !j.w);
    if (c.length) c[Math.floor(Math.random() * c.length)].w = 1;
  }
  s.res = { hg, k: ko.say, m: mo.say, sync, det, han, streak: s.streak, notes, gain, kt: ko.tag, mt: mo.tag };
  s.phase = 'res'; s.intro = false; s.nudge = null;
}

// ── 성 뭉고의 밤 미니게임
const makeTri = () => ({ ap: { K: 3, M: 2 }, done: false, saved: 0,
  pts: [['아이린', '위독'], ['오웬', '위독'], ['마리', '중상'], ['토비', '중상'], ['헬렌', '경상'], ['레오', '경상']].map(([n, lv]) => ({ n, lv, c: lv === '위독' ? 2 : 1, st: '' })) });
function triEnd(s) { const t = s.tri; if (!t || t.done) return; t.done = true; t.saved = t.pts.filter(p => p.st === 'saved').length;
  if (t.saved >= 4) s.bond += 2; if (t.saved <= 2) { s.mem = clamp(s.mem - 1, 0, 10); s.flags.tri_few = 1; }
  if (t.saved === 6) s.flags.tri_all = 1; }

function next(s) {
  s.pick = {}; s.res = null; s.phase = 'scene'; s.ei++; s.nudge = null;
  for (;;) {
    const c = D.ch[s.ch]; if (!c) break;
    if (s.ei >= c.ev.length) { s.ch++; s.ei = 0; s.intro = true; s.mem = Math.min(10, s.mem + 2); checkQuests(s); continue; }
    if (chk(s, c.ev[s.ei].if)) break;
    s.ei++;
  }
  if (s.ch >= D.ch.length) { s.phase = 'end'; s.end = D.ending(s); s.again = {}; if (!s.endings.includes(s.end[3])) s.endings.push(s.end[3]); }
  else if (cur(s).tri) s.tri = makeTri();
}

const toolsFor = (s, role) => D.tools.filter(t => t.r === role && (!t.req || s.items.includes(t.req))).map(t => t.v);

function act(s, role, m) {
  const ev = cur(s);
  if (m.a === 'pick' && s.phase === 'scene' && ev) {
    const op = ev[role][m.i]; if (!op || !chk(s, op.if, role) || s.pick[role] != null) return;
    if (ev.tri && s.tri && !s.tri.done) return;
    s.pick[role] = m.i;
    if (s.pick.K != null && s.pick.M != null) resolve(s, ev);
  } else if (m.a === 'next' && s.phase === 'res') next(s);
  else if (m.a === 'nudge' && s.phase === 'scene' && D.nudges[m.i]) s.nudge = { r: role, i: m.i };
  else if (m.a === 'verify' && role === 'K') { const w = s.journal.find(j => j.w); if (w) { w.w = 0; s.mem = clamp(s.mem + 1, 0, 10); } }
  else if (m.a === 'tri' && s.tri && !s.tri.done && ev && ev.tri) { const t = s.tri, p = t.pts[m.i]; if (!p) return;
    if (role === 'K' && p.st !== 'saved') { const c = p.st === 'carried' ? 1 : p.c; if (t.ap.K >= c) { t.ap.K -= c; p.st = 'saved'; } }
    else if (role === 'M' && p.st === '' && t.ap.M >= 1) { t.ap.M--; p.st = 'carried'; }
    if (t.ap.K <= 0 || t.pts.every(x => x.st === 'saved')) triEnd(s); }
  else if (m.a === 'triend' && s.tri && ev && ev.tri) triEnd(s);
  else if (m.a === 'look' && s.phase !== 'end') { const key = s.ch + '-' + s.ei, L = s.looked[key] || (s.looked[key] = []);
    if (L.includes(role)) return; L.push(role);
    const c = D.sky.find(x => !s.sky.includes(x[0]) && x[2] <= s.ch); if (c) s.sky.push(c[0]);
    if (L.length === 2 && !s.lb[s.ch]) { s.lb[s.ch] = 1; s.bond++; } }
  else if (m.a === 'trace' && s.sky.includes(m.n) && !s.traced.includes(m.n) && D.sky.some(x => x[0] === m.n)) { s.traced.push(m.n); s.bond++; }
  else if (m.a === 'stairs' && Number.isInteger(m.sc) && m.sc > s.stairs && m.sc <= 5) { if (m.sc >= 3 && s.stairs < 3) s.bond++; if (m.sc === 5) s.mem = clamp(s.mem + 1, 0, 10); s.stairs = m.sc; }
  else if (m.a === 'hadd' && m.t && s.custom.length < 80) s.custom.push({ r: role, t: String(m.t).slice(0, 120) });
  else if (m.a === 'hdel' && s.custom[m.i] && s.custom[m.i].r === role) s.custom.splice(m.i, 1);
  else if (m.a === 'place' && Number.isInteger(m.i) && m.i >= 0 && m.i < 48) {
    const cell = s.grid[m.i], v = m.v;
    if (cell && !OWN[role].includes(cell)) return;              // 상대의 조각은 건드릴 수 없다
    if (v === '') { if (cell) { s.grid[m.i] = ''; s.bp[role]++; } }
    else if (toolsFor(s, role).includes(v)) { if (cell === v) return; if (!cell) { if (s.bp[role] < 1) return; s.bp[role]--; } s.grid[m.i] = v; }
    else return;
    checkQuests(s); }
  else if (m.a === 'promise' && m.t && s.promises.length < 16 && s.promises.filter(p => p.r === role && p.c === s.ch).length < 2) {
    s.promises.push({ t: String(m.t).slice(0, 40), r: role, c: s.ch, x: 0.08 + Math.random() * 0.84, y: 0.22 + Math.random() * 0.68 }); s.bond++; }
  else if (m.a === 'name' && (D.names[role] || []).includes(m.n) && s.un.includes(m.n) && !s.names.includes(role + ':' + m.n)) { s.names.push(role + ':' + m.n); s.bond++; }
  else if (m.a === 'letter' && D.letters[m.c] && D.letters[m.c][m.i] && m.c <= s.ch && m.t && String(m.t).trim()
    && !s.letters.some(l => l.r === role && l.c === m.c && l.i === m.i)) { s.letters.push({ r: role, c: m.c, i: m.i, t: String(m.t).trim().slice(0, 160) }); s.bond++; }
  else if (m.a === 'again' && s.phase === 'end') { s.again[role] = true;
    if (s.again.K && s.again.M) { const keep = { endings: s.endings, runs: s.runs + 1 }; for (const k of Object.keys(s)) delete s[k]; Object.assign(s, fresh(), keep); } }
}

// ── 클라이언트로 보내는 정적 데이터 (입장할 때 한 번)
const PUB = { items: D.items, timeline: D.timeline, hanso: D.hanso, sky: D.sky, letters: D.letters, names: D.names, tools: D.tools,
  quests: D.quests.map(({ id, t, d, ch, bond }) => ({ id, t, d, ch, bond })), endings: D.endingList, friends: D.friends, nudges: D.nudges,
  tagInfo: D.tagInfo, heartStages: D.heartStages, chapters: D.ch.map(c => ({ n: c.n, y: c.y, yr: c.yr, intro: c.intro })) };

function view(s, role, withD) {
  const e = cur(s), { pick, ...rest } = s, c = D.ch[Math.min(s.ch, D.ch.length - 1)];
  const o = e && e[role].map(op => { const ok = chk(s, op.if, role); return { l: ok ? op.l : '???', tag: op.tag, lock: !ok, hint: ok ? '' : hintOf(op.if) }; });
  return { role, s: rest, RN, ev: e && { t: e.t, s: e.s, o, tri: !!e.tri }, my: pick[role] == null ? null : pick[role], picked: { K: pick.K != null, M: pick.M != null },
    n: c.ev.length, fac: c.fac ? { K: '컨티눔 · 성 뭉고 치료사', M: '판테온의 수장' } : null, dream: D.dreamStat(s.grid),
    tools: toolsFor(s, role), looked: s.looked[s.ch + '-' + s.ei] || [], D: withD ? PUB : undefined };
}
function send(code, withD) {
  const r = rooms[code]; if (!r) return;
  for (const [role, ws] of Object.entries(r.ws)) if (ws.readyState === 1)
    ws.send(JSON.stringify({ code, online: Object.keys(r.ws).filter(k => r.ws[k].readyState === 1), ...view(r.s, role, withD) }));
}

wss.on('connection', ws => {
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.a === 'ping') return;
    if (m.a === 'join') {
      const code = (String(m.code || '').toUpperCase().replace(/[^A-Z0-9가-힣]/g, '').slice(0, 6)) || Math.random().toString(36).slice(2, 6).toUpperCase();
      if (!RN[m.role]) return ws.send(JSON.stringify({ err: '잘못된 요청이에요.' }));
      const r = rooms[code] || (rooms[code] = { s: fresh(), ws: {} }), old = r.ws[m.role];
      if (old && old.readyState === 1) { if (old.tok && old.tok === m.tok) old.terminate(); else return ws.send(JSON.stringify({ err: '이미 사용 중인 역할이에요.' })); }
      ws.tok = m.tok; r.ws[m.role] = ws; ws.room = code; ws.role = m.role; save(); return send(code, true);
    }
    const r = rooms[ws.room]; if (!r) return;
    act(r.s, ws.role, m); save(); send(ws.room);
  });
  ws.on('close', () => { const r = rooms[ws.room]; if (r && r.ws[ws.role] === ws) { delete r.ws[ws.role]; send(ws.room); } });
});
setInterval(() => wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }), 30000);
srv.listen(process.env.PORT || 3000, () => console.log('루미아 서버: http://localhost:' + (process.env.PORT || 3000)));
