/*
 * Build engine: replays a build's choices from origin through level 20 and
 * produces, for every level, the features gained, the choices offered there,
 * and a full character snapshot.
 */
(function (G) {
  var DND = G.DND = G.DND || {};

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  DND.newBuild = function (preset) {
    var b = {
      v: 1,
      id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: 'New Hero',
      level: 1,
      classId: 'fighter',
      speciesId: 'human',
      backgroundId: 'soldier',
      abilityMethod: 'standard',
      base: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
      choices: {},
      spells: { cantrips: [], prepared: [] },
      gear: { armor: 'chainmail', shield: true, weapons: ['longsword', 'javelin'] },
      inventory: [],
      companions: [],
      options: { legacySpells: false },
      ruleset: '2024'
    };
    for (var k in preset || {}) b[k] = preset[k];
    return b;
  };

  /* ---------- Rulesets ---------- */

  // A character uses either the 2024 rules or Legacy rules (2024 plus 2014 content).
  // Legacy content: compendium entries from 2014 sources; their ids end in -2014.
  DND.isLegacy = function (x) { return !!x && (x.ed === '2014' || x.cat === 'legacy' || /-2014$/.test(x.id || '')); };
  DND.allowedIn = function (x, ruleset) { return ruleset === 'legacy' || !DND.isLegacy(x); };
  function legacyId(v) { return typeof v === 'string' && /-2014$/.test(v); }
  // Builds saved before rulesets existed count as Legacy if they already use 2014 content.
  DND.rulesetOf = function (build) {
    if (build.ruleset) return build.ruleset;
    var ids = [build.classId, build.speciesId, build.backgroundId].concat(build.plan || []);
    Object.keys(build.choices || {}).forEach(function (k) { ids = ids.concat(build.choices[k]); });
    return ids.some(legacyId) || (build.options && build.options.legacySpells) ? 'legacy' : '2024';
  };
  DND.RULESET = '2024';

  function bareName(n) { return String(n || '').replace(/\s*\((2014|2024|legacy)\)\s*$/i, '').replace(/\s*\[5\.5e\]/i, '').trim().toLowerCase(); }
  var BASE_NAME = {
    'class': function (n) { return bareName(n.split(' (')[0]); },
    species: function (n) { return bareName(n.split(/,| \(| of /)[0]); },
    background: function (n) { return bareName(n.replace(/^Baldur's Gate /, '').split(/ \(|, /)[0]); },
    feat: bareName
  };
  // Subclasses renamed in 2024 (Way of Shadow → Warrior of Shadow, School of Evocation → Evoker).
  var SUB_ALIAS = { abjuration: 'abjurer', conjuration: 'conjurer', divination: 'diviner', enchantment: 'enchanter', evocation: 'evoker', illusion: 'illusionist',
    necromancy: 'necromancer', transmutation: 'transmuter', 'four elements': 'elements', 'totem warrior': 'wild heart' };
  function subKey(n) {
    var k = bareName(n).replace(/^(the |way of (the )?|warrior of (the )?|school of |path of (the )?)/, '').replace(/ (patron|sorcery|bloodline|mind|soul)$/, '');
    return SUB_ALIAS[k] || k;
  }
  // The 2024 counterpart of a legacy entry: same name without the edition tag, else same base name.
  // Built-in (SRD) entries win over compendium ones.
  function modernMatch(list, x, kind) {
    var pool = list.filter(function (y) { return !DND.isLegacy(y); });
    function pick(test) { return pool.filter(function (y) { return !y.compendium && test(y); })[0] || pool.filter(test)[0] || null; }
    var n = bareName(x.name), base = BASE_NAME[kind](x.name);
    return pick(function (y) { return bareName(y.name) === n; }) || pick(function (y) { return bareName(y.name) === base; });
  }

  // Plan an upgrade of a Legacy character to the 2024 rules. Returns the upgraded copy,
  // what changed, and the picks that have no 2024 version (the player chooses those again).
  DND.planUpgrade = function (build) {
    var nb = clone(build), idMap = {}, changes = [], unresolved = [], extraChoices = {};
    function note(kind, from, to) { if (to) changes.push({ kind: kind, from: from.name, to: to.name }); else unresolved.push({ kind: kind, name: from.name }); }

    // Classes (main class and multiclass levels) and their subclasses.
    var clsIds = [build.classId].concat(build.plan || []).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    clsIds.forEach(function (id) {
      var old = DND.cls(id);
      if (!old || !DND.isLegacy(old)) return;
      var to = modernMatch(DND.CLASSES, old, 'class');
      note('Class', old, to);
      if (!to) return;
      idMap[old.id] = to.id;
      var subVal = build.choices[old.id + '.subclass'];
      (old.subclasses || []).forEach(function (sc) {
        var m = to.subclasses.filter(function (y) { return bareName(y.name) === bareName(sc.name); })[0] ||
          to.subclasses.filter(function (y) { return subKey(y.name) === subKey(sc.name); })[0];
        if (m) idMap[sc.id] = m.id;
        if (sc.id === subVal) note('Subclass', sc, m);
      });
    });

    // Species, including a 2014 subrace becoming a 2024 lineage (High Elf → Elf, High Elf lineage).
    var sp = find(DND.SPECIES, build.speciesId);
    if (sp && DND.isLegacy(sp)) {
      var toSp = modernMatch(DND.SPECIES, sp, 'species');
      if (toSp) {
        idMap[sp.id] = toSp.id;
        var lin = (toSp.choices || []).filter(function (c) { return /^(lineage|legacy|ancestry)$/.test(c.id) && Array.isArray(c.options); })[0];
        var rest = bareName(sp.name).replace(BASE_NAME.species(sp.name), '').replace(/^[,\s]+/, '').split(/[\s()]+/)[0];
        var opt = lin && rest && lin.options.filter(function (o) { return o.label.toLowerCase().indexOf(rest) >= 0; })[0];
        if (opt) extraChoices['sp.' + toSp.id + '.' + lin.id] = opt.id;
        changes.push({ kind: 'Species', from: sp.name, to: toSp.name + (opt ? ' (' + opt.label + ')' : '') });
      } else note('Species', sp, null);
    }

    var bg = find(DND.BACKGROUNDS, build.backgroundId);
    if (bg && DND.isLegacy(bg)) {
      var toBg = modernMatch(DND.BACKGROUNDS.filter(function (y) { return !y.custom; }), bg, 'background');
      note('Background', bg, toBg);
      if (toBg) idMap[bg.id] = toBg.id;
    }

    // Feats picked anywhere in the build.
    var seen = {};
    Object.keys(build.choices).forEach(function (k) {
      [].concat(build.choices[k]).forEach(function (v) {
        var f = typeof v === 'string' && !seen[v] && DND.feat(v);
        if (!f || !DND.isLegacy(f)) return;
        seen[v] = true;
        var to = modernMatch(DND.FEATS, f, 'feat');
        note('Feat', f, to);
        if (to) idMap[f.id] = to.id;
      });
    });

    function mapId(v) { return typeof v === 'string' && idMap[v] ? idMap[v] : v; }
    nb.classId = mapId(nb.classId);
    nb.speciesId = mapId(nb.speciesId);
    nb.backgroundId = mapId(nb.backgroundId);
    if (nb.plan) nb.plan = nb.plan.map(mapId);
    var choices = {};
    Object.keys(build.choices).forEach(function (k) {
      var v = build.choices[k];
      choices[k.split('.').map(mapId).join('.')] = Array.isArray(v) ? v.map(mapId) : mapId(v);
    });
    Object.keys(extraChoices).forEach(function (k) { choices[k] = extraChoices[k]; });
    nb.choices = choices;
    if (nb.spellPlan) {
      var sp2 = {};
      Object.keys(nb.spellPlan).forEach(function (k) { sp2[mapId(k)] = nb.spellPlan[k]; });
      nb.spellPlan = sp2;
    }
    nb.options = Object.assign({}, nb.options, { legacySpells: false });
    nb.ruleset = '2024';

    // Clear choices whose options don't exist in the 2024 versions; features then re-evaluate.
    var cleared = 0;
    for (var pass = 0; pass < 4; pass++) {
      var res = DND.evaluate(nb), changed = false;
      var walk = function (list) {
        list.forEach(function (rec) {
          var vals = asArray(rec.value);
          var keep = vals.filter(function (v) { return find(rec.options, v); });
          if (keep.length !== vals.length) {
            cleared += vals.length - keep.length; changed = true;
            if (keep.length) nb.choices[rec.key] = rec.kind === 'many' ? keep : keep[0]; else delete nb.choices[rec.key];
          }
          walk(rec.children);
        });
      };
      res.origin.forEach(function (o) { walk(o.choices); });
      res.levels.forEach(function (l) { l.features.forEach(function (f) { walk(f.choices); }); });
      if (!changed) break;
    }
    return { build: nb, changes: changes, unresolved: unresolved, cleared: cleared };
  };

  function freshState(build, species) {
    return {
      level: 1,
      abilities: clone(build.base),
      saves: [], skills: {}, skillBonus: [],
      profs: { armor: [], weapons: [], tools: [] },
      feats: [], masteries: [], metamagic: [], invocations: [],
      spells: { always: [], bonusCantrips: 0, extraLists: null },
      resist: [], senses: [], notes: [], warnings: [], flags: {},
      unarmored: [], speed: species ? species.speed : 30, speedNoHeavy: 0, unarmoredSpeed: 0,
      darkvision: species ? species.darkvision : 0, size: species ? species.size : 'Medium',
      hpPerLevel: 0, hpFlat: 0, attacks: 1, crit: 20, subclass: null, lineageSpells: null, hdList: []
    };
  }

  /* ---------- Choice resolution ---------- */

  function asArray(v) { return v == null || v === '' ? [] : Array.isArray(v) ? v : [v]; }

  function runChoices(specs, prefix, s, build, out) {
    (specs || []).forEach(function (spec) {
      var key = prefix + spec.id;
      var get = function (id) { return build.choices[prefix + id]; };
      var options = typeof spec.options === 'function' ? spec.options(s, get) : spec.options.map(function (o) { return Object.assign({}, o); });
      var count = spec.count || 1;
      var vals = asArray(build.choices[key]);
      var rec = { key: key, label: spec.label, kind: spec.kind || 'one', count: count, options: options, value: build.choices[key], problems: [], children: [] };
      out.push(rec);

      var valid = [];
      vals.forEach(function (v) {
        var o = find(options, v);
        if (!o) { rec.problems.push('"' + v + '" is not a valid choice here.'); return; }
        if (o.unavailable) rec.problems.push(o.label + ': ' + o.unavailable + '.');
        valid.push(o);
      });
      if (rec.kind === 'many' && vals.length > count) rec.problems.push('Too many selected (' + vals.length + '/' + count + ').');
      rec.missing = Math.max(0, count - vals.length);
      if (rec.kind === 'one') rec.missing = vals.length ? 0 : 1;
      if (spec.optional) { rec.missing = 0; rec.optional = true; }

      if (!valid.length) return;
      if (spec.apply) {
        if (rec.kind === 'many') spec.apply(s, valid.map(function (o) { return o.id; }), get);
        else spec.apply(s, valid[0].id, get, valid[0]);
      }
      valid.forEach(function (o) {
        if (o.apply) o.apply(s);
        if (o.choices) runChoices(o.choices, key + '.' + o.id + '.', s, build, rec.children);
      });
    });
  }

  function countIssues(choices) {
    var n = { missing: 0, problems: 0 };
    (function walk(list) {
      list.forEach(function (c) {
        n.missing += c.missing || 0;
        n.problems += c.problems.length;
        walk(c.children);
      });
    })(choices);
    return n;
  }
  DND.countIssues = countIssues;

  function processFeature(f, prefix, s, build, source) {
    var entry = { name: f.name, desc: f.desc, source: source, choices: [], long: !!f.long };
    if (f.apply) f.apply(s);
    if (f.choices) runChoices(f.choices, prefix + slug(f.name) + '.', s, build, entry.choices);
    return entry;
  }

  /* ---------- Origin: species, background, class proficiencies ---------- */

  function backgroundSpecs(bg) {
    var specs = [];
    if (bg.custom) {
      // Any abilities: +2/+1 to two of them, or +1 to three.
      specs.push({ id: 'asi', label: 'Ability score increases', kind: 'one', options: function () { return flexAsiOptions(); } });
      specs.push(DND.featChoice('feat', 'Origin feat', ['origin'], 'Background'));
      specs.push(DND.skillChoice('skills', 'Background skills', 2, null, 'Background'));
      return specs;
    }
    var pool = function () { return bg.abilities; };
    specs.push({ id: 'asi', label: 'Ability score increases', kind: 'one',
      options: function (s, get) {
        var abs = pool(get);
        return [
          { id: '21', label: '+2 to one, +1 to another', choices: [
            { id: 'plus2', label: '+2 to', kind: 'one', options: function () { return DND.abilityOptions(abs); }, apply: function (st, v) { DND.inc(st, v, 2, 20); } },
            { id: 'plus1', label: '+1 to', kind: 'one',
              options: function (st, g) {
                return DND.abilityOptions(abs).map(function (o) { if (o.id === g('plus2')) o.unavailable = 'Must differ from the +2'; return o; });
              },
              apply: function (st, v) { DND.inc(st, v, 1, 20); } }] },
          { id: '111', label: '+1 to all three' + (abs.length ? ' (' + abs.map(function (a) { return a.toUpperCase(); }).join(', ') + ')' : ''),
            apply: function (st) { abs.forEach(function (a) { DND.inc(st, a, 1, 20); }); } }
        ];
      } });
    return specs;
  }

  // "+2/+1 or +1/+1/+1 to any abilities", used for optional 2024-rule increases on 2014 backgrounds.
  function flexAsiOptions() {
    return [
      { id: '21', label: '+2 to one, +1 to another', choices: [
        { id: 'plus2', label: '+2 to', kind: 'one', options: function () { return DND.abilityOptions(); }, apply: function (st, v) { DND.inc(st, v, 2, 20); } },
        { id: 'plus1', label: '+1 to', kind: 'one',
          options: function (st, g) { return DND.abilityOptions().map(function (o) { if (o.id === g('plus2')) o.unavailable = 'Must differ from the +2'; return o; }); },
          apply: function (st, v) { DND.inc(st, v, 1, 20); } }] },
      { id: '111', label: '+1 to three abilities', choices: [
        { id: 'abs', label: 'Abilities', kind: 'many', count: 3, options: function () { return DND.abilityOptions(); },
          apply: function (st, v) { v.forEach(function (a) { DND.inc(st, a, 1, 20); }); } }] }
    ];
  }

  /* ---------- Derived stats ---------- */

  function maxSpellLevel(caster, level) {
    if (!caster) return 0;
    if (caster.type === 'pact') return DND.PACT.level[level - 1];
    if (caster.type === 'table') {
      var row = caster.slots[level - 1] || [], max = 0;
      row.forEach(function (n, i) { if (n) max = i + 1; });
      return max;
    }
    return DND.SLOTS[caster.type][level - 1].length;
  }
  DND.maxSpellLevel = maxSpellLevel;

  // First class level at which a spell of the given level can be prepared.
  DND.levelForSpell = function (caster, spellLevel) {
    if (spellLevel === 0) return 1;
    for (var l = 1; l <= 20; l++) if (maxSpellLevel(caster, l) >= spellLevel) return l;
    return 99;
  };

  function weaponProficient(s, w) {
    var p = s.profs.weapons;
    if (p.indexOf(w.cat) >= 0) return true;
    if (w.cat === 'martial' && p.indexOf('martial-light') >= 0 && /L/.test(w.props)) return true;
    if (w.cat === 'martial' && p.indexOf('martial-finesse-light') >= 0 && /[FL]/.test(w.props)) return true;
    var nm = w.name.toLowerCase().replace(/ \(2014\)$/, '');
    var base = w.baseId && DND.weapon(w.baseId);
    return p.some(function (x) {
      return x.length > 3 && (nm.indexOf(x.replace(/s$/, '')) >= 0 || (base && base.name.toLowerCase().indexOf(x.replace(/s$/, '')) >= 0));
    });
  }

  function avg(die) { return die / 2 + 1; }
  function sign(n) { return (n >= 0 ? '+' : '') + n; }
  DND.sign = sign;

  function classBase(name) { return name.split(' (')[0]; }
  function casterKind(c) { return c.mcKind || (c.type === 'pact' ? 'pact' : c.type === 'half' ? 'half' : c.type === 'full' ? 'full' : c.preparedFormula || 'full'); }
  function casterLevelOf(c, cl) {
    var k = casterKind(c);
    return k === 'full' ? cl : k === 'half' ? Math.ceil(cl / 2) : k === 'third' ? Math.floor(cl / 3) : 0;
  }
  function ownSlots(c, cl) {
    if (c.type === 'table') return c.slots[cl - 1] || [];
    return DND.SLOTS[c.type] ? DND.SLOTS[c.type][cl - 1] : [];
  }
  function pactSlots(c, cl) {
    if (c.type === 'pact') return { count: DND.PACT.slots[cl - 1], level: DND.PACT.level[cl - 1] };
    var row = c.slots[cl - 1] || [], out = { count: 0, level: 0 };
    row.forEach(function (n, i) { if (n) { out.count = n; out.level = i + 1; } });
    return out;
  }

  // The class that gains each character level (level 1 is always the main class).
  DND.classAt = function (build, L) { return (L > 1 && build.plan && build.plan[L - 1]) || build.classId; };
  // Spell picks are stored per class; the main class keeps build.spells.
  DND.spellsFor = function (build, clsId) {
    if (!clsId || clsId === build.classId) return build.spells;
    build.spellsBy = build.spellsBy || {};
    return build.spellsBy[clsId] = build.spellsBy[clsId] || { cantrips: [], prepared: [] };
  };
  /* ---------- Spell picks by class level (learning and swapping) ---------- */
  // build.spellPlan[clsId][classLevel] = { cantrips, prepared } — the full list from that class level on.
  // Levels without an entry inherit the nearest earlier one; build.spells(By) is the starting list.
  DND.spellsAt = function (build, clsId, CL) {
    var plan = build.spellPlan && build.spellPlan[clsId], best = -1;
    if (plan) Object.keys(plan).forEach(function (k) { k = +k; if (k <= CL && k > best) best = k; });
    return best >= 0 ? plan[best] : DND.spellsFor(build, clsId);
  };
  DND.spellsEdit = function (build, clsId, CL) {
    build.spellPlan = build.spellPlan || {};
    var plan = build.spellPlan[clsId] = build.spellPlan[clsId] || {};
    if (!plan[CL]) {
      var cur = DND.spellsAt(build, clsId, CL);
      plan[CL] = { cantrips: (cur.cantrips || []).slice(), prepared: (cur.prepared || []).slice() };
    }
    return plan[CL];
  };
  function sameList(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; }); }
  // Drop entries that change nothing compared with the level before.
  DND.spellsTidy = function (build, clsId) {
    var plan = build.spellPlan && build.spellPlan[clsId];
    if (!plan) return;
    Object.keys(plan).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var prev = k > 1 ? DND.spellsAt(build, clsId, k - 1) : DND.spellsFor(build, clsId);
      if (prev !== plan[k] && sameList(plan[k].cantrips, prev.cantrips || []) && sameList(plan[k].prepared, prev.prepared || [])) delete plan[k];
    });
  };
  // What changed at a class level: spells added and removed versus the level before.
  DND.spellChanges = function (build, clsId, CL) {
    var plan = build.spellPlan && build.spellPlan[clsId];
    if (!plan || !plan[CL]) return null;
    var now = plan[CL], prev = CL > 1 ? DND.spellsAt(build, clsId, CL - 1) : { cantrips: [], prepared: [] };
    function diff(a, b) { return a.filter(function (x) { return b.indexOf(x) < 0; }); }
    var out = {
      cantripsAdded: diff(now.cantrips, prev.cantrips || []), cantripsRemoved: diff(prev.cantrips || [], now.cantrips),
      preparedAdded: diff(now.prepared, prev.prepared || []), preparedRemoved: diff(prev.prepared || [], now.prepared)
    };
    out.any = out.cantripsAdded.length + out.cantripsRemoved.length + out.preparedAdded.length + out.preparedRemoved.length > 0;
    return out;
  };

  function meetsReq(s, req) {
    if (!req) return true;
    if (req.any) return req.any.some(function (a) { return s.abilities[a] >= 13; });
    return (req.all || []).every(function (a) { return s.abilities[a] >= 13; });
  }
  function reqText(req) {
    if (!req) return '';
    var list = (req.any || req.all).map(function (a) { return DND.ABILITY_NAMES[a]; });
    return list.join(req.any ? ' or ' : ' and ') + ' 13';
  }

  // Effects of equipped (and, where required, attuned) inventory items.
  function itemEffects(build) {
    var fx = { ac: 0, save: 0, spellAtk: 0, spellDc: 0, speed: 0, init: 0, scores: [], attuned: 0, weight: 0, names: [] };
    (build.inventory || []).forEach(function (e) {
      var it = DND.item && DND.item(e.id);
      var qty = e.qty || 1;
      if (!it) return;
      fx.weight += (it.weight || 0) * qty;
      if (e.attuned) fx.attuned++;
      if (!e.equipped || (it.attune && !e.attuned)) return;
      if (/^(M|R|LA|MA|HA|S|A)$/.test(it.type)) return; // weapons, armor and shields work through the gear slots
      var b = DND.itemBonuses(it);
      ['ac', 'save', 'spellAtk', 'spellDc', 'speed', 'init'].forEach(function (k) { fx[k] += b[k]; });
      var set = DND.itemSetsScore(it);
      if (set) fx.scores.push(set);
      if (b.ac || b.save || b.spellAtk || b.spellDc || b.speed || b.init || set) fx.names.push(it.name);
    });
    return fx;
  }

  function compute(s, build, cls, taken) {
    var fx = itemEffects(build);
    fx.scores.forEach(function (x) { if (s.abilities[x.ab] < x.score) s.abilities[x.ab] = x.score; });
    if (fx.attuned > 3) s.warnings.push('Attuned to ' + fx.attuned + ' items; the limit is 3.');
    var L = s.level, pb = DND.profBonus(L), mods = {};
    DND.ABILITIES.forEach(function (a) { mods[a] = DND.mod(s.abilities[a]); });
    var d = { pb: pb, mods: mods, items: fx };

    // Hit points (Con changes apply retroactively).
    var dice = s.hdList.length ? s.hdList : [cls.hd];
    var hp = 0, byDie = {};
    dice.forEach(function (hd, i) {
      hp += Math.max(1, (i === 0 ? hd : avg(hd)) + mods.con);
      byDie[hd] = (byDie[hd] || 0) + 1;
    });
    d.hp = hp + s.hpPerLevel * L + s.hpFlat;
    d.hitDice = Object.keys(byDie).sort(function (a, b) { return b - a; }).map(function (k) { return byDie[k] + 'd' + k; }).join(' + ');

    // Armor class.
    var gear = build.gear || {};
    var armor = find(DND.ARMOR, gear.armor) || DND.ARMOR[0];
    var shieldItem = gear.shield ? (find(DND.SHIELDS || [], gear.shield === true ? 'shield' : gear.shield) || { name: 'Shield', bonus: 0 }) : null;
    var shield = !!shieldItem;
    var acOptions = [];
    if (armor.type === 'none') {
      acOptions.push({ ac: 10 + mods.dex, how: 'Unarmored (10 + Dex)' });
      s.unarmored.forEach(function (u) {
        if (u === 'wis' && shield) return;
        acOptions.push({ ac: 10 + mods.dex + mods[u], how: 'Unarmored Defense (10 + Dex + ' + u.toUpperCase() + ')' });
      });
      if (s.flags.mageArmor) acOptions.push({ ac: 13 + mods.dex, how: 'Mage Armor (13 + Dex)' });
    } else {
      var base = armor.type === 'light' ? armor.ac + mods.dex : armor.type === 'medium' ? armor.ac + Math.min(2, mods.dex) : armor.ac;
      acOptions.push({ ac: base + (armor.bonusAc || 0), how: armor.name });
      if (s.profs.armor.indexOf(armor.type) < 0) s.warnings.push('Not proficient with ' + armor.type + ' armor (' + armor.name + '): Disadvantage on Str/Dex rolls and no spellcasting.');
    }
    acOptions.sort(function (a, b) { return b.ac - a.ac; });
    d.ac = acOptions[0].ac; d.acHow = acOptions[0].how;
    if (shield) {
      d.ac += 2 + (shieldItem.bonus || 0); d.acHow += ' + ' + shieldItem.name;
      if (s.profs.armor.indexOf('shield') < 0) s.warnings.push('Not proficient with Shields.');
    }
    if (s.flags.defense && armor.type !== 'none') { d.ac += 1; d.acHow += ' + Defense'; }
    if (fx.ac) { d.ac += fx.ac; d.acHow += ' + items'; }

    // Speed.
    var speed = s.speed;
    if (armor.type !== 'heavy') speed += s.speedNoHeavy;
    if (armor.type === 'none' && !shield) speed += s.unarmoredSpeed;
    if (armor.str && s.abilities.str < armor.str) { speed -= 10; s.warnings.push(armor.name + ' needs Str ' + armor.str + ': Speed −10 ft.'); }
    d.speed = speed + fx.speed;

    // Checks, saves, initiative.
    var jack = s.flags.jack ? Math.floor(pb / 2) : 0;
    d.init = mods.dex + (s.flags.alert ? pb : 0) + jack + fx.init;
    var aura = s.flags.auraOfProtection ? Math.max(1, mods.cha) : 0;
    d.saves = {};
    DND.ABILITIES.forEach(function (a) {
      d.saves[a] = { prof: s.saves.indexOf(a) >= 0, total: mods[a] + (s.saves.indexOf(a) >= 0 ? pb : 0) + aura + fx.save };
    });
    d.skills = {};
    Object.keys(DND.SKILLS).forEach(function (k) {
      var lvl = s.skills[k] || 0, ab = DND.SKILLS[k].ability;
      var total = mods[ab] + (lvl ? pb * lvl : jack);
      s.skillBonus.forEach(function (b) { if (b.skills.indexOf(k) >= 0) total += Math.max(b.min || 0, mods[b.ability]); });
      d.skills[k] = { level: lvl, total: total };
    });
    d.passivePerception = 10 + d.skills.perception.total;
    d.carry = s.abilities.str * 15;

    // Spellcasting: one entry per class that casts; slots are shared.
    var entries = [];
    taken.forEach(function (tk) {
      var c = (tk.sub && tk.sub.caster) || tk.cls.caster;
      if (!c) return;
      var cl = tk.level;
      var maxL = maxSpellLevel(c, cl);
      var cantrips = c.cantrips ? (+c.cantrips[cl - 1] || 0) : 0;
      if (!maxL && !cantrips) return;
      var m = mods[c.ability];
      var prepared;
      if (c.prepared) prepared = +c.prepared[cl - 1] || 0;
      else prepared = Math.max(1, m + (c.preparedFormula === 'half' ? Math.floor(cl / 2) : c.preparedFormula === 'third' ? Math.floor(cl / 3) : cl));
      if (s.spells.bonusCantripsFor === tk.cls.id || (!s.spells.bonusCantripsFor && !entries.length)) cantrips += s.spells.bonusCantrips;
      var lists = [c.list];
      if (s.spells.extraLists && (!s.spells.extraListsFor || s.spells.extraListsFor === tk.cls.id)) lists = lists.concat(s.spells.extraLists);
      if (tk.sub && tk.sub.extraList) lists.push(tk.sub.extraList);
      if (DND.RULESET === 'legacy' && build.options && build.options.legacySpells && DND.SPELL_LISTS[c.list + ':legacy']) lists.push(c.list + ':legacy');
      entries.push({
        clsId: tk.cls.id, className: tk.cls.name, classLevel: cl, caster: c,
        ability: c.ability, dc: 8 + pb + m + fx.spellDc, attack: pb + m + fx.spellAtk, type: c.type,
        cantrips: cantrips, prepared: prepared, maxLevel: maxL,
        lists: lists.filter(function (x, i, a) { return DND.SPELL_LISTS[x] && a.indexOf(x) === i; })
      });
    });
    var slotters = entries.filter(function (e) { return casterKind(e.caster) !== 'pact'; });
    var slots = null, pact = null;
    if (slotters.length === 1) slots = ownSlots(slotters[0].caster, slotters[0].classLevel);
    else if (slotters.length > 1) {
      var casterLevel = slotters.reduce(function (n, e) { return n + casterLevelOf(e.caster, e.classLevel); }, 0);
      slots = casterLevel > 0 ? DND.SLOTS.full[Math.min(20, casterLevel) - 1] : [];
      d.casterLevel = casterLevel;
    }
    entries.filter(function (e) { return casterKind(e.caster) === 'pact'; }).forEach(function (e) {
      pact = pactSlots(e.caster, e.classLevel);
    });
    entries.forEach(function (e) { e.slots = slots; e.pact = pact; });
    d.spellcasters = entries;
    d.spell = entries[0] || null;

    // Weapon attacks from the gear list.
    var weaponIds = (gear.weapons || []).slice();
    (build.inventory || []).forEach(function (e) {
      var w = e.equipped && DND.WEAPONS.filter(function (x) { return x.itemId === e.id; })[0];
      if (w && weaponIds.indexOf(w.id) < 0) weaponIds.push(w.id);
    });
    var isMonk = taken.some(function (tk) { return tk.cls.id === 'monk'; });
    d.attacks = weaponIds.map(function (id) {
      var w = DND.weapon(id);
      if (!w) return null;
      var prof = weaponProficient(s, w);
      var ab = w.ranged ? 'dex' : /F/.test(w.props) ? (mods.dex > mods.str ? 'dex' : 'str') : 'str';
      var die = w.dmg;
      var monkWeapon = isMonk && s.martialArts && (w.cat === 'simple' || /L/.test(w.props)) && !w.ranged;
      if (monkWeapon) {
        if (mods.dex > mods[ab]) ab = 'dex';
        if (parseInt(s.martialArts.split('d')[1], 10) > parseInt(die.split('d')[1] || 0, 10)) die = s.martialArts;
      }
      var dmgBonus = mods[ab] + (w.bonusDmg || 0);
      var hit = mods[ab] + (prof ? pb : 0) + (w.ranged && s.flags.archery ? 2 : 0) + (w.bonusHit || 0);
      var mastered = s.masteries.indexOf(w.id) >= 0 || (w.baseId && s.masteries.indexOf(w.baseId) >= 0);
      return {
        name: w.name, hit: hit, dmg: die + (dmgBonus ? ' ' + sign(dmgBonus).replace('+', '+ ').replace('-', '− ') : '') + ' ' + w.type,
        prof: prof, mastery: mastered ? w.mastery : null, props: w.props, ranged: w.ranged, magic: !!w.magic
      };
    }).filter(Boolean);
    if (isMonk && s.martialArts) {
      var ma = mods.dex > mods.str ? 'dex' : 'str';
      d.attacks.unshift({ name: 'Unarmed Strike', hit: mods[ma] + pb, dmg: s.martialArts + ' ' + sign(mods[ma]).replace('+', '+ ').replace('-', '− ') + ' bludgeoning', prof: true, mastery: null, props: '' });
    }
    d.attacksPerAction = s.attacks;
    d.crit = s.crit;

    // Class table columns for this level.
    d.columns = [];
    taken.forEach(function (tk) {
      (tk.cls.columns || []).concat(tk.sub && tk.sub.columns || []).forEach(function (col) {
        d.columns.push({ cls: classBase(tk.cls.name), label: col.label, value: col.values[tk.level - 1] });
      });
    });
    d.classLevels = taken.map(function (tk) { return { id: tk.cls.id, name: tk.cls.name, level: tk.level, sub: tk.sub ? tk.sub.name : null }; });
    return d;
  }

  /* ---------- Main evaluation ---------- */

  DND.evaluate = function (build) {
    var missing = [];
    var cls = DND.cls(build.classId);
    if (!cls) { missing.push('class'); cls = DND.CLASSES[0]; }
    var species = find(DND.SPECIES, build.speciesId);
    if (!species) { missing.push('species'); species = DND.SPECIES[0]; }
    var bg = find(DND.BACKGROUNDS, build.backgroundId);
    if (!bg) { missing.push('background'); bg = DND.BACKGROUNDS[0]; }
    var ruleset = DND.RULESET = DND.rulesetOf(build);
    var s = freshState(build, species);
    var result = { cls: cls, species: species, background: bg, origin: [], levels: [], abilityIssues: [], missing: missing, ruleset: ruleset };
    if (ruleset !== 'legacy') {
      [cls, species, bg].concat((build.plan || []).map(DND.cls)).filter(function (x, i, a) { return x && DND.isLegacy(x) && a.indexOf(x) === i; }).forEach(function (x) {
        s.warnings.push(x.name + ' is legacy (2014) content, and this character uses the 2024 rules. Choose a 2024 option.');
      });
    }

    // Ability score generation check.
    var base = build.base, vals = DND.ABILITIES.map(function (a) { return base[a]; });
    if (build.abilityMethod === 'standard') {
      var sorted = vals.slice().sort(function (a, b) { return b - a; });
      if (sorted.join() !== DND.STANDARD_ARRAY.join()) result.abilityIssues.push('Standard array must use 15, 14, 13, 12, 10, and 8 once each.');
    } else if (build.abilityMethod === 'pointbuy') {
      var cost = 0;
      vals.forEach(function (v) { cost += DND.POINT_BUY_COST[v] === undefined ? 99 : DND.POINT_BUY_COST[v]; });
      result.pointsSpent = cost;
      if (cost > 27) result.abilityIssues.push('Point buy uses ' + (cost >= 99 ? 'scores outside 8–15' : cost + ' of 27 points') + '.');
    }

    // Species.
    var spEntry = { name: species.name, kind: 'Species', traits: species.traits, choices: [] };
    if (species.apply) species.apply(s);
    runChoices(species.choices, 'sp.' + species.id + '.', s, build, spEntry.choices);
    result.origin.push(spEntry);

    // Background.
    var bgEntry = { name: bg.name, kind: 'Background', choices: [], traits: [] };
    if (bg.custom) {
      bgEntry.traits.push(['Custom', bg.desc]);
    } else {
      bg.skills.forEach(function (sk) { DND.addSkill(s, sk, 1, bg.name); });
      bgEntry.traits.push(['Skills', bg.skills.map(function (k) { return DND.SKILLS[k].name; }).join(', ') || '—']);
      bgEntry.traits.push(['Tool', bg.tool]);
      var bgFeat = bg.feat && DND.feat(bg.feat.id);
      if (bgFeat) bgEntry.traits.push(['Origin feat', bg.featName + ' — ' + bgFeat.desc]);
      else if (bg.featName) bgEntry.traits.push(['Origin feat', bg.featName + ' (import the compendium that defines this feat to apply it)']);
    }
    (bg.extraTraits || []).forEach(function (t) { bgEntry.traits.push(t); });
    DND.addProf(s, 'tools', bg.tool);
    if (bg.legacy) {
      // 2014 backgrounds don't raise ability scores; the 2024 rule is offered as an option.
      runChoices([{ id: 'asi2024', label: 'Optional: 2024-style ability increases (any three abilities)', kind: 'one', optional: true,
        options: function () { return flexAsiOptions(); } }],
        'bg.' + bg.id + '.', s, build, bgEntry.choices);
    } else {
      runChoices(backgroundSpecs(bg), 'bg.' + bg.id + '.', s, build, bgEntry.choices);
    }
    if (!bg.custom && bgFeat) {
      var fo = DND.featOption(bgFeat, bg.feat, 'Background');
      fo.apply(s);
      if (fo.choices) runChoices(fo.choices, 'bg.' + bg.id + '.feat.', s, build, bgEntry.choices);
    }
    result.origin.push(bgEntry);
    if (species.legacyAsi && !bg.legacy) {
      s.warnings.push(species.name + ' raises ability scores (2014 rules) and ' + bg.name + ' does too (2024 rules). Most tables use only one of these.');
    }

    // Class proficiencies (first class only).
    cls.saves.forEach(function (a) { DND.addSave(s, a); });
    cls.armor.forEach(function (a) { DND.addProf(s, 'armor', a); });
    cls.weapons.forEach(function (w) { DND.addProf(s, 'weapons', w); });
    cls.tools.forEach(function (t) { DND.addProf(s, 'tools', t); });

    var taken = {}, order = [];
    for (var L = 1; L <= 20; L++) {
      var cid = DND.classAt(build, L), c = DND.cls(cid);
      if (!c) { c = cls; if (missing.indexOf('class') < 0) missing.push('class'); }
      var tk = taken[c.id], first = !tk;
      if (!tk) { tk = taken[c.id] = { cls: c, level: 0, sub: null }; order.push(tk); }
      tk.level++;
      var CL = tk.level, cp = c.id + '.';
      s.level = CL; s.charLevel = L; s.curClassId = c.id;
      s.hdList.push(c.hd);
      var entries = [], mcIssues = [];
      if (L === 1) {
        entries.push(processFeature({
          name: 'Proficiencies',
          desc: 'Saving throws: ' + (c.saves.map(function (a) { return DND.ABILITY_NAMES[a]; }).join(', ') || 'none') +
            '. Armor: ' + (c.armor.length ? c.armor.join(', ') : 'none') +
            '. Weapons: ' + (c.weapons.join(', ').replace('martial-light', 'martial (Light)').replace('martial-finesse-light', 'martial (Finesse or Light)') || 'none') +
            (c.tools.length ? '. Tools: ' + c.tools.join(', ') : '') + '.',
          choices: c.skillCount ? [DND.skillChoice('skills', 'Class skills', c.skillCount, c.skillList, c.name)] : []
        }, cp + 'L1.', s, build, 'Class'));
      } else if (first) {
        // Taking a new class: check both classes' requirements and grant multiclass proficiencies.
        var mc = c.mc || { armor: c.armor.filter(function (a) { return a !== 'heavy'; }), weapons: [], tools: [] };
        [c, cls].forEach(function (x) {
          if (x.mc && x.mc.req && !meetsReq(s, x.mc.req)) mcIssues.push('Multiclassing ' + (x === c ? 'into ' : 'out of ') + x.name + ' needs ' + reqText(x.mc.req) + '.');
        });
        mcIssues.forEach(function (w) { s.warnings.push(w); });
        (mc.armor || []).forEach(function (a) { DND.addProf(s, 'armor', a); });
        (mc.weapons || []).forEach(function (w) { DND.addProf(s, 'weapons', w); });
        (mc.tools || []).forEach(function (t) { DND.addProf(s, 'tools', t); });
        entries.push(processFeature({
          name: 'Multiclassing into ' + c.name,
          desc: 'Requires ' + (reqText(c.mc && c.mc.req) || 'no minimum') + (cls.mc && cls.mc.req && c !== cls ? ' (and ' + reqText(cls.mc.req) + ' for ' + cls.name + ')' : '') +
            '. Gain: ' + ([].concat((mc.armor || []).map(function (a) { return a === 'shield' ? 'Shields' : a + ' armor'; }), (mc.weapons || []).map(function (w) { return w + ' weapons'; }), mc.tools || []).join(', ') || 'no proficiencies') +
            (mc.skills ? ', ' + mc.skills + ' skill' : '') + '. No saving throw proficiencies.',
          choices: mc.skills ? [DND.skillChoice('skills', c.name + ' skill', mc.skills, mc.skillList || c.skillList, c.name)] : []
        }, cp + 'MC.', s, build, 'Class'));
      }
      (c.features[CL] || []).forEach(function (f) {
        if (f.subclassSlot) {
          var e = { name: c.subclassLabel, desc: 'Choose your subclass. Its features are added at the levels shown.', source: 'Class', choices: [] };
          runChoices([{ id: 'subclass', label: c.subclassLabel, kind: 'one',
            options: c.subclasses.map(function (sc) { return { id: sc.id, label: sc.name, desc: sc.desc, group: sc.compendium ? 'From your compendium' : '' }; }),
            apply: function (st, v) { st.subclass = v; } }], cp, s, build, e.choices);
          entries.push(e);
          tk.sub = find(c.subclasses, s.subclass);
        } else {
          entries.push(processFeature(f, cp + 'L' + CL + '.', s, build, 'Class'));
        }
      });
      if (tk.sub && tk.sub.features[CL]) {
        tk.sub.features[CL].forEach(function (f) {
          entries.push(processFeature(f, cp + 'L' + CL + '.' + tk.sub.id + '.', s, build, tk.sub.name));
        });
      }
      s.level = L;

      // Snapshot for this level, with level-scaled effects applied to the copy (class effects use class levels).
      var snap = clone(s);
      if (species.derive) species.derive(snap);
      order.forEach(function (t) {
        snap.level = t.level;
        if (t.cls.derive) t.cls.derive(snap);
        if (t.sub && t.sub.derive) t.sub.derive(snap);
      });
      snap.level = L;
      if (snap.lineageSpells) {
        DND.addAlways(snap, [snap.lineageSpells[0]], 'Lineage');
        if (L >= 3) DND.addAlways(snap, [snap.lineageSpells[1]], 'Lineage (1/Long Rest free)');
        if (L >= 5) DND.addAlways(snap, [snap.lineageSpells[2]], 'Lineage (1/Long Rest free)');
      }
      var takenNow = order.map(function (t) { return { cls: t.cls, level: t.level, sub: t.sub }; });
      var derived = compute(snap, build, cls, takenNow);

      var spellChanges = null;
      var lvCaster = derived.spellcasters.filter(function (e) { return e.clsId === c.id; })[0];
      if (lvCaster) {
        var ch = DND.spellChanges(build, c.id, CL);
        if (ch && ch.any) {
          var rule = lvCaster.caster.swap || 'rest', limits = [];
          if (CL > 1 && ch.cantripsRemoved.length > 1) limits.push(c.name + ' can replace 1 cantrip per level; level ' + CL + ' replaces ' + ch.cantripsRemoved.length + '.');
          if (CL > 1 && rule === 'level' && ch.preparedRemoved.length > 1) limits.push(c.name + ' can replace 1 spell when it gains a level; level ' + CL + ' replaces ' + ch.preparedRemoved.length + '.');
          spellChanges = Object.assign({ clsId: c.id, className: c.name, classLevel: CL, rule: rule, problems: limits }, ch);
          mcIssues = mcIssues.concat(limits);
        }
      }
      var issues = { missing: 0, problems: mcIssues.length };
      entries.forEach(function (e) { var n = countIssues(e.choices); issues.missing += n.missing; issues.problems += n.problems; });
      result.levels.push({ level: L, cls: c, classLevel: CL, newClass: first && L > 1, mcIssues: mcIssues, spellChanges: spellChanges, features: entries, state: snap, d: derived, issues: issues,
        subclass: tk.sub, caster: (tk.sub && tk.sub.caster) || c.caster || null, taken: takenNow });
    }
    result.multiclass = order.length > 1;
    // Name resource columns by class for the whole build once it has more than one class.
    if (result.multiclass) result.levels.forEach(function (lv) { lv.d.columns.forEach(function (c) { c.label = c.cls + ': ' + c.label; }); });

    result.originIssues = { missing: 0, problems: result.abilityIssues.length };
    result.origin.forEach(function (o) { var n = countIssues(o.choices); result.originIssues.missing += n.missing; result.originIssues.problems += n.problems; });
    return result;
  };

  /* ---------- Spell picks (cantrips + prepared), checked at a given level ---------- */

  DND.spellReport = function (build, ev, level, clsId) {
    var lv = ev.levels[level - 1];
    var d = clsId ? lv.d.spellcasters.filter(function (e) { return e.clsId === clsId; })[0] : lv.d.spell;
    if (!d) return null;
    var c = d.caster, picks = DND.spellsAt(build, d.clsId, d.classLevel);
    var lists = d.lists;
    function onList(n, lvl) { return lists.some(function (l) { return ((DND.SPELL_LISTS[l] || [])[lvl] || []).indexOf(n) >= 0; }); }
    var cantrips = (picks.cantrips || []).map(function (n, i) {
      var ok = onList(n, 0);
      return { name: n, ok: ok && i < d.cantrips, note: !ok ? 'Not on your spell list' : i >= d.cantrips ? 'Over your cantrip limit at this level' : '' };
    });
    var count = 0;
    var prepared = (picks.prepared || []).map(function (n) {
      var sl = DND.SPELL_LEVEL[n];
      var ok = sl !== undefined && sl > 0 && lists.some(function (l) { return onList(n, sl); });
      var at = DND.levelForSpell(c, sl);
      var r = { name: n, level: sl, ok: false, note: '' };
      if (!ok) r.note = 'Not on your spell list';
      else if (sl > d.maxLevel) r.note = at <= 20 ? 'Available at ' + d.className + ' level ' + at : 'Beyond your slots';
      else if (count >= d.prepared) r.note = 'Over your prepared limit at this level';
      else { r.ok = true; count++; }
      return r;
    });
    return { d: d, cantrips: cantrips, prepared: prepared, preparedCount: count };
  };
})(typeof window !== 'undefined' ? window : globalThis);
