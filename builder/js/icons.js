/*
 * Minimal line icons (24×24, stroke = currentColor) for classes, species,
 * backgrounds, weapons, armor and items, plus helpers that pick one by name.
 */
(function (G) {
  var DND = G.DND = G.DND || {};

  var I = {
    /* Classes */
    barbarian: '<path d="M12 3v18"/><path d="M12 6C9 3.5 5 4 3.5 7c2 2.5 6 3 8.5 1"/><path d="M12 6c3-2.5 7-2 8.5 1-2 2.5-6 3-8.5 1"/>',
    bard: '<circle cx="9" cy="15" r="5"/><circle cx="9" cy="15" r="1.3"/><path d="M12.5 11.5 19 5"/><path d="m17.5 3.5 3 3"/>',
    cleric: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    druid: '<path d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14z"/><path d="M5 19 14 10"/>',
    fighter: '<path d="M5 3l11 11M19 3 8 14"/><path d="M13.5 16.5 17 13M10.5 16.5 7 13"/><path d="m16 15 3 3M8 15l-3 3"/>',
    monk: '<circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9"/><circle cx="12" cy="7.5" r=".9"/><circle cx="12" cy="16.5" r=".9"/>',
    paladin: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/><path d="M12 8v8M9 11h6"/>',
    ranger: '<path d="M7 3c7 3 7 15 0 18"/><path d="M7 3v18"/><path d="M3 12h16"/><path d="m16 9 3 3-3 3"/>',
    rogue: '<path d="M12 3c-4 0-7 4-7 9v8h14v-8c0-5-3-9-7-9z"/><path d="M8.5 13a3.5 3.5 0 0 1 7 0v3h-7z"/><path d="M10.5 14.5h.01M13.5 14.5h.01"/>',
    sorcerer: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6.5 1 1 2 2 3 2.5 0-2-1-4 0-6z"/>',
    warlock: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/><path d="M12 9.5v5"/>',
    wizard: '<path d="M3 19h18"/><path d="M6.5 19 12 3l5.5 16"/><path d="m11 11 1-1 1 1-1 1z"/>',
    artificer: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/><circle cx="12" cy="12" r="6.5"/>',
    bloodhunter: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    sidekick: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4 3-6 6-6s5.5 2 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14c2.5 0 5 1.5 5.5 5"/>',
    d20: '<path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9z"/><path d="M12 2.5 7 15h10z"/><path d="M3.5 7.5 7 15l-3.5 1.5M20.5 7.5 17 15l3.5 1.5M7 15l5 6.5 5-6.5"/>',

    /* Species */
    dragonborn: '<path d="M5 21c0-7 2.5-12.5 6.5-17"/><path d="M10.5 21c0-6 1.8-10.5 5-14"/><path d="M16 21c0-4.5 1.3-8 4-10.5"/>',
    dwarf: '<path d="M6 9.5a6 6 0 0 1 12 0"/><path d="M6 9.5h12"/><path d="M7 9.5c0 4.5 1.5 7 5 11.5 3.5-4.5 5-7 5-11.5"/><path d="M10 13h4"/>',
    elf: '<path d="M18 3c-6.5 2-10.5 6-10.5 11 0 4 2 7 5 7 2 0 3.2-1.5 3.2-3.4 0-1.6-1.1-2.6-1.1-4.2 0-3 1.8-6 3.4-10.4z"/><path d="M10.5 13.5c1.6-.4 3 .6 3 2.2"/>',
    gnome: '<path d="M12 2.5 17.5 12h-11z"/><path d="M5 12h14"/><circle cx="12" cy="16.5" r="4"/><path d="M12 15.5v2"/>',
    goliath: '<path d="M2.5 19.5 9 8.5l3.5 5 3-5 6 11z"/><path d="m7 12 2 1.5 1.5-1"/>',
    halfling: '<path d="M8 21c-2.5 0-3-3-2-6 1-2.5 1-5 3.5-5.5S14 11 13.5 14c-.4 3 .5 4.5-.5 6-1 1.2-3 1-5 1z"/><circle cx="16.5" cy="9" r="1.4"/><circle cx="14" cy="5.5" r="1.4"/><circle cx="10.5" cy="4.5" r="1.4"/><circle cx="18.5" cy="13" r="1.2"/>',
    human: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20.5c1-4.5 4-6.5 7-6.5s6 2 7 6.5"/>',
    orc: '<path d="M5.5 9c0 7 3 11.5 6.5 11.5S18.5 16 18.5 9"/><path d="M5.5 9C6 5.5 8.5 3.5 12 3.5S18 5.5 18.5 9"/><path d="M9 16.5 8.3 12.5M15 16.5l.7-4"/><path d="M9 10h1.5M13.5 10H15"/>',
    tiefling: '<circle cx="12" cy="14" r="6"/><path d="M8 9.5C6 8 5.5 5 7 2.5c.5 2.5 2 3.5 3.5 5"/><path d="M16 9.5c2-1.5 2.5-4.5 1-7-.5 2.5-2 3.5-3.5 5"/>',
    aasimar: '<ellipse cx="12" cy="4.5" rx="5" ry="1.8"/><circle cx="12" cy="11.5" r="3.2"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6"/>',
    feather: '<path d="M19 3C11 4 6 10 6 17l-1.5 4"/><path d="M19 3c0 7-4 13-11 14"/><path d="M9.5 13.5 14 9M8 16.5l3-1.5"/>',
    paw: '<path d="M8 15.5c0-2.5 2-4.5 4-4.5s4 2 4 4.5-1.8 4-4 4-4-1.5-4-4z"/><circle cx="6" cy="10" r="1.6"/><circle cx="9.5" cy="6.5" r="1.6"/><circle cx="14.5" cy="6.5" r="1.6"/><circle cx="18" cy="10" r="1.6"/>',
    aquatic: '<path d="M3 12c3-4 8-5.5 12-3.5l4-3v13l-4-3C11 17.5 6 16 3 12z"/><circle cx="7.5" cy="11" r=".8"/>',
    construct: '<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 10.5h.01M15 10.5h.01"/><path d="M9 14.5h6"/><path d="M12 6V3M10 3h4"/>',
    fey: '<path d="M12 12c-2-5-6-7-9-5 0 4 4 6 9 5z"/><path d="M12 12c2-5 6-7 9-5 0 4-4 6-9 5z"/><path d="M12 12c-1.5 3-4 5-6.5 5 .5-2.5 3-4.5 6.5-5zM12 12c1.5 3 4 5 6.5 5-.5-2.5-3-4.5-6.5-5z"/><path d="M12 8v9"/>',
    mask: '<path d="M4 6c5-2 11-2 16 0 0 7-3.5 12-8 12S4 13 4 6z"/><path d="M7.5 10c1-1 2.5-1 3.5 0M13 10c1-1 2.5-1 3.5 0"/><path d="M10 14.5c1.3.8 2.7.8 4 0"/>',
    horns: '<path d="M7 14c-3-1-4.5-5-3-9 1 3 3 4.5 5.5 5"/><path d="M17 14c3-1 4.5-5 3-9-1 3-3 4.5-5.5 5"/><path d="M8 12c0 5 2 8 4 8s4-3 4-8c-1.3-1-2.6-1.5-4-1.5S9.3 11 8 12z"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
    drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
    rabbit: '<path d="M9.5 10C8 7 7.5 3.5 9 2.5s3 3 3 7"/><path d="M14.5 10c1.5-3 2-6.5.5-7.5s-3 3-3 7"/><circle cx="12" cy="15" r="5.5"/><path d="M10 14.5h.01M14 14.5h.01"/>',
    scales: '<path d="M4 8c2.5-2 5.5-2 8 0 2.5-2 5.5-2 8 0"/><path d="M4 13c2.5-2 5.5-2 8 0 2.5-2 5.5-2 8 0"/><path d="M4 18c2.5-2 5.5-2 8 0 2.5-2 5.5-2 8 0"/>',

    /* Backgrounds */
    book: '<path d="M4 5.5c3-1.5 5.5-1.5 8 .5 2.5-2 5-2 8-.5v13c-3-1.5-5.5-1.5-8 .5-2.5-2-5-2-8-.5z"/><path d="M12 6v13"/>',
    helmet: '<path d="M5 13a7 7 0 0 1 14 0v5H5z"/><path d="M12 6v12"/><path d="M5 13h4v5M19 13h-4v5"/>',
    crown: '<path d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10z"/><path d="M4 20h16"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    hammer: '<path d="M14 4h6v5h-6z"/><path d="M14 6.5H9"/><path d="M15.5 9 6 18.5a1.5 1.5 0 0 1-2-2L13.5 7"/>',
    tree: '<path d="M12 3 6 11h3l-4 6h14l-4-6h3z"/><path d="M12 17v4"/>',
    anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M8 10h8"/><path d="M4.5 14c0 4 3.5 7 7.5 7s7.5-3 7.5-7"/><path d="M3 15.5l1.5-1.5 1.5 1.5M18 15.5l1.5-1.5 1.5 1.5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
    coins: '<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/><path d="M10 15.5c.6 1.2 2.6 2 5 2 2.8 0 5-1.1 5-2.5v-4c0-1.4-2.2-2.5-5-2.5"/><path d="M14 13.4c.3 0 .7.1 1 .1 2.8 0 5-1.1 5-2.5"/>',
    skull: '<path d="M5 11a7 7 0 0 1 14 0c0 2.5-1 4-2.5 5v3h-9v-3C6 15 5 13.5 5 11z"/><circle cx="9.5" cy="11" r="1.5"/><circle cx="14.5" cy="11" r="1.5"/><path d="M10.5 19v-2.5M13.5 19v-2.5"/>',
    wheat: '<path d="M12 21V8"/><path d="M12 8c-2-1-3-3-3-5 2 0 3 2 3 5zM12 8c2-1 3-3 3-5-2 0-3 2-3 5z"/><path d="M12 13c-2-1-3.5-2.5-3.5-4.5 2 0 3.5 1.5 3.5 4.5zM12 13c2-1 3.5-2.5 3.5-4.5-2 0-3.5 1.5-3.5 4.5zM12 18c-2-1-3.5-2.5-3.5-4.5 2 0 3.5 1.5 3.5 4.5zM12 18c2-1 3.5-2.5 3.5-4.5-2 0-3.5 1.5-3.5 4.5z"/>',
    lantern: '<path d="M9 7h6l1 3v7l-1 3H9l-1-3v-7z"/><path d="M10 4h4l1 3H9z"/><path d="M12 2v2"/><path d="M12 12c-1 1-1 2.5 0 3.5 1-1 1-2.5 0-3.5z"/>',
    scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h4"/><path d="M7 4a2 2 0 0 0-2 2v11"/><path d="M9 9h4M9 12h4"/>',

    /* Weapons and armor */
    sword: '<path d="M18.5 3H21v2.5L10 16.5 7.5 14z"/><path d="m6 12.5 5.5 5.5"/><path d="m8.5 17-3.5 3.5-1.5-1.5L7 15.5"/>',
    axe: '<path d="M6 21 17 10"/><path d="M14 4c3-1 6 1 7 4l-5 5-5-5z"/>',
    mace: '<path d="M5 21 13 13"/><circle cx="16" cy="8" r="4"/><path d="M16 2.5V4M21.5 8H20M20 4l-1 1M12 4l1 1"/>',
    polearm: '<path d="M4 20 18 6"/><path d="M15 3h6v6l-3-1.5z"/>',
    dagger: '<path d="M18 4 10 12"/><path d="m18 4-1 4-5 5"/><path d="m8 10 6 6"/><path d="m9 15-4 4"/>',
    staff: '<path d="M7 21 16 7"/><circle cx="17.5" cy="5" r="2.5"/>',
    bow: '<path d="M6 3c8 2 13 7 15 15"/><path d="M6 3l15 15"/><path d="M3 21 12 12"/><path d="M3 21v-3M3 21h3"/>',
    crossbow: '<path d="M4 9c4-4 12-4 16 0"/><path d="M4 9l8 3 8-3"/><path d="M12 6v15"/><path d="m10 19 2 2 2-2"/>',
    firearm: '<path d="M3 8h17v3H9l-1 6H4.5l1-6H3z"/><path d="M11 11v2.5h3"/>',
    whip: '<path d="M4 20 8 16"/><path d="M8 16c4-4 4-9 8-10 3-1 5 1 4 3-1.5 3-6 1-8 5"/>',
    sling: '<path d="M4 4c3 6 6 9 9 10"/><path d="M4 4c6 3 9 6 10 9"/><circle cx="15.5" cy="15.5" r="2.5"/><path d="M18 18l3 3"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/><path d="M12 3v18"/>',
    lightArmor: '<path d="M8 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-1 1.5-2.5 2-4 2S9 5.5 8 4z"/>',
    mediumArmor: '<path d="M8 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-1 1.5-2.5 2-4 2S9 5.5 8 4z"/><path d="M8 13h8M8 16h8"/>',
    heavyArmor: '<path d="M6 12a6 6 0 0 1 12 0v8H6z"/><path d="M6 12h12"/><path d="M9.5 15.5h5"/><path d="M12 6v6"/>',
    noArmor: '<circle cx="12" cy="7" r="3"/><path d="M6 21c0-5 2.5-8 6-8s6 3 6 8"/>',

    /* Creature types */
    aberration: '<circle cx="12" cy="9" r="5.5"/><circle cx="12" cy="9" r="2"/><path d="M8 14c-1 3-3 4-5 4M12 14.5v6.5M16 14c1 3 3 4 5 4M10 14.5c-.5 2.5-1.5 4-3 5.5M14 14.5c.5 2.5 1.5 4 3 5.5"/>',
    celestial: '<ellipse cx="12" cy="4" rx="3.5" ry="1.3"/><path d="M12 9c-2-2-6-3-9-1 1 4 4 7 9 8 5-1 8-4 9-8-3-2-7-1-9 1z"/><path d="M12 9v11"/>',
    elemental: '<path d="M12 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0 7.5 7.5 0 0 1 15 0"/>',
    monstrosity: '<path d="M3 10c3-4.5 15-4.5 18 0v4c-3 4.5-15 4.5-18 0z"/><path d="M6 9.3 7.5 12 9 8.7M15 8.7l1.5 3.3L18 9.3M10.5 8.4 12 11.2l1.5-2.8"/><path d="M7.5 15.2 9 12.8l1.5 2.8M13.5 15.6l1.5-2.8 1.5 2.4"/>',
    ooze: '<path d="M4 17c0-5 3-11 8-11s8 6 8 11c0 1.5-1 2.5-2 2.5s-1.5-1-2.5-1-1.5 2-3.5 2-2.5-2-3.5-2-1.5 1-2.5 1S4 18.5 4 17z"/><circle cx="10" cy="11.5" r=".8"/><circle cx="14.5" cy="13" r=".8"/>',
    plant: '<path d="M12 21v-9"/><path d="M12 12C12 7 9 4 4 4c0 5 3 8 8 8z"/><path d="M12 14c0-4 3-7 8-7 0 4-3 7-8 7z"/>',
    swarm: '<circle cx="7" cy="8" r="2"/><circle cx="16" cy="6.5" r="2"/><circle cx="12" cy="13" r="2"/><circle cx="6" cy="17" r="2"/><circle cx="17.5" cy="16" r="2"/>',

    /* Spell schools */
    abjuration: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/><circle cx="12" cy="11.5" r="2.8"/><path d="M12 7v1.7M12 14.3V16M7.8 11.5h1.4M14.8 11.5h1.4"/>',
    conjuration: '<ellipse cx="12" cy="17.5" rx="8" ry="3"/><path d="M12 15V4"/><path d="m8.5 7.5 3.5-3.5 3.5 3.5"/><path d="M6 9.5h.01M18 9.5h.01M7.5 5h.01M16.5 5h.01"/>',
    divination: '<circle cx="12" cy="10" r="6.5"/><path d="M7 21h10l-1.5-3h-7z"/><path d="M9.5 8.5a3 3 0 0 1 2.5-1.5"/>',
    enchantment: '<path d="M12 20s-7.5-4.5-7.5-10A4 4 0 0 1 12 7.5 4 4 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/><path d="M19 2.5v3M17.5 4h3"/>',
    evocation: '<path d="M13.5 2 4.5 14h7l-1 8 9-12h-7z"/>',
    illusion: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5" stroke-dasharray="2 2.2"/>',
    necromancy: '<path d="M5 11a7 7 0 0 1 14 0c0 2.5-1 4-2.5 5v3h-9v-3C6 15 5 13.5 5 11z"/><circle cx="9.5" cy="11" r="1.5"/><circle cx="14.5" cy="11" r="1.5"/><path d="M10.5 19v-2.5M13.5 19v-2.5"/>',
    transmutation: '<path d="M12 3.5 20.5 18.5h-17z"/><circle cx="12" cy="13.5" r="3"/><path d="M12 3.5v7"/>',

    /* Damage types */
    dmgAcid: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/><circle cx="10" cy="14.5" r="1.3"/><circle cx="14" cy="17" r=".8"/><circle cx="13.5" cy="12" r=".6"/>',
    dmgBludgeoning: '<circle cx="12" cy="9" r="5"/><path d="M3 21h18M6.5 18.5 5 16.5M12 18v-2.5M17.5 18.5l1.5-2"/>',
    dmgCold: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2"/>',
    dmgFire: '<path d="M12 22c4 0 7-2.8 7-7 0-4-3-6.5-4-10-1.5 2-2 3.5-2 5-1-1-2-2.5-2-4.5C8 8 5 11 5 15c0 4.2 3 7 7 7z"/><path d="M12 22c-1.7 0-3-1.2-3-3 0-2 3-4 3-4s3 2 3 4c0 1.8-1.3 3-3 3z"/>',
    dmgForce: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6" stroke-dasharray="3 2.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>',
    dmgLightning: '<path d="M14 2 7 12.5h4.5L9 22l8-11.5h-4.5L15 2z" stroke-linejoin="round"/>',
    dmgNecrotic: '<path d="M12 20s-7.5-4.5-7.5-10A4 4 0 0 1 12 7.5 4 4 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/><path d="m12 7.5-1.5 4 3 2-1.5 6.5"/>',
    dmgPiercing: '<path d="M3 21 15 9"/><path d="M13 5l7-2-2 7z"/><path d="M5 15l4 4"/>',
    dmgPoison: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/><path d="m9.5 12.5 5 5M14.5 12.5l-5 5"/>',
    dmgPsychic: '<path d="M12 12a1 1 0 0 1 2 0 2.5 2.5 0 0 1-5 0 4 4 0 0 1 8 0 5.5 5.5 0 0 1-11 0 7 7 0 0 1 14 0"/><path d="M5 18.5 3 21M19 18.5l2 2.5"/>',
    dmgRadiant: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    dmgSlashing: '<path d="M5 19 17 3M9 21 20 7M3 14 12 2"/>',
    dmgThunder: '<circle cx="12" cy="12" r="1.5"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9.2 9.2 0 0 0 0 13M18.5 5.5a9.2 9.2 0 0 1 0 13"/>',

    /* Conditions */
    blinded: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 20 4"/>',
    charmed: '<path d="M12 20s-7.5-4.5-7.5-10A4 4 0 0 1 12 7.5 4 4 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/><path d="M3 21 9.5 14.5M21 3l-6.5 6.5M18 3h3v3"/>',
    deafened: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.5"/><path d="M10 9a2 2 0 0 1 4 0"/><path d="M4 20 20 4"/>',
    exhaustion: '<rect x="2.5" y="7" width="17" height="10" rx="2"/><path d="M22 10.5v3"/><path d="M5.5 10v4"/>',
    frightened: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><path d="M8 16.5c1-1 2-1 3 0s2 1 3 0 1.5-.8 2 0"/>',
    grappled: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v5M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4.5a1.5 1.5 0 0 1 2.5-1.5L7 14"/>',
    incapacitated: '<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z"/><path d="M7.5 12h9"/>',
    invisible: '<circle cx="12" cy="6.5" r="3.5" stroke-dasharray="2.2 2"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0" stroke-dasharray="2.2 2"/>',
    paralyzed: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.3"/>',
    petrified: '<path d="M3 17 6 9l5-4 6 1.5 4 6.5-2 6H6z"/><path d="m11 5 1.5 5-3.5 3M12.5 10l4.5 1.5M9 13l1 6"/>',
    poisoned: '<path d="M10 2.5h4M10.5 2.5V7L6 14a4.5 4.5 0 0 0 4 7h4a4.5 4.5 0 0 0 4-7l-4.5-7V2.5"/><path d="m10 13 4 4M14 13l-4 4"/>',
    prone: '<circle cx="5" cy="14.5" r="2.3"/><path d="M8.5 16h12M11.5 16l2-3.5h3.5"/><path d="M2 19.5h20"/>',
    restrained: '<rect x="2.5" y="8.5" width="11" height="7" rx="3.5"/><rect x="10.5" y="8.5" width="11" height="7" rx="3.5"/>',
    stunned: '<path d="M9.5 3 11 7.5l4.5 1.5-4.5 1.5L9.5 15 8 10.5 3.5 9 8 7.5z"/><path d="m17.5 13 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9zM18 3.5v3M16.5 5h3"/>',
    unconscious: '<path d="M4 5h6l-6 7h6M13 11h4.5l-4.5 5h4.5M19 17h3l-3 3.5h3"/>',

    /* Items */
    potion: '<path d="M10 3h4M10.5 3v5L6 15a4.5 4.5 0 0 0 4 6h4a4.5 4.5 0 0 0 4-6l-4.5-7V3"/><path d="M7.5 14h9"/>',
    ring: '<circle cx="12" cy="14" r="6"/><path d="m10 8-1.5-3h7L14 8"/><path d="M8.5 5 12 3l3.5 2"/>',
    wand: '<path d="M4 20 15 9"/><path d="M18 3v3M18 9v3M15 6h-3M21 6h3"/><path d="m16 4 4 4M20 4l-4 4"/>',
    rod: '<path d="M6 20 17 9"/><path d="M15 5.5h5v5h-5z"/><path d="m4.5 21.5 1.5-1.5"/>',
    wondrous: '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
    gear: '<path d="M7 8V6a5 5 0 0 1 10 0v2"/><rect x="5" y="8" width="14" height="13" rx="2"/><path d="M5 13h14"/><path d="M10 13v2h4v-2"/>',
    gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 6 3-6M12 9v12"/>',
    ammo: '<path d="M5 19 19 5"/><path d="M15 5h4v4"/><path d="M5 19l-1-3M5 19l3 1"/><path d="M8 19 21 6"/>'
  };
  DND.ICONS = I;

  // An inline SVG icon; `name` is a key of DND.ICONS.
  DND.icon = function (name, cls) {
    var body = I[name] || I.d20;
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  };

  function match(name, rules, fallback) {
    var n = String(name || '').toLowerCase();
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(n)) return rules[i][1];
    return fallback;
  }

  var CLASS_RULES = [
    [/barbarian/, 'barbarian'], [/bard/, 'bard'], [/cleric/, 'cleric'], [/druid/, 'druid'], [/fighter/, 'fighter'], [/monk/, 'monk'],
    [/paladin/, 'paladin'], [/ranger/, 'ranger'], [/rogue/, 'rogue'], [/sorcerer/, 'sorcerer'], [/warlock/, 'warlock'], [/wizard/, 'wizard'],
    [/artificer|rune scribe/, 'artificer'], [/blood hunter/, 'bloodhunter'], [/sidekick/, 'sidekick'], [/mystic|psion/, 'warlock']
  ];
  DND.classIcon = function (cls) { return match(cls && cls.name, CLASS_RULES, 'd20'); };

  var SPECIES_RULES = [
    [/dragonborn|kobold|lizardfolk|tortle|dragon/, 'dragonborn'], [/dwarf|duergar|azer/, 'dwarf'], [/half-elf|elf|eladrin|drow|shadar/, 'elf'],
    [/gnome|autognome/, 'gnome'], [/goliath|giant|firbolg|loxodon/, 'goliath'], [/halfling|hedge|jerbeen|mousefolk|ratfolk/, 'halfling'],
    [/half-orc|orc|goblin|bugbear|hobgoblin|gnoll|grung/, 'orc'], [/tiefling|fallen|hexblood|devil/, 'tiefling'], [/aasimar|reborn|dhampir/, 'aasimar'],
    [/aarakocra|owl|kenku|raven|aven|corvum|strig|raptor|gallus|luma|giff|hadozee/, 'feather'], [/tabaxi|leonin|cat|vulpin|mapach|khenra|shifter/, 'paw'],
    [/triton|locathah|merfolk|sea|siren|plasmoid|bullywug/, 'aquatic'], [/warforged|construct|glitchling/, 'construct'],
    [/fairy|satyr|fey|pixie|harengon|rabbit|cervan|centaur/, 'fey'], [/changeling|kalashtar|mimic|kender/, 'mask'],
    [/minotaur|thri-kreen|yuan-ti|naga|verdan|vedalken|simic/, 'horns'], [/genasi, air|air/, 'wind'], [/genasi, water/, 'drop'],
    [/genasi, fire/, 'sorcerer'], [/genasi, earth/, 'goliath'], [/human/, 'human']
  ];
  DND.speciesIcon = function (name) {
    var n = String(name || '').toLowerCase();
    if (/rabbit|harengon/.test(n)) return 'rabbit';
    if (/lizardfolk|tortle|yuan-ti|naga/.test(n)) return 'scales';
    return match(n, SPECIES_RULES, 'human');
  };

  var BG_RULES = [
    [/acolyte|priest|cultist|missionary|inquisitor|faith|cloistered|initiate|vizier|devoted/, 'cleric'],
    [/criminal|charlatan|spy|smuggler|thie|bandit|faceless|agent|double|secret|black fist|grinner|volstrucker|myriad|augen/, 'mask'],
    [/sage|scholar|student|anthropolog|archaeolog|investigator|scribe|lorehold|quandrix|prismari|silverquill|witherbloom|cobalt|philosopher|mageborn|mage|lyceum|intern|functionary/, 'book'],
    [/soldier|guard|watch|knight|mercenary|marine|legion|gladiator|veteran|sentinel|warden|rifle|order|boros|insurgent/, 'helmet'],
    [/noble|courtier|aristocrat|scion|heir|inheritor|celebrity|nobility|azorius|orzhov/, 'crown'],
    [/entertainer|athlete|performer|gambler|rakdos|revelry|courtesan|celebrity/, 'music'],
    [/artisan|guild|crafter|shipwright|engineer|izzet|smith|chef|cook|gourmand|miner|earthspur/, 'hammer'],
    [/outlander|hermit|nomad|wildspacer|feylost|survivor|uthgardt|ashari|grounded|wind|gruul|golgari|selesnya|simic|ticklebelly|giant foundling|rune carver|tribe/, 'tree'],
    [/sailor|pirate|fisher|harbor|smuggler|ship|marine/, 'anchor'],
    [/merchant|trader|caravan|trade|hillsfar|plaintiff|treasure/, 'coins'],
    [/far traveler|traveler|traveling|drifter|astral|planar|displaced|refugee|guide|witchlight|gate/, 'compass'],
    [/haunted|reborn|ruined|dissenter|rewarded|monster|casualty|prisoner|shade|fanatic|mad scientist/, 'skull'],
    [/farmer|folk hero|rural/, 'wheat'], [/urchin|city|gate urchin|harborfolk|bounty/, 'lantern']
  ];
  DND.backgroundIcon = function (name) { return match(name, BG_RULES, 'scroll'); };

  var WEAPON_RULES = [
    [/crossbow/, 'crossbow'], [/pistol|musket|rifle|revolver|gun|blaster|shotgun/, 'firearm'], [/bow/, 'bow'],
    [/whip/, 'whip'], [/sling|blowgun|dart|net/, 'sling'],
    [/quarterstaff|staff/, 'staff'], [/dagger|knife|sickle|kukri/, 'dagger'],
    [/halberd|glaive|pike|spear|lance|trident|javelin|polearm|scythe|naginata/, 'polearm'],
    [/axe/, 'axe'], [/hammer|maul|mace|club|flail|morningstar|pick/, 'mace'],
    [/sword|scimitar|rapier|blade|saber|katana|cutlass|brand|tongue/, 'sword']
  ];
  DND.weaponIcon = function (w) {
    if (!w) return 'sword';
    var base = w.baseId && DND.weapon && DND.weapon(w.baseId);
    return match((base ? base.name + ' ' : '') + w.name, WEAPON_RULES, w.ranged ? 'bow' : 'sword');
  };
  DND.armorIcon = function (a) {
    if (!a || a.type === 'none') return 'noArmor';
    return a.type === 'heavy' ? 'heavyArmor' : a.type === 'medium' ? 'mediumArmor' : 'lightArmor';
  };
  var CREATURE_RULES = [
    [/swarm/, 'swarm'], [/aberration/, 'aberration'], [/beast/, 'paw'], [/celestial/, 'celestial'], [/construct|vehicle|droid/, 'construct'],
    [/dragon/, 'dragonborn'], [/elemental/, 'elemental'], [/fey/, 'fey'], [/fiend|demon|devil/, 'horns'], [/giant/, 'goliath'],
    [/humanoid/, 'human'], [/monstrosity/, 'monstrosity'], [/ooze/, 'ooze'], [/plant/, 'plant'], [/undead/, 'skull']
  ];
  DND.creatureIcon = function (m) { return match(m && m.type, CREATURE_RULES, 'd20'); };

  var SCHOOL_ICONS = { A: 'abjuration', C: 'conjuration', D: 'divination', EN: 'enchantment', EV: 'evocation', I: 'illusion', N: 'necromancy', T: 'transmutation' };
  // Icon for a spell school code (A, C, D, EN, EV, I, N, T) or a spell name with known details.
  DND.schoolIcon = function (codeOrName) {
    if (SCHOOL_ICONS[codeOrName]) return SCHOOL_ICONS[codeOrName];
    var info = DND.SPELL_INFO && DND.SPELL_INFO[codeOrName];
    return info && SCHOOL_ICONS[info.school] || null;
  };
  DND.SCHOOL_ICONS = SCHOOL_ICONS;

  var DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
  // Icon for a damage type name ("fire", "Slashing"), or null.
  DND.damageIcon = function (type) {
    var t = String(type || '').toLowerCase().trim();
    return DAMAGE_TYPES.indexOf(t) >= 0 ? 'dmg' + t.charAt(0).toUpperCase() + t.slice(1) : null;
  };
  DND.DAMAGE_TYPES = DAMAGE_TYPES;

  // Icon for a condition name ("Prone", "frightened"), or null.
  DND.conditionIcon = function (name) {
    var k = String(name || '').toLowerCase().trim();
    return /^(blinded|charmed|deafened|exhaustion|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious)$/.test(k) ? k : null;
  };

  var ITEM_TYPE_ICONS = { P: 'potion', RG: 'ring', SC: 'scroll', WD: 'wand', RD: 'rod', ST: 'staff', W: 'wondrous', G: 'gear', $: 'gem', A: 'ammo',
    LA: 'lightArmor', MA: 'mediumArmor', HA: 'heavyArmor', S: 'shield' };
  DND.itemIcon = function (it) {
    if (!it) return 'gear';
    if (it.type === 'M' || it.type === 'R') return DND.weaponIcon({ name: it.name, ranged: it.type === 'R' });
    return ITEM_TYPE_ICONS[it.type] || (it.magic ? 'wondrous' : 'gear');
  };
})(typeof window !== 'undefined' ? window : globalThis);
