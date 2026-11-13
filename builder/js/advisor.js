/*
 * Advisor: answers questions about a character by calculating, with no AI model.
 * - Level-up advice simulates each option with the build engine and compares the results.
 * - Turn advice ranks what the character can do now by expected damage.
 * - Ask looks up numbers, remaining uses, features and spells.
 * The logic (DND.advisor) is pure; the screen (DND.advisorUi) uses helpers from app.js via DND.ui.
 */
(function (G) {
  var DND = G.DND = G.DND || {};
  var A = DND.advisor = {};

  /* ---------- Chances and averages ---------- */

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // Chance that a d20 + bonus meets a target number; a natural 1 always misses and a natural 20 always hits.
  A.hitChance = function (bonus, ac, mode) {
    var p = clamp((21 + bonus - ac) / 20, 0.05, 0.95);
    return mode === 'adv' ? 1 - (1 - p) * (1 - p) : mode === 'dis' ? p * p : p;
  };
  A.critChance = function (critOn, mode) {
    var p = (21 - (critOn || 20)) / 20;
    return mode === 'adv' ? 1 - (1 - p) * (1 - p) : mode === 'dis' ? p * p : p;
  };
  // "1d8 + 4 slashing" → { dice: 4.5, flat: 4, type: 'slashing' }
  A.parseDamage = function (text) {
    var t = String(text || '').replace(/−/g, '-'), dice = 0, flat = 0;
    DND.parseDice(t.replace(/[a-z]+\s*$/i, '')).forEach(function (x) { if (x.s) dice += x.sign * x.n * (x.s + 1) / 2; else flat += x.k; });
    return { dice: dice, flat: flat, type: (/([a-z]+)\s*$/i.exec(t) || [])[1] || '' };
  };
  // Average damage of one attack roll, counting misses and critical hits (which double the dice).
  A.attackDamage = function (hit, dmg, ac, mode, critOn) {
    var p = A.hitChance(hit, ac, mode), c = Math.min(p, A.critChance(critOn, mode));
    return p * (dmg.dice + dmg.flat) + c * dmg.dice;
  };

  // What a typical opponent looks like at this level: the median SRD creature whose CR equals the level.
  var saveMemo = null, saveFor = null;
  A.target = function (level) {
    var cr = String(clamp(Math.round(level), 1, 30)), b = DND.crBenchmark(cr);
    if (saveFor !== DND.MONSTERS) {
      var by = {};
      (DND.MONSTERS || []).forEach(function (m) {
        if (m.custom || !/System Reference/i.test(m.src || '')) return;
        var k = DND.crKey(m.cr), pb = DND.crProf(m.cr), sv = String(m.save || '');
        var mods = ['dex', 'con', 'wis'].map(function (a) { return DND.mod(+m[a] || 10) + (new RegExp(a, 'i').test(sv) ? pb : 0); });
        (by[k] = by[k] || []).push((mods[0] + mods[1] + mods[2]) / 3);
      });
      saveMemo = {}; var last = 1;
      DND.CR_LIST.forEach(function (k) {
        var l = (by[k] || []).sort(function (x, y) { return x - y; });
        if (l.length) last = Math.max(last, Math.round(l[Math.floor(l.length / 2)]));
        saveMemo[k] = last;
      });
      saveFor = DND.MONSTERS;
    }
    return { cr: cr, ac: b ? b.ac : 13, save: saveMemo[cr] || 1 };
  };
  A.failChance = function (dc, saveBonus) { return clamp((dc - 1 - saveBonus) / 20, 0.05, 0.95); };

  /* ---------- Reading a spell for the table ---------- */

  function isArea(text) { return /\b(each|every) creature\b|-foot[- ](radius|cube|sphere|cone|line|emanation)|\bCone\b|\bLine\b|\bSphere\b|\bEmanation\b/i.test(text || ''); }
  var NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  // How many separate rays, beams or darts a spell makes (Eldritch Blast, Scorching Ray, Magic Missile).
  function beams(sp, level, slot) {
    var text = sp.text || '';
    if (!sp.level) return /creates? \w+ beams/i.test(text) ? (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1) : 1;
    var m = /\b(?:create|hurl|make|fire|shoot)s?\s+(two|three|four|five|six)\s+(?:[a-z-]+\s+){0,2}(rays|beams|darts|bolts|missiles)\b/i.exec(text);
    if (!m) return 1;
    var n = NUM[m[1].toLowerCase()], up = /one (?:additional|more) (?:ray|beam|dart|bolt|missile) for (?:each|every) (?:spell )?slot level above/i.test(text);
    return n + (up && slot > sp.level ? slot - sp.level : 0);
  }
  // Expected result of casting a spell: { avg, exp, how, kind: 'attack' | 'save' | 'auto', heal }
  A.spellExpected = function (sp, caster, level, slot, o) {
    var info = DND.spellDice(sp, level);
    if (!info) return null;
    var dice = (sp.level ? DND.spellDiceAt(info, sp.level, slot || sp.level) : info.dice).replace('MOD', String(DND.mod(o.abilityScore || 10))).replace('+-', '-');
    var d = A.parseDamage(dice), avg = d.dice + d.flat;
    var heal = /healing|temporary/.test(info.type), text = sp.text || '', n = beams(sp, level, slot || sp.level);
    if (heal) return { dice: dice, avg: avg, exp: avg, how: 'no roll to hit', kind: 'auto', heal: true, type: info.type };
    var out = { dice: dice, avg: avg, heal: false, type: info.type, area: isArea(text) };
    if (/spell attack/i.test(text)) {
      var p = A.hitChance(caster.attack + (o.hitMod || 0), o.ac, o.mode);
      out.kind = 'attack'; out.exp = n * (p * avg + Math.min(p, A.critChance(20, o.mode)) * d.dice);
      out.how = Math.round(p * 100) + '% to hit AC ' + o.ac + (n > 1 ? ' × ' + n + ' rays' : '');
    } else if (/saving throw/i.test(text)) {
      var f = A.failChance(caster.dc, o.save), half = /half as much|half damage/i.test(text);
      out.kind = 'save'; out.exp = avg * (f + (half ? (1 - f) / 2 : 0));
      out.how = Math.round(f * 100) + '% fail DC ' + caster.dc + (half ? ', half on a save' : '');
    } else { out.kind = 'auto'; out.exp = avg * n; out.how = 'always hits' + (n > 1 ? ' × ' + n + ' darts' : ''); }
    if (out.area && o.targets > 1) { out.exp *= o.targets; out.how += ' × ' + o.targets + ' targets'; }
    return out;
  };

  /* ---------- Damage per round and the numbers compared on level-up ---------- */

  function knownSpells(build, ev, level) {
    var lv = ev.levels[level - 1], out = [], seen = {};
    (lv.d.spellcasters || []).forEach(function (ce) {
      var rep = DND.spellReport(build, ev, level, ce.clsId);
      if (!rep) return;
      rep.cantrips.concat(rep.prepared).forEach(function (x) { if (x.ok && !seen[x.name]) { seen[x.name] = 1; out.push({ name: x.name, caster: ce }); } });
    });
    lv.state.spells.always.forEach(function (a) { if (!seen[a.name]) { seen[a.name] = 1; out.push({ name: a.name, caster: (lv.d.spellcasters || [])[0] || null, always: true }); } });
    return out.map(function (x) { x.sp = DND.SPELL_INFO && DND.SPELL_INFO[x.name]; return x; }).filter(function (x) { return x.sp; });
  }
  A.knownSpells = knownSpells;
  function sneakDice(d) {
    var c = (d.columns || []).filter(function (x) { return /Sneak Attack/i.test(x.label); })[0];
    return c ? A.parseDamage(String(c.value)).dice : 0;
  }
  // Best weapon routine for the Attack action.
  A.weaponRound = function (d, o) {
    var best = null;
    (d.attacks || []).forEach(function (a) {
      var dmg = A.parseDamage(a.dmg), one = A.attackDamage(a.hit + (o.hitMod || 0), dmg, o.ac, o.mode, d.crit);
      if (!best || one > best.one) best = { a: a, dmg: dmg, one: one };
    });
    if (!best) return null;
    var n = Math.max(1, d.attacksPerAction || 1), p = A.hitChance(best.a.hit + (o.hitMod || 0), o.ac, o.mode), exp = best.one * n, sneak = sneakDice(d);
    var how = Math.round(p * 100) + '% to hit AC ' + o.ac + (n > 1 ? ' × ' + n + ' attacks' : '');
    if (sneak) { exp += (1 - Math.pow(1 - p, n)) * sneak; how += ', Sneak Attack if it qualifies'; }
    return { name: best.a.name, attacks: n, hit: best.a.hit, exp: exp, how: how, one: best.one, mastery: best.a.mastery };
  };
  A.dpr = function (build, ev, level, o) {
    var lv = ev.levels[level - 1], d = lv.d, w = A.weaponRound(d, o), best = w ? { exp: w.exp, src: w.name + (w.attacks > 1 ? ' ×' + w.attacks : '') } : { exp: 0, src: 'no attack' };
    knownSpells(build, ev, level).forEach(function (k) {
      if (k.sp.level || !k.caster) return;
      var e = A.spellExpected(k.sp, k.caster, level, 0, { ac: o.ac, save: o.save, mode: o.mode, targets: 1, abilityScore: lv.state.abilities[k.caster.ability] });
      if (e && !e.heal && e.exp > best.exp) best = { exp: e.exp, src: k.name };
    });
    return best;
  };
  A.metrics = function (build, ev, level) {
    var lv = ev.levels[level - 1], d = lv.d, t = A.target(level), dpr = A.dpr(build, ev, level, { ac: t.ac, save: t.save });
    var hit = Math.max.apply(null, (d.attacks || []).map(function (a) { return a.hit; }).concat((d.spellcasters || []).map(function (c) { return c.attack; }), [-99]));
    return { dpr: dpr.exp, dprSrc: dpr.src, hit: hit === -99 ? null : hit, dc: d.spell ? Math.max.apply(null, d.spellcasters.map(function (c) { return c.dc; })) : null,
      hp: d.hp, ac: d.ac, init: d.init, con: d.saves.con.total, pp: d.passivePerception,
      skills: Object.keys(d.skills).reduce(function (n, k) { return n + d.skills[k].total; }, 0), abilities: Object.assign({}, lv.state.abilities), feats: lv.state.feats.length };
  };

  /* ---------- Level-up advice ---------- */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function findRec(ev, key) {
    var hit = null;
    (function walk(list) { list.forEach(function (c) { if (c.key === key) hit = c; walk(c.children); }); })(
      [].concat.apply([], ev.origin.map(function (o) { return o.choices; }).concat(ev.levels.map(function (l) { return [].concat.apply([], l.features.map(function (f) { return f.choices; })); }))));
    return hit;
  }
  // Every feat slot in the build, with the level it's taken at.
  A.featSlots = function (ev) {
    var out = [];
    ev.levels.forEach(function (l) { l.features.forEach(function (f) { f.choices.forEach(function (c) {
      if (/\.feat$/.test(c.key) && c.kind === 'one') out.push({ key: c.key, level: l.level, label: f.name, value: c.value || '' });
    }); }); });
    return out;
  };
  // Abilities that matter most to this character, most important first.
  A.keyAbilities = function (build, ev, level) {
    var lv = ev.levels[level - 1], d = lv.d, out = [];
    (d.spellcasters || []).forEach(function (c) { out.push(c.ability); });
    var w = A.weaponRound(d, { ac: 10 }), s = lv.state.abilities;
    if (w) out.push(/dex/i.test(ev.cls.primary || '') && DND.mod(s.dex) >= DND.mod(s.str) ? 'dex' : DND.mod(s.dex) > DND.mod(s.str) ? 'dex' : 'str');
    String(ev.cls.primary || '').toLowerCase().split(/[^a-z]+/).forEach(function (wd) { DND.ABILITIES.forEach(function (a) { if (DND.ABILITY_NAMES[a].toLowerCase() === wd) out.push(a); }); });
    out.push('con', 'dex', 'wis');
    return out.filter(function (a, i) { return out.indexOf(a) === i; });
  };
  // Fill an option's own sub-choices so it can be simulated, preferring the character's key abilities.
  function autofill(b, key, prefer) {
    for (var pass = 0; pass < 6; pass++) {
      var rec = findRec(DND.evaluate(b), key), changed = false;
      if (!rec) return;
      (function walk(list) {
        list.forEach(function (c) {
          var vals = Array.isArray(c.value) ? c.value : c.value ? [c.value] : [];
          if (c.missing > 0 && !c.optional) {
            var avail = c.options.filter(function (o) { return !o.unavailable && vals.indexOf(o.id) < 0; });
            avail.sort(function (x, y) { var ix = prefer.indexOf(x.id), iy = prefer.indexOf(y.id); return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy); });
            if (c.kind === 'one' && avail[0]) { b.choices[c.key] = avail[0].id; changed = true; }
            else if (c.kind === 'many' && avail.length) { b.choices[c.key] = vals.concat(avail.slice(0, c.missing).map(function (o) { return o.id; })); changed = true; }
          }
          walk(c.children);
        });
      })(rec.children);
      if (!changed) return;
    }
  }
  function withChoice(build, key, id, sub) {
    var b = clone(build);
    Object.keys(b.choices).forEach(function (k) { if (k === key || k.indexOf(key + '.') === 0) delete b.choices[k]; });
    if (id) b.choices[key] = id;
    Object.keys(sub || {}).forEach(function (k) { b.choices[key + '.' + id + '.' + k] = sub[k]; });
    return b;
  }
  var memo = {};
  // Compare every option for one feat slot. Returns { slot, level, base, options: [{ id, label, sub, m, delta, desc, tags }], notes }.
  A.levelUp = function (build, key) {
    var mk = JSON.stringify(build) + '|' + key + '|' + (DND.CONTENT && DND.CONTENT.version);
    if (memo.k === mk) return memo.v;
    var ev0 = DND.evaluate(build), slot = A.featSlots(ev0).filter(function (s) { return s.key === key; })[0];
    if (!slot) return null;
    var L = slot.level, at = Math.max(L, build.level);   // compare at the level you're looking at, or the slot's level if that's later
    var baseB = withChoice(build, key, null), baseEv = DND.evaluate(baseB), base = A.metrics(baseB, baseEv, at), rec = findRec(baseEv, key);
    var prefer = A.keyAbilities(baseB, baseEv, at), abil = baseEv.levels[L - 1].state.abilities, options = [];
    function add(id, label, sub, desc, o) {
      var b = withChoice(build, key, id, sub);
      if (!sub) autofill(b, key, prefer);
      var ev = DND.evaluate(b), m = A.metrics(b, ev, at), r2 = findRec(ev, key);
      var picks = [];
      if (r2) (function walk(list) { list.forEach(function (c) { var v = Array.isArray(c.value) ? c.value : c.value ? [c.value] : []; v.forEach(function (x) { var op = c.options.filter(function (q) { return q.id === x; })[0]; picks.push(op ? op.label : x); }); walk(c.children); }); })(r2.children);
      var delta = {}; ['dpr', 'hit', 'dc', 'hp', 'ac', 'init', 'con', 'pp', 'skills'].forEach(function (k) { delta[k] = m[k] == null || base[k] == null ? 0 : m[k] - base[k]; });
      var ups = DND.ABILITIES.filter(function (a) { return m.abilities[a] > base.abilities[a]; }).map(function (a) { return '+' + (m.abilities[a] - base.abilities[a]) + ' ' + a.toUpperCase(); });
      options.push({ id: id, label: label, sub: sub || null, m: m, delta: delta, desc: desc || '', unavailable: o && o.unavailable || '', picks: sub ? [] : picks, ups: ups,
        current: build.choices[key] === id && (!sub || Object.keys(sub).every(function (k) { return build.choices[key + '.' + id + '.' + k] === sub[k]; })) });
    }
    if (rec && rec.options.some(function (o) { return o.id === 'asi'; })) {
      var open = prefer.filter(function (a) { return abil[a] < 20; }).slice(0, 4);
      open.forEach(function (a) { if (abil[a] <= 18) add('asi', '+2 ' + DND.ABILITY_NAMES[a], { a: a, b: a }, DND.ABILITY_NAMES[a] + ' ' + abil[a] + ' → ' + (abil[a] + 2)); });
      var odd = DND.ABILITIES.filter(function (a) { return abil[a] % 2 === 1 && abil[a] < 20; }).sort(function (x, y) { return (prefer.indexOf(x) < 0 ? 9 : prefer.indexOf(x)) - (prefer.indexOf(y) < 0 ? 9 : prefer.indexOf(y)); });
      if (odd.length >= 2) add('asi', '+1 ' + DND.ABILITY_NAMES[odd[0]] + ', +1 ' + DND.ABILITY_NAMES[odd[1]], { a: odd[0], b: odd[1] }, 'Rounds up two odd scores: ' + odd[0].toUpperCase() + ' ' + abil[odd[0]] + ' → ' + (abil[odd[0]] + 1) + ', ' + odd[1].toUpperCase() + ' ' + abil[odd[1]] + ' → ' + (abil[odd[1]] + 1));
      else if (odd.length === 1 && open.length) { var other = open.filter(function (a) { return a !== odd[0]; })[0]; if (other) add('asi', '+1 ' + DND.ABILITY_NAMES[odd[0]] + ', +1 ' + DND.ABILITY_NAMES[other], { a: odd[0], b: other }, 'Rounds up ' + odd[0].toUpperCase() + ' ' + abil[odd[0]]); }
    }
    (rec ? rec.options : []).forEach(function (o) { if (o.id !== 'asi') add(o.id, o.label, null, o.desc, o); });
    // A simple score to order the list: offense first, then staying alive. It's a starting point, not a verdict.
    options.forEach(function (o) {
      var d = o.delta;
      o.score = (base.dpr ? d.dpr / base.dpr * 100 : d.dpr * 10) + d.dc * 5 + d.ac * 5 + (base.hp ? d.hp / base.hp * 60 : 0) + d.init * 0.8 + d.con * 1.5 + d.pp * 0.3 + d.skills * 0.2;
      o.measured = ['dpr', 'hit', 'dc', 'hp', 'ac', 'init', 'con', 'pp', 'skills'].some(function (k) { return Math.abs(d[k]) > 0.001; });
    });
    options.sort(function (x, y) { return (x.unavailable ? 1 : 0) - (y.unavailable ? 1 : 0) || y.score - x.score; });
    var notes = [], k0 = prefer[0];
    if (k0 && abil[k0] < 20) notes.push(abil[k0] % 2 ? 'Your ' + DND.ABILITY_NAMES[k0] + ' is odd (' + abil[k0] + '). A feat that gives +1 ' + DND.ABILITY_NAMES[k0] + ' raises the modifier just like the first half of a +2, and adds its own benefit.' :
      'Your ' + DND.ABILITY_NAMES[k0] + ' is ' + abil[k0] + '. +2 raises its modifier by 1: that is +1 to hit and damage or +1 spell save DC, on every roll.');
    if (k0 && abil[k0] >= 20) notes.push('Your ' + DND.ABILITY_NAMES[k0] + ' is already 20, so a feat or a secondary ability is the better use of this slot.');
    var res = { slot: slot, level: L, at: at, base: base, options: options, notes: notes, target: A.target(at), prefer: prefer };
    memo = { k: mk, v: res };
    return res;
  };

  /* ---------- Turn advice ---------- */

  var DISADV = ['Poisoned', 'Prone', 'Frightened', 'Restrained', 'Blinded'];
  // o: { ac, save, targets, mode } (blank values use a typical opponent for the level).
  A.turn = function (build, ev, o) {
    o = o || {};
    var L = build.level, lv = ev.levels[L - 1], d = lv.d, p = build.play || {}, t = A.target(L), used = p.used || {}, conds = p.conds || {}, turnUsed = p.turn || {};
    var ac = o.ac > 0 ? +o.ac : t.ac, save = o.save != null && o.save !== '' ? +o.save : t.save, targets = Math.max(1, +o.targets || 1);
    var dis = DISADV.filter(function (c) { return conds[c]; }), mode = o.mode === 'adv' && dis.length ? '' : dis.length ? 'dis' : o.mode || '';
    var hitMod = -2 * (p.exh || 0), pr = DND.playResources(build, ev), notes = [], actions = [], heals = [];
    function left(c) { return c.max - Math.min(used[c.id] || 0, c.max); }
    var hp = p.hp == null ? d.hp : Math.max(0, Math.min(p.hp, d.hp));
    if (dis.length) notes.push(dis.join(' and ') + ': your attack rolls have Disadvantage' + (o.mode === 'adv' ? ', which cancels the Advantage you selected.' : '.'));
    if (p.exh) notes.push('Exhaustion ' + p.exh + ': ' + hitMod + ' to your attack rolls and other D20 Tests.');
    ['Incapacitated', 'Paralyzed', 'Stunned', 'Unconscious', 'Petrified'].forEach(function (c) { if (conds[c]) notes.push(c + ': you can\'t take actions, Bonus Actions or Reactions.'); });
    var w = A.weaponRound(d, { ac: ac, mode: mode, hitMod: hitMod });
    if (w) actions.push({ name: 'Attack: ' + w.name + (w.attacks > 1 ? ' ×' + w.attacks : ''), kind: 'Attack action', exp: w.exp, how: w.how, cost: '', note: w.mastery ? 'Mastery: ' + w.mastery : '' });
    // Slots still available, lowest first.
    var slots = pr.slots.map(function (s) { return { id: s.id, level: s.level, left: left(s) }; });
    if (pr.pact) slots.push({ id: pr.pact.id, level: pr.pact.level, left: left(pr.pact), pact: true });
    slots = slots.filter(function (s) { return s.left > 0; }).sort(function (x, y) { return x.level - y.level; });
    knownSpells(build, ev, L).forEach(function (k) {
      if (!k.caster) return;
      var sl = k.sp.level ? slots.filter(function (s) { return s.level >= k.sp.level; })[0] : null;
      if (k.sp.level && !sl) return;
      var e = A.spellExpected(k.sp, k.caster, L, sl ? sl.level : 0, { ac: ac, save: save, mode: mode, hitMod: hitMod, targets: targets, abilityScore: lv.state.abilities[k.caster.ability] });
      if (!e) return;
      var time = /bonus action/i.test(k.sp.time || '') ? 'Bonus Action' : /reaction/i.test(k.sp.time || '') ? 'Reaction' : 'Magic action';
      var row = { name: k.name, kind: time, exp: e.exp, how: e.how, cost: k.sp.level ? (sl.pact ? 'Pact' : 'level ' + sl.level) + ' slot' : 'cantrip', note: (e.area ? 'area' : '') + (/Concentration/i.test(k.sp.dur || '') ? (e.area ? ', ' : '') + 'Concentration' : ''), dice: e.dice, spell: k.name, type: e.type };
      (e.heal ? heals : actions).push(row);
    });
    actions.sort(function (x, y) { return y.exp - x.exp; });
    // Features you can add to a turn.
    var extras = [], seen = {};
    ev.levels.slice(0, L).forEach(function (l) { l.features.forEach(function (f) {
      var txt = f.desc || '', kind = /^Bonus Action|as a Bonus Action|Bonus Action:/i.test(txt) ? 'Bonus Action' : /^Reaction|as a Reaction|Reaction:/i.test(txt) ? 'Reaction' : '';
      if (!kind || seen[f.name]) return;
      seen[f.name] = 1;
      var c = pr.counters.filter(function (x) { return x.name.toLowerCase().indexOf(f.name.toLowerCase().replace(/\s*\(.*/, '')) >= 0; })[0];
      extras.push({ name: f.name, kind: kind, text: txt, left: c ? left(c) : null, max: c ? c.max : null });
    }); });
    var surge = pr.counters.filter(function (c) { return /^Action Surge/i.test(c.name); })[0];
    if (surge && left(surge) > 0 && w) notes.push('Action Surge is available: a second Attack action adds about ' + w.exp.toFixed(1) + ' more damage this turn.');
    if (turnUsed['turn:action']) notes.push('Your Action is marked as used this turn. Look at your Bonus Action and Reaction options.');
    // Staying alive.
    var hurt = d.hp ? hp / d.hp : 1;
    if (hurt <= 0.35) {
      var sw = pr.counters.filter(function (c) { return /^Second Wind/i.test(c.name); })[0], potions = (build.inventory || []).filter(function (e) { var it = e.id && DND.item(e.id); return /potion of (greater |superior |supreme )?healing/i.test((it && it.name) || e.name || ''); });
      var tips = [];
      if (sw && left(sw) > 0) tips.push('Second Wind (Bonus Action, about ' + (5.5 + L) + ' HP)');
      heals.forEach(function (h) { tips.push(h.name + ' (' + h.kind + ', about ' + h.exp.toFixed(0) + ' HP, ' + h.cost + ')'); });
      if (potions.length) tips.push('a Potion of Healing from your inventory');
      notes.unshift('You\'re at ' + hp + ' of ' + d.hp + ' HP (' + Math.round(hurt * 100) + '%). ' + (tips.length ? 'Ways to recover: ' + tips.join('; ') + '. ' : '') + 'Dodge or Disengage are worth considering if you can\'t finish the fight this turn.');
    }
    var best = actions.filter(function (a) { return a.kind !== 'Reaction'; })[0] || null, freeBest = actions.filter(function (a) { return a.kind !== 'Reaction' && (!a.cost || a.cost === 'cantrip'); })[0] || null;
    return { ac: ac, save: save, targets: targets, mode: mode, typical: t, actions: actions, heals: heals, extras: extras, notes: notes, best: best, freeBest: freeBest, hp: hp, maxHp: d.hp, slots: slots };
  };

  /* ---------- Ask ---------- */

  var STOP = /^(the|a|an|of|to|is|are|do|does|did|my|i|me|what|whats|how|many|much|can|should|when|it|on|in|for|with|have|has|left|use|uses|and|or|if|this|that|be|at|about|tell|show)$/;
  function words(q) { return String(q || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(function (w) { return w && !STOP.test(w); }); }
  // Returns { intent: 'levelup' | 'turn' | 'answer' | 'none', lines: [{ label, text, spell?, cond? }] }
  A.ask = function (build, ev, q) {
    var L = build.level, lv = ev.levels[L - 1], d = lv.d, s = lv.state, p = build.play || {}, ql = String(q || '').toLowerCase().trim(), ws = words(ql), lines = [];
    if (!ql) return { intent: 'none', lines: [] };
    if (/\b(feat|asi|ability score|level(ed|ing)? up|stat increase|increase (my )?stats?|which (feat|stat))\b/.test(ql)) return { intent: 'levelup', lines: [] };
    if (/\b(my turn|this turn|next move|optimal|best (move|action|attack|spell)|what should i (do|cast|attack)|what (do|can) i do|in combat)\b/.test(ql)) return { intent: 'turn', lines: [] };
    function sign(n) { return DND.sign(n); }
    // Numbers on the sheet.
    var facts = [
      [/\b(ac|armor class)\b/, 'Armor Class', d.ac + ' (' + d.acHow + ')'],
      [/\b(hp|hit points?|health)\b/, 'Hit Points', (p.hp == null ? d.hp : Math.min(p.hp, d.hp)) + ' of ' + d.hp + ' (Hit Dice ' + d.hitDice + ')'],
      [/\binitiative\b/, 'Initiative', sign(d.init)], [/\bspeed\b/, 'Speed', d.speed + ' ft'],
      [/\b(proficiency bonus|prof bonus|pb)\b/, 'Proficiency Bonus', sign(d.pb)], [/\bpassive\b/, 'Passive Perception', String(d.passivePerception)],
      [/\b(save dc|spell dc|dc)\b/, 'Spell save DC', d.spell ? d.spellcasters.map(function (c) { return c.dc + ' (' + c.className + ')'; }).join(', ') : 'You have no Spellcasting feature at this level.'],
      [/\bspell attack\b/, 'Spell attack', d.spell ? d.spellcasters.map(function (c) { return sign(c.attack); }).join(', ') : 'You have no Spellcasting feature at this level.'],
      [/\b(attacks?|to hit|damage)\b/, 'Attacks', (d.attacks || []).map(function (a) { return a.name + ' ' + sign(a.hit) + ', ' + a.dmg; }).join('; ') + (d.attacksPerAction > 1 ? ' · ' + d.attacksPerAction + ' attacks per Attack action' : '')]
    ];
    facts.forEach(function (f) { if (f[0].test(ql) && f[2]) lines.push({ label: f[1], text: f[2] }); });
    DND.ABILITIES.forEach(function (a) {
      var nm = DND.ABILITY_NAMES[a].toLowerCase();
      if (new RegExp('\\b(' + nm + '|' + a + ')\\b').test(ql)) lines.push({ label: DND.ABILITY_NAMES[a], text: s.abilities[a] + ' (' + sign(d.mods[a]) + '), save ' + sign(d.saves[a].total) + (d.saves[a].prof ? ' (proficient)' : '') });
    });
    Object.keys(DND.SKILLS).forEach(function (k) { if (ql.indexOf(DND.SKILLS[k].name.toLowerCase()) >= 0) lines.push({ label: DND.SKILLS[k].name, text: sign(d.skills[k].total) + (d.skills[k].level === 2 ? ' (expertise)' : d.skills[k].level ? ' (proficient)' : ' (not proficient)') }); });
    // What's left.
    var pr = DND.playResources(build, ev), used = p.used || {};
    function left(c) { return c.max - Math.min(used[c.id] || 0, c.max); }
    var wantsLeft = /\b(left|remaining|how many|uses?|slots?|rests?)\b/.test(ql);
    pr.counters.forEach(function (c) { if (ws.some(function (w) { return w.length > 2 && c.name.toLowerCase().indexOf(w) >= 0; })) lines.push({ label: c.name, text: left(c) + ' of ' + c.max + ' left · resets on a ' + (c.reset === 'short' ? 'Short or Long Rest' : 'Long Rest') + (c.shortRegain ? ' (regain ' + c.shortRegain + ' on a Short Rest)' : '') }); });
    if (/\bslots?\b/.test(ql) || (wantsLeft && /\bspells?\b/.test(ql))) {
      var sl = pr.slots.map(function (x) { return 'level ' + x.level + ': ' + left(x) + ' of ' + x.max; });
      if (pr.pact) sl.push('Pact (level ' + pr.pact.level + '): ' + left(pr.pact) + ' of ' + pr.pact.max);
      lines.push({ label: 'Spell slots', text: sl.join(' · ') || 'You have no spell slots at this level.' });
    }
    if (/\bhit dice?\b/.test(ql)) lines.push({ label: 'Hit Dice', text: pr.hitDice.map(function (h) { return left(h) + ' of ' + h.max + ' d' + h.die; }).join(' · ') });
    (DND.CONDITIONS || []).forEach(function (c) { if (new RegExp('\\b' + c[0].toLowerCase() + '\\b').test(ql)) lines.push({ label: c[0] + ' (condition)', text: c[1], cond: c[0] }); });
    // Features, traits, feats and spells that match the words.
    var docs = [];
    ev.levels.slice(0, L).forEach(function (l) { l.features.forEach(function (f) { if (f.name !== 'Proficiencies') docs.push({ label: f.name, text: f.desc || '', from: 'Feature · level ' + l.level }); }); });
    ev.species.traits.forEach(function (t) { docs.push({ label: t[0], text: t[1] || '', from: ev.species.name }); });
    s.feats.forEach(function (f) { docs.push({ label: f.name, text: f.desc || '', from: 'Feat' }); });
    knownSpells(build, ev, L).forEach(function (k) { docs.push({ label: k.name, text: k.sp.text || '', from: k.sp.level ? 'Level ' + k.sp.level + ' spell' : 'Cantrip', spell: k.name }); });
    var scored = docs.map(function (dc) {
      var nm = dc.label.toLowerCase(), tx = dc.text.toLowerCase(), sc = 0;
      ws.forEach(function (w) { if (w.length < 3) return; if (nm.indexOf(w) >= 0) sc += 5; else if (tx.indexOf(w) >= 0) sc += 1; });
      if (ql.indexOf(nm) >= 0) sc += 10;
      return { d: dc, sc: sc };
    }).filter(function (x) { return x.sc >= (ws.length > 1 ? 2 : 1); }).sort(function (x, y) { return y.sc - x.sc; });
    var seenL = {};
    scored.slice(0, 5).forEach(function (x) { if (seenL[x.d.label]) return; seenL[x.d.label] = 1; lines.push({ label: x.d.label, from: x.d.from, text: x.d.text.length > 420 ? x.d.text.slice(0, 400).replace(/\s+\S*$/, '') + '…' : x.d.text, spell: x.d.spell }); });
    return { intent: lines.length ? 'answer' : 'none', lines: lines };
  };

  /* ====================================================================== */
  /* Screen                                                                  */
  /* ====================================================================== */

  var ui = DND.advisorUi = {};
  function U() { return DND.ui; }
  function esc(s) { return U().esc(s); }
  function st() { var a = U().app; if (!a.adv) a.adv = { q: '', ac: '', targets: 1, mode: '', slot: '', more: false }; return a.adv; }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function dlt(n, digits, unit) {
    if (Math.abs(n) < 0.05) return '<span class="muted nil">—</span>';
    var v = digits ? fmt1(Math.abs(n)) : Math.abs(Math.round(n));
    return '<span class="' + (n > 0 ? 'up' : 'down') + '">' + (n > 0 ? '+' : '−') + v + (unit || '') + '</span>';
  }

  function askCard(b, ev) {
    var s = st(), res = s.q ? A.ask(b, ev, s.q) : null, body = '';
    if (res && res.intent === 'levelup') body = '<p class="desc">That\'s a level-up question: see <b>Level-up advice</b> below.</p>';
    else if (res && res.intent === 'turn') body = '<p class="desc">That\'s a turn question: see <b>This turn</b> below.</p>';
    else if (res && res.intent === 'none') body = '<p class="desc">Nothing on this character matches that. Try a feature, spell or stat name (for example "sneak attack", "AC", "slots left").</p>';
    else if (res) body = '<div class="rows adv-answers">' + res.lines.map(function (l) {
      var name = l.spell ? '<button type="button" class="linklike" data-spellinfo="' + esc(l.spell) + '">' + esc(l.label) + '</button>' : l.cond ? '<button type="button" class="linklike" data-condinfo="' + esc(l.cond) + '">' + esc(l.label) + '</button>' : '<b>' + esc(l.label) + '</b>';
      return '<div class="row"><span>' + name + (l.from ? ' <span class="muted">' + esc(l.from) + '</span>' : '') + '<span class="adv-text">' + U().rollify(esc(l.text), l.label) + '</span></span></div>';
    }).join('') + '</div>';
    var chips = ['Feat or +2 to a stat?', 'What should I do this turn?', 'What\'s my AC?', 'Slots left', 'Initiative'];
    return '<section class="card"><div class="card-head"><h3>Ask about this character</h3><span class="muted">Looks things up on your sheet</span></div><div class="card-body">' +
      '<form class="add-custom" data-advform="ask"><label class="sr" for="adv-q">Question</label><input id="adv-q" type="text" maxlength="120" value="' + esc(s.q) + '" placeholder="e.g. sneak attack, how many rages left, what\'s my save DC">' +
      '<button type="submit" class="btn btn-primary">Ask</button></form>' +
      '<div class="chips adv-chips">' + chips.map(function (c) { return '<button type="button" class="btn btn-small" data-adv="q" data-q="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' + body + '</div></section>';
  }

  function levelCard(b, ev) {
    var s = st(), slots = A.featSlots(ev);
    if (!slots.length) return '<section class="card" id="adv-level"><div class="card-head"><h3>Level-up advice</h3></div><div class="card-body"><p class="desc">This class has no feat choices to compare.</p></div></section>';
    var cur = slots.filter(function (x) { return x.key === s.slot; })[0] || slots.filter(function (x) { return x.level >= b.level; })[0] || slots[slots.length - 1];
    var r = A.levelUp(b, cur.key), base = r.base;
    var shown = s.more ? r.options : r.options.filter(function (o, i) { return i < 6 || o.current; });
    var rows = shown.map(function (o) {
      var d = o.delta, extra = [];
      if (Math.abs(d.con) > 0.05) extra.push('Con save ' + (d.con > 0 ? '+' : '') + d.con);
      if (Math.abs(d.pp) > 0.05) extra.push('Passive Perception ' + (d.pp > 0 ? '+' : '') + d.pp);
      if (Math.abs(d.skills) > 0.05) extra.push('skills ' + (d.skills > 0 ? '+' : '') + d.skills + ' in total');
      var sub = o.sub ? o.desc : (o.ups.length ? o.ups.join(', ') + '. ' : '') + (o.picks.length && !o.ups.length ? 'Assumes: ' + o.picks.slice(0, 4).join(', ') + '. ' : '') + o.desc;
      return '<tr class="' + (o.current ? 'adv-current' : '') + (o.unavailable ? ' adv-na' : '') + '"><td><b>' + esc(o.label) + '</b>' + (o.current ? ' <span class="pill pill-ok">your pick</span>' : '') + (o.unavailable ? ' <span class="pill pill-plain">' + esc(o.unavailable) + '</span>' : '') +
        '<div class="adv-sub">' + esc(sub.length > 230 ? sub.slice(0, 220).replace(/\s+\S*$/, '') + '…' : sub) + (extra.length ? (/[.…]$/.test(sub) ? ' ' : '. ') + '<span class="muted">Also: ' + esc(extra.join(', ')) + '.</span>' : '') +
        (!o.measured && !o.sub ? ' <span class="muted">Its benefit isn\'t one the numbers capture; judge it by the text.</span>' : '') + '</div></td>' +
        '<td class="n" data-label="Damage / round">' + dlt(d.dpr, 1) + (base.dpr && Math.abs(d.dpr) >= 0.05 ? '<small>' + (d.dpr > 0 ? '+' : '−') + Math.abs(Math.round(d.dpr / base.dpr * 100)) + '%</small>' : '') + '</td>' +
        '<td class="n" data-label="To hit">' + dlt(d.hit) + '</td><td class="n" data-label="Save DC">' + dlt(d.dc) + '</td><td class="n" data-label="HP">' + dlt(d.hp) + '</td><td class="n" data-label="AC">' + dlt(d.ac) + '</td><td class="n" data-label="Init">' + dlt(d.init) + '</td>' +
        '<td class="n">' + (o.current || o.unavailable ? '' : '<button type="button" class="btn btn-small" data-adv="take" data-i="' + r.options.indexOf(o) + '">Choose</button>') + '</td></tr>';
    }).join('');
    var top = r.options.filter(function (o) { return !o.unavailable; }), bestOff = top.slice().sort(function (x, y) { return y.delta.dpr - x.delta.dpr; })[0], bestDef = top.slice().sort(function (x, y) { return (y.delta.hp + y.delta.ac * 8) - (x.delta.hp + x.delta.ac * 8); })[0];
    var verdict = [];
    if (bestOff && bestOff.delta.dpr > 0.05) verdict.push('<b>Most damage:</b> ' + esc(bestOff.label) + ' (' + fmt1(bestOff.delta.dpr) + ' more per round' + (base.dpr ? ', about ' + Math.round(bestOff.delta.dpr / base.dpr * 100) + '%' : '') + ').');
    if (bestDef && (bestDef.delta.hp > 0 || bestDef.delta.ac > 0)) verdict.push('<b>Toughest:</b> ' + esc(bestDef.label) + ' (' + [bestDef.delta.hp > 0 ? '+' + bestDef.delta.hp + ' HP' : '', bestDef.delta.ac > 0 ? '+' + bestDef.delta.ac + ' AC' : ''].filter(Boolean).join(', ') + ').');
    return '<section class="card" id="adv-level"><div class="card-head"><h3>Level-up advice</h3><span class="muted">Each option is tried on your build and compared</span></div><div class="card-body">' +
      '<div class="field" style="max-width:420px"><label for="adv-slot">Which choice</label><select id="adv-slot" data-advf="slot">' + slots.map(function (x) {
        var f = x.value && DND.feat(x.value);
        return '<option value="' + esc(x.key) + '"' + (x.key === cur.key ? ' selected' : '') + '>Level ' + x.level + ' · ' + esc(x.label) + (x.value ? ' (' + esc(f ? f.name : x.value) + ')' : ' — not chosen') + '</option>'; }).join('') + '</select></div>' +
      '<p class="desc">Numbers are for level ' + r.at + ', against a typical opponent of that level (AC ' + r.target.ac + '). Now, without this choice: <b>' + fmt1(base.dpr) + '</b> damage per round with ' + esc(base.dprSrc) +
      (base.hit != null ? ', ' + DND.sign(base.hit) + ' to hit' : '') + (base.dc ? ', save DC ' + base.dc : '') + ', ' + base.hp + ' HP, AC ' + base.ac + '.</p>' +
      (verdict.length ? '<p class="adv-verdict">' + verdict.join(' ') + '</p>' : '') + r.notes.map(function (n) { return '<p class="desc">' + esc(n) + '</p>'; }).join('') +
      '<div class="table-wrap"><table class="adv-table"><thead><tr><th>Option</th><th class="n">Damage / round</th><th class="n">To hit</th><th class="n">Save DC</th><th class="n">HP</th><th class="n">AC</th><th class="n">Init</th><th class="n"></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (r.options.length > shown.length ? '<div class="chips" style="margin-top:10px"><button type="button" class="btn btn-small" data-adv="more">Show all ' + r.options.length + ' options</button></div>' : '') +
      '<p class="desc muted">What this measures: attack bonus, damage, save DC, HP, AC, initiative, saves and skills. What it can\'t: benefits written only as text (new abilities, rerolls, movement, utility). Read those in the option\'s description.</p></div></section>';
  }

  function turnCard(b, ev) {
    var s = st(), r = A.turn(b, ev, { ac: s.ac, targets: s.targets, mode: s.mode }), best = r.best;
    var rows = r.actions.slice(0, s.more2 ? 99 : 8).map(function (a, i) {
      var gap = best && i ? best.exp - a.exp : 0;
      return '<tr class="' + (a === best ? 'adv-current' : '') + '"><td>' + (a.spell ? '<button type="button" class="linklike" data-spellinfo="' + esc(a.spell) + '">' + esc(a.name) + '</button>' : '<b>' + esc(a.name) + '</b>') + (a === best ? ' <span class="pill pill-ok">most damage</span>' : '') +
        '<div class="adv-sub">' + esc(a.kind) + (a.cost ? ' · ' + esc(a.cost) : '') + (a.note ? ' · ' + esc(a.note) : '') + '</div></td>' +
        '<td class="n" data-label="Average damage"><b>' + fmt1(a.exp) + '</b>' + (gap > 0.05 ? '<small>' + fmt1(gap) + ' less</small>' : '') + '</td><td>' + esc(a.how) + (a.dice ? ' · ' + U().rollBtn(a.dice.replace(/\s+/g, ''), a.name, esc(a.dice)) : '') + '</td></tr>';
    }).join('');
    var say = '';
    if (best) {
      say = '<p class="adv-verdict"><b>' + esc(best.name) + '</b> does the most on average: about <b>' + fmt1(best.exp) + '</b> damage' + (best.cost && best.cost !== 'cantrip' ? ', for a ' + esc(best.cost) : '') + '.' +
        (r.freeBest && r.freeBest !== best ? ' Without spending anything, <b>' + esc(r.freeBest.name) + '</b> does about ' + fmt1(r.freeBest.exp) + ', so the slot buys ' + fmt1(best.exp - r.freeBest.exp) + ' more.' : '') + '</p>';
    }
    var extras = r.extras.length ? '<h4>Also available</h4><div class="rows">' + r.extras.map(function (x) {
      return '<div class="row"><span><b>' + esc(x.name) + '</b> <span class="pill pill-plain">' + x.kind + '</span>' + (x.max != null ? ' <span class="muted">' + x.left + ' of ' + x.max + ' left</span>' : '') + '<span class="adv-text">' + U().rollify(esc(x.text.length > 200 ? x.text.slice(0, 190).replace(/\s+\S*$/, '') + '…' : x.text), x.name) + '</span></span></div>'; }).join('') + '</div>' : '';
    return '<section class="card" id="adv-turn"><div class="card-head"><h3>This turn</h3><span class="muted">Ranked by average damage, using what you have left</span></div><div class="card-body">' +
      '<div class="gear-grid adv-inputs"><div class="field"><label for="adv-ac">Target\'s AC</label><input id="adv-ac" type="number" min="1" max="40" inputmode="numeric" value="' + esc(s.ac) + '" placeholder="' + r.typical.ac + ' (typical)" data-advf="ac"></div>' +
      '<div class="field"><label for="adv-n">Enemies an area would catch</label><input id="adv-n" type="number" min="1" max="20" inputmode="numeric" value="' + esc(s.targets) + '" data-advf="targets"></div>' +
      '<div class="field"><span class="label">Your attack rolls</span><div class="seg" role="group" aria-label="Advantage">' + [['dis', 'Disadvantage'], ['', 'Normal'], ['adv', 'Advantage']].map(function (m) {
        return '<button type="button" data-adv="mode" data-m="' + m[0] + '" aria-pressed="' + (s.mode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div></div></div>' +
      (r.notes.length ? '<ul class="warn-list adv-notes">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') + say +
      (rows ? '<div class="table-wrap"><table class="adv-table"><thead><tr><th>Option</th><th class="n">Average damage</th><th>How</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="desc">No attacks or damaging spells to compare. Equip a weapon in Gear or pick spells in Spells.</p>') +
      (r.actions.length > 8 && !s.more2 ? '<div class="chips" style="margin-top:10px"><button type="button" class="btn btn-small" data-adv="more2">Show all ' + r.actions.length + '</button></div>' : '') + extras +
      '<p class="desc muted">Averages count misses, critical hits and saves, against AC ' + r.ac + ' and a save bonus of ' + DND.sign(r.save) + (s.ac ? '' : ' (a typical level ' + b.level + ' opponent; enter the real AC if you know it)') + '. The app can\'t see the battlefield: range, cover, who is about to fall, and control effects can matter more than damage. Uses, slots and conditions come from the Play tab.</p></div></section>';
  }

  ui.render = function () {
    var a = U().app, b = U().cur(), ev = U().ev();
    if (a.advOff) {
      return '<div class="toolbar"><h2>Advisor</h2></div><section class="card"><div class="card-body"><p>The advisor is turned off. It answers questions about this character by calculating from the sheet; nothing is sent anywhere and no AI model is used.</p>' +
        '<button type="button" class="btn btn-primary" data-adv="on">Turn the advisor on</button></div></section>';
    }
    return '<div class="toolbar"><h2>Advisor at level ' + b.level + '</h2><div class="chips"><span class="muted">Calculated from your sheet · works offline</span><button type="button" class="btn btn-small" data-adv="off">Turn off</button></div></div>' +
      askCard(b, ev) + turnCard(b, ev) + levelCard(b, ev);
  };
  function scrollTo(id) { setTimeout(function () { var el = document.getElementById(id); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30); }
  function ask(q) {
    var s = st(), r; s.q = String(q || '').slice(0, 120);
    r = A.ask(U().cur(), U().ev(), s.q);
    U().commit();
    if (r.intent === 'levelup') scrollTo('adv-level'); else if (r.intent === 'turn') scrollTo('adv-turn');
  }
  ui.click = function (t) {
    var s = st(), a = U().app, ds = t.dataset, b = U().cur();
    switch (ds.adv) {
      case 'on': a.advOff = false; break;
      case 'off': a.advOff = true; break;
      case 'q': ask(ds.q); return;
      case 'mode': s.mode = ds.m; break;
      case 'more': s.more = true; break;
      case 'more2': s.more2 = true; break;
      case 'open': a.tab = 'advisor'; a.advOff = false; if (ds.slot) { s.slot = ds.slot; s.more = false; } U().commit(); scrollTo(ds.to); return;
      case 'take': {
        var slots = A.featSlots(U().ev()), cur = slots.filter(function (x) { return x.key === s.slot; })[0] || slots.filter(function (x) { return x.level >= b.level; })[0] || slots[slots.length - 1];
        var o = cur && A.levelUp(b, cur.key).options[+ds.i];
        if (!o) break;
        Object.keys(b.choices).forEach(function (k) { if (k === cur.key || k.indexOf(cur.key + '.') === 0) delete b.choices[k]; });
        b.choices[cur.key] = o.id;
        Object.keys(o.sub || {}).forEach(function (k) { b.choices[cur.key + '.' + o.id + '.' + k] = o.sub[k]; });
        s.slot = cur.key;
        break;
      }
    }
    U().commit();
  };
  ui.change = function (t) {
    var s = st(), k = t.dataset.advf;
    if (k === 'slot') { s.slot = t.value; s.more = false; }
    if (k === 'ac') s.ac = t.value === '' ? '' : Math.max(1, Math.min(40, parseInt(t.value, 10) || 10));
    if (k === 'targets') s.targets = Math.max(1, Math.min(20, parseInt(t.value, 10) || 1));
    U().commit();
  };
  ui.submit = function (form) { if (form.dataset.advform === 'ask') ask(document.getElementById('adv-q').value); };
})(typeof window !== 'undefined' ? window : globalThis);
