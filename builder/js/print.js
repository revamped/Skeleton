/*
 * Printable character sheet: a paper-styled view of the build at the viewed level,
 * plus a plain-text version for copying. Rendered into #print-root.
 */
(function () {
  var D = window.DND;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sign(n) { return (n >= 0 ? '+' : '') + n; }
  function snip(text, n) { text = String(text || '').replace(/\s+/g, ' ').trim(); return !n || text.length <= n ? text : text.slice(0, n - 1) + '…'; }
  function classBase(name) { return name.split(' (')[0]; }
  function bubbles(n) { var o = ''; for (var i = 0; i < n; i++) o += '<span class="ps-bubble"></span>'; return o; }

  // Everything the sheet shows, gathered from an evaluated build at one level.
  function sheetData(build, ev) {
    var L = build.level, lv = ev.levels[L - 1], d = lv.d, s = lv.state;
    var classLine = ev.multiclass ? d.classLevels.map(function (c) { return c.name + ' ' + c.level + (c.sub ? ' (' + c.sub + ')' : ''); }).join(' / ')
      : ev.cls.name + ' ' + L + (lv.subclass ? ' (' + lv.subclass.name + ')' : '');
    var features = [];
    ev.levels.slice(0, L).forEach(function (l) {
      l.features.forEach(function (f) {
        if (f.name === 'Proficiencies' || /^Multiclassing into/.test(f.name)) return;
        if (f.choices.length && /Subclass|Ability Score Improvement|Epic Boon/.test(f.name) && !f.desc) return;
        var chosen = [];
        (function walk(list) {
          list.forEach(function (c) {
            var vals = Array.isArray(c.value) ? c.value : c.value ? [c.value] : [];
            vals.forEach(function (v) { var o = (c.options || []).filter(function (x) { return x.id === v; })[0]; chosen.push(o ? o.label : v); });
            walk(c.children);
          });
        })(f.choices);
        var desc = /^Choose your subclass/.test(f.desc || '') ? '' : f.desc || '';
        features.push({ name: f.name, where: (f.source === 'Class' ? classBase(l.cls.name) : f.source) + ' ' + l.classLevel, chosen: chosen, desc: desc });
      });
    });
    var casters = (d.spellcasters || []).map(function (e) { return { e: e, rep: D.spellReport(build, ev, L, e.clsId) }; });
    return { build: build, ev: ev, lv: lv, d: d, s: s, L: L, classLine: classLine, features: features, casters: casters };
  }

  /* ---------- HTML sheet ---------- */

  function renderSheetHtml(build, ev, opts) {
    var x = sheetData(build, ev), d = x.d, s = x.s, full = opts && opts.full;
    var limit = full ? 0 : 240;
    var abil = D.ABILITIES.map(function (a) {
      return '<div class="ps-abil"><span class="ps-lbl">' + D.ABILITY_NAMES[a] + '</span><b class="ps-mod">' + sign(d.mods[a]) + '</b><span class="ps-score">' + s.abilities[a] + '</span>' +
        '<span class="ps-save"><i class="ps-dot' + (d.saves[a].prof ? ' on' : '') + '"></i>Save ' + sign(d.saves[a].total) + '</span></div>';
    }).join('');
    var skills = Object.keys(D.SKILLS).map(function (k) {
      var sk = d.skills[k];
      return '<div class="ps-skill"><i class="ps-dot' + (sk.level === 2 ? ' exp' : sk.level ? ' on' : '') + '"></i><span class="ps-num">' + sign(sk.total) + '</span> ' + esc(D.SKILLS[k].name) +
        ' <span class="ps-muted">(' + D.SKILLS[k].ability.slice(0, 3).toUpperCase() + ')</span></div>';
    }).join('');
    var vitals = [['Armor Class', d.ac], ['Hit Points', d.hp], ['Initiative', sign(d.init)], ['Speed', d.speed + ' ft'], ['Proficiency', sign(d.pb)], ['Passive Perception', d.passivePerception]]
      .map(function (v) { return '<div class="ps-vital"><b>' + v[1] + '</b><span>' + v[0] + '</span></div>'; }).join('');
    var attacks = '<table class="ps-table"><thead><tr><th>Attack</th><th>Hit</th><th>Damage</th><th>Mastery</th></tr></thead><tbody>' +
      (d.attacks.length ? d.attacks.map(function (a) { return '<tr><td>' + esc(a.name) + '</td><td>' + sign(a.hit) + '</td><td>' + esc(a.dmg) + '</td><td>' + esc(a.mastery || '') + '</td></tr>'; }).join('') : '') +
      '<tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr></tbody></table>';
    var resources = d.columns.map(function (c) { return '<div class="ps-row"><span>' + esc(c.label) + '</span><b>' + esc(c.value) + '</b></div>'; }).join('');
    var profs = [
      ['Armor', s.profs.armor.join(', ') || 'None'],
      ['Weapons', s.profs.weapons.join(', ').replace('martial-light', 'martial (Light)').replace('martial-finesse-light', 'martial (Finesse or Light)') || 'None'],
      ['Tools', s.profs.tools.filter(function (t) { return t && t !== '—'; }).join(', ') || 'None'],
      ['Weapon masteries', s.masteries.map(function (id) { var w = D.weapon(id); return w ? w.name + ' (' + w.mastery + ')' : id; }).join(', ') || '—'],
      ['Senses', [x.s.darkvision ? 'Darkvision ' + x.s.darkvision + ' ft' : ''].concat(s.senses).filter(Boolean).join(', ') || '—'],
      ['Resistances', s.resist.filter(function (r, i, a) { return a.indexOf(r) === i; }).join(', ') || '—']
    ].map(function (r) { return '<div class="ps-row ps-wrap"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('');
    var traits = x.ev.species.traits.map(function (t) { return '<div class="ps-feat"><b>' + esc(t[0]) + '.</b> ' + esc(snip(t[1], limit)) + '</div>'; }).join('') +
      s.feats.map(function (f) { return '<div class="ps-feat"><b>' + esc(f.name) + '</b> <span class="ps-muted">(' + esc(f.source) + ')</span>. ' + esc(snip(f.desc, limit)) + '</div>'; }).join('');
    var feats = x.features.map(function (f) {
      return '<div class="ps-feat"><b>' + esc(f.name) + '</b> <span class="ps-muted">(' + esc(f.where) + ')</span>' + (f.chosen.length ? ': <i>' + esc(f.chosen.join(', ')) + '</i>' : '') + (f.desc ? '. ' + esc(snip(f.desc, limit)) : '') + '</div>';
    }).join('');

    var page1 = '<section class="ps-page">' +
      '<header class="ps-head"><div><div class="ps-icons">' + x.d.classLevels.map(function (c) { return D.icon(D.classIcon(D.cls(c.id) || { name: c.name })); }).join('') + '</div><h1>' + esc(x.build.name || 'Unnamed') + '</h1><p>' + esc(x.classLine) + '</p></div>' +
      '<dl class="ps-id"><div><dt>Level</dt><dd>' + x.L + '</dd></div><div><dt>Species</dt><dd>' + esc(x.ev.species.name) + '</dd></div><div><dt>Background</dt><dd>' + esc(x.ev.background.name) + '</dd></div>' +
      '<div><dt>Size</dt><dd>' + esc(s.size) + '</dd></div><div><dt>Hit Dice</dt><dd>' + esc(d.hitDice) + '</dd></div><div><dt>XP / Notes</dt><dd>&nbsp;</dd></div></dl></header>' +
      '<div class="ps-grid">' +
      '<div class="ps-col ps-left"><div class="ps-abils">' + abil + '</div><div class="ps-box"><h2>Skills</h2><div class="ps-skills">' + skills + '</div><p class="ps-key"><i class="ps-dot on"></i> proficient <i class="ps-dot exp"></i> expertise</p></div></div>' +
      '<div class="ps-col"><div class="ps-vitals">' + vitals + '</div>' +
      '<div class="ps-box ps-hp"><h2>Hit Points</h2><div class="ps-hpgrid"><div><span>Current</span></div><div><span>Temporary</span></div><div><span>Death saves</span>' +
      '<p>Success ' + bubbles(3) + '</p><p>Failure ' + bubbles(3) + '</p></div></div></div>' +
      '<div class="ps-box"><h2>Attacks <span class="ps-muted">(' + d.attacksPerAction + ' per Attack action' + (d.crit < 20 ? ', crit ' + d.crit + '–20' : '') + ')</span></h2>' + attacks + '</div>' +
      (resources ? '<div class="ps-box"><h2>Class resources</h2>' + resources + '</div>' : '') +
      '<div class="ps-box"><h2>Proficiencies &amp; defenses</h2>' + profs + '</div></div></div>' +
      '<div class="ps-box ps-features"><h2>Features &amp; traits</h2><div class="ps-cols2">' + traits + feats + '</div></div></section>';

    // Page 2: spells, equipment, companions, notes.
    var spells = x.casters.map(function (c) {
      var e = c.e, rep = c.rep;
      var slotRow = (e.slots || []).map(function (n, i) { return n ? '<span class="ps-slot">' + (i + 1) + ' ' + bubbles(n) + '</span>' : ''; }).join('') +
        (e.pact ? '<span class="ps-slot">Pact (L' + e.pact.level + ') ' + bubbles(e.pact.count) + '</span>' : '');
      var byLevel = {};
      rep.prepared.forEach(function (p) { if (p.ok) (byLevel[p.level] = byLevel[p.level] || []).push(p.name); });
      return '<div class="ps-box"><h2>' + esc(e.className) + ' spellcasting</h2>' +
        '<div class="ps-spellhead"><span>Ability <b>' + D.ABILITY_NAMES[e.ability] + '</b></span><span>Save DC <b>' + e.dc + '</b></span><span>Attack <b>' + sign(e.attack) + '</b></span><span>Prepared <b>' + rep.preparedCount + '/' + e.prepared + '</b></span></div>' +
        '<div class="ps-slots">' + slotRow + '</div>' +
        (rep.cantrips.length ? '<p><b>Cantrips:</b> ' + esc(rep.cantrips.filter(function (c2) { return c2.ok; }).map(function (c2) { return c2.name; }).join(', ')) + '</p>' : '') +
        Object.keys(byLevel).sort().map(function (l) { return '<p><b>Level ' + l + ':</b> ' + esc(byLevel[l].join(', ')) + '</p>'; }).join('') + '</div>';
    }).join('');
    var always = s.spells.always.length ? '<div class="ps-box"><h2>Always prepared &amp; granted spells</h2><p>' +
      s.spells.always.map(function (a) { return esc(a.name) + ' <span class="ps-muted">(' + esc(a.source) + ')</span>'; }).join(', ') + '</p></div>' : '';
    var inv = (x.build.inventory || []).map(function (e) {
      var it = D.item && D.item(e.id);
      return '<tr><td>' + esc(it ? it.name : e.name || e.id) + (e.attuned ? ' <span class="ps-muted">(attuned)</span>' : '') + (e.equipped ? ' <span class="ps-muted">(equipped)</span>' : '') + '</td><td>' + (e.qty || 1) + '</td><td>' + (it && it.weight ? +(it.weight * (e.qty || 1)).toFixed(2) + ' lb' : '') + '</td></tr>';
    }).join('');
    var gear = x.build.gear || {}, armor = (D.ARMOR.filter(function (a) { return a.id === gear.armor; })[0] || { name: 'No armor' }).name;
    var equipment = '<div class="ps-box"><h2>Equipment</h2><p><b>Armor:</b> ' + esc(armor) + (gear.shield ? ' · <b>Shield</b>' : '') + '</p>' +
      '<table class="ps-table"><thead><tr><th>Item</th><th>Qty</th><th>Weight</th></tr></thead><tbody>' + inv +
      '<tr><td>&nbsp;</td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td></tr></tbody></table>' +
      '<div class="ps-coins">' + ['CP', 'SP', 'EP', 'GP', 'PP'].map(function (c) { return '<div><span>' + c + '</span></div>'; }).join('') + '</div>' +
      '<p class="ps-muted">Carrying capacity ' + d.carry + ' lb · attuned ' + d.items.attuned + '/3</p></div>';
    var companions = (x.build.companions || []).map(function (c) {
      var m = D.monster && D.monster(c.id);
      if (!m) return '';
      var acts = (m.action || []).map(function (a) { return '<b>' + esc(a.name) + '.</b> ' + esc(snip(a.text, full ? 0 : 160)); }).join(' ');
      return '<div class="ps-comp"><b>' + esc(c.nick || m.name) + '</b> <span class="ps-muted">' + esc((c.nick ? m.name + ', ' : '') + (c.role || '') + (c.qty > 1 ? ' ×' + c.qty : '')) + '</span>' +
        '<p>AC ' + esc(m.ac) + ' · HP ' + esc(m.hp) + ' · Speed ' + esc(m.speed) + ' · CR ' + esc(m.cr) + '</p>' +
        '<p class="ps-muted">' + D.ABILITIES.map(function (a) { return a.toUpperCase() + ' ' + m[a] + ' (' + sign(D.mod(m[a])) + ')'; }).join(' · ') + '</p>' + (acts ? '<p>' + acts + '</p>' : '') + '</div>';
    }).join('');
    var page2 = '<section class="ps-page"><header class="ps-head ps-head-small"><h1>' + esc(x.build.name || 'Unnamed') + '</h1><p>' + esc(x.classLine) + ' · page 2</p></header>' +
      '<div class="ps-grid ps-grid2"><div class="ps-col">' + (spells || '<div class="ps-box"><h2>Spellcasting</h2><p class="ps-muted">No spellcasting class at this level.</p></div>') + always + '</div>' +
      '<div class="ps-col">' + equipment + (companions ? '<div class="ps-box"><h2>Companions</h2>' + companions + '</div>' : '') +
      '<div class="ps-box ps-notes"><h2>Notes</h2><div class="ps-lines"></div></div></div></div></section>';
    return page1 + page2;
  }

  /* ---------- Plain text ---------- */

  function renderSheetText(build, ev) {
    var x = sheetData(build, ev), d = x.d, s = x.s, out = [];
    out.push((x.build.name || 'Unnamed') + ' — ' + x.classLine);
    out.push('Level ' + x.L + ' ' + x.ev.species.name + ' · ' + x.ev.background.name);
    out.push('AC ' + d.ac + ' · HP ' + d.hp + ' (' + d.hitDice + ') · Init ' + sign(d.init) + ' · Speed ' + d.speed + ' ft · PB ' + sign(d.pb) + ' · Passive Perception ' + d.passivePerception);
    out.push(D.ABILITIES.map(function (a) { return a.toUpperCase() + ' ' + s.abilities[a] + ' (' + sign(d.mods[a]) + ')'; }).join(' · '));
    out.push('Saves: ' + D.ABILITIES.map(function (a) { return a.toUpperCase() + ' ' + sign(d.saves[a].total) + (d.saves[a].prof ? '*' : ''); }).join(', '));
    out.push('Skills: ' + Object.keys(D.SKILLS).filter(function (k) { return d.skills[k].level; }).map(function (k) { return D.SKILLS[k].name + ' ' + sign(d.skills[k].total) + (d.skills[k].level === 2 ? ' (expertise)' : ''); }).join(', '));
    if (d.attacks.length) out.push('Attacks: ' + d.attacks.map(function (a) { return a.name + ' ' + sign(a.hit) + ', ' + a.dmg + (a.mastery ? ' [' + a.mastery + ']' : ''); }).join('; '));
    if (d.columns.length) out.push('Resources: ' + d.columns.map(function (c) { return c.label + ' ' + c.value; }).join(', '));
    x.casters.forEach(function (c) {
      var e = c.e;
      out.push(e.className + ' spells: DC ' + e.dc + ', attack ' + sign(e.attack) + (e.slots && e.slots.length ? ', slots ' + e.slots.join('/') : '') + (e.pact ? ', pact ' + e.pact.count + '×L' + e.pact.level : ''));
      var cn = c.rep.cantrips.filter(function (y) { return y.ok; }).map(function (y) { return y.name; });
      if (cn.length) out.push('  Cantrips: ' + cn.join(', '));
      var pr = c.rep.prepared.filter(function (y) { return y.ok; }).map(function (y) { return y.name; });
      if (pr.length) out.push('  Prepared: ' + pr.join(', '));
    });
    if (s.feats.length) out.push('Feats: ' + s.feats.map(function (f) { return f.name; }).join(', '));
    out.push('Features: ' + x.features.map(function (f) { return f.name + (f.chosen.length ? ' (' + f.chosen.join(', ') + ')' : ''); }).join('; '));
    if ((x.build.inventory || []).length) out.push('Equipment: ' + x.build.inventory.map(function (e) { var it = D.item && D.item(e.id); return (it ? it.name : e.name) + (e.qty > 1 ? ' ×' + e.qty : ''); }).join(', '));
    if ((x.build.companions || []).length) out.push('Companions: ' + x.build.companions.map(function (c) { var m = D.monster && D.monster(c.id); return (c.nick || (m ? m.name : c.id)) + (c.role ? ' (' + c.role + ')' : ''); }).join(', '));
    return out.join('\n');
  }

  D.printSheet = { html: renderSheetHtml, text: renderSheetText };
})();
