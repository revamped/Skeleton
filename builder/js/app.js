/*
 * Levelwright UI: renders the build timeline, character sheet, spell picker and
 * 20-level progression from DND.evaluate(), and saves builds in localStorage.
 */
(function () {
  var D = window.DND;
  var STORE_KEY = 'levelwright.v1';

  var app = { builds: [], currentId: null, tab: 'build', showAll: true, modal: null, deleteArmed: false,
    lib: { cat: 'spells', q: '', f1: '', f2: '' }, importing: '', clearArmed: false, ready: false };
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
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ builds: app.builds, currentId: app.currentId, tab: app.tab, showAll: app.showAll, libCat: app.lib.cat })); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && Array.isArray(data.builds) && data.builds.length) {
          app.builds = data.builds; app.currentId = data.currentId; app.tab = data.tab || 'build';
          app.showAll = data.showAll !== false;
          if (data.libCat) app.lib.cat = data.libCat;
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
      (lv.cls.features[lv.classLevel] || []).forEach(function (f) {
        if (f.subclassSlot) marks.push('sub');
        else if (f.name === 'Ability Score Improvement') marks.push('asi');
        else if (f.name === 'Epic Boon') marks.push('boon');
      });
      var mk = marks.indexOf('sub') >= 0 ? 'sub' : marks.indexOf('boon') >= 0 ? 'boon' : marks.indexOf('asi') >= 0 ? 'feat' : '';
      if (ev.multiclass) mk = classBase(lv.cls.name).slice(0, 3) + (mk ? '·' + mk[0] : '');
      var todo = lv.issues.missing + lv.issues.problems > 0;
      var cls = [L < b.level ? 'reached' : '', L === b.level ? 'current' : '', todo ? 'todo' : ''].join(' ');
      return '<li class="' + cls + (ev.multiclass && lv.cls.id !== b.classId ? ' other' : '') + '"><button type="button" data-level="' + L + '" title="Level ' + L + ': ' + esc(lv.cls.name) + ' ' + lv.classLevel + (todo ? ' — choices needed' : '') + '"' +
        (L === b.level ? ' aria-current="step"' : '') + '><span>' + L + '</span><span class="mk">' + mk + '</span></button></li>';
    }).join('');

    document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.tab === app.tab ? 'true' : 'false'); });
  }

  /* ---------- Rendering: choices ---------- */

  function renderChoice(rec) {
    var problems = rec.problems.length ? '<ul class="problems">' + rec.problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '';
    var state = rec.missing ? ' todo' : rec.problems.length ? ' problem' : '';
    var pill = rec.missing ? '<span class="pill pill-todo">' + (rec.kind === 'many' ? rec.missing + ' to choose' : 'choose') + '</span>' :
      rec.optional && !rec.value ? '<span class="pill pill-plain">optional</span>' : '';
    var id = 'c-' + rec.key.replace(/[^a-zA-Z0-9_-]/g, '_');
    var body;
    if (rec.kind === 'one' && rec.options.length > 20) {
      var cur1 = find(rec.options, rec.value);
      body = '<div class="chips"><button type="button" id="' + id + '" class="btn picker-btn' + (rec.missing ? ' btn-primary' : '') + '" data-pick="' + esc(rec.key) + '">' +
        (cur1 ? esc(cur1.label) : 'Choose…') + ' <span class="muted">' + rec.options.length + ' options</span></button></div>' +
        (cur1 && cur1.desc ? (cur1.desc.length > 280 ? longText(cur1.desc) : '<p class="opt-desc">' + esc(cur1.desc) + '</p>') : '');
    } else if (rec.kind === 'one') {
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
        (chosen && chosen.desc ? (chosen.desc.length > 280 ? longText(chosen.desc) : '<p class="opt-desc">' + esc(chosen.desc) + '</p>') : '');
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

  // Built-in content first, then compendium content grouped by edition.
  function contentGroups(list) {
    var groups = [['2024 rules (built in)', []], ['Compendium · 2024', []], ['Compendium · 2014 and other', []]];
    list.forEach(function (x) { groups[!x.compendium ? 0 : x.ed === '2024' ? 1 : 2][1].push(x); });
    groups.slice(1).forEach(function (g) { g[1].sort(function (a, b) { return a.name.localeCompare(b.name); }); });
    return groups.filter(function (g) { return g[1].length; });
  }
  function pickerField(id, label, kind, list, value, descFn, opts) {
    opts = opts || {};
    var curItem = find(list, value);
    return '<div class="field"><label for="' + id + '">' + label + '</label><button type="button" id="' + id + '" class="btn picker-btn" data-openlist="' + kind + '">' +
      '<span>' + esc(opts.title || (curItem ? curItem.name : 'Choose…')) + '</span><span class="muted">' + (opts.count || list.length) + ' ▾</span></button>' +
      (opts.after || '') +
      (descFn && curItem ? '<p class="desc">' + esc(descFn(curItem)) + (curItem.src ? ' · ' + esc(curItem.src) : '') + '</p>' : '') + '</div>';
  }

  /* ---------- Species grouped by base name (Gnome → Forest, Rock, Deep…) ---------- */

  function speciesBase(name) { return name.split(/,| \(| of /)[0].trim(); }
  // Backgrounds: "Acolyte (2014)", "Baldur's Gate Acolyte", "Cultist (UA)" all group under their base.
  function backgroundBase(name) { return name.replace(/^Baldur's Gate /, '').split(/ \(|, /)[0].trim(); }
  function classBase(name) { return name.split(' (')[0].trim(); }
  function baseOf(kind, name) { return kind === 'background' ? backgroundBase(name) : kind === 'class' ? classBase(name) : speciesBase(name); }
  function speciesGroups(kind) {
    kind = kind || 'species';
    var groups = {}, order = [];
    (kind === 'background' ? D.BACKGROUNDS : kind === 'class' ? D.CLASSES : D.SPECIES).forEach(function (sp) {
      var base = baseOf(kind, sp.name), key = base.toLowerCase();
      if (!groups[key]) { groups[key] = { key: key, name: base, list: [] }; order.push(key); }
      groups[key].list.push(sp);
    });
    order.forEach(function (k) {
      groups[k].list.sort(function (a, c) {
        var ra = !a.compendium ? 0 : a.ed === '2024' ? 1 : 2, rc = !c.compendium ? 0 : c.ed === '2024' ? 1 : 2;
        return ra - rc || a.name.localeCompare(c.name);
      });
    });
    return { map: groups, order: order };
  }
  function variantLabel(sp, kind) {
    var base = baseOf(kind || 'species', sp.name);
    var rest = sp.name.indexOf(base) === 0 ? sp.name.slice(base.length).replace(/^,\s*/, '').trim() : sp.name.replace(base, '').trim();
    if (!rest) return 'Standard';
    return rest[0] === '(' ? 'Standard ' + rest : rest;
  }
  // Subclass dropdown under the class picker; it shares the level choice key.
  function classSubField() {
    var b = cur(), cls = ev.cls;
    if (!cls.subclasses || !cls.subclasses.length) return '';
    var key = cls.id + '.subclass', val = b.choices[key];
    var groups = [['Built in (2024 SRD)', []], ['From your compendium', []]];
    cls.subclasses.forEach(function (sc) { groups[sc.compendium ? 1 : 0][1].push(sc); });
    groups = groups.filter(function (g) { return g[1].length; });
    var needs = !val;
    return '<div class="subfield' + (needs ? ' todo' : '') + '"><label for="f-subclass">' + esc(cls.subclassLabel || 'Subclass') + ' · level ' + (cls.subclassLevel || 3) +
      (needs ? ' <span class="pill pill-todo">choose</span>' : '') + '</label><select id="f-subclass">' + (needs ? '<option value="">— Choose —</option>' : '') +
      groups.map(function (g) {
        var inner = g[1].map(function (sc) { return '<option value="' + esc(sc.id) + '"' + (sc.id === val ? ' selected' : '') + '>' + esc(sc.name) + '</option>'; }).join('');
        return groups.length > 1 ? '<optgroup label="' + esc(g[0]) + '">' + inner + '</optgroup>' : inner;
      }).join('') + '</select><span class="muted sub-count">' + cls.subclasses.length + ' subclass' + (cls.subclasses.length === 1 ? '' : 'es') + ' for ' + esc(cls.name) + '</span></div>';
  }
  function backgroundSubField() { return versionField('background', ev.background, cur().backgroundId, 'f-subbg'); }
  function classVersionField() { return versionField('class', ev.cls, cur().classId, 'f-classver'); }
  function versionField(kind, item, curId, fieldId) {
    var g = speciesGroups(kind).map[baseOf(kind, item.name).toLowerCase()];
    if (!g || g.list.length < 2) return '';
    var groups = [];
    g.list.forEach(function (x) {
      var gl = !x.compendium ? '2024 rules (built in)' : x.ed === '2024' ? 'Compendium · 2024' : 'Compendium · 2014 and other';
      var last = groups[groups.length - 1];
      if (!last || last.label !== gl) groups.push(last = { label: gl, opts: [] });
      var vl = variantLabel(x, kind);
      if (!x.compendium) vl = '2024 rules (SRD)';
      else if (vl === 'Standard') vl = x.ed === '2024' ? '2024' : 'Standard';
      else vl = vl.replace(/^Standard \((.*)\)$/, '$1');
      last.opts.push([x.id, vl + (x.compendium && x.src ? ' — ' + x.src : '')]);
    });
    return '<div class="subfield"><label for="' + fieldId + '">Version · ' + esc(g.name) + '</label><select id="' + fieldId + '">' + groups.map(function (gr) {
      var inner = gr.opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === curId ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
      return groups.length > 1 ? '<optgroup label="' + esc(gr.label) + '">' + inner + '</optgroup>' : inner;
    }).join('') + '</select><span class="muted sub-count">' + g.list.length + ' versions of ' + esc(g.name) + '</span></div>';
  }
  // A built-in species' lineage-style choice (Elf lineage, Gnome lineage, Tiefling legacy, ancestries).
  function lineageSpec(sp) {
    return !sp.compendium && (sp.choices || []).filter(function (c) { return /^(lineage|legacy|ancestry)$/.test(c.id) && Array.isArray(c.options); })[0] || null;
  }
  function subspeciesField() {
    var b = cur(), sp = ev.species;
    var g = speciesGroups().map[speciesBase(sp.name).toLowerCase()];
    if (!g) return '';
    var lin = lineageSpec(sp);
    var linKey = lin ? 'sp.' + sp.id + '.' + lin.id : null;
    var curVal = b.speciesId + (lin && b.choices[linKey] ? '|' + b.choices[linKey] : '');
    var groups = [];
    g.list.forEach(function (x) {
      var gl = !x.compendium ? '2024 rules (built in)' : x.ed === '2024' ? 'Compendium · 2024' : 'Compendium · 2014 and other';
      var last = groups[groups.length - 1];
      if (!last || last.label !== gl) groups.push(last = { label: gl, opts: [] });
      var ls = lineageSpec(x);
      if (ls) ls.options.forEach(function (o) { last.opts.push([x.id + '|' + o.id, o.label]); });
      else last.opts.push([x.id, variantLabel(x) + (x.compendium && x.src ? ' — ' + x.src : '')]);
    });
    var total = groups.reduce(function (n, gr) { return n + gr.opts.length; }, 0);
    if (total < 2) return '';
    var needs = lin && !b.choices[linKey];
    return '<div class="subfield' + (needs ? ' todo' : '') + '"><label for="f-subspecies">' + (lin ? esc(lin.label) : 'Subrace') + ' · ' + esc(g.name) +
      (needs ? ' <span class="pill pill-todo">choose</span>' : '') + '</label>' +
      '<select id="f-subspecies">' + (needs ? '<option value="">— Choose —</option>' : '') + groups.map(function (gr) {
        var inner = gr.opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === curVal ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
        return groups.length > 1 ? '<optgroup label="' + esc(gr.label) + '">' + inner + '</optgroup>' : inner;
      }).join('') + '</select>' +
      '<span class="muted sub-count">' + total + ' option' + (total === 1 ? '' : 's') + ' for ' + esc(g.name) + '</span></div>';
  }
  function selectField(id, label, list, value, descFn) {
    var groups = contentGroups(list);
    var opts = groups.map(function (g) {
      var inner = g[1].map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === value ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
      return groups.length > 1 ? '<optgroup label="' + esc(g[0]) + '">' + inner + '</optgroup>' : inner;
    }).join('');
    var curItem = find(list, value);
    return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '">' + opts +
      '</select>' + (descFn && curItem ? '<p class="desc">' + esc(descFn(curItem)) + (curItem.src ? ' · ' + esc(curItem.src) : '') + '</p>' : '') + '</div>';
  }

  // Paragraph formatting for compendium text.
  function fmt(text) {
    return '<p>' + esc(text || '').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/\t/g, ' ') + '</p>';
  }
  function longText(text) {
    text = text || '';
    if (text.length <= 280) return '<div class="desc prose">' + fmt(text) + '</div>';
    var cut = text.slice(0, 220).replace(/\s+\S*$/, '');
    return '<details class="more"><summary><span class="desc">' + esc(cut) + '… </span><span class="more-link">Read more</span></summary><div class="desc prose">' + fmt(text) + '</div></details>';
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

    var linSpec = lineageSpec(ev.species), linKey = linSpec ? 'sp.' + ev.species.id + '.' + linSpec.id : null;
    var originBlocks = ev.origin.map(function (o) {
      var shownChoices = o.choices.filter(function (c) { return c.key !== linKey; });
      var traits = o.traits && o.traits.length ? '<dl class="traits">' + o.traits.map(function (t) {
        return '<div><dt>' + esc(t[0]) + '</dt><dd>' + longText(t[1]) + '</dd></div>';
      }).join('') + '</dl>' : '';
      return '<div class="field"><span class="label">' + esc(o.kind) + ': ' + esc(o.name) + '</span>' + traits +
        (shownChoices.length ? '<div class="children" style="display:grid;gap:8px">' + shownChoices.map(renderChoice).join('') + '</div>' : '') + '</div>';
    }).join('');

    var n = ev.originIssues;
    return '<section class="card" id="origin"><div class="card-head"><h2>Origin</h2>' +
      (n.missing ? '<span class="pill pill-todo">' + n.missing + ' to choose</span>' : '<span class="pill pill-ok">complete</span>') +
      '<span class="muted">Class, species, background, and ability scores</span></div><div class="card-body">' +
      '<div class="grid-3">' +
      pickerField('f-class', 'Class', 'class', D.CLASSES, b.classId, function (c) { return 'd' + c.hd + ' Hit Die · Primary: ' + c.primary + ' · Saves: ' + (c.saves.map(abbr).join(', ') || '—') + ' · ' + c.subclasses.length + ' subclasses'; },
        { title: classBase(ev.cls.name), count: speciesGroups('class').order.length, after: classVersionField() + classSubField() }) +
      pickerField('f-species', 'Species', 'species', D.SPECIES, b.speciesId, function (s) { return s.size + ' · Speed ' + s.speed + ' ft' + (s.darkvision ? ' · Darkvision ' + s.darkvision + ' ft' : ''); },
        { title: speciesBase(ev.species.name), count: speciesGroups().order.length, after: subspeciesField() }) +
      pickerField('f-bg', 'Background', 'background', D.BACKGROUNDS, b.backgroundId, function (g) {
        if (g.custom) return 'Any three abilities, Origin feat, two skills';
        if (g.legacy) return '2014 background: skills ' + (g.skills.map(function (k) { return D.SKILLS[k].name; }).join(', ') || '—');
        return 'Abilities: ' + g.abilities.map(abbr).join(', ') + ' · Feat: ' + g.featName;
      }, { title: backgroundBase(ev.background.name), count: speciesGroups('background').order.length, after: backgroundSubField() }) +
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
        (f.desc ? (f.long ? longText(f.desc) : '<p class="desc">' + esc(f.desc) + '</p>') : '') + f.choices.map(renderChoice).join('') + '</div>';
    }).join('');
    if (!lv.features.length) feats = '<div class="feature"><p class="desc">No new class features. Your Hit Points and proficiency still grow.</p></div>';
    if (lv.spellChanges) {
      var sc = lv.spellChanges, sbits = [];
      if (sc.cantripsAdded.length + sc.preparedAdded.length) sbits.push('<span class="add">+ ' + esc(sc.cantripsAdded.concat(sc.preparedAdded).join(', ')) + '</span>');
      if (sc.cantripsRemoved.length + sc.preparedRemoved.length) sbits.push('<span class="rem">− ' + esc(sc.cantripsRemoved.concat(sc.preparedRemoved).join(', ')) + '</span>');
      feats += '<div class="feature"><div class="feature-name">Spells<span class="pill pill-plain">' + (sc.cantripsRemoved.length + sc.preparedRemoved.length ? 'learned &amp; swapped' : 'learned') + '</span></div>' +
        '<p class="changes">' + sbits.join(' · ') + '</p>' + (sc.problems.length ? '<ul class="problems">' + sc.problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }
    var prev = L > 1 ? ev.levels[L - 2].d.hp : 0;
    return '<section class="' + cls + '" id="lvl-' + L + '">' +
      '<div class="lvl-head"><div class="lvl-num">' + L + '</div><div class="lvl-title"><strong>' + esc(lv.cls.name) + ' ' + lv.classLevel +
      (ev.multiclass ? ' <span class="muted lvl-char">· character level ' + L + '</span>' : '') + '</strong>' +
      '<div class="lvl-stats"><span>PB ' + sign(lv.d.pb) + '</span><span>HP ' + lv.d.hp + (L > 1 ? ' (+' + (lv.d.hp - prev) + ')' : '') + '</span>' +
      lv.d.columns.map(function (c) { return '<span>' + esc(c.label) + ' ' + esc(c.value) + '</span>'; }).join('') + '</div></div>' + todo +
      (lv.newClass ? '<span class="pill pill-gold">New class</span>' : '') +
      (L > 1 ? '<button type="button" class="btn btn-small" data-openlist="levelclass" data-forlevel="' + L + '" title="Choose which class gains this level">Class: ' + esc(classBase(lv.cls.name)) + ' ▾</button>' : '') +
      (L !== b.level ? '<button type="button" class="btn btn-small" data-level="' + L + '">View level ' + L + '</button>' : '<span class="pill pill-gold">Viewing</span>') +
      '</div>' + (lv.mcIssues && lv.mcIssues.length ? '<ul class="warn-list mc-warn">' + lv.mcIssues.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="feat-list">' + feats + '</div></section>';
  }
  function classSplit(lv) {
    return lv.d.classLevels.map(function (c) { return c.name + ' ' + c.level + (c.sub ? ' (' + c.sub + ')' : ''); }).join(' / ');
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
      '<p class="desc mc-hint">' + (ev.multiclass ? '<b>Multiclass:</b> ' + esc(classSplit(ev.levels[b.level - 1])) + ' at level ' + b.level + ' · ' + esc(classSplit(ev.levels[19])) + ' at level 20. ' : '') +
      'To multiclass, use <b>Class</b> on any level card to choose which class gains that level.</p>' +
      '<div class="timeline">' + levels.map(levelCard).join('') + '</div>';
  }

  /* ---------- Rendering: summary + sheet ---------- */

  function subName(lv) { return lv.subclass ? lv.subclass.name : null; }

  function renderSummary() {
    var b = cur(), lv = ev.levels[b.level - 1], d = lv.d, s = lv.state, base = ev.levels[0].state;
    var vit = [['AC', d.ac], ['HP', d.hp], ['Speed', d.speed], ['Init', sign(d.init)], ['Prof', sign(d.pb)], ['Passive', d.passivePerception]];
    var html = '<section class="card"><div class="sum-head"><span class="eyebrow">Level ' + b.level + ' ' + esc(ev.species.name) + '</span><h2>' + esc(b.name || 'Unnamed') + '</h2>' +
      '<span class="muted">' + esc(ev.multiclass ? classSplit(lv) : ev.cls.name + (subName(lv) ? ' · ' + subName(lv) : '')) + ' · ' + esc(ev.background.name) + '</span></div>' +
      '<div class="vitals">' + vit.map(function (v) { return '<div class="vital"><b>' + v[1] + '</b><span>' + v[0] + '</span></div>'; }).join('') + '</div>' +
      '<div class="abil-row">' + D.ABILITIES.map(function (a) {
        return '<div class="abil' + (s.abilities[a] > base.abilities[a] ? ' raised' : '') + '" title="' + D.ABILITY_NAMES[a] + (d.saves[a].prof ? ', proficient save' : '') + '"><span class="eyebrow">' + a + '</span><b>' + s.abilities[a] + '</b><small>' + sign(d.mods[a]) + '</small></div>';
      }).join('') + '</div>';
    if (d.spell) {
      html += '<div class="sum-section"><h3>Spellcasting</h3>' + d.spellcasters.map(function (e) {
        return '<div>' + (d.spellcasters.length > 1 ? esc(classBase(e.className)) + ': ' : '') + 'Save DC <b>' + e.dc + '</b> · Attack <b>' + sign(e.attack) + '</b></div>';
      }).join('') + slotsHtml(d.spell) + '</div>';
    }
    var feats = s.feats.map(function (f) { return f.name; });
    html += '<div class="sum-section sum-detail"><h3>Feats</h3><div>' + (feats.length ? esc(feats.join(', ')) : '<span class="muted">None yet</span>') + '</div></div>';
    if (s.warnings.length) html += '<div class="sum-section"><ul class="warn-list">' + s.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
    html += '</section>';
    return html;
  }

  function slotsHtml(sp) {
    if (sp.pact && sp.slots && sp.slots.some(Boolean)) {
      return '<div class="slots">' + sp.slots.map(function (n, i) { return n ? '<span class="slot">L' + (i + 1) + ' × ' + n + '</span>' : ''; }).join('') +
        '<span class="slot">Pact: ' + sp.pact.count + ' × L' + sp.pact.level + '</span></div>';
    }
    if (sp.pact) return '<div class="slots"><span class="slot">' + sp.pact.count + ' Pact slot' + (sp.pact.count > 1 ? 's' : '') + ' · level ' + sp.pact.level + '</span></div>';
    return '<div class="slots">' + (sp.slots || []).map(function (n, i) { return n ? '<span class="slot" title="Level ' + (i + 1) + ' slots">L' + (i + 1) + ' × ' + n + '</span>' : ''; }).join('') + '</div>';
  }

  function renderSheet() {
    var b = cur(), lv = ev.levels[b.level - 1], d = lv.d, s = lv.state;

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
      attackTable(d) + '<p class="desc">Change armor, shield, weapons and magic items in the <button type="button" class="linklike" data-tab="gear">Gear</button> tab.</p></div></section>';

    var resources = d.columns.length || d.spell ? '<section class="card"><div class="card-head"><h3>Class resources</h3></div><div class="card-body"><div class="rows">' +
      d.columns.map(function (c) { return '<div class="row"><span>' + esc(c.label) + '</span><span class="v">' + esc(c.value) + '</span></div>'; }).join('') +
      (d.spellcasters || []).map(function (e) {
        var pre = d.spellcasters.length > 1 ? esc(classBase(e.className)) + ': ' : '';
        return '<div class="row"><span>' + pre + 'Spell save DC / attack</span><span class="v">' + e.dc + ' / ' + sign(e.attack) + '</span></div>' +
          (e.cantrips ? '<div class="row"><span>' + pre + 'Cantrips known</span><span class="v">' + e.cantrips + '</span></div>' : '') +
          '<div class="row"><span>' + pre + 'Prepared spells</span><span class="v">' + e.prepared + '</span></div>';
      }).join('') + '</div>' +
      (d.spell ? slotsHtml(d.spell) : '') + '</div></section>' : '';

    // Features gained up to this level.
    var featureRefs = [];
    ev.levels.slice(0, b.level).forEach(function (l) {
      l.features.forEach(function (f) {
        if (f.name === 'Proficiencies') return;
        featureRefs.push('<div class="feature-ref"><b>' + esc(f.name) + ' <span class="muted">· ' + (f.source === 'Class' ? (ev.multiclass ? esc(classBase(l.cls.name)) + ' ' + l.classLevel : 'Level ' + l.level) : esc(f.source) + ' ' + l.classLevel) + '</span></b>' + summaryOfChoices(f) + (f.long ? longText(f.desc) : '<span>' + esc(f.desc) + '</span>') + '</div>');
      });
    });
    var features = '<section class="card"><div class="card-head"><h3>Class features</h3></div><div class="card-body">' + featureRefs.join('') + '</div></section>';

    var traitRefs = ev.species.traits.map(function (t) { return '<div class="feature-ref"><b>' + esc(t[0]) + '</b>' + longText(t[1]) + '</div>'; }).join('');
    var featRefs = s.feats.map(function (f) { return '<div class="feature-ref"><b>' + esc(f.name) + ' <span class="muted">· ' + esc(f.source) + '</span></b>' + longText(f.desc) + '</div>'; }).join('');
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
    var casters = lv.d.spellcasters || [];
    var html = '<div class="toolbar"><h2>Spells at level ' + b.level + '</h2>' + (casters.length > 1 ? '<span class="muted">Shared slots: ' + (lv.d.casterLevel ? 'caster level ' + lv.d.casterLevel : '') + '</span>' : '') + '</div>';
    if (!casters.length && !always.length) {
      return html + '<section class="card"><div class="card-body"><p>' + esc(ev.cls.name) + ' has no Spellcasting feature. Spells from your species, background, or feats appear here once you pick them (for example a Magic Initiate feat, or an Elf or Tiefling lineage).</p></div></section>';
    }
    casters.forEach(function (ce) {
      var rep = D.spellReport(b, ev, b.level, ce.clsId);
      var sp = rep.d, cid = esc(ce.clsId), CL = ce.classLevel;
      var ch = D.spellChanges(b, ce.clsId, CL) || {};
      var cAdd = ch.cantripsAdded || [], pAdd = ch.preparedAdded || [];
      html += '<section class="card"><div class="card-head"><h3>' + esc(ce.className) + (casters.length > 1 ? ' ' + ce.classLevel : '') + ' spellcasting</h3><span class="muted">' + D.ABILITY_NAMES[sp.ability] + ' · Save DC ' + sp.dc + ' · Attack ' + sign(sp.attack) +
        ' · Lists: ' + sp.lists.map(listLabel).join(', ') + '</span></div><div class="card-body">' + slotsHtml(sp) +
        (D.SPELL_LISTS[ce.caster.list + ':legacy'] ? '<label class="toggle"><input type="checkbox" id="opt-legacy"' + (b.options && b.options.legacySpells ? ' checked' : '') + '> Also offer 2014 spells for this class from your compendium</label>' : '');
      if (sp.cantrips) {
        html += '<div class="field"><div class="toolbar"><span class="label">Cantrips</span><span class="pill ' + (countOk(rep.cantrips) < sp.cantrips ? 'pill-todo' : 'pill-ok') + '">' + countOk(rep.cantrips) + ' / ' + sp.cantrips + '</span></div>' +
          '<div class="chips">' + rep.cantrips.map(spellChip('cantrips', ce.clsId, CL, cAdd)).join('') + '<button type="button" class="btn btn-small" data-spellpick="cantrips" data-cls="' + cid + '">Choose cantrips</button></div></div>';
      }
      html += '<div class="field"><div class="toolbar"><span class="label">' + (sp.caster.swap === 'level' ? 'Spells known' : 'Prepared spells') + ' (up to level ' + sp.maxLevel + ')</span><span class="pill ' + (rep.preparedCount < sp.prepared ? 'pill-todo' : 'pill-ok') + '">' + rep.preparedCount + ' / ' + sp.prepared + '</span></div>' +
        '<p class="desc">You\'re editing the list at ' + esc(ce.className) + ' level ' + CL + '. Changes apply from this level on, until a later level changes them. ' +
        (sp.caster.swap === 'level' ? 'When you gain a level you can replace one spell and one cantrip.' : 'You can change prepared spells after a Long Rest; one cantrip can be replaced per level.') + '</p>' +
        '<div class="spell-groups">' + groupByLevel(rep.prepared).map(function (g) {
          return '<div class="spell-group"><h4>Level ' + g.level + '</h4><div class="chips">' + g.items.map(spellChip('prepared', ce.clsId, CL, pAdd)).join('') + '</div></div>';
        }).join('') + '</div><div><button type="button" class="btn btn-small btn-primary" data-spellpick="prepared" data-cls="' + cid + '">Choose prepared spells</button></div></div>' +
        spellChangesBox(ce, ch) + spellHistory(ce) + '</div></section>';
    });
    if (always.length) {
      html += '<section class="card"><div class="card-head"><h3>Always prepared &amp; granted</h3><span class="muted">Don\'t count against your prepared total</span></div><div class="card-body"><div class="rows">' +
        always.map(function (a) {
          var l = D.SPELL_LEVEL[a.name];
          return '<div class="row"><span>' + spellLink(a.name) + ' <span class="muted">' + (l === 0 ? 'cantrip' : l ? 'level ' + l : '') + '</span></span><span class="muted" style="text-align:right">' + esc(a.source) + '</span></div>';
        }).join('') + '</div></div></section>';
    }
    return html;
  }
  function spellChangesBox(ce, ch) {
    var CL = ce.classLevel, b = cur();
    var parts = [];
    if (ch.cantripsAdded && ch.cantripsAdded.length) parts.push('<span class="add">+ ' + esc(ch.cantripsAdded.join(', ')) + '</span> <span class="muted">cantrips</span>');
    if (ch.preparedAdded && ch.preparedAdded.length) parts.push('<span class="add">+ ' + esc(ch.preparedAdded.join(', ')) + '</span>');
    if (ch.cantripsRemoved && ch.cantripsRemoved.length) parts.push('<span class="rem">− ' + esc(ch.cantripsRemoved.join(', ')) + '</span> <span class="muted">cantrips</span>');
    if (ch.preparedRemoved && ch.preparedRemoved.length) parts.push('<span class="rem">− ' + esc(ch.preparedRemoved.join(', ')) + '</span>');
    var lvInfo = ev.levels.filter(function (l) { return l.cls.id === ce.clsId && l.classLevel === CL; })[0];
    var probs = lvInfo && lvInfo.spellChanges ? lvInfo.spellChanges.problems : [];
    var later = b.spellPlan && b.spellPlan[ce.clsId] ? Object.keys(b.spellPlan[ce.clsId]).map(Number).filter(function (k) { return k > CL; }) : [];
    return '<div class="spell-changes"><div class="toolbar"><span class="label">Changes at ' + esc(ce.className) + ' level ' + CL + '</span><div class="chips">' +
      (parts.length ? '<button type="button" class="btn btn-small" data-spellreset="' + esc(ce.clsId) + '" data-cl="' + CL + '">Undo changes at this level</button>' : '') +
      (later.length ? '<button type="button" class="btn btn-small" data-spellcarry="' + esc(ce.clsId) + '" data-cl="' + CL + '" title="Remove the changes planned at later levels">Use this list for all later levels</button>' : '') +
      '</div></div>' + (parts.length ? '<p class="changes">' + parts.join(' · ') + '</p>' : '<p class="desc">No changes at this level; the list carries over from the level before.</p>') +
      (probs.length ? '<ul class="warn-list">' + probs.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
  }
  function spellHistory(ce) {
    var b = cur(), rows = [];
    ev.levels.forEach(function (l) {
      if (l.cls.id !== ce.clsId || !l.spellChanges) return;
      var c = l.spellChanges, bits = [];
      if (c.cantripsAdded.length + c.preparedAdded.length) bits.push('<span class="add">+ ' + esc(c.cantripsAdded.concat(c.preparedAdded).join(', ')) + '</span>');
      if (c.cantripsRemoved.length + c.preparedRemoved.length) bits.push('<span class="rem">− ' + esc(c.cantripsRemoved.concat(c.preparedRemoved).join(', ')) + '</span>');
      rows.push('<div class="row' + (l.level === b.level ? ' here' : '') + '"><button type="button" class="linklike" data-level="' + l.level + '">' + esc(classBase(c.className)) + ' ' + c.classLevel + '</button><span class="hist">' + bits.join(' · ') +
        (c.problems.length ? ' <span class="pill pill-todo">too many swaps</span>' : '') + '</span></div>');
    });
    if (!rows.length) return '';
    return '<details class="spell-history"' + (rows.length <= 6 ? ' open' : '') + '><summary class="label">Spell history (' + rows.length + ' level' + (rows.length === 1 ? '' : 's') + ' with changes)</summary><div class="rows">' + rows.join('') + '</div></details>';
  }
  function listLabel(key) {
    var legacy = /:legacy$/.test(key);
    var name = key.replace(/:legacy$/, '').replace(/^cs-(2014|2024)-/, '').replace(/-/g, ' ');
    return name.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) + (legacy ? ' (2014)' : '');
  }
  function spellLink(name) {
    return D.SPELL_INFO && D.SPELL_INFO[name] ? '<button type="button" class="linklike" data-spellinfo="' + esc(name) + '">' + esc(name) + '</button>' : esc(name);
  }
  function countOk(list) { return list.filter(function (x) { return x.ok; }).length; }
  function groupByLevel(list) {
    var g = {};
    list.forEach(function (x) { var l = x.level || 0; (g[l] = g[l] || []).push(x); });
    return Object.keys(g).sort(function (a, b) { return a - b; }).map(function (l) { return { level: l, items: g[l] }; });
  }
  function spellChip(kind, clsId, cl, added) {
    return function (x) {
      var isNew = added && added.indexOf(x.name) >= 0;
      return '<span class="chip' + (x.ok ? '' : ' bad') + (isNew ? ' new' : '') + '" title="' + esc(x.note || (isNew ? 'Learned at this level' : '')) + '">' + (isNew ? '<span class="chip-new">new</span> ' : '') + spellLink(x.name) + (x.note ? ' <small>· ' + esc(x.note) + '</small>' : '') +
        '<button type="button" data-rmspell="' + kind + '" data-cls="' + esc(clsId || '') + '" data-cl="' + (cl || 1) + '" data-value="' + esc(x.name) + '" aria-label="Remove ' + esc(x.name) + '">×</button></span>';
    };
  }

  /* ---------- Rendering: progression ---------- */

  function renderProgression() {
    var b = cur();
    var cols = [];
    ev.levels.forEach(function (lv) { lv.d.columns.forEach(function (c) { if (cols.indexOf(c.label) < 0) cols.push(c.label); }); });
    cols = cols.map(function (l) { return { label: l }; });
    var hasSpells = ev.levels.some(function (lv) { return lv.d.spell; });
    var head = '<tr><th class="n">Lvl</th>' + (ev.multiclass ? '<th>Class</th>' : '') + '<th class="n">PB</th><th class="n">HP</th><th class="n">AC</th>' +
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
      var many = d.spellcasters && d.spellcasters.length > 1;
      return '<tr data-level="' + L + '" class="' + (L === b.level ? 'current' : L > b.level ? 'ahead' : '') + '"><td class="n"><b>' + L + '</b></td>' +
        (ev.multiclass ? '<td>' + esc(classBase(lv.cls.name)) + ' ' + lv.classLevel + '</td>' : '') + '<td class="n">' + sign(d.pb) + '</td><td class="n">' + d.hp + '</td><td class="n">' + d.ac + '</td>' +
        D.ABILITIES.map(function (a) {
          var v = lv.state.abilities[a], up = prev && v > prev[a];
          return '<td class="n"' + (up ? ' style="color:var(--gold);font-weight:700"' : '') + '>' + v + '</td>';
        }).join('') +
        '<td class="feats">' + feats + '</td>' + cols.map(function (c) { var v = d.columns.filter(function (x) { return x.label === c.label; })[0]; return '<td class="n">' + esc(v ? v.value : '—') + '</td>'; }).join('') +
        (hasSpells ? (sp ? '<td class="n">' + (many ? d.spellcasters.map(function (e) { return classBase(e.className)[0] + ' ' + e.cantrips; }).join(' / ') : sp.cantrips || '—') + '</td>' +
          '<td class="n">' + (many ? d.spellcasters.map(function (e) { return classBase(e.className)[0] + ' ' + e.prepared; }).join(' / ') : sp.prepared) + '</td>' +
          '<td>' + [sp.slots && sp.slots.filter(Boolean).length ? sp.slots.join(' · ') : '', sp.pact ? 'Pact ' + sp.pact.count + ' × L' + sp.pact.level : ''].filter(Boolean).join(' + ') + '</td>' : '<td class="n">—</td><td class="n">—</td><td>—</td>') : '') + '</tr>';
    }).join('');
    return '<div class="toolbar"><h2>All 20 levels at a glance</h2><span class="muted">' + esc(ev.multiclass ? classSplit(ev.levels[19]) : ev.cls.name) + ' · click a row to view that level</span></div>' +
      '<div class="table-wrap prog"><table><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------- Modal pickers ---------- */

  function openModal(m) { m.q = ''; m.f = {}; m.limit = 150; app.modal = m; renderModal(); }
  function openPicker(key) { openModal({ type: 'choice', key: key }); }
  function openSpellPicker(kind) { openModal({ type: 'spells', kind: kind }); }
  function openList(kind) { openModal({ type: 'list', kind: kind }); }
  function closeModal() { app.modal = null; $('#modal').hidden = true; $('#modal').innerHTML = ''; }

  // Filter dropdowns shown under the search box; values live in app.modal.f.
  function filterBar(filters) {
    var m = app.modal;
    if (!filters || !filters.length) return '';
    var active = filters.filter(function (f) { return m.f[f.id]; }).length;
    return '<div class="dialog-filters">' + filters.map(function (f) {
      return '<label class="mini-field"><span>' + esc(f.label) + '</span><select data-mfilter="' + esc(f.id) + '">' +
        (f.noAny ? '' : '<option value="">Any</option>') + f.values.map(function (v) {
          return '<option value="' + esc(v[0]) + '"' + (m.f[f.id] === v[0] ? ' selected' : '') + '>' + esc(v[1]) + '</option>';
        }).join('') + '</select></label>';
    }).join('') + (active ? '<button type="button" class="btn btn-small" data-mclear="1">Clear filters</button>' : '') + '</div>';
  }
  function applyFilters(options, filters) {
    var m = app.modal;
    return options.filter(function (o) {
      return (filters || []).every(function (f) {
        var v = m.f[f.id];
        if (!v) return true;
        if (f.test) return f.test(o, v);
        var have = o.facets && o.facets[f.id];
        return Array.isArray(have) ? have.indexOf(v) >= 0 : have === v;
      });
    });
  }
  // Distinct facet values across options, as [value, label] pairs.
  function facetValues(options, id, sorter) {
    var seen = {};
    options.forEach(function (o) {
      var v = o.facets && o.facets[id];
      (Array.isArray(v) ? v : [v]).forEach(function (x) { if (x) seen[x] = (seen[x] || 0) + 1; });
    });
    var keys = Object.keys(seen);
    keys.sort(sorter || function (a, b) { return a.localeCompare(b); });
    return keys.map(function (k) { return [k, k + ' (' + seen[k] + ')']; });
  }
  function showMore(total, shown) {
    return total > shown ? '<div class="more-row"><span class="muted">Showing ' + shown + ' of ' + total.toLocaleString() + '.</span> <button type="button" class="btn btn-small" data-mmore="1">Show more</button></div>' : '';
  }

  function modalShell(title, sub, list, foot, filters) {
    var m = app.modal;
    return '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><div class="dialog-head"><h3 id="dlg-title">' + esc(title) + '</h3><span class="muted">' + sub + '</span></div>' +
      '<div class="dialog-tools"><label class="sr" for="dlg-q">Search</label><input id="dlg-q" type="text" placeholder="Search…" value="' + esc(m.q) + '"></div>' + filterBar(filters) +
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
      var vals = rec.kind === 'one' ? (rec.value ? [rec.value] : []) : Array.isArray(rec.value) ? rec.value : [];
      var full = rec.kind === 'many' && vals.length >= rec.count;
      var q = m.q.toLowerCase(), lastGroup = null;
      var groupsSeen = {};
      rec.options.forEach(function (o) { if (o.group) groupsSeen[o.group] = (groupsSeen[o.group] || 0) + 1; });
      var cFilters = [{ id: 'avail', label: 'Show', noAny: true, values: [['all', 'All options'], ['avail', 'Available only']], test: function (o, v) { return v !== 'avail' || !o.unavailable || vals.indexOf(o.id) >= 0; } }];
      if (Object.keys(groupsSeen).length > 1) cFilters.push({ id: 'group', label: 'Group', values: Object.keys(groupsSeen).map(function (g) { return [g, g + ' (' + groupsSeen[g] + ')']; }), test: function (o, v) { return (o.group || '') === v; } });
      if (!m.f.avail) m.f.avail = 'all';
      var hitsC = applyFilters(rec.options.filter(function (o) { return !q || (o.label + ' ' + (o.desc || '')).toLowerCase().indexOf(q) >= 0; }), cFilters);
      var list = hitsC.slice(0, m.limit).map(function (o) {
        var on = vals.indexOf(o.id) >= 0;
        var disabled = !on && (full || !!o.unavailable);
        var g = o.group && o.group !== lastGroup ? '<div class="pick-group">' + esc(o.group) + '</div>' : '';
        lastGroup = o.group;
        var label = '<span><b>' + esc(o.label) + '</b>' + (on && rec.kind === 'one' ? ' <span class="pill pill-ok">current</span>' : '') + (o.unavailable ? ' <span class="pill pill-plain">' + esc(o.unavailable) + '</span>' : '') + '</span>' +
          (o.desc ? '<span class="pick-desc">' + esc(snip(o.desc, 320)) + '</span>' : '');
        if (rec.kind === 'one') return g + '<button type="button" class="pick pick-row' + (o.unavailable && !on ? ' unavail' : '') + (on ? ' on' : '') + '" data-pickone="' + esc(o.id) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
        return g + '<label class="pick' + (o.unavailable && !on ? ' unavail' : '') + '"><input type="checkbox" data-toggle="' + esc(o.id) + '"' + (on ? ' checked' : '') + (disabled ? ' disabled' : '') + '>' + label + '</label>';
      }).join('') || '<p class="muted" style="padding:12px">No matches.</p>';
      list += showMore(hitsC.length, Math.min(m.limit, hitsC.length));
      html = modalShell(rec.label, rec.kind === 'one' ? hitsC.length + ' options' : vals.length + ' of ' + rec.count + ' chosen', list, '', cFilters);
    } else if (m.type === 'list') {
      var src = listSource(m.kind), q3 = m.q.toLowerCase(), lg3 = null;
      var hits = applyFilters(src.options.filter(function (o) { return !q3 || o.search.indexOf(q3) >= 0; }), src.filters);
      var shown = hits.slice(0, m.limit);
      var list3 = shown.map(function (o) {
        var g = o.group && o.group !== lg3 ? '<div class="pick-group">' + esc(o.group) + '</div>' : '';
        lg3 = o.group;
        var on = src.current && o.id === src.current;
        return g + '<button type="button" class="pick pick-row' + (on ? ' on' : '') + '" data-listpick="' + esc(o.id) + '"><span><b>' + esc(o.label) + '</b>' + (on ? ' <span class="pill pill-ok">current</span>' : '') + (o.meta ? ' <span class="muted">' + esc(o.meta) + '</span>' : '') + '</span>' +
          (o.desc ? '<span class="pick-desc">' + esc(snip(o.desc, 220)) + '</span>' : '') + '</button>';
      }).join('') || '<p class="muted" style="padding:12px">No matches. Try clearing a filter.</p>';
      list3 += showMore(hits.length, shown.length);
      html = modalShell(src.title, hits.length.toLocaleString() + ' of ' + src.options.length.toLocaleString(), list3, '', src.filters);
    } else if (m.type === 'detail') {
      html = '<div class="dialog dialog-detail" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><div class="dialog-head"><h3 id="dlg-title">' + esc(m.title) + '</h3><span class="muted">' + esc(m.sub || '') + '</span></div>' +
        '<div class="dialog-tools"></div><div class="dialog-list detail-body" id="dlg-list">' + m.html + '</div><div class="dialog-foot">' + (m.foot || '') + '<button type="button" class="btn btn-primary" data-close="1">Close</button></div></div>';
    } else {
      var b = cur(), lv = ev.levels[b.level - 1];
      function forCls(l) { return (l.d.spellcasters || []).filter(function (e) { return !m.cls || e.clsId === m.cls; })[0]; }
      var sp = forCls(lv) || forCls(ev.levels[19]);
      if (!sp) return closeModal();
      var c = sp.caster;
      var picked = D.spellsAt(b, sp.clsId, sp.classLevel)[m.kind] || [];
      m.cls = sp.clsId; m.classLevel = sp.classLevel;
      var lists = (forCls(ev.levels[19]) || sp).lists.slice();
      (lv.state.spells.extraLists || []).forEach(function (l) { if (lists.indexOf(l) < 0) lists.push(l); });
      var opts = m.kind === 'cantrips' ? D.spellOptions(lists, 0, 0) : D.spellOptions(lists, 1, 9);
      var q2 = m.q.toLowerCase(), lg = null;
      var limit = m.kind === 'cantrips' ? sp.cantrips : sp.prepared;
      var alwaysNames = lv.state.spells.always.map(function (a) { return a.name; });
      var sFilters = [];
      if (m.kind === 'prepared') {
        sFilters.push({ id: 'lvl', label: 'Level', values: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (l) { return [String(l), 'Level ' + l]; }), test: function (o, v) { return String(D.SPELL_LEVEL[o.id]) === v; } });
        sFilters.push({ id: 'now', label: 'Show', values: [['now', 'Castable at level ' + b.level]], test: function (o) { return D.SPELL_LEVEL[o.id] <= sp.maxLevel; } });
      }
      var schools = {};
      opts.forEach(function (o) { var i = D.SPELL_INFO[o.id]; if (i && D.SCHOOL[i.school]) schools[i.school] = 1; });
      if (Object.keys(schools).length) sFilters.push({ id: 'school', label: 'School', values: Object.keys(schools).map(function (k) { return [k, D.SCHOOL[k]]; }).sort(function (a, c) { return a[1].localeCompare(c[1]); }),
        test: function (o, v) { var i = D.SPELL_INFO[o.id]; return !!i && i.school === v; } });
      sFilters.push({ id: 'picked', label: 'Picked', values: [['yes', 'Picked only'], ['no', 'Not picked']], test: function (o, v) { return (picked.indexOf(o.id) >= 0) === (v === 'yes'); } });
      var list2 = applyFilters(opts.filter(function (o) { return !q2 || o.label.toLowerCase().indexOf(q2) >= 0; }), sFilters).map(function (o) {
        var on = picked.indexOf(o.id) >= 0;
        var sl = D.SPELL_LEVEL[o.id], at = D.levelForSpell(c, sl);
        var tag = m.kind === 'prepared' && sl > sp.maxLevel ? (at <= 20 ? 'Unlocks at class level ' + at : 'Beyond your slots') : '';
        var alw = alwaysNames.indexOf(o.id) >= 0 ? 'Already always prepared' : '';
        var g = o.group !== lg ? '<div class="pick-group">' + esc(o.group) + '</div>' : '';
        lg = o.group;
        return g + '<label class="pick' + (tag ? ' unavail' : '') + '"><input type="checkbox" data-spelltoggle="' + esc(o.id) + '"' + (on ? ' checked' : '') + '>' +
          '<span>' + esc(o.label) + (tag ? ' <span class="pill pill-plain">' + esc(tag) + '</span>' : '') + (alw ? ' <span class="pill pill-gold">' + alw + '</span>' : '') + '</span>' +
          (D.SPELL_INFO[o.id] ? '<span class="pick-desc">' + esc(spellMeta(D.SPELL_INFO[o.id])) + ' — ' + esc(snip(D.SPELL_INFO[o.id].text, 180)) + '</span>' : '') + '</label>';
      }).join('') || '<p class="muted" style="padding:12px">No matches.</p>';
      html = modalShell((m.kind === 'cantrips' ? 'Cantrips' : 'Prepared spells') + ' at ' + sp.className + ' level ' + sp.classLevel,
        picked.length + ' picked · ' + limit + ' allowed · changes apply from this level on', list2, '', sFilters);
    }
    el.innerHTML = html;
    el.hidden = false;
    if ($('#dlg-list')) $('#dlg-list').scrollTop = scroll;
    if (focusQ) { var qi = $('#dlg-q'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
  }

  function snip(text, n) { text = String(text || '').replace(/\s+/g, ' ').trim(); return text.length > n ? text.slice(0, n - 1) + '…' : text; }
  function spellMeta(sp) {
    return (sp.level ? 'Level ' + sp.level : 'Cantrip') + ' ' + (D.SCHOOL[sp.school] || sp.school || '') + (sp.ritual ? ' (ritual)' : '') + ' · ' + sp.time + ' · ' + sp.range + ' · ' + sp.dur;
  }

  function ioDialog() {
    var json = JSON.stringify(cur(), null, 1);
    return '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><div class="dialog-head"><h3 id="dlg-title">Export / Import</h3><span class="muted">Copy this text to back up or share the build. Paste a build here to import it.</span></div>' +
      '<div class="dialog-tools"></div><div class="dialog-list" style="padding:12px 16px"><label class="sr" for="io-text">Build JSON</label><textarea id="io-text" class="io" spellcheck="false">' + esc(json) + '</textarea>' +
      '<p class="desc" id="io-msg" aria-live="polite"></p></div>' +
      '<div class="dialog-foot"><button type="button" class="btn" data-io="copy">Copy</button><button type="button" class="btn" data-io="import">Import as new build</button><button type="button" class="btn btn-primary" data-close="1">Done</button></div></div>';
  }

  /* ---------- Rendering: gear & inventory ---------- */

  function attackTable(d) {
    return '<div class="table-wrap"><table><thead><tr><th>Attack</th><th class="n">Hit</th><th>Damage</th><th>Mastery</th></tr></thead><tbody>' +
      (d.attacks.length ? d.attacks.map(function (a) {
        return '<tr><td>' + esc(a.name) + (a.prof ? '' : ' <span class="pill pill-todo">not proficient</span>') + '</td><td class="n">' + sign(a.hit) + '</td><td>' + esc(a.dmg) + '</td><td>' +
          (a.mastery ? '<span title="' + esc(D.MASTERY[a.mastery] || '') + '">' + esc(a.mastery) + '</span>' : '<span class="muted">—</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">No weapons equipped.</td></tr>') + '</tbody></table></div>';
  }

  function armorButton(gear) {
    var a = find(D.ARMOR, gear.armor) || D.ARMOR[0];
    return '<button type="button" id="g-armor" class="btn picker-btn" data-openlist="armor"><span>' + esc(a.name) + '</span><span class="muted">' +
      (a.ac ? a.type + ', AC ' + (a.ac + (a.bonusAc || 0)) : '') + ' ▾</span></button>';
  }
  function shieldButton(gear) {
    var curId = gear.shield === true ? 'shield' : gear.shield || '';
    var sh = curId && find(D.SHIELDS || [], curId);
    return '<button type="button" id="g-shield" class="btn picker-btn" data-openlist="shield"><span>' + esc(sh ? sh.name : curId ? 'Shield' : 'No shield') + '</span><span class="muted">' +
      (curId ? '+' + (2 + (sh && sh.bonus || 0)) + ' AC ' : '') + '▾</span></button>';
  }

  function renderGear() {
    var b = cur(), lv = ev.levels[b.level - 1], d = lv.d;
    var gear = b.gear || (b.gear = { armor: 'none', shield: false, weapons: [] });
    var inv = b.inventory || [];
    var fx = d.items;
    var equipped = '<section class="card"><div class="card-head"><h3>Equipped</h3><span class="muted">AC ' + d.ac + ' (' + esc(d.acHow) + ')</span></div><div class="card-body">' +
      '<div class="gear-grid"><div class="field"><label for="g-armor">Armor</label>' + armorButton(gear) + '</div>' +
      '<div class="field"><label for="g-shield">Shield</label>' + shieldButton(gear) + '</div></div>' +
      '<div class="field"><div class="toolbar"><span class="label">Weapons</span><button type="button" class="btn btn-small btn-primary" data-openlist="weapon">Add weapon</button></div>' +
      '<div class="chips">' + (gear.weapons || []).map(function (id) {
        var w = D.weapon(id);
        return '<span class="chip">' + esc(w ? w.name : id + ' (not loaded)') + '<button type="button" data-rmweapon="' + esc(id) + '" aria-label="Remove ' + esc(w ? w.name : id) + '">×</button></span>';
      }).join('') + '</div></div>' + attackTable(d) + '</div></section>';

    var rows = inv.map(function (e, i) {
      var it = D.item(e.id);
      var name = it ? it.name : e.name || e.id;
      return '<tr><td>' + (it ? '<button type="button" class="linklike" data-iteminfo="' + esc(e.id) + '">' + esc(name) + '</button>' : esc(name) + (e.id ? ' <span class="pill pill-plain">not loaded</span>' : '')) +
        (it && it.rarity ? ' <span class="muted">' + esc(it.rarity) + '</span>' : '') + '</td>' +
        '<td class="n"><label class="sr" for="inv-q-' + i + '">Quantity</label><input class="qty" id="inv-q-' + i + '" type="number" min="1" value="' + (e.qty || 1) + '" data-invqty="' + i + '"></td>' +
        '<td class="n"><label class="sr" for="inv-e-' + i + '">Equipped</label><input type="checkbox" id="inv-e-' + i + '" data-invequip="' + i + '"' + (e.equipped ? ' checked' : '') + '></td>' +
        '<td class="n">' + (it && it.attune ? '<label class="sr" for="inv-a-' + i + '">Attuned</label><input type="checkbox" id="inv-a-' + i + '" data-invattune="' + i + '"' + (e.attuned ? ' checked' : '') + '>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="n">' + (it && it.weight ? +(it.weight * (e.qty || 1)).toFixed(2) + ' lb' : '—') + '</td>' +
        '<td class="n"><button type="button" class="btn btn-small" data-invrm="' + i + '" aria-label="Remove ' + esc(name) + '">×</button></td></tr>';
    }).join('');
    var inventory = '<section class="card"><div class="card-head"><h3>Inventory</h3><span class="muted num">' + +fx.weight.toFixed(1) + ' / ' + d.carry + ' lb · attuned ' + fx.attuned + ' / 3</span>' +
      '<button type="button" class="btn btn-small btn-primary" data-openlist="item">Add item</button></div><div class="card-body">' +
      (inv.length ? '<div class="table-wrap"><table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Equipped</th><th class="n">Attuned</th><th class="n">Weight</th><th class="n"></th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
        '<p class="desc">Nothing carried yet. Add mundane gear or magic items. Equipped items that grant AC, saving throw, spell or speed bonuses (and items that set an ability score) apply to the sheet; items that need attunement must be attuned first.</p>') +
      (fx.names.length ? '<p class="desc">Active item effects: ' + esc(fx.names.join(', ')) + '.</p>' : '') +
      '<form class="add-custom" id="custom-item-form"><label class="sr" for="custom-item">Custom item</label><input id="custom-item" type="text" placeholder="Add a custom item (e.g. Map of the Sunless Citadel)"><button type="submit" class="btn btn-small">Add</button></form>' +
      '</div></section>';
    return '<div class="toolbar"><h2>Gear at level ' + b.level + '</h2><span class="muted">' + D.ITEMS.length.toLocaleString() + ' items available' + (D.CONTENT.user ? ' (SRD + your compendium)' : ' (SRD)') + '</span></div>' + equipped + inventory;
  }

  /* ---------- Rendering: companions ---------- */

  var COMPANION_ROLES = ['Familiar', 'Steed', 'Beast companion', 'Summon', 'Minion', 'Hireling', 'Sidekick', 'Wild Shape form', 'Pet', 'Other'];
  var SUMMON_NAMES = {
    'Find Steed': ['Otherworldly Steed'], 'Summon Beast': ['Bestial Spirit'], 'Summon Fey': ['Fey Spirit'], 'Summon Undead': ['Undead Spirit'],
    'Summon Aberration': ['Aberrant Spirit'], 'Summon Construct': ['Construct Spirit'], 'Summon Elemental': ['Elemental Spirit'], 'Summon Celestial': ['Celestial Spirit'],
    'Summon Fiend': ['Fiendish Spirit'], 'Summon Dragon': ['Draconic Spirit'], 'Animate Dead': ['Skeleton', 'Zombie'], 'Create Undead': ['Ghoul', 'Ghast', 'Wight', 'Mummy'],
    'Find Familiar': ['Bat', 'Cat', 'Frog', 'Hawk', 'Lizard', 'Octopus', 'Owl', 'Rat', 'Raven', 'Spider', 'Weasel'],
    'Pact of the Chain': ['Imp', 'Pseudodragon', 'Quasit', 'Skeleton', 'Slaad Tadpole', 'Sphinx of Wonder', 'Sprite', 'Venomous Snake'],
    'Beast Master': ['Beast of the Land', 'Beast of the Sea', 'Beast of the Sky']
  };
  function monsterByName(name) {
    var hit = null;
    (D.MONSTERS || []).forEach(function (m) { if (m.name.toLowerCase() === name.toLowerCase() && (!hit || (hit.ed === '2014' && m.ed === '2024'))) hit = m; });
    return hit;
  }
  function companionSuggestions() {
    var b = cur(), lv = ev.levels[b.level - 1], st = lv.state, out = [];
    var names = st.spells.always.map(function (a) { return a.name; }).concat(b.spells.prepared || [], b.spells.cantrips || []);
    if (st.invocations.indexOf('pact-chain') >= 0) names.push('Pact of the Chain', 'Find Familiar');
    if (lv.d.classLevels.some(function (x) { return x.sub && /Beast Master/.test(x.sub); })) names.push('Beast Master');
    Object.keys(SUMMON_NAMES).forEach(function (k) {
      if (names.indexOf(k) < 0) return;
      var role = k === 'Find Familiar' || k === 'Pact of the Chain' ? 'Familiar' : k === 'Find Steed' ? 'Steed' : k === 'Beast Master' ? 'Beast companion' : /Dead|Undead/.test(k) ? 'Minion' : 'Summon';
      SUMMON_NAMES[k].forEach(function (n) { var m = monsterByName(n); if (m) out.push({ m: m, role: role, why: k }); });
    });
    var druidLv = (lv.d.classLevels.filter(function (x) { return x.id === 'druid'; })[0] || { level: 0 }).level;
    if (druidLv >= 2) {
      var maxCr = druidLv >= 8 ? 1 : druidLv >= 4 ? 0.5 : 0.25;
      (D.MONSTERS || []).filter(function (m) { return /^beast$/i.test(m.type) && D.crValue(m.cr) <= maxCr && (druidLv >= 8 || !/fly/i.test(m.speed)); })
        .sort(function (a, c) { return D.crValue(c.cr) - D.crValue(a.cr) || a.name.localeCompare(c.name); })
        .slice(0, 24).forEach(function (m) { out.push({ m: m, role: 'Wild Shape form', why: 'Wild Shape (CR ' + (maxCr === 0.25 ? '1/4' : maxCr === 0.5 ? '1/2' : '1') + ')' }); });
    }
    var have = (b.companions || []).map(function (c) { return c.id; });
    var seen = {};
    return out.filter(function (x) { if (seen[x.m.id] || have.indexOf(x.m.id) >= 0) return false; seen[x.m.id] = true; return true; });
  }

  function abilityLine(m) {
    return '<div class="sb-abilities">' + D.ABILITIES.map(function (a) {
      return '<div><span class="eyebrow">' + a + '</span><b>' + m[a] + '</b><small>' + sign(D.mod(m[a])) + '</small></div>';
    }).join('') + '</div>';
  }
  function statBlock(m) {
    var line = [D.SIZE_NAME[m.size] || m.size, m.type, m.align].filter(Boolean).join(' ').replace(/^(.)/, function (c) { return c.toUpperCase(); });
    var props = [['Armor Class', m.ac], ['Hit Points', m.hp], ['Speed', m.speed]].filter(function (p) { return p[1]; });
    var props2 = [['Saving Throws', m.save], ['Skills', m.skill], ['Vulnerabilities', m.vulnerable], ['Resistances', m.resist], ['Immunities', [m.immune, m.condImmune].filter(Boolean).join('; ')],
      ['Senses', [m.senses, m.passive ? 'Passive Perception ' + m.passive : ''].filter(Boolean).join(', ')], ['Languages', m.languages || '—'], ['Challenge', m.cr]].filter(function (p) { return p[1]; });
    function section(title, list) {
      if (!list || !list.length) return '';
      return (title ? '<h4 class="sb-h">' + title + '</h4>' : '') + list.map(function (t) { return '<div class="sb-entry"><b>' + esc(t.name) + '.</b> ' + fmt(t.text).replace(/^<p>/, '<p class="sb-inline">').replace('<p class="sb-inline">', '') + '</div>'; }).join('');
    }
    return '<div class="statblock"><p class="sb-type">' + esc(line) + '</p>' +
      '<div class="sb-props">' + props.map(function (p) { return '<div><b>' + p[0] + '</b> ' + esc(p[1]) + '</div>'; }).join('') + '</div>' + abilityLine(m) +
      '<div class="sb-props">' + props2.map(function (p) { return '<div><b>' + p[0] + '</b> ' + esc(p[1]) + '</div>'; }).join('') + '</div>' +
      section('', m.trait) + section('Actions', m.action) + section('Bonus Actions', m.bonus) + section('Reactions', m.reaction) + section('Legendary Actions', m.legendary) + section('Mythic Actions', m.mythic) +
      (m.src ? '<p class="muted sb-src">' + esc(m.src) + (m.ed === '2024' ? ' · 2024' : '') + '</p>' : '') + '</div>';
  }

  function renderCompanions() {
    var b = cur(), list = b.companions || [];
    var sugg = companionSuggestions();
    var cards = list.map(function (c, i) {
      var m = D.monster(c.id);
      return '<section class="card companion"><div class="card-head"><h3>' + esc(c.nick || (m ? m.name : c.id)) + '</h3>' + (c.nick && m ? '<span class="muted">' + esc(m.name) + '</span>' : '') +
        '<span class="pill pill-gold">' + esc(c.role || 'Companion') + '</span>' + (m ? '<span class="muted">CR ' + esc(m.cr) + '</span>' : '<span class="pill pill-todo">not loaded</span>') + '</div>' +
        '<div class="card-body"><div class="gear-grid">' +
        '<div class="field"><label for="cmp-n-' + i + '">Name</label><input type="text" id="cmp-n-' + i + '" data-cmpnick="' + i + '" value="' + esc(c.nick || '') + '" placeholder="' + esc(m ? m.name : '') + '"></div>' +
        '<div class="field"><label for="cmp-r-' + i + '">Role</label><select id="cmp-r-' + i + '" data-cmprole="' + i + '">' + COMPANION_ROLES.map(function (r) { return '<option' + (r === c.role ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="cmp-q-' + i + '">How many</label><input type="number" min="1" id="cmp-q-' + i + '" data-cmpqty="' + i + '" value="' + (c.qty || 1) + '"></div>' +
        '<div class="field"><span class="label">&nbsp;</span><button type="button" class="btn" data-cmprm="' + i + '">Remove</button></div></div>' +
        (m ? statBlock(m) : '<p class="desc">This creature comes from a compendium that isn\'t loaded in this browser.</p>') + '</div></section>';
    }).join('');
    var suggestHtml = sugg.length ? '<section class="card"><div class="card-head"><h3>Suggested for this build</h3><span class="muted">From your spells and features at level ' + b.level + '</span></div><div class="card-body"><div class="chips">' +
      sugg.map(function (x) { return '<button type="button" class="btn btn-small" data-addcmp="' + esc(x.m.id) + '" data-role="' + esc(x.role) + '" title="' + esc(x.why) + '">+ ' + esc(x.m.name) + ' <span class="muted">' + esc(x.role) + '</span></button>'; }).join('') +
      '</div></div></section>' : '';
    return '<div class="toolbar"><h2>Companions &amp; minions</h2><button type="button" class="btn btn-primary" data-openlist="monster">Add a creature</button></div>' +
      '<p class="desc">Track familiars, steeds, summons, animated minions, hirelings, sidekicks and Wild Shape forms with their full stat blocks. ' + (D.MONSTERS || []).length.toLocaleString() + ' creatures available' + (D.CONTENT.user ? ' (SRD + your compendium).' : ' (SRD). Import a compendium in Library for more.') + '</p>' +
      suggestHtml + (cards || '<section class="card"><div class="card-body"><p class="desc">No companions yet.</p></div></section>');
  }

  /* ---------- List picker sources ---------- */

  function rulesGroup(x) { return !x.compendium ? 'Built in (2024 SRD)' : x.ed === '2024' ? 'Compendium · 2024' : 'Compendium · 2014 and other'; }
  function sourceFilter(options) { return { id: 'src', label: 'Source', values: facetValues(options, 'src') }; }
  var PROP_NAMES = { F: 'Finesse', L: 'Light', H: 'Heavy', T: 'Thrown', '2': 'Two-Handed', V: 'Versatile', R: 'Reach', A: 'Ammunition' };
  var DIE_ORDER = ['1', '1d4', '1d6', '1d8', '1d10', '1d12', '2d4', '2d6', '2d8', '2d10', '2d12'];
  var GROUP_ORDER = ['Simple melee', 'Simple ranged', 'Martial melee', 'Martial ranged'];

  function listSource(kind) {
    var b = cur(), gear = b.gear || {}, opts, filters;
    if (kind === 'weapon') {
      opts = D.WEAPONS.map(function (w) {
        var grp = (w.cat === 'martial' ? 'Martial ' : 'Simple ') + (w.ranged ? 'ranged' : 'melee');
        var props = (w.props || '').split('').map(function (p) { return PROP_NAMES[p]; }).filter(Boolean);
        var die = String(w.dmg || '').replace(/\s/g, '').toLowerCase();
        return { id: w.id, label: w.name, group: (w.magic ? 'Magic · ' : '') + grp, order: (w.magic ? 10 : 0) + GROUP_ORDER.indexOf(grp),
          meta: w.cat + ' · ' + (w.ranged ? 'ranged' : 'melee') + ' · ' + w.dmg + ' ' + w.type + (props.length ? ' · ' + props.join(', ') : '') + (w.bonusHit ? ' · +' + w.bonusHit : '') + (w.mastery ? ' · ' + w.mastery : ''),
          search: (w.name + ' ' + w.type + ' ' + props.join(' ') + ' ' + (w.mastery || '')).toLowerCase(),
          facets: { cat: w.cat, range: w.ranged ? 'ranged' : 'melee', dtype: w.type, die: die, prop: props, mastery: w.mastery || '', magic: w.magic ? 'magic' : 'mundane', src: w.src || 'SRD 5.2' } };
      }).sort(function (a, c) { return a.order - c.order || a.label.localeCompare(c.label); });
      filters = [
        { id: 'cat', label: 'Category', values: [['simple', 'Simple'], ['martial', 'Martial']] },
        { id: 'range', label: 'Melee / ranged', values: [['melee', 'Melee'], ['ranged', 'Ranged']] },
        { id: 'die', label: 'Damage die', values: facetValues(opts, 'die', function (a, c) { return (DIE_ORDER.indexOf(a) + 1 || 99) - (DIE_ORDER.indexOf(c) + 1 || 99) || a.localeCompare(c); }) },
        { id: 'dtype', label: 'Damage type', values: facetValues(opts, 'dtype') },
        { id: 'prop', label: 'Property', values: Object.keys(PROP_NAMES).map(function (k) { return [PROP_NAMES[k], PROP_NAMES[k]]; }) },
        { id: 'mastery', label: 'Mastery', values: Object.keys(D.MASTERY).map(function (k) { return [k, k]; }) },
        { id: 'magic', label: 'Magic', values: [['mundane', 'Mundane'], ['magic', 'Magic']] },
        sourceFilter(opts)];
      return { title: 'Add a weapon', options: opts, filters: filters };
    }
    if (kind === 'armor') {
      var typeName = { none: 'No armor', light: 'Light armor', medium: 'Medium armor', heavy: 'Heavy armor' };
      var typeOrder = ['none', 'light', 'medium', 'heavy'];
      opts = D.ARMOR.map(function (a) {
        return { id: a.id, label: a.name, group: (a.magic ? 'Magic · ' : '') + typeName[a.type], order: (a.magic ? 10 : 0) + typeOrder.indexOf(a.type),
          meta: a.ac ? 'AC ' + (a.ac + (a.bonusAc || 0)) + (a.type === 'light' ? ' + Dex' : a.type === 'medium' ? ' + Dex (max 2)' : '') + (a.str ? ' · Str ' + a.str : '') + (a.stealthDis ? ' · Stealth disadvantage' : '') : 'AC 10 + Dex',
          search: (a.name + ' ' + a.type).toLowerCase(), facets: { type: a.type, magic: a.magic ? 'magic' : 'mundane', src: a.src || 'SRD 5.2' } };
      }).sort(function (a, c) { return a.order - c.order || (a.order < 10 ? 0 : a.label.localeCompare(c.label)); });
      return { title: 'Choose armor', current: gear.armor, options: opts, filters: [
        { id: 'type', label: 'Type', values: [['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy'], ['none', 'No armor']] },
        { id: 'magic', label: 'Magic', values: [['mundane', 'Mundane'], ['magic', 'Magic']] }, sourceFilter(opts)] };
    }
    if (kind === 'shield') {
      opts = [{ id: 'none', label: 'No shield', meta: '', search: 'no shield none', facets: { magic: 'mundane' } }].concat((D.SHIELDS || []).map(function (sh) {
        return { id: sh.id, label: sh.name, meta: '+' + (2 + (sh.bonus || 0)) + ' AC', group: sh.itemId ? 'Magic shields' : 'Shields', search: sh.name.toLowerCase(), facets: { magic: sh.itemId ? 'magic' : 'mundane' } };
      }));
      return { title: 'Choose a shield', current: gear.shield === true ? 'shield' : gear.shield || 'none', options: opts, filters: [{ id: 'magic', label: 'Magic', values: [['mundane', 'Mundane'], ['magic', 'Magic']] }] };
    }
    if (kind === 'item') {
      opts = D.ITEMS.map(function (it) {
        return { id: it.id, label: it.name, meta: [D.ITEM_TYPE[it.type] || it.type, it.rarity, it.attune ? 'attunement' : '', it.ed === '2024' ? '2024' : ''].filter(Boolean).join(' · '),
          desc: it.text, search: (it.name + ' ' + (it.rarity || '') + ' ' + (D.ITEM_TYPE[it.type] || '')).toLowerCase(),
          facets: { type: D.ITEM_TYPE[it.type] || it.type || 'Other', rarity: it.rarity || (it.magic ? 'unknown' : 'mundane'), attune: it.attune ? 'yes' : 'no', magic: it.magic ? 'magic' : 'mundane', ed: it.ed, src: it.src || '' } };
      }).sort(function (a, c) { return a.label.localeCompare(c.label); });
      return { title: 'Add an item', options: opts, filters: [
        { id: 'type', label: 'Type', values: facetValues(opts, 'type') },
        { id: 'rarity', label: 'Rarity', values: ['mundane', 'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies'].map(function (r) { return [r, r]; }) },
        { id: 'magic', label: 'Magic', values: [['mundane', 'Mundane'], ['magic', 'Magic']] },
        { id: 'attune', label: 'Attunement', values: [['yes', 'Requires attunement'], ['no', 'No attunement']] },
        { id: 'ed', label: 'Edition', values: [['2024', '2024'], ['2014', '2014 and other']] },
        sourceFilter(opts)] };
    }
    if (kind === 'monster') {
      var crs = ['0', '1/8', '1/4', '1/2'].concat(Array.from({ length: 30 }, function (_, i) { return String(i + 1); }));
      opts = (D.MONSTERS || []).map(function (m) {
        var type = (m.type || '').split(/[ ,(]/)[0].toLowerCase();
        return { id: m.id, label: m.name, meta: (m.cr ? 'CR ' + m.cr + ' · ' : '') + (D.SIZE_NAME[m.size] || m.size || '') + ' ' + m.type + (m.ed === '2024' ? ' · 2024' : ''),
          search: (m.name + ' ' + m.type).toLowerCase(), cr: D.crValue(m.cr),
          facets: { type: type, size: D.SIZE_NAME[m.size] || m.size, ed: m.ed, src: m.src || '', fly: /fly/i.test(m.speed) ? 'fly' : '', swim: /swim/i.test(m.speed) ? 'swim' : '' } };
      }).sort(function (a, c) { return a.label.localeCompare(c.label); });
      return { title: 'Add a creature', options: opts, filters: [
        { id: 'crmax', label: 'Max CR', values: crs.map(function (c) { return [c, 'CR ' + c + ' or lower']; }), test: function (o, v) { return o.cr <= D.crValue(v); } },
        { id: 'crmin', label: 'Min CR', values: crs.map(function (c) { return [c, 'CR ' + c + ' or higher']; }), test: function (o, v) { return o.cr >= D.crValue(v); } },
        { id: 'type', label: 'Type', values: facetValues(opts, 'type') },
        { id: 'size', label: 'Size', values: ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].map(function (z) { return [z, z]; }) },
        { id: 'move', label: 'Movement', values: [['fly', 'Can fly'], ['swim', 'Can swim']], test: function (o, v) { return o.facets[v] === v; } },
        { id: 'ed', label: 'Edition', values: [['2024', '2024'], ['2014', '2014 and other']] },
        sourceFilter(opts)] };
    }
    if (kind === 'levelclass') {
      var Lf = app.modal.forLevel, main = D.cls(b.classId), st = ev.levels[Lf - 1] ? ev.levels[Lf - 2].state : null;
      var curCls = (b.plan && b.plan[Lf - 1]) || '__main';
      opts = [{ id: '__main', label: 'Main class (' + (main ? main.name : '') + ')', group: 'Main class', order: -1, meta: 'Levels you don\'t change follow your main class', search: 'main', facets: {} }]
        .concat(D.CLASSES.map(function (x) {
          var req = x.mc && x.mc.req, list = req ? (req.any || req.all) : [];
          var ok = !req || !st || (req.any ? list.some(function (a) { return st.abilities[a] >= 13; }) : list.every(function (a) { return st.abilities[a] >= 13; }));
          return { id: x.id, label: x.name, group: rulesGroup(x), order: !x.compendium ? 0 : x.ed === '2024' ? 1 : 2,
            meta: 'd' + x.hd + (req ? ' · needs ' + list.map(function (a) { return a.toUpperCase(); }).join(req.any ? ' or ' : ' + ') + ' 13' + (ok ? '' : ' (not met)') : '') + (x.caster ? ' · spellcaster' : ''),
            search: (x.name + ' ' + (x.src || '')).toLowerCase(), facets: { rules: rulesGroup(x), src: x.src || 'SRD 5.2', ok: ok ? 'yes' : 'no' } };
        }).sort(function (a, c) { return a.order - c.order || (a.order ? a.label.localeCompare(c.label) : 0); }));
      if (!app.modal.f.apply) app.modal.f.apply = 'one';
      return { title: 'Class for level ' + Lf, current: curCls === b.classId ? '__main' : curCls, options: opts, filters: [
        { id: 'apply', label: 'Apply to', noAny: true, values: [['one', 'Level ' + Lf + ' only'], ['rest', 'Levels ' + Lf + '–20']], test: function () { return true; } },
        { id: 'ok', label: 'Requirements', values: [['yes', 'Meets ability requirements']], test: function (o, v) { return o.id === '__main' || o.facets.ok === v; } },
        { id: 'rules', label: 'Rules', values: facetValues(opts.slice(1), 'rules') }] };
    }
    if (kind === 'class') {
      var cg = speciesGroups('class');
      opts = cg.order.map(function (k) {
        var g = cg.map[k], srcs = [], rules = [], subs = 0;
        g.list.forEach(function (x) {
          var sr = x.src || 'SRD 5.2'; if (srcs.indexOf(sr) < 0) srcs.push(sr);
          var r = rulesGroup(x); if (rules.indexOf(r) < 0) rules.push(r);
          subs += x.subclasses.length;
        });
        var first = g.list[0];
        var variants = g.list.map(function (x) { return x.compendium ? variantLabel(x, 'class').replace(/^Standard \((.*)\)$/, '$1') : '2024'; });
        return { id: 'base:' + k, label: g.name, group: !first.compendium ? '2024 rules (built in)' : 'More classes', order: !first.compendium ? 0 : 1,
          meta: 'd' + first.hd + (first.caster ? ' · spellcaster' : '') + ' · ' + subs + ' subclasses' + (g.list.length > 1 ? ' · versions: ' + variants.join(', ') : ''),
          search: (g.name + ' ' + g.list.map(function (x) { return x.name + ' ' + (x.src || ''); }).join(' ')).toLowerCase(),
          facets: { rules: rules, src: srcs } };
      }).sort(function (a, c) { return a.order - c.order || (a.order ? a.label.localeCompare(c.label) : 0); });
      return { title: 'Choose a class', current: 'base:' + classBase(ev.cls.name).toLowerCase(), options: opts,
        filters: [{ id: 'rules', label: 'Rules', values: facetValues(opts, 'rules') }, sourceFilter(opts)] };
    }
    if (kind === 'background') {
      var bgG = speciesGroups('background');
      opts = bgG.order.map(function (k) {
        var g = bgG.map[k], srcs = [], rules = [];
        g.list.forEach(function (x) {
          var sr = x.src || 'SRD 5.2'; if (srcs.indexOf(sr) < 0) srcs.push(sr);
          var r = rulesGroup(x); if (rules.indexOf(r) < 0) rules.push(r);
        });
        var first = g.list[0];
        var variants = g.list.map(function (x) { return variantLabel(x, 'background'); }).filter(function (v) { return v !== 'Standard'; });
        var about = first.custom ? 'any abilities' : first.legacy ? '2014 background' : 'Feat: ' + (first.featName || '');
        return { id: 'base:' + k, label: g.name, group: !first.compendium ? '2024 rules (built in)' : 'More backgrounds', order: !first.compendium ? 0 : 1,
          meta: (g.list.length > 1 ? g.list.length + ' versions' + (variants.length ? ': ' + variants.slice(0, 3).join(', ') + (variants.length > 3 ? '…' : '') : '') + ' · ' : '') + about,
          search: (g.name + ' ' + g.list.map(function (x) { return x.name + ' ' + (x.src || ''); }).join(' ')).toLowerCase(),
          facets: { rules: rules, src: srcs } };
      }).sort(function (a, c) { return a.order - c.order || (a.order ? a.label.localeCompare(c.label) : 0); });
      return { title: 'Choose a background', current: 'base:' + backgroundBase(ev.background.name).toLowerCase(), options: opts,
        filters: [{ id: 'rules', label: 'Rules', values: facetValues(opts, 'rules') }, sourceFilter(opts)] };
    }
    if (kind === 'species') {
      var sg = speciesGroups();
      opts = sg.order.map(function (k) {
        var g = sg.map[k];
        var sizes = [], srcs = [], rules = [];
        g.list.forEach(function (x) {
          if (x.size && sizes.indexOf(x.size) < 0) sizes.push(x.size);
          var sr = x.src || 'SRD 5.2'; if (srcs.indexOf(sr) < 0) srcs.push(sr);
          var r = rulesGroup(x); if (rules.indexOf(r) < 0) rules.push(r);
        });
        var builtin = g.list.filter(function (x) { return !x.compendium; })[0];
        var lin = builtin && lineageSpec(builtin);
        var nOpts = g.list.length - (builtin ? 1 : 0) + (builtin ? (lin ? lin.options.length : 1) : 0);
        var variants = g.list.map(variantLabel).filter(function (v) { return v !== 'Standard'; });
        return { id: 'base:' + k, label: g.name, group: builtin ? '2024 rules (built in)' : 'More species', order: builtin ? 0 : 1,
          meta: nOpts > 1 ? nOpts + ' options' + (variants.length ? ': ' + variants.slice(0, 4).join(', ') + (variants.length > 4 ? '…' : '') : '') : (g.list[0].size || '') + ' · ' + (g.list[0].src || 'SRD 5.2'),
          search: (g.name + ' ' + g.list.map(function (x) { return x.name + ' ' + (x.src || ''); }).join(' ')).toLowerCase(),
          facets: { rules: rules, size: sizes, src: srcs } };
      }).sort(function (a, c) { return a.order - c.order || a.label.localeCompare(c.label); });
      return { title: 'Choose a species', current: 'base:' + speciesBase(ev.species.name).toLowerCase(), options: opts,
        filters: [{ id: 'rules', label: 'Rules', values: facetValues(opts, 'rules') }, { id: 'size', label: 'Size', values: facetValues(opts, 'size') }, sourceFilter(opts)] };
    }
    if (kind === 'class' || kind === 'species' || kind === 'background') {
      var list = kind === 'class' ? D.CLASSES : kind === 'species' ? D.SPECIES : D.BACKGROUNDS;
      opts = list.map(function (x) {
        var meta = kind === 'class' ? 'd' + x.hd + ' · ' + x.subclasses.length + ' subclasses' + (x.caster ? ' · spellcaster' : '') :
          kind === 'species' ? (x.size || '') + ' · Speed ' + x.speed + (x.darkvision ? ' · Darkvision ' + x.darkvision : '') :
          x.custom ? 'any abilities' : x.legacy ? '2014 background' : 'Feat: ' + (x.featName || '');
        return { id: x.id, label: x.name, group: rulesGroup(x), order: !x.compendium ? 0 : x.ed === '2024' ? 1 : 2, meta: meta + (x.src ? ' · ' + x.src : ''),
          search: (x.name + ' ' + (x.src || '')).toLowerCase(), facets: { rules: rulesGroup(x), src: x.src || 'SRD 5.2', size: x.size || '' } };
      }).sort(function (a, c) { return a.order - c.order || (a.order ? a.label.localeCompare(c.label) : 0); });
      filters = [{ id: 'rules', label: 'Rules', values: facetValues(opts, 'rules') }, sourceFilter(opts)];
      if (kind === 'species') filters.splice(1, 0, { id: 'size', label: 'Size', values: facetValues(opts, 'size') });
      return { title: 'Choose a ' + kind, current: kind === 'class' ? b.classId : kind === 'species' ? b.speciesId : b.backgroundId, options: opts, filters: filters };
    }
    return { title: '', options: [], filters: [] };
  }
  function setClass(id) {
    var b = cur();
    b.classId = id;
    var c = D.cls(id), gearKey = c ? c.name.toLowerCase().split(/[ (]/)[0] : '';
    b.gear = JSON.parse(JSON.stringify(DEFAULT_GEAR[id] || DEFAULT_GEAR[gearKey] || { armor: 'none', shield: false, weapons: ['dagger'] }));
    b.spells = { cantrips: [], prepared: [] };
  }
  function pickFromList(kind, id) {
    var b = cur();
    if (kind === 'weapon') { b.gear.weapons = (b.gear.weapons || []).concat(id); }
    if (kind === 'levelclass') {
      var Lp = app.modal.forLevel, until = app.modal.f.apply === 'rest' ? 20 : Lp;
      b.plan = b.plan && b.plan.length === 20 ? b.plan : Array(20).fill(null);
      for (var li = Lp; li <= until; li++) b.plan[li - 1] = id === '__main' || id === b.classId ? null : id;
    }
    if (kind === 'armor') b.gear.armor = id;
    if (kind === 'shield') b.gear.shield = id === 'none' ? false : id;
    if (kind === 'class') {
      var clsG = speciesGroups('class').map[id.replace(/^base:/, '')];
      if (clsG && !clsG.list.some(function (x) { return x.id === b.classId; })) setClass(clsG.list[0].id);
    }
    if (kind === 'species') {
      var g = speciesGroups().map[id.replace(/^base:/, '')];
      if (g && !g.list.some(function (x) { return x.id === b.speciesId; })) b.speciesId = g.list[0].id;
    }
    if (kind === 'background') {
      var bgGroup = speciesGroups('background').map[id.replace(/^base:/, '')];
      if (bgGroup && !bgGroup.list.some(function (x) { return x.id === b.backgroundId; })) b.backgroundId = bgGroup.list[0].id;
    }
    if (kind === 'item') {
      b.inventory = b.inventory || [];
      var same = b.inventory.filter(function (e) { return e.id === id; })[0];
      if (same) same.qty = (same.qty || 1) + 1; else b.inventory.push({ id: id, qty: 1, equipped: false, attuned: false });
    }
    if (kind === 'monster') { (b.companions = b.companions || []).push({ id: id, role: 'Summon', qty: 1, nick: '' }); }
    closeModal(); commit();
  }

  /* ---------- Rendering: library ---------- */

  var LIB_CATS = [['spells', 'Spells'], ['items', 'Items'], ['creatures', 'Creatures'], ['feats', 'Feats'], ['species', 'Species'], ['backgrounds', 'Backgrounds'], ['classes', 'Classes']];

  function libEntries(cat) {
    if (cat === 'spells') return (D.SPELL_DB || []).map(function (sp) { return { id: 'spell:' + sp.name + '|' + sp.ed, label: sp.name, meta: spellMeta(sp).split(' · ')[0] + (sp.ed === '2014' ? ' · 2014' : ''), f1: String(sp.level), f2: sp.classes.join(', '), src: sp.src, obj: sp }; });
    if (cat === 'items') return (D.ITEMS || []).map(function (it) { return { id: 'item:' + it.id, label: it.name, meta: [D.ITEM_TYPE[it.type] || it.type, it.rarity].filter(Boolean).join(' · ') + (it.ed === '2014' ? ' · 2014' : ''), f1: it.type, f2: it.rarity, src: it.src, obj: it }; });
    if (cat === 'creatures') return (D.MONSTERS || []).map(function (m) { return { id: 'mon:' + m.id, label: m.name, meta: 'CR ' + m.cr + ' · ' + m.type + (m.ed === '2014' ? ' · 2014' : ''), f1: m.cr, f2: (m.type || '').split(/[ ,(]/)[0].toLowerCase(), src: m.src, obj: m }; });
    if (cat === 'feats') return D.FEATS.filter(function (f) { return !f.compendium; }).concat(D.COMPENDIUM_FEATS || []).map(function (f) { return { id: 'feat:' + f.id, label: f.name, meta: f.cat + (f.prereqText ? ' · ' + f.prereqText : ''), f1: f.cat, f2: '', src: f.src || 'SRD 5.2', obj: f }; });
    if (cat === 'species') return D.SPECIES.map(function (x) { return { id: 'sp:' + x.id, label: x.name, meta: (x.size || '') + ' · Speed ' + x.speed, f1: x.compendium ? x.ed : 'builtin', f2: '', src: x.src || 'SRD 5.2', obj: x }; });
    if (cat === 'backgrounds') return D.BACKGROUNDS.map(function (x) { return { id: 'bg:' + x.id, label: x.name, meta: x.legacy ? '2014' : x.custom ? 'custom' : 'Feat: ' + (x.featName || ''), f1: x.compendium ? x.ed : 'builtin', f2: '', src: x.src || 'SRD 5.2', obj: x }; });
    if (cat === 'classes') return D.CLASSES.map(function (x) { return { id: 'cls:' + x.id, label: x.name, meta: 'd' + x.hd + ' · ' + x.subclasses.length + ' subclasses', f1: x.compendium ? x.ed : 'builtin', f2: '', src: x.src || 'SRD 5.2', obj: x }; });
    return [];
  }
  function libFilters(cat) {
    var L = app.lib;
    function sel(id, label, opts, val) {
      return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '"><option value="">Any</option>' + opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select></div>';
    }
    if (cat === 'spells') {
      var classes = {};
      (D.SPELL_DB || []).forEach(function (sp) { sp.classes.forEach(function (c) { var base = c.replace(/\s*\[5\.5e\]/, '').replace(/\s*\(.*\)$/, '').trim(); classes[base] = 1; }); });
      return sel('lib-f1', 'Level', [['0', 'Cantrip']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (l) { return [String(l), 'Level ' + l]; })), L.f1) +
        sel('lib-f2', 'Class', Object.keys(classes).sort().map(function (c) { return [c, c]; }), L.f2);
    }
    if (cat === 'items') return sel('lib-f1', 'Type', Object.keys(D.ITEM_TYPE).map(function (k) { return [k, D.ITEM_TYPE[k]]; }), L.f1) +
      sel('lib-f2', 'Rarity', ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'].map(function (r) { return [r, r]; }), L.f2);
    if (cat === 'creatures') {
      var types = {};
      (D.MONSTERS || []).forEach(function (m) { var t = (m.type || '').split(/[ ,(]/)[0].toLowerCase(); if (t) types[t] = 1; });
      return sel('lib-f1', 'Challenge', ['0', '1/8', '1/4', '1/2'].concat(Array.from({ length: 30 }, function (_, i) { return String(i + 1); })).map(function (c) { return [c, 'CR ' + c]; }), L.f1) +
        sel('lib-f2', 'Type', Object.keys(types).sort().map(function (t) { return [t, t]; }), L.f2);
    }
    if (cat === 'feats') return sel('lib-f1', 'Category', [['origin', 'Origin'], ['general', 'General'], ['style', 'Fighting Style'], ['epic', 'Epic Boon'], ['legacy', '2014 feats'], ['option', 'Class options (invocations, maneuvers…)']], L.f1);
    return sel('lib-f1', 'Source', [['builtin', 'Built in (SRD 5.2)'], ['2024', 'Compendium · 2024'], ['2014', 'Compendium · 2014 and other']], L.f1);
  }
  function libMatches() {
    var L = app.lib, q = L.q.toLowerCase();
    return libEntries(L.cat).filter(function (e) {
      if (q && (e.label + ' ' + e.meta + ' ' + (e.src || '')).toLowerCase().indexOf(q) < 0) return false;
      if (L.f1 && e.f1 !== L.f1) return false;
      if (L.f2) {
        if (L.cat === 'spells') { if (!e.obj.classes.some(function (c) { return c.replace(/\s*\[5\.5e\]/, '').replace(/\s*\(.*\)$/, '').trim() === L.f2; })) return false; }
        else if (L.cat === 'items') { if ((e.f2 || '') !== L.f2) return false; }
        else if (e.f2 !== L.f2) return false;
      }
      return true;
    }).sort(function (a, b) { return a.label.localeCompare(b.label); });
  }
  function libResults() {
    var hits = libMatches(), shown = hits.slice(0, 200);
    return '<p class="muted">' + hits.length.toLocaleString() + ' result' + (hits.length === 1 ? '' : 's') + (hits.length > 200 ? ' · showing the first 200' : '') + '</p>' +
      '<div class="lib-list">' + shown.map(function (e) {
        return '<button type="button" class="lib-row" data-libopen="' + esc(e.id) + '"><b>' + esc(e.label) + '</b><span class="muted">' + esc(e.meta) + '</span><span class="lib-src">' + esc(e.src || '') + '</span></button>';
      }).join('') + '</div>';
  }
  function importPanel() {
    var info = D.CONTENT.userInfo;
    var status = app.importing ? '<p class="pill pill-gold" aria-live="polite">' + esc(app.importing) + '</p>' : '';
    var loaded = info ? '<div class="rows">' + Object.keys(info.counts).map(function (k) { return '<div class="row"><span>' + k.replace(/^./, function (c) { return c.toUpperCase(); }) + '</span><span class="v">' + info.counts[k].toLocaleString() + '</span></div>'; }).join('') + '</div>' +
      '<p class="desc">From ' + esc(info.files.slice(0, 4).join(', ') + (info.files.length > 4 ? ' and ' + (info.files.length - 4) + ' more' : '')) + ' · imported ' + esc(new Date(info.date).toLocaleString()) +
      (info.saved === false ? ' · <b>not saved</b> (this browser blocks storage, so you\'ll need to import again next visit)' : '') + '</p>' : '';
    return '<section class="card"><div class="card-head"><h3>Your compendium</h3>' + (info ? '<span class="pill pill-ok">loaded</span>' : '<span class="pill pill-plain">none loaded</span>') + '</div><div class="card-body">' +
      '<p class="desc">Import Fight Club 5 / Game Master 5 compendium files (.xml, or a .zip of them), such as the collections built from the FightClub5eXML project. Files are read in this browser and stored only here; nothing is uploaded. Imported content adds classes, subclasses, species, backgrounds, feats, spells, items and creatures to the builder.</p>' +
      loaded + status +
      '<div class="chips"><label class="btn btn-primary file-btn" for="import-file">' + (info ? 'Import again (replaces)' : 'Import compendium files') + '</label><input id="import-file" type="file" accept=".xml,.zip,text/xml,application/zip" multiple hidden>' +
      (info ? '<button type="button" class="btn' + (app.clearArmed ? ' btn-danger armed' : '') + '" data-clearcomp="1">' + (app.clearArmed ? 'Confirm: remove compendium' : 'Remove compendium') + '</button>' : '') + '</div></div></section>';
  }
  function renderLibrary() {
    var L = app.lib;
    return '<div class="toolbar"><h2>Library</h2><span class="muted">SRD 5.2 content is built in' + (D.CONTENT.user ? ', plus your imported compendium' : '') + '</span></div>' + importPanel() +
      '<section class="card"><div class="card-body"><div class="seg lib-cats" role="group" aria-label="Category">' + LIB_CATS.map(function (c) {
        return '<button type="button" data-libcat="' + c[0] + '" aria-pressed="' + (L.cat === c[0]) + '">' + c[1] + '</button>';
      }).join('') + '</div><div class="gear-grid"><div class="field"><label for="lib-q">Search</label><input type="text" id="lib-q" value="' + esc(L.q) + '" placeholder="Name, source…"></div>' + libFilters(L.cat) + '</div>' +
      '<div id="lib-results">' + libResults() + '</div></div></section>';
  }

  /* ---------- Detail views ---------- */

  function spellDetailHtml(sp) {
    return '<p class="muted">' + esc(spellMeta(sp)) + '</p><p><b>Components</b> ' + esc(sp.comp || '—') + '</p>' + fmt(sp.text) +
      '<p class="muted">Classes: ' + esc(sp.classes.join(', ').replace(/ \[5\.5e\]/g, '')) + '</p><p class="muted">' + esc(sp.src || '') + (sp.ed === '2024' ? ' · 2024' : ' · 2014') + '</p>';
  }
  function itemDetailHtml(it) {
    var w = D.WEAPONS.filter(function (x) { return x.itemId === it.id; })[0];
    var bits = [it.detail, D.ITEM_TYPE[it.type], it.weight ? it.weight + ' lb' : '', it.value ? it.value + ' gp' : '', it.dmg1 ? it.dmg1 + (it.dmg2 ? '/' + it.dmg2 : '') + ' ' + ({ S: 'slashing', P: 'piercing', B: 'bludgeoning' }[it.dmgType] || it.dmgType || '') : '', it.ac ? 'AC ' + it.ac : '', w && w.mastery ? 'Mastery: ' + w.mastery : ''].filter(Boolean);
    return '<p class="muted">' + esc(bits.join(' · ')) + '</p>' + fmt(it.text) + '<p class="muted">' + esc(it.src || '') + '</p>';
  }
  function genericDetailHtml(obj, kind) {
    if (kind === 'feat') return (obj.prereqText ? '<p class="muted">Prerequisite: ' + esc(obj.prereqText) + '</p>' : '') + fmt(obj.desc) + '<p class="muted">' + esc(obj.src || 'SRD 5.2') + '</p>';
    if (kind === 'sp') return '<p class="muted">' + esc((obj.size || '') + ' · Speed ' + obj.speed + (obj.darkvision ? ' · Darkvision ' + obj.darkvision + ' ft' : '')) + '</p>' +
      (obj.traits || []).map(function (t) { return '<h4>' + esc(t[0]) + '</h4>' + fmt(t[1]); }).join('');
    if (kind === 'bg') return '<p class="muted">' + esc([obj.abilities ? 'Abilities: ' + obj.abilities.join(', ').toUpperCase() : '', obj.featName ? 'Feat: ' + obj.featName : '', obj.skills ? 'Skills: ' + obj.skills.map(function (k) { return D.SKILLS[k].name; }).join(', ') : '', obj.tool ? 'Tool: ' + obj.tool : ''].filter(Boolean).join(' · ')) + '</p>' +
      (obj.extraTraits || []).map(function (t) { return '<h4>' + esc(t[0]) + '</h4>' + fmt(t[1]); }).join('') + (obj.desc ? fmt(obj.desc) : '');
    if (kind === 'cls') {
      var html = '<p class="muted">d' + obj.hd + ' Hit Die · Saves: ' + esc(obj.saves.join(', ').toUpperCase() || '—') + ' · Armor: ' + esc(obj.armor.join(', ') || 'none') + ' · Weapons: ' + esc(obj.weapons.join(', ') || 'none') + '</p>';
      html += '<h4>Features</h4><ul class="feat-index">';
      for (var l = 1; l <= 20; l++) {
        var names = (obj.features[l] || []).map(function (f) { return f.subclassSlot ? obj.subclassLabel : f.name; });
        if (names.length) html += '<li><b>' + l + '</b> ' + esc(names.join(', ')) + '</li>';
      }
      html += '</ul><h4>' + esc(obj.subclassLabel || 'Subclasses') + ' (' + obj.subclasses.length + ')</h4><ul class="feat-index">' + obj.subclasses.map(function (sc) { return '<li><b>' + esc(sc.name) + '</b> ' + esc(sc.desc || '') + '</li>'; }).join('') + '</ul>';
      return html;
    }
    return '';
  }
  function openDetail(key) {
    var i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1);
    var m = { type: 'detail', title: '', sub: '', html: '' };
    if (kind === 'spell') {
      var parts = id.split('|');
      var sp = (D.SPELL_DB || []).filter(function (x) { return x.name === parts[0] && (!parts[1] || x.ed === parts[1]); })[0] || D.SPELL_INFO[parts[0]];
      if (!sp) return;
      m.title = sp.name; m.sub = sp.level ? 'Level ' + sp.level + ' spell' : 'Cantrip'; m.html = spellDetailHtml(sp);
    } else if (kind === 'item') {
      var it = D.item(id); if (!it) return;
      m.title = it.name; m.sub = it.magic ? 'Magic item' : 'Item'; m.html = itemDetailHtml(it);
      m.foot = '<button type="button" class="btn" data-additem="' + esc(it.id) + '">Add to inventory</button>';
    } else if (kind === 'mon') {
      var mo = D.monster(id); if (!mo) return;
      m.title = mo.name; m.sub = 'CR ' + mo.cr; m.html = statBlock(mo);
      m.foot = '<button type="button" class="btn" data-addcmp="' + esc(mo.id) + '" data-role="Summon">Add as companion</button>';
    } else {
      var list = kind === 'feat' ? D.FEATS.concat(D.COMPENDIUM_FEATS || []) : kind === 'sp' ? D.SPECIES : kind === 'bg' ? D.BACKGROUNDS : D.CLASSES;
      var obj = find(list, id); if (!obj) return;
      m.title = obj.name; m.sub = { feat: 'Feat', sp: 'Species', bg: 'Background', cls: 'Class' }[kind]; m.html = genericDetailHtml(obj, kind);
    }
    app.modal = m; renderModal();
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
    if (!b.inventory) b.inventory = [];
    if (!b.companions) b.companions = [];
    if (!b.options) b.options = { legacySpells: false };
    if (b.gear && b.gear.shield === true) b.gear.shield = 'shield';
    var views = { sheet: renderSheet, spells: renderSpells, progression: renderProgression, gear: renderGear, companions: renderCompanions, library: renderLibrary };
    var html = (views[app.tab] || renderBuild)();
    if (ev.missing.length && app.tab !== 'library') {
      html = '<section class="card notice"><div class="card-body"><p><b>Part of this build isn\'t loaded.</b> Its ' + esc(ev.missing.join(' and ')) +
        ' comes from a compendium that isn\'t imported in this browser, so a stand-in is shown. Import the same compendium in <button type="button" class="linklike" data-tab="library">Library</button> to see it.</p></div></section>' + html;
    }
    primary.innerHTML = html;
    $('#summary').innerHTML = renderSummary();
    document.querySelector('.cols').classList.toggle('wide', app.tab === 'progression' || app.tab === 'library');
    window.scrollTo(0, y);
    if (app.modal) renderModal();
  }

  /* ---------- Events ---------- */

  function onClick(e) {
    var t = e.target.closest('button, [data-level], [data-tab]');
    if (!t) return;
    var b = cur();
    if (t.id !== 'delete-btn' && app.deleteArmed) { app.deleteArmed = false; renderHeader(); }
    if (!t.dataset.clearcomp && app.clearArmed) { app.clearArmed = false; }

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
    if (t.dataset.spellreset) {
      var plR = b.spellPlan && b.spellPlan[t.dataset.spellreset];
      if (plR) delete plR[+t.dataset.cl];
      commit(); return;
    }
    if (t.dataset.spellcarry) {
      var plC = b.spellPlan && b.spellPlan[t.dataset.spellcarry];
      if (plC) Object.keys(plC).forEach(function (k) { if (+k > +t.dataset.cl) delete plC[k]; });
      commit(); return;
    }
    if (t.dataset.spellpick) { openModal({ type: 'spells', kind: t.dataset.spellpick, cls: t.dataset.cls || '' }); return; }
    if (t.dataset.rmspell) {
      var rc = t.dataset.cls || b.classId, pk = D.spellsEdit(b, rc, +t.dataset.cl || 1);
      pk[t.dataset.rmspell] = (pk[t.dataset.rmspell] || []).filter(function (n) { return n !== t.dataset.value; });
      D.spellsTidy(b, rc);
      commit(); return;
    }
    if (t.dataset.rmweapon) {
      b.gear.weapons = b.gear.weapons.filter(function (w) { return w !== t.dataset.rmweapon; });
      commit(); return;
    }
    if (t.dataset.close) { closeModal(); return; }
    if (t.dataset.openlist) { openModal({ type: 'list', kind: t.dataset.openlist, forLevel: +t.dataset.forlevel || 0 }); return; }
    if (t.dataset.mmore) { app.modal.limit += 150; renderModal(); return; }
    if (t.dataset.mclear) { app.modal.f = {}; app.modal.limit = 150; renderModal(); return; }
    if (t.dataset.pickone) { var rk = app.modal.key; closeModal(); setChoice(rk, t.dataset.pickone); return; }
    if (t.dataset.listpick) { pickFromList(app.modal.kind, t.dataset.listpick); return; }
    if (t.dataset.iteminfo) { openDetail('item:' + t.dataset.iteminfo); return; }
    if (t.dataset.spellinfo) { openDetail('spell:' + t.dataset.spellinfo); return; }
    if (t.dataset.libopen) { openDetail(t.dataset.libopen); return; }
    if (t.dataset.libcat) { app.lib = { cat: t.dataset.libcat, q: app.lib.q, f1: '', f2: '' }; render(); return; }
    if (t.dataset.invrm !== undefined) { b.inventory.splice(+t.dataset.invrm, 1); commit(); return; }
    if (t.dataset.additem) { pickFromList('item', t.dataset.additem); return; }
    if (t.dataset.addcmp) {
      b.companions.push({ id: t.dataset.addcmp, role: t.dataset.role || 'Summon', qty: 1, nick: '' });
      if (app.modal) closeModal();
      commit(); return;
    }
    if (t.dataset.cmprm !== undefined) { b.companions.splice(+t.dataset.cmprm, 1); commit(); return; }
    if (t.dataset.clearcomp) {
      if (!app.clearArmed) { app.clearArmed = true; render(); return; }
      app.clearArmed = false;
      D.clearCompendium().then(function () { D.registerContent(); render(); });
      return;
    }
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
    if (t.dataset.mfilter) { app.modal.f[t.dataset.mfilter] = t.value; app.modal.limit = 150; renderModal(); return; }
    if (t.id === 'f-species') { b.speciesId = t.value; commit(); return; }
    if (t.id === 'f-subspecies' && t.value) {
      var parts = t.value.split('|');
      b.speciesId = parts[0];
      var ls = lineageSpec(find(D.SPECIES, parts[0]) || {});
      if (ls && parts[1]) b.choices['sp.' + parts[0] + '.' + ls.id] = parts[1];
      commit(); return;
    }
    if (t.id === 'f-bg') { b.backgroundId = t.value; commit(); return; }
    if (t.id === 'f-subbg' && t.value) { b.backgroundId = t.value; commit(); return; }
    if (t.id === 'f-classver' && t.value) { setClass(t.value); commit(); return; }
    if (t.id === 'f-subclass') { setChoice(ev.cls.id + '.subclass', t.value); return; }
    if (t.id === 'g-armor') { b.gear.armor = t.value; commit(); return; }
    if (t.id === 'g-shield') { b.gear.shield = t.value || false; commit(); return; }
    if (t.id === 'opt-legacy') { b.options.legacySpells = t.checked; commit(); return; }
    if (t.dataset.invqty !== undefined) { b.inventory[+t.dataset.invqty].qty = Math.max(1, parseInt(t.value, 10) || 1); commit(); return; }
    if (t.dataset.invequip !== undefined) { b.inventory[+t.dataset.invequip].equipped = t.checked; commit(); return; }
    if (t.dataset.invattune !== undefined) { b.inventory[+t.dataset.invattune].attuned = t.checked; commit(); return; }
    if (t.dataset.cmpnick !== undefined) { b.companions[+t.dataset.cmpnick].nick = t.value.trim(); commit(); return; }
    if (t.dataset.cmprole !== undefined) { b.companions[+t.dataset.cmprole].role = t.value; commit(); return; }
    if (t.dataset.cmpqty !== undefined) { b.companions[+t.dataset.cmpqty].qty = Math.max(1, parseInt(t.value, 10) || 1); commit(); return; }
    if (t.id === 'lib-f1' || t.id === 'lib-f2') { app.lib[t.id.slice(4)] = t.value; save(); render(); return; }
    if (t.id === 'import-file' && t.files && t.files.length) { runImport(t.files); return; }
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
      var k = app.modal.kind, mc = app.modal.cls || b.classId, picks = D.spellsEdit(b, mc, app.modal.classLevel || 1), list = (picks[k] || []).slice(), n = t.dataset.spelltoggle;
      if (t.checked) { if (list.indexOf(n) < 0) list.push(n); } else list = list.filter(function (x) { return x !== n; });
      picks[k] = list; D.spellsTidy(b, mc); commit(); return;
    }
  }

  function onInput(e) {
    if (e.target.id === 'dlg-q' && app.modal) { app.modal.q = e.target.value; app.modal.limit = 150; renderModal(); }
    if (e.target.id === 'lib-q') { app.lib.q = e.target.value; $('#lib-results').innerHTML = libResults(); }
  }
  function onSubmit(e) {
    if (e.target.id === 'custom-item-form') {
      e.preventDefault();
      var v = $('#custom-item').value.trim();
      if (!v) return;
      cur().inventory.push({ name: v, qty: 1, equipped: false, attuned: false });
      commit();
    }
  }

  function runImport(files) {
    app.importing = 'Starting import…'; render();
    D.importFiles(files, function (msg) { app.importing = msg; var el = document.querySelector('.card .pill-gold[aria-live]'); if (el) el.textContent = msg; })
      .then(function (info) {
        app.importing = '';
        D.registerContent();
        render();
      }, function (err) {
        app.importing = 'Import failed: ' + (err && err.message ? err.message : err);
        render();
      });
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
  document.addEventListener('submit', onSubmit);
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });

  load();
  var hashTab = (location.hash || '').replace('#', '');
  if (['build', 'sheet', 'gear', 'spells', 'companions', 'library', 'progression'].indexOf(hashTab) >= 0) app.tab = hashTab;
  D.registerContent();
  $('#primary').innerHTML = '<section class="card"><div class="card-body"><p class="muted">Loading your saved compendium…</p></div></section>';
  // Wait briefly for an imported compendium so builds that use it render correctly.
  var started = false;
  function start() { if (started) return; started = true; app.ready = true; render(); }
  D.loadStoredCompendium().then(function (rec) { if (rec) D.registerContent(); start(); }, start);
  setTimeout(start, 4000);
})();
