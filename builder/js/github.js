/*
 * Import compendium XML straight from a GitHub repository: a repo (choose one of
 * its collections), a folder, or a single collection/compendium file. Collection
 * and source index files are followed to the compendium files they list.
 */
(function (G) {
  var DND = G.DND = G.DND || {};
  var RAW = 'https://raw.githubusercontent.com/', API = 'https://api.github.com/repos/';

  // Collections in FightClub5eXML, used when the GitHub API can't list the repo (rate limit).
  var FC5_COLLECTIONS = ['Complete_Compendium_5.5e', 'Complete_Compendium_5e+5.5e', 'Complete_Compendium_5e', 'Core_Rulebooks_5.5e', 'Core_Rulebooks_5e', 'Core_Supplements_5e',
    'System_Reference_Document_5.5e', 'System_Reference_Document_5e', 'WotC_5.5e_only', 'WotC_5.5e+Legacy_5e', 'WotC_5.5e+Legacy_5e_WotC', 'WotC_5.5e+Legacy_5e_WotC_SemiOfficial',
    'WotC_5.5e+Legacy_5e_WotC_SemiOfficial_Partnered', 'WotC_5.5e+Legacy_5e_WotC+UnearthedArcana', 'WotC_5.5e+Legacy_5e+UnearthedArcana', 'WotC_5.5e+Legacy_5e+Homebrew',
    'WotC_5.5e+UnearthedArcana', 'WotC_5.5e+Homebrew', 'WotC_5.5e+Homebrew+UnearthedArcana', 'WotC_5.5e+ThirdParty', 'WotC_5.5e+ThirdParty+UnearthedArcana',
    'WotC_5.5e+ThirdParty+Homebrew', 'WotC_5.5e+ThirdParty+Homebrew+UnearthedArcana', 'WotC_5.5e+ThirdParty+Legacy_5e+Homebrew', 'WotC_5.5e+ThirdParty+Legacy_5e+UnearthedArcana',
    'Special_Adventurers_League_Forgotten_Realms_5.5e', 'Special_Adventurers_League_Forgotten_Realms_5e', 'Lord_of_the_Rings_5e', 'Star_Wars_5e']
    .map(function (n) { return 'Collections/' + n + '.xml'; });
  DND.GITHUB_DEFAULT = 'https://github.com/vidalvanbergen/FightClub5eXML';

  // github.com/o/r[/tree|blob/ref/path] or raw.githubusercontent.com/o/r/ref/path
  DND.parseGitHubUrl = function (url) {
    var u = String(url || '').trim().replace(/[?#].*$/, '').replace(/\.git$/, '').replace(/\/+$/, '');
    var m = /^(?:https?:\/\/)?raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i.exec(u);
    if (m) return { owner: m[1], repo: m[2], ref: m[3], path: decodeURIComponent(m[4]), kind: 'file' };
    m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/(tree|blob)\/([^/]+)(?:\/(.*))?)?$/i.exec(u);
    if (!m) m = /^([\w.-]+)\/([\w.-]+)$/.exec(u);
    if (!m) return null;
    var path = m[5] ? decodeURIComponent(m[5]) : '';
    return { owner: m[1], repo: m[2], ref: m[4] || null, path: path, kind: m[3] === 'blob' || /\.xml$/i.test(path) ? 'file' : path ? 'dir' : 'repo' };
  };

  function getJSON(url) {
    return fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? 'GitHub API rate limit reached' : r.status === 404 ? 'Repository not found (it must be public)' : 'GitHub API error ' + r.status);
      return r.json();
    });
  }
  function rawUrl(src, path) { return RAW + src.owner + '/' + src.repo + '/' + (src.ref || 'HEAD') + '/' + path.split('/').map(encodeURIComponent).join('/'); }
  function getText(src, path) {
    return fetch(rawUrl(src, path)).then(function (r) {
      if (!r.ok) throw new Error((r.status === 404 ? 'Not found: ' : 'Download failed (' + r.status + '): ') + path);
      return r.text();
    });
  }
  function dirname(p) { return p.indexOf('/') < 0 ? '' : p.slice(0, p.lastIndexOf('/')); }
  function join(base, rel) {
    var parts = (base ? base.split('/') : []).concat(rel.split('/')), out = [];
    parts.forEach(function (x) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); });
    return out.join('/');
  }
  function isIndex(s) { return /<collection[\s>]/.test(s) && /<doc\s[^>]*href=|xi:include/.test(s) && !/<(class|race|spell|item|monster|feat|background)>/.test(s); }
  function hrefs(s) {
    var out = [], re = /<(?:xi:include|doc)\b[^>]*\bhref="([^"]+)"/g, m;
    while ((m = re.exec(s))) out.push(m[1].replace(/&amp;/g, '&'));
    return out;
  }

  // List what can be imported from a repository: its collections, or every .xml file.
  DND.githubListing = function (url) {
    var src = DND.parseGitHubUrl(url);
    if (!src) return Promise.reject(new Error('That isn\'t a GitHub link. Use https://github.com/owner/repository.'));
    if (src.kind === 'file') return Promise.resolve({ src: src, collections: [src.path], direct: true });
    var refP = src.ref ? Promise.resolve(src.ref) : getJSON(API + src.owner + '/' + src.repo).then(function (r) { return r.default_branch; });
    return refP.then(function (ref) {
      src.ref = ref;
      return getJSON(API + src.owner + '/' + src.repo + '/git/trees/' + encodeURIComponent(ref) + '?recursive=1');
    }).then(function (tree) {
      var under = src.path ? src.path + '/' : '';
      var xml = tree.tree.filter(function (t) { return t.type === 'blob' && /\.xml$/i.test(t.path) && t.path.indexOf(under) === 0; }).map(function (t) { return t.path; });
      if (!xml.length) throw new Error('No .xml files found in ' + (src.path || src.repo) + '.');
      var cols = xml.filter(function (p) { return /(^|\/)Collections\/[^/]+\.xml$/i.test(p); });
      return { src: src, collections: cols, files: xml, truncated: tree.truncated };
    }, function (err) {
      // Without the API (rate limit), FightClub5eXML's collections are still known. No network at all is an error.
      if (src.kind === 'repo' && /^fightclub5exml$/i.test(src.repo) && !(err instanceof TypeError)) return { src: src, collections: FC5_COLLECTIONS, files: null, offline: err.message };
      throw err;
    });
  };

  // Download and parse everything a collection (or a list of files) points to.
  // Returns { data, names, indexFiles } for DND.finishImport.
  DND.githubFetch = function (src, start, progress) {
    var data = DND.FC5.emptyData(), names = [], indexFiles = [], seen = {}, queue = [].concat(start), active = 0, done = 0, failed = [];
    return new Promise(function (resolve, reject) {
      function next() {
        if (!queue.length && !active) {
          if (!names.length && failed.length) return reject(new Error(failed[0]));
          return resolve({ data: data, names: names, indexFiles: indexFiles, failed: failed });
        }
        while (active < 6 && queue.length) {
          var path = queue.shift();
          if (seen[path]) continue;
          seen[path] = true; active++;
          getText(src, path).then((function (p) {
            return function (s) {
              if (isIndex(s)) { indexFiles.push(p); hrefs(s).forEach(function (h) { if (/\.xml$/i.test(h)) queue.push(join(dirname(p), h)); }); }
              else { DND.FC5.parse(s, data); names.push(p.split('/').pop()); }
            };
          })(path), (function (p) { return function (e) { failed.push(e.message || p); }; })(path)).then(function () {
            active--; done++;
            progress && progress('Downloaded ' + done + ' of ' + (done + active + queue.length) + ' files from GitHub…');
            next();
          });
        }
      }
      next();
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
