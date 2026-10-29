/*!
 * slot-renderer.js — reference implementation of the MOF slide template contract.
 *
 * One file, no dependencies. Runs unchanged in:
 *   - n8n Code nodes (paste the file body above your code), and
 *   - the browser (exposes window.SlotRenderer) for frontend re-rendering.
 *
 * Public API
 *   validateContent(content, manifest)            -> { content, errors[], warnings[] }
 *   renderSlide(slide, template)                  -> HTML string for one <section>
 *   renderDeck(spec, templatesById, shellHtml)    -> full HTML document
 *   getPath(obj, path) / setPath(obj, path, val)  -> helpers for data-path edits
 *
 * Template contract (short form — the handoff doc has the full rules)
 *   data-slot="name"        element whose content is replaced by slot "name"
 *   data-slot-list="name"   container of a repeated list slot
 *   data-slot-item          the prototype item inside a list container (exactly one)
 * The renderer stamps data-path="…" on every filled element so the frontend can map
 * any clicked element back to slide.content.
 */
(function (root) {
  'use strict';

  /* ---------------- tiny HTML parser (for well-formed template fragments) ---------------- */
  var VOID = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1, meta:1, source:1, track:1, wbr:1 };
  var RAW = { style:1, script:1 };
  var TAG = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
  var ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  function parseAttrs(s) {
    var out = [], m; ATTR.lastIndex = 0;
    while ((m = ATTR.exec(s || ''))) out.push([m[1].toLowerCase(), m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : null]);
    return out;
  }
  function parse(html) {
    var rootNode = { type: 'root', children: [] }, stack = [rootNode], last = 0, m;
    var top = function () { return stack[stack.length - 1]; };
    TAG.lastIndex = 0;
    while ((m = TAG.exec(html))) {
      if (m.index > last) top().children.push({ type: 'raw', raw: html.slice(last, m.index) });
      last = TAG.lastIndex;
      if (m[1]) {                                   // closing tag: pop to the matching element
        var n = m[1].toLowerCase();
        for (var k = stack.length - 1; k > 0; k--) if (stack[k].name === n) { stack.length = k; break; }
        continue;
      }
      if (!m[2]) { top().children.push({ type: 'raw', raw: m[0] }); continue; }  // comment / doctype
      var el = { type: 'el', name: m[2].toLowerCase(), attrs: parseAttrs(m[3]), children: [] };
      top().children.push(el);
      if (VOID[el.name] || m[4]) continue;
      if (RAW[el.name]) {                           // <style>/<script>: keep body verbatim
        var end = html.toLowerCase().indexOf('</' + el.name, last);
        if (end < 0) end = html.length;
        el.children.push({ type: 'raw', raw: html.slice(last, end) });
        var close = html.indexOf('>', end);
        last = TAG.lastIndex = close < 0 ? html.length : close + 1;
        continue;
      }
      stack.push(el);
    }
    if (last < html.length) top().children.push({ type: 'raw', raw: html.slice(last) });
    return rootNode;
  }
  function serialize(node) {
    if (node.type === 'raw') return node.raw;
    if (node.type === 'root') return node.children.map(serialize).join('');
    var a = node.attrs.map(function (p) { return p[1] == null ? ' ' + p[0] : ' ' + p[0] + '="' + escAttr(p[1]) + '"'; }).join('');
    if (VOID[node.name]) return '<' + node.name + a + '>';
    return '<' + node.name + a + '>' + node.children.map(serialize).join('') + '</' + node.name + '>';
  }

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function escAttr(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function text(v) { return { type: 'raw', raw: esc(v) }; }
  function attr(n, k) { for (var i = 0; i < n.attrs.length; i++) if (n.attrs[i][0] === k) return n.attrs[i][1] == null ? '' : n.attrs[i][1]; return null; }
  function setAttr(n, k, v) { for (var i = 0; i < n.attrs.length; i++) if (n.attrs[i][0] === k) { n.attrs[i][1] = v; return; } n.attrs.push([k, v]); }
  function delAttr(n, k) { n.attrs = n.attrs.filter(function (p) { return p[0] !== k; }); }
  function clone(n) { return JSON.parse(JSON.stringify(n)); }
  function join(prefix, key) { return prefix ? prefix + '.' + key : String(key); }
  function isPrimitive(spec) { return spec && typeof spec.type === 'string'; }
  function getPath(o, p) { return String(p).split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = String(p).split('.'), l = ks.pop(), t = ks.reduce(function (a, k) { return a == null ? a : a[k]; }, o); if (t != null) t[l] = v; return o; }
  function fmt(n) { var a = Math.abs(n); return a >= 1e9 ? +(n / 1e9).toFixed(1) + 'B' : a >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : a >= 1e4 ? +(n / 1e3).toFixed(1) + 'K' : String(Math.round(n * 100) / 100); }

  /* ---------------- validation: clip to the manifest, never invent ---------------- */
  function validateContent(content, manifest, counts) {
    if (counts) manifest = effectiveManifest(manifest, counts);
    var errors = [], warnings = [];
    function vText(v, s, p) {
      var t = String(v == null ? '' : v).replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
      if (!t && s.required) errors.push({ path: p, code: 'required', message: p + ' is required' });
      if (t && s.numeric && !/\d/.test(t)) errors.push({ path: p, code: 'not_numeric', message: p + ' must contain a number (it drives the chart)' });
      if (s.max_chars && t.length > s.max_chars) {
        var cut = t.slice(0, s.max_chars - 1), sp = cut.lastIndexOf(' ');
        t = (sp > s.max_chars * 0.6 ? cut.slice(0, sp) : cut) + '…';
        warnings.push({ path: p, code: 'trimmed', message: p + ' trimmed to ' + s.max_chars + ' characters' });
      }
      return t;
    }
    function vList(v, s, p) {
      var a = Array.isArray(v) ? v : [];
      if (s.max != null && a.length > s.max) { warnings.push({ path: p, code: 'clipped', message: p + ' clipped from ' + a.length + ' to ' + s.max + ' items' }); a = a.slice(0, s.max); }
      if (s.min != null && a.length < s.min) errors.push({ path: p, code: 'too_few', message: p + ' needs at least ' + s.min + ' items, got ' + a.length });
      return a.map(function (it, i) { return vAny(it, s.item, join(p, i)); });
    }
    function vTable(v, s, p) {
      v = v || {}; var head = Array.isArray(v.head) ? v.head : [], rows = Array.isArray(v.rows) ? v.rows : [];
      var cols = s.columns || {}, mx = cols.max || 6, mn = cols.min || 1;
      if (head.length > mx) { warnings.push({ path: p + '.head', code: 'clipped', message: 'table clipped to ' + mx + ' columns' }); head = head.slice(0, mx); }
      if (head.length < mn) errors.push({ path: p + '.head', code: 'too_few', message: 'table needs at least ' + mn + ' columns' });
      if (s.max_rows != null && rows.length > s.max_rows) { warnings.push({ path: p + '.rows', code: 'clipped', message: 'table clipped to ' + s.max_rows + ' rows' }); rows = rows.slice(0, s.max_rows); }
      if (s.min_rows != null && rows.length < s.min_rows) errors.push({ path: p + '.rows', code: 'too_few', message: 'table needs at least ' + s.min_rows + ' rows' });
      var cell = { type: 'text', max_chars: s.max_cell_chars || 40 };
      return {
        head: head.map(function (h, j) { return vText(h, { type: 'text', max_chars: s.max_head_chars || cell.max_chars }, p + '.head.' + j); }),
        rows: rows.map(function (r, i) { r = Array.isArray(r) ? r : []; return head.map(function (_, j) { return vText(r[j], cell, p + '.rows.' + i + '.' + j); }); })
      };
    }
    function vChart(v, s, p) {
      v = v || {}; var types = s.chart_types || ['bar'], type = types.indexOf(v.type) >= 0 ? v.type : types[0];
      if (v.type && v.type !== type) warnings.push({ path: p + '.type', code: 'locked', message: 'chart type "' + v.type + '" not allowed here; used ' + type });
      var labels = (Array.isArray(v.labels) ? v.labels : []).slice(0, s.max_labels || 8).map(function (l, i) { return vText(l, { type: 'text', max_chars: s.max_label_chars || 16 }, p + '.labels.' + i); });
      var series = (Array.isArray(v.series) ? v.series : []).slice(0, type === 'pie' ? 1 : (s.max_series || 3)).map(function (sr, k) {
        sr = sr || {}; var d = (Array.isArray(sr.data) ? sr.data : []).slice(0, labels.length).map(Number);
        if (d.some(function (x) { return !isFinite(x); })) errors.push({ path: p + '.series.' + k, code: 'not_numeric', message: 'chart series ' + k + ' has non-numeric values' });
        while (d.length < labels.length) d.push(0);
        return { name: vText(sr.name, { type: 'text', max_chars: 24 }, p + '.series.' + k + '.name'), data: d };
      });
      if (labels.length < (s.min_labels || 2)) errors.push({ path: p + '.labels', code: 'too_few', message: 'chart needs at least ' + (s.min_labels || 2) + ' labels' });
      if (!series.length) errors.push({ path: p + '.series', code: 'too_few', message: 'chart needs at least one series' });
      return { type: type, labels: labels, series: series };
    }
    function vImage(v, s, p) {
      v = v || {}; var src = String(v.src || '');
      if (src && !/^(data:image\/(png|jpe?g|gif|webp|svg\+xml);|https:\/\/)/i.test(src)) { warnings.push({ path: p, code: 'bad_src', message: 'image source rejected' }); src = ''; }
      if (!src && s.required) errors.push({ path: p, code: 'required', message: p + ' is required' });
      return { src: src, alt: vText(v.alt, { type: 'text', max_chars: 140 }, p + '.alt') };
    }
    function vAny(v, s, p) {
      if (!isPrimitive(s)) { var o = {}; v = v || {}; Object.keys(s).forEach(function (k) { o[k] = vAny(v[k], s[k], join(p, k)); }); return o; }
      switch (s.type) {
        case 'text': return vText(v, s, p);
        case 'list': return vList(v, s, p);
        case 'table': return vTable(v, s, p);
        case 'chart': return vChart(v, s, p);
        case 'image': return vImage(v, s, p);
        default: warnings.push({ path: p, code: 'unknown_type', message: 'unknown slot type ' + s.type }); return v;
      }
    }
    var out = vAny(content || {}, manifest.slots, '');
    Object.keys(content || {}).forEach(function (k) { if (!manifest.slots[k]) warnings.push({ path: k, code: 'unknown_slot', message: 'dropped unknown slot "' + k + '"' }); });
    return { content: out, errors: errors, warnings: warnings };
  }

  /* ---------------- chart SVG (colours come from the theme's CSS variables) ---------------- */
  function chartSVG(c) {
    var W = 800, H = 330, labels = c.labels || [], series = c.series || [];
    var col = function (i) { return 'fill:var(--chart-' + (i % 6 + 1) + ')'; };
    var o = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escAttr(c.type + ' chart') + '" style="width:100%;height:100%;font-family:var(--f-body);fill:currentColor" font-size="13">';
    if (!labels.length || !series.length) return o + '</svg>';
    if (c.type === 'pie') {
      var d = series[0].data.map(function (v) { return Math.max(0, v); }), tot = d.reduce(function (a, b) { return a + b; }, 0) || 1, cx = 165, cy = 165, r = 145, a0 = -Math.PI / 2;
      d.forEach(function (v, i) {
        var f = v / tot, a1 = a0 + f * 2 * Math.PI;
        if (f >= 0.9999) o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" style="' + col(i) + '"/>';
        else if (f > 0) o += '<path d="M' + cx + ' ' + cy + 'L' + (cx + r * Math.cos(a0)).toFixed(1) + ' ' + (cy + r * Math.sin(a0)).toFixed(1) + 'A' + r + ' ' + r + ' 0 ' + (f > 0.5 ? 1 : 0) + ' 1 ' + (cx + r * Math.cos(a1)).toFixed(1) + ' ' + (cy + r * Math.sin(a1)).toFixed(1) + 'Z" style="' + col(i) + ';stroke:var(--c-bg);stroke-width:2"/>';
        o += '<rect x="360" y="' + (40 + i * 32) + '" width="14" height="14" style="' + col(i) + '"/><text x="384" y="' + (52 + i * 32) + '" font-size="16">' + esc(labels[i] || '') + ' · ' + Math.round(f * 100) + '%</text>';
        a0 = a1;
      });
      return o + '</svg>';
    }
    var vals = []; series.forEach(function (s) { vals = vals.concat(s.data); });
    var mx = Math.max.apply(null, vals.concat([0])), mn = Math.min.apply(null, vals.concat([0])); if (mx === mn) mx = mn + 1;
    var p = Math.pow(10, Math.floor(Math.log10(mx - mn))), step = Math.ceil((mx - mn) / 4 / p * 2) / 2 * p; mx = Math.ceil(mx / step) * step; mn = Math.floor(mn / step) * step;
    var x0 = 60, y0 = 26, pw = W - x0 - 16, ph = H - y0 - (series.length > 1 ? 62 : 36), Y = function (v) { return y0 + ph * (1 - (v - mn) / (mx - mn)); }, bw = pw / labels.length;
    for (var t = mn; t <= mx + 1e-9; t += step) o += '<line x1="' + x0 + '" x2="' + (x0 + pw) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" style="stroke:currentColor;stroke-opacity:' + (Math.abs(t) < 1e-9 ? 0.5 : 0.12) + '"/><text x="' + (x0 - 8) + '" y="' + (Y(t) + 4).toFixed(1) + '" text-anchor="end" opacity=".7">' + fmt(t) + '</text>';
    labels.forEach(function (l, i) { o += '<text x="' + (x0 + bw * (i + 0.5)).toFixed(1) + '" y="' + (y0 + ph + 20) + '" text-anchor="middle" opacity=".85">' + esc(l) + '</text>'; });
    series.forEach(function (s, k) {
      if (c.type === 'line') {
        var pts = s.data.map(function (v, i) { return (x0 + bw * (i + 0.5)).toFixed(1) + ',' + Y(v).toFixed(1); });
        o += '<polyline points="' + pts.join(' ') + '" style="fill:none;stroke:var(--chart-' + (k % 6 + 1) + ');stroke-width:3"/>';
        pts.forEach(function (q) { var xy = q.split(','); o += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="4.5" style="' + col(k) + '"/>'; });
      } else {
        var g = bw * 0.7 / series.length;
        s.data.forEach(function (v, i) {
          var ya = Y(Math.max(v, 0)), yb = Y(Math.min(v, 0)), x = x0 + bw * i + bw * 0.15 + g * k;
          o += '<rect x="' + x.toFixed(1) + '" y="' + ya.toFixed(1) + '" width="' + Math.max(2, g - 3).toFixed(1) + '" height="' + Math.max(1, yb - ya).toFixed(1) + '" style="' + col(k) + '"/>';
          if (series.length === 1 && labels.length <= 8) o += '<text x="' + (x + (g - 3) / 2).toFixed(1) + '" y="' + (ya - 6).toFixed(1) + '" text-anchor="middle" font-weight="600">' + fmt(v) + '</text>';
        });
      }
    });
    if (series.length > 1) { var lx = x0; series.forEach(function (s, k) { o += '<rect x="' + lx + '" y="' + (H - 18) + '" width="12" height="12" style="' + col(k) + '"/><text x="' + (lx + 18) + '" y="' + (H - 7) + '">' + esc(s.name) + '</text>'; lx += 40 + String(s.name).length * 7.5; }); }
    return o + '</svg>';
  }

  /* ---------------- slot filling ---------------- */
  function fillSlot(node, spec, value, path) {
    setAttr(node, 'data-path', path);
    switch (spec.type) {
      case 'text':
        node.children = [text(value)];
        if (!value) setAttr(node, 'data-empty', ''); else delAttr(node, 'data-empty');
        return;
      case 'table': {
        var v = value || { head: [], rows: [] };
        var th = v.head.map(function (h, j) { return { type: 'el', name: 'th', attrs: [['data-path', path + '.head.' + j]], children: [text(h)] }; });
        var trs = v.rows.map(function (r, i) {
          return { type: 'el', name: 'tr', attrs: [], children: r.map(function (c, j) { return { type: 'el', name: 'td', attrs: [['data-path', path + '.rows.' + i + '.' + j]], children: [text(c)] }; }) };
        });
        node.children = [
          { type: 'el', name: 'thead', attrs: [], children: [{ type: 'el', name: 'tr', attrs: [], children: th }] },
          { type: 'el', name: 'tbody', attrs: [], children: trs }
        ];
        return;
      }
      case 'chart':
        setAttr(node, 'data-chart-type', (value && value.type) || '');
        node.children = [{ type: 'raw', raw: chartSVG(value || {}) }];
        return;
      case 'image': {
        var im = value || {};
        if (node.name === 'img') { setAttr(node, 'src', im.src || ''); setAttr(node, 'alt', im.alt || ''); }
        else node.children = im.src ? [{ type: 'el', name: 'img', attrs: [['src', im.src], ['alt', im.alt || '']], children: [] }] : [];
        if (!im.src) setAttr(node, 'data-empty', '');
        return;
      }
      default:
        throw new Error('Slot "' + path + '" has type "' + spec.type + '" which cannot sit on a data-slot element');
    }
  }

  function fill(node, content, slots, prefix) {
    if (node.type !== 'el' && node.type !== 'root') return;
    if (node.type === 'el') {
      var listName = attr(node, 'data-slot-list');
      if (listName != null) {
        var ls = slots[listName];
        if (!ls || ls.type !== 'list') throw new Error('data-slot-list="' + listName + '" has no list slot in the manifest');
        var idx = node.children.findIndex(function (c) { return c.type === 'el' && attr(c, 'data-slot-item') != null; });
        if (idx < 0) throw new Error('data-slot-list="' + listName + '" needs exactly one data-slot-item child');
        var proto = node.children[idx], items = Array.isArray(content[listName]) ? content[listName] : [];
        var lp = join(prefix, listName);
        var clones = items.map(function (item, i) {
          var c = clone(proto), ip = join(lp, i);
          delAttr(c, 'data-slot-item'); setAttr(c, 'data-item', String(i));
          if (isPrimitive(ls.item)) fillSlot(c, ls.item, item, ip);
          else { setAttr(c, 'data-path', ip); c.children.forEach(function (ch) { fill(ch, item || {}, ls.item, ip); }); }
          return c;
        });
        var rest = node.children.filter(function (c) { return !(c.type === 'el' && attr(c, 'data-slot-item') != null); });
        var before = node.children.slice(0, idx).filter(function (c) { return rest.indexOf(c) >= 0; }).length;
        node.children = rest.slice(0, before).concat(clones, rest.slice(before));
        setAttr(node, 'data-path', lp);
        return;
      }
      var slotName = attr(node, 'data-slot');
      if (slotName != null) {
        var s = slots[slotName];
        if (!s) throw new Error('data-slot="' + slotName + '" is not declared in the manifest');
        fillSlot(node, s, content[slotName], join(prefix, slotName));
        return;
      }
    }
    node.children.forEach(function (ch) { fill(ch, content, slots, prefix); });
  }

  /* chart geometry follows the values: bar heights/widths, line points and dots, donut segments */
  function num(v) {
    var t = String(v == null ? '' : v).replace(/,/g, ''), m = t.match(/-?\d+(?:\.\d+)?/);
    if (!m) return 0; var n = parseFloat(m[0]), suf = t.slice(m.index + m[0].length).trim().toLowerCase();
    if (/^(k|thousand)/.test(suf)) n *= 1e3; else if (/^(m|mn|million)/.test(suf)) n *= 1e6; else if (/^(b|bn|billion)/.test(suf)) n *= 1e9;
    return n;
  }
  function styleSet(node, prop, value) {
    var st = String(attr(node, 'style') || '').split(';').map(function (x) { return x.trim(); }).filter(function (x) { return x && x.split(':')[0].trim() !== prop; });
    st.push(prop + ':' + value); setAttr(node, 'style', st.join(';'));
  }
  function applyBindings(root, content) {
    var groups = { flex: [], width: [] }, all = [];
    (function w(n) { if (n.type === 'el') all.push(n); (n.children || []).forEach(w); })(root);
    all.forEach(function (n) { if (attr(n, 'data-bind-flex')) groups.flex.push(n); if (attr(n, 'data-bind-width')) groups.width.push(n); });
    ['flex', 'width'].forEach(function (kind) {
      var nodes = groups[kind]; if (!nodes.length) return;
      var raw = nodes.map(function (n) { return String(content[attr(n, 'data-bind-' + kind)] || ''); });
      var vals = raw.map(num), pct = raw.every(function (r) { return /%/.test(r); }) && vals.every(function (v) { return v >= 0 && v <= 100; });
      var max = Math.max.apply(null, vals.map(Math.abs).concat([0])) || 1;
      nodes.forEach(function (n, i) { var p = pct ? vals[i] : Math.abs(vals[i]) / max * 90; p = Math.max(0, Math.min(100, Math.round(p * 10) / 10));
        if (kind === 'flex') styleSet(n, 'flex', '0 0 ' + p + '%'); else styleSet(n, 'width', p + '%'); });
    });
    all.forEach(function (n) {
      var keys = attr(n, 'data-bind-points');
      if (keys) {
        keys = keys.split(','); var xs = String(attr(n, 'data-points-x')).split(',').map(Number), yr = String(attr(n, 'data-points-y')).split(',').map(Number);
        var v = keys.map(function (k) { return num(content[k]); }), lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
        setAttr(n, 'points', keys.map(function (k, i) { var f = hi === lo ? 0.5 : (v[i] - lo) / (hi - lo); return xs[i] + ',' + Math.round(yr[0] - f * (yr[0] - yr[1])); }).join(' '));
      }
      var cy = attr(n, 'data-bind-cy');
      if (cy) {
        var ks = String(attr(n, 'data-points-keys')).split(','), yr2 = String(attr(n, 'data-points-y')).split(',').map(Number);
        var vv = ks.map(function (k) { return num(content[k]); }), lo2 = Math.min.apply(null, vv), hi2 = Math.max.apply(null, vv);
        var f2 = hi2 === lo2 ? 0.5 : (num(content[cy]) - lo2) / (hi2 - lo2); setAttr(n, 'cy', String(Math.round(yr2[0] - f2 * (yr2[0] - yr2[1]))));
      }
      var conic = attr(n, 'data-bind-conic');
      if (conic) {
        var ck = conic.split(','), cols = String(attr(n, 'data-conic-colors')).split('|'), cv = ck.map(function (k) { return Math.max(0, num(content[k])); });
        var tot = cv.reduce(function (a, b) { return a + b; }, 0) || 1, at = 0;
        styleSet(n, 'background', 'conic-gradient(' + cv.map(function (x, i) { var a = at; at += x / tot * 100; return cols[i] + ' ' + (Math.round(a * 10) / 10) + '% ' + (i === cv.length - 1 ? 100 : Math.round(at * 10) / 10) + '%'; }).join(',') + ')');
      }
    });
  }
  function applyLanguage(root, lang) {
    (function w(n) {
      if (n.type === 'el') n.attrs.slice().forEach(function (a) { var m = /^data-ar-(.+)$/.exec(a[0]); if (!m) return; if (lang === 'ar') setAttr(n, m[1], a[1]); delAttr(n, a[0]); });
      (n.children || []).forEach(w);
    })(root);
  }

  /* ---------- variable item counts inside a design ----------
     Nigel's designs number their items (item-1..6, stat-1..4, r1..r4 + col-1..4, column-1..5 …).
     A slide may carry counts: { item: 4 } or { r: 6, col: 3 }. Extra items copy the last item's markup and limits;
     surplus items are removed. Charts redraw from whatever values remain. */
  var GKEY = /^([a-z]+(?:-[a-z]+)*?)(-?)(\d+)_(.+)$/;
  var MIN = { column: 2, bar: 2, point: 2, legend: 2, col: 2 };
  // per design: most items that still fit (measured in a browser with every field at its limit, then capped for readability)
  var CAPS = {"bullets-1":{"item":8},"bullets-2":{"item":8},"bullets-3":{"item":6},"bullets-4":{"item":8},"bullets-5":{"item":6},"chart-1":{"column":8},"chart-2":{"bar":8},"chart-3":{"point":8},"chart-4":{"legend":6},"closing-1":{"action":5},"stats-1":{"stat":6},"stats-2":{"stat":6},"stats-3":{"stat":6},"stats-4":{"stat":6},"stats-5":{"stat":6},"table-1":{"col":6,"r":7},"table-2":{"col":6,"r":7},"table-3":{"col":5,"r":8},"table-4":{"col":6,"r":7},"table-5":{"col":6,"r":7}};
  function parseKey(k) { var m = GKEY.exec(k); return m ? { p: m[1], sep: m[2], i: +m[3], f: m[4] } : null; }
  function mkKey(g, i, f) { return g.p + g.sep + i + '_' + f; }
  function groupsOf(manifest) {
    var out = {}, slots = (manifest && manifest.slots) || {};
    Object.keys(slots).forEach(function (k) { var g = parseKey(k); if (!g || slots[k].llm === false) return;
      var o = out[g.p] || (out[g.p] = { p: g.p, sep: g.sep, n: 0, fields: [] }); if (g.i > o.n) o.n = g.i; if (o.fields.indexOf(g.f) < 0) o.fields.push(g.f); });
    // table columns: col-N headers plus cN fields in every row
    if (out.col && out.r) out.col.cells = true;
    return out;
  }
  function countBounds(manifest, templateId) {
    var g = groupsOf(manifest), caps = CAPS[String(templateId || '').split('@')[0]] || {}, own = (manifest && manifest.counts) || {}, out = {};
    Object.keys(g).forEach(function (p) { var o = own[p] || {}; out[p] = { base: g[p].n, min: o.min != null ? o.min : Math.min(g[p].n, MIN[p] || 1), max: Math.max(g[p].n, o.max != null ? o.max : (caps[p] || g[p].n)) }; });
    return out;
  }
  function effectiveManifest(manifest, counts) {
    if (!counts || !Object.keys(counts).length) return manifest;
    var groups = groupsOf(manifest), src = manifest.slots, slots = {};
    var colN = counts.col && groups.col ? counts.col : null, colBase = groups.col ? groups.col.n : 0;
    Object.keys(src).forEach(function (k) {
      var g = parseKey(k), gi = g && groups[g.p];
      if (!gi) { slots[k] = src[k]; return; }
      var n = counts[g.p] || gi.n;
      if (g.i > n) return;
      if (colN && g.p === 'r' && /^c(\d+)$/.test(g.f) && +g.f.slice(1) > colN) return;
      slots[k] = src[k];
    });
    Object.keys(groups).forEach(function (p) {
      var gi = groups[p], n = counts[p] || gi.n;
      for (var i = gi.n + 1; i <= n; i++) gi.fields.forEach(function (f) {
        if (colN && p === 'r' && /^c(\d+)$/.test(f) && +f.slice(1) > colN) return;
        var from = src[mkKey(gi, gi.n, f)]; if (from) slots[mkKey(gi, i, f)] = from; });
    });
    if (colN && groups.r && colN > colBase) for (var r = 1; r <= (counts.r || groups.r.n); r++) for (var c = colBase + 1; c <= colN; c++) {
      var from = src[mkKey(groups.r, Math.min(r, groups.r.n), 'c' + colBase)]; if (from) slots[mkKey(groups.r, r, 'c' + c)] = from; }
    var out = {}; Object.keys(manifest).forEach(function (k) { out[k] = manifest[k]; }); out.slots = slots; return out;
  }
  function applyCounts(root, manifest, counts) {
    if (!counts || !Object.keys(counts).length) return;
    var groups = groupsOf(manifest);
    var parents = new Map(), els = [];
    var reindex = function () { parents = new Map(); els = []; (function w(n, p) { if (p) parents.set(n, p); if (n.type === 'el') els.push(n); (n.children || []).forEach(function (c) { w(c, n); }); })(root, null); };
    reindex();
    var slotsUnder = function (n) { var out = []; (function w(x) { if (x.type === 'el') { var k = attr(x, 'data-slot'); if (k) out.push(k); } (x.children || []).forEach(w); })(n); return out; };
    var containerFor = function (keySet) {
      var nodes = els.filter(function (e) { return keySet.indexOf(attr(e, 'data-slot')) >= 0; }); if (!nodes.length) return null;
      var chain = function (n) { var a = []; while (n) { a.unshift(n); n = parents.get(n); } return a; };
      var ch = nodes.map(chain), lca = null;
      for (var d = 0; ; d++) { var x = ch[0][d]; if (!x || ch.some(function (c) { return c[d] !== x; })) break; lca = x; }
      while (lca && parents.get(lca) && attr(lca, 'data-slide-id') == null && lca.name !== 'section') {
        var up = parents.get(lca); if (up.name === 'section' || slotsUnder(up).some(function (k) { return keySet.indexOf(k) < 0; })) break; lca = up; }
      return lca;
    };
    var renameIn = function (node, fn) {
      (function w(x) { if (x.type === 'el') x.attrs.forEach(function (a) {
        if (/^data-(slot|bind-flex|bind-width|bind-cy)$/.test(a[0]) && a[1]) a[1] = fn(a[1]); }); (x.children || []).forEach(w); })(node); };
    var insertAfter = function (ref, node) { var par = parents.get(ref), i = par.children.indexOf(ref); par.children.splice(i + 1, 0, node); parents.set(node, par); };
    var remove = function (node) { var par = parents.get(node); if (par) par.children.splice(par.children.indexOf(node), 1); };
    Object.keys(groups).forEach(function (p) {
      var g = groups[p], n = counts[p]; if (!n || n === g.n || p === 'col') return;
      var keysOf = function (i) { return g.fields.map(function (f) { return mkKey(g, i, f); }); };
      if (n < g.n) for (var i = g.n; i > n; i--) { var c = containerFor(keysOf(i)); if (c) remove(c); }
      else { var last = containerFor(keysOf(g.n));
        if (last) for (var j = g.n + 1, prev = last; j <= n; j++) { var cl = clone(last);
          renameIn(cl, function (v) { var k = parseKey(v); return k && k.p === p && k.i === g.n ? mkKey(k, j, k.f) : v; }); insertAfter(prev, cl); prev = cl; } }
      reindex();          // later steps (table columns, charts) must see the rows/items just added or removed
    });
    // table columns: header cell + that column's cell in every row
    if (groups.col && counts.col && counts.col !== groups.col.n) {
      var g = groups.col, n = counts.col, rows = counts.r || (groups.r ? groups.r.n : 0);
      var cellOf = function (r, c) { return containerFor([mkKey(groups.r, r, 'c' + c)]); };
      if (n < g.n) for (var i = g.n; i > n; i--) { var h = containerFor([mkKey(g, i, 'header')]); if (h) remove(h); for (var r = 1; r <= rows; r++) { var cc = cellOf(r, i); if (cc) remove(cc); } }
      else for (var j = g.n + 1; j <= n; j++) {
        var lh = containerFor([mkKey(g, j - 1, 'header')]); if (lh) { var nh = clone(lh); renameIn(nh, function (v) { var k = parseKey(v); return k && k.p === 'col' ? mkKey(k, j, k.f) : v; }); insertAfter(lh, nh); (function w(x) { if (x.type === 'el') els.push(x); (x.children || []).forEach(w); })(nh); }
        for (var r2 = 1; r2 <= rows; r2++) { var lc = cellOf(r2, j - 1); if (!lc) continue; var nc = clone(lc);
          renameIn(nc, function (v) { var k = parseKey(v); return k && k.p === 'r' && k.f === 'c' + (j - 1) ? mkKey(k, k.i, 'c' + j) : v; }); insertAfter(lc, nc); (function w(x) { if (x.type === 'el') els.push(x); (x.children || []).forEach(w); })(nc); }
        (function w(x, par) { if (par) parents.set(x, par); (x.children || []).forEach(function (c) { w(c, x); }); })(root, null);
      }
      // the design's rows are grids sized for its own column count: resize every row (header + data rows) to match
      var rowEls = [], hdr = containerFor([mkKey(g, 1, 'header')]); if (hdr && parents.get(hdr)) rowEls.push(parents.get(hdr));
      for (var r3 = 1; r3 <= rows; r3++) { var rc = containerFor(groups.r.fields.filter(function (f) { return !/^c\d+$/.test(f) || +f.slice(1) <= n; }).map(function (f) { return mkKey(groups.r, r3, f); })); if (rc) rowEls.push(rc); }
      rowEls.forEach(function (el) { styleSet(el, 'grid-template-columns', 'minmax(0,1.4fr) repeat(' + (n - 1) + ',minmax(0,1fr))'); });
    }
    // line chart: points and dots follow the new number of values
    var all = []; (function w(x) { if (x.type === 'el') all.push(x); (x.children || []).forEach(w); })(root);
    all.forEach(function (x) {
      var pts = attr(x, 'data-bind-points'); if (!pts) return;
      var k0 = parseKey(pts.split(',')[0]); if (!k0 || !counts[k0.p]) return;
      var n = counts[k0.p], keys = []; for (var i = 1; i <= n; i++) keys.push(mkKey(k0, i, k0.f));
      var xs = String(attr(x, 'data-points-x')).split(',').map(Number), x0 = xs[0], x1 = xs[xs.length - 1];
      setAttr(x, 'data-bind-points', keys.join(',')); setAttr(x, 'data-points-x', keys.map(function (_, i) { return Math.round(x0 + (n === 1 ? 0 : i * (x1 - x0) / (n - 1))); }).join(','));
      var dots = all.filter(function (d) { return attr(d, 'data-bind-cy'); });
      dots.forEach(function (d) { var k = parseKey(attr(d, 'data-bind-cy')); if (k && k.i > n) remove(d); });
      var lastDot = dots.filter(function (d) { var k = parseKey(attr(d, 'data-bind-cy')); return k && k.i <= n; }).pop();
      for (var j = dots.length + 1; lastDot && j <= n; j++) { var nd = clone(lastDot); setAttr(nd, 'data-bind-cy', mkKey(k0, j, k0.f)); insertAfter(lastDot, nd); lastDot = nd; }
      var xs2 = String(attr(x, 'data-points-x')).split(','), kept = 0;
      all.concat([]).forEach(function () {});
      (function w(y) { if (y.type === 'el' && attr(y, 'data-bind-cy')) { var k = parseKey(attr(y, 'data-bind-cy')); setAttr(y, 'data-points-keys', keys.join(',')); if (k && xs2[k.i - 1]) setAttr(y, 'cx', xs2[k.i - 1]); } (y.children || []).forEach(w); })(root);
    });
    // donut: segment list follows the legend
    all.forEach(function (x) {
      var cs = attr(x, 'data-bind-conic'); if (!cs) return;
      var k0 = parseKey(cs.split(',')[0]); if (!k0 || !counts[k0.p]) return;
      var n = counts[k0.p], cols = String(attr(x, 'data-conic-colors')).split('|'), keys = [], cc = [];
      for (var i = 1; i <= n; i++) { keys.push(mkKey(k0, i, k0.f)); cc.push(cols[(i - 1) % cols.length]); }
      setAttr(x, 'data-bind-conic', keys.join(',')); setAttr(x, 'data-conic-colors', cc.join('|'));
    });
  }
  function normaliseCounts(counts, manifest, templateId) {
    if (!counts || typeof counts !== 'object') return null;
    var b = countBounds(manifest, templateId), out = {};
    Object.keys(counts).forEach(function (p) { if (!b[p]) return; var n = Math.round(+counts[p]); if (!(n > 0)) return;
      n = Math.max(b[p].min, Math.min(b[p].max, n)); if (n !== b[p].base) out[p] = n; });
    return Object.keys(out).length ? out : null;
  }

  /* ---------- MOF visual identity: palettes, backgrounds, logo, pattern ---------- */
  var PALETTES = ['mof_classic', 'sapphire', 'uae_red', 'national'];
  var BACKGROUNDS = ['light', 'tint', 'silver', 'dark', 'accent'];
  var STRONG = { silver: 1, dark: 1, accent: 1 };
  var LEGACY = { white_gold: 'light', black_gold: 'dark', gold_white: 'accent', grey_gold: 'silver' };   // old palette ids
  var BASE = { light: 'white_gold', tint: 'white_gold', silver: 'black_gold', dark: 'black_gold', accent: 'gold_white' };  // design's own structural tweaks
  var PATTERN_POS = ['tr', 'br', 'tl', 'bl', 'r', 'l'];
  var LOGO = {   // cover logo by background and language (guide p.22, p.76): full colour on light, white single-colour on dark
    light: { en: 'mof-logo-horizontal-en-full-colour.png', ar: 'mof-logo-horizontal-ar-full-colour.png' },
    dark: { en: 'mof-logo-horizontal-en-white.svg', ar: 'mof-logo-vertical-bilingual-white.svg' },
    photo: { en: 'mof-wordmark-horizontal-white.svg', ar: 'mof-wordmark-horizontal-white.svg' }
  };
  function paletteOf(spec) { var id = spec && spec.theme && spec.theme.id; return PALETTES.indexOf(id) >= 0 ? id : 'mof_classic'; }
  function resolveDesign(spec, slide, layout) {
    var pal = paletteOf(spec);
    var deckLegacy = spec && spec.theme && LEGACY[spec.theme.id];
    var bg = BACKGROUNDS.indexOf(slide.background) >= 0 ? slide.background : (LEGACY[slide.palette] || deckLegacy || 'light');
    if (layout === 'cover' && (bg === 'tint' || bg === 'accent')) bg = bg === 'tint' ? 'light' : 'dark';   // covers: white or dark, so the logo reads (p.22)
    var pos = PATTERN_POS.indexOf(slide.pattern) >= 0 ? slide.pattern : null;
    if (layout === 'cover' || pal === 'national') pos = null;                          // never with the logo; the national palette has no gold
    return { palette: pal, background: bg, pattern: pos };
  }
  var rng = function (seed) { var h = 1779033703 ^ String(seed).length; for (var i = 0; i < String(seed).length; i++) { h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };
  var BG_CHOICES = { cover: [['light', 5], ['silver', 2], ['dark', 3]], section: [['dark', 4], ['accent', 3], ['silver', 2]], quote: [['accent', 4], ['dark', 3], ['silver', 2]],
    closing: [['dark', 4], ['silver', 2], ['accent', 2], ['light', 1]], stats: [['light', 5], ['tint', 2], ['dark', 2]], chart: [['light', 7], ['tint', 2]], table: [['light', 8], ['tint', 1]],
    bullets: [['light', 6], ['tint', 2], ['dark', 1]], two_col: [['light', 6], ['tint', 2], ['dark', 1]],
    agenda: [['light', 6], ['tint', 2]], timeline: [['light', 7], ['tint', 2]], statement: [['dark', 3], ['accent', 2], ['light', 3]], image_text: [['light', 1]] };
  var PATTERN_CHOICES = { agenda: [0.3, ['br', 'tr']], statement: [0.6, ['r', 'br', 'tr']], section: [0.85, ['r', 'br', 'tr']], quote: [0.8, ['r', 'tr', 'br']], closing: [0.8, ['r', 'br', 'tr']], stats: [0.35, ['tr', 'br']], bullets: [0.3, ['br', 'tr']], two_col: [0.15, ['tr']] };
  function pick(r, list) { var tot = list.reduce(function (a, x) { return a + x[1]; }, 0), v = r() * tot; for (var i = 0; i < list.length; i++) { v -= list[i][1]; if (v <= 0) return list[i][0]; } return list[0][0]; }
  /* Assigns backgrounds and pattern positions: varied per deck (seeded), within the guide (white space >= 60%, no two strong slides in a row). */
  function designDeck(spec, opts) {
    opts = opts || {};
    var r = rng(opts.seed || spec.design_seed || spec.title || 'mof'), slides = spec.slides || [], only = opts.slideIds ? opts.slideIds : null;
    var strongMax = Math.max(1, Math.floor(slides.length * 0.4)), strong = 0, prevStrong = false, prevPat = null;
    slides.forEach(function (s, i) {
      var layout = s.layout || (s.template && String(s.template.id).replace(/-\d+$/, '').replace(/-/g, '_'));
      var mine = !only || only.indexOf(s.id) >= 0, keep = !opts.force && BACKGROUNDS.indexOf(s.background) >= 0;
      var bg = s.background;
      var tid = String(s.template && s.template.id || '');
      if (mine && /photo|image-text/.test(tid)) { s.background = /-full/.test(tid) ? 'dark' : 'light'; keep = true; }
      if (mine && !keep) {
        bg = pick(r, BG_CHOICES[layout] || [['light', 1]]);
        if (STRONG[bg] && (prevStrong || strong >= strongMax) && layout !== 'cover') bg = (layout === 'section' || layout === 'quote' || layout === 'closing') ? 'tint' : 'light';
        s.background = bg;
      }
      if (STRONG[s.background]) strong++; prevStrong = !!STRONG[s.background];
      if (mine && (opts.force || s.pattern === undefined)) {
        var pc = PATTERN_CHOICES[layout];
        var pos = pc && r() < pc[0] ? pc[1][Math.floor(r() * pc[1].length)] : 'none';
        if (pos === prevPat && pc) pos = pc[1][(pc[1].indexOf(pos) + 1) % pc[1].length];
        s.pattern = pos;
      }
      prevPat = s.pattern !== 'none' ? s.pattern : null;
      if (s.palette && LEGACY[s.palette]) delete s.palette;                      // old per-slide palettes become backgrounds
    });
    assignPhotos(spec, r, only, opts.force, function (x) { return /photo|image-text/.test(String(x.template && x.template.id || '')); });
    return spec;
  }
  var MIRROR = { tr: 'tl', tl: 'tr', br: 'bl', bl: 'br', r: 'l', l: 'r' };
  function applyIdentity(root, section, d, layout, opts) {
    var cls = String(attr(section, 'class') || '').split(/\s+/).filter(function (c) { return c && !/^(palette-|pal-|bg-)/.test(c) && c !== 'no-logo'; });
    cls.push('palette-' + BASE[d.background], 'pal-' + d.palette, 'bg-' + d.background);
    if (layout !== 'cover') cls.push('no-logo');
    setAttr(section, 'class', cls.join(' '));
    var onPhoto = /\bg-on-photo\b/.test(attr(section, 'class') || '');
    if (layout === 'cover') {
      var tone = onPhoto ? 'photo' : (d.background === 'light' || d.background === 'tint' ? 'light' : 'dark');
      (function w(n) { if (n.type === 'el' && n.name === 'img' && /\bbrand-logo\b/.test(attr(n, 'class') || '')) {
        setAttr(n, 'src', '{{asset_base}}/assets/brand/' + LOGO[tone].en); setAttr(n, 'data-ar-src', '{{asset_base}}/assets/brand/' + LOGO[tone].ar);
        setAttr(n, 'alt', 'United Arab Emirates Ministry of Finance'); setAttr(n, 'data-ar-alt', 'الإمارات العربية المتحدة وزارة المالية'); }
        (n.children || []).forEach(w); })(root);
    }
    var zones = attr(section, 'data-pattern-zones');
    if (d.pattern && zones != null && zones.split(/\s+/).indexOf(d.pattern) < 0) d = Object.assign({}, d, { pattern: null });   // designs declare where the pattern may sit
    if (d.pattern && !onPhoto) {
      var pos = opts.lang === 'ar' ? MIRROR[d.pattern] : d.pattern, colour = d.background === 'accent' ? 'white' : 'gold';
      section.children.unshift({ type: 'el', name: 'div', attrs: [['class', 'mof-pattern pos-' + pos], ['aria-hidden', 'true'],
        ['style', "background-image:url('{{asset_base}}/assets/brand/mof-pattern-" + colour + ".svg')"]], children: [] });
    }
    if (layout === 'closing' && opts.website) section.children.push({ type: 'el', name: 'div', attrs: [['class', 'mof-web']], children: [text(opts.website)] });
  }

  /* ---------- photos (from the Visual Identity Guidelines; stored under assets/photos/) ---------- */
  var PHOTOS = [
    { id: 'landmark-sheikh-zayed-mosque-dusk', tags: ['landmark', 'heritage', 'national', 'calm'], full: true, pos: '50% 60%' },
    { id: 'landmark-domed-building', tags: ['landmark', 'government', 'architecture', 'finance'], full: false, pos: '50% 60%' },
    { id: 'landmark-dome-sky-minimal', tags: ['landmark', 'architecture', 'minimal', 'government'], full: false, pos: '80% 50%' },
    { id: 'landmark-mosque-dome-detail', tags: ['landmark', 'heritage', 'detail'], full: false, pos: '50% 40%' },
    { id: 'landmark-qasr-al-watan-interior', tags: ['landmark', 'heritage', 'government', 'culture'], full: false, pos: '50% 35%' },
    { id: 'city-skyline', tags: ['city', 'economy', 'finance', 'growth', 'investment'], full: false, pos: '50% 50%' },
    { id: 'heritage-fort', tags: ['heritage', 'history', 'culture'], full: false, pos: '50% 50%' },
    { id: 'nature-mountains', tags: ['nature', 'sustainability', 'future', 'resilience'], full: false, pos: '50% 50%' },
    { id: 'nature-arabian-oryx', tags: ['nature', 'sustainability', 'environment'], full: false, pos: '50% 60%' },
    { id: 'national-aerobatic-display', tags: ['national', 'ambition', 'celebration', 'future'], full: false, pos: '50% 40%' },
    { id: 'culture-emirati-group', tags: ['people', 'national', 'culture', 'community'], full: false, pos: '50% 40%' },
    { id: 'culture-craft-weaving', tags: ['culture', 'heritage', 'craft'], full: false, pos: '50% 50%' },
    { id: 'culture-arabic-calligraphy', tags: ['culture', 'policy', 'writing', 'legal'], full: false, pos: '50% 50%' },
    { id: 'people-library-reading', tags: ['people', 'education', 'knowledge', 'research'], full: true, pos: '50% 45%' },
    { id: 'people-colleagues-meeting', tags: ['people', 'work', 'collaboration', 'finance', 'government'], full: false, pos: '50% 35%' },
    { id: 'people-working-laptop', tags: ['people', 'digital', 'technology', 'services', 'work'], full: false, pos: '40% 40%' },
    { id: 'people-schoolchildren', tags: ['people', 'education', 'future', 'community'], full: false, pos: '50% 45%' }];
  var PHOTO_BY_ID = {}; PHOTOS.forEach(function (p) { PHOTO_BY_ID[p.id] = p; });
  var TOPIC_TAGS = [[/budget|revenue|spend|financ|fiscal|tax|econom|invest|fund|expenditure|treasury|debt/i, ['finance', 'economy', 'city', 'government']],
    [/digital|technolog|data|ai\b|system|platform|online|app|service/i, ['digital', 'technology', 'services', 'work']],
    [/people|staff|employee|talent|citizen|customer|team|workforce|community/i, ['people', 'community', 'work']],
    [/educat|school|learn|skill|train|knowledge|research/i, ['education', 'knowledge', 'future']],
    [/sustainab|environment|climate|green|energy|nature/i, ['nature', 'sustainability', 'environment']],
    [/national|heritage|culture|history|identity|union|celebrat/i, ['national', 'heritage', 'culture']],
    [/policy|law|legal|regulat|governance|decree/i, ['policy', 'government', 'legal']],
    [/future|strategy|vision|ambition|growth|plan/i, ['future', 'ambition', 'growth']]];
  function photoTags(text) { var out = []; TOPIC_TAGS.forEach(function (t) { if (t[0].test(text)) out = out.concat(t[1]); }); return out; }
  /* chooses photos for slides whose design has a photo area: matches the deck's and slide's topic, no photo twice in a deck */
  function assignPhotos(spec, r, only, force, hasPhoto) {
    var used = {}, deckTags = photoTags(String(spec.title || '') + ' ' + String((spec.meta && spec.meta.topic) || ''));
    (spec.slides || []).forEach(function (s) { if (s.photo && s.photo.id && !(force && (!only || only.indexOf(s.id) >= 0))) used[s.photo.id] = 1; });
    (spec.slides || []).forEach(function (s) {
      if (!hasPhoto(s)) { if (s.photo && !s.photo.upload) delete s.photo; return; }
      var mine = !only || only.indexOf(s.id) >= 0;
      if (s.photo && s.photo.id && !(force && mine)) return;
      var tags = deckTags.concat(photoTags(String(s.headline || '') + ' ' + Object.keys(s.content || {}).map(function (k) { return typeof s.content[k] === 'string' ? s.content[k] : ''; }).join(' ')));
      var needFull = /-photo-full/.test(s.template && s.template.id || '');
      var best = null, bestScore = -1;
      PHOTOS.forEach(function (p) { if (needFull && !p.full) return;
        var sc = p.tags.filter(function (t) { return tags.indexOf(t) >= 0; }).length * 2 + (used[p.id] ? -10 : 0) + r();
        if (sc > bestScore) { bestScore = sc; best = p; } });
      if (best) { s.photo = { id: best.id }; used[best.id] = 1; }
    });
  }
  function applyPhotos(root, photo) {
    (function w(n) {
      if (n.type === 'el' && attr(n, 'data-photo') != null) {
        var id = (photo && photo.id) || attr(n, 'data-photo-default'), p = PHOTO_BY_ID[id];
        var url = photo && photo.upload ? photo.upload : (p ? '{{asset_base}}/assets/photos/' + p.id + '.jpg' : '');
        if (url) { styleSet(n, 'background-image', "url('" + url + "')"); styleSet(n, 'background-position', (photo && photo.pos) || (p && p.pos) || '50% 50%'); }
      }
      (n.children || []).forEach(w);
    })(root);
  }
  /* charts and KPI rings: the largest value is highlighted (neutral series + one accent, guide p.47) */
  function applyHighlights(root, content) {
    var hl = [], rings = [], swatches = {}, conics = [];
    (function w(n) { if (n.type === 'el') { if (attr(n, 'data-hl')) hl.push(n); if (attr(n, 'data-bind-ring')) rings.push(n); if (attr(n, 'data-swatch')) swatches[attr(n, 'data-swatch')] = n;
      if (attr(n, 'data-conic-colors') === 'auto' || /^(auto\|?)+$/.test(attr(n, 'data-conic-colors') || '')) conics.push(n); } (n.children || []).forEach(w); })(root);
    if (hl.length) { var vals = hl.map(function (n) { return num(content[attr(n, 'data-hl')]); }), mx = Math.max.apply(null, vals);
      hl.forEach(function (n, i) { if (vals[i] === mx && mx > -Infinity) setAttr(n, 'class', ((attr(n, 'class') || '') + ' is-hl').trim()); }); }
    rings.forEach(function (n) { var raw = String(content[attr(n, 'data-bind-ring')] || ''), v = num(raw), p = /%/.test(raw) ? Math.max(0, Math.min(100, v)) : 100;
      styleSet(n, 'background', 'conic-gradient(var(--gold-500) 0 ' + p + '%, var(--g-n1) ' + p + '% 100%)'); });
    conics.forEach(function (n) {
      var ks = String(attr(n, 'data-bind-conic')).split(','), vs = ks.map(function (k) { return Math.max(0, num(content[k])); }), mx = Math.max.apply(null, vs);
      var greys = ['var(--g-n3)', 'var(--g-n2)', 'var(--g-n1)', 'var(--g-n4)'], gi = 0, cols = vs.map(function (v) { return v === mx ? 'var(--gold-500)' : greys[gi++ % greys.length]; });
      var tot = vs.reduce(function (a, b) { return a + b; }, 0) || 1, at = 0;
      styleSet(n, 'background', 'conic-gradient(' + vs.map(function (x, i) { var a = at; at += x / tot * 100; return cols[i] + ' ' + (Math.round(a * 10) / 10) + '% ' + (i === vs.length - 1 ? 100 : Math.round(at * 10) / 10) + '%'; }).join(', ') + ')');
      ks.forEach(function (k, i) { if (swatches[k]) styleSet(swatches[k], 'background', cols[i]); });
    });
  }

  function renderSlide(slide, template, opts) {
    opts = opts || {};
    if (!template || !template.html || !template.manifest) throw new Error('Template missing for slide ' + (slide && slide.id));
    var tree = parse(template.html);
    var section = tree.children.find(function (c) { return c.type === 'el' && c.name === 'section'; });
    if (!section) throw new Error('Template ' + template.id + ' must have a <section> root');
    if (opts.design) applyIdentity(tree, section, opts.design, template.manifest.layout, opts);
    else if (opts.palette) {                          // single-slide previews (gallery thumbnails) may still pass a palette id
      var d0 = resolveDesign({ theme: { id: PALETTES.indexOf(opts.palette) >= 0 ? opts.palette : 'mof_classic' } }, { background: LEGACY[opts.palette] || opts.background }, template.manifest.layout);
      applyIdentity(tree, section, d0, template.manifest.layout, opts);
    }
    if (opts.lang) { setAttr(section, 'lang', opts.lang); setAttr(section, 'dir', opts.lang === 'ar' ? 'rtl' : 'ltr'); }
    setAttr(section, 'data-slide-id', slide.id);
    setAttr(section, 'data-template', template.id + '@' + template.version);
    setAttr(section, 'data-layout', template.manifest.layout);
    var counts = normaliseCounts(slide.counts, template.manifest, template.id);
    if (counts) applyCounts(tree, template.manifest, counts);
    fill(tree, slide.content || {}, effectiveManifest(template.manifest, counts).slots, '');
    applyBindings(tree, slide.content || {});
    applyHighlights(tree, slide.content || {});
    applyPhotos(tree, slide.photo || (opts.design && opts.design.photo));
    applyLanguage(tree, opts.lang || 'en');
    return serialize(tree).trim();
  }

  /* system slots: values owned by the pipeline, never the LLM */
  function applySystemSlots(content, manifest, spec, index, total) {
    var out = {}, c = content || {}, slots = (manifest && manifest.slots) || {};
    Object.keys(c).forEach(function (k) { out[k] = c[k]; });
    Object.keys(slots).forEach(function (k) {
      var src = slots[k].source;
      if (!src) return;
      if (src.indexOf('default:') === 0) {
        if (out[k] == null || String(out[k]).trim() === '') out[k] = src === 'default:footer' ? ((spec.meta && spec.meta.footer_text) || '') : '';
        return;
      }
      if (src === 'system:page') out[k] = String(index + 1).padStart(2, '0');
      else if (src === 'system:total') out[k] = String(total).padStart(2, '0');
      else if (src === 'system:footer') out[k] = (spec.meta && spec.meta.footer_text) || '';
      else if (src === 'system:date') out[k] = (spec.meta && spec.meta.date_label) || '';
      else if (src === 'system:title') out[k] = spec.title || '';
    });
    return out;
  }

  /* manifest -> compact schema line for LLM prompts (pipeline-owned and unused slots are excluded) */
  function describeManifest(manifest) {
    function d(k, s) {
      if (!s) return k;
      if (!isPrimitive(s)) return '{' + Object.keys(s).filter(function (f) { return !s[f] || s[f].llm !== false; }).map(function (f) { return d(f, s[f]); }).join(', ') + '}';
      var opt = s.required === false ? ' optional' : '';
      var hint = s.hint && s.hint !== k ? ' (' + s.hint + ')' : '';
      switch (s.type) {
        case 'text': return (k ? k + ': ' : '') + (s.numeric ? 'number with unit <=' : 'text <=') + s.max_chars + ' chars' + opt + hint;
        case 'list': return (k ? k + ': ' : '') + (s.min || 0) + '-' + s.max + ' items of ' + d('', s.item);
        case 'table': return (k ? k + ': ' : '') + 'table {head:[' + ((s.columns || {}).min || 1) + '-' + ((s.columns || {}).max || 6) + ' headings <=' + (s.max_head_chars || s.max_cell_chars || 40) + '], rows:[' + (s.min_rows || 1) + '-' + s.max_rows + ' rows of cells <=' + (s.max_cell_chars || 40) + ']}';
        case 'chart': return (k ? k + ': ' : '') + 'chart {type:' + (s.chart_types || ['bar']).join('|') + ', labels:[' + (s.min_labels || 2) + '-' + (s.max_labels || 8) + '], series:[1-' + (s.max_series || 3) + ' {name, data:[numbers]}]}';
        case 'image': return (k ? k + ': ' : '') + 'image {src, alt}' + opt;
        default: return k;
      }
    }
    var slots = (manifest && manifest.slots) || {};
    return Object.keys(slots).filter(function (k) { return slots[k].llm !== false; }).map(function (k) { return d(k, slots[k]); }).join('; ');
  }

  /* how many items a design holds: numbered groups (stat-1..4, item-1..6, r1..r4) and their fields; "main" is the biggest group */
  function capacity(manifest) {
    var slots = (manifest && manifest.slots) || {}, groups = {};
    Object.keys(slots).forEach(function (k) {
      if (slots[k].llm === false) return;
      var m = /^([a-z]+(?:-[a-z]+)*)-?(\d+)_(.+)$/.exec(k); if (!m) return;
      var g = groups[m[1]] || (groups[m[1]] = { n: {}, fields: [] });
      g.n[m[2]] = 1; if (g.fields.indexOf(m[3]) < 0) g.fields.push(m[3]);
    });
    var out = { groups: {}, main: null };
    Object.keys(groups).forEach(function (p) { var c = Object.keys(groups[p].n).length; out.groups[p] = { count: c, fields: groups[p].fields };
      if (!out.main || c * groups[p].fields.length > out.main.count * out.main.fields.length) out.main = { prefix: p, count: c, fields: groups[p].fields }; });
    return out;
  }

  /* planner-sized summary: groups numbered fields, e.g. "4 x stat (value, name, note)" */
  function summarizeManifest(manifest) {
    var slots = (manifest && manifest.slots) || {}, groups = {}, order = [], plain = [];
    Object.keys(slots).forEach(function (k) {
      if (slots[k].llm === false) return;
      var m = /^([a-z]+(?:-[a-z]+)*)-?(\d+)_(.+)$/.exec(k);
      if (!m) { plain.push(k + ' <=' + slots[k].max_chars); return; }
      var g = groups[m[1]]; if (!g) { g = groups[m[1]] = { n: {}, f: [] }; order.push(m[1]); }
      g.n[m[2]] = 1; if (g.f.indexOf(m[3]) < 0) g.f.push(m[3]);
    });
    return plain.concat(order.map(function (p) { var g = groups[p]; return Object.keys(g.n).length + ' x ' + p + ' (' + g.f.join(', ') + ')'; })).join('; ');
  }

  function renderDeck(spec, templatesById, shellHtml, opts) {
    opts = opts || {};
    var lang = spec.language === 'ar' ? 'ar' : 'en';
    var palette = spec.theme && spec.theme.id;
    var total = (spec.slides || []).length;
    var slides = (spec.slides || []).map(function (s, i) {
      var t = templatesById[s.template.id + '@' + s.template.version] || templatesById[s.template.id];
      if (!t) throw new Error('Template ' + s.template.id + '@' + s.template.version + ' not found for slide ' + s.id);
      return renderSlide({ id: s.id, counts: s.counts, photo: s.photo, content: applySystemSlots(s.content, t.manifest, spec, i, total) }, t,
        { design: resolveDesign(spec, s, t.manifest.layout), lang: lang, website: (spec.meta && spec.meta.website) || 'www.mof.gov.ae' });
    }).join('\n');
    return shellHtml
      .split('{{lang}}').join(lang)
      .split('{{dir}}').join(lang === 'ar' ? 'rtl' : 'ltr')
      .split('{{title}}').join(esc(spec.title || 'Presentation'))
      .split('{{theme_css}}').join(String((spec.theme && spec.theme.css) || '').replace(/<\/style/gi, ''))
      .split('{{deck_id}}').join(escAttr(spec.deck_id || ''))
      .split('{{version}}').join(String(spec.version == null ? '' : spec.version))
      .split('{{slides}}').join(slides)
      .split('{{asset_base}}').join(String(opts.assetBase || '').replace(/\/+$/, ''));
  }

  var api = { PHOTOS: PHOTOS, assignPhotos: assignPhotos, photoTags: photoTags, PALETTES: PALETTES, BACKGROUNDS: BACKGROUNDS, LEGACY: LEGACY, designDeck: designDeck, resolveDesign: resolveDesign, paletteOf: paletteOf, CAPS: CAPS, countBounds: countBounds, effectiveManifest: effectiveManifest, normaliseCounts: normaliseCounts, capacity: capacity, summarizeManifest: summarizeManifest, describeManifest: describeManifest, applySystemSlots: applySystemSlots, validateContent: validateContent, renderSlide: renderSlide, renderDeck: renderDeck, getPath: getPath, setPath: setPath, _parse: parse, _serialize: serialize };

  if (root) root.SlotRenderer = api;
})(globalThis);
export default globalThis.SlotRenderer;
