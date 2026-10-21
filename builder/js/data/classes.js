/*
 * Class data: the 12 classes of the 2024 rules with their SRD 5.2 subclasses.
 * Feature descriptions are short paraphrases for quick reference.
 */
(function (G) {
  var DND = G.DND = G.DND || {};
  var opt = DND.opt;

  function F(name, desc, extra) {
    var f = { name: name, desc: desc };
    for (var k in extra || {}) f[k] = extra[k];
    return f;
  }
  function col(label, values) { return { label: label, values: values }; }
  function byTier(pairs) { // [[fromLevel, value], ...] -> 20 values
    var out = [];
    for (var l = 1; l <= 20; l++) {
      var v = '';
      pairs.forEach(function (p) { if (l >= p[0]) v = p[1]; });
      out.push(v);
    }
    return out;
  }

  function ASI() {
    return F('Ability Score Improvement', 'Gain the Ability Score Improvement feat or another feat you qualify for.', { choices: [DND.generalFeatChoice('Ability Score Improvement')] });
  }
  function BOON() {
    return F('Epic Boon', 'Gain an Epic Boon feat or another feat you qualify for.', { choices: [DND.epicFeatChoice()] });
  }
  function SUB() { return { subclassSlot: true }; }

  function weaponFilter(kind) {
    return function (w) {
      if (kind === 'melee') return !w.ranged;
      if (kind === 'rogue') return w.cat === 'simple' || /[FL]/.test(w.props);
      return true;
    };
  }
  function MASTERY(count, kind, more) {
    return F(more ? 'Weapon Mastery (+' + count + ')' : 'Weapon Mastery',
      more ? 'You can use the mastery property of one more kind of weapon.' :
        'Use the mastery properties of ' + count + ' kinds of weapons you\'re proficient with. You can change one choice after a Long Rest.', {
        choices: [{
          id: 'weapons', label: 'Mastered weapons', kind: 'many', count: count,
          options: function (s) {
            return DND.WEAPONS.filter(weaponFilter(kind)).map(function (w) {
              var o = opt(w.id, w.name + ' (' + w.mastery + ')', DND.MASTERY[w.mastery]);
              if (s.masteries.indexOf(w.id) >= 0) o.unavailable = 'Already mastered';
              return o;
            });
          },
          apply: function (s, v) { v.forEach(function (id) { s.masteries.push(id); }); }
        }]
      });
  }
  function EXTRA_ATTACK(n) {
    var names = ['Extra Attack', 'Two Extra Attacks', 'Three Extra Attacks'];
    return F(names[n - 1], 'Attack ' + (n + 1) + ' times instead of once when you take the Attack action.', { apply: function (s) { s.attacks = Math.max(s.attacks, n + 1); } });
  }
  // Always-prepared subclass spells unlocked at class levels.
  function subSpells(table, source) {
    return function (s) {
      Object.keys(table).forEach(function (lvl) {
        if (s.level >= +lvl) DND.addAlways(s, table[lvl], source);
      });
    };
  }
  function damageTypeChoice(id, label, types, apply) {
    return { id: id, label: label, kind: 'one', options: types.map(function (t) { return opt(t, t); }), apply: apply };
  }

  var CANTRIPS_2_3_4 = byTier([[1, 2], [4, 3], [10, 4]]);
  var CANTRIPS_3_4_5 = byTier([[1, 3], [4, 4], [10, 5]]);
  var PREP_FULL = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
  var PREP_HALF = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];

  DND.CLASSES = [];

  /* ======================= BARBARIAN ======================= */
  DND.CLASSES.push({
    id: 'barbarian', name: 'Barbarian', hd: 12, primary: 'Strength',
    saves: ['str', 'con'], skillCount: 2, skillList: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], tools: [],
    columns: [
      col('Rages', byTier([[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]])),
      col('Rage Damage', byTier([[1, '+2'], [9, '+3'], [16, '+4']])),
      col('Weapon Mastery', byTier([[1, 2], [4, 3], [10, 4]]))
    ],
    subclassLabel: 'Barbarian Subclass', subclassLevel: 3,
    features: {
      1: [F('Rage', 'Bonus Action: Advantage on Str checks and saves, bonus Rage Damage on Str-based attacks, and Resistance to Bludgeoning, Piercing, and Slashing. Lasts up to 10 minutes if you keep it going; no spellcasting or Concentration.'),
        F('Unarmored Defense', 'While not wearing armor, your AC equals 10 + Dex mod + Con mod. You can still use a Shield.', { apply: function (s) { s.unarmored.push('con'); } }),
        MASTERY(2, 'melee')],
      2: [F('Danger Sense', 'Advantage on Dexterity saving throws unless you have the Incapacitated condition.'),
        F('Reckless Attack', 'Gain Advantage on Str-based attack rolls this turn; attack rolls against you have Advantage until your next turn.')],
      3: [SUB(3), F('Primal Knowledge', 'Gain proficiency in one more Barbarian skill. While raging, you can make Acrobatics, Intimidation, Perception, Stealth, and Survival checks with Strength.', {
        choices: [DND.skillChoice('skill', 'Barbarian skill', 1, ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'], 'Primal Knowledge')] })],
      4: [ASI(), MASTERY(1, 'melee', true)],
      5: [EXTRA_ATTACK(1), F('Fast Movement', 'Your Speed increases by 10 ft while you aren\'t wearing Heavy armor.', { apply: function (s) { s.speedNoHeavy += 10; } })],
      7: [F('Feral Instinct', 'Advantage on Initiative rolls.'), F('Instinctive Pounce', 'When you enter your Rage, you can move up to half your Speed.')],
      8: [ASI()],
      9: [F('Brutal Strike', 'When you use Reckless Attack, you can forgo Advantage on one Str attack: on a hit it deals +1d10 and applies Forceful Blow (push 15 ft) or Hamstring Blow (−15 ft Speed).')],
      10: [MASTERY(1, 'melee', true)],
      11: [F('Relentless Rage', 'While raging, if you drop to 0 HP you can make a DC 10 Con save to drop to 1 HP instead (DC +5 per use until you rest).')],
      12: [ASI()],
      13: [F('Improved Brutal Strike', 'New Brutal Strike options: Staggering Blow (Disadvantage on the next save) and Sundering Blow (+5 to the next ally\'s attack).')],
      15: [F('Persistent Rage', 'Regain all Rage uses when you roll Initiative (once per Long Rest), and your Rage lasts 10 minutes without needing to extend it.')],
      16: [ASI()],
      17: [F('Improved Brutal Strike', 'Brutal Strike deals +2d10, and you can apply two different effects.')],
      18: [F('Indomitable Might', 'If a Strength check or save total is less than your Strength score, use the score instead.')],
      19: [BOON()],
      20: [F('Primal Champion', 'Your Strength and Constitution scores increase by 4, to a maximum of 25.', {
        apply: function (s) { DND.inc(s, 'str', 4, 25); DND.inc(s, 'con', 4, 25); } })]
    },
    subclasses: [{
      id: 'berserker', name: 'Path of the Berserker', desc: 'Channel Rage into violent fury.',
      features: {
        3: [F('Frenzy', 'If you use Reckless Attack while raging, the first Str hit on your turn deals extra damage: a number of d6s equal to your Rage Damage bonus.')],
        6: [F('Mindless Rage', 'Immunity to Charmed and Frightened while raging; those conditions end when you enter a Rage.')],
        10: [F('Retaliation', 'When a creature within 5 ft damages you, use your Reaction to make a melee attack against it.')],
        14: [F('Intimidating Presence', 'Bonus Action: creatures of your choice in a 30-ft Emanation make a Wis save or are Frightened for 1 minute. Once per Long Rest, or spend a Rage use.')]
      }
    }]
  });

  /* ======================= BARD ======================= */
  DND.CLASSES.push({
    id: 'bard', name: 'Bard', hd: 8, primary: 'Charisma',
    saves: ['dex', 'cha'], skillCount: 3, skillList: null,
    armor: ['light'], weapons: ['simple'], tools: ['Three Musical Instruments'],
    caster: { type: 'full', ability: 'cha', list: 'bard', cantrips: CANTRIPS_2_3_4, prepared: PREP_FULL },
    columns: [col('Bardic Die', byTier([[1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']]))],
    subclassLabel: 'Bard Subclass (College)', subclassLevel: 3,
    features: {
      1: [F('Bardic Inspiration', 'Bonus Action: give a creature within 60 ft a Bardic Inspiration die to add to a failed d20 Test within the next hour. Uses = Cha mod (min 1) per Long Rest.'),
        F('Spellcasting', 'Cast Bard spells using Charisma with a Musical Instrument as your focus. Change one prepared spell whenever you gain a level.')],
      2: [F('Expertise', 'Gain Expertise in two skills you\'re proficient in.', { choices: [DND.expertiseChoice('skills', 'Expertise skills', 2)] }),
        F('Jack of All Trades', 'Add half your Proficiency Bonus (rounded down) to ability checks that don\'t already use your proficiency.', { apply: function (s) { s.flags.jack = true; } })],
      3: [SUB(3)],
      4: [ASI()],
      5: [F('Font of Inspiration', 'Regain all Bardic Inspiration on a Short or Long Rest, and expend a spell slot to regain one use.')],
      7: [F('Countercharm', 'Reaction: a creature within 30 ft that fails a save against Charmed or Frightened can reroll with Advantage.')],
      8: [ASI()],
      9: [F('Expertise', 'Gain Expertise in two more skills you\'re proficient in.', { choices: [DND.expertiseChoice('skills', 'Expertise skills', 2)] })],
      10: [F('Magical Secrets', 'Your prepared spells can come from the Bard, Cleric, Druid, and Wizard spell lists; they count as Bard spells.', {
        apply: function (s) { s.spells.extraLists = ['cleric', 'druid', 'wizard']; s.spells.extraListsFor = s.curClassId; } })],
      12: [ASI()],
      16: [ASI()],
      18: [F('Superior Inspiration', 'When you roll Initiative, regain Bardic Inspiration uses until you have two if you have fewer.')],
      19: [BOON()],
      20: [F('Words of Creation', 'Always have Power Word Heal and Power Word Kill prepared, and each can target a second creature within 10 ft of the first.', {
        apply: function (s) { DND.addAlways(s, ['Power Word Heal', 'Power Word Kill'], 'Words of Creation'); } })]
    },
    subclasses: [{
      id: 'lore', name: 'College of Lore', desc: 'Plumb the depths of magical knowledge.',
      features: {
        3: [F('Bonus Proficiencies', 'Gain proficiency with three skills of your choice.', { choices: [DND.skillChoice('skills', 'Skills', 3, null, 'College of Lore')] }),
          F('Cutting Words', 'Reaction: when a creature within 60 ft makes a damage roll or succeeds on an ability check or attack roll, expend Bardic Inspiration to subtract the die from it.')],
        6: [F('Magical Discoveries', 'Learn two spells from the Cleric, Druid, or Wizard lists (cantrip or a level you can cast). They\'re always prepared.', {
          choices: [{ id: 'spells', label: 'Discovered spells', kind: 'many', count: 2,
            options: function () { return DND.spellOptions(['cleric', 'druid', 'wizard'], 0, 3); },
            apply: function (s, v) { DND.addAlways(s, v, 'Magical Discoveries'); } }] })],
        14: [F('Peerless Skill', 'When you fail an ability check or attack roll, add a Bardic Inspiration die; it\'s only expended if you then succeed.')]
      }
    }]
  });

  /* ======================= CLERIC ======================= */
  DND.CLASSES.push({
    id: 'cleric', name: 'Cleric', hd: 8, primary: 'Wisdom',
    saves: ['wis', 'cha'], skillCount: 2, skillList: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    armor: ['light', 'medium', 'shield'], weapons: ['simple'], tools: [],
    caster: { type: 'full', ability: 'wis', list: 'cleric', cantrips: CANTRIPS_3_4_5, prepared: PREP_FULL },
    columns: [col('Channel Divinity', byTier([[1, '—'], [2, 2], [6, 3], [18, 4]]))],
    subclassLabel: 'Cleric Subclass (Domain)', subclassLevel: 3,
    features: {
      1: [F('Spellcasting', 'Cast Cleric spells using Wisdom with a Holy Symbol as your focus. Change your prepared list after a Long Rest.'),
        F('Divine Order', 'Dedicate yourself to a sacred role.', { choices: [{ id: 'order', label: 'Divine Order', kind: 'one',
          options: [opt('protector', 'Protector', 'Proficiency with Martial weapons and Heavy armor.'),
            opt('thaumaturge', 'Thaumaturge', 'One extra Cleric cantrip, and add your Wis mod (min +1) to Arcana and Religion checks.')],
          apply: function (s, v) {
            if (v === 'protector') { DND.addProf(s, 'weapons', 'martial'); DND.addProf(s, 'armor', 'heavy'); }
            else { s.spells.bonusCantrips += 1; s.spells.bonusCantripsFor = s.curClassId; s.skillBonus.push({ skills: ['arcana', 'religion'], ability: 'wis', min: 1 }); }
          } }] })],
      2: [F('Channel Divinity', 'Channel divine energy for Divine Spark (heal or deal 1d8 Necrotic/Radiant, scaling at 7, 13, 18) or Turn Undead. Regain one use on a Short Rest.')],
      3: [SUB(3)],
      4: [ASI()],
      5: [F('Sear Undead', 'When you Turn Undead, roll d8s equal to your Wis mod (min 1) and deal that much Radiant damage to each Undead that fails.')],
      7: [F('Blessed Strikes', 'Divine power infuses you in battle.', { choices: [{ id: 'strikes', label: 'Blessed Strikes', kind: 'one',
        options: [opt('divine', 'Divine Strike', 'Once per turn, a weapon hit deals +1d8 Necrotic or Radiant damage.'), opt('potent', 'Potent Spellcasting', 'Add your Wis mod to damage dealt with Cleric cantrips.')],
        apply: function (s, v) { s.flags.blessedStrikes = v; } }] })],
      8: [ASI()],
      10: [F('Divine Intervention', 'Once per Long Rest, cast any Cleric spell of level 5 or lower without a slot or Material components.')],
      12: [ASI()],
      14: [F('Improved Blessed Strikes', 'Divine Strike deals 2d8, or Potent Spellcasting grants Temp HP equal to twice your Wis mod when you deal cantrip damage.')],
      16: [ASI()],
      19: [BOON()],
      20: [F('Greater Divine Intervention', 'Divine Intervention can cast Wish; afterward you can\'t use Divine Intervention for 2d4 Long Rests.')]
    },
    subclasses: [{
      id: 'life', name: 'Life Domain', desc: 'Soothe the hurts of the world.',
      derive: subSpells({ 3: ['Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration'], 5: ['Mass Healing Word', 'Revivify'], 7: ['Aura of Life', 'Death Ward'], 9: ['Greater Restoration', 'Mass Cure Wounds'] }, 'Life Domain Spells'),
      features: {
        3: [F('Disciple of Life', 'When a spell you cast with a slot restores HP, the creature regains extra HP equal to 2 + the slot\'s level.'),
          F('Life Domain Spells', 'Always have Life Domain spells prepared: Aid, Bless, Cure Wounds, Lesser Restoration (3); Mass Healing Word, Revivify (5); Aura of Life, Death Ward (7); Greater Restoration, Mass Cure Wounds (9).'),
          F('Preserve Life', 'Channel Divinity: restore HP equal to 5 × Cleric level, divided among Bloodied creatures within 30 ft (up to half their max).')],
        6: [F('Blessed Healer', 'When you restore HP to another creature with a slot spell, you regain 2 + the slot\'s level HP.')],
        17: [F('Supreme Healing', 'When you roll dice to restore HP with a spell or Channel Divinity, use the highest number possible on each die.')]
      }
    }]
  });

  /* ======================= DRUID ======================= */
  var LAND = {
    arid: { name: 'Arid', table: { 3: ['Blur', 'Burning Hands', 'Fire Bolt'], 5: ['Fireball'], 7: ['Blight'], 9: ['Wall of Stone'] }, dmg: 'Fire' },
    polar: { name: 'Polar', table: { 3: ['Fog Cloud', 'Hold Person', 'Ray of Frost'], 5: ['Sleet Storm'], 7: ['Ice Storm'], 9: ['Cone of Cold'] }, dmg: 'Cold' },
    temperate: { name: 'Temperate', table: { 3: ['Misty Step', 'Shocking Grasp', 'Sleep'], 5: ['Lightning Bolt'], 7: ['Freedom of Movement'], 9: ['Tree Stride'] }, dmg: 'Lightning' },
    tropical: { name: 'Tropical', table: { 3: ['Acid Splash', 'Ray of Sickness', 'Web'], 5: ['Stinking Cloud'], 7: ['Polymorph'], 9: ['Insect Plague'] }, dmg: 'Poison' }
  };
  DND.CLASSES.push({
    id: 'druid', name: 'Druid', hd: 8, primary: 'Wisdom',
    saves: ['int', 'wis'], skillCount: 2, skillList: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    armor: ['light', 'shield'], weapons: ['simple'], tools: ['Herbalism Kit'],
    caster: { type: 'full', ability: 'wis', list: 'druid', cantrips: CANTRIPS_2_3_4, prepared: PREP_FULL },
    columns: [col('Wild Shape', byTier([[1, '—'], [2, 2], [6, 3], [17, 4]]))],
    subclassLabel: 'Druid Subclass (Circle)', subclassLevel: 3,
    features: {
      1: [F('Spellcasting', 'Cast Druid spells using Wisdom with a Druidic Focus. Change your prepared list after a Long Rest.'),
        F('Druidic', 'You know Druidic and always have Speak with Animals prepared.', { apply: function (s) { DND.addAlways(s, ['Speak with Animals'], 'Druidic'); } }),
        F('Primal Order', 'Dedicate yourself to a sacred role.', { choices: [{ id: 'order', label: 'Primal Order', kind: 'one',
          options: [opt('magician', 'Magician', 'One extra Druid cantrip, and add your Wis mod (min +1) to Arcana and Nature checks.'),
            opt('warden', 'Warden', 'Proficiency with Martial weapons and Medium armor.')],
          apply: function (s, v) {
            if (v === 'warden') { DND.addProf(s, 'weapons', 'martial'); DND.addProf(s, 'armor', 'medium'); }
            else { s.spells.bonusCantrips += 1; s.spells.bonusCantripsFor = s.curClassId; s.skillBonus.push({ skills: ['arcana', 'nature'], ability: 'wis', min: 1 }); }
          } }] })],
      2: [F('Wild Shape', 'Bonus Action: take the form of a Beast you know (max CR 1/4, 1/2 at level 4, 1 at level 8). Gain Temp HP equal to Druid level. Regain one use on a Short Rest.'),
        F('Wild Companion', 'Expend a spell slot or Wild Shape use to cast Find Familiar without material components; the familiar is a Fey.')],
      3: [SUB(3)],
      4: [ASI()],
      5: [F('Wild Resurgence', 'Once per turn, expend a slot to regain a Wild Shape use; once per Long Rest, expend a Wild Shape use for a level 1 slot.')],
      7: [F('Elemental Fury', 'The might of the elements flows through you.', { choices: [{ id: 'fury', label: 'Elemental Fury', kind: 'one',
        options: [opt('potent', 'Potent Spellcasting', 'Add your Wis mod to damage dealt with Druid cantrips.'), opt('primal', 'Primal Strike', 'Once per turn, a weapon or Beast-form attack hit deals +1d8 Cold, Fire, Lightning, or Thunder.')],
        apply: function (s, v) { s.flags.elementalFury = v; } }] })],
      8: [ASI()],
      12: [ASI()],
      15: [F('Improved Elemental Fury', 'Potent Spellcasting extends cantrip range by 300 ft, or Primal Strike deals 2d8.')],
      16: [ASI()],
      18: [F('Beast Spells', 'You can cast spells in Wild Shape, except ones with costly or consumed Material components.')],
      19: [BOON()],
      20: [F('Archdruid', 'Regain a Wild Shape use when you roll Initiative with none left; convert Wild Shape uses into spell slots; you age 1 year per 10.')]
    },
    subclasses: [{
      id: 'land', name: 'Circle of the Land', desc: 'Celebrate connection to the natural world.',
      derive: function (s) {
        var land = LAND[s.flags.land];
        if (land) subSpells(land.table, 'Circle of the Land (' + land.name + ')')(s);
        if (land && s.level >= 10) s.resist.push(land.dmg);
      },
      features: {
        3: [F('Circle of the Land Spells', 'After each Long Rest choose a land type; its spells are always prepared at the listed Druid levels.', { choices: [{ id: 'land', label: 'Land type', kind: 'one',
          options: Object.keys(LAND).map(function (k) {
            var t = LAND[k].table;
            return opt(k, LAND[k].name, [3, 5, 7, 9].map(function (l) { return l + ': ' + t[l].join(', '); }).join(' · '));
          }),
          apply: function (s, v) { s.flags.land = v; } }] }),
          F('Land\'s Aid', 'Magic action, expend Wild Shape: 2d6 Necrotic in a 10-ft sphere (Con save) and heal one creature 2d6. Scales to 3d6 at 10 and 4d6 at 14.')],
        6: [F('Natural Recovery', 'Once per Long Rest cast one prepared circle spell without a slot, and on a Short Rest recover slots totaling up to half your Druid level (none of level 6+).')],
        10: [F('Nature\'s Ward', 'Immune to the Poisoned condition, and Resistance to your current land\'s damage type (Fire, Cold, Lightning, or Poison).')],
        14: [F('Nature\'s Sanctuary', 'Magic action, expend Wild Shape: a 15-ft cube of spectral trees for 1 minute; you and allies inside have Half Cover and your land\'s Resistance.')]
      }
    }]
  });

  /* ======================= FIGHTER ======================= */
  DND.CLASSES.push({
    id: 'fighter', name: 'Fighter', hd: 10, primary: 'Strength or Dexterity',
    saves: ['str', 'con'], skillCount: 2, skillList: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'persuasion', 'survival'],
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'], tools: [],
    columns: [
      col('Second Wind', byTier([[1, 2], [4, 3], [10, 4]])),
      col('Weapon Mastery', byTier([[1, 3], [4, 4], [10, 5], [16, 6]]))
    ],
    subclassLabel: 'Fighter Subclass', subclassLevel: 3,
    features: {
      1: [F('Fighting Style', 'Gain a Fighting Style feat. You can swap it whenever you gain a Fighter level.', {
        apply: function (s) { s.flags.fightingStyle = true; }, choices: [DND.styleFeatChoice()] }),
        F('Second Wind', 'Bonus Action: regain 1d10 + Fighter level HP. Regain one use on a Short Rest.'),
        MASTERY(3, 'any')],
      2: [F('Action Surge', 'Take one additional action on your turn (not the Magic action). Once per Short or Long Rest.'),
        F('Tactical Mind', 'When you fail an ability check, expend a Second Wind use to add 1d10; it isn\'t spent if you still fail.')],
      3: [SUB(3)],
      4: [ASI(), MASTERY(1, 'any', true)],
      5: [EXTRA_ATTACK(1), F('Tactical Shift', 'When you use Second Wind, move up to half your Speed without provoking Opportunity Attacks.')],
      6: [ASI()],
      8: [ASI()],
      9: [F('Indomitable', 'Reroll a failed saving throw with a bonus equal to your Fighter level. Once per Long Rest.'),
        F('Tactical Master', 'When you attack with a mastered weapon, you can replace its property with Push, Sap, or Slow for that attack.')],
      10: [MASTERY(1, 'any', true)],
      11: [EXTRA_ATTACK(2)],
      12: [ASI()],
      13: [F('Indomitable (two uses)', 'You can use Indomitable twice between Long Rests.'),
        F('Studied Attacks', 'If you miss a creature, you have Advantage on your next attack roll against it before the end of your next turn.')],
      14: [ASI()],
      16: [ASI(), MASTERY(1, 'any', true)],
      17: [F('Action Surge (two uses)', 'Use Action Surge twice per rest, but only once per turn.'), F('Indomitable (three uses)', 'You can use Indomitable three times between Long Rests.')],
      19: [BOON()],
      20: [EXTRA_ATTACK(3)]
    },
    subclasses: [{
      id: 'champion', name: 'Champion', desc: 'Pursue physical excellence in combat.',
      features: {
        3: [F('Improved Critical', 'Your weapon attacks and Unarmed Strikes score a Critical Hit on a 19 or 20.', { apply: function (s) { s.crit = 19; } }),
          F('Remarkable Athlete', 'Advantage on Initiative rolls and Strength (Athletics) checks; after a Critical Hit, move half your Speed without provoking.')],
        7: [F('Additional Fighting Style', 'Gain another Fighting Style feat.', { choices: [DND.styleFeatChoice('style', 'Second Fighting Style feat')] })],
        10: [F('Heroic Warrior', 'In combat, gain Heroic Inspiration at the start of your turn if you don\'t have it.')],
        15: [F('Superior Critical', 'Your weapon attacks and Unarmed Strikes score a Critical Hit on an 18–20.', { apply: function (s) { s.crit = 18; } })],
        18: [F('Survivor', 'Advantage on Death Saving Throws; while Bloodied with at least 1 HP, regain 5 + Con mod HP at the start of each turn.')]
      }
    }]
  });

  /* ======================= MONK ======================= */
  DND.CLASSES.push({
    id: 'monk', name: 'Monk', hd: 8, primary: 'Dexterity and Wisdom',
    saves: ['str', 'dex'], skillCount: 2, skillList: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    armor: [], weapons: ['simple', 'martial-light'], tools: ["One Artisan's Tool or Musical Instrument"],
    columns: [
      col('Martial Arts', byTier([[1, '1d6'], [5, '1d8'], [11, '1d10'], [17, '1d12']])),
      col('Focus Points', byTier([[1, '—'], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9], [10, 10], [11, 11], [12, 12], [13, 13], [14, 14], [15, 15], [16, 16], [17, 17], [18, 18], [19, 19], [20, 20]])),
      col('Unarmored Movement', byTier([[1, '—'], [2, '+10 ft'], [6, '+15 ft'], [10, '+20 ft'], [14, '+25 ft'], [18, '+30 ft']]))
    ],
    subclassLabel: 'Monk Subclass', subclassLevel: 3,
    derive: function (s) {
      var l = s.level;
      s.unarmoredSpeed = l >= 18 ? 30 : l >= 14 ? 25 : l >= 10 ? 20 : l >= 6 ? 15 : l >= 2 ? 10 : 0;
      s.martialArts = l >= 17 ? '1d12' : l >= 11 ? '1d10' : l >= 5 ? '1d8' : '1d6';
    },
    features: {
      1: [F('Martial Arts', 'While unarmored and without a Shield: use Dex for Unarmed Strikes and Monk weapons, roll your Martial Arts die for their damage, and make an Unarmed Strike as a Bonus Action.'),
        F('Unarmored Defense', 'While wearing no armor and wielding no Shield, your AC equals 10 + Dex mod + Wis mod.', { apply: function (s) { s.unarmored.push('wis'); s.unarmoredNoShield = true; } })],
      2: [F('Monk\'s Focus', 'Spend Focus Points on Flurry of Blows (two Bonus Action strikes), Patient Defense (Disengage + Dodge), or Step of the Wind (Disengage + Dash). Regain on a Short Rest.'),
        F('Unarmored Movement', 'Your Speed increases while you aren\'t wearing armor or wielding a Shield.'),
        F('Uncanny Metabolism', 'When you roll Initiative, regain all Focus Points and heal Martial Arts die + Monk level HP. Once per Long Rest.')],
      3: [SUB(3), F('Deflect Attacks', 'Reaction: reduce a Bludgeoning, Piercing, or Slashing attack\'s damage by 1d10 + Dex mod + Monk level; if reduced to 0, spend 1 Focus to redirect it.')],
      4: [ASI(), F('Slow Fall', 'Reaction: reduce falling damage by 5 × Monk level.')],
      5: [EXTRA_ATTACK(1), F('Stunning Strike', 'Once per turn on a hit, spend 1 Focus: the target makes a Con save or is Stunned until your next turn (on a success, its Speed is halved and your next attack has Advantage).')],
      6: [F('Empowered Strikes', 'Your Unarmed Strikes can deal Force damage instead of their normal type.')],
      7: [F('Evasion', 'When a Dex save would halve damage, you take none on a success and half on a failure.')],
      8: [ASI()],
      9: [F('Acrobatic Movement', 'While unarmored, you can move along vertical surfaces and across liquids on your turn.')],
      10: [F('Heightened Focus', 'Flurry of Blows makes three strikes; Patient Defense and Step of the Wind grant extra benefits.'),
        F('Self-Restoration', 'End Charmed, Frightened, or Poisoned on yourself at the end of each turn; skipping food and drink doesn\'t cause Exhaustion.')],
      12: [ASI()],
      13: [F('Deflect Energy', 'Deflect Attacks works against attacks of any damage type.')],
      14: [F('Disciplined Survivor', 'Proficiency in all saving throws; spend 1 Focus to reroll a failed save.', {
        apply: function (s) { DND.ABILITIES.forEach(function (a) { DND.addSave(s, a); }); } })],
      15: [F('Perfect Focus', 'When you roll Initiative and have 3 or fewer Focus Points, regain up to 4.')],
      16: [ASI()],
      18: [F('Superior Defense', 'Spend 3 Focus Points: Resistance to all damage except Force for 1 minute.')],
      19: [BOON()],
      20: [F('Body and Mind', 'Your Dexterity and Wisdom scores increase by 4, to a maximum of 25.', {
        apply: function (s) { DND.inc(s, 'dex', 4, 25); DND.inc(s, 'wis', 4, 25); } })]
    },
    subclasses: [{
      id: 'openhand', name: 'Warrior of the Open Hand', desc: 'Master unarmed combat techniques.',
      features: {
        3: [F('Open Hand Technique', 'When you hit with a Flurry of Blows strike, impose Addle (no Opportunity Attacks), Push (15 ft, Str save), or Topple (Prone, Dex save).')],
        6: [F('Wholeness of Body', 'Bonus Action: heal Martial Arts die + Wis mod HP. Uses = Wis mod (min 1) per Long Rest.')],
        11: [F('Fleet Step', 'When you take a Bonus Action other than Step of the Wind, you can also use Step of the Wind.')],
        17: [F('Quivering Palm', 'Spend 4 Focus on an Unarmed Strike hit to set lethal vibrations; later end them to force a Con save: 10d12 Force (half on a success).')]
      }
    }]
  });

  /* ======================= PALADIN ======================= */
  DND.CLASSES.push({
    id: 'paladin', name: 'Paladin', hd: 10, primary: 'Strength and Charisma',
    saves: ['wis', 'cha'], skillCount: 2, skillList: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'], tools: [],
    caster: { type: 'half', ability: 'cha', list: 'paladin', cantrips: null, prepared: PREP_HALF },
    columns: [col('Channel Divinity', byTier([[1, '—'], [3, 2], [11, 3]]))],
    subclassLabel: 'Paladin Subclass (Oath)', subclassLevel: 3,
    derive: function (s) {
      if (s.level >= 6) s.flags.auraOfProtection = s.level >= 18 ? 30 : 10;
    },
    features: {
      1: [F('Lay On Hands', 'Pool of healing equal to 5 × Paladin level. Bonus Action: restore HP from the pool, or spend 5 to remove the Poisoned condition.'),
        F('Spellcasting', 'Cast Paladin spells using Charisma with a Holy Symbol as your focus. Change one prepared spell after a Long Rest.'),
        MASTERY(2, 'any')],
      2: [F('Fighting Style', 'Gain a Fighting Style feat, or the Blessed Warrior option.', {
        apply: function (s) { s.flags.fightingStyle = true; },
        choices: [{ id: 'style', label: 'Fighting Style', kind: 'one',
          options: function (s) {
            var feats = DND.featChoice('x', '', ['style'], 'Fighting Style').options(s);
            feats.push({ id: 'blessed-warrior', label: 'Blessed Warrior', desc: 'Learn two Cleric cantrips; they count as Paladin spells (Charisma).',
              choices: [DND.cantripChoice('cantrips', 'Cleric cantrips', 2, 'cleric', 'Blessed Warrior', 'cha')] });
            return feats;
          } }] }),
        F('Paladin\'s Smite', 'Always have Divine Smite prepared, and cast it once per Long Rest without a spell slot.', { apply: function (s) { DND.addAlways(s, ['Divine Smite'], 'Paladin\'s Smite'); } })],
      3: [F('Channel Divinity', 'Divine Sense: sense Celestials, Fiends, and Undead within 60 ft. Regain one use on a Short Rest.'), SUB(3)],
      4: [ASI()],
      5: [EXTRA_ATTACK(1), F('Faithful Steed', 'Always have Find Steed prepared and cast it once per Long Rest without a slot.', { apply: function (s) { DND.addAlways(s, ['Find Steed'], 'Faithful Steed'); } })],
      6: [F('Aura of Protection', 'You and allies within a 10-ft Emanation add your Cha mod (min +1) to saving throws.')],
      8: [ASI()],
      9: [F('Abjure Foes', 'Channel Divinity: up to Cha-mod creatures within 60 ft make a Wis save or are Frightened for 1 minute.')],
      10: [F('Aura of Courage', 'You and allies in your aura have Immunity to the Frightened condition.')],
      11: [F('Radiant Strikes', 'Your melee weapon and Unarmed Strike hits deal an extra 1d8 Radiant damage.')],
      12: [ASI()],
      14: [F('Restoring Touch', 'Lay On Hands can also remove Blinded, Charmed, Deafened, Frightened, Paralyzed, or Stunned (5 HP from the pool each).')],
      16: [ASI()],
      18: [F('Aura Expansion', 'Your Aura of Protection becomes a 30-ft Emanation.')],
      19: [BOON()]
    },
    subclasses: [{
      id: 'devotion', name: 'Oath of Devotion', desc: 'Uphold the ideals of justice and order.',
      derive: subSpells({ 3: ['Protection from Evil and Good', 'Shield of Faith'], 5: ['Aid', 'Zone of Truth'], 9: ['Beacon of Hope', 'Dispel Magic'], 13: ['Freedom of Movement', 'Guardian of Faith'], 17: ['Commune', 'Flame Strike'] }, 'Oath of Devotion Spells'),
      features: {
        3: [F('Oath of Devotion Spells', 'Always prepared: Protection from Evil and Good, Shield of Faith (3); Aid, Zone of Truth (5); Beacon of Hope, Dispel Magic (9); Freedom of Movement, Guardian of Faith (13); Commune, Flame Strike (17).'),
          F('Sacred Weapon', 'Channel Divinity when you Attack: for 10 minutes add your Cha mod (min +1) to attack rolls with a weapon, which sheds light and can deal Radiant damage.')],
        7: [F('Aura of Devotion', 'You and allies in your Aura of Protection have Immunity to the Charmed condition.')],
        15: [F('Smite of Protection', 'When you cast Divine Smite, you and allies in your aura have Half Cover until your next turn.')],
        20: [F('Holy Nimbus', 'Bonus Action for 10 minutes: Advantage on saves against Fiends and Undead, enemies starting their turn in your aura take Cha mod + PB Radiant, and you shed Bright Light. Once per Long Rest (or a level 5 slot).')]
      }
    }]
  });

  /* ======================= RANGER ======================= */
  DND.CLASSES.push({
    id: 'ranger', name: 'Ranger', hd: 10, primary: 'Dexterity and Wisdom',
    saves: ['str', 'dex'], skillCount: 3, skillList: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], tools: [],
    caster: { type: 'half', ability: 'wis', list: 'ranger', cantrips: null, prepared: PREP_HALF },
    columns: [col('Favored Enemy', byTier([[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]]))],
    subclassLabel: 'Ranger Subclass', subclassLevel: 3,
    features: {
      1: [F('Spellcasting', 'Cast Ranger spells using Wisdom with a Druidic Focus. Change one prepared spell after a Long Rest.'),
        F('Favored Enemy', 'Always have Hunter\'s Mark prepared; cast it without a slot a number of times per Long Rest (see table).', { apply: function (s) { DND.addAlways(s, ['Hunter\'s Mark'], 'Favored Enemy'); } }),
        MASTERY(2, 'any')],
      2: [F('Deft Explorer', 'Gain Expertise in one skill you\'re proficient in and learn two languages.', { choices: [DND.expertiseChoice('skill', 'Expertise skill', 1)] }),
        F('Fighting Style', 'Gain a Fighting Style feat, or the Druidic Warrior option.', {
          apply: function (s) { s.flags.fightingStyle = true; },
          choices: [{ id: 'style', label: 'Fighting Style', kind: 'one',
            options: function (s) {
              var feats = DND.featChoice('x', '', ['style'], 'Fighting Style').options(s);
              feats.push({ id: 'druidic-warrior', label: 'Druidic Warrior', desc: 'Learn two Druid cantrips; they count as Ranger spells (Wisdom).',
                choices: [DND.cantripChoice('cantrips', 'Druid cantrips', 2, 'druid', 'Druidic Warrior', 'wis')] });
              return feats;
            } }] })],
      3: [SUB(3)],
      4: [ASI()],
      5: [EXTRA_ATTACK(1)],
      6: [F('Roving', '+10 ft Speed while not wearing Heavy armor, and a Climb and Swim Speed equal to your Speed.', { apply: function (s) { s.speedNoHeavy += 10; } })],
      8: [ASI()],
      9: [F('Expertise', 'Gain Expertise in two skills you\'re proficient in.', { choices: [DND.expertiseChoice('skills', 'Expertise skills', 2)] })],
      10: [F('Tireless', 'Magic action: gain 1d8 + Wis mod Temp HP (Wis mod times per Long Rest). Short Rests reduce your Exhaustion by 1.')],
      12: [ASI()],
      13: [F('Relentless Hunter', 'Taking damage can\'t break your Concentration on Hunter\'s Mark.')],
      14: [F('Nature\'s Veil', 'Bonus Action: become Invisible until the end of your next turn. Uses = Wis mod (min 1) per Long Rest.')],
      16: [ASI()],
      17: [F('Precise Hunter', 'Advantage on attack rolls against the creature marked by your Hunter\'s Mark.')],
      18: [F('Feral Senses', 'Blindsight with a range of 30 ft.', { apply: function (s) { s.senses.push('Blindsight 30 ft'); } })],
      19: [BOON()],
      20: [F('Foe Slayer', 'The damage die of your Hunter\'s Mark becomes a d10.')]
    },
    subclasses: [{
      id: 'hunter', name: 'Hunter', desc: 'Protect nature and people from destruction.',
      features: {
        3: [F('Hunter\'s Lore', 'While a creature is marked by your Hunter\'s Mark, you know its Immunities, Resistances, and Vulnerabilities.'),
          F('Hunter\'s Prey', 'Choose an option (you can change it after a rest).', { choices: [{ id: 'prey', label: 'Hunter\'s Prey', kind: 'one',
            options: [opt('colossus', 'Colossus Slayer', 'Once per turn, a weapon hit deals +1d8 to a creature missing any HP.'),
              opt('horde', 'Horde Breaker', 'Once per turn, make an extra attack with the same weapon against a different creature within 5 ft of the target.')] }] })],
        7: [F('Defensive Tactics', 'Choose an option (you can change it after a rest).', { choices: [{ id: 'tactic', label: 'Defensive Tactics', kind: 'one',
          options: [opt('escape', 'Escape the Horde', 'Opportunity Attacks have Disadvantage against you.'),
            opt('multi', 'Multiattack Defense', 'When a creature hits you, it has Disadvantage on other attacks against you this turn.')] }] })],
        11: [F('Superior Hunter\'s Prey', 'Once per turn when Hunter\'s Mark deals damage, deal its extra damage to another creature you can see within 30 ft of the target.')],
        15: [F('Superior Hunter\'s Defense', 'Reaction when you take damage: gain Resistance to that damage and any of the same type until the end of the turn.')]
      }
    }]
  });

  /* ======================= ROGUE ======================= */
  DND.CLASSES.push({
    id: 'rogue', name: 'Rogue', hd: 8, primary: 'Dexterity',
    saves: ['dex', 'int'], skillCount: 4, skillList: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'persuasion', 'sleight', 'stealth'],
    armor: ['light'], weapons: ['simple', 'martial-finesse-light'], tools: ["Thieves' Tools"],
    columns: [col('Sneak Attack', (function () { var o = []; for (var l = 1; l <= 20; l++) o.push(Math.ceil(l / 2) + 'd6'); return o; })())],
    subclassLabel: 'Rogue Subclass', subclassLevel: 3,
    features: {
      1: [F('Expertise', 'Gain Expertise in two skills you\'re proficient in.', { choices: [DND.expertiseChoice('skills', 'Expertise skills', 2)] }),
        F('Sneak Attack', 'Once per turn, deal extra damage to a creature you hit with a Finesse or Ranged weapon if you have Advantage, or an ally is within 5 ft of it and you lack Disadvantage.'),
        F('Thieves\' Cant', 'You know Thieves\' Cant and one other language.'),
        MASTERY(2, 'rogue')],
      2: [F('Cunning Action', 'Take the Dash, Disengage, or Hide action as a Bonus Action.')],
      3: [SUB(3), F('Steady Aim', 'Bonus Action: Advantage on your next attack this turn if you haven\'t moved; your Speed becomes 0 until the end of the turn.')],
      4: [ASI()],
      5: [F('Cunning Strike', 'When you deal Sneak Attack damage, forgo dice for effects: Poison (1d6), Trip (1d6), or Withdraw (1d6).'),
        F('Uncanny Dodge', 'Reaction: halve the damage of an attack that hits you from an attacker you can see.')],
      6: [F('Expertise', 'Gain Expertise in two more skills you\'re proficient in.', { choices: [DND.expertiseChoice('skills', 'Expertise skills', 2)] })],
      7: [F('Evasion', 'When a Dex save would halve damage, you take none on a success and half on a failure.'),
        F('Reliable Talent', 'When you make an ability check using a skill or tool you\'re proficient with, treat a d20 roll of 9 or lower as a 10.')],
      8: [ASI()],
      10: [ASI()],
      11: [F('Improved Cunning Strike', 'You can use up to two Cunning Strike effects on one Sneak Attack.')],
      12: [ASI()],
      14: [F('Devious Strikes', 'New Cunning Strike options: Daze (2d6), Knock Out (6d6), Obscure (3d6).')],
      15: [F('Slippery Mind', 'Proficiency in Wisdom and Charisma saving throws.', { apply: function (s) { DND.addSave(s, 'wis'); DND.addSave(s, 'cha'); } })],
      16: [ASI()],
      18: [F('Elusive', 'No attack roll can have Advantage against you unless you have the Incapacitated condition.')],
      19: [BOON()],
      20: [F('Stroke of Luck', 'Turn a failed d20 Test into a 20. Once per Short or Long Rest.')]
    },
    subclasses: [{
      id: 'thief', name: 'Thief', desc: 'Hunt for treasure as a classic adventurer.',
      features: {
        3: [F('Fast Hands', 'Cunning Action can also make a Sleight of Hand check, use Thieves\' Tools, or take the Utilize action / use a magic item.'),
          F('Second-Story Work', 'Gain a Climb Speed equal to your Speed, and you can use Dexterity for your jump distance.')],
        9: [F('Supreme Sneak', 'New Cunning Strike option: Stealth Attack (1d6) — if you\'re hidden, the attack doesn\'t end the Invisible condition.')],
        13: [F('Use Magic Device', 'Attune to up to four magic items; when using an item\'s charges, roll 1d6 and spend none on a 6; use any Spell Scroll.')],
        17: [F('Thief\'s Reflexes', 'Take two turns in the first round of combat: one at your Initiative and one at Initiative − 10.')]
      }
    }]
  });

  /* ======================= SORCERER ======================= */
  var METAMAGIC = [
    opt('careful', 'Careful Spell', '1 SP: chosen creatures automatically succeed on the spell\'s save and take no damage on a success.'),
    opt('distant', 'Distant Spell', '1 SP: double the spell\'s range, or make Touch spells 30 ft.'),
    opt('empowered', 'Empowered Spell', '1 SP: reroll up to Cha-mod damage dice.'),
    opt('extended', 'Extended Spell', '1 SP: double the duration (max 24 hours) and gain Advantage on Concentration saves.'),
    opt('heightened', 'Heightened Spell', '2 SP: one target has Disadvantage on saves against the spell.'),
    opt('quickened', 'Quickened Spell', '2 SP: cast the spell as a Bonus Action (not if you already cast a level 1+ spell this turn).'),
    opt('seeking', 'Seeking Spell', '1 SP: reroll a missed spell attack roll.'),
    opt('subtle', 'Subtle Spell', '1 SP: cast without Verbal, Somatic, or non-costly Material components.'),
    opt('transmuted', 'Transmuted Spell', '1 SP: change the damage type among Acid, Cold, Fire, Lightning, Poison, and Thunder.'),
    opt('twinned', 'Twinned Spell', '1 SP: increase the spell\'s effective level by 1 to add one more target when that\'s possible.')
  ];
  function metamagicChoice(count) {
    return { id: 'meta', label: 'Metamagic options', kind: 'many', count: count,
      options: function (s) {
        return METAMAGIC.map(function (m) {
          var o = { id: m.id, label: m.label, desc: m.desc };
          if (s.metamagic.indexOf(m.id) >= 0) o.unavailable = 'Already known';
          return o;
        });
      },
      apply: function (s, v) { v.forEach(function (m) { s.metamagic.push(m); }); } };
  }
  DND.CLASSES.push({
    id: 'sorcerer', name: 'Sorcerer', hd: 6, primary: 'Charisma',
    saves: ['con', 'cha'], skillCount: 2, skillList: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    armor: [], weapons: ['simple'], tools: [],
    caster: { type: 'full', ability: 'cha', list: 'sorcerer', cantrips: byTier([[1, 4], [4, 5], [10, 6]]), prepared: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22] },
    columns: [col('Sorcery Points', byTier([[1, '—'], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9], [10, 10], [11, 11], [12, 12], [13, 13], [14, 14], [15, 15], [16, 16], [17, 17], [18, 18], [19, 19], [20, 20]]))],
    subclassLabel: 'Sorcerer Subclass', subclassLevel: 3,
    features: {
      1: [F('Spellcasting', 'Cast Sorcerer spells using Charisma with an Arcane Focus. Change one prepared spell when you gain a level.'),
        F('Innate Sorcery', 'Bonus Action for 1 minute: +1 to your spell save DC and Advantage on Sorcerer spell attacks. Twice per Long Rest.')],
      2: [F('Font of Magic', 'Sorcery Points equal to your level: convert them into spell slots or slots into points.'),
        F('Metamagic', 'Learn two Metamagic options to twist your spells (one per spell unless stated). Swap one when you gain a level.', { choices: [metamagicChoice(2)] })],
      3: [SUB(3)],
      4: [ASI()],
      5: [F('Sorcerous Restoration', 'On a Short Rest, regain Sorcery Points up to half your Sorcerer level. Once per Long Rest.')],
      7: [F('Sorcery Incarnate', 'Spend 2 SP to use Innate Sorcery with no uses left; while it\'s active you can use two Metamagic options per spell.')],
      8: [ASI()],
      10: [F('Metamagic', 'Learn two more Metamagic options.', { choices: [metamagicChoice(2)] })],
      12: [ASI()],
      16: [ASI()],
      17: [F('Metamagic', 'Learn two more Metamagic options.', { choices: [metamagicChoice(2)] })],
      19: [BOON()],
      20: [F('Arcane Apotheosis', 'While Innate Sorcery is active, use one Metamagic option per turn without spending Sorcery Points.')]
    },
    subclasses: [{
      id: 'draconic', name: 'Draconic Sorcery', desc: 'Breathe the magic of dragons.',
      derive: function (s) {
        subSpells({ 3: ['Alter Self', 'Chromatic Orb', 'Command', 'Dragon\'s Breath'], 5: ['Fear', 'Fly'], 7: ['Arcane Eye', 'Charm Monster'], 9: ['Legend Lore', 'Summon Dragon'] }, 'Draconic Spells')(s);
        if (s.level >= 3) s.hpFlat += s.level; // +3 at level 3, +1 per level after
      },
      features: {
        3: [F('Draconic Resilience', 'Your HP maximum increases by 3, plus 1 per Sorcerer level after 3. Without armor, your AC is 10 + Dex mod + Cha mod.', { apply: function (s) { s.unarmored.push('cha'); s.unarmoredNoCon = true; } }),
          F('Draconic Spells', 'Always prepared: Alter Self, Chromatic Orb, Command, Dragon\'s Breath (3); Fear, Fly (5); Arcane Eye, Charm Monster (7); Legend Lore, Summon Dragon (9).')],
        6: [F('Elemental Affinity', 'Resistance to one damage type, and add your Cha mod to one damage roll of a spell of that type.', {
          choices: [damageTypeChoice('type', 'Damage type', ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'], function (s, v) { s.resist.push(v); })] })],
        14: [F('Dragon Wings', 'Bonus Action: Fly Speed 60 ft for 1 hour. Once per Long Rest, or spend 3 Sorcery Points.')],
        18: [F('Dragon Companion', 'Cast Summon Dragon without Material components, once per Long Rest without a slot, and it doesn\'t need Concentration (1-minute duration).')]
      }
    }]
  });

  /* ======================= WARLOCK ======================= */
  function INV(id, name, desc, minLevel, extra) {
    var o = { id: id, name: name, desc: desc, minLevel: minLevel || 1 };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  }
  DND.INVOCATIONS = [
    INV('agonizing', 'Agonizing Blast', 'Add your Cha mod to the damage of a chosen Warlock damage cantrip.', 2, { repeatable: true }),
    INV('armor-shadows', 'Armor of Shadows', 'Cast Mage Armor on yourself without a spell slot.', 1, { apply: function (s) { s.flags.mageArmor = true; } }),
    INV('ascendant-step', 'Ascendant Step', 'Cast Levitate on yourself without a spell slot.', 5),
    INV('devils-sight', 'Devil\'s Sight', 'See normally in Dim Light and Darkness, magical or not, within 120 ft.', 2, { apply: function (s) { s.senses.push('Devil\'s Sight 120 ft'); } }),
    INV('devouring-blade', 'Devouring Blade', 'Thirsting Blade grants two extra attacks instead of one.', 12, { req: 'thirsting' }),
    INV('eldritch-mind', 'Eldritch Mind', 'Advantage on Constitution saves to maintain Concentration.', 1),
    INV('eldritch-smite', 'Eldritch Smite', 'Once per turn on a pact weapon hit, expend a Pact slot: +1d8 Force plus 1d8 per slot level, and knock a Huge or smaller target Prone.', 5, { req: 'pact-blade' }),
    INV('eldritch-spear', 'Eldritch Spear', 'A chosen damage cantrip\'s range increases by 30 ft × Warlock level.', 2, { repeatable: true }),
    INV('fiendish-vigor', 'Fiendish Vigor', 'Cast False Life on yourself without a slot, getting maximum Temp HP.', 2),
    INV('gaze-two-minds', 'Gaze of Two Minds', 'Bonus Action: perceive through a willing creature\'s senses and cast spells from its space.', 5),
    INV('gift-depths', 'Gift of the Depths', 'Breathe underwater, Swim Speed equal to Speed, and cast Water Breathing once per Long Rest free.', 5),
    INV('gift-protectors', 'Gift of the Protectors', 'Creatures whose names are in your Book of Shadows drop to 1 HP instead of 0, once each per Long Rest.', 9, { req: 'pact-tome' }),
    INV('investment-chain', 'Investment of the Chain Master', 'Your familiar gains a 40-ft Fly or Swim Speed, can attack as a Bonus Action, and uses your save DC.', 5, { req: 'pact-chain' }),
    INV('lessons', 'Lessons of the First Ones', 'Gain an Origin feat of your choice.', 2, { repeatable: true, choices: [DND.featChoice('feat', 'Origin feat', ['origin'], 'Lessons of the First Ones')] }),
    INV('lifedrinker', 'Lifedrinker', 'Once per turn, pact weapon hits deal +1d6 Necrotic, Psychic, or Radiant, and you can spend a Hit Die to heal.', 9, { req: 'pact-blade' }),
    INV('mask-faces', 'Mask of Many Faces', 'Cast Disguise Self without a spell slot.', 2),
    INV('myriad-forms', 'Master of Myriad Forms', 'Cast Alter Self without a spell slot.', 5),
    INV('misty-visions', 'Misty Visions', 'Cast Silent Image without a spell slot.', 2),
    INV('one-shadows', 'One with Shadows', 'In Dim Light or Darkness, cast Invisibility on yourself without a slot.', 5),
    INV('otherworldly-leap', 'Otherworldly Leap', 'Cast Jump on yourself without a spell slot.', 2),
    INV('pact-blade', 'Pact of the Blade', 'Bonus Action: conjure or bond a pact weapon. Use Cha for its attacks and damage, and it can deal Necrotic, Psychic, or Radiant.', 1),
    INV('pact-chain', 'Pact of the Chain', 'Learn Find Familiar and cast it as a Magic action without a slot; special forms like imp, pseudodragon, or sprite.', 1),
    INV('pact-tome', 'Pact of the Tome', 'A Book of Shadows grants three cantrips and two level 1 Ritual spells from any class; it\'s your spellcasting focus.', 1),
    INV('repelling', 'Repelling Blast', 'When a chosen damage cantrip hits a Large or smaller creature, push it up to 10 ft.', 2, { repeatable: true }),
    INV('thirsting', 'Thirsting Blade', 'Attack twice with your pact weapon when you take the Attack action.', 5, { req: 'pact-blade' }),
    INV('visions-realms', 'Visions of Distant Realms', 'Cast Arcane Eye without a spell slot.', 9),
    INV('whispers-grave', 'Whispers of the Grave', 'Cast Speak with Dead without a spell slot.', 7),
    INV('witch-sight', 'Witch Sight', 'Truesight with a range of 30 ft.', 15, { apply: function (s) { s.senses.push('Truesight 30 ft'); } })
  ];
  function invocationChoice(count) {
    return { id: 'inv', label: 'Eldritch Invocations', kind: 'many', count: count,
      options: function (s, get) {
        var picked = (get('inv') || []).concat(s.invocations);
        return DND.INVOCATIONS.map(function (inv) {
          var o = { id: inv.id, label: inv.name, desc: inv.desc + (inv.minLevel > 1 ? ' (Level ' + inv.minLevel + '+)' : ''), choices: inv.choices || null };
          if (inv.minLevel > s.level) o.unavailable = 'Requires Warlock level ' + inv.minLevel;
          else if (inv.req && picked.indexOf(inv.req) < 0) o.unavailable = 'Requires ' + DND.INVOCATIONS.filter(function (x) { return x.id === inv.req; })[0].name;
          else if (!inv.repeatable && s.invocations.indexOf(inv.id) >= 0) o.unavailable = 'Already known';
          o.apply = function (st) { st.invocations.push(inv.id); if (inv.apply) inv.apply(st); };
          return o;
        });
      } };
  }
  function arcanum(spellLevel) {
    return F('Mystic Arcanum (level ' + spellLevel + ' spell)', 'Choose a level ' + spellLevel + ' Warlock spell; cast it once per Long Rest without a spell slot.', {
      choices: [{ id: 'spell', label: 'Level ' + spellLevel + ' arcanum', kind: 'one',
        options: function () { return DND.spellOptions('warlock', spellLevel, spellLevel); },
        apply: function (s, v) { DND.addAlways(s, [v], 'Mystic Arcanum (1/Long Rest)'); } }] });
  }
  DND.CLASSES.push({
    id: 'warlock', name: 'Warlock', hd: 8, primary: 'Charisma',
    saves: ['wis', 'cha'], skillCount: 2, skillList: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    armor: ['light'], weapons: ['simple'], tools: [],
    caster: { type: 'pact', ability: 'cha', list: 'warlock', cantrips: CANTRIPS_2_3_4, prepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15] },
    columns: [col('Invocations', [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10])],
    subclassLabel: 'Warlock Subclass (Patron)', subclassLevel: 3,
    features: {
      1: [F('Eldritch Invocations', 'Fragments of forbidden knowledge. Gain one invocation now (Pact of the Blade, Chain, or Tome are popular picks); you can replace one when you gain a level.', { choices: [invocationChoice(1)] }),
        F('Pact Magic', 'Cast Warlock spells using Charisma. Your Pact Magic slots are all the same level and recharge on a Short or Long Rest.')],
      2: [F('Magical Cunning', 'Perform a 1-minute rite to regain expended Pact slots up to half your maximum (round up). Once per Long Rest.'),
        F('Eldritch Invocations (+2)', 'Learn two more invocations.', { choices: [invocationChoice(2)] })],
      3: [SUB(3)],
      4: [ASI()],
      5: [F('Eldritch Invocations (+2)', 'Learn two more invocations.', { choices: [invocationChoice(2)] })],
      7: [F('Eldritch Invocations (+1)', 'Learn one more invocation.', { choices: [invocationChoice(1)] })],
      8: [ASI()],
      9: [F('Contact Patron', 'Always have Contact Other Plane prepared; cast it once per Long Rest without a slot and automatically succeed on its save.', { apply: function (s) { DND.addAlways(s, ['Contact Other Plane'], 'Contact Patron'); } }),
        F('Eldritch Invocations (+1)', 'Learn one more invocation.', { choices: [invocationChoice(1)] })],
      11: [arcanum(6)],
      12: [ASI(), F('Eldritch Invocations (+1)', 'Learn one more invocation.', { choices: [invocationChoice(1)] })],
      13: [arcanum(7)],
      15: [arcanum(8), F('Eldritch Invocations (+1)', 'Learn one more invocation.', { choices: [invocationChoice(1)] })],
      16: [ASI()],
      17: [arcanum(9)],
      18: [F('Eldritch Invocations (+1)', 'Learn one more invocation.', { choices: [invocationChoice(1)] })],
      19: [BOON()],
      20: [F('Eldritch Master', 'Magical Cunning now regains all expended Pact Magic slots.')]
    },
    subclasses: [{
      id: 'fiend', name: 'Fiend Patron', desc: 'Make a deal with the Lower Planes.',
      derive: subSpells({ 3: ['Burning Hands', 'Command', 'Scorching Ray', 'Suggestion'], 5: ['Fireball', 'Stinking Cloud'], 7: ['Fire Shield', 'Wall of Fire'], 9: ['Geas', 'Insect Plague'] }, 'Fiend Spells'),
      features: {
        3: [F('Dark One\'s Blessing', 'When you reduce an enemy to 0 HP (or one within 10 ft is reduced), gain Temp HP equal to Cha mod + Warlock level (min 1).'),
          F('Fiend Spells', 'Always prepared: Burning Hands, Command, Scorching Ray, Suggestion (3); Fireball, Stinking Cloud (5); Fire Shield, Wall of Fire (7); Geas, Insect Plague (9).')],
        6: [F('Dark One\'s Own Luck', 'Add 1d10 to an ability check or saving throw after seeing the roll. Uses = Cha mod (min 1) per Long Rest.')],
        10: [F('Fiendish Resilience', 'After a Short or Long Rest, choose a damage type other than Force; you have Resistance to it.')],
        14: [F('Hurl Through Hell', 'Once per turn on an attack hit, the target makes a Cha save or is hurled through the Lower Planes: 8d10 Psychic and Incapacitated. Once per Long Rest (or a Pact slot).')]
      }
    }]
  });

  /* ======================= WIZARD ======================= */
  DND.CLASSES.push({
    id: 'wizard', name: 'Wizard', hd: 6, primary: 'Intelligence',
    saves: ['int', 'wis'], skillCount: 2, skillList: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'],
    armor: [], weapons: ['simple'], tools: [],
    caster: { type: 'full', ability: 'int', list: 'wizard', cantrips: CANTRIPS_3_4_5, prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25] },
    columns: [col('Spellbook', (function () { var o = []; for (var l = 1; l <= 20; l++) o.push(6 + 2 * (l - 1) + ' spells'); return o; })())],
    subclassLabel: 'Wizard Subclass', subclassLevel: 3,
    features: {
      1: [F('Spellcasting', 'Cast Wizard spells using Intelligence. Your spellbook starts with six level 1 spells and gains two per level; prepare from it after a Long Rest.'),
        F('Ritual Adept', 'Cast any Ritual spell in your spellbook as a Ritual without having it prepared.'),
        F('Arcane Recovery', 'Once per day on a Short Rest, recover spell slots totaling up to half your Wizard level (round up), none of level 6+.')],
      2: [F('Scholar', 'Gain Expertise in one of Arcana, History, Investigation, Medicine, Nature, or Religion that you\'re proficient in.', {
        choices: [DND.expertiseChoice('skill', 'Scholar expertise', 1, ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'])] })],
      3: [SUB(3)],
      4: [ASI()],
      5: [F('Memorize Spell', 'On a Short Rest, replace one prepared Wizard spell with another level 1+ spell from your spellbook.')],
      8: [ASI()],
      12: [ASI()],
      16: [ASI()],
      18: [F('Spell Mastery', 'Choose a level 1 and a level 2 spell from your spellbook with a casting time of an action; cast them at their lowest level without slots.', {
        choices: [
          { id: 'l1', label: 'Level 1 mastery', kind: 'one', options: function () { return DND.spellOptions('wizard', 1, 1); }, apply: function (s, v) { DND.addAlways(s, [v], 'Spell Mastery (at will)'); } },
          { id: 'l2', label: 'Level 2 mastery', kind: 'one', options: function () { return DND.spellOptions('wizard', 2, 2); }, apply: function (s, v) { DND.addAlways(s, [v], 'Spell Mastery (at will)'); } }] })],
      19: [BOON()],
      20: [F('Signature Spells', 'Choose two level 3 spells from your spellbook; they\'re always prepared and each can be cast once per Short Rest at level 3 without a slot.', {
        choices: [{ id: 'spells', label: 'Signature spells', kind: 'many', count: 2, options: function () { return DND.spellOptions('wizard', 3, 3); },
          apply: function (s, v) { DND.addAlways(s, v, 'Signature Spells'); } }] })]
    },
    subclasses: [{
      id: 'evoker', name: 'Evoker', desc: 'Create explosive elemental effects.',
      features: {
        3: [F('Evocation Savant', 'Add two Wizard Evocation spells (level 2 or lower) to your spellbook for free, plus one more free Evocation spell each time you gain a spell level.'),
          F('Potent Cantrip', 'When a creature succeeds on a save against your damaging cantrip, or your cantrip attack misses, it takes half the damage.')],
        6: [F('Sculpt Spells', 'When you cast an Evocation spell, choose 1 + the spell\'s level creatures to automatically succeed on its save and take no damage.')],
        10: [F('Empowered Evocation', 'Add your Int mod to one damage roll of any Wizard Evocation spell you cast.')],
        14: [F('Overchannel', 'Deal maximum damage with a Wizard spell of level 1–5. Further uses before a Long Rest deal escalating Necrotic damage to you.')]
      }
    }]
  });

  // Multiclassing (2024 rules): ability requirements and the proficiencies a class grants
  // when it isn't your first class.
  var MULTICLASS = {
    barbarian: { req: { all: ['str'] }, armor: ['shield'], weapons: ['martial'] },
    bard: { req: { all: ['cha'] }, armor: ['light'], skills: 1, tools: ['One Musical Instrument'] },
    cleric: { req: { all: ['wis'] }, armor: ['light', 'medium', 'shield'] },
    druid: { req: { all: ['wis'] }, armor: ['light', 'shield'] },
    fighter: { req: { any: ['str', 'dex'] }, armor: ['light', 'medium', 'shield'], weapons: ['martial'] },
    monk: { req: { all: ['dex', 'wis'] } },
    paladin: { req: { all: ['str', 'cha'] }, armor: ['light', 'medium', 'shield'], weapons: ['martial'] },
    ranger: { req: { all: ['dex', 'wis'] }, armor: ['light', 'medium', 'shield'], weapons: ['martial'], skills: 1 },
    rogue: { req: { all: ['dex'] }, armor: ['light'], skills: 1, tools: ["Thieves' Tools"] },
    sorcerer: { req: { all: ['cha'] } },
    warlock: { req: { all: ['cha'] }, armor: ['light'] },
    wizard: { req: { all: ['int'] } }
  };
  DND.CLASSES.forEach(function (c) { c.mc = MULTICLASS[c.id]; });
  // Spell slot contribution for multiclass spellcasters.
  DND.CLASSES.forEach(function (c) { if (c.caster) c.caster.mcKind = c.caster.type === 'pact' ? 'pact' : c.caster.type; });

  DND.cls = function (id) {
    for (var i = 0; i < DND.CLASSES.length; i++) if (DND.CLASSES[i].id === id) return DND.CLASSES[i];
    return null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
