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
- **Advisor tab**: answers questions about the character by calculating from the sheet. No AI model, nothing sent anywhere, works offline, and it can be turned off (the tab then shows only a switch to turn it back on).
  - **Ask about this character**: looks up numbers (AC and how it's worked out, saves, skills, save DC), what's left (uses, spell slots, Hit Dice), and features, traits, feats, spells and conditions by name. Level-up and turn questions are pointed to the cards below.
  - **This turn**: ranks the Attack action, cantrips and spells by average damage, using the slots and uses that remain.
    - Averages count misses, critical hits, saves (with half damage where the spell says so), multiple attacks, rays and darts, Sneak Attack, and area spells times the number of enemies you enter.
    - Target AC defaults to a typical opponent of the character's level (the median SRD creature of that CR) and can be set; Advantage or Disadvantage can be chosen.
    - It applies conditions and Exhaustion from the Play tab, notes Action Surge, lists Bonus Action and Reaction features, and suggests ways to recover when HP is low.
    - It can't see the battlefield, and says so.
  - **Level-up advice**: for any feat slot, every option (+2 to a stat, +1/+1, each feat) is applied to a copy of the build and re-evaluated by the engine, then compared: damage per round, to hit, save DC, HP, AC, initiative, saves and skills. **Choose** applies an option. Benefits that exist only as text are flagged as not measured.
  - Shortcuts: **What should I do this turn?** on the Play tab, and **Compare the options** next to feat choices on the Build tab.
- **Play tab**: track a character during a session at the viewed level.
  - **Health**: HP and temp HP bars with Damage, Heal and Temp HP (temp HP absorbs damage first), death saves at 0 HP, a temporary AC bonus, Exhaustion and Heroic Inspiration.
  - **Conditions**: toggle the conditions affecting you. Each has its icon and Immune/Advantage badges from your build. Active ones list their rules here and appear as icon chips in the summary panel on every tab.
  - **Turn markers**: Action, Bonus Action, Reaction, each attack of the Attack action, and once-per-turn features such as Sneak Attack. **Next turn** clears them.
  - **Limited uses**: class resources (Rages, Focus Points, Channel Divinity, Second Wind, Sorcery Points…), Lay On Hands and Bardic Inspiration pools, and features or traits usable once, a Proficiency Bonus number of times, or an ability modifier number of times per rest (Breath Weapon, Stonecunning, Wholeness of Body…). Each is tagged Short or Long Rest. Species traits gained at a later level appear from that level.
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
- Multiple saved builds, Duplicate (to compare variants), and Export/Import as JSON text. Export has two modes: **This character**, or **Everything (backup)** with all characters, encounters, your creatures and the party. Importing a backup only adds what's missing; it never overwrites. Imported data is checked and repaired before it's used.
- **Profiles**: the Profile menu in the header chooses which tools show: **Player**, **Game Master**, or **Player + GM**. New users are asked once.
- **Rulesets**: each character uses either the **2024 rules** or **Legacy content**, chosen when it's created (New). Legacy characters can also pick 2014 classes, species, backgrounds, feats and spells from an imported compendium, plus 2014 subclasses republished for 2024 classes (named "(Legacy)", as in FightClub5eXML's Legacy_5e set). The choice is locked: a 2024 character can't switch to Legacy. A Legacy character can be upgraded to the 2024 rules from the Build tab. The upgrade swaps each 2014 pick for its 2024 version (including renamed subclasses such as Way of Shadow → Warrior of Shadow), rebuilds every level, clears choices that no longer exist and lists anything to choose again. It can upgrade the character in place or a copy. Builds saved before rulesets existed count as Legacy if they use 2014 content.

## Game Master tools

Shown with the Game Master or Player + GM profile.

- **Party**: link characters saved in the app (their level, AC, HP, initiative and Passive Perception follow the character) or add players by hand. With no party set up, encounters use a quick party of N characters at one level.
- **Encounters**: build encounters from the bestiary. The creature list shows CR and XP and can filter to what still fits the Low, Moderate or High budget.
  - **Difficulty** follows the 2024 encounter rules: each character has an XP budget by level for Low, Moderate and High difficulty; the party's budget is the sum, and the creatures' XP is spent against it. There are no multipliers for group size.
  - A meter shows where the encounter lands, the XP each character earns, and cautions from the rules' troubleshooting guidance: more than two creatures per character, a creature whose CR is above the party's level, many CR 0 creatures, and more than three stat blocks.
  - The budget table was checked row by row against the SRD 5.2 text, and the SRD's three worked examples give the same totals here. The rules assume one party level; for mixed-level parties each character's budget uses their own level.
- **Run**: an initiative tracker for the chosen encounter.
  - Starting it rolls initiative for the creatures (identical creatures can share a roll) and can roll their Hit Points instead of using the average. Enter the players' rolls, or roll for the blanks.
  - Each combatant has HP with Hit and Heal, conditions with their icons, and Defeat/Revive. **Next turn** skips defeated creatures and counts rounds.
  - The stat block of whoever's turn it is shows below the tracker; attack rolls and damage in it are clickable and roll into the dice tray.
  - Add creatures or anyone else mid-fight. XP earned so far is totalled and split between the characters.
  - For linked characters, HP and conditions changed in the tracker are written back to the character, so their Play tab and summary panel agree with it.
- **Creatures**: build your own creatures, or start from any existing one. They join the bestiary for encounters and companions.
  - The form covers size, type, CR, AC, Hit Dice (HP is worked out from size and Constitution), abilities and save proficiencies, senses, defenses, and traits, actions, bonus actions, reactions and legendary actions. **Quick attack** writes an attack with the right attack bonus and average damage.
  - **Power check** compares the creature's Hit Points, AC, attack bonus, save DC and damage per round with a typical creature of its CR, and estimates a defensive, offensive and overall CR. "Typical" is the median of the SRD creatures at each CR, and damage per round is read from the action text (multiattack, recharge and legendary actions included). It's an estimate: traits, resistances and spells aren't counted.

The rules data is in `js/gm-rules.js` (`DND.XP_BUDGET`, `DND.encounterDifficulty`, `DND.monsterStats`, `DND.crBenchmarks`, `DND.estimateCR`).

## Install and offline use

The hosted copy (GitHub Pages) is an installable app that works offline:

- **Install:** on Chrome, Edge and Android, use **Install app** in the header (or the browser's install option). On iPhone and iPad, **Install app** shows the steps: Share → **Add to Home Screen**. Installed, it opens full screen from its own icon.
- **Offline:** after the first visit everything works without a connection (JSZip is bundled in `js/vendor/`; only the web fonts come from a CDN, with system fonts as the fallback), including your builds, the SRD content, an imported compendium, dice and the Play tab. Only importing from GitHub needs a connection, and an **Offline** badge shows in the header while you're disconnected.
- **Updates:** files are served from the cache and refreshed in the background. When a new version has been downloaded, an **Update ready · Reload** button appears.

The service worker is `sw.js`, the manifest is `manifest.webmanifest`, and the icons in `icons/` are drawn by `tools/make-icons.py`. When adding or removing app files, update the list in `sw.js` and bump its `CACHE` name.

## Content

Built in (SRD 5.2, the CC-BY part of the 2024 rules):

- The 12 classes with full mechanics, each with its SRD subclass, plus the SRD species, backgrounds and feats
- 336 spells, 1,251 items and magic items, and 332 creatures with full text, in `js/data/srd-content.js`

### Importing more content

Library → **Import compendium files** accepts Fight Club 5 / Game Master 5 compendium XML (or a .zip of XML files). Examples are the collections built by the [FightClub5eXML](https://github.com/vidalvanbergen/FightClub5eXML) project, or the individual files in its `Sources/` folders (select several at once). The project's `Collections/*.xml` files are only indexes; build them with its `build-collections` script first, or import the `Sources/` files directly.

**Or import from GitHub**, without downloading anything first. Paste a public repository link (FightClub5eXML is filled in), a folder link (`…/tree/branch/path`) or a single `.xml` file link.

- **Choosing what to import:** for a repository you pick one of its collections (for example *Core Rulebooks 5.5e* or *WotC 5.5e + Legacy 5e*), a single book, or every `.xml` file.
- **How files are fetched:** collection and source index files are followed to the compendium files they list. Those files then download from `raw.githubusercontent.com` straight into the browser.
- **Staying up to date:** **Update from GitHub** re-imports the same selection to pick up changes.
- **API limits:** listing a repository uses one GitHub API call, which is rate-limited to 60 per hour without signing in. If it's unavailable, FightClub5eXML's usual collections are still offered. Importing never needs the API.

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
| `js/play.js` | Dice roller, limited-use detection for the Play tab, spell damage parsing |
| `js/github.js` | Import compendium XML from a GitHub repository, folder or file link |
| `js/gm-rules.js` | Encounter XP budgets and difficulty, stat-block statistics, CR estimate, custom creatures |
| `js/gm.js` | Game Master screens: party, encounters, initiative tracker, creature builder |
| `js/advisor.js` | Advisor: hit and damage maths, level-up simulation, turn ranking, sheet lookup, and its screen |
| `js/print.js` | Printable character sheet and plain-text export |
| `js/app.js` | UI rendering, events, persistence |
| `js/vendor/jszip.min.js` | JSZip 3.10.1 (MIT), for .zip compendium imports |
| `sw.js`, `manifest.webmanifest` | Offline cache and install metadata |
| `tools/build-srd.js` | Builds `js/data/srd-content.js` |
| `tools/make-icons.py` | Draws the app icons in `icons/` |

To add hand-built content (a new subclass, feat or species), add an entry to the data files. Each feature can declare `choices` (a select or multi-pick, with options that can carry their own sub-choices) and an `apply(state)` effect. The engine handles the rest.


## Credits and licenses

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

SRD spell, item and creature data was converted from the FightClub5eXML project (MIT License, © Chris Jennewein and contributors).
