/*
 * Core rules data for the D&D 2024 (SRD 5.2) character builder.
 * Descriptions are short paraphrases for quick reference, not rules text.
 */
(function (G) {
  var DND = G.DND = G.DND || {};

  DND.ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  DND.ABILITY_NAMES = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };

  DND.SKILLS = {
    acrobatics: { name: 'Acrobatics', ability: 'dex' },
    animal: { name: 'Animal Handling', ability: 'wis' },
    arcana: { name: 'Arcana', ability: 'int' },
    athletics: { name: 'Athletics', ability: 'str' },
    deception: { name: 'Deception', ability: 'cha' },
    history: { name: 'History', ability: 'int' },
    insight: { name: 'Insight', ability: 'wis' },
    intimidation: { name: 'Intimidation', ability: 'cha' },
    investigation: { name: 'Investigation', ability: 'int' },
    medicine: { name: 'Medicine', ability: 'wis' },
    nature: { name: 'Nature', ability: 'int' },
    perception: { name: 'Perception', ability: 'wis' },
    performance: { name: 'Performance', ability: 'cha' },
    persuasion: { name: 'Persuasion', ability: 'cha' },
    religion: { name: 'Religion', ability: 'int' },
    sleight: { name: 'Sleight of Hand', ability: 'dex' },
    stealth: { name: 'Stealth', ability: 'dex' },
    survival: { name: 'Survival', ability: 'wis' }
  };

  DND.profBonus = function (level) { return 2 + Math.floor((level - 1) / 4); };
  DND.mod = function (score) { return Math.floor((score - 10) / 2); };

  /* ---------- Armor & weapons ---------- */

  DND.ARMOR = [
    { id: 'none', name: 'No armor', type: 'none' },
    { id: 'padded', name: 'Padded', type: 'light', ac: 11, stealthDis: true },
    { id: 'leather', name: 'Leather', type: 'light', ac: 11 },
    { id: 'studded', name: 'Studded Leather', type: 'light', ac: 12 },
    { id: 'hide', name: 'Hide', type: 'medium', ac: 12 },
    { id: 'chainshirt', name: 'Chain Shirt', type: 'medium', ac: 13 },
    { id: 'scale', name: 'Scale Mail', type: 'medium', ac: 14, stealthDis: true },
    { id: 'breastplate', name: 'Breastplate', type: 'medium', ac: 14 },
    { id: 'halfplate', name: 'Half Plate', type: 'medium', ac: 15, stealthDis: true },
    { id: 'ringmail', name: 'Ring Mail', type: 'heavy', ac: 14, stealthDis: true },
    { id: 'chainmail', name: 'Chain Mail', type: 'heavy', ac: 16, str: 13, stealthDis: true },
    { id: 'splint', name: 'Splint', type: 'heavy', ac: 17, str: 15, stealthDis: true },
    { id: 'plate', name: 'Plate', type: 'heavy', ac: 18, str: 15, stealthDis: true }
  ];

  // props: F finesse, L light, H heavy, T thrown, 2 two-handed, V versatile, R reach, A ammunition/ranged
  function W(id, name, cat, range, dmg, type, props, mastery) {
    return { id: id, name: name, cat: cat, ranged: range === 'ranged', dmg: dmg, type: type, props: props, mastery: mastery };
  }
  DND.WEAPONS = [
    W('club', 'Club', 'simple', 'melee', '1d4', 'bludgeoning', 'L', 'Slow'),
    W('dagger', 'Dagger', 'simple', 'melee', '1d4', 'piercing', 'FLT', 'Nick'),
    W('greatclub', 'Greatclub', 'simple', 'melee', '1d8', 'bludgeoning', '2', 'Push'),
    W('handaxe', 'Handaxe', 'simple', 'melee', '1d6', 'slashing', 'LT', 'Vex'),
    W('javelin', 'Javelin', 'simple', 'melee', '1d6', 'piercing', 'T', 'Slow'),
    W('lighthammer', 'Light Hammer', 'simple', 'melee', '1d4', 'bludgeoning', 'LT', 'Nick'),
    W('mace', 'Mace', 'simple', 'melee', '1d6', 'bludgeoning', '', 'Sap'),
    W('quarterstaff', 'Quarterstaff', 'simple', 'melee', '1d6', 'bludgeoning', 'V', 'Topple'),
    W('sickle', 'Sickle', 'simple', 'melee', '1d4', 'slashing', 'L', 'Nick'),
    W('spear', 'Spear', 'simple', 'melee', '1d6', 'piercing', 'TV', 'Sap'),
    W('dart', 'Dart', 'simple', 'ranged', '1d4', 'piercing', 'FT', 'Vex'),
    W('lightcrossbow', 'Light Crossbow', 'simple', 'ranged', '1d8', 'piercing', 'A2', 'Slow'),
    W('shortbow', 'Shortbow', 'simple', 'ranged', '1d6', 'piercing', 'A2', 'Vex'),
    W('sling', 'Sling', 'simple', 'ranged', '1d4', 'bludgeoning', 'A', 'Slow'),
    W('battleaxe', 'Battleaxe', 'martial', 'melee', '1d8', 'slashing', 'V', 'Topple'),
    W('flail', 'Flail', 'martial', 'melee', '1d8', 'bludgeoning', '', 'Sap'),
    W('glaive', 'Glaive', 'martial', 'melee', '1d10', 'slashing', 'HR2', 'Graze'),
    W('greataxe', 'Greataxe', 'martial', 'melee', '1d12', 'slashing', 'H2', 'Cleave'),
    W('greatsword', 'Greatsword', 'martial', 'melee', '2d6', 'slashing', 'H2', 'Graze'),
    W('halberd', 'Halberd', 'martial', 'melee', '1d10', 'slashing', 'HR2', 'Cleave'),
    W('lance', 'Lance', 'martial', 'melee', '1d10', 'piercing', 'HR', 'Topple'),
    W('longsword', 'Longsword', 'martial', 'melee', '1d8', 'slashing', 'V', 'Sap'),
    W('maul', 'Maul', 'martial', 'melee', '2d6', 'bludgeoning', 'H2', 'Topple'),
    W('morningstar', 'Morningstar', 'martial', 'melee', '1d8', 'piercing', '', 'Sap'),
    W('pike', 'Pike', 'martial', 'melee', '1d10', 'piercing', 'HR2', 'Push'),
    W('rapier', 'Rapier', 'martial', 'melee', '1d8', 'piercing', 'F', 'Vex'),
    W('scimitar', 'Scimitar', 'martial', 'melee', '1d6', 'slashing', 'FL', 'Nick'),
    W('shortsword', 'Shortsword', 'martial', 'melee', '1d6', 'piercing', 'FL', 'Vex'),
    W('trident', 'Trident', 'martial', 'melee', '1d8', 'piercing', 'TV', 'Topple'),
    W('warhammer', 'Warhammer', 'martial', 'melee', '1d8', 'bludgeoning', 'V', 'Push'),
    W('warpick', 'War Pick', 'martial', 'melee', '1d8', 'piercing', 'V', 'Sap'),
    W('whip', 'Whip', 'martial', 'melee', '1d4', 'slashing', 'FR', 'Slow'),
    W('blowgun', 'Blowgun', 'martial', 'ranged', '1', 'piercing', 'A', 'Vex'),
    W('handcrossbow', 'Hand Crossbow', 'martial', 'ranged', '1d6', 'piercing', 'AL', 'Vex'),
    W('heavycrossbow', 'Heavy Crossbow', 'martial', 'ranged', '1d10', 'piercing', 'AH2', 'Push'),
    W('longbow', 'Longbow', 'martial', 'ranged', '1d8', 'piercing', 'AH2', 'Slow'),
    W('musket', 'Musket', 'martial', 'ranged', '1d12', 'piercing', 'A2', 'Slow'),
    W('pistol', 'Pistol', 'martial', 'ranged', '1d10', 'piercing', 'A', 'Vex')
  ];
  DND.weapon = function (id) {
    for (var i = 0; i < DND.WEAPONS.length; i++) if (DND.WEAPONS[i].id === id) return DND.WEAPONS[i];
    return null;
  };

  DND.MASTERY = {
    Cleave: 'On a hit, make a second attack against another creature within 5 ft of the first (once per turn).',
    Graze: 'On a miss, deal damage equal to the ability modifier used for the attack.',
    Nick: 'The extra Light-weapon attack can be made as part of the Attack action instead of a Bonus Action.',
    Push: 'On a hit, push a Large or smaller target up to 10 ft away.',
    Sap: 'On a hit, the target has Disadvantage on its next attack roll before your next turn.',
    Slow: 'On a hit that deals damage, reduce the target\'s Speed by 10 ft until your next turn.',
    Topple: 'On a hit, the target makes a Con save or has the Prone condition.',
    Vex: 'On a hit that deals damage, you have Advantage on your next attack roll against that target.'
  };

  /* ---------- Shared helpers for choices & effects ---------- */

  function opt(id, label, desc) { return { id: id, label: label, desc: desc || '' }; }
  DND.opt = opt;

  DND.abilityOptions = function (list) {
    return (list || DND.ABILITIES).map(function (a) { return opt(a, DND.ABILITY_NAMES[a]); });
  };
  DND.skillOptions = function (list) {
    return (list || Object.keys(DND.SKILLS)).map(function (k) { return opt(k, DND.SKILLS[k].name); });
  };

  // Increase an ability score up to a cap.
  DND.inc = function (s, ab, n, cap) {
    cap = cap || 20;
    var before = s.abilities[ab];
    s.abilities[ab] = Math.max(before, Math.min(cap, before + n));
  };
  DND.addSkill = function (s, sk, lvl, source) {
    lvl = lvl || 1;
    s.skills[sk] = Math.max(s.skills[sk] || 0, lvl);
  };
  DND.addSave = function (s, ab) { if (s.saves.indexOf(ab) < 0) s.saves.push(ab); };
  DND.addProf = function (s, kind, what) { if (s.profs[kind].indexOf(what) < 0) s.profs[kind].push(what); };
  DND.addAlways = function (s, names, source, ability) {
    names.forEach(function (n) { s.spells.always.push({ name: n, source: source, ability: ability || null }); });
  };

  // Skill choice that only offers skills you already have proficiency in (for Expertise).
  DND.expertiseChoice = function (id, label, count, pool) {
    return {
      id: id, label: label, kind: 'many', count: count,
      options: function (s) {
        return DND.skillOptions(pool).filter(function (o) { return (s.skills[o.id] || 0) >= 1; });
      },
      apply: function (s, v) { v.forEach(function (sk) { s.skills[sk] = 2; }); }
    };
  };
  DND.skillChoice = function (id, label, count, pool, source) {
    return {
      id: id, label: label, kind: 'many', count: count,
      options: function (s) {
        return DND.skillOptions(pool).map(function (o) {
          if ((s.skills[o.id] || 0) >= 1) o.unavailable = 'Already proficient';
          return o;
        });
      },
      apply: function (s, v) { v.forEach(function (sk) { DND.addSkill(s, sk, 1, source); }); }
    };
  };
  // Choose N cantrips from a class list (granted outside the normal class count).
  DND.cantripChoice = function (id, label, count, list, source, ability) {
    return {
      id: id, label: label, kind: 'many', count: count,
      options: function () { return DND.spellOptions(list, 0, 0); },
      apply: function (s, v) { v.forEach(function (n) { s.spells.always.push({ name: n, source: source, ability: ability || null, cantrip: true }); }); }
    };
  };

  /* ---------- Feats (SRD 5.2) ---------- */

  function asiChoices(cap) {
    return [
      { id: 'a', label: '+1 to', kind: 'one', options: function () { return DND.abilityOptions(); }, apply: function (s, v) { DND.inc(s, v, 1, cap); } },
      { id: 'b', label: '+1 to (pick the same ability for +2)', kind: 'one', options: function () { return DND.abilityOptions(); }, apply: function (s, v) { DND.inc(s, v, 1, cap); } }
    ];
  }
  function boonInc() {
    return [{ id: 'inc', label: '+1 to (max 30)', kind: 'one', options: function () { return DND.abilityOptions(); }, apply: function (s, v) { DND.inc(s, v, 1, 30); } }];
  }

  DND.FEATS = [
    { id: 'alert', name: 'Alert', cat: 'origin',
      desc: 'Add your Proficiency Bonus to Initiative rolls, and you can swap your Initiative with a willing ally right after rolling.',
      apply: function (s) { s.flags.alert = true; } },
    { id: 'magic-initiate', name: 'Magic Initiate', cat: 'origin', repeatable: true,
      desc: 'Learn two cantrips and one level 1 spell from the Cleric, Druid, or Wizard list. Cast the level 1 spell once per Long Rest without a slot.',
      choices: function (param) {
        var list = [];
        if (!param || !param.list) list.push({ id: 'list', label: 'Spell list', kind: 'one', options: [opt('cleric', 'Cleric'), opt('druid', 'Druid'), opt('wizard', 'Wizard')] });
        function L(get) { return (param && param.list) || get('list') || 'wizard'; }
        list.push({ id: 'cantrips', label: 'Cantrips', kind: 'many', count: 2,
          options: function (s, get) { return DND.spellOptions(L(get), 0, 0); },
          apply: function (s, v, get) { v.forEach(function (n) { s.spells.always.push({ name: n, source: 'Magic Initiate', cantrip: true }); }); } });
        list.push({ id: 'spell', label: 'Level 1 spell', kind: 'one',
          options: function (s, get) { return DND.spellOptions(L(get), 1, 1); },
          apply: function (s, v) { s.spells.always.push({ name: v, source: 'Magic Initiate (1/Long Rest free)' }); } });
        return list;
      } },
    { id: 'savage-attacker', name: 'Savage Attacker', cat: 'origin',
      desc: 'Once per turn when you hit with a weapon, roll the damage dice twice and use either roll.' },
    { id: 'skilled', name: 'Skilled', cat: 'origin', repeatable: true,
      desc: 'Gain proficiency in any combination of three skills or tools.',
      choices: function () { return [DND.skillChoice('skills', 'Skills', 3, null, 'Skilled')]; } },
    { id: 'asi', name: 'Ability Score Improvement', cat: 'general', repeatable: true,
      desc: 'Increase one ability score by 2, or two ability scores by 1 (max 20).',
      choices: function () { return asiChoices(20); } },
    { id: 'grappler', name: 'Grappler', cat: 'general', minLevel: 4, prereq: { str: 13, dex: 13, any: true },
      desc: '+1 Str or Dex. Punch and grab in one attack, Advantage on attacks vs. creatures you grapple, and no extra movement cost to drag them.',
      choices: function () {
        return [{ id: 'inc', label: '+1 to', kind: 'one', options: function () { return DND.abilityOptions(['str', 'dex']); }, apply: function (s, v) { DND.inc(s, v, 1, 20); } }];
      } },
    { id: 'archery', name: 'Archery', cat: 'style', desc: '+2 bonus to attack rolls with Ranged weapons.', apply: function (s) { s.flags.archery = true; } },
    { id: 'defense', name: 'Defense', cat: 'style', desc: '+1 AC while wearing Light, Medium, or Heavy armor.', apply: function (s) { s.flags.defense = true; } },
    { id: 'gwf', name: 'Great Weapon Fighting', cat: 'style', desc: 'Treat any 1 or 2 on a damage die as a 3 with Two-Handed or Versatile (two-handed) melee weapons.' },
    { id: 'twf', name: 'Two-Weapon Fighting', cat: 'style', desc: 'Add your ability modifier to the damage of the extra Light-weapon attack.' },
    { id: 'boon-combat', name: 'Boon of Combat Prowess', cat: 'epic', minLevel: 19, desc: '+1 to one ability (max 30). Once per turn, turn a missed attack into a hit.', choices: boonInc },
    { id: 'boon-dimensional', name: 'Boon of Dimensional Travel', cat: 'epic', minLevel: 19, desc: '+1 to one ability (max 30). After the Attack or Magic action, teleport up to 30 ft.', choices: boonInc },
    { id: 'boon-fate', name: 'Boon of Fate', cat: 'epic', minLevel: 19, desc: '+1 to one ability (max 30). Add or subtract 2d4 from a nearby d20 Test (recharges on Initiative or rest).', choices: boonInc },
    { id: 'boon-offense', name: 'Boon of Irresistible Offense', cat: 'epic', minLevel: 19, desc: '+1 Str, Dex or Con (max 30). Your bludgeoning/piercing/slashing ignores Resistance; a 20 deals extra damage equal to the raised score.',
      choices: function () { return [{ id: 'inc', label: '+1 to (max 30)', kind: 'one', options: function () { return DND.abilityOptions(['str', 'dex', 'con']); }, apply: function (s, v) { DND.inc(s, v, 1, 30); } }]; } },
    { id: 'boon-recall', name: 'Boon of Spell Recall', cat: 'epic', minLevel: 19, desc: '+1 Int, Wis or Cha (max 30). Once per Long Rest, cast a level 1–4 spell without spending the slot.',
      choices: function () { return [{ id: 'inc', label: '+1 to (max 30)', kind: 'one', options: function () { return DND.abilityOptions(['int', 'wis', 'cha']); }, apply: function (s, v) { DND.inc(s, v, 1, 30); } }]; } },
    { id: 'boon-night', name: 'Boon of the Night Spirit', cat: 'epic', minLevel: 19, desc: '+1 to one ability (max 30). Become Invisible in Dim Light or Darkness; Resistance to all damage except Psychic and Radiant there.', choices: boonInc },
    { id: 'boon-truesight', name: 'Boon of Truesight', cat: 'epic', minLevel: 19, desc: '+1 to one ability (max 30). Gain Truesight 60 ft.', choices: boonInc,
      apply: function (s) { s.senses.push('Truesight 60 ft'); } }
  ];
  DND.feat = function (id) {
    for (var i = 0; i < DND.FEATS.length; i++) if (DND.FEATS[i].id === id) return DND.FEATS[i];
    return null;
  };

  function featMeetsPrereq(f, s, level) {
    if (f.minLevel && level < f.minLevel) return false;
    if (f.prereq) {
      var ok = false, all = true;
      for (var k in f.prereq) {
        if (k === 'any') continue;
        if (s.abilities[k] >= f.prereq[k]) ok = true; else all = false;
      }
      return f.prereq.any ? ok : all;
    }
    return true;
  }

  // Turn a feat into a choice option, wiring up its sub-choices and effect.
  DND.featOption = function (f, param, source) {
    return {
      id: f.id, label: f.name, desc: f.desc, group: f.compendium ? (f.cat === 'legacy' ? 'Compendium feats (2014)' : 'Compendium feats') : '',
      choices: f.choices ? f.choices(param) : null,
      apply: function (s) {
        if (!f.repeatable && s.feats.some(function (x) { return x.id === f.id; }))
          s.warnings.push(f.name + ' was taken more than once but is not repeatable.');
        s.feats.push({ id: f.id, name: f.name, desc: f.desc, source: source });
        if (f.apply) f.apply(s, param);
      }
    };
  };

  // A feat choice slot. cats: categories allowed. Options always include all feats
  // in those categories; ones you don't qualify for are flagged.
  DND.featChoice = function (id, label, cats, source) {
    return {
      id: id, label: label, kind: 'one',
      options: function (s) {
        return DND.FEATS.filter(function (f) { return cats.indexOf(f.cat) >= 0; }).map(function (f) {
          var o = DND.featOption(f, null, source);
          if (f.cat === 'style' && !s.flags.fightingStyle) o.unavailable = 'Requires the Fighting Style feature';
          else if (!featMeetsPrereq(f, s, s.level)) o.unavailable = f.minLevel && s.level < f.minLevel ? 'Requires level ' + f.minLevel : f.prereqText ? 'Requires ' + f.prereqText : 'Requires Str or Dex 13';
          return o;
        });
      }
    };
  };
  DND.generalFeatChoice = function (source) {
    return DND.featChoice('feat', 'Feat (Ability Score Improvement or another feat)', ['general', 'origin', 'style', 'legacy'], source || 'Class');
  };
  DND.epicFeatChoice = function () {
    return DND.featChoice('feat', 'Epic Boon (or another feat)', ['epic', 'general', 'origin', 'style', 'legacy'], 'Epic Boon');
  };
  DND.styleFeatChoice = function (id, label) {
    return DND.featChoice(id || 'style', label || 'Fighting Style feat', ['style'], 'Fighting Style');
  };

  /* ---------- Species (SRD 5.2) ---------- */

  // Lineage spells unlock at character levels 1, 3 and 5; the engine adds them per level.
  function spellLineage(lv1Cantrip, lv3, lv5) {
    return function (s) { s.lineageSpells = [lv1Cantrip, lv3, lv5]; };
  }

  DND.SPECIES = [
    { id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 30, darkvision: 60,
      traits: [
        ['Draconic Ancestry', 'Your dragon ancestor sets your Breath Weapon and resistance damage type.'],
        ['Breath Weapon', 'Replace one attack with a 15-ft cone or 30-ft line exhalation (Dex save, 1d10 scaling to 4d10 at level 17). Uses = Proficiency Bonus per Long Rest.'],
        ['Damage Resistance', 'Resistance to your ancestry\'s damage type.'],
        ['Draconic Flight (level 5)', 'Once per Long Rest, sprout spectral wings for 10 minutes and gain a Fly Speed equal to your Speed.']
      ],
      choices: [{ id: 'ancestry', label: 'Draconic Ancestry', kind: 'one',
        options: [opt('black', 'Black (Acid)'), opt('blue', 'Blue (Lightning)'), opt('brass', 'Brass (Fire)'), opt('bronze', 'Bronze (Lightning)'), opt('copper', 'Copper (Acid)'),
          opt('gold', 'Gold (Fire)'), opt('green', 'Green (Poison)'), opt('red', 'Red (Fire)'), opt('silver', 'Silver (Cold)'), opt('white', 'White (Cold)')],
        apply: function (s, v, get, o) { s.resist.push(o.label.replace(/.*\((.*)\)/, '$1')); } }],
      derive: function (s) {
        var d = s.level >= 17 ? 4 : s.level >= 11 ? 3 : s.level >= 5 ? 2 : 1;
        s.notes.push('Breath Weapon: ' + d + 'd10, DC 8 + Con mod + PB');
      } },
    { id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 30, darkvision: 120,
      traits: [
        ['Dwarven Resilience', 'Resistance to Poison damage and Advantage on saves to avoid or end the Poisoned condition.'],
        ['Dwarven Toughness', 'Your Hit Point maximum increases by 1 per character level.'],
        ['Stonecunning', 'As a Bonus Action, gain Tremorsense 60 ft for 10 minutes while on or touching stone. Uses = PB per Long Rest.']
      ],
      apply: function (s) { s.resist.push('Poison'); s.hpPerLevel += 1; } },
    { id: 'elf', name: 'Elf', size: 'Medium', speed: 30, darkvision: 60,
      traits: [
        ['Elven Lineage', 'Drow, High Elf, or Wood Elf: grants a cantrip at level 1 and spells at levels 3 and 5.'],
        ['Fey Ancestry', 'Advantage on saves to avoid or end the Charmed condition.'],
        ['Keen Senses', 'Proficiency in Insight, Perception, or Survival.'],
        ['Trance', 'You don\'t need sleep; a Long Rest takes 4 hours of meditation.']
      ],
      choices: [
        { id: 'lineage', label: 'Elven Lineage', kind: 'one',
          options: [opt('drow', 'Drow', 'Darkvision 120 ft; Dancing Lights, Faerie Fire (3), Darkness (5).'),
            opt('high', 'High Elf', 'Prestidigitation (swap after a Long Rest), Detect Magic (3), Misty Step (5).'),
            opt('wood', 'Wood Elf', 'Speed 35 ft; Druidcraft, Longstrider (3), Pass without Trace (5).')],
          apply: function (s, v) {
            if (v === 'drow') { s.darkvision = 120; spellLineage('Dancing Lights', 'Faerie Fire', 'Darkness')(s); }
            if (v === 'high') spellLineage('Prestidigitation', 'Detect Magic', 'Misty Step')(s);
            if (v === 'wood') { s.speed += 5; spellLineage('Druidcraft', 'Longstrider', 'Pass without Trace')(s); }
          } },
        DND.skillChoice('keen', 'Keen Senses skill', 1, ['insight', 'perception', 'survival'], 'Keen Senses')
      ] },
    { id: 'gnome', name: 'Gnome', size: 'Small', speed: 30, darkvision: 60,
      traits: [
        ['Gnomish Cunning', 'Advantage on Int, Wis, and Cha saving throws.'],
        ['Gnomish Lineage', 'Forest Gnome (Minor Illusion, Speak with Animals) or Rock Gnome (Mending, Prestidigitation, tinker clockwork devices).']
      ],
      choices: [{ id: 'lineage', label: 'Gnomish Lineage', kind: 'one',
        options: [opt('forest', 'Forest Gnome', 'Minor Illusion; Speak with Animals free PB times per Long Rest.'), opt('rock', 'Rock Gnome', 'Mending and Prestidigitation; build tiny clockwork devices.')],
        apply: function (s, v) {
          if (v === 'forest') DND.addAlways(s, ['Minor Illusion', 'Speak with Animals'], 'Forest Gnome');
          else DND.addAlways(s, ['Mending', 'Prestidigitation'], 'Rock Gnome');
        } }] },
    { id: 'goliath', name: 'Goliath', size: 'Medium', speed: 35, darkvision: 0,
      traits: [
        ['Giant Ancestry', 'A supernatural boon from your giant ancestors, usable PB times per Long Rest.'],
        ['Large Form (level 5)', 'Once per Long Rest, become Large for 10 minutes: Advantage on Str checks and +10 ft Speed.'],
        ['Powerful Build', 'Advantage on checks to end the Grappled condition; count as one size larger for carrying.']
      ],
      choices: [{ id: 'ancestry', label: 'Giant Ancestry', kind: 'one',
        options: [opt('cloud', "Cloud's Jaunt", 'Bonus Action teleport 30 ft.'), opt('fire', "Fire's Burn", '+1d10 Fire damage on a hit.'),
          opt('frost', "Frost's Chill", '+1d6 Cold damage and -10 ft Speed on a hit.'), opt('hill', "Hill's Tumble", 'Knock a Large or smaller target Prone on a hit.'),
          opt('stone', "Stone's Endurance", 'Reaction to reduce damage by 1d12 + Con mod.'), opt('storm', "Storm's Thunder", 'Reaction to deal 1d8 Thunder damage to an attacker within 60 ft.')] }] },
    { id: 'halfling', name: 'Halfling', size: 'Small', speed: 30, darkvision: 0,
      traits: [
        ['Brave', 'Advantage on saves to avoid or end the Frightened condition.'],
        ['Halfling Nimbleness', 'Move through the space of any creature larger than you.'],
        ['Luck', 'Reroll a 1 on a d20 Test; you must use the new roll.'],
        ['Naturally Stealthy', 'You can take the Hide action when obscured only by a creature larger than you.']
      ] },
    { id: 'human', name: 'Human', size: 'Medium or Small', speed: 30, darkvision: 0,
      traits: [
        ['Resourceful', 'Gain Heroic Inspiration whenever you finish a Long Rest.'],
        ['Skillful', 'Proficiency in one skill of your choice.'],
        ['Versatile', 'Gain an Origin feat of your choice.']
      ],
      choices: [
        DND.skillChoice('skill', 'Skillful', 1, null, 'Skillful'),
        DND.featChoice('feat', 'Versatile (Origin feat)', ['origin'], 'Human')
      ] },
    { id: 'orc', name: 'Orc', size: 'Medium', speed: 30, darkvision: 120,
      traits: [
        ['Adrenaline Rush', 'Take the Dash action as a Bonus Action and gain Temp HP equal to your PB. Uses = PB per Short or Long Rest.'],
        ['Relentless Endurance', 'Once per Long Rest, when reduced to 0 HP but not killed, drop to 1 HP instead.']
      ] },
    { id: 'tiefling', name: 'Tiefling', size: 'Medium or Small', speed: 30, darkvision: 60,
      traits: [
        ['Fiendish Legacy', 'Abyssal, Chthonic, or Infernal: grants a resistance, a cantrip, and spells at levels 3 and 5.'],
        ['Otherworldly Presence', 'You know the Thaumaturgy cantrip.']
      ],
      choices: [{ id: 'legacy', label: 'Fiendish Legacy', kind: 'one',
        options: [opt('abyssal', 'Abyssal', 'Poison resistance; Poison Spray, Ray of Sickness (3), Hold Person (5).'),
          opt('chthonic', 'Chthonic', 'Necrotic resistance; Chill Touch, False Life (3), Ray of Enfeeblement (5).'),
          opt('infernal', 'Infernal', 'Fire resistance; Fire Bolt, Hellish Rebuke (3), Darkness (5).')],
        apply: function (s, v) {
          if (v === 'abyssal') { s.resist.push('Poison'); spellLineage('Poison Spray', 'Ray of Sickness', 'Hold Person')(s); }
          if (v === 'chthonic') { s.resist.push('Necrotic'); spellLineage('Chill Touch', 'False Life', 'Ray of Enfeeblement')(s); }
          if (v === 'infernal') { s.resist.push('Fire'); spellLineage('Fire Bolt', 'Hellish Rebuke', 'Darkness')(s); }
        } }],
      apply: function (s) { DND.addAlways(s, ['Thaumaturgy'], 'Otherworldly Presence'); } }
  ];

  /* ---------- Backgrounds (SRD 5.2) ---------- */

  DND.BACKGROUNDS = [
    { id: 'acolyte', name: 'Acolyte', abilities: ['int', 'wis', 'cha'], feat: { id: 'magic-initiate', list: 'cleric' }, featName: 'Magic Initiate (Cleric)',
      skills: ['insight', 'religion'], tool: "Calligrapher's Supplies" },
    { id: 'criminal', name: 'Criminal', abilities: ['dex', 'con', 'int'], feat: { id: 'alert' }, featName: 'Alert',
      skills: ['sleight', 'stealth'], tool: "Thieves' Tools" },
    { id: 'sage', name: 'Sage', abilities: ['con', 'int', 'wis'], feat: { id: 'magic-initiate', list: 'wizard' }, featName: 'Magic Initiate (Wizard)',
      skills: ['arcana', 'history'], tool: "Calligrapher's Supplies" },
    { id: 'soldier', name: 'Soldier', abilities: ['str', 'dex', 'con'], feat: { id: 'savage-attacker' }, featName: 'Savage Attacker',
      skills: ['athletics', 'intimidation'], tool: 'Gaming Set' },
    { id: 'custom', name: 'Custom background', custom: true, abilities: null, tool: 'Any one tool',
      desc: 'Pick any three abilities, an Origin feat, and two skills. Useful for testing backgrounds outside the SRD.' }
  ];

  DND.POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  DND.STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

  /* ---------- Spellcasting tables ---------- */

  DND.SLOTS = {
    full: [
      [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
      [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
      [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]
    ],
    half: [
      [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
      [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]
    ]
  };
  DND.PACT = {
    slots: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4],
    level: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
  };
})(typeof window !== 'undefined' ? window : globalThis);
