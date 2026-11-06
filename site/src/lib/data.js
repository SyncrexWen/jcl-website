import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { swissTable, swissComplete, swissGroups, knockoutView } from './standings.js';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'src', 'data');
const readJ = (...p) => JSON.parse(fs.readFileSync(path.join(DATA, ...p), 'utf8'));

export const heroes = readJ('heroes.json');
export const items = readJ('items.json');
export const heroMap = Object.fromEntries(heroes.map(h => [h.id, h]));
export const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
export const ROLES = ['对抗路', '中路', '发育路', '打野', '游走'];
export const ROLE_COLOR = { 对抗路: '#e0875a', 中路: '#9b7be0', 发育路: '#e0c35a', 打野: '#5ac08a', 游走: '#5aa7e0' };

export const seasons = () => readJ('seasons.json');
export const currentSeason = () => (seasons().find(s => s.current) || seasons()[0]);
export const seasonsWithData = () => seasons().filter(s => fs.existsSync(path.join(DATA, s.slug, 'season.json')));

const cache = {};
export function loadSeason(slug) {
  if (cache[slug]) return cache[slug];
  const dir = path.join(DATA, slug);
  const cfg = readJ(slug, 'season.json');
  const teams = readJ(slug, 'teams.json');
  const players = readJ(slug, 'players.json');
  const matches = readJ(slug, 'matches.json');
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]));
  const ko = knockoutView(cfg, teams.map(t => t.id), matches);
  const koMap = Object.fromEntries(ko.nodes.map(n => [n.id, n]));
  const S = {
    slug, cfg, teams, teamMap, players, playerMap, matches, matchMap, ko, koMap,
    swiss: ko.rows, swissDone: ko.complete,
    groups: swissGroups(matches, cfg.swiss),
    news: loadNews(slug),
    rules: loadRules(slug),
  };
  cache[slug] = S;
  return S;
}

// 一场比赛的两侧（队伍或占位文案）
export function sides(S, m) {
  const node = S.koMap[m.id];
  const mk = (tid, i) => tid
    ? { team: S.teamMap[tid], id: tid }
    : { team: null, id: null, label: node ? node.resolved[i].label : '待定' };
  return [mk(m.teamA, 0), mk(m.teamB, 1)];
}

// 新闻
function loadNews(slug) {
  const dir = path.join(ROOT, 'src', 'content', 'news');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const g = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { slug: f.replace(/\.md$/, ''), ...g.data, date: String(g.data.date).slice(0, 10), html: marked.parse(g.content) };
  }).filter(n => n.season === slug).sort((a, b) => b.date.localeCompare(a.date));
}

// 规则文档
function loadRules(slug) {
  const dir = path.join(ROOT, 'src', 'content', 'rules', slug);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const g = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const toc = [];
    const renderer = new marked.Renderer();
    renderer.heading = function (arg1, arg2) {
      const text = typeof arg1 === 'object' ? (arg1.text ?? '') : arg1;
      const depth = typeof arg1 === 'object' ? arg1.depth : arg2;
      const plain = String(text).replace(/<[^>]+>/g, '');
      const id = `s${toc.length + 1}`;
      if (depth <= 2) toc.push({ id, text: plain, depth });
      const inner = typeof arg1 === 'object' && this.parser ? this.parser.parseInline(arg1.tokens) : text;
      return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
    };
    const html = marked.parse(g.content, { renderer });
    return { slug: f.replace(/\.md$/, ''), ...g.data, toc, html };
  }).sort((a, b) => (a.order ?? 9) - (b.order ?? 9));
}

/* ------- 展示工具 ------- */
const WD = ['日', '一', '二', '三', '四', '五', '六'];
export function dparts(iso) {
  const d = new Date(iso);
  const bj = new Date(d.getTime() + 8 * 3600e3);
  const p = n => String(n).padStart(2, '0');
  return { date: `${bj.getUTCMonth() + 1}月${bj.getUTCDate()}日`, ymd: `${bj.getUTCFullYear()}-${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())}`, wd: `周${WD[bj.getUTCDay()]}`, time: `${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}` };
}
export const fmtDur = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const fmtK = n => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
export const STATUS = { finished: '已结束', live: '进行中', scheduled: '未开始' };
export const STAGE_NAME = { swiss: '瑞士轮', knockout: '双败淘汰' };
export const sc = (m, side) => (side === 0 ? m.scoreA : m.scoreB);

export function teamRecord(S, tid) {
  const ms = S.matches.filter(m => m.status === 'finished' && (m.teamA === tid || m.teamB === tid));
  let w = 0, l = 0, gw = 0, gl = 0;
  for (const m of ms) { const a = m.teamA === tid; if (m.winner === tid) w++; else l++; gw += a ? m.scoreA : m.scoreB; gl += a ? m.scoreB : m.scoreA; }
  return { w, l, gw, gl, played: ms.length };
}
export function teamOutcome(S, tid) {
  const r = S.swiss.find(x => x.id === tid);
  if (!r) return '';
  if (r.status === 'eliminated') return `瑞士轮第 ${r.rank} 名 · 止步`;
  if (r.status === 'advanced') {
    const n = S.ko.nodes.find(x => [x.match?.teamA, x.match?.teamB].includes(tid) && x.group !== undefined);
    return `瑞士轮第 ${r.rank} 名 · 晋级淘汰赛`;
  }
  return '瑞士轮进行中';
}
export function h2h(S, a, b, exceptId) {
  return S.matches.filter(m => m.status === 'finished' && m.id !== exceptId && ((m.teamA === a && m.teamB === b) || (m.teamA === b && m.teamB === a)));
}
// 一场比赛的去向（由对阵树推出）
export function routeOf(S, id) {
  const node = S.koMap[id];
  const out = { win: null, lose: null };
  for (const n of S.ko.nodes) for (const s of n.slots) if (s.match === id) out[s.take === 'winner' ? 'win' : 'lose'] = n.name;
  if (node) { if (!out.win && node.winnerPlace) out.win = node.winnerPlace; if (!out.lose && node.place) out.lose = `淘汰 · ${node.place}`; }
  return out;
}
export function matchMvp(S, m) {
  const c = {};
  for (const g of m.games) for (const s of ['A', 'B']) for (const p of g[s]?.players || []) if (p.mvp) c[p.player] = (c[p.player] || 0) + 1;
  const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return e ? S.playerMap[e[0]] : null;
}
