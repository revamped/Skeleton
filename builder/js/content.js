/*
 * Content registry: merges bundled SRD content and an optional user-imported
 * Fight Club 5 compendium into the builder's data tables.
 *
 * Imported content never leaves the browser: it is parsed locally and kept in IndexedDB.
 */
(function (G) {
  var DND = G.DND = G.DND || {};
  var opt = DND.opt;

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function idFor(prefix, o) { return prefix + slug(o.name) + (o.ed === '2014' ? '-2014' : ''); }
  function lc(s) { return (s || '').toLowerCase(); }

  var ABIL_BY_NAME = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
    str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };
  var SKILL_BY_NAME = {};
  Object.keys(DND.SKILLS).forEach(function (k) { SKILL_BY_NAME[lc(DND.SKILLS[k].name)] = k; });
  var DMG = { S: 'slashing', P: 'piercing', B: 'bludgeoning', F: 'fire', C: 'cold', L: 'lightning', A: 'acid', N: 'necrotic', R: 'radiant', T: 'thunder', O: 'force', PS: 'psychic', PY: 'psychic', I: 'poison' };
  DND.DMG_NAME = DMG;
  var SIZE = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', V: 'Medium or Small' };
  var NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, an: 1 };
  var SCHOOL = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', EN: 'Enchantment', EV: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation' };
  DND.SCHOOL = SCHOOL;
  DND.ITEM_TYPE = { M: 'Melee weapon', R: 'Ranged weapon', A: 'Ammunition', LA: 'Light armor', MA: 'Medium armor', HA: 'Heavy armor', S: 'Shield',
    G: 'Adventuring gear', $: 'Treasure', P: 'Potion', RD: 'Rod', RG: 'Ring', ST: 'Staff', SC: 'Scroll', W: 'Wondrous item', WD: 'Wand' };
  DND.SIZE_NAME = SIZE;

  var BASE = null;
  function snapshotBase() {
    if (BASE) return;
    BASE = {
      FEATS: DND.FEATS.slice(), SPECIES: DND.SPECIES.slice(), BACKGROUNDS: DND.BACKGROUNDS.slice(), CLASSES: DND.CLASSES.slice(),
      WEAPONS: DND.WEAPONS.slice(), ARMOR: DND.ARMOR.slice(),
      SPELL_LISTS: JSON.parse(JSON.stringify(DND.SPELL_LISTS)), SPELL_LEVEL: Object.assign({}, DND.SPELL_LEVEL),
      SUBCLASSES: {}
    };
    DND.CLASSES.forEach(function (c) { BASE.SUBCLASSES[c.id] = c.subclasses.slice(); });
  }

  DND.CONTENT = { srd: null, user: null, userInfo: null };

  /* ---------- Text heuristics ---------- */

  function abilitiesIn(s) {
    var out = [];
    (s.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b/g) || []).forEach(function (n) {
      var a = ABIL_BY_NAME[lc(n)]; if (out.indexOf(a) < 0) out.push(a);
    });
    return out;
  }
  // "Increase your Strength or Dexterity score by 1, to a maximum of 20."
  function asiFromText(text) {
    var sentences = text.split(/(?<=\.)\s+|\n/);
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      var m = /\bIncrease\b[^.]*?\bby (\d)\b/i.exec(s);
      if (!m || /Hit Point|speed/i.test(s)) continue;
      var abs = abilitiesIn(s);
      if (!abs.length && /of your choice/i.test(s)) abs = DND.ABILITIES.slice();
      if (!abs.length) continue;
      var cap = /maximum of (\d+)/i.exec(s);
      return { abilities: abs, amount: +m[1], cap: cap ? +cap[1] : 20 };
    }
    return null;
  }
  function asiChoices(asi) {
    if (!asi) return [];
    if (asi.abilities.length === 1) return [];
    return [{ id: 'inc', label: '+' + asi.amount + ' to', kind: 'one', options: function () { return DND.abilityOptions(asi.abilities); },
      apply: function (s, v) { DND.inc(s, v, asi.amount, asi.cap); } }];
  }
  function asiApply(asi) {
    return function (s) { if (asi && asi.abilities.length === 1) DND.inc(s, asi.abilities[0], asi.amount, asi.cap); };
  }
  function modAbilities(mods) {
    return (mods || []).filter(function (m) { return m.cat === 'ability score'; }).map(function (m) {
      var x = /(\w+)\s*([+-]\d+)/.exec(m.text); return x ? { ab: ABIL_BY_NAME[lc(x[1])], n: +x[2] } : null;
    }).filter(function (x) { return x && x.ab; });
  }
  // Numeric bonuses from <modifier> tags, or from "+1 bonus to AC" phrases in the text.
  function bonuses(item) {
    var b = { ac: 0, save: 0, hit: 0, dmg: 0, spellAtk: 0, spellDc: 0, speed: 0, init: 0 };
    var found = false;
    (item.mods || []).forEach(function (m) {
      if (m.cat !== 'bonus') return;
      var x = /^(.*?)\s*([+-]\d+)\s*$/.exec(m.text.trim());
      if (!x) return;
      var k = lc(x[1]), n = +x[2];
      found = true;
      if (k === 'ac') b.ac += n;
      else if (/saving throw/.test(k)) b.save += n;
      else if (/(melee|ranged|weapon) attack/.test(k)) b.hit = Math.max(b.hit, n);
      else if (/(melee|ranged|weapon) damage/.test(k)) b.dmg = Math.max(b.dmg, n);
      else if (/spell attack/.test(k)) b.spellAtk += n;
      else if (/spell dc/.test(k)) b.spellDc += n;
      else if (k === 'speed') b.speed += n;
      else if (k === 'initiative') b.init += n;
    });
    if (!found) {
      var t = item.text || '', m, re = /\+(\d) bonus to ([^.;]+)/gi;
      while ((m = re.exec(t))) {
        var n = +m[1], what = lc(m[2]);
        if (/\bac\b|armor class/.test(what)) b.ac += n;
        if (/saving throw/.test(what)) b.save += n;
        if (/spell attack/.test(what)) b.spellAtk += n;
        else if (/attack roll/.test(what)) b.hit = Math.max(b.hit, n);
        if (/damage roll/.test(what) && !/spell/.test(what)) b.dmg = Math.max(b.dmg, n);
        if (/save dc|spell save/.test(what)) b.spellDc += n;
      }
      var nm = /(?:^|\s|,\s)\+(\d)(?:\s|$)/.exec(item.name);
      if (nm && !b.hit && !b.ac && /^(M|R)$/.test(item.type)) { b.hit = +nm[1]; b.dmg = +nm[1]; }
      if (nm && !b.ac && /^(LA|MA|HA|S)$/.test(item.type)) b.ac = +nm[1];
    }
    return b;
  }
  DND.itemBonuses = bonuses;
  function setScore(item) {
    var m = /Your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score (?:is|becomes|changes to) (\d+)/i.exec(item.text || '');
    return m ? { ab: ABIL_BY_NAME[lc(m[1])], score: +m[2] } : null;
  }
  DND.itemSetsScore = setScore;
  // Show "(2014)" only when a 2024 entry of the same name exists.
  var taken = {};
  function edName(kind, o) {
    var n = o.name;
    return o.ed === '2014' && taken[kind] && taken[kind][lc(n)] ? n + ' (2014)' : n;
  }
  function markTaken(kind, names) {
    taken[kind] = taken[kind] || {};
    names.forEach(function (n) { taken[kind][lc(n)] = true; });
  }
  function short(text, n) { text = (text || '').replace(/\s+/g, ' ').trim(); return text.length > n ? text.slice(0, n - 1) + '…' : text; }

  /* ---------- Spells ---------- */

  function registerSpells(lists) {
    DND.SPELL_INFO = {};
    DND.SPELL_DB = [];
    var classSpells = {};
    lists.forEach(function (list) {
      list.forEach(function (sp) {
        if (sp.level === null) return;
        DND.SPELL_DB.push(sp);
        var prev = DND.SPELL_INFO[sp.name];
        if (!prev || (prev.ed === '2014' && sp.ed === '2024')) DND.SPELL_INFO[sp.name] = sp;
        if (DND.SPELL_LEVEL[sp.name] === undefined) DND.SPELL_LEVEL[sp.name] = sp.level;
        sp.classes.forEach(function (tok) {
          var m = /^(.*?)\s*(?:\[5\.5e\])?\s*(?:\((.*)\))?$/.exec(tok.replace(/\s*\[5\.5e\]\s*/, ' ').trim());
          if (!m) return;
          var key = sp.ed + '|' + m[1].trim() + '|' + (m[2] ? m[2].trim() : '');
          var arr = classSpells[key] = classSpells[key] || [];
          (arr[sp.level] = arr[sp.level] || []);
          if (arr[sp.level].indexOf(sp.name) < 0) arr[sp.level].push(sp.name);
        });
      });
    });
    DND.CLASS_SPELLS = classSpells;
    // Add newer 2024 spells to the built-in class lists, and keep 2014 ones as an optional legacy list.
    BASE.CLASSES.forEach(function (c) {
      if (!c.caster) return;
      var mine = DND.SPELL_LISTS[c.caster.list];
      var add = classSpells['2024|' + c.name + '|'] || [];
      add.forEach(function (names, lvl) {
        if (!names) return;
        mine[lvl] = mine[lvl] || [];
        names.forEach(function (n) { if (mine[lvl].indexOf(n) < 0) mine[lvl].push(n); });
      });
      var legacy = [];
      (classSpells['2014|' + c.name + '|'] || []).forEach(function (names, lvl) {
        if (!names) return;
        legacy[lvl] = names.filter(function (n) { return !(mine[lvl] || []).some(function (x) { return x === n; }); });
      });
      for (var i = 0; i <= 9; i++) legacy[i] = legacy[i] || [];
      DND.SPELL_LISTS[c.caster.list + ':legacy'] = legacy;
    });
  }
  function listFromClassSpells(key) {
    var src = DND.CLASS_SPELLS[key];
    if (!src) return null;
    var out = [];
    for (var i = 0; i <= 9; i++) out[i] = (src[i] || []).slice();
    return out;
  }

  /* ---------- Items: weapons, armor, shields, everything ---------- */

  var PROP_MAP = { F: 'F', L: 'L', H: 'H', T: 'T', '2H': '2', V: 'V', R: 'R', A: 'A' };
  function weaponFromItem(it) {
    var props = it.prop.split(',').map(function (p) { return PROP_MAP[p.trim()] || ''; }).join('');
    var base = null, prof = /Proficiency:\s*(\w+),\s*([^\n]+)/.exec(it.text || '');
    if (prof) base = DND.WEAPONS.filter(function (w) { return lc(w.name) === lc(prof[2]).trim(); })[0];
    if (!base) {
      BASE.WEAPONS.forEach(function (w) { if (lc(it.name).indexOf(lc(w.name)) >= 0 && (!base || w.name.length > base.name.length)) base = w; });
    }
    var martial = /(^|,)M(,|$)/.test(it.prop) || (prof && lc(prof[1]) === 'martial') || (base && base.cat === 'martial');
    var mm = /Mastery:\s*(\w+)/.exec(it.text || '');
    var b = bonuses(it);
    return {
      id: idFor('i-', it), name: edName('item', it), cat: martial ? 'martial' : 'simple', ranged: it.type === 'R',
      dmg: it.dmg1, dmg2: it.dmg2 || '', type: DMG[it.dmgType] || lc(it.dmgType || ''), props: props, mastery: mm ? mm[1] : base ? base.mastery : null,
      bonusHit: b.hit, bonusDmg: b.dmg, magic: it.magic, compendium: true, itemId: idFor('i-', it), baseId: base ? base.id : null, src: it.src
    };
  }
  function registerItems(lists) {
    DND.ITEMS = [];
    DND.SHIELDS = [{ id: 'shield', name: 'Shield', bonus: 0 }];
    var seen = {};
    lists.forEach(function (list) {
      list.forEach(function (it) {
        var id = idFor('i-', it);
        if (seen[id]) return;
        seen[id] = true;
        var o = Object.assign({ id: id }, it);
        o.attune = /requires attunement/i.test(it.detail || '');
        o.rarity = (/(common|uncommon|rare|very rare|legendary|artifact|varies)/i.exec(it.detail || '') || [''])[0].toLowerCase();
        DND.ITEMS.push(o);
        var builtinW = BASE.WEAPONS.some(function (w) { return lc(w.name) === lc(it.name); });
        var builtinA = BASE.ARMOR.some(function (a) { return lc(a.name) === lc(it.name) || lc(a.name + ' armor') === lc(it.name); });
        if ((it.type === 'M' || it.type === 'R') && it.dmg1 && !(builtinW && !it.magic)) DND.WEAPONS.push(weaponFromItem(it));
        if (/^(LA|MA|HA)$/.test(it.type) && it.ac && !(builtinA && !it.magic)) {
          DND.ARMOR.push({ id: id, name: edName('item', it), type: { LA: 'light', MA: 'medium', HA: 'heavy' }[it.type], ac: +it.ac,
            str: +it.strength || 0, stealthDis: it.stealth === '1' || it.stealth === 'YES', bonusAc: bonuses(it).ac, magic: it.magic, compendium: true, itemId: id, src: it.src });
        }
        if (it.type === 'S' && it.magic) DND.SHIELDS.push({ id: id, name: it.name, bonus: bonuses(it).ac, itemId: id });
      });
    });
    DND.ITEM_BY_ID = {};
    DND.ITEMS.forEach(function (i) { DND.ITEM_BY_ID[i.id] = i; });
  }
  DND.item = function (id) { return (DND.ITEM_BY_ID || {})[id] || null; };

  function registerMonsters(lists) {
    DND.MONSTERS = [];
    DND.MONSTER_BY_ID = {};
    lists.forEach(function (list) {
      list.forEach(function (m) {
        var id = idFor('m-', m);
        if (DND.MONSTER_BY_ID[id]) return;
        var o = Object.assign({ id: id }, m);
        DND.MONSTERS.push(o);
        DND.MONSTER_BY_ID[id] = o;
      });
    });
  }
  DND.monster = function (id) { return (DND.MONSTER_BY_ID || {})[id] || null; };
  DND.crValue = function (cr) {
    if (!cr) return 0;
    if (cr.indexOf('/') > 0) { var p = cr.split('/'); return +p[0] / +p[1]; }
    return parseFloat(cr) || 0;
  };

  /* ---------- Feats ---------- */

  function featCategory(f) {
    if (/^Fighting Style:/i.test(f.name)) return 'style';
    if (/^Boon of\b/i.test(f.name) || /Level 19/.test(f.prereq)) return 'epic';
    if (/:/.test(f.name)) return 'option';
    if (f.ed === '2014') return 'legacy';
    if (/Level \d/.test(f.prereq)) return 'general';
    return 'origin';
  }
  function registerFeats(list) {
    DND.COMPENDIUM_FEATS = [];
    var builtinNames = BASE.FEATS.map(function (f) { return lc(f.name); });
    list.forEach(function (f) {
      var cat = featCategory(f);
      var bare = f.name.replace(/^Fighting Style:\s*/i, '');
      var o = { id: idFor('cf-', f), name: edName('feat', { name: f.name.replace(/^Fighting Style:\s*/i, ''), ed: f.ed }), cat: cat, desc: f.text,
        prereqText: f.prereq, src: f.src, ed: f.ed, compendium: true, repeatable: /Repeatable/i.test(f.text) };
      DND.COMPENDIUM_FEATS.push(o);
      if (cat === 'option') return;
      if (f.ed === '2024' && builtinNames.indexOf(lc(bare)) >= 0) return; // the built-in version has full mechanics
      var lvl = /Level (\d+)/.exec(f.prereq || '');
      if (lvl) o.minLevel = +lvl[1];
      var abReq = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)[^,]*?13/.exec(f.prereq || '');
      if (abReq) { o.prereq = { any: true }; abilitiesIn(f.prereq).forEach(function (a) { o.prereq[a] = 13; }); }
      var fixed = modAbilities(f.mods);
      if (fixed.length) {
        o.apply = function (s) { fixed.forEach(function (x) { DND.inc(s, x.ab, x.n, 20); }); };
        if (/proficiency in saving throws using the chosen ability/i.test(f.text)) {
          var prevApply = o.apply;
          o.apply = function (s) { prevApply(s); fixed.forEach(function (x) { DND.addSave(s, x.ab); }); };
        }
      } else {
        var asi = asiFromText(f.text);
        if (asi) {
          o.apply = asiApply(asi);
          var ch = asiChoices(asi);
          if (ch.length) o.choices = function () { return ch; };
        }
      }
      DND.FEATS.push(o);
    });
  }

  /* ---------- Species ---------- */

  var SKIP_TRAITS = /^(Description|Creature Type|Size|Life Span|Age|Alignment|Languages|Ability Score Increases?|Speed)$/i;
  function skillsInPhrase(p) {
    var out = [];
    Object.keys(SKILL_BY_NAME).forEach(function (n) { if (lc(p).indexOf(n) >= 0) out.push(SKILL_BY_NAME[n]); });
    return out;
  }
  function convertRace(r) {
    var id = idFor('sp-', r);
    var traits = r.traits.filter(function (t) { return t.cat !== 'description' && !SKIP_TRAITS.test(t.name); });
    var fixedAsi = [];
    var re = /(Str|Dex|Con|Int|Wis|Cha)\w*\s*([+-]?\d+)/g, m;
    while ((m = re.exec(r.ability || ''))) fixedAsi.push({ ab: ABIL_BY_NAME[lc(m[1])], n: +m[2] });
    var profSkills = (r.prof || '').split(/,\s*/).map(function (x) { return SKILL_BY_NAME[lc(x.trim())]; }).filter(Boolean);
    var dv = 0;
    r.traits.forEach(function (t) {
      if (/Darkvision/i.test(t.name)) { var x = /(\d+)\s*(?:feet|ft)/.exec(t.text); if (x) dv = Math.max(dv, +x[1]); }
    });
    var choices = [];
    var asiTrait = r.traits.filter(function (t) { return /^Ability Score Increases?$/i.test(t.name); })[0];
    var asiText = asiTrait ? asiTrait.text : '';
    if (/two (?:other|different) ability scores of your choice/i.test(asiText)) {
      choices.push({ id: 'flex1', label: '+1 to (choice)', kind: 'one', options: function () { return DND.abilityOptions(); }, apply: function (s, v) { DND.inc(s, v, 1, 20); } });
      choices.push({ id: 'flex2', label: '+1 to (another)', kind: 'one', options: function (s, get) {
        return DND.abilityOptions().map(function (o) { if (o.id === get('flex1')) o.unavailable = 'Pick a different ability'; return o; });
      }, apply: function (s, v) { DND.inc(s, v, 1, 20); } });
    } else if (/one ability score of your choice increases by 2/i.test(asiText) && !fixedAsi.length) {
      choices.push({ id: 'flex2', label: '+2 to', kind: 'one', options: function () { return DND.abilityOptions(); }, apply: function (s, v) { DND.inc(s, v, 2, 20); } });
    } else if (r.ed === '2014' && !fixedAsi.length && asiText) {
      choices.push({ id: 'flex', label: 'Ability score increases', kind: 'one', options: function () {
        return [{ id: '21', label: '+2 to one, +1 to another', choices: [
          { id: 'plus2', label: '+2 to', kind: 'one', options: function () { return DND.abilityOptions(); }, apply: function (s, v) { DND.inc(s, v, 2, 20); } },
          { id: 'plus1', label: '+1 to', kind: 'one', options: function (s, g) { return DND.abilityOptions().map(function (o) { if (o.id === g('plus2')) o.unavailable = 'Must differ from the +2'; return o; }); },
            apply: function (s, v) { DND.inc(s, v, 1, 20); } }] },
          { id: '111', label: '+1 to three different scores', choices: [
            { id: 'abs', label: 'Abilities', kind: 'many', count: 3, options: function () { return DND.abilityOptions(); }, apply: function (s, v) { v.forEach(function (a) { DND.inc(s, a, 1, 20); }); } }] }];
      } });
    }
    traits.forEach(function (t, i) {
      var c = /proficiency (?:in|with) (one|two|three|four) skills? of your choice/i.exec(t.text);
      if (c) { choices.push(DND.skillChoice('skill' + i, t.name + ' (skills)', NUM[lc(c[1])], null, r.name)); return; }
      var c2 = /proficiency in the ([A-Z][A-Za-z ,]+? or [A-Z][A-Za-z ]+?) skill/.exec(t.text);
      if (c2) { var pool = skillsInPhrase(c2[1]); if (pool.length > 1) choices.push(DND.skillChoice('skill' + i, t.name + ' (skill)', 1, pool, r.name)); return; }
      if (/^(Feat|Versatile)$/i.test(t.name) && /feat of your choice/i.test(t.text)) {
        choices.push(DND.featChoice('feat' + i, t.name + ' (feat)', /Origin feat/i.test(t.text) ? ['origin'] : ['origin', 'general', 'legacy'], r.name));
      }
    });
    return {
      id: id, name: edName('species', r), compendium: true, ed: r.ed, src: r.src, legacyAsi: fixedAsi.length > 0 || choices.some(function (c) { return /^flex/.test(c.id); }),
      size: SIZE[r.size] || r.size || 'Medium', speed: r.speed || 30, darkvision: dv,
      traits: (fixedAsi.length ? [['Ability Score Increase', fixedAsi.map(function (x) { return x.ab.toUpperCase() + ' ' + DND.sign(x.n); }).join(', ')]] : [])
        .concat(traits.map(function (t) { return [t.name, t.text]; })),
      choices: choices,
      apply: function (s) {
        fixedAsi.forEach(function (x) { DND.inc(s, x.ab, x.n, 20); });
        profSkills.forEach(function (k) { DND.addSkill(s, k, 1, r.name); });
      }
    };
  }

  /* ---------- Backgrounds ---------- */

  function findFeatByName(name) {
    var bare = lc(name.replace(/\s*\(.*\)\s*$/, ''));
    var param = (/\(([^)]+)\)/.exec(name) || [])[1];
    var f = BASE.FEATS.filter(function (x) { return lc(x.name) === bare; })[0];
    if (f) return { ref: { id: f.id, list: param ? lc(param) : undefined }, name: name };
    f = DND.FEATS.filter(function (x) { return x.compendium && lc(x.name) === lc(name); })[0] ||
      DND.FEATS.filter(function (x) { return x.compendium && lc(x.name.replace(/ \(2014\)$/, '')) === bare; })[0];
    return f ? { ref: { id: f.id }, name: name } : null;
  }
  function convertBackground(b) {
    var id = idFor('bg-', b);
    var skills = (b.prof || '').split(/,\s*/).map(function (x) { return SKILL_BY_NAME[lc(x.trim())]; }).filter(Boolean);
    var abTrait = b.traits.filter(function (t) { return /^Ability Scores?:/i.test(t.name); })[0];
    var featTrait = b.traits.filter(function (t) { return /^Feat:/i.test(t.name); })[0];
    var toolTrait = b.traits.filter(function (t) { return /^Tool Proficienc/i.test(t.name); })[0];
    var extra = b.traits.filter(function (t) { return t !== abTrait && t !== featTrait && t !== toolTrait && !/^(Starting Equipment)$/i.test(t.name); })
      .map(function (t) { return [t.name, t.text]; });
    var tool = toolTrait ? toolTrait.name.replace(/^Tool Proficienc(y|ies):\s*/i, '') : '—';
    if (abTrait && featTrait) {
      var feat = findFeatByName(featTrait.name.replace(/^Feat:\s*/i, ''));
      return { id: id, name: edName('background', b), compendium: true, ed: b.ed, src: b.src,
        abilities: abilitiesIn(abTrait.name), feat: feat ? feat.ref : null, featName: featTrait.name.replace(/^Feat:\s*/i, ''),
        skills: skills, tool: tool, extraTraits: extra };
    }
    return { id: id, name: edName('background', b), compendium: true, legacy: true, ed: b.ed, src: b.src,
      skills: skills, tool: tool, extraTraits: extra };
  }

  /* ---------- Classes ---------- */

  function stripLevel(n) { return n.replace(/^Level \d+:\s*/i, '').trim(); }
  function F(name, desc, extra) { var f = { name: name, desc: desc, long: true }; for (var k in extra || {}) f[k] = extra[k]; return f; }
  function fill20(map, def) {
    var out = [], last = def;
    for (var l = 1; l <= 20; l++) { if (map[l] !== undefined) last = map[l]; out.push(last); }
    return out;
  }
  function countIn(text) {
    var m = /\b(?:choose|learn|select|pick|gain|know)\s+(one|two|three|four|five|six)\b/i.exec(text || '');
    return m ? NUM[lc(m[1])] : 1;
  }
  // Some features keep their options in a pseudo spell list ("added as spells in the Maneuver Options spell list").
  function spellListChoice(f, ed) {
    var m = /added as spells in the "?([^"]+?)"? spell list/i.exec(f.desc || '');
    var src = m && DND.CLASS_SPELLS[ed + '|' + m[1].trim() + '|'];
    if (!src) return f;
    var names = [];
    src.forEach(function (lvl) { (lvl || []).forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); }); });
    var count = Math.min(countIn(f.desc), names.length);
    f.choices = (f.choices || []).concat([{ id: 'list-' + slug(m[1]), label: m[1].trim(), kind: count > 1 ? 'many' : 'one', count: count,
      options: names.sort().map(function (n) { var sp = DND.SPELL_INFO[n]; return { id: n, label: n, desc: sp ? sp.text : '' }; }) }]);
    return f;
  }
  function optionChoice(group, opts, text, optional) {
    var count = Math.min(countIn(text), opts.length);
    return { id: 'opt-' + slug(group), label: group + (optional ? ' (optional)' : ''), kind: count > 1 ? 'many' : 'one', count: count, optional: !!optional,
      options: opts.map(function (o) { return { id: slug(o.name), label: o.name, desc: o.text }; }) };
  }

  // Multiclass requirements and proficiencies from "Multiclass X" / "Becoming a X As A Multiclass Character".
  function parseMulticlass(text) {
    if (!text) return null;
    var mc = { req: null, armor: [], weapons: [], tools: [], skills: 0, skillList: null };
    var reqSeg = (/Primary Ability:\s*([^\n]+)/i.exec(text) || /Ability Score Minimum[\s\S]*?(?=Proficienc|$)/i.exec(text) || [''])[0];
    var abs = [];
    (reqSeg.match(/\b(Str|Dex|Con|Int|Wis|Cha)[a-z]*/gi) || []).forEach(function (w) { var a = w.slice(0, 3).toLowerCase(); if (DND.ABILITIES.indexOf(a) >= 0 && abs.indexOf(a) < 0) abs.push(a); });
    if (abs.length) mc.req = /\bor\b/i.test(reqSeg) ? { any: abs } : { all: abs };
    var armor = /Armor(?: Training)?:\s*([^\n]+)/i.exec(text);
    if (armor) ['light', 'medium', 'heavy'].forEach(function (k) { if (new RegExp(k, 'i').test(armor[1])) mc.armor.push(k); });
    if (armor && /shield/i.test(armor[1])) mc.armor.push('shield');
    var weapons = /Weapon(?:s| Proficiencies)?:\s*([^\n]+)/i.exec(text);
    if (weapons) { if (/simple/i.test(weapons[1])) mc.weapons.push('simple'); if (/martial/i.test(weapons[1])) mc.weapons.push('martial'); }
    var tools = /Tools?(?: Proficienc(?:y|ies))?:\s*([^\n]+)/i.exec(text);
    if (tools && !/^\s*none/i.test(tools[1])) mc.tools.push(tools[1].replace(/\.$/, '').trim());
    var skills = /Skill(?:s| Proficiencies)?:\s*Choose (\d|one|two|three)\b:?\s*([^\n]*)/i.exec(text);
    if (skills) { mc.skills = +skills[1] || NUM[lc(skills[1])] || 1; var pool = skillsInPhrase(skills[2]); mc.skillList = pool.length ? pool : null; }
    return mc;
  }

  // Convert a compendium class into the engine's class shape. Returns { cls, subclasses }.
  function convertClass(c, builtin) {
    var lv = {}, slots = {}, slotsOpt = {}, known = {}, counters = {}, asi = {}, optCounters = [], mcText = '';
    function L(n) { return lv[n] = lv[n] || { core: [], opt: [] }; }
    c.auto.forEach(function (a) {
      if (a.slots) (a.slotsOpt ? slotsOpt : slots)[a.lv] = a.slots;
      if (a.known !== null) known[a.lv] = a.known;
      var allOpt = a.features.length && a.features.every(function (f) { return f.opt; });
      a.counters.forEach(function (ct) {
        if (allOpt) optCounters.push({ lv: a.lv, ct: ct, raws: a.features.map(function (f) { return stripLevel(f.name); }) });
        else (counters[ct.name] = counters[ct.name] || {})[a.lv] = ct.value;
      });
      a.features.forEach(function (f) {
        var o = { name: stripLevel(f.name), text: f.text, raw: f.name };
        if (/Ability Score Improvement/i.test(o.name) && a.asi) asi[a.lv] = true;
        if (/multiclass/i.test(o.name)) mcText = f.text;
        if (/^(Becoming|Starting|Multiclass)\b/i.test(o.name)) return;
        (f.opt ? L(a.lv).opt : L(a.lv).core).push(o);
      });
    });

    // Subclass label, picks and features.
    var label = c.subclass;
    if (!label) Object.keys(lv).some(function (n) { return lv[n].core.some(function (f) { if (/Subclass$/i.test(f.name)) { label = f.name; return true; } return false; }); });
    var subs = [], subByName = {};
    Object.keys(lv).forEach(function (n) {
      lv[n].opt = lv[n].opt.filter(function (f) {
        if (label && f.name.indexOf(label + ':') === 0) {
          var sn = f.name.slice(label.length + 1).trim();
          if (!subByName[sn]) { subByName[sn] = { name: sn, level: +n, text: f.text, feats: {} }; subs.push(subByName[sn]); }
          return false;
        }
        return true;
      });
    });
    var subLevel = subs.length ? Math.min.apply(null, subs.map(function (s) { return s.level; })) : 3;
    var groups = {}; // level -> group -> [options]
    Object.keys(lv).forEach(function (n) {
      lv[n].opt.forEach(function (f) {
        var m1 = /^(.+?):\s*(.+)$/.exec(f.name), m2 = /^(.*)\s\(([^()]+)\)$/.exec(f.name);
        var sub = null, name = f.name;
        if (m2 && subByName[m2[2]]) { sub = subByName[m2[2]]; name = m2[1]; }
        else if (m1 && subByName[m1[1]]) { sub = subByName[m1[1]]; name = m1[2]; }
        if (sub) { (sub.feats[n] = sub.feats[n] || []).push({ name: name, text: f.text }); return; }
        var g = m1 ? m1[1] : 'Optional features';
        var gl = (groups[n] = groups[n] || {});
        (gl[g] = gl[g] || []).push({ name: m1 ? m1[2] : f.name, text: f.text });
      });
    });

    var ed = c.ed;
    var featCats = ['general', 'origin', 'style', 'legacy'];
    var features = {};
    var attached = {};
    function attachGroups(n, list, isSub) {
      var gl = groups[n] || {};
      list.forEach(function (f) {
        Object.keys(gl).forEach(function (g) {
          if (attached[n + '|' + g]) return;
          if (lc(f.name) === lc(g) || lc(f.name).indexOf(lc(g)) >= 0) {
            f.choices = (f.choices || []).concat([optionChoice(g, gl[g], f.desc, isSub)]);
            attached[n + '|' + g] = true;
          }
        });
      });
    }
    for (var n = 1; n <= 20; n++) {
      var list = [];
      var hadSlot = false;
      (lv[n] ? lv[n].core : []).forEach(function (f) {
        if (label && lc(f.name) === lc(label) && n === subLevel && subs.length) { list.push({ subclassSlot: true }); hadSlot = true; return; }
        if (asi[n] && /Ability Score Improvement/i.test(f.name)) {
          list.push(F('Ability Score Improvement', f.text, { choices: [DND.featChoice('feat', 'Ability Score Improvement or a feat', featCats, 'Ability Score Improvement')] }));
          return;
        }
        if (/^Epic Boon$/i.test(f.name)) { list.push(F('Epic Boon', f.text, { choices: [DND.featChoice('feat', 'Epic Boon (or another feat)', ['epic', 'general', 'origin', 'style', 'legacy'], 'Epic Boon')] })); return; }
        list.push(spellListChoice(F(f.name, f.text), ed));
      });
      if (n === subLevel && subs.length && !hadSlot) list.unshift({ subclassSlot: true });
      attachGroups(n, list.filter(function (f) { return !f.subclassSlot; }), false);
      features[n] = list;
    }
    // Subclass objects.
    var subclasses = subs.map(function (sb) {
      var feats = {};
      Object.keys(sb.feats).forEach(function (n) {
        feats[n] = sb.feats[n].map(function (f) { return spellListChoice(F(f.name, f.text), ed); });
        attachGroups(n, feats[n], true);
      });
      return { id: 'sc-' + slug(c.name) + '-' + slug(sb.name) + (ed === '2014' ? '-2014' : ''), name: sb.name, desc: short(sb.text, 220), compendium: true, features: feats };
    });
    // Resource counters introduced by subclass features become that subclass's columns.
    function subOf(name) {
      var m1 = /^(.+?):\s*(.+)$/.exec(name), m2 = /^(.*)\s\(([^()]+)\)$/.exec(name);
      if (label && name.indexOf(label + ':') === 0) return subByName[name.slice(label.length + 1).trim()];
      if (m2 && subByName[m2[2]]) return subByName[m2[2]];
      if (m1 && subByName[m1[1]]) return subByName[m1[1]];
      return null;
    }
    var subCounters = {};
    optCounters.forEach(function (oc) {
      var sb = null;
      oc.raws.some(function (r) { sb = subOf(r); return !!sb; });
      if (!sb) return;
      var m = subCounters[sb.name] = subCounters[sb.name] || {};
      (m[oc.ct.name] = m[oc.ct.name] || {})[oc.lv] = oc.ct.value;
      // Counter-only level entries for the same resource belong to that subclass too.
      if (counters[oc.ct.name]) {
        Object.keys(counters[oc.ct.name]).forEach(function (l) { if (m[oc.ct.name][l] === undefined) m[oc.ct.name][l] = counters[oc.ct.name][l]; });
        delete counters[oc.ct.name];
      }
    });
    subclasses.forEach(function (sc, i) {
      var m = subCounters[subs[i].name];
      if (m) sc.columns = Object.keys(m).map(function (name) { return { label: name, values: fill20(m[name], '—').map(String) }; });
    });
    // Option groups that matched no feature stay available as optional picks.
    Object.keys(groups).forEach(function (n) {
      Object.keys(groups[n]).forEach(function (g) {
        if (attached[n + '|' + g]) return;
        (features[n] = features[n] || []).push(F(g, 'Optional choices offered at this level.', { choices: [optionChoice(g, groups[n][g], '', true)] }));
      });
    });

    // Spellcasting.
    function casterFrom(table, list, ability) {
      var rows = fill20(table, []);
      if (!rows.some(function (r) { return r.length; })) return null;
      var cantrips = rows.map(function (r) { return r[0] || 0; });
      var slotRows = rows.map(function (r) { return r.slice(1); });
      var maxAt20 = 0;
      slotRows[19].forEach(function (x, i) { if (x) maxAt20 = i + 1; });
      var hasKnown = Object.keys(known).length > 0;
      // Pact-style tables have a single slot level per row (e.g. the 2014 warlock).
      var pactLike = slotRows.every(function (r) { return r.filter(function (x) { return x; }).length <= 1; }) && maxAt20 >= 5;
      return { type: 'table', ability: ABIL_BY_NAME[lc(ability)] || 'int', list: list, cantrips: cantrips, slots: slotRows,
        prepared: hasKnown ? fill20(known, 0) : null, preparedFormula: maxAt20 <= 5 ? 'half' : 'full', swap: hasKnown ? 'level' : 'rest',
        mcKind: pactLike ? 'pact' : maxAt20 >= 9 ? 'full' : maxAt20 >= 5 ? 'half' : 'third' };
    }
    var listKey = 'cs-' + ed + '-' + slug(c.name);
    var classList = listFromClassSpells(ed + '|' + c.name + '|');
    if (builtin && builtin.caster && !classList) listKey = builtin.caster.list;
    else if (classList) DND.SPELL_LISTS[listKey] = classList;
    var caster = Object.keys(slots).length ? casterFrom(slots, listKey, c.spellAbility) : null;
    if (!Object.keys(slots).length && Object.keys(slotsOpt).length) {
      var castingSub = subclasses.filter(function (sb) {
        return Object.keys(sb.features).some(function (n) { return sb.features[n].some(function (f) { return /Spellcasting/i.test(f.name); }); });
      })[0];
      if (castingSub) {
        var sKey = 'cs-' + ed + '-' + slug(c.name) + '-' + slug(castingSub.name);
        var sList = listFromClassSpells(ed + '|' + c.name + '|' + castingSub.name);
        DND.SPELL_LISTS[sKey] = sList || JSON.parse(JSON.stringify(DND.SPELL_LISTS.wizard));
        castingSub.caster = casterFrom(slotsOpt, sKey, c.spellAbility || 'Intelligence');
      }
    }
    // Subclass expanded or always-prepared spells.
    subclasses.forEach(function (sb) {
      var extra = DND.CLASS_SPELLS[ed + '|' + c.name + '|' + sb.name];
      if (!extra) return;
      var key = 'cs-' + ed + '-' + slug(c.name) + '-' + slug(sb.name);
      DND.SPELL_LISTS[key] = listFromClassSpells(ed + '|' + c.name + '|' + sb.name);
      var mainCaster = caster || (builtin && builtin.caster);
      if (ed === '2024' && mainCaster) {
        sb.derive = function (s) {
          extra.forEach(function (names, lvl) {
            if (!names) return;
            var at = Math.max(3, DND.levelForSpell(mainCaster, lvl));
            if (s.level >= at) DND.addAlways(s, names, sb.name + ' spells');
          });
        };
      } else if (mainCaster) {
        sb.extraList = key;
      }
    });
    // Resource columns from counters.
    var columns = Object.keys(counters).map(function (name) {
      return { label: name, values: fill20(counters[name], '—').map(String) };
    });
    var prof = (c.prof || '').split(/,\s*/).map(function (x) { return x.trim(); });
    var saves = prof.map(function (p) { return ABIL_BY_NAME[lc(p)]; }).filter(Boolean);
    var skillList = prof.map(function (p) { return SKILL_BY_NAME[lc(p)]; }).filter(Boolean);
    var armor = [];
    if (/light/i.test(c.armor)) armor.push('light');
    if (/medium/i.test(c.armor)) armor.push('medium');
    if (/heavy/i.test(c.armor)) armor.push('heavy');
    if (/shield/i.test(c.armor)) armor.push('shield');
    var weapons = (c.weapons || '').split(/,\s*/).map(function (w) {
      w = lc(w.trim());
      if (/^simple/.test(w)) return 'simple';
      if (/^martial/.test(w)) return 'martial';
      return w;
    }).filter(function (w) { return w && w !== 'none'; });
    var cls = {
      mc: parseMulticlass(mcText),
      id: idFor('cx-', c), name: edName('class', c), compendium: true, ed: ed, src: c.src,
      hd: c.hd, primary: c.spellAbility ? c.spellAbility + ' (spellcasting)' : 'See class description',
      saves: saves.slice(0, 2), skillCount: c.numSkills, skillList: skillList.length ? skillList : null,
      armor: armor, weapons: weapons, tools: c.tools && !/^none$/i.test(c.tools) ? [c.tools] : [],
      caster: caster, columns: columns, subclassLabel: label || 'Subclass', subclassLevel: subLevel,
      features: features, subclasses: subclasses
    };
    return cls;
  }

  function registerClasses(list) {
    list.forEach(function (c) {
      var builtin = c.ed === '2024' ? BASE.CLASSES.filter(function (b) { return b.name === c.name; })[0] : null;
      var conv = convertClass(c, builtin);
      if (builtin) {
        // 2024 subclasses use the same feature levels as the built-in classes: attach them.
        var names = builtin.subclasses.map(function (s) { return lc(s.name); });
        conv.subclasses.forEach(function (sb) {
          if (names.indexOf(lc(sb.name)) >= 0) return;
          if (sb.caster && !sb.caster.prepared) sb.caster.preparedFormula = 'third';
          builtin.subclasses.push(sb);
        });
        return;
      }
      if (!Object.keys(conv.features).some(function (n) { return conv.features[n].length; })) return;
      DND.CLASSES.push(conv);
    });
  }

  /* ---------- Registration ---------- */

  DND.registerContent = function () {
    snapshotBase();
    DND.FEATS.length = 0; BASE.FEATS.forEach(function (x) { DND.FEATS.push(x); });
    DND.SPECIES.length = 0; BASE.SPECIES.forEach(function (x) { DND.SPECIES.push(x); });
    DND.BACKGROUNDS.length = 0; BASE.BACKGROUNDS.forEach(function (x) { DND.BACKGROUNDS.push(x); });
    DND.CLASSES.length = 0; BASE.CLASSES.forEach(function (x) { DND.CLASSES.push(x); x.subclasses = BASE.SUBCLASSES[x.id].slice(); });
    DND.WEAPONS.length = 0; BASE.WEAPONS.forEach(function (x) { DND.WEAPONS.push(x); });
    DND.ARMOR.length = 0; BASE.ARMOR.forEach(function (x) { DND.ARMOR.push(x); });
    DND.SPELL_LISTS = JSON.parse(JSON.stringify(BASE.SPELL_LISTS));
    DND.SPELL_LEVEL = Object.assign({}, BASE.SPELL_LEVEL);

    var srd = DND.CONTENT.srd || { spells: [], items: [], monsters: [] };
    var user = DND.CONTENT.user;
    taken = {};
    function names2024(list) { return (list || []).filter(function (o) { return o.ed === '2024'; }).map(function (o) { return o.name; }); }
    markTaken('item', names2024(srd.items).concat(names2024(user && user.items)));
    markTaken('feat', BASE.FEATS.map(function (f) { return f.name; }).concat(names2024(user && user.feats).map(function (n) { return n.replace(/^Fighting Style:\s*/i, ''); })));
    markTaken('species', BASE.SPECIES.map(function (x) { return x.name; }).concat(names2024(user && user.races)));
    markTaken('background', BASE.BACKGROUNDS.map(function (x) { return x.name; }).concat(names2024(user && user.backgrounds)));
    markTaken('class', BASE.CLASSES.map(function (x) { return x.name; }).concat(names2024(user && user.classes)));
    registerSpells([srd.spells].concat(user ? [user.spells] : []));
    registerItems([srd.items].concat(user ? [user.items] : []));
    registerMonsters([srd.monsters].concat(user ? [user.monsters] : []));
    if (user) {
      registerFeats(user.feats);
      user.races.forEach(function (r) {
        if (r.ed === '2024' && BASE.SPECIES.some(function (b) { return lc(b.name) === lc(r.name); })) return;
        DND.SPECIES.push(convertRace(r));
      });
      user.backgrounds.forEach(function (b) {
        if (b.ed === '2024' && BASE.BACKGROUNDS.some(function (x) { return lc(x.name) === lc(b.name); })) return;
        DND.BACKGROUNDS.push(convertBackground(b));
      });
      registerClasses(user.classes);
    } else {
      DND.COMPENDIUM_FEATS = [];
    }
    DND.CONTENT.version = (DND.CONTENT.version || 0) + 1;
  };

  /* ---------- Import & storage ---------- */

  var DB_NAME = 'levelwright', STORE = 'compendium';
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!G.indexedDB) return reject(new Error('IndexedDB unavailable'));
      var req = G.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idb(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode), st = tx.objectStore(STORE), out = fn(st);
        tx.oncomplete = function () { resolve(out && out.result); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  DND.loadStoredCompendium = function () {
    return idb('readonly', function (st) { return st.get('user'); }).then(function (rec) {
      if (rec && rec.data) { DND.CONTENT.user = rec.data; DND.CONTENT.userInfo = rec.info; }
      return rec || null;
    }).catch(function () { return null; });
  };
  DND.clearCompendium = function () {
    DND.CONTENT.user = null; DND.CONTENT.userInfo = null;
    return idb('readwrite', function (st) { return st.delete('user'); }).catch(function () { return null; });
  };

  // Read File objects (.xml or .zip) and merge them into one compendium.
  DND.importFiles = function (files, progress) {
    var data = DND.FC5.emptyData(), names = [], indexFiles = [];
    var list = Array.prototype.slice.call(files);
    function readText(f) { return f.text ? f.text() : new Response(f).text(); }
    function step(i) {
      if (i >= list.length) return Promise.resolve();
      var f = list[i];
      progress && progress('Reading ' + f.name + '…');
      if (/\.zip$/i.test(f.name)) {
        if (!G.JSZip) return Promise.reject(new Error('ZIP support could not load. Unzip the file and import the .xml instead.'));
        return G.JSZip.loadAsync(f).then(function (zip) {
          var xmls = Object.keys(zip.files).filter(function (n) { return /\.xml$/i.test(n) && !zip.files[n].dir && !/__MACOSX/.test(n); });
          if (!xmls.length) throw new Error(f.name + ' has no .xml files inside.');
          return xmls.reduce(function (p, n) {
            return p.then(function () {
              progress && progress('Parsing ' + n + '…');
              return zip.files[n].async('string').then(function (s) { DND.FC5.parse(s, data); names.push(n.split('/').pop()); });
            });
          }, Promise.resolve());
        }).then(function () { return step(i + 1); });
      }
      return readText(f).then(function (s) {
        progress && progress('Parsing ' + f.name + '…');
        return new Promise(function (r) { setTimeout(r, 20); }).then(function () {
          if (/<collection[\s>]/.test(s) && /<doc\s+href=|xi:include/.test(s) && !/<(class|race|spell|item|monster|feat|background)>/.test(s)) {
            indexFiles.push(f.name);
            return;
          }
          DND.FC5.parse(s, data); names.push(f.name);
        });
      }).then(function () { return step(i + 1); });
    }
    return step(0).then(function () {
      DND.FC5.dedupe(data);
      var counts = {};
      Object.keys(data).forEach(function (k) { counts[k] = data[k].length; });
      var total = Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0);
      if (!total && indexFiles.length) throw new Error(indexFiles.join(', ') + ' only lists other files. Build it into a full compendium with the FightClub5eXML build script, or select the .xml files from its Sources folder instead.');
      if (!total) throw new Error('No compendium entries found. Use a Fight Club 5 / Game Master 5 compendium .xml file.');
      var info = { files: names, counts: counts, date: new Date().toISOString() };
      DND.CONTENT.user = data; DND.CONTENT.userInfo = info;
      progress && progress('Saving in this browser…');
      return idb('readwrite', function (st) { return st.put({ data: data, info: info }, 'user'); })
        .then(function () { info.saved = true; return info; }, function () { info.saved = false; return info; });
    });
  };

  if (G.DND_SRD_CONTENT) DND.CONTENT.srd = G.DND_SRD_CONTENT;
})(typeof window !== 'undefined' ? window : globalThis);
