// 模拟数据生成器：固定随机种子，结果可复现。所有队伍/选手/英雄均为虚构。
import fs from 'node:fs';
import path from 'node:path';
import { swissTable, swissComplete, resolveSlot } from '../src/lib/standings.js';

const SLUG = '2026-fall';
const DATA = path.resolve('src/data');
const SEASON_DIR = path.join(DATA, SLUG);
const PUB = path.resolve('public/assets');
const NEWS = path.resolve('src/content/news');

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261106);
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const rf = (a, b) => a + R() * (b - a);
const pick = a => a[Math.floor(R() * a.length)];
const shuffle = a => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
function wpick(items, wf) { const ws = items.map(wf); const tot = ws.reduce((s, v) => s + v, 0); let r = R() * tot; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
function distribute(total, weights, keys) { const out = Object.fromEntries(keys.map(k => [k, 0])); for (let i = 0; i < total; i++) out[wpick(keys, k => weights[k] * rf(0.6, 1.4))]++; return out; }
const pad = (n, w = 2) => String(n).padStart(w, '0');

for (const d of [SEASON_DIR, path.join(PUB, 'teams'), path.join(PUB, 'players'), path.join(PUB, 'heroes'), path.join(PUB, 'items'), NEWS]) {
  fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
}
const write = (p, s) => fs.writeFileSync(p, typeof s === 'string' ? s : JSON.stringify(s, null, 1));

/* ---------------- 英雄 / 装备（全局主表，跨赛季共用） ---------------- */
const ROLES = ['对抗路', '中路', '发育路', '打野', '游走'];
const ROLE_COLOR = { 对抗路: '#e0875a', 中路: '#9b7be0', 发育路: '#e0c35a', 打野: '#5ac08a', 游走: '#5aa7e0' };
const CA = '玄霜炎岚澜曜翎魇辰祁朔漓烬霁昀珩晏榆棠漠苍黎斐沅宸骁翊璟洵'.split('');
const CB = '影刃歌弓盾羽焰渊戟镰笛伞镜铃钥冕杖弩弦钩幡盏'.split('');
const heroNames = new Set();
while (heroNames.size < 125) heroNames.add(pick(CA) + pick(CB));
const heroes = [...heroNames].map((name, i) => ({ id: 'h' + pad(i + 1, 3), name, role: ROLES[i % 5] }));
const heroById = Object.fromEntries(heroes.map(h => [h.id, h]));
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f)))); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
function heroSvg(h) {
  const hs = hash(h.id), base = ROLE_COLOR[h.role], n = 3 + (hs % 6), rot = (hs >> 3) % 360;
  const pts = Array.from({ length: n * 2 }, (_, i) => { const a = (Math.PI * i) / n + (rot * Math.PI) / 180; const r = i % 2 ? 20 : 42; return `${(64 + r * Math.cos(a)).toFixed(1)},${(64 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(base, 1.1)}"/><stop offset="1" stop-color="${shade(base, 0.35)}"/></linearGradient></defs><rect width="128" height="128" rx="22" fill="url(#g)"/><circle cx="64" cy="64" r="52" fill="none" stroke="#ffffff" stroke-opacity=".25" stroke-width="2"/><polygon points="${pts}" fill="#fff" fill-opacity=".88"/><circle cx="64" cy="64" r="9" fill="${shade(base, 0.5)}"/></svg>`;
}
heroes.forEach(h => write(path.join(PUB, 'heroes', h.id + '.svg'), heroSvg(h)));

const itemDefs = {
  phys: ['破晓之刃', '裂空长戟', '赤焰战刃', '无尽之弓', '碎星重锤', '逐风之矢', '猎魔短刀', '烈阳巨剑'],
  magic: ['星陨法典', '幽冥之杖', '时序沙漏', '霜寒水晶', '炽魂权杖', '虚空棱镜', '秘语之书', '碧落冠冕'],
  def: ['不动铠甲', '玄武之盾', '荆棘战衣', '寒冰护符', '圣光披风', '磐石战甲', '反伤棘甲', '守望之盔'],
  boot: ['疾行之靴', '冷静之靴', '抵抗之靴', '破阵之靴'],
  jungle: ['利刃打野刀', '寒冰打野刀', '烈焰打野刀'],
  support: ['守护之环', '先知罗盘', '远征号角'],
};
const ICOLOR = { phys: '#e46a52', magic: '#9a7ae6', def: '#4c9be0', boot: '#54c28a', jungle: '#d9b865', support: '#e08ab8' };
const items = []; let ii = 0;
for (const [cat, names] of Object.entries(itemDefs)) for (const name of names) items.push({ id: 'i' + pad(++ii, 3), name, cat });
function itemSvg(it) {
  const c = ICOLOR[it.cat]; const hs = hash(it.id);
  let g = '';
  if (it.cat === 'phys') g = `<polygon points="64,16 78,70 64,112 50,70" fill="#fff" fill-opacity=".9" transform="rotate(${(hs % 5) * 8 - 16} 64 64)"/><rect x="40" y="72" width="48" height="8" rx="3" fill="#fff" fill-opacity=".7"/>`;
  else if (it.cat === 'magic') g = `<circle cx="64" cy="62" r="26" fill="#fff" fill-opacity=".88"/><circle cx="64" cy="62" r="12" fill="${shade(c, .5)}"/><polygon points="64,14 70,40 64,34 58,40" fill="#fff"/><polygon points="64,110 70,84 64,90 58,84" fill="#fff"/>`;
  else if (it.cat === 'def') g = `<path d="M64 16 L100 30 V64 C100 88 84 104 64 112 C44 104 28 88 28 64 V30 Z" fill="#fff" fill-opacity=".88"/><path d="M64 32 V96" stroke="${shade(c, .5)}" stroke-width="6"/>`;
  else if (it.cat === 'boot') g = `<polygon points="30,84 62,84 62,50 82,50 98,84 98,98 30,98" fill="#fff" fill-opacity=".88"/><polygon points="40,40 56,24 56,40" fill="#fff" fill-opacity=".6"/>`;
  else if (it.cat === 'jungle') g = `<path d="M30 98 C30 50 70 24 100 28 C100 62 78 98 30 98 Z" fill="#fff" fill-opacity=".88"/><path d="M36 92 L88 40" stroke="${shade(c, .5)}" stroke-width="5"/>`;
  else g = `<circle cx="64" cy="64" r="34" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="10"/><rect x="58" y="34" width="12" height="60" rx="3" fill="#fff"/><rect x="34" y="58" width="60" height="12" rx="3" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c, 1.05)}"/><stop offset="1" stop-color="${shade(c, .4)}"/></linearGradient></defs><rect width="128" height="128" rx="22" fill="url(#g)"/>${g}</svg>`;
}
items.forEach(it => write(path.join(PUB, 'items', it.id + '.svg'), itemSvg(it)));
const itemsByCat = c => items.filter(i => i.cat === c).map(i => i.id);
const ROLE_ITEMS = {
  对抗路: () => [...shuffle(itemsByCat('def')).slice(0, 4), ...shuffle(itemsByCat('phys')).slice(0, 1)],
  中路: () => shuffle(itemsByCat('magic')).slice(0, 5),
  发育路: () => shuffle(itemsByCat('phys')).slice(0, 5),
  打野: () => [...shuffle(itemsByCat('phys')).slice(0, 3), ...shuffle(itemsByCat('def')).slice(0, 2)],
  游走: () => [pick(itemsByCat('support')), ...shuffle(itemsByCat('def')).slice(0, 4)],
};
const buildItems = (role, durMin) => {
  const n = durMin < 13 ? 4 : durMin < 16 ? 5 : 6;
  const first = role === '打野' ? pick(itemsByCat('jungle')) : pick(itemsByCat('boot'));
  return [first, ...ROLE_ITEMS[role]()].slice(0, n);
};
write(path.join(DATA, 'heroes.json'), heroes);
write(path.join(DATA, 'items.json'), items);

/* ---------------- 战队 / 选手 ---------------- */
const TEAM_DEF = [
  ['线粒体', 'MIT'], ['核糖体', 'RIB'], ['溶酶体', 'LYS'], ['高尔基体', 'GOL'], ['突触', 'SYN'], ['神经元', 'NEU'], ['胶质细胞', 'GLI'], ['红细胞', 'ERY'],
  ['白细胞', 'LEU'], ['血小板', 'PLT'], ['胰岛素', 'INS'], ['肾上腺', 'ADR'], ['海马', 'HIP'], ['杏仁核', 'AMY'], ['内质网', 'ER'], ['细胞核', 'NUC'],
];
const PAL = [['#2a8794', '#d9b865'], ['#c0504d', '#f3d9a4'], ['#5b6bd6', '#f0e2a8'], ['#2f9e6e', '#f2e3b0'], ['#b5651d', '#fbe6b3'], ['#7a4fb5', '#f1deaa'], ['#2276b8', '#fff1c7'], ['#c23b6e', '#ffe7b5']];
const SHAPES = ['shield', 'hex', 'circle', 'diamond'];
function logoSvg(short, [c1, c2], shape) {
  const shp = { shield: 'M60 8 L108 24 V62 C108 90 88 108 60 116 C32 108 12 90 12 62 V24 Z', hex: 'M60 6 L108 34 V86 L60 114 L12 86 V34 Z', circle: 'M60 8 a52 52 0 1 0 0.01 0 Z', diamond: 'M60 4 L112 60 L60 116 L8 60 Z' }[shape];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${shade(c1, .45)}"/></linearGradient></defs><path d="${shp}" fill="url(#g)" stroke="${c2}" stroke-width="5" stroke-linejoin="round"/><path d="${shp}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2" transform="translate(60 60) scale(.82) translate(-60 -60)"/><text x="60" y="${short.length > 2 ? 70 : 72}" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="${short.length > 2 ? 30 : 38}" fill="#fff" stroke="${shade(c1, .3)}" stroke-width="1">${short}</text></svg>`;
}
const ADJ = ['夜行', '白日', '追光', '沉默', '晚风', '星河', '不眠', '远山', '深海', '雾中'];
const NOUN = ['旅人', '猎手', '船长', '诗人', '药师', '信使', '画师', '守夜人', '骑士', '学徒'];
const SYL = ['Ka', 'Ri', 'To', 'Mi', 'Su', 'No', 'Ve', 'La', 'Zy', 'Or', 'Ex', 'Lu', 'Da', 'Fi', 'Ha', 'Be'];
const usedG = new Set(), usedD = new Set();
function uniq(set, gen) { let v, k = 0; do { v = gen(k++); } while (set.has(v)); set.add(v); return v; }
function avatarSvg(seed, [c1, c2]) {
  const hs = hash(seed); const skin = ['#f2cfa8', '#e8b98a', '#d9a273', '#f6dcc0'][hs % 4]; const hair = ['#2b2118', '#4a3322', '#1b1b2b', '#6b4a2b', '#8a2f2f'][(hs >> 2) % 5];
  const style = (hs >> 5) % 3;
  const hairPath = style === 0 ? 'M34 62 C32 30 52 22 64 22 C80 22 94 32 92 62 C84 46 44 46 34 62Z' : style === 1 ? 'M32 66 C28 26 60 16 74 24 C94 30 98 50 94 66 C90 50 70 40 32 66Z' : 'M36 56 C40 28 88 26 90 56 C80 40 50 38 36 56Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c1, 1.15)}"/><stop offset="1" stop-color="${shade(c1, .4)}"/></linearGradient></defs><rect width="128" height="128" fill="url(#g)"/><circle cx="100" cy="24" r="${14 + (hs % 8)}" fill="${c2}" fill-opacity=".35"/><ellipse cx="64" cy="132" rx="46" ry="34" fill="${shade(c2, .8)}"/><rect x="55" y="82" width="18" height="16" fill="${skin}"/><ellipse cx="64" cy="62" rx="26" ry="30" fill="${skin}"/><path d="${hairPath}" fill="${hair}"/><circle cx="54" cy="64" r="3" fill="#222"/><circle cx="74" cy="64" r="3" fill="#222"/><path d="M56 78 Q64 84 72 78" stroke="#8a4b3b" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
}
const teams = [], players = [];
const strength = {};
TEAM_DEF.forEach(([name, short], i) => {
  const id = 't' + pad(i + 1); const pal = PAL[i % PAL.length]; const shape = SHAPES[i % 4];
  teams.push({ id, name, short, logo: id + '.svg', colors: pal, className: `演示 · ${2022 + (i % 4)}级${['临床', '基础', '预防', '口腔'][i % 4]}${['一', '二'][i % 2]}班`, slogan: pick(['稳扎稳打', '全员在线', '细胞也有梦想', '解剖对手的弱点', '一起上场']), seed: i + 1 });
  write(path.join(PUB, 'teams', id + '.svg'), logoSvg(short, pal, shape));
  strength[id] = 0.25 + R() * 0.55 + (i < 3 ? 0.08 : 0);
  ROLES.concat(['对抗路', '游走']).forEach((role, k) => {
    const pid = `${id}-p${k + 1}`;
    const gameId = uniq(usedG, n => pick(ADJ) + pick(NOUN) + (n > 20 ? ri(2, 99) : ''));
    const displayId = uniq(usedD, n => pick(SYL) + pick(SYL).toLowerCase() + (n > 20 ? ri(1, 9) : ''));
    players.push({ id: pid, team: id, role, isSub: k >= 5, gameId, displayId, avatar: pid + '.svg' });
    write(path.join(PUB, 'players', pid + '.svg'), avatarSvg(pid, pal));
  });
});
const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
const playersOf = tid => players.filter(p => p.team === tid);
const prefW = {}; teams.forEach(t => { prefW[t.id] = Object.fromEntries(heroes.map(h => [h.id, Math.pow(rf(0.25, 1.6), 2)])); });

/* ---------------- 赛季配置 ---------------- */
const cfg = {
  slug: SLUG, name: 'JCL 2026 Fall', shortName: '2026 Fall', game: '王者荣耀', status: 'ongoing', demo: true,
  dates: '演示时间轴 · 2026.10.12 – 11.09', tagline: '这次，该我上场！', bansPerSide: 3, patch: 'DEMO-0.1',
  swiss: { rounds: 5, winsToAdvance: 3, lossesToEliminate: 3, bo: 5, advance: 8, maxSubs: 1 },
  bracket: {
    bo: 7, maxSubs: 2,
    nodes: [
      { id: 'WR1-A', name: '胜者组第一轮', col: 0, row: 0, bo: 7, group: 'w', slots: [{ seed: 1 }, { seed: 4 }] },
      { id: 'WR1-B', name: '胜者组第一轮', col: 0, row: 1, bo: 7, group: 'w', slots: [{ seed: 2 }, { seed: 3 }] },
      { id: 'WF', name: '胜者组决赛', col: 1, row: 0.5, bo: 7, group: 'w', slots: [{ match: 'WR1-A', take: 'winner' }, { match: 'WR1-B', take: 'winner' }] },
      { id: 'LR1-A', name: '败者组第一轮', col: 0, row: 3.4, bo: 7, group: 'l', place: '第7–8名', slots: [{ seed: 5 }, { seed: 8 }] },
      { id: 'LR1-B', name: '败者组第一轮', col: 0, row: 4.4, bo: 7, group: 'l', place: '第7–8名', slots: [{ seed: 6 }, { seed: 7 }] },
      { id: 'LR2-A', name: '败者组第二轮', col: 1, row: 3.4, bo: 7, group: 'l', place: '第5–6名', slots: [{ match: 'WR1-A', take: 'loser' }, { match: 'LR1-A', take: 'winner' }] },
      { id: 'LR2-B', name: '败者组第二轮', col: 1, row: 4.4, bo: 7, group: 'l', place: '第5–6名', slots: [{ match: 'WR1-B', take: 'loser' }, { match: 'LR1-B', take: 'winner' }] },
      { id: 'LSF', name: '败者组半决赛', col: 2, row: 3.9, bo: 7, group: 'l', place: '第4名', slots: [{ match: 'LR2-A', take: 'winner' }, { match: 'LR2-B', take: 'winner' }] },
      { id: 'LF', name: '败者组决赛', col: 3, row: 2.6, bo: 7, group: 'l', place: '第3名', slots: [{ match: 'LSF', take: 'winner' }, { match: 'WF', take: 'loser' }] },
      { id: 'GF', name: '总决赛', col: 4, row: 1.4, bo: 7, group: 'f', place: '亚军', winnerPlace: '冠军', slots: [{ match: 'WF', take: 'winner' }, { match: 'LF', take: 'winner' }] },
    ],
  },
};

/* ---------------- 比赛模拟 ---------------- */
const matches = [];
const BP_ORDER = ['B', 'R', 'R', 'B', 'B', 'R', 'R', 'B', 'B', 'R'];
const iso = (d, h, m = 0) => `2026-${d}T${pad(h)}:${pad(m)}:00+08:00`;

function simGame({ tA, tB, locked, peak, blueSide, bansPer }) {
  const used = new Set(), banned = new Set();
  const heroOk = (r, hid) => heroById[hid].role === r && !locked.has(hid) && !banned.has(hid) && !used.has(hid);
  const side = { A: { bans: [], picks: [] }, B: { bans: [], picks: [] } };
  const sides = blueSide === 'A' ? ['A', 'B'] : ['B', 'A'];
  const sideKey = { B: sides[0], R: sides[1] };
  if (!peak) {
    for (let i = 0; i < bansPer; i++) for (const s of [sides[0], sides[1]]) {
      const opp = s === 'A' ? tB : tA;
      const cand = heroes.filter(h => !locked.has(h.id) && !banned.has(h.id));
      const h = wpick(cand, x => prefW[opp][x.id]); banned.add(h.id); side[s].bans.push(h.id);
    }
    const remaining = { A: shuffle(ROLES), B: shuffle(ROLES) };
    BP_ORDER.forEach((b, idx) => {
      const s = sideKey[b]; const team = s === 'A' ? tA : tB; const role = remaining[s].pop();
      const cand = heroes.filter(h => heroOk(role, h.id)); const h = wpick(cand, x => prefW[team][x.id]);
      used.add(h.id); side[s].picks.push({ role, hero: h.id, order: idx + 1 });
    });
  } else {
    for (const s of ['A', 'B']) { const team = s === 'A' ? tA : tB; for (const role of shuffle(ROLES)) { const cand = heroes.filter(h => heroOk(role, h.id)); const h = wpick(cand, x => prefW[team][x.id]); used.add(h.id); side[s].picks.push({ role, hero: h.id, order: null }); } }
  }
  return { side };
}
function statsFor(g, winnerSide, lineup, dur) {
  const durMin = dur / 60; const kills = {};
  const loserSide = winnerSide === 'A' ? 'B' : 'A';
  const Kw = Math.round(rf(0.9, 1.7) * durMin + 6); const Kl = Math.max(3, Math.round(Kw * rf(0.35, 0.85)));
  kills[winnerSide] = Kw; kills[loserSide] = Kl;
  const KW = { 发育路: .28, 中路: .27, 打野: .22, 对抗路: .15, 游走: .08 }, DW = { 游走: .26, 对抗路: .24, 打野: .18, 发育路: .16, 中路: .16 }, AW = { 游走: .32, 打野: .24, 对抗路: .18, 中路: .14, 发育路: .12 };
  const GW = { 发育路: .23, 中路: .22, 打野: .2, 对抗路: .19, 游走: .16 }, DMG = { 发育路: 3.3, 中路: 3.0, 打野: 1.9, 对抗路: 1.6, 游走: .9 }, TKN = { 对抗路: 3.6, 游走: 3.1, 打野: 2.2, 中路: 1.2, 发育路: 1.0 };
  const out = {};
  for (const s of ['A', 'B']) {
    const opp = s === 'A' ? 'B' : 'A';
    const k = distribute(kills[s], KW, ROLES), d = distribute(kills[opp], DW, ROLES), a = distribute(Math.round(kills[s] * rf(1.5, 2.3)), AW, ROLES);
    const teamGold = durMin * rf(2700, 2950) * (s === winnerSide ? rf(1.06, 1.2) : rf(0.84, 0.95));
    out[s] = g.side[s].picks.map(p => {
      const pl = lineup[s][p.role];
      const gold = Math.round(teamGold * GW[p.role] * rf(0.93, 1.07));
      const dmg = Math.round(gold * DMG[p.role] * rf(0.85, 1.2)), taken = Math.round(gold * TKN[p.role] * rf(0.85, 1.2));
      const rating = Math.max(3, Math.min(10, +(6 + (k[p.role] + 0.6 * a[p.role] - 0.9 * d[p.role]) * 0.28 + (s === winnerSide ? 0.5 : -0.2)).toFixed(1)));
      return { player: pl, hero: p.hero, role: p.role, order: p.order, k: k[p.role], d: d[p.role], a: a[p.role], gold, dmg, taken, rating, items: buildItems(p.role, durMin), mvp: false };
    });
  }
  const best = out[winnerSide].reduce((x, y) => (y.rating > x.rating ? y : x)); best.mvp = true;
  return out;
}

function playSeries({ id, stage, round, label, bo, time, tA, tB, record, status = 'finished', forcePattern, liveAt, maxSubs }) {
  const need = (bo + 1) / 2;
  const lineup = { A: {}, B: {} }; const subs = { A: [], B: [] }; const subCount = { A: 0, B: 0 };
  for (const [s, t] of [['A', tA], ['B', tB]]) { for (const p of playersOf(t).filter(x => !x.isSub)) lineup[s][p.role] = p.id; subs[s] = playersOf(t).filter(x => x.isSub).map(x => x.id); }
  let wa = 0, wb = 0; const locked = new Set(); const games = []; let prevLoser = null;
  const pA = 1 / (1 + Math.exp(-(strength[tA] - strength[tB]) * 3.2));
  const maxGames = status === 'live' ? liveAt : 99;
  for (let no = 1; wa < need && wb < need; no++) {
    if (games.length >= maxGames) break;
    const peak = bo === 7 && no === 7;
    if (no > 1 && !peak) for (const s of ['A', 'B']) if (subCount[s] < (maxSubs ?? 1) && subs[s].length && R() < 0.1) { const role = pick(ROLES); lineup[s][role] = subs[s].shift(); subCount[s]++; }
    const aWins = forcePattern ? forcePattern[no - 1] === 'A' : R() < pA;
    const winnerSide = aWins ? 'A' : 'B';
    const blueSide = peak ? (R() < .5 ? 'A' : 'B') : (prevLoser ? prevLoser : (R() < .5 ? 'A' : 'B'));
    const g = simGame({ tA, tB, locked, peak, blueSide, bansPer: cfg.bansPerSide });
    const dur = ri(11 * 60, 22 * 60);
    const isLiveGame = status === 'live' && no === maxGames;
    const game = { no, peak, blueSide, status: isLiveGame ? 'live' : 'finished' };
    if (isLiveGame) {
      for (const s of ['A', 'B']) game[s] = { bans: g.side[s].bans, players: g.side[s].picks.map(p => ({ player: lineup[s][p.role], hero: p.hero, role: p.role, order: p.order })) };
    } else {
      const st = statsFor(g, winnerSide, lineup, dur);
      game.winner = winnerSide; game.duration = dur;
      game.A = { bans: g.side.A.bans, players: st.A }; game.B = { bans: g.side.B.bans, players: st.B };
      if (aWins) wa++; else wb++;
      prevLoser = aWins ? 'B' : 'A';
    }
    for (const s of ['A', 'B']) game[s].players.forEach(p => locked.add(p.hero));
    games.push(game);
  }
  const m = { id, stage, round, label, bo, status, time, teamA: tA, teamB: tB, scoreA: wa, scoreB: wb, games };
  if (record) m.record = record;
  if (status === 'finished') m.winner = wa > wb ? tA : tB;
  return m;
}

// ---- 瑞士轮 ----
const swissStart = ['10-12', '10-15', '10-19', '10-22', '10-26'];
const dayAdd = (md, n) => { const [mo, d] = md.split('-').map(Number); const dt = new Date(Date.UTC(2026, mo - 1, d + n)); return `${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`; };
const recs = Object.fromEntries(teams.map(t => [t.id, { w: 0, l: 0, opps: new Set() }]));
for (let r = 1; r <= cfg.swiss.rounds; r++) {
  const pools = new Map();
  for (const t of teams) { const c = recs[t.id]; if (c.w >= 3 || c.l >= 3) continue; const k = `${c.w}-${c.l}`; if (!pools.has(k)) pools.set(k, []); pools.get(k).push(t.id); }
  const roundMatches = [];
  for (const [rec, ids] of [...pools.entries()].sort((a, b) => (+b[0][0] - +b[0][2]) - (+a[0][0] - +a[0][2]))) {
    let best = null;
    for (let tries = 0; tries < 200; tries++) { const sh = shuffle(ids); let bad = 0; for (let i = 0; i < sh.length; i += 2) if (recs[sh[i]].opps.has(sh[i + 1])) bad++; if (!best || bad < best.bad) best = { sh, bad }; if (!bad) break; }
    for (let i = 0; i < best.sh.length; i += 2) roundMatches.push({ a: best.sh[i], b: best.sh[i + 1], rec });
  }
  roundMatches.forEach((rm, idx) => {
    const day = dayAdd(swissStart[r - 1], Math.floor(idx / 2));
    const m = playSeries({ id: `SW-R${r}-${pad(idx + 1)}`, stage: 'swiss', round: r, label: `瑞士轮 第${r}轮`, bo: 5, time: iso(day, idx % 2 ? 21 : 19), tA: rm.a, tB: rm.b, record: rm.rec, maxSubs: cfg.swiss.maxSubs });
    matches.push(m);
    const [w, l] = m.winner === rm.a ? [rm.a, rm.b] : [rm.b, rm.a];
    recs[w].w++; recs[l].l++; recs[rm.a].opps.add(rm.b); recs[rm.b].opps.add(rm.a);
  });
}

// ---- 双败 ----
const nodeMap = Object.fromEntries(cfg.bracket.nodes.map(n => [n.id, n]));
const matchMapNow = () => Object.fromEntries(matches.map(m => [m.id, m]));
const schedule = { 'WR1-A': ['11-02', 19], 'WR1-B': ['11-02', 21], 'LR1-A': ['11-03', 19], 'LR1-B': ['11-03', 21], 'LR2-A': ['11-04', 19], 'LR2-B': ['11-04', 21], WF: ['11-05', 20], LSF: ['11-06', 19], LF: ['11-08', 19], GF: ['11-09', 20] };
const koStatus = { 'WR1-A': 'finished', 'WR1-B': 'finished', 'LR1-A': 'finished', 'LR1-B': 'finished', 'LR2-A': 'finished', 'LR2-B': 'finished', WF: 'finished', LSF: 'live', LF: 'scheduled', GF: 'scheduled' };
const forced = { 'WR1-B': { forcePattern: ['A', 'B', 'A', 'B', 'B', 'A', 'A'] }, 'LR2-A': { forcePattern: ['B', 'A', 'A', 'B', 'A', 'B', 'A'] } };
for (const n of ['WR1-A', 'WR1-B', 'LR1-A', 'LR1-B', 'WF', 'LR2-A', 'LR2-B', 'LSF', 'LF', 'GF']) {
  const node = nodeMap[n];
  const rows0 = swissTable(teams.map(t => t.id), matches, cfg.swiss);
  const ctx = { rows: rows0, complete: swissComplete(rows0, cfg.swiss), nodeMap, matchMap: matchMapNow() };
  const [sa, sb] = node.slots.map(s => resolveSlot(s, ctx).team);
  const [d, h] = schedule[n]; const st = koStatus[n];
  if (sa && sb && st !== 'scheduled') {
    matches.push(playSeries({ id: n, stage: 'knockout', round: 0, label: node.name, bo: 7, time: iso(d, h), tA: sa, tB: sb, status: st, liveAt: 3, maxSubs: cfg.bracket.maxSubs, ...(forced[n] || {}) }));
  } else {
    const m = { id: n, stage: 'knockout', round: 0, label: node.name, bo: 7, status: 'scheduled', time: iso(d, h), scoreA: 0, scoreB: 0, games: [] };
    if (sa) m.teamA = sa; if (sb) m.teamB = sb; matches.push(m);
  }
}
matches.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));

write(path.join(SEASON_DIR, 'season.json'), cfg);
write(path.join(SEASON_DIR, 'teams.json'), teams);
write(path.join(SEASON_DIR, 'players.json'), players);
write(path.join(SEASON_DIR, 'matches.json'), matches);
write(path.join(DATA, 'seasons.json'), [
  { slug: SLUG, name: cfg.name, shortName: cfg.shortName, status: 'ongoing', current: true },
  { slug: '2027-spring', name: 'JCL 2027 Spring', shortName: '2027 Spring', status: 'planned', current: false },
]);

/* ---------------- 新闻（由数据生成，保证与比分一致） ---------------- */
const T = id => teamById[id]?.name;
const PL = Object.fromEntries(players.map(p => [p.id, p]));
const mm = Object.fromEntries(matches.map(m => [m.id, m]));
function mvpOf(m) { const c = {}; for (const g of m.games) for (const s of ['A', 'B']) for (const p of g[s].players || []) if (p.mvp) c[p.player] = (c[p.player] || 0) + 1; const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return e ? PL[e[0]] : null; }
const dateOf = m => m.time.slice(0, 10);
const fm = o => '---\n' + Object.entries(o).map(([k, v]) => `${k}: ${Array.isArray(v) ? '[' + v.map(x => JSON.stringify(x)).join(', ') + ']' : JSON.stringify(v)}`).join('\n') + '\n---\n\n';
const swissFin = matches.filter(m => m.status === 'finished' && m.stage === 'swiss');
const sweep = swissFin.filter(m => Math.min(m.scoreA, m.scoreB) === 0).sort((a, b) => a.time.localeCompare(b.time))[0] || swissFin[0];
const r5 = swissFin.filter(m => m.round === 5 && Math.min(m.scoreA, m.scoreB) === 2)[0] || swissFin.filter(m => m.round === 5)[0];
const rowsF = swissTable(teams.map(t => t.id), matches, cfg.swiss);
const top8 = rowsF.slice(0, 8);
const wf = mm['WF'], lr2 = mm['LR2-A'], wr1b = mm['WR1-B'], lsf = mm['LSF'];
const win = m => T(m.winner), los = m => T(m.winner === m.teamA ? m.teamB : m.teamA);
const sc = m => m.winner === m.teamA ? `${m.scoreA}:${m.scoreB}` : `${m.scoreB}:${m.scoreA}`;
const longest = m => { const g = m.games.filter(x => x.duration).sort((a, b) => b.duration - a.duration)[0]; return g ? `第${g.no}局（${Math.floor(g.duration / 60)}分${pad(g.duration % 60)}秒）` : ''; };
const mv = m => { const p = mvpOf(m); return p ? `**${p.displayId}**（${teamById[p.team].name}）` : '—'; };
const news = [
  { slug: '2026-fall-demo-notice', date: '2026-10-08', type: '公告', title: '【演示】JCL 2026 Fall 开赛通知与站点说明', summary: '本站为 JCL 赛事网站演示版，所有队伍、选手、英雄、数据均为虚构。', pinned: true, matches: [], body: `本站为 **JCL（基础杯）赛事网站的演示版本**。\n\n- 页面中的战队、选手、英雄、装备与全部比赛数据均为**模拟生成**，与真实人物和游戏数据无关；\n- 赛制与规则按《JCL赛制说明》《JCL规则声明》设置，规则页内容为真实文档；\n- 正式版将替换为真实数据与素材。\n\n瑞士轮 BO5、双败淘汰 BO7，全局 BP，第七局为巅峰对决。祝各队好运。` },
  { slug: 'swiss-preview', date: '2026-10-11', type: '赛前预告', title: '16 支队伍整装待发：瑞士轮前瞻', summary: '三胜晋级、三败淘汰，前 8 名进入双败淘汰赛。', matches: [], body: `瑞士轮共进行 5 轮，每场 BO5 全局 BP。首轮抽签决定对阵，之后同战绩队伍相遇，**三胜晋级、三败淘汰**。\n\n积分相同时依次比较净胜局、相互对阵战绩，必要时进行 BO1 加赛。第 1–4 名将进入胜者组，第 5–8 名进入败者组。\n\n本届 16 支队伍来自不同班级，谁能在全局 BP 的英雄消耗战里笑到最后？` },
  { slug: 'swiss-sweep', date: dateOf(sweep), type: '战报', title: `${win(sweep)} ${sc(sweep)} 击败 ${los(sweep)}`, summary: `${sweep.label}：${win(sweep)}拿下一场漂亮的胜利。`, matches: [sweep.id], body: `${sweep.label}，**${win(sweep)}** 以 ${sc(sweep)} 战胜 **${los(sweep)}**。\n\n本场最长的一局是${longest(sweep)}。赛后数据显示，本场表现最佳的选手是 ${mv(sweep)}。\n\n点击下方比赛卡片，查看每一局的 BP 与选手数据。` },
  { slug: 'swiss-last-round', date: dateOf(r5), type: '战报', title: `背水一战：${T(r5.teamA)} vs ${T(r5.teamB)}`, summary: `瑞士轮第 5 轮，${win(r5)}以 ${sc(r5)} 拿下关键一场。`, matches: [r5.id], body: `瑞士轮最后一轮，2-2 的两支队伍相遇，胜者晋级、败者淘汰。\n\n**${win(r5)}** 以 ${sc(r5)} 击败 **${los(r5)}**，${longest(r5)}成为本场的转折点。` },
  { slug: 'top8-announced', date: '2026-10-30', type: '公告', title: '瑞士轮收官，八强出炉', summary: `${top8.slice(0, 4).map(r => T(r.id)).join('、')}进入胜者组。`, matches: [], body: `瑞士轮全部结束，晋级双败淘汰赛的八支队伍为：\n\n${top8.map((r, i) => `${i + 1}. **${T(r.id)}**（${r.w}-${r.l}，净胜局 ${r.diff >= 0 ? '+' : ''}${r.diff}）${i < 4 ? '→ 胜者组' : '→ 败者组'}`).join('\n')}\n\n双败淘汰赛全部为 BO7 全局 BP，战至 3:3 时第七局为**巅峰对决**（盲选、无禁用）。` },
  { slug: 'wr1-thriller', date: dateOf(wr1b), type: '战报', title: `七局鏖战！${win(wr1b)} 在巅峰对决中胜出`, summary: `胜者组第一轮：${win(wr1b)} ${sc(wr1b)} ${los(wr1b)}，比赛打满七局。`, matches: [wr1b.id], body: `胜者组第一轮，**${T(wr1b.teamA)}** 与 **${T(wr1b.teamB)}** 把比赛拖进了第七局——**巅峰对决**。双方在互不可见的情况下同时选定阵容，没有禁用阶段。\n\n最终 **${win(wr1b)}** 以 ${sc(wr1b)} 晋级。` },
  { slug: 'wf-report', date: dateOf(wf), type: '战报', title: `胜者组决赛：${win(wf)} ${sc(wf)} 晋级总决赛`, summary: `${win(wf)}率先锁定总决赛席位，${los(wf)}降入败者组决赛。`, matches: [wf.id], body: `胜者组决赛，**${win(wf)}** 以 ${sc(wf)} 击败 **${los(wf)}**，成为第一支晋级总决赛的队伍。**${los(wf)}** 降入败者组决赛，将等待败者组半决赛的胜者。\n\n本场最佳选手：${mv(wf)}。` },
  { slug: 'lr2-report', date: dateOf(lr2), type: '战报', title: `败者组第二轮：${win(lr2)} 淘汰 ${los(lr2)}`, summary: `${los(lr2)}止步第 5–6 名。`, matches: [lr2.id], body: `败者组第二轮，**${win(lr2)}** 以 ${sc(lr2)} 淘汰 **${los(lr2)}**，晋级败者组半决赛；${los(lr2)}获得**第 5–6 名**。` },
  { slug: 'lsf-live', date: '2026-11-06', type: '赛前预告', title: `今晚 19:00：败者组半决赛 ${T(lsf.teamA)} vs ${T(lsf.teamB)}`, summary: '胜者将在败者组决赛迎战胜者组决赛的失利方。', matches: [lsf.id], body: `败者组半决赛今晚打响，BO7 全局 BP。胜者晋级败者组决赛，**败者获得第 4 名**。\n\n两队此前的表现请见比赛页。` },
  { slug: 'captain-interview', date: '2026-11-01', type: '专访', title: '【演示】专访：全局 BP 下，英雄池就是生命线', summary: '一支队伍队长谈全局 BP 的准备思路。', matches: [], body: `> 以下为演示用虚构访谈，用于展示"专访"类型的文章排版。\n\n**问：全局 BP 对准备最大的影响是什么？**\n\n答：BO5、BO7 打下来，十个英雄会被一局局"消耗"。所以不能只会三五个招牌英雄，每个位置都要准备足够深的英雄池。\n\n**问：巅峰对决怎么准备？**\n\n答：盲选没有禁用，反而更考验"默契"。我们会在训练里专门做盲选模拟。` },
];
for (const n of news) write(path.join(NEWS, n.slug + '.md'), fm({ title: n.title, date: n.date, type: n.type, season: SLUG, summary: n.summary, matches: n.matches, pinned: !!n.pinned }) + n.body + '\n');

console.log(`✔ 生成完成：${teams.length} 队 / ${players.length} 选手 / ${heroes.length} 英雄 / ${items.length} 装备 / ${matches.length} 场比赛 / ${news.length} 篇新闻`);
