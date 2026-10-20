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
      gear: { armor: 'chainmail', shield: true, weapons: ['longsword', 'javelin'] }
    };
    for (var k in preset || {}) b[k] = preset[k];
    return b;
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
      hpPerLevel: 0, hpFlat: 0, attacks: 1, crit: 20, subclass: null, lineageSpells: null
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
    var entry = { name: f.name, desc: f.desc, source: source, choices: [] };
    if (f.apply) f.apply(s);
    if (f.choices) runChoices(f.choices, prefix + slug(f.name) + '.', s, build, entry.choices);
    return entry;
  }

  /* ---------- Origin: species, background, class proficiencies ---------- */

  function backgroundSpecs(bg) {
    var specs = [];
    if (bg.custom) {
      specs.push({ id: 'abilities', label: 'Background abilities (pick three)', kind: 'many', count: 3, options: DND.abilityOptions() });
    }
    var pool = function (get) { return bg.custom ? (get('abilities') || []) : bg.abilities; };
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
    if (bg.custom) {
      specs.push(DND.featChoice('feat', 'Origin feat', ['origin'], 'Background'));
      specs.push(DND.skillChoice('skills', 'Background skills', 2, null, 'Background'));
    }
    return specs;
  }

  /* ---------- Derived stats ---------- */

  function maxSpellLevel(caster, level) {
    if (!caster) return 0;
    if (caster.type === 'pact') return DND.PACT.level[level - 1];
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
    return false;
  }

  function avg(die) { return die / 2 + 1; }
  function sign(n) { return (n >= 0 ? '+' : '') + n; }
  DND.sign = sign;

  function compute(s, build, cls) {
    var L = s.level, pb = DND.profBonus(L), mods = {};
    DND.ABILITIES.forEach(function (a) { mods[a] = DND.mod(s.abilities[a]); });
    var d = { pb: pb, mods: mods };

    // Hit points (Con changes apply retroactively).
    var hp = Math.max(1, cls.hd + mods.con);
    for (var l = 2; l <= L; l++) hp += Math.max(1, avg(cls.hd) + mods.con);
    d.hp = hp + s.hpPerLevel * L + s.hpFlat;
    d.hitDice = L + 'd' + cls.hd;

    // Armor class.
    var gear = build.gear || {};
    var armor = find(DND.ARMOR, gear.armor) || DND.ARMOR[0];
    var shield = !!gear.shield;
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
      acOptions.push({ ac: base, how: armor.name });
      if (s.profs.armor.indexOf(armor.type) < 0) s.warnings.push('Not proficient with ' + armor.type + ' armor (' + armor.name + '): Disadvantage on Str/Dex rolls and no spellcasting.');
    }
    acOptions.sort(function (a, b) { return b.ac - a.ac; });
    d.ac = acOptions[0].ac; d.acHow = acOptions[0].how;
    if (shield) {
      d.ac += 2; d.acHow += ' + Shield';
      if (s.profs.armor.indexOf('shield') < 0) s.warnings.push('Not proficient with Shields.');
    }
    if (s.flags.defense && armor.type !== 'none') { d.ac += 1; d.acHow += ' + Defense'; }

    // Speed.
    var speed = s.speed;
    if (armor.type !== 'heavy') speed += s.speedNoHeavy;
    if (armor.type === 'none' && !shield) speed += s.unarmoredSpeed;
    if (armor.str && s.abilities.str < armor.str) { speed -= 10; s.warnings.push(armor.name + ' needs Str ' + armor.str + ': Speed −10 ft.'); }
    d.speed = speed;

    // Checks, saves, initiative.
    var jack = s.flags.jack ? Math.floor(pb / 2) : 0;
    d.init = mods.dex + (s.flags.alert ? pb : 0) + jack;
    var aura = s.flags.auraOfProtection ? Math.max(1, mods.cha) : 0;
    d.saves = {};
    DND.ABILITIES.forEach(function (a) {
      d.saves[a] = { prof: s.saves.indexOf(a) >= 0, total: mods[a] + (s.saves.indexOf(a) >= 0 ? pb : 0) + aura };
    });
    d.skills = {};
    Object.keys(DND.SKILLS).forEach(function (k) {
      var lvl = s.skills[k] || 0, ab = DND.SKILLS[k].ability;
      var total = mods[ab] + (lvl ? pb * lvl : jack);
      s.skillBonus.forEach(function (b) { if (b.skills.indexOf(k) >= 0) total += Math.max(b.min || 0, mods[b.ability]); });
      d.skills[k] = { level: lvl, total: total };
    });
    d.passivePerception = 10 + d.skills.perception.total;

    // Spellcasting.
    var c = cls.caster;
    if (c) {
      var m = mods[c.ability];
      d.spell = {
        ability: c.ability, dc: 8 + pb + m, attack: pb + m, type: c.type,
        cantrips: c.cantrips ? (+c.cantrips[L - 1] || 0) + s.spells.bonusCantrips : 0,
        prepared: c.prepared[L - 1],
        maxLevel: maxSpellLevel(c, L),
        slots: c.type === 'pact' ? null : DND.SLOTS[c.type][L - 1],
        pact: c.type === 'pact' ? { count: DND.PACT.slots[L - 1], level: DND.PACT.level[L - 1] } : null,
        lists: [c.list].concat(s.spells.extraLists || [])
      };
    }

    // Weapon attacks from the gear list.
    d.attacks = (gear.weapons || []).map(function (id) {
      var w = DND.weapon(id);
      if (!w) return null;
      var prof = weaponProficient(s, w);
      var ab = w.ranged ? 'dex' : /F/.test(w.props) ? (mods.dex > mods.str ? 'dex' : 'str') : 'str';
      var die = w.dmg;
      var monkWeapon = cls.id === 'monk' && s.martialArts && (w.cat === 'simple' || /L/.test(w.props)) && !w.ranged;
      if (monkWeapon) {
        if (mods.dex > mods[ab]) ab = 'dex';
        if (parseInt(s.martialArts.split('d')[1], 10) > parseInt(die.split('d')[1] || 0, 10)) die = s.martialArts;
      }
      var hit = mods[ab] + (prof ? pb : 0) + (w.ranged && s.flags.archery ? 2 : 0);
      return {
        name: w.name, hit: hit, dmg: die + (mods[ab] ? ' ' + sign(mods[ab]).replace('+', '+ ').replace('-', '− ') : '') + ' ' + w.type,
        prof: prof, mastery: s.masteries.indexOf(w.id) >= 0 ? w.mastery : null, props: w.props, ranged: w.ranged
      };
    }).filter(Boolean);
    if (cls.id === 'monk') {
      var ma = mods.dex > mods.str ? 'dex' : 'str';
      d.attacks.unshift({ name: 'Unarmed Strike', hit: mods[ma] + pb, dmg: s.martialArts + ' ' + sign(mods[ma]).replace('+', '+ ').replace('-', '− ') + ' bludgeoning', prof: true, mastery: null, props: '' });
    }
    d.attacksPerAction = s.attacks;
    d.crit = s.crit;

    // Class table columns for this level.
    d.columns = (cls.columns || []).map(function (col) { return { label: col.label, value: col.values[L - 1] }; });
    return d;
  }

  /* ---------- Main evaluation ---------- */

  DND.evaluate = function (build) {
    var cls = DND.cls(build.classId) || DND.CLASSES[0];
    var species = find(DND.SPECIES, build.speciesId) || DND.SPECIES[0];
    var bg = find(DND.BACKGROUNDS, build.backgroundId) || DND.BACKGROUNDS[0];
    var s = freshState(build, species);
    var result = { cls: cls, species: species, background: bg, origin: [], levels: [], abilityIssues: [] };

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
    if (!bg.custom) {
      bg.skills.forEach(function (sk) { DND.addSkill(s, sk, 1, bg.name); });
      bgEntry.traits.push(['Skills', bg.skills.map(function (k) { return DND.SKILLS[k].name; }).join(', ')]);
      bgEntry.traits.push(['Tool', bg.tool]);
      bgEntry.traits.push(['Origin feat', bg.featName + ' — ' + DND.feat(bg.feat.id).desc]);
    } else {
      bgEntry.traits.push(['Custom', bg.desc]);
    }
    DND.addProf(s, 'tools', bg.tool);
    runChoices(backgroundSpecs(bg), 'bg.' + bg.id + '.', s, build, bgEntry.choices);
    if (!bg.custom) {
      var fo = DND.featOption(DND.feat(bg.feat.id), bg.feat, 'Background');
      fo.apply(s);
      if (fo.choices) runChoices(fo.choices, 'bg.' + bg.id + '.feat.', s, build, bgEntry.choices);
    }
    result.origin.push(bgEntry);

    // Class proficiencies (first class only).
    cls.saves.forEach(function (a) { DND.addSave(s, a); });
    cls.armor.forEach(function (a) { DND.addProf(s, 'armor', a); });
    cls.weapons.forEach(function (w) { DND.addProf(s, 'weapons', w); });
    cls.tools.forEach(function (t) { DND.addProf(s, 'tools', t); });

    var sub = null;
    var cp = cls.id + '.';
    for (var L = 1; L <= 20; L++) {
      s.level = L;
      var entries = [];
      if (L === 1) {
        entries.push(processFeature({
          name: 'Proficiencies',
          desc: 'Saving throws: ' + cls.saves.map(function (a) { return DND.ABILITY_NAMES[a]; }).join(', ') +
            '. Armor: ' + (cls.armor.length ? cls.armor.join(', ') : 'none') +
            '. Weapons: ' + cls.weapons.join(', ').replace('martial-light', 'martial (Light)').replace('martial-finesse-light', 'martial (Finesse or Light)') +
            (cls.tools.length ? '. Tools: ' + cls.tools.join(', ') : '') + '.',
          choices: [DND.skillChoice('skills', 'Class skills', cls.skillCount, cls.skillList, cls.name)]
        }, cp + 'L1.', s, build, 'Class'));
      }
      (cls.features[L] || []).forEach(function (f) {
        if (f.subclassSlot) {
          var e = { name: cls.subclassLabel, desc: 'Choose your subclass. Its features are added at the levels shown.', source: 'Class', choices: [] };
          runChoices([{ id: 'subclass', label: cls.subclassLabel, kind: 'one',
            options: cls.subclasses.map(function (sc) { return { id: sc.id, label: sc.name, desc: sc.desc }; }),
            apply: function (st, v) { st.subclass = v; } }], cp, s, build, e.choices);
          entries.push(e);
          sub = find(cls.subclasses, s.subclass);
        } else {
          entries.push(processFeature(f, cp + 'L' + L + '.', s, build, 'Class'));
        }
      });
      if (sub && sub.features[L]) {
        sub.features[L].forEach(function (f) {
          entries.push(processFeature(f, cp + 'L' + L + '.' + sub.id + '.', s, build, sub.name));
        });
      }

      // Snapshot for this level, with level-scaled effects applied to the copy.
      var snap = clone(s);
      if (species.derive) species.derive(snap);
      if (cls.derive) cls.derive(snap);
      if (sub && sub.derive) sub.derive(snap);
      if (snap.lineageSpells) {
        DND.addAlways(snap, [snap.lineageSpells[0]], 'Lineage');
        if (L >= 3) DND.addAlways(snap, [snap.lineageSpells[1]], 'Lineage (1/Long Rest free)');
        if (L >= 5) DND.addAlways(snap, [snap.lineageSpells[2]], 'Lineage (1/Long Rest free)');
      }
      var derived = compute(snap, build, cls);

      var issues = { missing: 0, problems: 0 };
      entries.forEach(function (e) { var n = countIssues(e.choices); issues.missing += n.missing; issues.problems += n.problems; });
      result.levels.push({ level: L, features: entries, state: snap, d: derived, issues: issues, subclass: sub });
    }

    result.originIssues = { missing: 0, problems: result.abilityIssues.length };
    result.origin.forEach(function (o) { var n = countIssues(o.choices); result.originIssues.missing += n.missing; result.originIssues.problems += n.problems; });
    return result;
  };

  /* ---------- Spell picks (cantrips + prepared), checked at a given level ---------- */

  DND.spellReport = function (build, ev, level) {
    var lv = ev.levels[level - 1], d = lv.d.spell, c = ev.cls.caster;
    if (!d) return null;
    var lists = d.lists;
    function onList(n, lvl) { return lists.some(function (l) { return (DND.SPELL_LISTS[l][lvl] || []).indexOf(n) >= 0; }); }
    var cantrips = (build.spells.cantrips || []).map(function (n, i) {
      var ok = onList(n, 0);
      return { name: n, ok: ok && i < d.cantrips, note: !ok ? 'Not on your spell list' : i >= d.cantrips ? 'Over your cantrip limit at this level' : '' };
    });
    var count = 0;
    var prepared = (build.spells.prepared || []).map(function (n) {
      var sl = DND.SPELL_LEVEL[n];
      var ok = sl !== undefined && sl > 0 && lists.some(function (l) { return onList(n, sl); });
      var at = DND.levelForSpell(c, sl);
      var r = { name: n, level: sl, ok: false, note: '' };
      if (!ok) r.note = 'Not on your spell list';
      else if (sl > d.maxLevel) r.note = at <= 20 ? 'Available at class level ' + at : 'Beyond your slots';
      else if (count >= d.prepared) r.note = 'Over your prepared limit at this level';
      else { r.ok = true; count++; }
      return r;
    });
    return { d: d, cantrips: cantrips, prepared: prepared, preparedCount: count };
  };
})(typeof window !== 'undefined' ? window : globalThis);
