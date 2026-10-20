/*
 * Levelwright UI: renders the build timeline, character sheet, spell picker and
 * 20-level progression from DND.evaluate(), and saves builds in localStorage.
 */
(function () {
  var D = window.DND;
  var STORE_KEY = 'levelwright.v1';

  var app = { builds: [], currentId: null, tab: 'build', showAll: true, modal: null, deleteArmed: false };
  var ev = null;

  /* ---------- Helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel) { return document.querySelector(sel); }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function cur() { return find(app.builds, app.currentId) || app.builds[0]; }
  function sign(n) { return D.sign(n); }
  function abbr(a) { return a.toUpperCase(); }

  var DEFAULT_GEAR = {
    barbarian: { armor: 'none', shield: false, weapons: ['greataxe', 'handaxe'] },
    bard: { armor: 'leather', shield: false, weapons: ['rapier', 'dagger'] },
    cleric: { armor: 'chainshirt', shield: true, weapons: ['mace'] },
    druid: { armor: 'leather', shield: true, weapons: ['sickle', 'quarterstaff'] },
    fighter: { armor: 'chainmail', shield: true, weapons: ['longsword', 'javelin'] },
    monk: { armor: 'none', shield: false, weapons: ['spear', 'dagger'] },
    paladin: { armor: 'chainmail', shield: true, weapons: ['longsword', 'javelin'] },
    ranger: { armor: 'studded', shield: false, weapons: ['shortsword', 'longbow'] },
    rogue: { armor: 'leather', shield: false, weapons: ['rapier', 'shortbow', 'dagger'] },
    sorcerer: { armor: 'none', shield: false, weapons: ['dagger', 'quarterstaff'] },
    warlock: { armor: 'leather', shield: false, weapons: ['sickle', 'dagger'] },
    wizard: { armor: 'none', shield: false, weapons: ['quarterstaff', 'dagger'] }
  };

  /* ---------- Persistence ---------- */

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ builds: app.builds, currentId: app.currentId, tab: app.tab, showAll: app.showAll })); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && Array.isArray(data.builds) && data.builds.length) {
          app.builds = data.builds; app.currentId = data.currentId; app.tab = data.tab || 'build';
          app.showAll = data.showAll !== false;
          return;
        }
      }
    } catch (e) { /* fall through to examples */ }
    app.builds = exampleBuilds();
    app.currentId = app.builds[0].id;
  }

  function exampleBuilds() {
    var f = D.newBuild({ name: 'Example: Champion Fighter', level: 5, classId: 'fighter', speciesId: 'human', backgroundId: 'soldier',
      base: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } });
    Object.assign(f.choices, {
      'sp.human.skill': ['perception'], 'sp.human.feat': 'alert',
      'bg.soldier.asi': '21', 'bg.soldier.asi.21.plus2': 'str', 'bg.soldier.asi.21.plus1': 'con',
      'fighter.L1.proficiencies.skills': ['acrobatics', 'survival'],
      'fighter.L1.fighting-style.style': 'defense',
      'fighter.L1.weapon-mastery.weapons': ['longsword', 'greatsword', 'javelin'],
      'fighter.subclass': 'champion',
      'fighter.L4.ability-score-improvement.feat': 'asi',
      'fighter.L4.ability-score-improvement.feat.asi.a': 'str', 'fighter.L4.ability-score-improvement.feat.asi.b': 'con',
      'fighter.L4.weapon-mastery-1.weapons': ['longbow']
    });
    f.gear = { armor: 'chainmail', shield: true, weapons: ['longsword', 'javelin', 'longbow'] };

    var w = D.newBuild({ name: 'Example: Evoker Wizard', level: 5, classId: 'wizard', speciesId: 'elf', backgroundId: 'sage',
      base: { str: 8, dex: 13, con: 14, int: 15, wis: 12, cha: 10 } });
    Object.assign(w.choices, {
      'sp.elf.lineage': 'high', 'sp.elf.keen': ['perception'],
      'bg.sage.asi': '21', 'bg.sage.asi.21.plus2': 'int', 'bg.sage.asi.21.plus1': 'con',
      'bg.sage.feat.cantrips': ['Light', 'Mind Sliver'], 'bg.sage.feat.spell': 'Find Familiar',
      'wizard.L1.proficiencies.skills': ['investigation', 'insight'],
      'wizard.L2.scholar.skill': ['arcana'],
      'wizard.subclass': 'evoker',
      'wizard.L4.ability-score-improvement.feat': 'asi',
      'wizard.L4.ability-score-improvement.feat.asi.a': 'int', 'wizard.L4.ability-score-improvement.feat.asi.b': 'int'
    });
    w.spells = { cantrips: ['Fire Bolt', 'Mage Hand', 'Ray of Frost', 'Shocking Grasp'],
      prepared: ['Shield', 'Magic Missile', 'Mage Armor', 'Detect Magic', 'Misty Step', 'Scorching Ray', 'Fireball', 'Counterspell', 'Haste', 'Wall of Fire', 'Cone of Cold'] };
    w.gear = { armor: 'none', shield: false, weapons: ['quarterstaff', 'dagger'] };
    return [f, w];
  }

  /* ---------- State changes ---------- */

  function commit() { save(); render(); }
  function setChoice(key, value) {
    var b = cur();
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) delete b.choices[key];
    else b.choices[key] = value;
    commit();
  }
  function setLevel(l) {
    cur().level = Math.max(1, Math.min(20, l));
    commit();
  }

  /* ---------- Choice lookup ---------- */

  function allChoiceRecs() {
    var out = [];
    function walk(list) { list.forEach(function (c) { out.push(c); walk(c.children); }); }
    ev.origin.forEach(function (o) { walk(o.choices); });
    ev.levels.forEach(function (l) { l.features.forEach(function (f) { walk(f.choices); }); });
    return out;
  }
  function findRec(key) { return allChoiceRecs().filter(function (c) { return c.key === key; })[0] || null; }

  /* ---------- Rendering: header ---------- */

  function renderHeader() {
    var b = cur();
    $('#build-select').innerHTML = app.builds.map(function (x) {
      var c = D.cls(x.classId);
      return '<option value="' + esc(x.id) + '"' + (x.id === b.id ? ' selected' : '') + '>' + esc(x.name || 'Unnamed') + ' · ' + esc(c ? c.name : '') + ' ' + x.level + '</option>';
    }).join('');
    var nameEl = $('#build-name');
    if (document.activeElement !== nameEl) nameEl.value = b.name || '';
    $('#level-now').textContent = b.level;
    var del = $('#delete-btn');
    del.textContent = app.deleteArmed ? 'Confirm delete' : 'Delete';
    del.classList.toggle('armed', app.deleteArmed);

    $('#rail').innerHTML = ev.levels.map(function (lv) {
      var L = lv.level, marks = [];
      (ev.cls.features[L] || []).forEach(function (f) {
        if (f.subclassSlot) marks.push('sub');
        else if (f.name === 'Ability Score Improvement') marks.push('asi');
        else if (f.name === 'Epic Boon') marks.push('boon');
      });
      var mk = marks.indexOf('sub') >= 0 ? 'sub' : marks.indexOf('boon') >= 0 ? 'boon' : marks.indexOf('asi') >= 0 ? 'feat' : '';
      var todo = lv.issues.missing + lv.issues.problems > 0;
      var cls = [L < b.level ? 'reached' : '', L === b.level ? 'current' : '', todo ? 'todo' : ''].join(' ');
      return '<li class="' + cls + '"><button type="button" data-level="' + L + '" title="Level ' + L + (todo ? ' — choices needed' : '') + '"' +
        (L === b.level ? ' aria-current="step"' : '') + '><span>' + L + '</span><span class="mk">' + mk + '</span></button></li>';
    }).join('');

    document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.tab === app.tab ? 'true' : 'false'); });
  }

  /* ---------- Rendering: choices ---------- */

  function renderChoice(rec) {
    var problems = rec.problems.length ? '<ul class="problems">' + rec.problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '';
    var state = rec.missing ? ' todo' : rec.problems.length ? ' problem' : '';
    var pill = rec.missing ? '<span class="pill pill-todo">' + (rec.kind === 'many' ? rec.missing + ' to choose' : 'choose') + '</span>' : '';
    var id = 'c-' + rec.key.replace(/[^a-zA-Z0-9_-]/g, '_');
    var body;
    if (rec.kind === 'one') {
      var groups = {}, order = [];
      rec.options.forEach(function (o) {
        var g = o.group || '';
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(o);
      });
      var opts = '<option value="">— Choose —</option>' + order.map(function (g) {
        var inner = groups[g].map(function (o) {
          var sel = o.id === rec.value;
          return '<option value="' + esc(o.id) + '"' + (sel ? ' selected' : '') + (o.unavailable && !sel ? ' disabled' : '') + '>' +
            esc(o.label) + (o.unavailable ? ' (' + esc(o.unavailable) + ')' : '') + '</option>';
        }).join('');
        return g ? '<optgroup label="' + esc(g) + '">' + inner + '</optgroup>' : inner;
      }).join('');
      var chosen = find(rec.options, rec.value);
      body = '<select id="' + id + '" data-choice="' + esc(rec.key) + '">' + opts + '</select>' +
        (chosen && chosen.desc ? '<p class="opt-desc">' + esc(chosen.desc) + '</p>' : '');
    } else {
      var vals = Array.isArray(rec.value) ? rec.value : [];
      var chips = vals.map(function (v) {
        var o = find(rec.options, v);
        return '<span class="chip' + (!o || o.unavailable ? ' bad' : '') + '" title="' + esc(o && o.desc || '') + '">' + esc(o ? o.label : v) +
          '<button type="button" data-remove="' + esc(rec.key) + '" data-value="' + esc(v) + '" aria-label="Remove ' + esc(o ? o.label : v) + '">×</button></span>';
      }).join('');
      body = '<div class="chips">' + chips + '<button type="button" id="' + id + '" class="btn btn-small' + (rec.missing ? ' btn-primary' : '') + '" data-pick="' + esc(rec.key) + '">' +
        (vals.length ? 'Change' : 'Choose') + ' (' + vals.length + '/' + rec.count + ')</button></div>';
    }
    var kids = rec.children.length ? '<div class="children">' + rec.children.map(renderChoice).join('') + '</div>' : '';
    return '<div class="choice' + state + '"><div class="choice-label"><label for="' + id + '">' + esc(rec.label) + '</label>' + pill + '</div>' + body + problems + kids + '</div>';
  }

  /* ---------- Rendering: build tab ---------- */

  function selectField(id, label, list, value, descFn) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '">' +
      list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === value ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') +
      '</select>' + (descFn ? '<p class="desc">' + esc(descFn(find(list, value))) + '</p>' : '') + '</div>';
  }

  function renderOrigin() {
    var b = cur(), lv1 = ev.levels[0].state, lvN = ev.levels[b.level - 1].state;
    var method = b.abilityMethod;
    var abil = D.ABILITIES.map(function (a) {
      var input;
      if (method === 'standard') {
        input = '<select id="ab-' + a + '" data-ability="' + a + '">' + D.STANDARD_ARRAY.map(function (v) {
          return '<option' + (b.base[a] === v ? ' selected' : '') + '>' + v + '</option>';
        }).join('') + '</select>';
      } else {
        input = '<input id="ab-' + a + '" data-ability="' + a + '" type="number" inputmode="numeric" min="' + (method === 'pointbuy' ? 8 : 3) + '" max="' + (method === 'pointbuy' ? 15 : 20) + '" value="' + b.base[a] + '">';
      }
      return '<div class="ab-edit"><label class="eyebrow" for="ab-' + a + '">' + D.ABILITY_NAMES[a] + '</label>' + input +
        '<span class="final">L1 <b>' + lv1.abilities[a] + '</b> · L' + b.level + ' <b>' + lvN.abilities[a] + '</b></span></div>';
    }).join('');
    var points = method === 'pointbuy' ? '<span class="pill ' + (ev.pointsSpent > 27 ? 'pill-todo' : 'pill-ok') + '">' + (ev.pointsSpent >= 99 ? '?' : ev.pointsSpent) + ' / 27 points</span>' : '';
    var abIssues = ev.abilityIssues.length ? '<ul class="warn-list">' + ev.abilityIssues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '';

    var originBlocks = ev.origin.map(function (o) {
      var traits = o.traits && o.traits.length ? '<dl class="traits">' + o.traits.map(function (t) {
        return '<div><dt>' + esc(t[0]) + '</dt><dd>' + esc(t[1]) + '</dd></div>';
      }).join('') + '</dl>' : '';
      return '<div class="field"><span class="label">' + esc(o.kind) + ': ' + esc(o.name) + '</span>' + traits +
        (o.choices.length ? '<div class="children" style="display:grid;gap:8px">' + o.choices.map(renderChoice).join('') + '</div>' : '') + '</div>';
    }).join('');

    var n = ev.originIssues;
    return '<section class="card" id="origin"><div class="card-head"><h2>Origin</h2>' +
      (n.missing ? '<span class="pill pill-todo">' + n.missing + ' to choose</span>' : '<span class="pill pill-ok">complete</span>') +
      '<span class="muted">Class, species, background, and ability scores</span></div><div class="card-body">' +
      '<div class="grid-3">' +
      selectField('f-class', 'Class', D.CLASSES, b.classId, function (c) { return 'd' + c.hd + ' Hit Die · Primary: ' + c.primary + ' · Saves: ' + c.saves.map(abbr).join(', '); }) +
      selectField('f-species', 'Species', D.SPECIES, b.speciesId, function (s) { return s.size + ' · Speed ' + s.speed + ' ft' + (s.darkvision ? ' · Darkvision ' + s.darkvision + ' ft' : ''); }) +
      selectField('f-bg', 'Background', D.BACKGROUNDS, b.backgroundId, function (g) { return g.custom ? 'Any three abilities, Origin feat, two skills' : 'Abilities: ' + g.abilities.map(abbr).join(', ') + ' · Feat: ' + g.featName; }) +
      '</div>' +
      '<div class="field"><div class="toolbar"><span class="label">Ability scores (before background bonuses)</span>' +
      '<div class="seg" role="group" aria-label="Ability score method">' +
      [['standard', 'Standard array'], ['pointbuy', 'Point buy'], ['manual', 'Manual']].map(function (m) {
        return '<button type="button" data-method="' + m[0] + '" aria-pressed="' + (method === m[0]) + '">' + m[1] + '</button>';
      }).join('') + '</div>' + points + '</div>' +
      '<div class="abilities-edit">' + abil + '</div>' + abIssues + '</div>' +
      originBlocks + '</div></section>';
  }

  function levelCard(lv) {
    var b = cur(), L = lv.level;
    var cls = ['card', 'lvl', L < b.level ? 'reached' : '', L === b.level ? 'current reached' : '', L > b.level ? 'ahead' : ''].join(' ');
    var todo = lv.issues.missing ? '<span class="pill pill-todo">' + lv.issues.missing + ' to choose</span>' :
      lv.issues.problems ? '<span class="pill pill-todo">check choices</span>' : '';
    var feats = lv.features.map(function (f) {
      var tag = f.source && f.source !== 'Class' ? '<span class="pill pill-gold">' + esc(f.source) + '</span>' : '';
      return '<div class="feature"><div class="feature-name">' + esc(f.name) + tag + '</div>' +
        (f.desc ? '<p class="desc">' + esc(f.desc) + '</p>' : '') + f.choices.map(renderChoice).join('') + '</div>';
    }).join('');
    if (!lv.features.length) feats = '<div class="feature"><p class="desc">No new class features. Your Hit Points and proficiency still grow.</p></div>';
    var prev = L > 1 ? ev.levels[L - 2].d.hp : 0;
    return '<section class="' + cls + '" id="lvl-' + L + '">' +
      '<div class="lvl-head"><div class="lvl-num">' + L + '</div><div class="lvl-title"><strong>' + esc(ev.cls.name) + ' ' + L + '</strong>' +
      '<div class="lvl-stats"><span>PB ' + sign(lv.d.pb) + '</span><span>HP ' + lv.d.hp + (L > 1 ? ' (+' + (lv.d.hp - prev) + ')' : '') + '</span>' +
      lv.d.columns.map(function (c) { return '<span>' + esc(c.label) + ' ' + esc(c.value) + '</span>'; }).join('') + '</div></div>' + todo +
      (L !== b.level ? '<button type="button" class="btn btn-small" data-level="' + L + '">View level ' + L + '</button>' : '<span class="pill pill-gold">Viewing</span>') +
      '</div><div class="feat-list">' + feats + '</div></section>';
  }

  function renderBuild() {
    var b = cur();
    var levels = ev.levels.filter(function (lv) { return app.showAll || lv.level <= b.level; });
    var totalTodo = ev.levels.reduce(function (n, l) { return n + l.issues.missing; }, 0);
    return renderOrigin() +
      '<div class="toolbar"><h2>Level by level</h2><div class="chips">' +
      (totalTodo ? '<span class="pill pill-todo">' + totalTodo + ' choices open across 20 levels</span>' : '<span class="pill pill-ok">All 20 levels chosen</span>') +
      '<div class="seg" role="group" aria-label="Levels shown"><button type="button" data-showall="1" aria-pressed="' + app.showAll + '">All 20</button>' +
      '<button type="button" data-showall="0" aria-pressed="' + !app.showAll + '">Up to ' + b.level + '</button></div></div></div>' +
      '<div class="timeline">' + levels.map(levelCard).join('') + '</div>';
  }

  /* ---------- Rendering: summary + sheet ---------- */

  function subName(lv) { return lv.subclass ? lv.subclass.name : null; }

  function renderSummary() {
    var b = cur(), lv = ev.levels[b.level - 1], d = lv.d, s = lv.state, base = ev.levels[0].state;
    var vit = [['AC', d.ac], ['HP', d.hp], ['Speed', d.speed], ['Init', sign(d.init)], ['Prof', sign(d.pb)], ['Passive', d.passivePerception]];
    var html = '<section class="card"><div class="sum-head"><span class="eyebrow">Level ' + b.level + ' ' + esc(ev.species.name) + '</span><h2>' + esc(b.name || 'Unnamed') + '</h2>' +
      '<span class="muted">' + esc(ev.cls.name) + (subName(lv) ? ' · ' + esc(subName(lv)) : '') + ' · ' + esc(ev.background.name) + '</span></div>' +
      '<div class="vitals">' + vit.map(function (v) { return '<div class="vital"><b>' + v[1] + '</b><span>' + v[0] + '</span></div>'; }).join('') + '</div>' +
      '<div class="abil-row">' + D.ABILITIES.map(function (a) {
        return '<div class="abil' + (s.abilities[a] > base.abilities[a] ? ' raised' : '') + '" title="' + D.ABILITY_NAMES[a] + (d.saves[a].prof ? ', proficient save' : '') + '"><span class="eyebrow">' + a + '</span><b>' + s.abilities[a] + '</b><small>' + sign(d.mods[a]) + '</small></div>';
      }).join('') + '</div>';
    if (d.spell) {
      html += '<div class="sum-section"><h3>Spellcasting</h3><div>Save DC <b>' + d.spell.dc + '</b> · Attack <b>' + sign(d.spell.attack) + '</b></div>' + slotsHtml(d.spell) + '</div>';
    }
    var feats = s.feats.map(function (f) { return f.name; });
    html += '<div class="sum-section sum-detail"><h3>Feats</h3><div>' + (feats.length ? esc(feats.join(', ')) : '<span class="muted">None yet</span>') + '</div></div>';
    if (s.warnings.length) html += '<div class="sum-section"><ul class="warn-list">' + s.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
    html += '</section>';
    return html;
  }

  function slotsHtml(sp) {
    if (sp.pact) return '<div class="slots"><span class="slot">' + sp.pact.count + ' Pact slot' + (sp.pact.count > 1 ? 's' : '') + ' · level ' + sp.pact.level + '</span></div>';
    return '<div class="slots">' + sp.slots.map(function (n, i) { return '<span class="slot" title="Level ' + (i + 1) + ' slots">L' + (i + 1) + ' × ' + n + '</span>'; }).join('') + '</div>';
  }

  function renderSheet() {
    var b = cur(), lv = ev.levels[b.level - 1], d = lv.d, s = lv.state;
    var gear = b.gear || { armor: 'none', shield: false, weapons: [] };

    var abilities = '<section class="card"><div class="card-head"><h3>Abilities &amp; saves</h3></div><div class="card-body"><div class="rows">' +
      D.ABILITIES.map(function (a) {
        return '<div class="row"><span><span class="prof-dot' + (d.saves[a].prof ? ' p1' : '') + '"></span>' + D.ABILITY_NAMES[a] + ' <span class="muted num">' + s.abilities[a] + ' (' + sign(d.mods[a]) + ')</span></span><span class="v">save ' + sign(d.saves[a].total) + '</span></div>';
      }).join('') + '</div>' + (s.flags.auraOfProtection ? '<p class="desc">Saves include Aura of Protection (' + sign(Math.max(1, d.mods.cha)) + ').</p>' : '') + '</div></section>';

    var skills = '<section class="card"><div class="card-head"><h3>Skills</h3><span class="muted">● proficient · ◉ expertise</span></div><div class="card-body"><div class="rows">' +
      Object.keys(D.SKILLS).map(function (k) {
        var sk = d.skills[k];
        return '<div class="row"><span><span class="prof-dot' + (sk.level ? ' p' + sk.level : '') + '"></span>' + D.SKILLS[k].name + ' <span class="muted">' + abbr(D.SKILLS[k].ability) + '</span></span><span class="v">' + sign(sk.total) + '</span></div>';
      }).join('') + '</div></div></section>';

    var combat = '<section class="card"><div class="card-head"><h3>Combat</h3></div><div class="card-body"><div class="rows">' +
      [['Armor Class', d.ac + ' <span class="muted">(' + esc(d.acHow) + ')</span>'], ['Hit Points', d.hp + ' <span class="muted">(' + d.hitDice + ')</span>'],
        ['Initiative', sign(d.init)], ['Speed', d.speed + ' ft'], ['Attacks per action', d.attacksPerAction], ['Critical hit on', d.crit === 20 ? '20' : d.crit + '–20']]
        .map(function (r) { return '<div class="row"><span>' + r[0] + '</span><span class="v">' + r[1] + '</span></div>'; }).join('') + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Attack</th><th class="n">Hit</th><th>Damage</th><th>Mastery</th></tr></thead><tbody>' +
      (d.attacks.length ? d.attacks.map(function (a) {
        return '<tr><td>' + esc(a.name) + (a.prof ? '' : ' <span class="pill pill-todo">not proficient</span>') + '</td><td class="n">' + sign(a.hit) + '</td><td>' + esc(a.dmg) + '</td><td>' + (a.mastery ? '<span title="' + esc(D.MASTERY[a.mastery]) + '">' + a.mastery + '</span>' : '<span class="muted">—</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">Add a weapon below.</td></tr>') + '</tbody></table></div>' +
      '<div class="gear-grid">' +
      '<div class="field"><label for="g-armor">Armor</label><select id="g-armor">' + D.ARMOR.map(function (a) {
        return '<option value="' + a.id + '"' + (a.id === gear.armor ? ' selected' : '') + '>' + esc(a.name) + (a.ac ? ' (' + a.type + ', AC ' + a.ac + ')' : '') + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><span class="label">Shield</span><label><input type="checkbox" id="g-shield"' + (gear.shield ? ' checked' : '') + '> Carry a Shield (+2 AC)</label></div>' +
      '<div class="field"><label for="g-add">Add weapon</label><select id="g-add"><option value="">— Weapon —</option>' + D.WEAPONS.map(function (w) {
        return '<option value="' + w.id + '">' + esc(w.name) + ' (' + w.cat + ', ' + w.dmg + ')</option>';
      }).join('') + '</select></div></div>' +
      '<div class="chips">' + (gear.weapons || []).map(function (id) {
        var w = D.weapon(id);
        return '<span class="chip">' + esc(w ? w.name : id) + '<button type="button" data-rmweapon="' + esc(id) + '" aria-label="Remove ' + esc(w ? w.name : id) + '">×</button></span>';
      }).join('') + '</div></div></section>';

    var resources = d.columns.length || d.spell ? '<section class="card"><div class="card-head"><h3>Class resources</h3></div><div class="card-body"><div class="rows">' +
      d.columns.map(function (c) { return '<div class="row"><span>' + esc(c.label) + '</span><span class="v">' + esc(c.value) + '</span></div>'; }).join('') +
      (d.spell ? '<div class="row"><span>Spell save DC / attack</span><span class="v">' + d.spell.dc + ' / ' + sign(d.spell.attack) + '</span></div>' +
        (d.spell.cantrips ? '<div class="row"><span>Cantrips known</span><span class="v">' + d.spell.cantrips + '</span></div>' : '') +
        '<div class="row"><span>Prepared spells</span><span class="v">' + d.spell.prepared + '</span></div>' : '') + '</div>' +
      (d.spell ? slotsHtml(d.spell) : '') + '</div></section>' : '';

    // Features gained up to this level.
    var featureRefs = [];
    ev.levels.slice(0, b.level).forEach(function (l) {
      l.features.forEach(function (f) {
        if (f.name === 'Proficiencies') return;
        featureRefs.push('<div class="feature-ref"><b>' + esc(f.name) + ' <span class="muted">· ' + (f.source === 'Class' ? 'Level ' + l.level : esc(f.source) + ' ' + l.level) + '</span></b>' + summaryOfChoices(f) + '<span>' + esc(f.desc) + '</span></div>');
      });
    });
    var features = '<section class="card"><div class="card-head"><h3>Class features</h3></div><div class="card-body">' + featureRefs.join('') + '</div></section>';

    var traitRefs = ev.species.traits.map(function (t) { return '<div class="feature-ref"><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div>'; }).join('');
    var featRefs = s.feats.map(function (f) { return '<div class="feature-ref"><b>' + esc(f.name) + ' <span class="muted">· ' + esc(f.source) + '</span></b><span>' + esc(f.desc) + '</span></div>'; }).join('');
    var traits = '<section class="card"><div class="card-head"><h3>Species traits &amp; feats</h3></div><div class="card-body">' + traitRefs + (featRefs || '') + '</div></section>';

    var profRows = [
      ['Armor', s.profs.armor.join(', ') || 'None'],
      ['Weapons', s.profs.weapons.join(', ').replace('martial-light', 'martial (Light)').replace('martial-finesse-light', 'martial (Finesse or Light)')],
      ['Tools', s.profs.tools.join(', ') || 'None'],
      ['Weapon masteries', s.masteries.map(function (id) { var w = D.weapon(id); return w ? w.name + ' (' + w.mastery + ')' : id; }).join(', ') || '—'],
      ['Size', s.size], ['Darkvision', s.darkvision ? s.darkvision + ' ft' : '—'], ['Senses', s.senses.join(', ') || '—'],
      ['Resistances', s.resist.filter(function (r, i, a) { return a.indexOf(r) === i; }).join(', ') || '—']
    ];
    if (s.metamagic.length) profRows.push(['Metamagic', s.metamagic.join(', ')]);
    if (s.invocations.length) profRows.push(['Invocations', s.invocations.map(function (id) { var i = find(D.INVOCATIONS, id); return i ? i.name : id; }).join(', ')]);
    var profs = '<section class="card"><div class="card-head"><h3>Proficiencies &amp; defenses</h3></div><div class="card-body"><div class="rows">' +
      profRows.map(function (r) { return '<div class="row"><span>' + r[0] + '</span><span style="text-align:right">' + esc(r[1]) + '</span></div>'; }).join('') + '</div>' +
      (s.notes.length ? '<p class="desc">' + esc(s.notes.join(' · ')) + '</p>' : '') + '</div></section>';

    var warn = s.warnings.length ? '<section class="card"><div class="card-head"><h3>Check these</h3></div><div class="card-body"><ul class="warn-list">' +
      s.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div></section>' : '';

    return '<div class="toolbar"><h2>Character sheet at level ' + b.level + '</h2><span class="muted">Change the level in the bar above to see any point of the build.</span></div>' +
      warn + '<div class="sheet-grid">' + combat + abilities + skills + resources + profs + traits + '</div>' + features;
  }

  function summaryOfChoices(f) {
    var parts = [];
    (function walk(list) {
      list.forEach(function (c) {
        var vals = Array.isArray(c.value) ? c.value : c.value ? [c.value] : [];
        var labels = vals.map(function (v) { var o = find(c.options, v); return o ? o.label : v; });
        if (labels.length) parts.push(labels.join(', '));
        walk(c.children);
      });
    })(f.choices);
    return parts.length ? '<span class="chosen" style="color:var(--accent)">' + esc(parts.join(' · ')) + '</span>' : '';
  }

  /* ---------- Rendering: spells ---------- */

  function renderSpells() {
    var b = cur(), lv = ev.levels[b.level - 1], s = lv.state;
    var always = s.spells.always;
    var rep = D.spellReport(b, ev, b.level);
    var html = '<div class="toolbar"><h2>Spells at level ' + b.level + '</h2></div>';
    if (!rep && !always.length) {
      return html + '<section class="card"><div class="card-body"><p>' + esc(ev.cls.name) + ' has no Spellcasting feature. Spells from your species, background, or feats appear here once you pick them (for example a Magic Initiate feat, or an Elf or Tiefling lineage).</p></div></section>';
    }
    if (rep) {
      var sp = rep.d;
      html += '<section class="card"><div class="card-head"><h3>' + esc(ev.cls.name) + ' spellcasting</h3><span class="muted">' + D.ABILITY_NAMES[sp.ability] + ' · Save DC ' + sp.dc + ' · Attack ' + sign(sp.attack) +
        ' · Lists: ' + sp.lists.map(function (l) { return l[0].toUpperCase() + l.slice(1); }).join(', ') + '</span></div><div class="card-body">' + slotsHtml(sp);
      if (sp.cantrips) {
        html += '<div class="field"><div class="toolbar"><span class="label">Cantrips</span><span class="pill ' + (countOk(rep.cantrips) < sp.cantrips ? 'pill-todo' : 'pill-ok') + '">' + countOk(rep.cantrips) + ' / ' + sp.cantrips + '</span></div>' +
          '<div class="chips">' + rep.cantrips.map(spellChip('cantrips')).join('') + '<button type="button" class="btn btn-small" data-spellpick="cantrips">Choose cantrips</button></div></div>';
      }
      html += '<div class="field"><div class="toolbar"><span class="label">Prepared spells (up to level ' + sp.maxLevel + ')</span><span class="pill ' + (rep.preparedCount < sp.prepared ? 'pill-todo' : 'pill-ok') + '">' + rep.preparedCount + ' / ' + sp.prepared + '</span></div>' +
        '<p class="desc">Plan ahead: spells you can\'t prepare yet stay in the list and show the class level where they unlock.</p>' +
        '<div class="spell-groups">' + groupByLevel(rep.prepared).map(function (g) {
          return '<div class="spell-group"><h4>Level ' + g.level + '</h4><div class="chips">' + g.items.map(spellChip('prepared')).join('') + '</div></div>';
        }).join('') + '</div><div><button type="button" class="btn btn-small btn-primary" data-spellpick="prepared">Choose prepared spells</button></div></div></div></section>';
    }
    if (always.length) {
      html += '<section class="card"><div class="card-head"><h3>Always prepared &amp; granted</h3><span class="muted">Don\'t count against your prepared total</span></div><div class="card-body"><div class="rows">' +
        always.map(function (a) {
          var l = D.SPELL_LEVEL[a.name];
          return '<div class="row"><span>' + esc(a.name) + ' <span class="muted">' + (l === 0 ? 'cantrip' : l ? 'level ' + l : '') + '</span></span><span class="muted" style="text-align:right">' + esc(a.source) + '</span></div>';
        }).join('') + '</div></div></section>';
    }
    return html;
  }
  function countOk(list) { return list.filter(function (x) { return x.ok; }).length; }
  function groupByLevel(list) {
    var g = {};
    list.forEach(function (x) { var l = x.level || 0; (g[l] = g[l] || []).push(x); });
    return Object.keys(g).sort(function (a, b) { return a - b; }).map(function (l) { return { level: l, items: g[l] }; });
  }
  function spellChip(kind) {
    return function (x) {
      return '<span class="chip' + (x.ok ? '' : ' bad') + '" title="' + esc(x.note) + '">' + esc(x.name) + (x.note ? ' <small>· ' + esc(x.note) + '</small>' : '') +
        '<button type="button" data-rmspell="' + kind + '" data-value="' + esc(x.name) + '" aria-label="Remove ' + esc(x.name) + '">×</button></span>';
    };
  }

  /* ---------- Rendering: progression ---------- */

  function renderProgression() {
    var b = cur();
    var cols = ev.cls.columns || [];
    var hasSpells = !!ev.cls.caster;
    var head = '<tr><th class="n">Lvl</th><th class="n">PB</th><th class="n">HP</th><th class="n">AC</th>' +
      D.ABILITIES.map(function (a) { return '<th class="n">' + abbr(a) + '</th>'; }).join('') +
      '<th>Features gained (your choices in green)</th>' + cols.map(function (c) { return '<th class="n">' + esc(c.label) + '</th>'; }).join('') +
      (hasSpells ? '<th class="n">Cantrips</th><th class="n">Prepared</th><th>Spell slots</th>' : '') + '</tr>';
    var rows = ev.levels.map(function (lv) {
      var L = lv.level, d = lv.d, prev = L > 1 ? ev.levels[L - 2].state.abilities : null;
      var feats = lv.features.map(function (f) {
        var chosen = summaryOfChoices(f);
        var todo = D.countIssues(f.choices).missing;
        return esc(f.name) + (chosen ? ' <span class="chosen">(' + chosen.replace(/^<span[^>]*>|<\/span>$/g, '') + ')</span>' : '') + (todo ? ' <span class="pill pill-todo">choose</span>' : '');
      }).join('; ') || '<span class="muted">—</span>';
      var sp = d.spell;
      return '<tr data-level="' + L + '" class="' + (L === b.level ? 'current' : L > b.level ? 'ahead' : '') + '"><td class="n"><b>' + L + '</b></td><td class="n">' + sign(d.pb) + '</td><td class="n">' + d.hp + '</td><td class="n">' + d.ac + '</td>' +
        D.ABILITIES.map(function (a) {
          var v = lv.state.abilities[a], up = prev && v > prev[a];
          return '<td class="n"' + (up ? ' style="color:var(--gold);font-weight:700"' : '') + '>' + v + '</td>';
        }).join('') +
        '<td class="feats">' + feats + '</td>' + d.columns.map(function (c) { return '<td class="n">' + esc(c.value) + '</td>'; }).join('') +
        (hasSpells ? '<td class="n">' + (sp.cantrips || '—') + '</td><td class="n">' + sp.prepared + '</td><td>' + (sp.pact ? sp.pact.count + ' × L' + sp.pact.level : sp.slots.join(' · ')) + '</td>' : '') + '</tr>';
    }).join('');
    return '<div class="toolbar"><h2>All 20 levels at a glance</h2><span class="muted">' + esc(ev.cls.name) + ' · click a row to view that level</span></div>' +
      '<div class="table-wrap prog"><table><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------- Modal pickers ---------- */

  function openPicker(key) { app.modal = { type: 'choice', key: key, q: '' }; renderModal(); }
  function openSpellPicker(kind) { app.modal = { type: 'spells', kind: kind, q: '' }; renderModal(); }
  function closeModal() { app.modal = null; $('#modal').hidden = true; $('#modal').innerHTML = ''; }

  function modalShell(title, sub, list, foot) {
    var m = app.modal;
    return '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><div class="dialog-head"><h3 id="dlg-title">' + esc(title) + '</h3><span class="muted">' + sub + '</span></div>' +
      '<div class="dialog-tools"><label class="sr" for="dlg-q">Search</label><input id="dlg-q" type="text" placeholder="Search…" value="' + esc(m.q) + '"></div>' +
      '<div class="dialog-list" id="dlg-list">' + list + '</div><div class="dialog-foot">' + (foot || '') + '<button type="button" class="btn btn-primary" data-close="1">Done</button></div></div>';
  }

  function renderModal() {
    var m = app.modal, el = $('#modal');
    if (!m) return closeModal();
    var focusQ = document.activeElement && document.activeElement.id === 'dlg-q';
    var scroll = $('#dlg-list') ? $('#dlg-list').scrollTop : 0;
    var html;
    if (m.type === 'io') {
      if (!el.hidden && $('#io-text')) return;
      html = ioDialog();
    } else if (m.type === 'choice') {
      var rec = findRec(m.key);
      if (!rec) return closeModal();
      var vals = Array.isArray(rec.value) ? rec.value : [];
      var full = vals.length >= rec.count;
      var q = m.q.toLowerCase(), lastGroup = null;
      var list = rec.options.filter(function (o) { return !q || (o.label + ' ' + (o.desc || '')).toLowerCase().indexOf(q) >= 0; }).map(function (o) {
        var on = vals.indexOf(o.id) >= 0;
        var disabled = !on && (full || !!o.unavailable);
        var g = o.group && o.group !== lastGroup ? '<div class="pick-group">' + esc(o.group) + '</div>' : '';
        lastGroup = o.group;
        return g + '<label class="pick' + (o.unavailable && !on ? ' unavail' : '') + '"><input type="checkbox" data-toggle="' + esc(o.id) + '"' + (on ? ' checked' : '') + (disabled ? ' disabled' : '') + '>' +
          '<span><b>' + esc(o.label) + '</b>' + (o.unavailable ? ' <span class="pill pill-plain">' + esc(o.unavailable) + '</span>' : '') + '</span>' +
          (o.desc ? '<span class="pick-desc">' + esc(o.desc) + '</span>' : '') + '</label>';
      }).join('') || '<p class="muted" style="padding:12px">No matches.</p>';
      html = modalShell(rec.label, vals.length + ' of ' + rec.count + ' chosen', list);
    } else {
      var b = cur(), lv = ev.levels[b.level - 1], sp = lv.d.spell, c = ev.cls.caster;
      var picked = b.spells[m.kind] || [];
      var lists = ev.levels[19].d.spell.lists.slice();
      (lv.state.spells.extraLists || []).forEach(function (l) { if (lists.indexOf(l) < 0) lists.push(l); });
      var opts = m.kind === 'cantrips' ? D.spellOptions(lists, 0, 0) : D.spellOptions(lists, 1, 9);
      var q2 = m.q.toLowerCase(), lg = null;
      var limit = m.kind === 'cantrips' ? sp.cantrips : sp.prepared;
      var alwaysNames = lv.state.spells.always.map(function (a) { return a.name; });
      var list2 = opts.filter(function (o) { return !q2 || o.label.toLowerCase().indexOf(q2) >= 0; }).map(function (o) {
        var on = picked.indexOf(o.id) >= 0;
        var sl = D.SPELL_LEVEL[o.id], at = D.levelForSpell(c, sl);
        var tag = m.kind === 'prepared' && sl > sp.maxLevel ? (at <= 20 ? 'Unlocks at class level ' + at : 'Beyond your slots') : '';
        var alw = alwaysNames.indexOf(o.id) >= 0 ? 'Already always prepared' : '';
        var g = o.group !== lg ? '<div class="pick-group">' + esc(o.group) + '</div>' : '';
        lg = o.group;
        return g + '<label class="pick' + (tag ? ' unavail' : '') + '"><input type="checkbox" data-spelltoggle="' + esc(o.id) + '"' + (on ? ' checked' : '') + '>' +
          '<span>' + esc(o.label) + (tag ? ' <span class="pill pill-plain">' + esc(tag) + '</span>' : '') + (alw ? ' <span class="pill pill-gold">' + alw + '</span>' : '') + '</span></label>';
      }).join('') || '<p class="muted" style="padding:12px">No matches.</p>';
      html = modalShell(m.kind === 'cantrips' ? 'Choose cantrips' : 'Choose prepared spells',
        picked.length + ' picked · ' + limit + ' allowed at level ' + b.level, list2);
    }
    el.innerHTML = html;
    el.hidden = false;
    if ($('#dlg-list')) $('#dlg-list').scrollTop = scroll;
    if (focusQ) { var qi = $('#dlg-q'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }

  function ioDialog() {
    var json = JSON.stringify(cur(), null, 1);
    return '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><div class="dialog-head"><h3 id="dlg-title">Export / Import</h3><span class="muted">Copy this text to back up or share the build. Paste a build here to import it.</span></div>' +
      '<div class="dialog-tools"></div><div class="dialog-list" style="padding:12px 16px"><label class="sr" for="io-text">Build JSON</label><textarea id="io-text" class="io" spellcheck="false">' + esc(json) + '</textarea>' +
      '<p class="desc" id="io-msg" aria-live="polite"></p></div>' +
      '<div class="dialog-foot"><button type="button" class="btn" data-io="copy">Copy</button><button type="button" class="btn" data-io="import">Import as new build</button><button type="button" class="btn btn-primary" data-close="1">Done</button></div></div>';
  }

  /* ---------- Main render ---------- */

  function render() {
    var b = cur();
    if (!b) { app.builds = exampleBuilds(); app.currentId = app.builds[0].id; b = cur(); }
    app.currentId = b.id;
    ev = D.evaluate(b);
    renderHeader();
    var primary = $('#primary');
    var y = window.scrollY;
    var html = app.tab === 'sheet' ? renderSheet() : app.tab === 'spells' ? renderSpells() : app.tab === 'progression' ? renderProgression() : renderBuild();
    primary.innerHTML = html;
    $('#summary').innerHTML = renderSummary();
    document.querySelector('.cols').classList.toggle('wide', app.tab === 'progression');
    window.scrollTo(0, y);
    if (app.modal) renderModal();
  }

  /* ---------- Events ---------- */

  function onClick(e) {
    var t = e.target.closest('button, [data-level], [data-tab]');
    if (!t) return;
    var b = cur();
    if (t.id !== 'delete-btn' && app.deleteArmed) { app.deleteArmed = false; renderHeader(); }

    if (t.dataset.tab) { app.tab = t.dataset.tab; window.scrollTo(0, 0); commit(); return; }
    if (t.dataset.level) {
      setLevel(+t.dataset.level);
      if (app.tab === 'build' && t.closest('#rail')) {
        var card = document.getElementById('lvl-' + t.dataset.level);
        if (card) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      return;
    }
    if (t.dataset.method) {
      b.abilityMethod = t.dataset.method;
      if (b.abilityMethod === 'standard') {
        var used = {}, arr = D.STANDARD_ARRAY.slice();
        // Keep the current ranking of abilities while snapping to the array.
        D.ABILITIES.slice().sort(function (x, y) { return b.base[y] - b.base[x]; }).forEach(function (a, i) { used[a] = arr[i]; });
        b.base = used;
      } else if (b.abilityMethod === 'pointbuy') {
        D.ABILITIES.forEach(function (a) { b.base[a] = Math.max(8, Math.min(15, b.base[a])); });
      }
      commit(); return;
    }
    if (t.dataset.showall) { app.showAll = t.dataset.showall === '1'; commit(); return; }
    if (t.dataset.pick) { openPicker(t.dataset.pick); return; }
    if (t.dataset.remove) {
      var vals = (b.choices[t.dataset.remove] || []).filter(function (v) { return v !== t.dataset.value; });
      setChoice(t.dataset.remove, vals); return;
    }
    if (t.dataset.spellpick) { openSpellPicker(t.dataset.spellpick); return; }
    if (t.dataset.rmspell) {
      b.spells[t.dataset.rmspell] = b.spells[t.dataset.rmspell].filter(function (n) { return n !== t.dataset.value; });
      commit(); return;
    }
    if (t.dataset.rmweapon) {
      b.gear.weapons = b.gear.weapons.filter(function (w) { return w !== t.dataset.rmweapon; });
      commit(); return;
    }
    if (t.dataset.close) { closeModal(); return; }
    if (t.dataset.io === 'copy') {
      var ta = $('#io-text'), msg = $('#io-msg');
      var done = function () { msg.textContent = 'Copied to clipboard.'; };
      var fallback = function () { ta.focus(); ta.select(); msg.textContent = 'Text selected. Press Ctrl+C (or ⌘C) to copy.'; };
      try { navigator.clipboard.writeText(ta.value).then(done, fallback); } catch (err) { fallback(); }
      return;
    }
    if (t.dataset.io === 'import') {
      try {
        var nb = JSON.parse($('#io-text').value);
        if (!nb || typeof nb !== 'object' || !nb.classId || !nb.base) throw new Error('missing fields');
        var fresh = D.newBuild();
        Object.keys(fresh).forEach(function (k) { if (nb[k] === undefined) nb[k] = fresh[k]; });
        nb.id = fresh.id; nb.name = (nb.name || 'Imported') + ' (imported)';
        app.builds.push(nb); app.currentId = nb.id; closeModal(); commit();
      } catch (err) {
        $('#io-msg').textContent = 'That text isn\'t a build. Paste the full text from another build\'s Export.';
      }
      return;
    }
    switch (t.dataset.action) {
      case 'level-down': setLevel(b.level - 1); break;
      case 'level-up': setLevel(b.level + 1); break;
      case 'new': {
        var n = D.newBuild({ name: 'Hero ' + (app.builds.length + 1) });
        app.builds.push(n); app.currentId = n.id; app.tab = 'build'; commit(); window.scrollTo(0, 0); break;
      }
      case 'copy': {
        var c = JSON.parse(JSON.stringify(b));
        c.id = D.newBuild().id; c.name = (b.name || 'Build') + ' (copy)';
        app.builds.push(c); app.currentId = c.id; commit(); break;
      }
      case 'delete':
        if (!app.deleteArmed) { app.deleteArmed = true; renderHeader(); break; }
        app.deleteArmed = false;
        app.builds = app.builds.filter(function (x) { return x.id !== b.id; });
        if (!app.builds.length) app.builds.push(D.newBuild());
        app.currentId = app.builds[0].id; commit(); break;
      case 'io': app.modal = { type: 'io' }; renderModal(); break;
    }
  }

  function onChange(e) {
    var t = e.target, b = cur();
    if (t.id === 'build-select') { app.currentId = t.value; commit(); return; }
    if (t.id === 'build-name') { b.name = t.value.trim() || 'Unnamed'; commit(); return; }
    if (t.dataset.choice) { setChoice(t.dataset.choice, t.value); return; }
    if (t.dataset.ability) {
      var a = t.dataset.ability, v = parseInt(t.value, 10);
      if (isNaN(v)) return;
      if (b.abilityMethod === 'standard') {
        // Swap with whichever ability held this value so the array stays valid.
        var other = D.ABILITIES.filter(function (x) { return x !== a && b.base[x] === v; })[0];
        if (other) b.base[other] = b.base[a];
      }
      b.base[a] = Math.max(1, Math.min(30, v));
      commit(); return;
    }
    if (t.id === 'f-class') { b.classId = t.value; b.gear = JSON.parse(JSON.stringify(DEFAULT_GEAR[t.value] || DEFAULT_GEAR.fighter)); b.spells = { cantrips: [], prepared: [] }; commit(); return; }
    if (t.id === 'f-species') { b.speciesId = t.value; commit(); return; }
    if (t.id === 'f-bg') { b.backgroundId = t.value; commit(); return; }
    if (t.id === 'g-armor') { b.gear.armor = t.value; commit(); return; }
    if (t.id === 'g-shield') { b.gear.shield = t.checked; commit(); return; }
    if (t.id === 'g-add' && t.value) { b.gear.weapons = (b.gear.weapons || []).concat(t.value); commit(); return; }
    if (t.dataset.toggle) {
      var rec = findRec(app.modal.key);
      var vals = (Array.isArray(rec.value) ? rec.value : []).slice();
      if (t.checked) vals.push(t.dataset.toggle); else vals = vals.filter(function (x) { return x !== t.dataset.toggle; });
      setChoice(rec.key, vals);
      if (rec.count === 1 && t.checked) closeModal();
      return;
    }
    if (t.dataset.spelltoggle) {
      var k = app.modal.kind, list = (b.spells[k] || []).slice(), n = t.dataset.spelltoggle;
      if (t.checked) { if (list.indexOf(n) < 0) list.push(n); } else list = list.filter(function (x) { return x !== n; });
      b.spells[k] = list; commit(); return;
    }
  }

  function onInput(e) {
    if (e.target.id === 'dlg-q' && app.modal) { app.modal.q = e.target.value; renderModal(); }
  }

  function onKey(e) {
    if (e.key === 'Escape' && app.modal) { closeModal(); return; }
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || app.modal) return;
    if (e.key === 'ArrowLeft' || e.key === '[') setLevel(cur().level - 1);
    if (e.key === 'ArrowRight' || e.key === ']') setLevel(cur().level + 1);
  }

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKey);
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });

  load();
  var hashTab = (location.hash || '').replace('#', '');
  if (['build', 'sheet', 'spells', 'progression'].indexOf(hashTab) >= 0) app.tab = hashTab;
  render();
})();
