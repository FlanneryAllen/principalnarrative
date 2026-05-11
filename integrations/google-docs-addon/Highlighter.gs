/**
 * Highlighter.gs — Paint background colors on scored spans.
 *
 * Spans arrive as {start, end, layer} offsets into plain text. We walk the
 * document body element-by-element, tracking cumulative offset, and call
 * setBackgroundColor on the matching Range.
 */

var Highlighter = (function () {
  var LAYER_COLORS = {
    verbatim:            '#fef3c7', // warm yellow
    near_verbatim:       '#fde68a',
    paraphrase_verified: '#dbeafe', // light blue
    concept_only:        '#e0e7ff', // light indigo
  };
  var ALL_COLORS = Object.keys(LAYER_COLORS).map(function (k) { return LAYER_COLORS[k]; });

  function clear() {
    var body = DocumentApp.getActiveDocument().getBody();
    var textElements = collectTextElements_(body);
    textElements.forEach(function (te) {
      var n = te.getText().length;
      if (n > 0) {
        // Only clear our known highlight colors; leave others alone
        for (var i = 0; i < n; i++) {
          var bg = te.getBackgroundColor(i);
          if (bg && ALL_COLORS.indexOf(bg) >= 0) {
            te.setBackgroundColor(i, i, null);
          }
        }
      }
    });
  }

  function paint(spans) {
    if (!spans || spans.length === 0) return;
    var body = DocumentApp.getActiveDocument().getBody();
    var textElements = collectTextElements_(body);

    // Build offset map: cumulative plain-text position → (textElement, localOffset)
    var map = [];
    var cursor = 0;
    for (var i = 0; i < textElements.length; i++) {
      var te = textElements[i];
      var len = te.getText().length;
      map.push({ te: te, start: cursor, end: cursor + len });
      cursor += len + 1; // +1 for paragraph break, matches body.getText() behavior
    }

    spans.forEach(function (span) {
      var color = LAYER_COLORS[span.layer];
      if (!color) return;
      applySpanToMap_(map, span.start, span.end, color);
    });
  }

  // ───────── helpers ─────────

  function collectTextElements_(body) {
    var out = [];
    var n = body.getNumChildren();
    for (var i = 0; i < n; i++) {
      var child = body.getChild(i);
      collectFromElement_(child, out);
    }
    return out;
  }

  function collectFromElement_(el, out) {
    var t = el.getType();
    if (t === DocumentApp.ElementType.PARAGRAPH ||
        t === DocumentApp.ElementType.LIST_ITEM) {
      var k = el.getNumChildren();
      for (var i = 0; i < k; i++) {
        var c = el.getChild(i);
        if (c.getType() === DocumentApp.ElementType.TEXT) out.push(c);
      }
    }
  }

  function applySpanToMap_(map, start, end, color) {
    for (var i = 0; i < map.length; i++) {
      var entry = map[i];
      if (entry.end <= start) continue;
      if (entry.start >= end) break;
      var localStart = Math.max(0, start - entry.start);
      var localEnd = Math.min(entry.te.getText().length, end - entry.start) - 1;
      if (localEnd >= localStart) {
        try {
          entry.te.setBackgroundColor(localStart, localEnd, color);
        } catch (e) {
          // Range may be invalid if doc changed since scoring — silently skip
        }
      }
    }
  }

  return { clear: clear, paint: paint, LAYER_COLORS: LAYER_COLORS };
})();
