# Levelwright: D&D 2024 character planner

A Pathbuilder-style build planner for the 2024 (5.5e) rules. Pick a class, species and background, then make every choice for levels 1 to 20 on one timeline. You can jump to any level and see the character as it stands there.

Open `index.html` in a browser. It needs no build step or server, and builds are saved in the browser's localStorage.

**Hosted copy (GitHub Pages):** https://revamped.github.io/Skeleton/builder/

This copy can print and save PDFs. To turn it on (once), go to the repository's **Settings → Pages**, choose **Deploy from a branch**, pick the branch that has this folder (and **/ (root)**), then save. If you later merge into `master`, switch the branch there. The `.nojekyll` file at the repository root tells Pages to serve the files as they are. Builds saved in one browser copy don't appear in another. Inside the Claude artifact viewer, the printable sheet has an **Open this build on GitHub Pages** link that carries the current build over.

## What it does

- **Build tab**: the origin (class, species, background, ability scores by standard array, point buy or manual) plus a card for each of the 20 levels. Each card lists that level's features and the choices to make there: skills, subclass, feats/ASIs, fighting styles, weapon masteries, expertise, invocations, metamagic, maneuvers, Mystic Arcanum and so on. Open choices are flagged in red, both on the card and on the level rail in the header.
- **Level rail**: click any level (or press ← / →) to view the character at that point. Every choice can be changed at any time, and everything downstream updates.
- **Multiclassing**: each level card has a **Class** button for choosing which class gains that level (just that level, or that level through 20). Levels you don't change follow the main class. The engine follows the 2024 multiclass rules:
  - class features and choices use the class level, and proficiency bonus uses the total level
  - hit points use each class's hit die
  - saving throws come only from the first class, and a new class grants its limited multiclass proficiencies
  - each class's ability requirement (13+) is checked
  - spell slots combine across casters (full, half rounded up, third for Eldritch Knight/Arcane Trickster), with Pact Magic kept separate
  - each casting class keeps its own spell DC, cantrips and prepared spells
  - Extra Attack and Unarmored Defense don't stack
  - imported classes read their requirements and proficiencies from the compendium's multiclass text
- **Sheet tab**: AC, HP, saves, skills, attacks, class resources, proficiencies and the features gained so far, all computed for the viewed level.
- **Play tab**: track a character during a session at the viewed level.
  - **Health**: HP and temp HP bars with Damage, Heal and Temp HP (temp HP absorbs damage first), death saves at 0 HP, a temporary AC bonus, Exhaustion and Heroic Inspiration.
  - **Conditions**: toggle the conditions affecting you. Each has its icon and Immune/Advantage badges from your build. Active ones list their rules here and appear as icon chips in the summary panel on every tab.
  - **Turn markers**: Action, Bonus Action, Reaction, each attack of the Attack action, and once-per-turn features such as Sneak Attack. **Next turn** clears them.
  - **Limited uses**: class resources (Rages, Focus Points, Channel Divinity, Second Wind, Sorcery Points…), Lay On Hands and Bardic Inspiration pools, and features or traits usable once or a few times per rest. Each is tagged Short or Long Rest.
  - **Spell slots and Pact slots**, plus a spell list where **Cast** spends a slot and rolls the damage or healing scaled to that slot. Cantrips scale with level.
  - **Hit Dice**: spend them to heal (they roll the die plus your Con modifier).
  - **Short and Long Rest buttons**: restore what each rest restores.
  - **Your trackers**: custom counters (potions, Luck points…) that reset on a turn, a rest, or manually.
- **Dice**: click any attack bonus, damage, save, skill, ability check, initiative, class die (Sneak Attack, Martial Arts…) or any dice in feature, spell, item or creature text to roll it. Rolls go to a dice tray (bottom right) with Advantage/Disadvantage for d20 rolls, a Critical hit toggle that doubles damage dice, quick d4–d100 buttons and a roll history. The summary panel shows the HP bar on every tab.
- **Printable sheet** (Sheet tab → Printable sheet): a two-page, letter-size character sheet for the viewed level:
  - abilities and saves, skills, combat stats, HP/death-save boxes, attacks, class resources and proficiencies
  - features and traits, with an option for full text
  - spellcasting per class with slot bubbles, plus equipment with coin boxes, companions and note lines
  - **Print / Save as PDF** uses the browser's print dialog
  - **Copy as text** gives a compact plain-text version for notes or VTTs
  - the Claude artifact viewer blocks printing; use the GitHub Pages copy or open `index.html` locally
- **Gear tab**: armor, shield and weapons (including magic weapons and armor with their bonuses) plus an inventory. Equipped (and attuned) items apply their effects: AC, saving throws, spell attack/DC, speed, initiative, and items that set an ability score. Weight, carrying capacity and the three-item attunement limit are tracked.
- **Spells tab**: cantrips and prepared spells checked against the viewed level. Click a spell for its full text. Legacy characters can also include 2014 spells from an imported compendium.
  - **Per-level learning and swapping:** edits apply at the class level you're viewing and carry forward until a later level changes them.
  - **Change tracking:** each level shows what was learned (+) and swapped out (−), on the Spells tab, in a per-class spell history and on the level cards.
  - **Swap rules:** Bard, Sorcerer, Warlock and imported spells-known casters can replace one spell per level. Every caster can replace one cantrip per level. Extra swaps are flagged.
  - **Planning ahead:** spells you can't cast yet stay in the list and show the level where they unlock.
- **Companions tab**: familiars, steeds, summons, animated minions, hirelings, sidekicks and Wild Shape forms, each with a full stat block. Suggestions come from the build's spells and features (Find Familiar, Find Steed, Summon spells, Animate Dead, Pact of the Chain, Beast Master, druid Wild Shape by CR).
- **All 20 levels**: one table with PB, HP, AC, ability scores, features and your choices, the class table columns and spell slots for every level.
- **Library**: search and filter spells, items, creatures, feats, species, backgrounds and classes, and open any entry in full.
- Multiple saved builds, Duplicate (to compare variants), and Export/Import as JSON text.
- **Rulesets**: each character uses either the **2024 rules** or **Legacy content**, chosen when it's created (New). Legacy characters can also pick 2014 classes, species, backgrounds, feats and spells from an imported compendium, plus 2014 subclasses republished for 2024 classes (named "(Legacy)", as in FightClub5eXML's Legacy_5e set). The choice is locked: a 2024 character can't switch to Legacy. A Legacy character can be upgraded to the 2024 rules from the Build tab. The upgrade swaps each 2014 pick for its 2024 version (including renamed subclasses such as Way of Shadow → Warrior of Shadow), rebuilds every level, clears choices that no longer exist and lists anything to choose again. It can upgrade the character in place or a copy. Builds saved before rulesets existed count as Legacy if they use 2014 content.

## Content

Built in (SRD 5.2, the CC-BY part of the 2024 rules):

- The 12 classes with full mechanics, each with its SRD subclass, plus the SRD species, backgrounds and feats
- 336 spells, 1,251 items and magic items, and 332 creatures with full text, in `js/data/srd-content.js`

### Importing more content

Library → **Import compendium files** accepts Fight Club 5 / Game Master 5 compendium XML (or a .zip of XML files). Examples are the collections built by the [FightClub5eXML](https://github.com/vidalvanbergen/FightClub5eXML) project, or the individual files in its `Sources/` folders (select several at once). The project's `Collections/*.xml` files are only indexes; build them with its `build-collections` script first, or import the `Sources/` files directly.

Imported files are parsed in the browser and stored only in that browser (IndexedDB). They are never uploaded or added to this repository. What imports add:

- **2024 (5.5e) subclasses** for the 12 classes (Battle Master, Eldritch Knight, College of Valor, Circle of the Moon and so on) attach to the built-in classes. Their always-prepared spells, spellcasting (Eldritch Knight, Arcane Trickster), resource counters and option lists (maneuvers, invocations, metamagic) are wired up.
- **Other classes** (2014 classes and their subclasses, Artificer, Blood Hunter, sidekicks, playtest classes) become selectable classes. Hit dice, proficiencies, spell slots, prepared or known spell counts, resources, ASI levels and option groups such as fighting styles all come from the XML.
- **Species, backgrounds and feats**: 2024 backgrounds give their ability choices and origin feat. 2014 species apply their ability increases, with a warning if combined with a 2024 background. Feats that raise ability scores apply.
- **Spells, items, magic items and creatures** for the spell lists, Gear, Companions and Library.

Builds that use imported content remember it by ID. On a browser without that compendium, the app shows a notice and a stand-in until it is imported again.

### Regenerating the SRD bundle

```
git clone https://github.com/vidalvanbergen/FightClub5eXML
node tools/build-srd.js ./FightClub5eXML
```

## Code layout

| File | Role |
| --- | --- |
| `js/data/rules.js` | Abilities, skills, armor, weapons and masteries, feats, species, backgrounds, spell-slot tables |
| `js/data/spells.js` | Class spell lists by spell level |
| `js/data/classes.js` | Class and subclass progressions: features, choices, effects |
| `js/data/srd-content.js` | Generated SRD 5.2 spells, items and creatures |
| `js/engine.js` | Replays a build from origin to level 20 and produces a snapshot per level |
| `js/fc5.js` | Dependency-free reader for Fight Club 5 compendium XML (browser and Node) |
| `js/content.js` | Merges SRD and imported content into the builder; import and IndexedDB storage |
| `js/icons.js` | Line icons for classes, species, backgrounds, weapons, armor and items, and the name-matching rules that pick them |
| `js/print.js` | Printable character sheet and plain-text export |
| `js/app.js` | UI rendering, events, persistence |
| `tools/build-srd.js` | Builds `js/data/srd-content.js` |

To add hand-built content (a new subclass, feat or species), add an entry to the data files. Each feature can declare `choices` (a select or multi-pick, with options that can carry their own sub-choices) and an `apply(state)` effect. The engine handles the rest.


## Credits and licenses

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

SRD spell, item and creature data was converted from the FightClub5eXML project (MIT License, © Chris Jennewein and contributors).
