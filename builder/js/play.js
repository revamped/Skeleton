/*
 * Table play: a dice roller and the limited-use resources a character tracks
 * between rests (class resources, once-per-rest features, spell slots, hit dice).
 */
(function (G) {
  var DND = G.DND = G.DND || {};

  /* ---------- Dice ---------- */

  // Matches dice expressions in text: "1d20 + 5", "8d6", "2d8+3", "d10".
  DND.DICE_RE = /\b(\d*d(?:4|6|8|10|12|20|100))(?!\s*(?:Tests?|rolls?)\b)(\s*[+−-]\s*\d+(?!d))?\b/gi;

  function randInt(n) {
    if (G.crypto && G.crypto.getRandomValues) {
      var a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
      do { G.crypto.getRandomValues(a); } while (a[0] >= lim);
      return a[0] % n + 1;
    }
    return Math.floor(Math.random() * n) + 1;
  }
  DND.randInt = randInt;

  // "2d6 + 1d4 - 1" → [{ n: 2, s: 6, sign: 1 }, { n: 1, s: 4, sign: 1 }, { k: -1 }]
  DND.parseDice = function (expr) {
    var terms = [], re = /([+−-]?)\s*(\d*)d(\d+)|([+−-]?)\s*(\d+)/gi, m;
    var str = String(expr || '').replace(/\s+/g, '');
    while ((m = re.exec(str))) {
      if (m[3]) terms.push({ n: +(m[2] || 1), s: +m[3], sign: m[1] === '-' || m[1] === '−' ? -1 : 1 });
      else terms.push({ k: (m[4] === '-' || m[4] === '−' ? -1 : 1) * +m[5] });
    }
    return terms;
  };

  // Roll an expression. opts.mode: 'adv' | 'dis' for a single d20; opts.crit doubles the dice.
  DND.rollDice = function (expr, opts) {
    opts = opts || {};
    var terms = DND.parseDice(expr), total = 0, parts = [], nat = null;
    var single20 = terms.filter(function (t) { return t.s; }).length === 1 && terms.some(function (t) { return t.s === 20 && t.n === 1; });
    terms.forEach(function (t) {
      if (!t.s) { total += t.k; parts.push({ k: t.k }); return; }
      var n = t.n * (opts.crit ? 2 : 1), rolls = [];
      for (var i = 0; i < n; i++) rolls.push(randInt(t.s));
      var part = { n: n, s: t.s, sign: t.sign, rolls: rolls, sum: rolls.reduce(function (a, b) { return a + b; }, 0) };
      if (single20 && t.s === 20 && (opts.mode === 'adv' || opts.mode === 'dis')) {
        var other = randInt(20);
        part.rolls = [rolls[0], other];
        part.sum = opts.mode === 'adv' ? Math.max(rolls[0], other) : Math.min(rolls[0], other);
        part.kept = part.sum;
      }
      if (t.s === 20 && t.n === 1) nat = part.sum;
      total += t.sign * part.sum;
      parts.push(part);
    });
    return { expr: String(expr), parts: parts, total: total, nat: nat, mode: single20 ? opts.mode || '' : '', crit: !!opts.crit };
  };

  /* ---------- Limited-use resources ---------- */

  // Class table columns that are counts but not spendable uses.
  var NOT_USES = /mastery|invocation|spellbook|cantrip|prepared|known|spells|metamagic|maneuvers? known|infusions? known|damage|movement/i;
  // How each kind of use comes back. shortRegain: uses regained on a Short Rest when the rest need a Long Rest.
  var RESETS = [
    [/focus|\bki\b|superiority|action surge|psionic|pact|warp|channel divinity|wild shape|second wind/i, function (lbl) {
      return /channel divinity|wild shape|second wind/i.test(lbl) ? { reset: 'long', shortRegain: 1 } : { reset: 'short' };
    }],
    [/rage/i, function () { return { reset: 'long', shortRegain: 1 }; }]
  ];
  function resetFor(label) {
    for (var i = 0; i < RESETS.length; i++) if (RESETS[i][0].test(label)) return RESETS[i][1](label);
    return { reset: 'long' };
  }
  var WORD_N = { once: 1, twice: 2, two: 2, three: 3, four: 4, five: 5 };
  var ABIL = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
    str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };
  var AB_WORD = '(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)';
  function stem(n) { return String(n).toLowerCase().replace(/\s*\((two|three|four) uses\)$/, '').replace(/s$/, '').trim(); }

  // Everything a character spends and recovers at the viewed level.
  // Returns { counters: [...], turn: [...], slots: [...], pact, hitDice: [...] }.
  DND.playResources = function (build, ev) {
    var lv = ev.levels[build.level - 1], d = lv.d, s = lv.state;
    var counters = [], byStem = {}, turn = [];
    function add(c) {
      var k = stem(c.name);
      if (byStem[k]) { byStem[k].max = Math.max(byStem[k].max, c.max); return; }
      byStem[k] = c; counters.push(c);
    }
    // Class table columns with a number of uses (Rages, Focus Points, Channel Divinity…).
    d.columns.forEach(function (c) {
      var v = String(c.value);
      if (!/^\d+$/.test(v) || +v < 1 || NOT_USES.test(c.label)) return;
      var r = resetFor(c.label);
      add({ id: 'col:' + c.label, name: c.label, max: +v, reset: r.reset, shortRegain: r.shortRegain || 0, from: 'Class' });
    });
    var classLevel = {};
    d.classLevels.forEach(function (c) { classLevel[c.name.split(' (')[0].toLowerCase()] = c.level; });

    // Features, traits and feats with limited uses or a once-per-turn limit.
    var texts = [];
    ev.levels.slice(0, build.level).forEach(function (l) { l.features.forEach(function (f) { texts.push([f.name, f.desc || '', 'Feature']); }); });
    ev.species.traits.forEach(function (t) {
      // "Draconic Flight (level 5)": a trait gained at a later level.
      var gate = /\s*\(level (\d+)\)\s*$/i.exec(t[0]);
      if (gate && build.level < +gate[1]) return;
      texts.push([gate ? t[0].slice(0, gate.index) : t[0], t[1] || '', 'Species']);
    });
    s.feats.forEach(function (f) { texts.push([f.name, f.desc || '', 'Feat']); });
    texts.forEach(function (t) {
      var name = t[0], txt = t[1], m;
      if (/^lay on hands$/i.test(name)) {
        add({ id: 'feat:Lay On Hands', name: 'Lay On Hands pool', max: 5 * (classLevel.paladin || 1), reset: 'long', pool: true, from: t[2] });
        return;
      }
      if (/^bardic inspiration$/i.test(name)) {
        add({ id: 'feat:Bardic Inspiration', name: 'Bardic Inspiration', max: Math.max(1, d.mods.cha), reset: (classLevel.bard || 0) >= 5 ? 'short' : 'long', from: t[2] });
        return;
      }
      if (/once per turn|once on each of your turns|once on each of its turns/i.test(txt)) turn.push({ id: 'turn:' + name, name: name });
      var uses = 0;
      if ((m = /\((two|three|four) uses\)/i.exec(name))) uses = WORD_N[m[1].toLowerCase()];
      else if (/(number of times|uses?) equal to your Proficiency Bonus|Proficiency Bonus (number of )?times|Uses = (PB|Proficiency Bonus)\b|\bPB times per/i.test(txt)) uses = d.pb;
      else if ((m = new RegExp('(?:number of times|uses?) equal to your ' + AB_WORD + ' modifier|Uses = ' + AB_WORD + ' mod|\\b' + AB_WORD + ' mod(?:ifier)? times per', 'i').exec(txt))) uses = Math.max(1, d.mods[ABIL[(m[1] || m[2] || m[3]).toLowerCase()]]);
      else if ((m = /\b(once|twice) per (?:Short or Long|Long|Short) Rest|\b(once|twice) per day\b|(two|three) times per (?:Short or Long|Long) Rest/i.exec(txt))) uses = WORD_N[(m[1] || m[2] || m[3]).toLowerCase()];
      else if (/can't (?:do so|use (?:it|this feature)) again until you finish a (?:Short or )?Long Rest|regain (?:all )?expended uses? (?:of it )?when you finish a (?:Short or )?Long Rest/i.test(txt)) uses = 1;
      if (!uses) return;
      var short = /Short or Long Rest|finish a Short Rest|per Short Rest/i.test(txt) && !/Long Rest only/i.test(txt);
      add({ id: 'feat:' + stem(name), name: name.replace(/\s*\((two|three|four) uses\)$/i, ''), max: uses, reset: short ? 'short' : 'long', from: t[2] });
    });

    // Spell slots (Pact Magic slots come back on a Short Rest).
    var sp = d.spell, slots = [], pact = null;
    if (sp) {
      (sp.slots || []).forEach(function (n, i) { if (n) slots.push({ id: 'slot:' + (i + 1), level: i + 1, max: n }); });
      if (sp.pact && sp.pact.count) pact = { id: 'pact', level: sp.pact.level, max: sp.pact.count };
    }
    var hitDice = Object.keys(d.hitDiceBy || {}).sort(function (a, b) { return b - a; }).map(function (k) { return { id: 'hd:' + k, die: +k, max: d.hitDiceBy[k] }; });
    return { counters: counters, turn: turn, slots: slots, pact: pact, hitDice: hitDice };
  };

  /* ---------- Spell damage ---------- */

  // The main damage or healing dice in a spell's text, with cantrip scaling and the upcast step.
  // Returns null when the text has no damage or healing roll of its own (True Strike, Shillelagh).
  DND.spellDice = function (sp, charLevel) {
    var txt = sp && sp.text || '', type = '', m, dice;
    var D1 = '(\\d+d\\d+(?:\\s*\\+\\s*\\d+(?!d))?)';
    if ((m = new RegExp(D1 + '(?:\\s*(?:\\+|plus)\\s*your spellcasting ability modifier)?\\s+(\\w+)\\s+damage', 'i').exec(txt))) type = m[2].toLowerCase();
    else if ((m = new RegExp('(\\w+) damage equal to ' + D1, 'i').exec(txt))) { type = m[1].toLowerCase(); m[1] = m[2]; }
    else if ((m = new RegExp('takes ' + D1 + ' damage', 'i').exec(txt))) type = '';
    else if ((m = new RegExp('regains? (?:a number of )?Hit Points? equal to ' + D1 + '|regains? ' + D1 + ' Hit Points?', 'i').exec(txt))) { type = 'healing'; m[1] = m[1] || m[2]; }
    else if ((m = new RegExp('gains? ' + D1 + ' Temporary Hit Points?', 'i').exec(txt))) type = 'temporary HP';
    else return null;
    if (/^(less|more|extra|additional|bonus)$/.test(type)) return null;   // a modifier to other damage, not a roll of its own
    dice = m[1].replace(/\s+/g, '');
    if (/^\s*(?:\+|plus) your spellcasting ability modifier/i.test(txt.slice(m.index + m[0].length, m.index + m[0].length + 45)) || /(?:\+|plus)\s*your spellcasting ability modifier/i.test(m[0])) dice += '+MOD';
    var step = null, base = /^(\d+)d(\d+)/.exec(dice);
    if (sp.level) {
      // Prefer the upcast step that uses the same die as the base roll (Arcane Hand lists several).
      var up = (/[^\n]*for (?:each|every) (?:spell )?slot level above[^\n]*/i.exec(txt) || [''])[0], re = /increases? by (\d+d\d+)/gi, u, all = [];
      while ((u = re.exec(up))) all.push(u[1]);
      step = all.filter(function (x) { return base && x.split('d')[1] === base[2]; })[0] || all[0] || null;
      if (!step && (u = /(\d+d\d+) for (?:each|every) (?:spell )?slot level above/i.exec(up))) step = u[1];
      if (!step && (u = /(\d+) additional (?:Temporary )?Hit Points? for (?:each|every) (?:spell )?slot level above/i.exec(txt))) step = u[1];
    } else if (base && /Cantrip Upgrade:\s*The damage increases by/i.test(txt)) {
      // Cantrips that add beams instead (Eldritch Blast) keep their dice.
      var tier = charLevel >= 17 ? 4 : charLevel >= 11 ? 3 : charLevel >= 5 ? 2 : 1;
      dice = dice.replace(/^\d+d/, +base[1] * tier + 'd');
    }
    return { dice: dice, type: type, step: step };
  };
  // Dice for a spell cast with a slot of the given level.
  DND.spellDiceAt = function (info, spellLevel, slotLevel) {
    if (!info) return '';
    var dice = info.dice, extra = info.step && slotLevel > spellLevel ? slotLevel - spellLevel : 0;
    if (!extra) return dice;
    if (/^\d+$/.test(info.step)) return dice + '+' + extra * +info.step;
    var st = /^(\d+)d(\d+)$/.exec(info.step), base = /^(\d+)d(\d+)/.exec(dice);
    if (st && base && st[2] === base[2]) return dice.replace(/^\d+d/, (+base[1] + extra * +st[1]) + 'd');
    return dice + '+' + (extra * +(st ? st[1] : 1)) + 'd' + (st ? st[2] : 6);
  };
})(typeof window !== 'undefined' ? window : globalThis);
