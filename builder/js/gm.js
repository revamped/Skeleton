/*
 * Game Master tools: the party, encounter builder with difficulty, initiative
 * tracker, and creature builder. Rules live in gm-rules.js; shared UI helpers
 * come from app.js through DND.ui.
 */
(function () {
  var D = window.DND;
  var gm = D.gm = {};
  function U() { return D.ui; }
  function esc(s) { return U().esc(s); }
  function $(sel) { return document.querySelector(sel); }
  function find(list, id) { return U().find(list || [], id); }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function num(v, lo, hi, dflt) { var n = parseInt(v, 10); if (isNaN(n)) n = dflt; return Math.max(lo, Math.min(hi, n)); }
  var armed = '';   // id of the thing whose Delete button is waiting for a second click

  /* ---------- State ---------- */

  function state() {
    var a = U().app;
    if (!a.gm) a.gm = {};
    var g = a.gm;
    if (!Array.isArray(g.party)) g.party = [];
    if (!Array.isArray(g.encounters)) g.encounters = [];
    if (!Array.isArray(g.creatures)) g.creatures = [];
    if (!g.quick) g.quick = { size: 4, level: 1 };
    if (!g.opts) g.opts = { rollHp: false, group: true };
    return g;
  }
  gm.state = state;
  gm.sync = function () { D.syncCustomMonsters(state().creatures); };
  function text(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : typeof v === 'number' ? String(v) : ''; }
  // Repair one imported record (kind: 'encounters' | 'creatures' | 'party'); null if it can't be used.
  gm.clean = function (kind, x) {
    if (!x || typeof x !== 'object' || !text(x.id, 40)) return null;
    if (kind === 'party') {
      return x.buildId ? { id: text(x.id, 40), buildId: text(x.buildId, 40) } :
        { id: text(x.id, 40), name: text(x.name, 40), level: num(x.level, 1, 20, 1), ac: x.ac === '' || x.ac == null ? '' : num(x.ac, 0, 99, 10), hp: x.hp === '' || x.hp == null ? '' : num(x.hp, 0, 9999, 1), init: num(x.init, -20, 99, 0), pp: x.pp === '' || x.pp == null ? '' : num(x.pp, 0, 99, 10) };
    }
    if (kind === 'encounters') {
      return { id: text(x.id, 40), name: text(x.name, 60) || 'Encounter', notes: text(x.notes, 5000), run: null,   // a fight in progress isn't carried over
        monsters: (Array.isArray(x.monsters) ? x.monsters : []).filter(function (m) { return m && typeof m.id === 'string'; }).map(function (m) {
          return { id: m.id, count: num(m.count, 1, 99, 1), name: text(m.name, 80), cr: D.crKey(m.cr) }; }) };
    }
    var c = D.newCreatureModel(), list = function (v) {
      return (Array.isArray(v) ? v : []).filter(function (e) { return e && typeof e === 'object'; }).slice(0, 40).map(function (e) { return { name: text(e.name, 80), text: text(e.text, 4000) }; }); };
    c.id = text(x.id, 40); c.name = text(x.name, 80) || 'Creature';
    c.size = D.HIT_DIE_BY_SIZE[x.size] ? x.size : 'M'; c.type = D.CREATURE_TYPES.indexOf(x.type) >= 0 ? x.type : 'Humanoid'; c.cr = D.crKey(x.cr);
    ['align', 'acNote', 'speed', 'skill', 'senses', 'languages', 'vulnerable', 'resist', 'immune', 'condImmune'].forEach(function (k) { c[k] = text(x[k], 300); });
    c.ac = num(x.ac, 1, 40, 10); c.hd = num(x.hd, 0, 99, 0); c.hp = num(x.hp, 1, 9999, 1);
    D.ABILITIES.forEach(function (a) { c[a] = num(x[a], 1, 30, 10); });
    c.saves = (Array.isArray(x.saves) ? x.saves : []).filter(function (a) { return D.ABILITIES.indexOf(a) >= 0; });
    ['trait', 'action', 'bonus', 'reaction', 'legendary'].forEach(function (k) { c[k] = list(x[k]); });
    return c;
  };
  function curEnc() { var g = state(); return find(g.encounters, g.cur) || g.encounters[0] || null; }
  function curCreature() { var g = state(); return find(g.creatures, g.editing) || null; }

  /* ---------- Party ---------- */

  var evalMemo = {};
  function buildStats(b) {
    var key = JSON.stringify(b), hit = evalMemo[b.id];
    if (hit && hit.key === key) return hit.val;
    var ev = D.evaluate(b), lv = ev.levels[b.level - 1], d = lv.d, p = b.play || {};
    var val = { name: b.name || 'Unnamed', level: b.level, ac: d.ac + (p.acBonus || 0), hp: d.hp, hpNow: p.hp == null ? d.hp : Math.max(0, Math.min(p.hp, d.hp)), init: d.init, pp: d.passivePerception, cls: ev.cls.name };
    evalMemo[b.id] = { key: key, val: val };
    return val;
  }
  // Party members with their numbers: linked characters read them from the build.
  function partyStats() {
    var g = state(), builds = U().app.builds;
    if (!g.party.length) {
      return Array.from({ length: num(g.quick.size, 1, 12, 4) }, function (_, i) {
        return { id: 'quick' + i, name: 'Character ' + (i + 1), level: num(g.quick.level, 1, 20, 1), ac: null, hp: null, hpNow: null, init: 0, pp: null, quick: true };
      });
    }
    return g.party.map(function (m) {
      var b = m.buildId && find(builds, m.buildId);
      if (b) { var s = buildStats(b); return Object.assign({ id: m.id, linked: true, buildId: b.id }, s); }
      return { id: m.id, name: m.name || 'Character', level: num(m.level, 1, 20, 1), ac: m.ac ? +m.ac : null, hp: m.hp ? +m.hp : null, hpNow: m.hp ? +m.hp : null, init: +m.init || 0, pp: m.pp ? +m.pp : null, missing: !!m.buildId };
    });
  }
  function partyLevels() { return partyStats().map(function (p) { return p.level; }); }
  function partyLine() {
    var ps = partyStats(), lv = ps.map(function (p) { return p.level; });
    var avg = lv.reduce(function (a, b) { return a + b; }, 0) / lv.length;
    return ps.length + ' character' + (ps.length === 1 ? '' : 's') + ', ' + (Math.min.apply(null, lv) === Math.max.apply(null, lv) ? 'level ' + lv[0] : 'average level ' + (Math.round(avg * 10) / 10));
  }
  function budgetHtml(levels) {
    var d = D.encounterDifficulty(levels, []);
    return '<div class="budget-row">' + D.DIFFICULTY.map(function (x, i) {
      return '<div class="stat-box tier-' + i + '"><span class="eyebrow">' + x[0] + '</span><b>' + d.budget[i].toLocaleString() + '</b><small>XP budget</small></div>';
    }).join('') + '</div>';
  }

  function renderParty() {
    var g = state(), ui = U(), builds = ui.app.builds, ps = partyStats();
    var free = builds.filter(function (b) { return !g.party.some(function (m) { return m.buildId === b.id; }); });
    var rows = g.party.map(function (m, i) {
      var s = ps[i];
      function cell(k, v, w) { return '<td class="n"><label class="sr" for="pm-' + k + '-' + i + '">' + k + '</label><input class="qty" style="width:' + (w || 64) + 'px" id="pm-' + k + '-' + i + '" type="number" inputmode="numeric" value="' + esc(v == null ? '' : v) + '" data-gmf="party" data-id="' + esc(m.id) + '" data-k="' + k + '"></td>'; }
      if (s.linked) {
        return '<tr><td>' + esc(s.name) + ' <span class="pill pill-ok">linked</span> <span class="muted">' + esc(s.cls) + '</span></td><td class="n">' + s.level + '</td><td class="n">' + s.ac + '</td><td class="n">' + s.hp + '</td><td class="n">' + ui.sign(s.init) + '</td><td class="n">' + s.pp + '</td>' +
          '<td class="n"><button type="button" class="btn btn-small" data-gm="party-rm" data-id="' + esc(m.id) + '" aria-label="Remove ' + esc(s.name) + '">×</button></td></tr>';
      }
      return '<tr><td><label class="sr" for="pm-name-' + i + '">Name</label><input id="pm-name-' + i + '" type="text" maxlength="40" value="' + esc(m.name || '') + '" data-gmf="party" data-id="' + esc(m.id) + '" data-k="name">' +
        (s.missing ? ' <span class="pill pill-todo">character deleted</span>' : '') + '</td>' + cell('level', m.level, 56) + cell('ac', m.ac) + cell('hp', m.hp) + cell('init', m.init) + cell('pp', m.pp) +
        '<td class="n"><button type="button" class="btn btn-small" data-gm="party-rm" data-id="' + esc(m.id) + '" aria-label="Remove ' + esc(m.name || 'character') + '">×</button></td></tr>';
    }).join('');
    var table = g.party.length ? '<div class="table-wrap"><table class="gm-table"><thead><tr><th>Character</th><th class="n">Level</th><th class="n">AC</th><th class="n">HP</th><th class="n">Init</th><th class="n">Passive Perc.</th><th class="n"></th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
      '<p class="desc">No party yet, so encounters are balanced for a quick party:</p><div class="gear-grid" style="max-width:360px">' +
      '<div class="field"><label for="q-size">Characters</label><input id="q-size" type="number" min="1" max="12" value="' + g.quick.size + '" data-gmf="quick" data-k="size"></div>' +
      '<div class="field"><label for="q-level">Level</label><input id="q-level" type="number" min="1" max="20" value="' + g.quick.level + '" data-gmf="quick" data-k="level"></div></div>';
    return '<div class="toolbar"><h2>Party</h2><span class="muted" id="gm-party-line">' + esc(partyLine()) + '</span></div>' +
      '<section class="card"><div class="card-head"><h3>Characters</h3><span class="muted">Used to balance encounters and fill the initiative tracker</span></div><div class="card-body">' + table +
      '<div class="chips" style="margin-top:12px">' + (free.length ? '<label class="sr" for="party-build">Your characters</label><select id="party-build" style="width:auto">' + free.map(function (b) {
        return '<option value="' + esc(b.id) + '">' + esc(b.name || 'Unnamed') + ' · level ' + b.level + '</option>'; }).join('') + '</select><button type="button" class="btn btn-primary" data-gm="party-link">Add this character</button>' : '') +
      '<button type="button" class="btn" data-gm="party-add">Add a player by hand</button></div>' +
      '<p class="desc">Linked characters are the ones saved in this app: their level, AC, HP, initiative and Passive Perception follow the character. Add other players by hand.</p></div></section>' +
      '<section class="card"><div class="card-head"><h3>XP budget for this party</h3><span class="muted">2024 encounter rules</span></div><div class="card-body"><div id="gm-party-budget">' + budgetHtml(partyLevels()) + '</div>' +
      '<p class="desc">Add up the XP of the creatures in an encounter and compare it with these budgets. ' + D.DIFFICULTY.map(function (x) { return '<b>' + x[0] + ':</b> ' + esc(x[1]); }).join(' ') + '</p></div></section>';
  }

  /* ---------- Encounters ---------- */

  function encMonsters(enc) {
    return (enc.monsters || []).map(function (em) {
      var m = D.monster(em.id);
      return { em: em, m: m, name: m ? m.name : em.name || em.id, cr: m ? D.crKey(m.cr) : em.cr || '0', count: num(em.count, 1, 99, 1) };
    });
  }
  function encDifficulty(enc) { return D.encounterDifficulty(partyLevels(), encMonsters(enc).map(function (x) { return { cr: x.cr, count: x.count }; })); }
  function meterHtml(d) {
    var max = Math.max(d.budget[2] * 1.25, d.xp * 1.05, 1), pct = function (v) { return Math.min(100, v / max * 100); };
    var tone = d.tier < 0 ? 'none' : ['low', 'mod', 'high', 'over'][d.tier];
    return '<div class="enc-meter" role="img" aria-label="' + esc(d.xp.toLocaleString() + ' XP: ' + (d.label || 'no creatures')) + '">' +
      '<div class="enc-bar"><span class="enc-fill t-' + tone + '" style="width:' + pct(d.xp) + '%"></span>' +
      d.budget.map(function (b, i) { return '<span class="enc-tick tick-' + i + '" style="left:' + pct(b) + '%"><i>' + D.DIFFICULTY[i][0] + '<br>' + b.toLocaleString() + '</i></span>'; }).join('') + '</div></div>';
  }
  function difficultyHtml(enc) {
    var d = encDifficulty(enc);
    var left = d.budget.map(function (b, i) { return D.DIFFICULTY[i][0] + ' ' + (b - d.xp >= 0 ? (b - d.xp).toLocaleString() + ' XP left' : 'over by ' + (d.xp - b).toLocaleString()); }).join(' · ');
    return '<div class="enc-head"><div><span class="eyebrow">Encounter XP</span><b class="enc-xp">' + d.xp.toLocaleString() + '</b></div>' +
      (d.tier >= 0 ? '<span class="pill diff-' + d.tier + '">' + esc(d.label) + '</span>' : '<span class="pill pill-plain">Add creatures</span>') +
      '<span class="muted">' + d.count + ' creature' + (d.count === 1 ? '' : 's') + ' vs ' + esc(partyLine()) + '</span></div>' + meterHtml(d) +
      (d.tier >= 0 ? '<p class="desc"><b>' + esc(d.label) + '.</b> ' + esc(d.desc) + ' Each character earns <b>' + d.perCharacter.toLocaleString() + ' XP</b> if the party wins.</p>' : '') +
      '<p class="desc muted">' + esc(left) + '</p>' +
      (d.notes.length ? '<ul class="warn-list">' + d.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '');
  }

  function renderEncounters() {
    var g = state(), ui = U(), enc = curEnc();
    var picker = g.encounters.length ? '<label class="sr" for="enc-select">Encounter</label><select id="enc-select" data-gmf="enc-select" style="width:auto;max-width:100%">' + g.encounters.map(function (e) {
      var d = encDifficulty(e);
      return '<option value="' + esc(e.id) + '"' + (enc && e.id === enc.id ? ' selected' : '') + '>' + esc(e.name || 'Encounter') + (d.tier >= 0 ? ' · ' + d.label : '') + (e.run ? ' · running' : '') + '</option>'; }).join('') + '</select>' : '';
    var head = '<div class="toolbar"><h2>Encounters</h2><div class="chips">' + picker + '<button type="button" class="btn btn-primary" data-gm="enc-new">New encounter</button>' +
      (enc ? '<button type="button" class="btn" data-gm="enc-copy">Duplicate</button><button type="button" class="btn btn-danger' + (armed === enc.id ? ' armed' : '') + '" data-gm="enc-del">' + (armed === enc.id ? 'Confirm delete' : 'Delete') + '</button>' : '') + '</div></div>';
    if (!enc) {
      return head + '<section class="card"><div class="card-body"><p>Build an encounter from the ' + (D.MONSTERS || []).length.toLocaleString() + ' creatures available, see how hard it is for your party, then run it with the initiative tracker.</p>' +
        '<p class="desc">Difficulty uses the 2024 rules: each character has an XP budget for a Low, Moderate or High difficulty fight, and the creatures\' XP is spent against the party\'s total.</p>' +
        '<button type="button" class="btn btn-primary" data-gm="enc-new">Create your first encounter</button></div></section>';
    }
    var list = encMonsters(enc);
    var rows = list.map(function (x, i) {
      var xp = D.crXp(x.cr);
      return '<tr><td>' + ui.ico(x.m ? D.creatureIcon(x.m) : 'd20') + ' ' + (x.m ? '<button type="button" class="linklike" data-gm="mon-info" data-id="' + esc(x.m.id) + '">' + esc(x.name) + '</button>' : esc(x.name) + ' <span class="pill pill-plain">not loaded</span>') + '</td>' +
        '<td class="n">' + esc(x.cr) + '</td><td class="n">' + xp.toLocaleString() + '</td>' +
        '<td class="n"><span class="cnt"><button type="button" class="btn btn-small" data-gm="enc-count" data-i="' + i + '" data-d="-1" aria-label="One fewer ' + esc(x.name) + '">−</button><b class="num">' + x.count + '</b>' +
        '<button type="button" class="btn btn-small" data-gm="enc-count" data-i="' + i + '" data-d="1" aria-label="One more ' + esc(x.name) + '">+</button></span></td>' +
        '<td class="n">' + (xp * x.count).toLocaleString() + '</td><td class="n"><button type="button" class="btn btn-small" data-gm="enc-rm" data-i="' + i + '" aria-label="Remove ' + esc(x.name) + '">×</button></td></tr>';
    }).join('');
    return head + '<div class="gm-grid"><section class="card"><div class="card-head"><h3>Creatures</h3><button type="button" class="btn btn-small btn-primary" data-openlist="gm-enc">Add creatures</button></div><div class="card-body">' +
      '<div class="field"><label for="enc-name">Encounter name</label><input id="enc-name" type="text" maxlength="60" value="' + esc(enc.name || '') + '" data-gmf="enc" data-k="name"></div>' +
      (list.length ? '<div class="table-wrap"><table class="gm-table"><thead><tr><th>Creature</th><th class="n">CR</th><th class="n">XP</th><th class="n">Count</th><th class="n">Total</th><th class="n"></th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
        '<p class="desc">No creatures yet. Use <b>Add creatures</b>; the list can filter to what still fits the budget.</p>') +
      '<div class="field"><label for="enc-notes">Notes</label><textarea id="enc-notes" rows="3" data-gmf="enc" data-k="notes" placeholder="Terrain, tactics, treasure, read-aloud text…">' + esc(enc.notes || '') + '</textarea></div>' +
      '</div></section>' +
      '<section class="card"><div class="card-head"><h3>Difficulty</h3><button type="button" class="linklike" data-tab="gm-party">Edit party</button></div><div class="card-body"><div id="gm-diff">' + difficultyHtml(enc) + '</div>' +
      '<div class="chips" style="margin-top:12px"><button type="button" class="btn btn-primary" data-gm="enc-run"' + (list.length ? '' : ' disabled') + '>' + (enc.run ? 'Open the tracker' : 'Run this encounter') + '</button></div></div></section></div>';
  }

  /* ---------- Initiative tracker ---------- */

  function d20() { return D.randInt(20); }
  function order(run) {
    return run.list.slice().sort(function (a, b) {
      var ai = a.init == null ? -999 : a.init, bi = b.init == null ? -999 : b.init;
      return bi - ai || (b.bonus || 0) - (a.bonus || 0);
    });
  }
  function monsterCombatant(m, id, name, cr, sharedInit) {
    var g = state(), st = m ? D.monsterStats(m) : { hp: 1, ac: 10, init: 0 };
    var formula = m && (/\(([^)]*d[^)]*)\)/.exec(m.hp || '') || [])[1];
    var hp = g.opts.rollHp && formula ? Math.max(1, D.rollDice(formula.replace(/\s+/g, '')).total) : st.hp || 1;
    return { key: uid('m'), kind: 'mon', ref: id, name: name, init: sharedInit != null ? sharedInit : d20() + st.init, bonus: st.init, hp: hp, max: hp, ac: st.ac || null, cr: cr, conds: {}, dead: false };
  }
  function startRun(enc) {
    var g = state(), list = [];
    partyStats().forEach(function (p) {
      list.push({ key: 'pc-' + p.id, kind: 'pc', ref: p.buildId || '', name: p.name, init: null, bonus: p.init || 0, hp: p.hpNow, max: p.hp, ac: p.ac, pp: p.pp, level: p.level, conds: {}, dead: false });
    });
    encMonsters(enc).forEach(function (x) {
      var st = x.m ? D.monsterStats(x.m) : { init: 0 }, shared = g.opts.group ? d20() + st.init : null;
      for (var i = 1; i <= x.count; i++) list.push(monsterCombatant(x.m, x.em.id, x.count > 1 ? x.name + ' ' + i : x.name, x.cr, shared));
    });
    enc.run = { round: 1, turn: null, list: list };
    var first = order(enc.run)[0];
    enc.run.turn = first ? first.key : null;
  }
  function advance(run, dir) {
    var ord = order(run);
    if (!ord.some(function (c) { return !c.dead; })) return;
    var i = ord.findIndex(function (c) { return c.key === run.turn; });
    for (var guard = 0; guard < ord.length + 1; guard++) {
      i += dir;
      if (i >= ord.length) { i = 0; run.round++; }
      if (i < 0) { i = ord.length - 1; run.round = Math.max(1, run.round - 1); }
      if (!ord[i].dead) break;
    }
    run.turn = ord[i].key;
  }
  function condChips(c) {
    return Object.keys(c.conds || {}).map(function (k) {
      return '<span class="cond-chip static" title="' + esc(k) + '">' + U().ico(D.conditionIcon(k)) + esc(k) + '</span>';
    }).join('');
  }
  function hpCell(c) {
    if (c.max == null) return '<span class="muted">—</span>';
    var pct = c.max ? Math.round(c.hp / c.max * 100) : 0, tone = pct > 50 ? 'ok' : pct > 25 ? 'mid' : 'low';
    return '<div class="trk-hp"><b class="num">' + c.hp + '</b><span class="muted"> / ' + c.max + (c.temp ? ' +' + c.temp : '') + '</span>' +
      '<span class="bar small" role="meter" aria-label="Hit points" aria-valuemin="0" aria-valuemax="' + c.max + '" aria-valuenow="' + c.hp + '"><span class="fill ' + tone + '" style="width:' + pct + '%"></span></span></div>' +
      '<div class="trk-hpctl"><label class="sr" for="amt-' + c.key + '">Amount for ' + esc(c.name) + '</label><input class="qty" id="amt-' + c.key + '" type="number" min="0" inputmode="numeric" placeholder="0">' +
      '<button type="button" class="btn btn-small" data-gm="run-hp" data-key="' + c.key + '" data-d="-1" title="Damage">Hit</button><button type="button" class="btn btn-small" data-gm="run-hp" data-key="' + c.key + '" data-d="1" title="Heal">Heal</button></div>';
  }
  function runSetup(enc) {
    var g = state(), d = encDifficulty(enc);
    return '<section class="card"><div class="card-head"><h3>' + esc(enc.name || 'Encounter') + '</h3>' + (d.tier >= 0 ? '<span class="pill diff-' + d.tier + '">' + esc(d.label) + '</span>' : '') + '<span class="muted">' + d.xp.toLocaleString() + ' XP · ' + d.count + ' creatures · ' + esc(partyLine()) + '</span></div><div class="card-body">' +
      '<label class="toggle"><input type="checkbox" data-gmf="opt" data-k="group"' + (g.opts.group ? ' checked' : '') + '> Identical creatures share one initiative roll</label>' +
      '<label class="toggle"><input type="checkbox" data-gmf="opt" data-k="rollHp"' + (g.opts.rollHp ? ' checked' : '') + '> Roll each creature\'s Hit Points (otherwise use the average)</label>' +
      '<p class="desc">Starting rolls initiative for the creatures. Enter each player\'s roll in the tracker, or roll for them.</p>' +
      '<div class="chips"><button type="button" class="btn btn-primary" data-gm="run-start"' + (d.count ? '' : ' disabled') + '>Start encounter</button><button type="button" class="btn" data-tab="gm-encounters">Edit encounter</button></div></div></section>';
  }
  function renderRun() {
    var g = state(), ui = U(), enc = curEnc();
    var head = '<div class="toolbar"><h2>Run encounter</h2>' + (g.encounters.length > 1 ? '<div class="chips"><label class="sr" for="run-select">Encounter</label><select id="run-select" data-gmf="enc-select" style="width:auto;max-width:100%">' +
      g.encounters.map(function (e) { return '<option value="' + esc(e.id) + '"' + (enc && e.id === enc.id ? ' selected' : '') + '>' + esc(e.name || 'Encounter') + (e.run ? ' · running' : '') + '</option>'; }).join('') + '</select></div>' : '') + '</div>';
    if (!enc) return head + '<section class="card"><div class="card-body"><p>There\'s no encounter to run yet.</p><button type="button" class="btn btn-primary" data-tab="gm-encounters">Build an encounter</button></div></section>';
    if (!enc.run) return head + runSetup(enc);
    var run = enc.run, ord = order(run), cur = ord.filter(function (c) { return c.key === run.turn; })[0];
    var needInit = run.list.some(function (c) { return c.init == null; });
    var rows = ord.map(function (c) {
      var m = c.kind === 'mon' ? D.monster(c.ref) : null, on = c.key === run.turn;
      return '<tr class="' + (on ? 'on-turn' : '') + (c.dead ? ' defeated' : '') + '"><td class="n"><label class="sr" for="init-' + c.key + '">Initiative for ' + esc(c.name) + '</label>' +
        '<input class="qty init" id="init-' + c.key + '" type="number" inputmode="numeric" value="' + (c.init == null ? '' : c.init) + '" placeholder="' + ui.sign(c.bonus || 0) + '" data-gmf="run-init" data-key="' + c.key + '"></td>' +
        '<td>' + (on ? '<span class="turn-arrow" aria-label="Current turn">▶</span> ' : '') + ui.ico(c.kind === 'pc' ? 'human' : m ? D.creatureIcon(m) : 'd20') + ' ' +
        (m ? '<button type="button" class="linklike" data-gm="mon-info" data-id="' + esc(m.id) + '">' + esc(c.name) + '</button>' : '<b>' + esc(c.name) + '</b>') +
        (c.kind === 'pc' ? ' <span class="muted">' + (c.level ? 'level ' + c.level : 'player') + (c.pp ? ' · PP ' + c.pp : '') + '</span>' : c.cr ? ' <span class="muted">CR ' + esc(c.cr) + '</span>' : '') +
        (c.dead ? ' <span class="pill pill-plain">defeated</span>' : '') + '<div class="trk-conds">' + condChips(c) +
        '<button type="button" class="btn btn-small" data-gm="run-conds" data-key="' + c.key + '">' + (Object.keys(c.conds || {}).length ? 'Edit' : '+ Condition') + '</button></div></td>' +
        '<td class="n">' + (c.ac == null ? '—' : c.ac) + '</td><td>' + hpCell(c) + '</td>' +
        '<td class="n"><button type="button" class="btn btn-small" data-gm="run-dead" data-key="' + c.key + '" title="' + (c.dead ? 'Bring back into the fight' : 'Mark as defeated') + '">' + (c.dead ? 'Revive' : 'Defeat') + '</button> ' +
        '<button type="button" class="btn btn-small" data-gm="run-rm" data-key="' + c.key + '" aria-label="Remove ' + esc(c.name) + '">×</button></td></tr>';
    }).join('');
    var mcur = cur && cur.kind === 'mon' ? D.monster(cur.ref) : null;
    var onTurn = cur ? '<section class="card"><div class="card-head"><h3>On turn: ' + esc(cur.name) + '</h3><span class="muted">' + (cur.max != null ? cur.hp + ' / ' + cur.max + ' HP' : '') + (cur.ac != null ? ' · AC ' + cur.ac : '') + '</span></div><div class="card-body">' +
      (mcur ? ui.statBlock(mcur) : cur.kind === 'pc' ? '<p class="desc">' + esc(cur.name) + '\'s turn. ' + (cur.ref ? 'Their sheet is under the player tabs.' : '') + '</p>' : '<p class="desc">No stat block for this combatant.</p>') + '</div></section>' : '';
    var defeated = run.list.filter(function (c) { return c.kind === 'mon' && c.dead; }), xp = defeated.reduce(function (n, c) { return n + D.crXp(c.cr); }, 0);
    var pcs = run.list.filter(function (c) { return c.kind === 'pc'; }).length || 1;
    var left = run.list.filter(function (c) { return c.kind === 'mon' && !c.dead; }).length;
    return head + '<section class="card"><div class="card-head"><h3>' + esc(enc.name || 'Encounter') + '</h3><span class="pill pill-gold">Round ' + run.round + '</span><span class="muted">' + left + ' creature' + (left === 1 ? '' : 's') + ' standing</span>' +
      '<div class="chips trk-actions"><button type="button" class="btn btn-small" data-gm="run-prev">Previous</button><button type="button" class="btn btn-small btn-primary" data-gm="run-next">Next turn</button></div></div><div class="card-body">' +
      '<div class="table-wrap"><table class="gm-table tracker"><thead><tr><th class="n">Init</th><th>Combatant</th><th class="n">AC</th><th>Hit Points</th><th class="n"></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="chips" style="margin-top:12px">' + (needInit ? '<button type="button" class="btn" data-gm="run-rollpc">Roll initiative for the blanks</button>' : '') +
      '<button type="button" class="btn" data-openlist="gm-run">Add a creature</button><button type="button" class="btn" data-gm="run-reroll">Reroll all initiative</button>' +
      '<button type="button" class="btn btn-danger' + (armed === 'run' ? ' armed' : '') + '" data-gm="run-end">' + (armed === 'run' ? 'Confirm: end and clear' : 'End encounter') + '</button></div>' +
      '<form class="add-custom" data-gmform="run-add" style="margin-top:10px"><label class="sr" for="rc-name">Name</label><input id="rc-name" type="text" maxlength="40" placeholder="Add anyone else (name)">' +
      '<label class="sr" for="rc-init">Initiative</label><input id="rc-init" class="qty" type="number" placeholder="Init"><label class="sr" for="rc-hp">Hit points</label><input id="rc-hp" class="qty" type="number" min="1" placeholder="HP">' +
      '<label class="sr" for="rc-ac">Armor Class</label><input id="rc-ac" class="qty" type="number" placeholder="AC"><button type="submit" class="btn btn-small">Add</button></form>' +
      '<p class="desc">XP so far: <b>' + xp.toLocaleString() + '</b> from ' + defeated.length + ' defeated creature' + (defeated.length === 1 ? '' : 's') + ' · <b>' + Math.floor(xp / pcs).toLocaleString() + '</b> each for ' + pcs + ' character' + (pcs === 1 ? '' : 's') + '.</p>' +
      '</div></section>' + onTurn;
  }
  function condModal(key) {
    var enc = curEnc(), c = enc && enc.run && enc.run.list.filter(function (x) { return x.key === key; })[0];
    if (!c) return U().closeModal();
    U().app.modal = { type: 'detail', gmCond: key, title: 'Conditions: ' + c.name, sub: 'Select to add or remove',
      html: '<div class="cond-grid">' + D.CONDITIONS.map(function (x) {
        var on = !!(c.conds || {})[x[0]];
        return '<button type="button" class="cond' + (on ? ' on' : '') + '" data-gm="run-cond" data-key="' + esc(key) + '" data-cond="' + esc(x[0]) + '" aria-pressed="' + on + '" title="' + esc(x[1]) + '">' + U().ico(D.conditionIcon(x[0])) + '<span>' + esc(x[0]) + '</span></button>';
      }).join('') + '</div>' };
  }

  /* ---------- Creature builder ---------- */

  var SIZES = [['T', 'Tiny'], ['S', 'Small'], ['M', 'Medium'], ['L', 'Large'], ['H', 'Huge'], ['G', 'Gargantuan']];
  var SECTIONS = [['trait', 'Traits', 'Add a trait'], ['action', 'Actions', 'Add an action'], ['bonus', 'Bonus Actions', 'Add a bonus action'], ['reaction', 'Reactions', 'Add a reaction'], ['legendary', 'Legendary Actions', 'Add a legendary action']];
  var DMG_TYPES = ['Slashing', 'Piercing', 'Bludgeoning', 'Acid', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];
  function f(id, label, inner, cls) { return '<div class="field' + (cls ? ' ' + cls : '') + '"><label for="' + id + '">' + label + '</label>' + inner + '</div>'; }
  function txt(c, k, label, ph) { return f('cr-' + k, label, '<input id="cr-' + k + '" type="text" value="' + esc(c[k] == null ? '' : c[k]) + '" data-gmf="cre" data-k="' + k + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'); }
  function numf(c, k, label, min, max) { return f('cr-' + k, label, '<input id="cr-' + k + '" type="number" inputmode="numeric" min="' + min + '" max="' + max + '" value="' + esc(c[k] == null ? '' : c[k]) + '" data-gmf="cre" data-k="' + k + '">'); }
  function sel(c, k, label, opts) { return f('cr-' + k, label, '<select id="cr-' + k + '" data-gmf="cre" data-k="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(c[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'); }

  // Compare the creature's numbers with a typical creature of its CR.
  function powerHtml(c) {
    var m = D.buildCreature(c), st = D.monsterStats(m), bench = D.crBenchmark(c.cr), est = D.estimateCR(st);
    function row(label, mine, typical, hint) {
      if (!mine && !typical) return '';
      var ratio = typical ? mine / typical : 1, pct = Math.max(4, Math.min(100, ratio * 50));
      var verdict = !mine ? ['none', '—'] : ratio < 0.8 ? ['low', 'below'] : ratio > 1.25 ? ['high', 'above'] : ['ok', 'typical'];
      return '<div class="pw-row"><div class="pw-label"><b>' + label + '</b>' + (hint ? ' <span class="muted">' + hint + '</span>' : '') + '</div>' +
        '<div class="pw-nums"><b class="num">' + (mine || '—') + '</b> <span class="muted">vs ' + typical + ' typical</span></div>' +
        '<div class="pw-bar"><span class="pw-fill v-' + verdict[0] + '" style="width:' + pct + '%"></span><span class="pw-mid"></span></div><span class="pill pw-' + verdict[0] + '">' + verdict[1] + '</span></div>';
    }
    var same = est.cr === D.crKey(c.cr), gap = est.index - D.CR_LIST.indexOf(D.crKey(c.cr));
    return '<div class="pw-est"><div class="stat-box"><span class="eyebrow">Your CR</span><b>' + esc(D.crKey(c.cr)) + '</b><small>' + D.crXp(c.cr).toLocaleString() + ' XP · PB +' + D.crProf(c.cr) + '</small></div>' +
      '<div class="stat-box"><span class="eyebrow">Estimated CR</span><b>' + esc(est.cr) + '</b><small>defense ' + esc(est.defensive) + ' · offense ' + esc(est.offensive) + '</small></div></div>' +
      '<p class="desc">' + (same ? 'Its numbers match its CR.' : Math.abs(gap) === 1 ? 'Close to its CR (one step ' + (gap > 0 ? 'stronger' : 'weaker') + ').' :
        '<b>' + (gap > 0 ? 'Stronger' : 'Weaker') + ' than CR ' + esc(D.crKey(c.cr)) + ' suggests.</b> It plays more like CR ' + esc(est.cr) + '.') +
      (same ? '' : ' <button type="button" class="linklike" data-gm="cre-usecr" data-cr="' + esc(est.cr) + '">Set CR to ' + esc(est.cr) + '</button>') + '</p>' +
      '<h4>Compared with a typical CR ' + esc(D.crKey(c.cr)) + ' creature</h4>' +
      row('Hit Points', st.hp, bench.hp) + row('Armor Class', st.ac, bench.ac) + row('Attack bonus', st.attack, bench.attack, st.attack ? '' : 'none found') +
      row('Save DC', st.dc, bench.dc) + row('Damage per round', st.dpr, bench.dpr, 'from its actions') +
      '<p class="desc muted">An estimate, not a rule: “typical” is the median of the SRD creatures at that CR, and damage is read from the action text (multiattack, recharge and legendary actions included). Special traits, resistances and spells aren\'t counted.</p>';
  }
  function creatureSide(c) {
    var m = D.buildCreature(c);
    return '<section class="card"><div class="card-head"><h3>Power check</h3><span class="muted">Is it right for its CR?</span></div><div class="card-body">' + powerHtml(c) + '</div></section>' +
      '<section class="card"><div class="card-head"><h3>Stat block</h3><span class="muted">Click dice to roll</span></div><div class="card-body">' + U().statBlock(m) + '</div></section>';
  }
  function entriesHtml(c, sec) {
    var list = c[sec[0]] || [];
    return '<div class="cre-sec"><div class="toolbar"><span class="label">' + sec[1] + '</span><button type="button" class="btn btn-small" data-gm="cre-add" data-sec="' + sec[0] + '">' + sec[2] + '</button></div>' +
      list.map(function (e, i) {
        var id = 'ce-' + sec[0] + '-' + i;
        return '<div class="cre-entry"><label class="sr" for="' + id + '-n">Name</label><input id="' + id + '-n" type="text" value="' + esc(e.name || '') + '" placeholder="Name" data-gmf="cre-entry" data-sec="' + sec[0] + '" data-i="' + i + '" data-k="name">' +
          '<button type="button" class="btn btn-small" data-gm="cre-del" data-sec="' + sec[0] + '" data-i="' + i + '" aria-label="Remove ' + esc(e.name || 'entry') + '">×</button>' +
          '<label class="sr" for="' + id + '-t">Text</label><textarea id="' + id + '-t" rows="2" placeholder="What it does. Write damage as 13 (2d8 + 4) so it can be rolled and measured." data-gmf="cre-entry" data-sec="' + sec[0] + '" data-i="' + i + '" data-k="text">' + esc(e.text || '') + '</textarea></div>';
      }).join('') + (sec[0] === 'action' ? '<form class="attack-form" data-gmform="cre-attack"><span class="label">Quick attack</span>' +
        '<label class="sr" for="at-name">Attack name</label><input id="at-name" type="text" placeholder="Name (e.g. Bite)" maxlength="40">' +
        '<label class="sr" for="at-kind">Kind</label><select id="at-kind"><option value="melee">Melee</option><option value="ranged">Ranged</option></select>' +
        '<label class="sr" for="at-ab">Ability</label><select id="at-ab">' + D.ABILITIES.map(function (a) { return '<option value="' + a + '">' + a.toUpperCase() + '</option>'; }).join('') + '</select>' +
        '<label class="sr" for="at-dice">Damage dice</label><input id="at-dice" type="text" placeholder="2d6" value="1d8" style="width:70px">' +
        '<label class="sr" for="at-type">Damage type</label><select id="at-type">' + DMG_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select>' +
        '<button type="submit" class="btn btn-small btn-primary">Add attack</button></form>' : '') + '</div>';
  }
  function renderCreatures() {
    var g = state(), c = curCreature();
    var head = '<div class="toolbar"><h2>Creatures</h2><div class="chips"><button type="button" class="btn btn-primary" data-gm="cre-new">New creature</button><button type="button" class="btn" data-openlist="gm-copy">Start from an existing creature</button></div></div>';
    var mine = g.creatures.length ? '<div class="chips cre-list">' + g.creatures.map(function (x) {
      return '<button type="button" class="btn btn-small' + (c && x.id === c.id ? ' btn-primary' : '') + '" data-gm="cre-edit" data-id="' + esc(x.id) + '">' + U().ico(D.creatureIcon({ type: String(x.type).toLowerCase() })) + ' ' + esc(x.name || 'Unnamed') + ' <span class="' + (c && x.id === c.id ? '' : 'muted') + '">CR ' + esc(D.crKey(x.cr)) + '</span></button>';
    }).join('') + '</div>' : '';
    if (!c) {
      return head + '<section class="card"><div class="card-body">' + (mine ? '<p><b>Your creatures</b></p>' + mine : '<p>Make your own creatures, or copy any creature and change it. They join the bestiary, so you can use them in encounters and as companions.</p>') +
        '<p class="desc">The power check compares a creature\'s Hit Points, Armor Class, attack bonus, save DC and damage per round with typical creatures of its Challenge Rating.</p></div></section>';
    }
    var hp = D.creatureHp(c);
    var form = '<section class="card"><div class="card-head"><h3>' + esc(c.name || 'Creature') + '</h3><div class="chips"><button type="button" class="btn btn-small" data-gm="cre-toenc">Add to encounter</button><button type="button" class="btn btn-small" data-gm="cre-copy">Duplicate</button>' +
      '<button type="button" class="btn btn-small btn-danger' + (armed === c.id ? ' armed' : '') + '" data-gm="cre-rm">' + (armed === c.id ? 'Confirm delete' : 'Delete') + '</button></div></div><div class="card-body">' +
      '<div class="gear-grid">' + txt(c, 'name', 'Name') + sel(c, 'size', 'Size', SIZES) + sel(c, 'type', 'Type', D.CREATURE_TYPES.map(function (t) { return [t, t]; })) + txt(c, 'align', 'Alignment') +
      sel(c, 'cr', 'Challenge Rating', D.CR_LIST.map(function (x) { return [x, 'CR ' + x + ' · ' + D.crXp(x).toLocaleString() + ' XP']; })) + '</div>' +
      '<div class="gear-grid">' + numf(c, 'ac', 'Armor Class', 1, 40) + txt(c, 'acNote', 'AC note', 'natural armor') + numf(c, 'hd', 'Hit Dice (d' + (D.HIT_DIE_BY_SIZE[c.size] || 8) + ')', 0, 99) +
      (+c.hd ? f('cr-hpshow', 'Hit Points', '<output id="cr-hpshow" class="out">' + esc(hp.text) + '</output>') : numf(c, 'hp', 'Hit Points', 1, 9999)) + txt(c, 'speed', 'Speed', '30 ft., fly 60 ft.') + '</div>' +
      '<div class="cre-abil">' + D.ABILITIES.map(function (a) {
        return '<div class="ab-edit"><label class="eyebrow" for="cr-' + a + '" title="' + D.ABILITY_NAMES[a] + '">' + a.toUpperCase() + '</label><input id="cr-' + a + '" type="number" min="1" max="30" value="' + esc(c[a]) + '" data-gmf="cre" data-k="' + a + '">' +
          '<label class="toggle"><input type="checkbox" data-gmf="cre-save" data-k="' + a + '"' + ((c.saves || []).indexOf(a) >= 0 ? ' checked' : '') + '> save</label></div>';
      }).join('') + '</div>' +
      '<div class="gear-grid">' + txt(c, 'skill', 'Skills', 'Perception +4, Stealth +6') + txt(c, 'senses', 'Senses', 'darkvision 60 ft.') + txt(c, 'languages', 'Languages') + '</div>' +
      '<div class="gear-grid">' + txt(c, 'vulnerable', 'Vulnerabilities') + txt(c, 'resist', 'Resistances') + txt(c, 'immune', 'Immunities') + txt(c, 'condImmune', 'Condition immunities') + '</div>' +
      SECTIONS.map(function (s) { return entriesHtml(c, s); }).join('') + '</div></section>';
    return head + (g.creatures.length > 1 ? '<div style="margin-bottom:14px">' + mine + '</div>' : '') + '<div class="gm-grid cre-grid"><div>' + form + '</div><div id="gm-cre-side" class="cre-side">' + creatureSide(c) + '</div></div>';
  }

  /* ---------- Module interface ---------- */

  gm.render = function (tab) {
    state();
    return tab === 'gm-party' ? renderParty() : tab === 'gm-run' ? renderRun() : tab === 'gm-creatures' ? renderCreatures() : renderEncounters();
  };
  // Titles and extra filters for the creature list when it's opened from a GM screen.
  gm.listInfo = function (kind) {
    if (kind === 'gm-copy') return { title: 'Start from an existing creature' };
    if (kind === 'gm-run') return { title: 'Add a creature to the fight' };
    var enc = curEnc(), d = enc ? encDifficulty(enc) : null;
    return { title: 'Add creatures' + (d && d.count ? ' · ' + d.xp.toLocaleString() + ' XP so far (' + d.label + ')' : ''),
      filters: d ? [{ id: 'fit', label: 'Fits the budget', values: D.DIFFICULTY.map(function (x, i) { return [String(i), 'Keeps it ' + x[0] + ' (' + Math.max(0, d.budget[i] - d.xp).toLocaleString() + ' XP left)']; }),
        test: function (o, v) { return o.xp <= d.budget[+v] - d.xp; } }] : [] };
  };
  function addToEncounter(enc, id) {
    var m = D.monster(id); if (!m) return;
    var same = enc.monsters.filter(function (x) { return x.id === id; })[0];
    if (same) same.count = (same.count || 1) + 1; else enc.monsters.push({ id: id, count: 1, name: m.name, cr: D.crKey(m.cr) });
  }
  function newEncounter() {
    var g = state(), e = { id: uid('e'), name: 'Encounter ' + (g.encounters.length + 1), notes: '', monsters: [], run: null };
    g.encounters.push(e); g.cur = e.id;
    return e;
  }
  gm.pick = function (kind, id) {
    var g = state(), ui = U();
    if (kind === 'gm-enc') {
      addToEncounter(curEnc() || newEncounter(), id);
      ui.commit();   // the list stays open so several creatures can be added
      return;
    }
    if (kind === 'gm-run') {
      var enc = curEnc(), m = D.monster(id);
      if (enc && enc.run && m) {
        var n = enc.run.list.filter(function (c) { return c.ref === id; }).length;
        enc.run.list.push(monsterCombatant(m, id, n ? m.name + ' ' + (n + 1) : m.name, D.crKey(m.cr)));
      }
    }
    if (kind === 'gm-copy') {
      var src = D.monster(id);
      if (src) { var c = D.creatureModelFrom(src); g.creatures.push(c); g.editing = c.id; gm.sync(); }
    }
    ui.closeModal(); ui.commit();
  };

  gm.click = function (t) {
    var g = state(), ui = U(), ds = t.dataset, a = ds.gm, enc = curEnc(), c = curCreature();
    var wasArmed = armed; armed = '';
    function runItem() { return enc && enc.run && enc.run.list.filter(function (x) { return x.key === ds.key; })[0]; }
    switch (a) {
      case 'mon-info': ui.openDetail('mon:' + ds.id); return;
      /* party */
      case 'party-link': { var selB = $('#party-build'); if (selB && selB.value) g.party.push({ id: uid('p'), buildId: selB.value }); break; }
      case 'party-add': g.party.push({ id: uid('p'), name: 'Player ' + (g.party.length + 1), level: g.party.length ? partyStats()[0].level : g.quick.level, ac: '', hp: '', init: 0, pp: '' }); break;
      case 'party-rm': g.party = g.party.filter(function (m) { return m.id !== ds.id; }); break;
      /* encounters */
      case 'enc-new': newEncounter(); ui.app.tab = 'gm-encounters'; break;
      case 'enc-copy': if (enc) { var e2 = JSON.parse(JSON.stringify(enc)); e2.id = uid('e'); e2.name = (enc.name || 'Encounter') + ' (copy)'; e2.run = null; g.encounters.push(e2); g.cur = e2.id; } break;
      case 'enc-del':
        if (!enc) break;
        if (wasArmed !== enc.id) { armed = enc.id; break; }
        g.encounters = g.encounters.filter(function (x) { return x.id !== enc.id; }); g.cur = g.encounters[0] ? g.encounters[0].id : null; break;
      case 'enc-count': if (enc && enc.monsters[+ds.i]) { enc.monsters[+ds.i].count = Math.max(1, Math.min(99, (enc.monsters[+ds.i].count || 1) + +ds.d)); } break;
      case 'enc-rm': if (enc) enc.monsters.splice(+ds.i, 1); break;
      case 'enc-run': if (enc) { g.cur = enc.id; ui.app.tab = 'gm-run'; window.scrollTo(0, 0); } break;
      /* tracker */
      case 'run-start': if (enc) startRun(enc); break;
      case 'run-next': if (enc && enc.run) advance(enc.run, 1); break;
      case 'run-prev': if (enc && enc.run) advance(enc.run, -1); break;
      case 'run-rollpc': if (enc && enc.run) enc.run.list.forEach(function (x) { if (x.init == null) x.init = d20() + (x.bonus || 0); }); break;
      case 'run-reroll': if (enc && enc.run) { enc.run.list.forEach(function (x) { x.init = d20() + (x.bonus || 0); }); enc.run.round = 1; enc.run.turn = order(enc.run)[0].key; } break;
      case 'run-end':
        if (!enc || !enc.run) break;
        if (wasArmed !== 'run') { armed = 'run'; break; }
        enc.run = null; break;
      case 'run-hp': {
        var it = runItem(), inp = document.getElementById('amt-' + ds.key), amt = inp ? parseInt(inp.value, 10) : NaN;
        if (!it || !(amt > 0)) { if (inp) inp.focus(); return; }
        if (+ds.d < 0) {
          var soak = Math.min(it.temp || 0, amt); it.temp = (it.temp || 0) - soak; it.hp = Math.max(0, it.hp - (amt - soak));
          if (it.hp === 0 && it.kind === 'mon') it.dead = true;
        } else { it.hp = Math.min(it.max, it.hp + amt); if (it.hp > 0) it.dead = false; }
        break;
      }
      case 'run-dead': { var it2 = runItem(); if (it2) { it2.dead = !it2.dead; if (it2.dead && enc.run.turn === it2.key) advance(enc.run, 1); } break; }
      case 'run-rm': if (enc && enc.run) { if (enc.run.turn === ds.key) advance(enc.run, 1); enc.run.list = enc.run.list.filter(function (x) { return x.key !== ds.key; }); if (!enc.run.list.length) enc.run.turn = null; } break;
      case 'run-conds': condModal(ds.key); ui.renderModal(); return;
      case 'run-cond': { var it3 = runItem(); if (it3) { it3.conds = it3.conds || {}; if (it3.conds[ds.cond]) delete it3.conds[ds.cond]; else it3.conds[ds.cond] = true; condModal(ds.key); } break; }
      /* creatures */
      case 'cre-new': { var nc = D.newCreatureModel(); g.creatures.push(nc); g.editing = nc.id; gm.sync(); break; }
      case 'cre-edit': g.editing = ds.id; break;
      case 'cre-copy': if (c) { var cc = JSON.parse(JSON.stringify(c)); cc.id = D.newCreatureModel().id; cc.name = (c.name || 'Creature') + ' (copy)'; g.creatures.push(cc); g.editing = cc.id; gm.sync(); } break;
      case 'cre-rm':
        if (!c) break;
        if (wasArmed !== c.id) { armed = c.id; break; }
        g.creatures = g.creatures.filter(function (x) { return x.id !== c.id; }); g.editing = null; gm.sync(); break;
      case 'cre-toenc': if (c) { addToEncounter(enc || newEncounter(), 'custom-' + c.id); ui.app.tab = 'gm-encounters'; } break;
      case 'cre-usecr': if (c) { c.cr = ds.cr; gm.sync(); } break;
      case 'cre-add': if (c) { (c[ds.sec] = c[ds.sec] || []).push({ name: '', text: '' }); } break;
      case 'cre-del': if (c && c[ds.sec]) { c[ds.sec].splice(+ds.i, 1); gm.sync(); } break;
    }
    ui.commit();
  };

  // Text and number fields save without redrawing the page, so typing and tabbing aren't interrupted.
  gm.change = function (t) {
    var g = state(), ui = U(), ds = t.dataset, enc = curEnc(), c = curCreature();
    var v = t.type === 'checkbox' ? t.checked : t.value;
    switch (ds.gmf) {
      case 'enc-select': g.cur = v; ui.commit(); return;
      case 'opt': g.opts[ds.k] = !!v; ui.save(); return;
      case 'quick': g.quick[ds.k] = num(v, 1, ds.k === 'size' ? 12 : 20, 1); t.value = g.quick[ds.k]; break;
      case 'party': { var m = find(g.party, ds.id); if (m) m[ds.k] = ds.k === 'name' ? String(v).slice(0, 40) : ds.k === 'level' ? num(v, 1, 20, 1) : v === '' ? '' : num(v, -20, 999, 0); break; }
      case 'enc': if (enc) enc[ds.k] = String(v); ui.save(); return;
      case 'run-init': { var it = enc && enc.run && enc.run.list.filter(function (x) { return x.key === ds.key; })[0]; if (it) it.init = v === '' ? null : num(v, -20, 99, 0); ui.commit(); return; }
      case 'cre': case 'cre-save': case 'cre-entry':
        if (!c) return;
        if (ds.gmf === 'cre-save') { c.saves = (c.saves || []).filter(function (a) { return a !== ds.k; }); if (v) c.saves.push(ds.k); }
        else if (ds.gmf === 'cre-entry') { if (c[ds.sec] && c[ds.sec][+ds.i]) c[ds.sec][+ds.i][ds.k] = String(v); }
        else if (/^(ac|hd|hp|str|dex|con|int|wis|cha)$/.test(ds.k)) { c[ds.k] = num(v, ds.k === 'hd' ? 0 : 1, ds.k === 'hp' ? 9999 : ds.k === 'hd' ? 99 : ds.k === 'ac' ? 40 : 30, ds.k === 'hd' ? 0 : 10); t.value = c[ds.k]; }
        else c[ds.k] = String(v);
        gm.sync(); ui.save();
        // Structure-changing fields redraw; the rest only refresh the preview.
        if (ds.gmf === 'cre' && /^(size|hd|cr|name|type)$/.test(ds.k)) { ui.commit(); return; }
        var side = $('#gm-cre-side'), out = $('#cr-hpshow');
        if (side) side.innerHTML = creatureSide(c);
        if (out) out.textContent = D.creatureHp(c).text;
        return;
    }
    ui.save();
    var pb = $('#gm-party-budget'), pl = $('#gm-party-line');
    if (pb) pb.innerHTML = budgetHtml(partyLevels());
    if (pl) pl.textContent = partyLine();
  };

  gm.submit = function (form) {
    var ui = U(), enc = curEnc(), c = curCreature();
    if (form.dataset.gmform === 'run-add' && enc && enc.run) {
      var name = $('#rc-name').value.trim(); if (!name) { $('#rc-name').focus(); return; }
      var hp = parseInt($('#rc-hp').value, 10), init = parseInt($('#rc-init').value, 10), ac = parseInt($('#rc-ac').value, 10);
      enc.run.list.push({ key: uid('x'), kind: 'npc', ref: '', name: name.slice(0, 40), init: isNaN(init) ? null : init, bonus: 0, hp: hp > 0 ? hp : null, max: hp > 0 ? hp : null, ac: isNaN(ac) ? null : ac, conds: {}, dead: false });
      if (!enc.run.turn) enc.run.turn = enc.run.list[0].key;
    }
    if (form.dataset.gmform === 'cre-attack' && c) {
      var dice = $('#at-dice').value.trim();
      if (!/^\d*d\d+([+-]\d+)?$/i.test(dice.replace(/\s+/g, ''))) { $('#at-dice').focus(); return; }
      var a = { kind: $('#at-kind').value, ability: $('#at-ab').value, dice: dice, type: $('#at-type').value };
      (c.action = c.action || []).push({ name: $('#at-name').value.trim() || (a.kind === 'ranged' ? 'Ranged Attack' : 'Melee Attack'), text: D.attackText(c, a) });
      gm.sync();
    }
    ui.commit();
  };
})();
