/*
 * Game Master rules: encounter difficulty (2024 XP budgets), creature statistics
 * read from stat blocks, a Challenge Rating estimate that compares a creature with
 * the SRD creatures of each CR, and custom creatures built from a form model.
 */
(function (G) {
  var DND = G.DND = G.DND || {};

  /* ---------- Challenge Rating and XP ---------- */

  DND.CR_LIST = ['0', '1/8', '1/4', '1/2'].concat(Array.from({ length: 30 }, function (_, i) { return String(i + 1); }));
  var XP = [10, 25, 50, 100, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000, 20000,
    22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000];
  DND.XP_BY_CR = {};
  DND.CR_LIST.forEach(function (c, i) { DND.XP_BY_CR[c] = XP[i]; });
  function crKey(cr) { var m = /^\s*(\d+\/\d+|\d+)/.exec(String(cr == null ? '' : cr)); return m && DND.XP_BY_CR[m[1]] != null ? m[1] : '0'; }
  DND.crKey = crKey;
  DND.crXp = function (cr) { return DND.XP_BY_CR[crKey(cr)]; };
  DND.crNumber = function (cr) { var k = crKey(cr), p = k.split('/'); return p.length > 1 ? +p[0] / +p[1] : +k; };
  DND.crProf = function (cr) { return 2 + Math.floor(Math.max(0, DND.crNumber(cr) - 1) / 4); };

  // XP Budget per Character (SRD 5.2, Combat Encounter Difficulty): [Low, Moderate, High] for levels 1-20.
  // Checked row by row against the SRD text.
  DND.XP_BUDGET = [[50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100], [600, 1000, 1400], [750, 1300, 1700],
    [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100], [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200],
    [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000]];
  DND.DIFFICULTY = [
    ['Low', 'One or two scary moments, but the party should win without casualties. Healing resources may be needed. As a rough guide, one creature whose CR equals the party\'s level is a Low fight for four characters.'],
    ['Moderate', 'Could go badly without healing and other resources. Weaker characters might be taken out, and there\'s a slim chance someone dies.'],
    ['High', 'Could be lethal for one or more characters. The party needs smart tactics, quick thinking and maybe a little luck.']
  ];

  // levels: character levels. monsters: [{ cr, count }].
  // Returns the party's budgets, the encounter's XP, where it lands, and cautions from the encounter guidance.
  DND.encounterDifficulty = function (levels, monsters) {
    levels = (levels || []).map(function (l) { return Math.max(1, Math.min(20, Math.round(+l) || 1)); });
    var budget = [0, 0, 0];
    levels.forEach(function (l) { for (var i = 0; i < 3; i++) budget[i] += DND.XP_BUDGET[l - 1][i]; });
    var xp = 0, count = 0, topCr = 0, cr0 = 0, kinds = 0;
    var minLevel = levels.length ? Math.min.apply(null, levels) : 0, maxLevel = levels.length ? Math.max.apply(null, levels) : 0;
    (monsters || []).forEach(function (m) {
      var n = Math.max(0, +m.count || 0);
      xp += DND.crXp(m.cr) * n; count += n;
      if (n) { topCr = Math.max(topCr, DND.crNumber(m.cr)); kinds++; if (DND.crNumber(m.cr) === 0) cr0 += n; }
    });
    var tier = !levels.length || !count ? -1 : xp <= budget[0] ? 0 : xp <= budget[1] ? 1 : xp <= budget[2] ? 2 : 3;
    var avgLevel = levels.length ? levels.reduce(function (a, b) { return a + b; }, 0) / levels.length : 0;
    var notes = [];
    if (levels.length && count) {
      if (tier === 3) notes.push('Over the High budget by ' + (xp - budget[2]).toLocaleString() + ' XP. Expect characters to drop; a total party defeat is possible.');
      if (count > levels.length * 2) notes.push('Many creatures: ' + count + ' against ' + levels.length + ' character' + (levels.length === 1 ? '' : 's') + '. With more than two creatures per character, a lucky streak can deal more damage than you expect, so include fragile creatures that go down quickly' + (avgLevel <= 2 ? '. This matters most at levels 1 and 2.' : '.'));
      if (topCr > minLevel) notes.push('Powerful creature: CR ' + topCr + ' against ' + (minLevel === maxLevel ? 'a level ' + minLevel + ' party' : 'characters as low as level ' + minLevel) + '. A creature whose CR is higher than the party\'s level might deal enough damage with one action to take out one or more characters.');
      if (cr0 > 2) notes.push('CR 0 creatures: ' + cr0 + ' in this encounter. Use them sparingly; for many small critters, use a swarm instead.');
      if (kinds > 3) notes.push('Stat blocks: ' + kinds + ' different creatures. More than two or three stat blocks in one encounter can be hard to run, especially if they\'re complex.');
      if (minLevel !== maxLevel) notes.push('Mixed levels: the rules assume one party level. Here each character\'s budget uses their own level (' + minLevel + ' to ' + maxLevel + ').');
    }
    return { budget: budget, xp: xp, count: count, tier: tier, label: tier < 0 ? '' : tier === 3 ? 'Beyond High' : DND.DIFFICULTY[tier][0],
      desc: tier < 0 ? '' : tier === 3 ? 'More than the High budget: likely lethal.' : DND.DIFFICULTY[tier][1],
      perCharacter: levels.length ? Math.floor(xp / levels.length) : 0, partySize: levels.length, avgLevel: avgLevel, topCr: topCr, notes: notes };
  };

  /* ---------- Reading statistics out of a stat block ---------- */

  var NUM_WORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  function firstNumber(s) { var m = /-?\d+/.exec(String(s == null ? '' : s)); return m ? +m[0] : 0; }
  DND.firstNumber = firstNumber;
  DND.diceAverage = function (expr) {
    var total = 0;
    DND.parseDice(String(expr || '').replace(/−/g, '-')).forEach(function (t) { total += t.s ? t.sign * t.n * (t.s + 1) / 2 : t.k; });
    return Math.floor(total);
  };
  // Average damage named in an action's text: every "13 (2d8 + 4)" (or a flat "5 Fire damage").
  function actionDamage(text) {
    var t = String(text || ''), sum = 0, m, re = /(\d+)\s*\(\s*\d+d\d+(?:\s*[+−-]\s*\d+)?\s*\)/g;
    while ((m = re.exec(t))) sum += +m[1];
    if (!sum) { re = /(?:Hit|Failure|Failed Save)[^.]*?:\s*(\d+)\s+\w+\s+damage/gi; while ((m = re.exec(t))) sum += +m[1]; }
    return sum;
  }
  function isArea(text) { return /\b(each|every) creature\b|\bCone\b|\bLine\b|\bEmanation\b|-foot[- ](radius|cube|sphere|cone|line)/i.test(text || ''); }
  function isLimited(a) { return /\(Recharge|\/Day\b|\/day\b|Recharges after/i.test((a.name || '') + ' ' + (a.text || '').slice(0, 60)); }

  // { hp, ac, attack, dc, dpr, init, pb } for any creature in the monster format.
  DND.monsterStats = function (m) {
    var actions = (m.action || []).filter(function (a) { return a && a.name; });
    var attack = 0, dc = 0;
    (m.action || []).concat(m.bonus || [], m.trait || [], m.legendary || [], m.reaction || []).forEach(function (a) {
      var t = (a && a.text) || '', x, re = /(?:Attack Roll:\s*|\b)\+(\d+)(?:,| to hit)/g;
      while ((x = re.exec(t))) attack = Math.max(attack, +x[1]);
      re = /\bDC\s*(\d+)/g;
      while ((x = re.exec(t))) dc = Math.max(dc, +x[1]);
    });
    var dmg = {}, best = 0, bestLimited = 0;
    actions.forEach(function (a) {
      if (/^Multiattack/i.test(a.name)) return;
      var d = actionDamage(a.text) * (isArea(a.text) ? 2 : 1);
      dmg[a.name.replace(/\s*\(.*$/, '').toLowerCase()] = d;
      if (isLimited(a)) bestLimited = Math.max(bestLimited, d); else best = Math.max(best, d);
    });
    var multi = actions.filter(function (a) { return /^Multiattack/i.test(a.name); })[0], routine = best;
    if (multi) {
      var total = 0, x2, re2 = /\b(one|two|three|four|five|six|seven|eight|\d+)\s+((?:[A-Z][\w'’-]*\s+){0,4})?attacks?\b/g;
      while ((x2 = re2.exec(multi.text))) {
        var n = NUM_WORD[x2[1].toLowerCase()] || +x2[1] || 1, nm = (x2[2] || '').trim().toLowerCase();
        total += n * (nm && dmg[nm] != null ? dmg[nm] : best);
      }
      routine = Math.max(routine, total);
    }
    var dpr = bestLimited > routine ? Math.round((bestLimited + 2 * routine) / 3) : routine;
    // Legendary actions add damage outside the creature's own turn.
    var leg = (m.legendary || []).filter(function (a) { return a && a.text; }), legBest = 0, legUses = 3;
    leg.forEach(function (a) {
      var u = /(\d+)\/Turn|take (\d+) legendary/i.exec((a.name || '') + ' ' + a.text);
      if (u && /legendary action/i.test((a.name || '') + a.text.slice(0, 80))) { legUses = +(u[1] || u[2]); return; }
      var d = actionDamage(a.text), ref = /\b(?:one|a|an)\s+((?:[A-Z][\w'’-]*\s+){1,4})attack/.exec(a.text);
      if (!d && ref && dmg[ref[1].trim().toLowerCase()] != null) d = dmg[ref[1].trim().toLowerCase()];
      legBest = Math.max(legBest, d);
    });
    if (leg.length) dpr += legBest * legUses;
    return { hp: firstNumber(m.hp), ac: firstNumber(m.ac), attack: attack, dc: dc, dpr: dpr, init: m.init != null && m.init !== '' ? firstNumber(m.init) : DND.mod(+m.dex || 10), pb: DND.crProf(m.cr) };
  };

  /* ---------- Typical statistics by CR, measured from the SRD creatures ---------- */

  function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); var n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; }
  var benchCache = null, benchFor = null;
  // One row per CR in DND.CR_LIST: { cr, n, hp, ac, attack, dc, dpr }. Gaps are interpolated; HP and damage only rise with CR.
  DND.crBenchmarks = function () {
    var all = DND.MONSTERS || [];
    if (benchCache && benchFor === all) return benchCache;
    var pool = all.filter(function (m) { return !m.custom && /System Reference/i.test(m.src || ''); });
    if (pool.length < 60) pool = all.filter(function (m) { return !m.custom; });
    var by = {};
    pool.forEach(function (m) { var k = crKey(m.cr); (by[k] = by[k] || []).push(DND.monsterStats(m)); });
    var keys = ['hp', 'ac', 'attack', 'dc', 'dpr'];
    var rows = DND.CR_LIST.map(function (cr) {
      var list = by[cr] || [], r = { cr: cr, n: list.length };
      keys.forEach(function (k) { r[k] = median(list.map(function (s) { return s[k]; }).filter(function (v) { return v > 0; })); });
      return r;
    });
    keys.forEach(function (k) {
      // Fill CRs with no data from their neighbours, then smooth so the scale never goes down.
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][k] != null) continue;
        var a = i - 1, b = i + 1;
        while (a >= 0 && rows[a][k] == null) a--;
        while (b < rows.length && rows[b][k] == null) b++;
        rows[i][k] = a < 0 && b >= rows.length ? 0 : a < 0 ? rows[b][k] : b >= rows.length ? rows[a][k] : rows[a][k] + (rows[b][k] - rows[a][k]) * (i - a) / (b - a);
      }
      for (var j = 1; j < rows.length; j++) if (rows[j][k] < rows[j - 1][k]) rows[j][k] = rows[j - 1][k];
      rows.forEach(function (r) { r[k] = Math.round(r[k]); });
    });
    benchCache = rows; benchFor = all;
    return rows;
  };
  function nearestIndex(rows, key, value) {
    var best = 0, bd = Infinity;
    rows.forEach(function (r, i) { var d = Math.abs(r[key] - value); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function clampIdx(i) { return Math.max(0, Math.min(DND.CR_LIST.length - 1, Math.round(i))); }

  // Estimate a creature's CR from its numbers: a defensive CR from Hit Points (shifted one step per
  // 2 points of AC above or below typical), an offensive CR from damage per round (shifted by attack
  // bonus or save DC the same way), and their average.
  DND.estimateCR = function (stats) {
    var rows = DND.crBenchmarks();
    var di = nearestIndex(rows, 'hp', stats.hp || 1);
    var dAdj = clampIdx(di + Math.trunc(((stats.ac || rows[di].ac) - rows[di].ac) / 2));
    var oi = nearestIndex(rows, 'dpr', stats.dpr || 0);
    var hitDiff = stats.attack ? stats.attack - rows[oi].attack : stats.dc ? stats.dc - rows[oi].dc : 0;
    var oAdj = clampIdx(oi + Math.trunc(hitDiff / 2));
    var fi = clampIdx((dAdj + oAdj) / 2);
    return { defensive: DND.CR_LIST[dAdj], offensive: DND.CR_LIST[oAdj], cr: DND.CR_LIST[fi], index: fi, defensiveIndex: dAdj, offensiveIndex: oAdj };
  };
  DND.crBenchmark = function (cr) { return DND.crBenchmarks()[DND.CR_LIST.indexOf(crKey(cr))]; };

  /* ---------- Custom creatures ---------- */

  var HIT_DIE = { T: 4, S: 6, M: 8, L: 10, H: 12, G: 20 };
  DND.HIT_DIE_BY_SIZE = HIT_DIE;
  DND.CREATURE_TYPES = ['Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead'];
  DND.newCreatureModel = function () {
    return { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: 'New creature', size: 'M', type: 'Humanoid', align: 'Neutral', ac: 12, acNote: '', hd: 2, hp: 0,
      speed: '30 ft.', str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, saves: [], skill: '', senses: '', languages: 'Common', cr: '1/4',
      vulnerable: '', resist: '', immune: '', condImmune: '', trait: [], action: [], bonus: [], reaction: [], legendary: [], desc: '' };
  };
  DND.creatureHp = function (c) {
    var hd = Math.max(0, Math.round(+c.hd || 0));
    if (!hd) return { avg: Math.max(1, Math.round(+c.hp || 1)), text: String(Math.max(1, Math.round(+c.hp || 1))), formula: '' };
    var die = HIT_DIE[c.size] || 8, con = DND.mod(+c.con || 10) * hd, avg = Math.max(1, Math.floor(hd * (die + 1) / 2) + con);
    var formula = hd + 'd' + die + (con ? (con > 0 ? '+' : '-') + Math.abs(con) : '');
    return { avg: avg, text: avg + ' (' + formula + ')', formula: formula };
  };
  // Turn a form model into the monster format the rest of the app uses.
  DND.buildCreature = function (c) {
    var pb = DND.crProf(c.cr), hp = DND.creatureHp(c);
    var saves = (c.saves || []).map(function (a) { return a.charAt(0).toUpperCase() + a.slice(1) + ' ' + DND.sign(DND.mod(+c[a] || 10) + pb); }).join(', ');
    var perc = /perception\s*([+-]\d+)/i.exec(c.skill || '');
    function entries(list) { return (list || []).filter(function (e) { return e && (e.name || e.text); }).map(function (e) { return { name: e.name || 'Unnamed', text: e.text || '' }; }); }
    return { id: 'custom-' + c.id, custom: true, name: c.name || 'Unnamed creature', ed: '2024', src: 'Your creatures', size: c.size, type: String(c.type || '').toLowerCase(), align: c.align || '',
      ac: String(Math.round(+c.ac || 10)) + (c.acNote ? ' (' + c.acNote + ')' : ''), hp: hp.text, speed: c.speed || '',
      str: +c.str || 10, dex: +c.dex || 10, con: +c.con || 10, int: +c.int || 10, wis: +c.wis || 10, cha: +c.cha || 10,
      save: saves, skill: c.skill || '', senses: c.senses || '', passive: String(perc ? 10 + +perc[1] : 10 + DND.mod(+c.wis || 10)), languages: c.languages || '',
      cr: crKey(c.cr), resist: c.resist || '', immune: c.immune || '', vulnerable: c.vulnerable || '', condImmune: c.condImmune || '', spells: '', env: '',
      trait: [{ name: 'Proficiency Bonus', text: '+' + pb }].concat(entries(c.trait)), action: entries(c.action), bonus: entries(c.bonus), reaction: entries(c.reaction), legendary: entries(c.legendary), desc: c.desc || '' };
  };
  // Start a form model from an existing creature, to tweak it.
  DND.creatureModelFrom = function (m) {
    var c = DND.newCreatureModel(), hpm = /(\d+)\s*\(\s*(\d+)d(\d+)/.exec(m.hp || '');
    function copy(list) { return (list || []).filter(function (e) { return e && e.name !== 'Proficiency Bonus'; }).map(function (e) { return { name: e.name || '', text: e.text || '' }; }); }
    Object.assign(c, { name: m.name + ' (variant)', size: HIT_DIE[m.size] ? m.size : 'M', type: (m.type || 'humanoid').split(/[ ,(]/)[0].replace(/^./, function (x) { return x.toUpperCase(); }),
      align: m.align || '', ac: firstNumber(m.ac) || 10, acNote: (/\(([^)]*)\)/.exec(m.ac || '') || [])[1] || '', hd: hpm ? +hpm[2] : 0, hp: firstNumber(m.hp) || 1,
      speed: (m.speed || '').replace(/^walk\s+/i, ''), str: +m.str || 10, dex: +m.dex || 10, con: +m.con || 10, int: +m.int || 10, wis: +m.wis || 10, cha: +m.cha || 10,
      saves: DND.ABILITIES.filter(function (a) { return new RegExp('\\b' + a, 'i').test(m.save || ''); }), skill: m.skill || '', senses: m.senses || '', languages: m.languages || '', cr: crKey(m.cr),
      vulnerable: m.vulnerable || '', resist: m.resist || '', immune: m.immune || '', condImmune: m.condImmune || '',
      trait: copy(m.trait), action: copy(m.action), bonus: copy(m.bonus), reaction: copy(m.reaction), legendary: copy(m.legendary), desc: '' });
    return c;
  };
  // Text for an attack action, with the attack bonus and damage worked out from the creature's numbers.
  DND.attackText = function (c, a) {
    var pb = DND.crProf(c.cr), mod = DND.mod(+c[a.ability] || 10), hit = mod + pb;
    var dice = String(a.dice || '1d6').replace(/\s+/g, ''), avg = Math.max(1, DND.diceAverage(dice) + mod);
    var where = a.kind === 'ranged' ? 'range ' + (a.range || '80/320') + ' ft.' : 'reach ' + (a.range || '5') + ' ft.';
    return (a.kind === 'ranged' ? 'Ranged' : 'Melee') + ' Attack Roll: ' + DND.sign(hit) + ', ' + where + ' Hit: ' + avg + ' (' + dice + (mod ? ' ' + (mod > 0 ? '+' : '-') + ' ' + Math.abs(mod) : '') + ') ' + (a.type || 'Slashing') + ' damage.';
  };

  // Replace the custom creatures in the bestiary (kept across content reloads).
  DND.CUSTOM_CREATURES = DND.CUSTOM_CREATURES || [];
  DND.syncCustomMonsters = function (models) {
    if (models) DND.CUSTOM_CREATURES = models;
    if (!DND.MONSTERS) return;
    var kept = DND.MONSTERS.filter(function (m) { return !m.custom; });
    DND.MONSTER_BY_ID = DND.MONSTER_BY_ID || {};
    Object.keys(DND.MONSTER_BY_ID).forEach(function (k) { if (DND.MONSTER_BY_ID[k].custom) delete DND.MONSTER_BY_ID[k]; });
    DND.CUSTOM_CREATURES.forEach(function (c) { var m = DND.buildCreature(c); kept.push(m); DND.MONSTER_BY_ID[m.id] = m; });
    DND.MONSTERS = kept;
  };
})(typeof window !== 'undefined' ? window : globalThis);
