# Levelwright: D&D 2024 character planner

A Pathbuilder-style build planner for the 2024 (5.5e) rules. Pick a class, species and background, then make every choice for levels 1 to 20 on one timeline. You can jump to any level and see the character as it stands there.

Open `index.html` in a browser. It needs no build step or server, and builds are saved in the browser's localStorage.

## What it does

- **Build tab**: the origin (class, species, background, ability scores by standard array, point buy or manual) plus a card for each of the 20 levels. Each card lists that level's features and the choices to make there: skills, subclass, feats/ASIs, fighting styles, weapon masteries, expertise, invocations, metamagic, Mystic Arcanum and so on. Open choices are flagged in red, both on the card and on the level rail in the header.
- **Level rail**: click any level (or press ← / →) to view the character at that point. Every choice can be changed at any time, and everything downstream updates.
- **Sheet tab**: AC, HP, saves, skills, attacks (from your chosen armor and weapons), class resources, proficiencies and the features gained so far, all computed for the viewed level.
- **Spells tab**: cantrips and prepared spells checked against the viewed level. Spells you can't cast yet stay in your plan and show the level where they unlock. Always-prepared subclass, species and feat spells are listed separately.
- **All 20 levels**: one table with PB, HP, AC, ability scores, features and your choices, the class table columns and spell slots for every level.
- Multiple saved builds, Duplicate (to compare variants), and Export/Import as JSON text.

## Content

Content is limited to the SRD 5.2 (CC-BY-4.0), the openly licensed subset of the 2024 Basic Rules:

- All 12 classes, each with its SRD subclass (Berserker, Lore, Life, Land, Champion, Open Hand, Devotion, Hunter, Thief, Draconic, Fiend, Evoker)
- 9 species, 4 backgrounds plus a custom background, and the SRD feats and Epic Boons

Feature text is paraphrased for quick reference; check the rules for exact wording.

## Code layout

| File | Role |
| --- | --- |
| `js/data/rules.js` | Abilities, skills, armor, weapons and masteries, feats, species, backgrounds, spell-slot tables |
| `js/data/spells.js` | Class spell lists by spell level |
| `js/data/classes.js` | Class and subclass progressions: features, choices, effects |
| `js/engine.js` | Replays a build from origin to level 20 and produces a snapshot per level |
| `js/app.js` | UI rendering, events, persistence |

To add content (a new subclass, feat or species), add an entry to the data files. Each feature can declare `choices` (a select or multi-pick, with options that can carry their own sub-choices) and an `apply(state)` effect. The engine handles the rest.

Not yet supported: multiclassing, inventory beyond armor and weapons, and per-level spell swapping.
