// lib.js — 콘텐츠 작성용 도우미.
// o(라벨, 태그, 유대, 기억, 대사, 추가옵션)  태그: safe ◈대비 / near ❦곁에 / know ◎알아가기
//   추가옵션: if(숨은 선택지 조건) a(아르고스 저울 ±) flag(기억 플래그) give(소지품) un([열리는 호칭])
// ev(id, 제목, 지문, [케야티 선택], [모르포 선택], 추가)
//   추가: hit(기억 훼손) item(소지품 하나 또는 배열) un([호칭]) flag(플래그) if(이 사건이 나오는 조건) tri(성 뭉고 미니게임)
const o = (l, tag, b, m, say, x) => Object.assign({ l, tag, b, m, say }, x);
const ev = (id, t, s, K, M, x) => Object.assign({ id, t, s, K, M }, x);
module.exports = { o, ev };
