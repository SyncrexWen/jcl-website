// 纯函数：积分榜与对阵路径计算（生成器、校验器、页面共用）

export function swissTable(teamIds, matches, cfg) {
  const rec = Object.fromEntries(teamIds.map(id => [id, { id, w: 0, l: 0, gw: 0, gl: 0, played: 0, opps: [], results: [] }]));
  const h2h = new Map();
  const ms = matches.filter(m => m.stage === 'swiss' && m.status === 'finished' && m.teamA && m.teamB);
  ms.sort((a, b) => a.round - b.round || (a.time || '').localeCompare(b.time || ''));
  for (const m of ms) {
    const a = rec[m.teamA], b = rec[m.teamB];
    if (!a || !b) continue;
    const aw = m.winner === m.teamA;
    a.played++; b.played++;
    a.gw += m.scoreA; a.gl += m.scoreB; b.gw += m.scoreB; b.gl += m.scoreA;
    if (aw) { a.w++; b.l++; } else { b.w++; a.l++; }
    a.opps.push(m.teamB); b.opps.push(m.teamA);
    a.results.push({ id: m.id, round: m.round, opp: m.teamB, win: aw, score: `${m.scoreA}:${m.scoreB}` });
    b.results.push({ id: m.id, round: m.round, opp: m.teamA, win: !aw, score: `${m.scoreB}:${m.scoreA}` });
    h2h.set(m.teamA + '|' + m.teamB, m.winner);
    h2h.set(m.teamB + '|' + m.teamA, m.winner);
  }
  const rows = Object.values(rec).map(r => ({
    ...r,
    diff: r.gw - r.gl,
    status: r.w >= cfg.winsToAdvance ? 'advanced' : r.l >= cfg.lossesToEliminate ? 'eliminated' : 'alive',
  }));
  rows.sort((x, y) =>
    y.w - x.w || x.l - y.l || y.diff - x.diff ||
    (h2h.get(x.id + '|' + y.id) === x.id ? -1 : h2h.get(x.id + '|' + y.id) === y.id ? 1 : 0) ||
    x.id.localeCompare(y.id));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export function swissComplete(rows, cfg) {
  return rows.filter(r => r.status === 'advanced').length === cfg.advance;
}

// 瑞士轮图：按轮次与战绩分组
export function swissGroups(matches, cfg) {
  const ms = matches.filter(m => m.stage === 'swiss');
  const rounds = [];
  for (let r = 1; r <= cfg.rounds; r++) {
    const g = new Map();
    for (const m of ms.filter(x => x.round === r)) {
      const key = m.record || '';
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(m);
    }
    const groups = [...g.entries()]
      .map(([rec, list]) => ({ rec, w: +rec.split('-')[0], l: +rec.split('-')[1], matches: list }))
      .sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.w - a.w);
    rounds.push({ round: r, groups });
  }
  return rounds;
}

// 解析晋级席位
export function resolveSlot(slot, ctx) {
  const { rows, complete, nodeMap, matchMap } = ctx;
  if (slot.seed != null) {
    const t = complete ? rows[slot.seed - 1]?.id : null;
    return { team: t || null, label: `瑞士轮第${slot.seed}名` };
  }
  const node = nodeMap[slot.match];
  const m = matchMap[slot.match];
  const word = slot.take === 'winner' ? '胜者' : '败者';
  let team = null;
  if (m && m.status === 'finished' && m.winner) {
    const loser = m.winner === m.teamA ? m.teamB : m.teamA;
    team = slot.take === 'winner' ? m.winner : loser;
  }
  return { team, label: `${node?.name || slot.match}${word}` };
}

export function knockoutView(cfg, teamIds, matches) {
  const rows = swissTable(teamIds, matches, cfg.swiss);
  const complete = swissComplete(rows, cfg.swiss);
  const nodeMap = Object.fromEntries(cfg.bracket.nodes.map(n => [n.id, n]));
  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]));
  const ctx = { rows, complete, nodeMap, matchMap };
  const nodes = cfg.bracket.nodes.map(n => {
    const slots = n.slots.map(s => resolveSlot(s, ctx));
    return { ...n, resolved: slots, match: matchMap[n.id] || null };
  });
  const edges = [];
  for (const n of cfg.bracket.nodes) {
    for (const s of n.slots) if (s.match) edges.push({ from: s.match, to: n.id, take: s.take });
  }
  return { nodes, edges, rows, complete };
}
