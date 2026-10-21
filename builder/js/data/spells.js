/*
 * Class spell lists (spell names by spell level), based on the 2024 rules / SRD 5.2.
 * Index 0 = cantrips.
 */
(function (G) {
  var DND = G.DND = G.DND || {};

  function L(s) { return s.split('|'); }

  DND.SPELL_LISTS = {
    bard: [
      L('Blade Ward|Dancing Lights|Friends|Light|Mage Hand|Mending|Message|Minor Illusion|Prestidigitation|Starry Wisp|Thunderclap|True Strike|Vicious Mockery'),
      L('Animal Friendship|Bane|Charm Person|Color Spray|Command|Comprehend Languages|Cure Wounds|Detect Magic|Disguise Self|Dissonant Whispers|Faerie Fire|Feather Fall|Healing Word|Heroism|Hideous Laughter|Identify|Illusory Script|Longstrider|Silent Image|Sleep|Speak with Animals|Thunderwave|Unseen Servant'),
      L('Aid|Animal Messenger|Blindness/Deafness|Calm Emotions|Cloud of Daggers|Crown of Madness|Detect Thoughts|Enhance Ability|Enlarge/Reduce|Heat Metal|Hold Person|Invisibility|Knock|Lesser Restoration|Locate Animals or Plants|Locate Object|Magic Mouth|Mirror Image|Phantasmal Force|See Invisibility|Shatter|Silence|Suggestion|Zone of Truth'),
      L('Bestow Curse|Clairvoyance|Dispel Magic|Fear|Feign Death|Glyph of Warding|Hypnotic Pattern|Major Image|Mass Healing Word|Nondetection|Plant Growth|Sending|Slow|Speak with Dead|Speak with Plants|Stinking Cloud|Tiny Hut|Tongues'),
      L('Charm Monster|Compulsion|Confusion|Dimension Door|Fount of Moonlight|Freedom of Movement|Greater Invisibility|Hallucinatory Terrain|Locate Creature|Phantasmal Killer|Polymorph'),
      L('Animate Objects|Awaken|Dominate Person|Dream|Geas|Greater Restoration|Hold Monster|Legend Lore|Mass Cure Wounds|Mislead|Modify Memory|Planar Binding|Raise Dead|Scrying|Seeming|Synaptic Static|Teleportation Circle'),
      L('Eyebite|Find the Path|Guards and Wards|Heroes\' Feast|Irresistible Dance|Mass Suggestion|Programmed Illusion|True Seeing'),
      L('Arcane Sword|Etherealness|Forcecage|Magnificent Mansion|Mirage Arcane|Prismatic Spray|Project Image|Regenerate|Resurrection|Symbol|Teleport'),
      L('Antipathy/Sympathy|Befuddlement|Dominate Monster|Glibness|Mind Blank|Power Word Stun'),
      L('Foresight|Power Word Heal|Power Word Kill|Prismatic Wall|True Polymorph')
    ],
    cleric: [
      L('Guidance|Light|Mending|Resistance|Sacred Flame|Spare the Dying|Thaumaturgy|Toll the Dead|Word of Radiance'),
      L('Bane|Bless|Command|Create or Destroy Water|Cure Wounds|Detect Evil and Good|Detect Magic|Detect Poison and Disease|Guiding Bolt|Healing Word|Inflict Wounds|Protection from Evil and Good|Purify Food and Drink|Sanctuary|Shield of Faith'),
      L('Aid|Augury|Blindness/Deafness|Calm Emotions|Continual Flame|Enhance Ability|Find Traps|Gentle Repose|Hold Person|Lesser Restoration|Locate Object|Prayer of Healing|Protection from Poison|Silence|Spiritual Weapon|Warding Bond|Zone of Truth'),
      L('Animate Dead|Aura of Vitality|Beacon of Hope|Bestow Curse|Clairvoyance|Create Food and Water|Daylight|Dispel Magic|Feign Death|Glyph of Warding|Magic Circle|Mass Healing Word|Meld into Stone|Protection from Energy|Remove Curse|Revivify|Sending|Speak with Dead|Spirit Guardians|Tongues|Water Walk'),
      L('Aura of Life|Aura of Purity|Banishment|Control Water|Death Ward|Divination|Freedom of Movement|Guardian of Faith|Locate Creature|Stone Shape'),
      L('Circle of Power|Commune|Contagion|Dispel Evil and Good|Flame Strike|Geas|Greater Restoration|Hallow|Insect Plague|Legend Lore|Mass Cure Wounds|Planar Binding|Raise Dead|Scrying|Summon Celestial'),
      L('Blade Barrier|Create Undead|Find the Path|Forbiddance|Harm|Heal|Heroes\' Feast|Planar Ally|Sunbeam|True Seeing|Word of Recall'),
      L('Conjure Celestial|Divine Word|Etherealness|Fire Storm|Plane Shift|Power Word Fortify|Regenerate|Resurrection|Symbol'),
      L('Antimagic Field|Control Weather|Earthquake|Holy Aura|Sunburst'),
      L('Astral Projection|Gate|Mass Heal|Power Word Heal|True Resurrection')
    ],
    druid: [
      L('Druidcraft|Elementalism|Guidance|Mending|Message|Poison Spray|Produce Flame|Resistance|Shillelagh|Spare the Dying|Starry Wisp|Thorn Whip|Thunderclap'),
      L('Animal Friendship|Charm Person|Create or Destroy Water|Cure Wounds|Detect Magic|Detect Poison and Disease|Entangle|Faerie Fire|Fog Cloud|Goodberry|Healing Word|Ice Knife|Jump|Longstrider|Protection from Evil and Good|Purify Food and Drink|Speak with Animals|Thunderwave'),
      L('Aid|Animal Messenger|Augury|Barkskin|Beast Sense|Continual Flame|Darkvision|Enhance Ability|Enlarge/Reduce|Find Traps|Flame Blade|Flaming Sphere|Gust of Wind|Heat Metal|Hold Person|Lesser Restoration|Locate Animals or Plants|Locate Object|Moonbeam|Pass without Trace|Protection from Poison|Spike Growth'),
      L('Aura of Vitality|Call Lightning|Conjure Animals|Daylight|Dispel Magic|Elemental Weapon|Feign Death|Meld into Stone|Plant Growth|Protection from Energy|Revivify|Sleet Storm|Speak with Plants|Summon Fey|Water Breathing|Water Walk|Wind Wall'),
      L('Blight|Charm Monster|Confusion|Conjure Minor Elementals|Conjure Woodland Beings|Control Water|Divination|Dominate Beast|Fire Shield|Fount of Moonlight|Freedom of Movement|Giant Insect|Grasping Vine|Hallucinatory Terrain|Ice Storm|Locate Creature|Polymorph|Stone Shape|Stoneskin|Wall of Fire'),
      L('Antilife Shell|Awaken|Commune with Nature|Cone of Cold|Conjure Elemental|Contagion|Geas|Greater Restoration|Insect Plague|Mass Cure Wounds|Planar Binding|Reincarnate|Scrying|Tree Stride|Wall of Stone'),
      L('Conjure Fey|Find the Path|Flesh to Stone|Heal|Heroes\' Feast|Move Earth|Sunbeam|Transport via Plants|Wall of Thorns|Wind Walk'),
      L('Fire Storm|Mirage Arcane|Plane Shift|Regenerate|Reverse Gravity|Symbol'),
      L('Animal Shapes|Antipathy/Sympathy|Befuddlement|Control Weather|Earthquake|Incendiary Cloud|Sunburst|Tsunami'),
      L('Foresight|Shapechange|Storm of Vengeance|True Resurrection')
    ],
    paladin: [
      [],
      L('Bless|Command|Compelled Duel|Cure Wounds|Detect Evil and Good|Detect Magic|Detect Poison and Disease|Divine Favor|Divine Smite|Heroism|Protection from Evil and Good|Purify Food and Drink|Searing Smite|Shield of Faith|Thunderous Smite|Wrathful Smite'),
      L('Aid|Find Steed|Gentle Repose|Lesser Restoration|Locate Object|Magic Weapon|Prayer of Healing|Protection from Poison|Shining Smite|Warding Bond|Zone of Truth'),
      L('Aura of Vitality|Blinding Smite|Create Food and Water|Crusader\'s Mantle|Daylight|Dispel Magic|Elemental Weapon|Magic Circle|Remove Curse|Revivify'),
      L('Aura of Life|Aura of Purity|Banishment|Death Ward|Locate Creature|Staggering Smite'),
      L('Banishing Smite|Circle of Power|Destructive Wave|Dispel Evil and Good|Geas|Greater Restoration|Raise Dead|Summon Celestial')
    ],
    ranger: [
      [],
      L('Alarm|Animal Friendship|Cure Wounds|Detect Magic|Detect Poison and Disease|Ensnaring Strike|Entangle|Fog Cloud|Goodberry|Hail of Thorns|Hunter\'s Mark|Jump|Longstrider|Speak with Animals'),
      L('Aid|Animal Messenger|Barkskin|Beast Sense|Cordon of Arrows|Darkvision|Enhance Ability|Find Traps|Gust of Wind|Lesser Restoration|Locate Animals or Plants|Locate Object|Magic Weapon|Pass without Trace|Protection from Poison|Silence|Spike Growth|Summon Beast'),
      L('Conjure Animals|Conjure Barrage|Daylight|Elemental Weapon|Lightning Arrow|Meld into Stone|Nondetection|Plant Growth|Protection from Energy|Revivify|Speak with Plants|Summon Fey|Water Breathing|Water Walk|Wind Wall'),
      L('Conjure Woodland Beings|Dominate Beast|Freedom of Movement|Grasping Vine|Locate Creature|Stoneskin|Summon Elemental'),
      L('Commune with Nature|Conjure Volley|Greater Restoration|Steel Wind Strike|Swift Quiver|Tree Stride')
    ],
    sorcerer: [
      L('Acid Splash|Blade Ward|Chill Touch|Dancing Lights|Elementalism|Fire Bolt|Friends|Light|Mage Hand|Mending|Message|Minor Illusion|Poison Spray|Prestidigitation|Ray of Frost|Shocking Grasp|Sorcerous Burst|Thunderclap|True Strike'),
      L('Burning Hands|Charm Person|Chromatic Orb|Color Spray|Comprehend Languages|Detect Magic|Disguise Self|Expeditious Retreat|False Life|Feather Fall|Fog Cloud|Grease|Ice Knife|Jump|Mage Armor|Magic Missile|Ray of Sickness|Shield|Silent Image|Sleep|Thunderwave|Witch Bolt'),
      L('Alter Self|Arcane Vigor|Blindness/Deafness|Blur|Cloud of Daggers|Crown of Madness|Darkness|Darkvision|Detect Thoughts|Dragon\'s Breath|Enhance Ability|Enlarge/Reduce|Flame Blade|Flaming Sphere|Gust of Wind|Hold Person|Invisibility|Knock|Levitate|Magic Weapon|Mind Spike|Mirror Image|Misty Step|Phantasmal Force|Scorching Ray|See Invisibility|Shatter|Spider Climb|Suggestion|Web'),
      L('Blink|Clairvoyance|Counterspell|Daylight|Dispel Magic|Fear|Fireball|Fly|Gaseous Form|Haste|Hypnotic Pattern|Lightning Bolt|Major Image|Protection from Energy|Sleet Storm|Slow|Stinking Cloud|Tongues|Vampiric Touch|Water Breathing|Water Walk'),
      L('Banishment|Blight|Charm Monster|Confusion|Dimension Door|Dominate Beast|Fire Shield|Greater Invisibility|Ice Storm|Polymorph|Stoneskin|Vitriolic Sphere|Wall of Fire'),
      L('Animate Objects|Cloudkill|Cone of Cold|Creation|Dominate Person|Hold Monster|Insect Plague|Seeming|Synaptic Static|Telekinesis|Teleportation Circle|Wall of Stone'),
      L('Arcane Gate|Chain Lightning|Circle of Death|Disintegrate|Eyebite|Flesh to Stone|Globe of Invulnerability|Mass Suggestion|Move Earth|Sunbeam|True Seeing'),
      L('Delayed Blast Fireball|Etherealness|Finger of Death|Fire Storm|Plane Shift|Prismatic Spray|Reverse Gravity|Teleport'),
      L('Demiplane|Dominate Monster|Earthquake|Incendiary Cloud|Power Word Stun|Sunburst'),
      L('Gate|Mass Polymorph|Meteor Swarm|Power Word Kill|Time Stop|Wish')
    ],
    warlock: [
      L('Blade Ward|Chill Touch|Eldritch Blast|Friends|Mage Hand|Mind Sliver|Minor Illusion|Poison Spray|Prestidigitation|Thunderclap|Toll the Dead|True Strike'),
      L('Armor of Agathys|Arms of Hadar|Bane|Charm Person|Comprehend Languages|Detect Magic|Expeditious Retreat|Hellish Rebuke|Hex|Hideous Laughter|Illusory Script|Protection from Evil and Good|Speak with Animals|Unseen Servant|Witch Bolt'),
      L('Cloud of Daggers|Crown of Madness|Darkness|Enthrall|Hold Person|Invisibility|Mind Spike|Mirror Image|Misty Step|Ray of Enfeeblement|Spider Climb|Suggestion'),
      L('Counterspell|Dispel Magic|Fear|Fly|Gaseous Form|Hunger of Hadar|Hypnotic Pattern|Magic Circle|Major Image|Remove Curse|Summon Fey|Summon Undead|Tongues|Vampiric Touch'),
      L('Banishment|Blight|Charm Monster|Dimension Door|Hallucinatory Terrain|Summon Aberration'),
      L('Contact Other Plane|Dream|Hold Monster|Mislead|Planar Binding|Scrying|Synaptic Static|Teleportation Circle'),
      L('Arcane Gate|Circle of Death|Create Undead|Eyebite|Summon Fiend|True Seeing'),
      L('Etherealness|Finger of Death|Forcecage|Plane Shift'),
      L('Befuddlement|Demiplane|Dominate Monster|Glibness|Power Word Stun'),
      L('Astral Projection|Foresight|Gate|Imprisonment|Power Word Kill|True Polymorph|Weird')
    ],
    wizard: [
      L('Acid Splash|Blade Ward|Chill Touch|Dancing Lights|Elementalism|Fire Bolt|Friends|Light|Mage Hand|Mending|Message|Mind Sliver|Minor Illusion|Poison Spray|Prestidigitation|Ray of Frost|Shocking Grasp|Thunderclap|Toll the Dead|True Strike'),
      L('Alarm|Burning Hands|Charm Person|Chromatic Orb|Color Spray|Comprehend Languages|Detect Magic|Disguise Self|Expeditious Retreat|False Life|Feather Fall|Find Familiar|Floating Disk|Fog Cloud|Grease|Hideous Laughter|Ice Knife|Identify|Illusory Script|Jump|Longstrider|Mage Armor|Magic Missile|Protection from Evil and Good|Ray of Sickness|Shield|Silent Image|Sleep|Thunderwave|Unseen Servant|Witch Bolt'),
      L('Acid Arrow|Alter Self|Arcane Lock|Arcane Vigor|Arcanist\'s Magic Aura|Augury|Blindness/Deafness|Blur|Cloud of Daggers|Continual Flame|Crown of Madness|Darkness|Darkvision|Detect Thoughts|Dragon\'s Breath|Enhance Ability|Enlarge/Reduce|Flaming Sphere|Gentle Repose|Gust of Wind|Hold Person|Invisibility|Knock|Levitate|Locate Object|Magic Mouth|Magic Weapon|Mind Spike|Mirror Image|Misty Step|Phantasmal Force|Ray of Enfeeblement|Rope Trick|Scorching Ray|See Invisibility|Shatter|Spider Climb|Suggestion|Web'),
      L('Animate Dead|Bestow Curse|Blink|Clairvoyance|Counterspell|Dispel Magic|Fear|Feign Death|Fireball|Fly|Gaseous Form|Glyph of Warding|Haste|Hypnotic Pattern|Lightning Bolt|Magic Circle|Major Image|Nondetection|Phantom Steed|Protection from Energy|Remove Curse|Sending|Sleet Storm|Slow|Speak with Dead|Stinking Cloud|Summon Fey|Summon Undead|Tiny Hut|Tongues|Vampiric Touch|Water Breathing'),
      L('Arcane Eye|Banishment|Black Tentacles|Blight|Charm Monster|Confusion|Conjure Minor Elementals|Control Water|Dimension Door|Divination|Fabricate|Faithful Hound|Fire Shield|Greater Invisibility|Hallucinatory Terrain|Ice Storm|Locate Creature|Phantasmal Killer|Polymorph|Private Sanctum|Resilient Sphere|Secret Chest|Stone Shape|Stoneskin|Summon Aberration|Summon Construct|Summon Elemental|Vitriolic Sphere|Wall of Fire'),
      L('Animate Objects|Arcane Hand|Cloudkill|Cone of Cold|Conjure Elemental|Contact Other Plane|Creation|Dominate Person|Dream|Geas|Hold Monster|Legend Lore|Mislead|Modify Memory|Passwall|Planar Binding|Scrying|Seeming|Steel Wind Strike|Summon Dragon|Synaptic Static|Telekinesis|Teleportation Circle|Wall of Force|Wall of Stone'),
      L('Arcane Gate|Chain Lightning|Circle of Death|Contingency|Create Undead|Disintegrate|Eyebite|Flesh to Stone|Freezing Sphere|Globe of Invulnerability|Guards and Wards|Instant Summons|Irresistible Dance|Magic Jar|Mass Suggestion|Move Earth|Programmed Illusion|Summon Fiend|Sunbeam|True Seeing'),
      L('Arcane Sword|Delayed Blast Fireball|Etherealness|Finger of Death|Forcecage|Magnificent Mansion|Mirage Arcane|Plane Shift|Prismatic Spray|Project Image|Reverse Gravity|Sequester|Simulacrum|Symbol|Teleport'),
      L('Antimagic Field|Antipathy/Sympathy|Befuddlement|Clone|Control Weather|Demiplane|Dominate Monster|Incendiary Cloud|Maze|Mind Blank|Power Word Stun|Sunburst|Telepathy'),
      L('Astral Projection|Foresight|Gate|Imprisonment|Meteor Swarm|Power Word Kill|Prismatic Wall|Shapechange|Time Stop|True Polymorph|Weird|Wish')
    ]
  };

  // Lookup: spell name -> lowest level it appears at.
  DND.SPELL_LEVEL = {};
  Object.keys(DND.SPELL_LISTS).forEach(function (cls) {
    DND.SPELL_LISTS[cls].forEach(function (names, lvl) {
      names.forEach(function (n) {
        if (DND.SPELL_LEVEL[n] === undefined || DND.SPELL_LEVEL[n] > lvl) DND.SPELL_LEVEL[n] = lvl;
      });
    });
  });

  // Choice options for spells from one or more class lists between two spell levels.
  DND.spellOptions = function (lists, minLvl, maxLvl) {
    if (!Array.isArray(lists)) lists = [lists];
    var seen = {}, out = [];
    for (var lvl = minLvl; lvl <= maxLvl; lvl++) {
      lists.forEach(function (cls) {
        (DND.SPELL_LISTS[cls][lvl] || []).forEach(function (n) {
          if (seen[n]) return;
          seen[n] = true;
          out.push({ id: n, label: n, group: lvl === 0 ? 'Cantrips' : 'Level ' + lvl });
        });
      });
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
