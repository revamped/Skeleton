/*
 * Fight Club 5 / Game Master 5 compendium XML reader.
 * Parses the XML with a small dependency-free tokenizer (works in browsers and Node)
 * and normalizes classes, races, backgrounds, feats, spells, items and monsters.
 */
(function (G) {
  var DND = G.DND = G.DND || {};

  /* ---------- Minimal XML parser ---------- */

  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function decode(s) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, function (m, e) {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENT[e] !== undefined ? ENT[e] : m;
    });
  }

  function parseXML(str) {
    var root = { tag: '#root', attrs: {}, kids: [], text: '' };
    var stack = [root], cur = root;
    var re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s>\/]+)((?:\s+[^\s=>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
    var attrRe = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    var m;
    while ((m = re.exec(str))) {
      if (m[6] !== undefined) { cur.text += decode(m[6]); continue; }
      if (m[1] !== undefined) { cur.text += m[1]; continue; }
      if (m[2] !== undefined) {
        if (stack.length > 1) { stack.pop(); cur = stack[stack.length - 1]; }
        continue;
      }
      if (m[3] !== undefined) {
        var el = { tag: m[3], attrs: {}, kids: [], text: '' };
        if (m[4]) { var a; attrRe.lastIndex = 0; while ((a = attrRe.exec(m[4]))) el.attrs[a[1]] = decode(a[2] !== undefined ? a[2] : a[3]); }
        cur.kids.push(el);
        if (!m[5]) { stack.push(el); cur = el; }
      }
    }
    return root;
  }

  function kids(el, tag) { return el.kids.filter(function (k) { return k.tag === tag; }); }
  function t(el, tag) { var k = kids(el, tag)[0]; return k ? k.text.trim() : ''; }
  function all(el, tag) { return kids(el, tag).map(function (k) { return k.text.trim(); }); }

  /* ---------- Normalization ---------- */

  var TAG55 = /\s*\[5\.5e\]/g;
  function cleanName(n) { return n.replace(TAG55, '').replace(/\s+/g, ' ').trim(); }
  function edition(name, text) {
    if (/\[5\.5e\]/.test(name)) return '2024';
    if (/System Reference Document v5\.2|2024/.test(text || '')) return '2024';
    return '2014';
  }
  // Split body text and its trailing "Source:" line(s).
  function splitSource(text) {
    var i = text.search(/\n?\s*Source:\s/);
    if (i < 0) return { text: text.trim(), src: '' };
    var src = text.slice(i).replace(/^\s*Source:\s*/, '').split('\n')[0].replace(/\s*p\.\s*\d+.*$/, '').replace(/,\s*$/, '').trim();
    return { text: text.slice(0, i).trim(), src: src };
  }
  function textOf(el) {
    var parts = kids(el, 'text').map(function (k) { return k.text.replace(/^\n+/, ''); });
    return parts.join('\n').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
  }
  function entries(el, tag) {
    return kids(el, tag).map(function (k) {
      var sp = splitSource(textOf(k));
      var o = { name: cleanName(t(k, 'name')), text: sp.text };
      if (k.attrs.category) o.cat = k.attrs.category;
      var atk = all(k, 'attack');
      if (atk.length) o.attack = atk;
      return o;
    });
  }
  function mods(el) {
    return kids(el, 'modifier').map(function (m) { return { cat: (m.attrs.category || '').toLowerCase(), text: m.text.trim() }; });
  }

  function normClass(el) {
    var auto = kids(el, 'autolevel').map(function (a) {
      var slots = kids(a, 'slots')[0];
      return {
        lv: +a.attrs.level,
        asi: a.attrs.scoreImprovement === 'YES',
        slots: slots ? slots.text.split(',').map(function (x) { return +x.trim() || 0; }) : null,
        slotsOpt: slots ? slots.attrs.optional === 'YES' : false,
        known: t(a, 'spellsknown') ? +t(a, 'spellsknown') : null,
        features: kids(a, 'feature').map(function (f) {
          var sp = splitSource(textOf(f));
          return { name: t(f, 'name'), text: sp.text, src: sp.src, opt: f.attrs.optional === 'YES' };
        }),
        counters: kids(a, 'counter').map(function (c) { return { name: t(c, 'name'), value: +t(c, 'value') || 0, reset: t(c, 'reset') }; })
      };
    });
    var raw = t(el, 'name');
    var firstText = '';
    auto.some(function (a) { return a.features.some(function (f) { if (f.src) { firstText = f.src; return true; } return false; }); });
    return {
      name: cleanName(raw), ed: edition(raw, firstText), src: firstText,
      hd: +t(el, 'hd') || 8, prof: t(el, 'proficiency'), numSkills: +t(el, 'numSkills') || 0,
      armor: t(el, 'armor'), weapons: t(el, 'weapons'), tools: t(el, 'tools'), spellAbility: t(el, 'spellAbility'),
      subclass: t(el, 'subclass'), auto: auto
    };
  }

  function normRace(el) {
    var raw = t(el, 'name'), traits = entries(el, 'trait');
    var src = '';
    kids(el, 'trait').some(function (k) { var s = splitSource(textOf(k)).src; if (s) { src = s; return true; } return false; });
    return {
      name: cleanName(raw), ed: edition(raw, src), src: src,
      size: t(el, 'size'), speed: +t(el, 'speed') || 30, ability: t(el, 'ability'), prof: t(el, 'proficiency'),
      spellAbility: t(el, 'spellAbility'), traits: traits, mods: mods(el)
    };
  }

  function normBackground(el) {
    var raw = t(el, 'name'), src = '';
    kids(el, 'trait').some(function (k) { var s = splitSource(textOf(k)).src; if (s) { src = s; return true; } return false; });
    return { name: cleanName(raw), ed: edition(raw, src), src: src, prof: t(el, 'proficiency'), traits: entries(el, 'trait'), mods: mods(el) };
  }

  function normFeat(el) {
    var raw = t(el, 'name'), sp = splitSource(textOf(el));
    return { name: cleanName(raw), ed: edition(raw, sp.src), src: sp.src, prereq: t(el, 'prerequisite'), text: sp.text, mods: mods(el) };
  }

  function normSpell(el) {
    var raw = t(el, 'name'), sp = splitSource(textOf(el));
    return {
      name: cleanName(raw), ed: edition(raw, sp.src), src: sp.src,
      level: t(el, 'level') === '' ? null : +t(el, 'level') || 0, school: t(el, 'school'), ritual: t(el, 'ritual') === 'YES',
      time: t(el, 'time'), range: t(el, 'range'), comp: t(el, 'components'), dur: t(el, 'duration'),
      classes: t(el, 'classes').split(/,\s*/).map(function (c) { return c.trim(); }).filter(function (c) { return c && !/^School:/.test(c); }),
      text: sp.text
    };
  }

  function normItem(el) {
    var raw = t(el, 'name'), sp = splitSource(textOf(el));
    var o = {
      name: cleanName(raw), ed: edition(raw, sp.src), src: sp.src,
      type: t(el, 'type'), detail: t(el, 'detail'), magic: t(el, 'magic') === 'YES',
      weight: parseFloat(t(el, 'weight')) || 0, value: parseFloat(t(el, 'value')) || 0,
      prop: t(el, 'property').replace(/\s+/g, ''), text: sp.text, mods: mods(el)
    };
    ['dmg1', 'dmg2', 'dmgType', 'range', 'ac', 'strength', 'stealth'].forEach(function (k) { var v = t(el, k); if (v) o[k] = v; });
    return o;
  }

  function normMonster(el) {
    var raw = t(el, 'name');
    var desc = t(el, 'description');
    var srcM = /Source:\s*([^\n,]+)/.exec(desc);
    var src = srcM ? srcM[1].replace(/\s*p\.\s*\d+.*$/, '').trim() : '';
    var o = {
      name: cleanName(raw), ed: edition(raw, src), src: src,
      size: t(el, 'size'), type: t(el, 'type'), align: t(el, 'alignment'), ac: t(el, 'ac'), hp: t(el, 'hp'), speed: t(el, 'speed'),
      str: +t(el, 'str') || 10, dex: +t(el, 'dex') || 10, con: +t(el, 'con') || 10, int: +t(el, 'int') || 10, wis: +t(el, 'wis') || 10, cha: +t(el, 'cha') || 10,
      save: t(el, 'save'), skill: t(el, 'skill'), senses: t(el, 'senses'), passive: t(el, 'passive'), languages: t(el, 'languages'), cr: t(el, 'cr'),
      resist: t(el, 'resist'), immune: t(el, 'immune'), vulnerable: t(el, 'vulnerable'), condImmune: t(el, 'conditionImmune'),
      spells: t(el, 'spells'), env: t(el, 'environment')
    };
    ['trait', 'action', 'bonus', 'reaction', 'legendary', 'mythic', 'lair'].forEach(function (k) {
      var list = entries(el, k);
      if (list.length) o[k] = list;
    });
    var d = desc.replace(/Source:[\s\S]*$/, '').trim();
    if (d) o.desc = d;
    return o;
  }

  var NORMALIZERS = { 'class': normClass, race: normRace, background: normBackground, feat: normFeat, spell: normSpell, item: normItem, monster: normMonster };
  var BUCKET = { 'class': 'classes', race: 'races', background: 'backgrounds', feat: 'feats', spell: 'spells', item: 'items', monster: 'monsters' };

  function emptyData() { return { classes: [], races: [], backgrounds: [], feats: [], spells: [], items: [], monsters: [] }; }

  // Parse one compendium XML string into normalized data (merging same-named classes).
  function parse(str, into) {
    var data = into || emptyData();
    var root = parseXML(str);
    var top = root.kids.filter(function (k) { return k.tag === 'compendium' || k.tag === 'collection'; })[0] || root;
    top.kids.forEach(function (el) {
      var norm = NORMALIZERS[el.tag];
      if (!norm) return;
      var o = norm(el);
      if (!o.name) return;
      if (el.tag === 'class') {
        var same = data.classes.filter(function (c) { return c.name === o.name && c.ed === o.ed; })[0];
        if (same) {
          same.auto = same.auto.concat(o.auto);
          ['prof', 'armor', 'weapons', 'tools', 'spellAbility', 'subclass', 'src'].forEach(function (k) { if (!same[k] && o[k]) same[k] = o[k]; });
          if (o.numSkills && !same.numSkills) same.numSkills = o.numSkills;
          return;
        }
      }
      data[BUCKET[el.tag]].push(o);
    });
    return data;
  }

  // Remove duplicates (same name, edition and kind). Spells are merged instead, because
  // class files carry stub spell entries that only add class/subclass tags.
  function dedupe(data) {
    Object.keys(data).forEach(function (k) {
      if (k === 'classes') return;
      var seen = {};
      data[k] = data[k].filter(function (o) {
        var key = o.name + '|' + o.ed, first = seen[key];
        if (!first) { seen[key] = o; return true; }
        if (k === 'spells') {
          o.classes.forEach(function (c) { if (first.classes.indexOf(c) < 0) first.classes.push(c); });
          Object.keys(o).forEach(function (f) { if ((first[f] === null || first[f] === '') && o[f] !== null && o[f] !== '') first[f] = o[f]; });
        }
        return false;
      });
    });
    if (data.spells) data.spells = data.spells.filter(function (sp) { return sp.level !== null || sp.text; });
    return data;
  }

  DND.FC5 = { parseXML: parseXML, parse: parse, dedupe: dedupe, emptyData: emptyData, cleanName: cleanName };
})(typeof window !== 'undefined' ? window : globalThis);
