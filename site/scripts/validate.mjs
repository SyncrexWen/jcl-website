// 数据校验：用中文给出错误清单（给赛事组看的）。有错误则退出码 1，构建中止，线上保留上一个可用版本。
import fs from 'node:fs';
import path from 'node:path';

const DATA = path.resolve('src/data');
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const heroes = Object.fromEntries(J(path.join(DATA, 'heroes.json')).map(h => [h.id, h]));
const items = Object.fromEntries(J(path.join(DATA, 'items.json')).map(i => [i.id, i]));
const seasons = J(path.join(DATA, 'seasons.json'));
const errors = [], warns = [];
let nGames = 0, nMatches = 0;

for (const s of seasons) {
  const dir = path.join(DATA, s.slug);
  if (!fs.existsSync(path.join(dir, 'season.json'))) { warns.push(`[${s.slug}] 赛季尚无数据（可能为筹备中）`); continue; }
  const cfg = J(path.join(dir, 'season.json'));
  const teams = Object.fromEntries(J(path.join(dir, 'teams.json')).map(t => [t.id, t]));
  const players = Object.fromEntries(J(path.join(dir, 'players.json')).map(p => [p.id, p]));
  const matches = J(path.join(dir, 'matches.json'));
  const E = (m, msg) => errors.push(`[${s.slug}] 比赛 ${m.id}：${msg}`);
  const ids = new Set();
  for (const m of matches) {
    nMatches++;
    if (ids.has(m.id)) E(m, '比赛编号重复');
    ids.add(m.id);
    for (const k of ['teamA', 'teamB']) if (m[k] && !teams[m[k]]) E(m, `${k} 的战队编号 ${m[k]} 不存在`);
    if (m.teamA && m.teamA === m.teamB) E(m, '同一支队伍自己对阵自己');
    const need = (m.bo + 1) / 2;
    let wa = 0, wb = 0; const lockedAll = new Set(); const replaced = { A: new Set(), B: new Set() }; let prevLineup = null;
    m.games.forEach((g, gi) => {
      nGames++;
      if (g.no !== gi + 1) E(m, `第 ${gi + 1} 个小场的序号应为 ${gi + 1}，实际为 ${g.no}`);
      if (g.peak !== (m.bo === 7 && g.no === 7)) E(m, `第 ${g.no} 局"巅峰对决"标记不正确（仅 BO7 的第 7 局为巅峰对决）`);
      if (wa >= need || wb >= need) E(m, `比分已分出胜负后仍有第 ${g.no} 局数据`);
      if (g.status === 'finished') { if (g.winner === 'A') wa++; else if (g.winner === 'B') wb++; else E(m, `第 ${g.no} 局缺少胜方`); }
      const lineup = { A: {}, B: {} }; const picksThis = new Set();
      for (const side of ['A', 'B']) {
        const d = g[side]; const tid = side === 'A' ? m.teamA : m.teamB;
        if (!d) { E(m, `第 ${g.no} 局缺少 ${side} 方数据`); continue; }
        if (g.peak && d.bans.length) E(m, `第 ${g.no} 局为巅峰对决，不应有禁用英雄`);
        if (!g.peak && d.bans.length > cfgBans(cfg)) E(m, `第 ${g.no} 局 ${side} 方禁用数 ${d.bans.length} 超过 ${cfgBans(cfg)}`);
        for (const b of d.bans) {
          if (!heroes[b]) E(m, `第 ${g.no} 局禁用了不存在的英雄 ${b}`);
          if (lockedAll.has(b)) E(m, `第 ${g.no} 局禁用的英雄「${heroes[b]?.name}」已在前面的小场被选用（全局BP已锁定）`);
        }
        const roles = new Set();
        for (const p of d.players) {
          if (!heroes[p.hero]) E(m, `第 ${g.no} 局出现不存在的英雄 ${p.hero}`);
          if (lockedAll.has(p.hero)) E(m, `第 ${g.no} 局选用的英雄「${heroes[p.hero]?.name}」违反全局BP：此前小场已被选用`);
          if (picksThis.has(p.hero)) E(m, `第 ${g.no} 局英雄「${heroes[p.hero]?.name}」被重复选用`);
          picksThis.add(p.hero);
          if (d.bans.includes(p.hero)) E(m, `第 ${g.no} 局英雄「${heroes[p.hero]?.name}」既被禁用又被选用`);
          if (roles.has(p.role)) E(m, `第 ${g.no} 局 ${side} 方有两名「${p.role}」`); roles.add(p.role);
          const pl = players[p.player];
          if (!pl) E(m, `第 ${g.no} 局选手 ${p.player} 不在选手表中`);
          else if (pl.team !== tid) E(m, `第 ${g.no} 局选手 ${pl.displayId} 不属于 ${teams[tid]?.name}（名单外选手不得上场）`);
          lineup[side][p.role] = p.player;
          for (const it of p.items || []) if (!items[it]) E(m, `第 ${g.no} 局出现不存在的装备 ${it}`);
        }
        if (d.players.length !== 5) E(m, `第 ${g.no} 局 ${side} 方选手数量应为 5，实际 ${d.players.length}`);
        if (g.status === 'finished') {
          const opp = side === 'A' ? 'B' : 'A';
          const k = d.players.reduce((x, p) => x + p.k, 0), od = g[opp].players.reduce((x, p) => x + p.d, 0);
          if (k !== od) E(m, `第 ${g.no} 局 ${side} 方击杀合计 ${k} 与对方死亡合计 ${od} 不一致`);
        }
      }
      if (prevLineup) for (const side of ['A', 'B']) {
        const prev = new Set(Object.values(prevLineup[side])), cur = new Set(Object.values(lineup[side]));
        for (const p of prev) if (!cur.has(p)) replaced[side].add(p);
        for (const p of cur) if (replaced[side].has(p)) E(m, `第 ${g.no} 局选手 ${players[p]?.displayId} 已被换下，不得在同一系列赛中重新上场`);
      }
      prevLineup = lineup;
      for (const side of ['A', 'B']) for (const p of g[side].players) lockedAll.add(p.hero);
    });
    const maxSubs = m.stage === 'swiss' ? cfg.swiss.maxSubs : cfg.bracket.maxSubs;
    for (const side of ['A', 'B']) if (replaced[side].size > maxSubs) E(m, `${side} 方换人 ${replaced[side].size} 次，超过上限 ${maxSubs} 次`);
    if (m.status === 'finished') {
      if (m.scoreA !== wa || m.scoreB !== wb) E(m, `总比分 ${m.scoreA}:${m.scoreB} 与各小场胜负统计 ${wa}:${wb} 不一致`);
      if (Math.max(wa, wb) !== need) E(m, `BO${m.bo} 的胜方应赢得 ${need} 局，实际 ${wa}:${wb}`);
      if (!m.winner) E(m, '已结束的比赛缺少 winner');
    }
  }
}
function cfgBans(c) { return c.bansPerSide ?? 3; }

warns.forEach(w => console.log('⚠', w));
if (errors.length) {
  console.log(`\n✘ 数据校验未通过，共 ${errors.length} 处问题：`);
  errors.slice(0, 80).forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log(`✔ 数据校验通过：${nMatches} 场比赛、${nGames} 个小场，全局BP、比分、名单、换人次数均无异常。`);
