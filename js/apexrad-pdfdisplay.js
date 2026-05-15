/* APEXRAD PDF Display - v24.2.0
 * https://github.com/Saeed-Hassanpour/APEXRAD-PDF-Display
 * Author: Saeed Hassanpour — Paya Shetaban Andisheh (APEXRAD)
*/
(function (window, apex, $) {
  "use strict";

  var apexrad = window.apexrad || {};
  window.apexrad = apexrad;
  apexrad.pdfDisplay = apexrad.pdfDisplay || {};
  apexrad.pdfDisplay._state = apexrad.pdfDisplay._state || {};

  function toBool(v) {
    var s = String(v || "").toUpperCase();
    return s === "Y" || s === "YES" || s === "TRUE" || s === "1" || s === "ON";
  }

  function escapeRegex(v) {
    return String(v || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeText(text, caseSensitive) {
    var out = String(text || "");
    try {
      out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) {
      // Ignore normalize support issues
    }
    if (!caseSensitive) {
      out = out.toLowerCase();
    }
    return out.trim();
  }

  function levenshteinDistance(a, b) {
    var m = a.length;
    var n = b.length;
    var matrix = [];
    var i;
    var j;
    var cost;

    for (i = 0; i <= n; i += 1) {
      matrix[i] = [i];
    }
    for (j = 0; j <= m; j += 1) {
      matrix[0][j] = j;
    }

    for (i = 1; i <= n; i += 1) {
      for (j = 1; j <= m; j += 1) {
        cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[n][m];
  }

  function getSimilarity(a, b) {
    var aa = String(a || "");
    var bb = String(b || "");
    var longer = aa.length >= bb.length ? aa : bb;
    var shorter = aa.length >= bb.length ? bb : aa;
    if (!longer.length) {
      return 1;
    }
    return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
  }

  function parseLegacyWords(text) {
    return String(text || "")
      .replace(/\r/g, "\n")
      .replace(/###/g, "\n")
      .split(/[\n,]/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 0; });
  }

  function resolveWordsSource(raw) {
    var resolved = raw;

    if (typeof resolved === "string" && String(resolved).trim().indexOf("apex.item(") === 0) {
      try {
        resolved = Function("apex", "return (" + resolved + ");")(apex);
      } catch (e) {
        resolved = "";
      }
    }

    return resolved;
  }

  function extractWordsFromArray(arr) {
    var out = [];
    (arr || []).forEach(function (entry) {
      var w = "";
      if (typeof entry === "string") {
        w = entry;
      } else if (entry && typeof entry === "object" && typeof entry.word === "string") {
        w = entry.word;
      }

      w = String(w || "").trim();
      if (w) {
        out.push(w);
      }
    });
    return out;
  }

  function parseWordsPayload(raw) {
    var resolved = resolveWordsSource(raw);
    var parsed;

    if (resolved === null || resolved === undefined) {
      return [];
    }

    if (Array.isArray(resolved)) {
      return extractWordsFromArray(resolved);
    }

    if (typeof resolved === "object") {
      if (Array.isArray(resolved.words)) {
        return extractWordsFromArray(resolved.words);
      }
      return [];
    }

    resolved = String(resolved || "").trim();
    if (!resolved) {
      return [];
    }

    try {
      parsed = JSON.parse(resolved);
      if (Array.isArray(parsed)) {
        return extractWordsFromArray(parsed);
      }
      if (parsed && Array.isArray(parsed.words)) {
        return extractWordsFromArray(parsed.words);
      }
      return [];
    } catch (e) {
      return parseLegacyWords(resolved);
    }
  }

  function mergeWords(sqlWords, jsonWords) {
    var out = [];
    var seen = {};

    function pushWord(w) {
      var key = String(w || "").trim();
      if (!key || seen[key]) {
        return;
      }
      seen[key] = true;
      out.push(key);
    }

    parseWordsPayload(sqlWords).forEach(pushWord);
    parseWordsPayload(jsonWords).forEach(pushWord);

    return out;
  }

  function normalizeFillStyle(v) {
    var s = String(v || "#FFA500").trim();
    s = s.replace(/^['\"]|['\"]$/g, "");
    return s || "#FFA500";
  }

  function hexToRgba(hex, alpha) {
    var h = String(hex || "").replace("#", "").trim();
    var r;
    var g;
    var b;

    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }

    if (!/^[0-9A-Fa-f]{6}$/.test(h)) {
      return "rgba(255,165,0," + alpha + ")";
    }

    r = parseInt(h.substring(0, 2), 16);
    g = parseInt(h.substring(2, 4), 16);
    b = parseInt(h.substring(4, 6), 16);

    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  function isWordChar(ch) {
    return /[0-9A-Za-z_\u00C0-\u024F\u0600-\u06FF]/.test(ch || "");
  }

  function findWholeWordIndex(haystack, needle) {
    var idx = -1;
    var from = 0;
    var prevCh;
    var nextCh;

    if (!haystack || !needle) {
      return -1;
    }

    while (from <= haystack.length) {
      idx = haystack.indexOf(needle, from);
      if (idx < 0) {
        return -1;
      }
      prevCh = idx > 0 ? haystack.charAt(idx - 1) : "";
      nextCh = (idx + needle.length < haystack.length) ? haystack.charAt(idx + needle.length) : "";
      if (!isWordChar(prevCh) && !isWordChar(nextCh)) {
        return idx;
      }
      from = idx + 1;
    }

    return -1;
  }

  function currentRouteInfo() {
    var pathname = String(window.location.pathname || "");
    var segments = pathname.split("/").filter(function (x) { return x.length > 0; });
    var rIndex = segments.indexOf("r");
    var prefix = "";
    var workspace = "";
    var appAlias = "";

    if (rIndex >= 0) {
      prefix = rIndex > 0 ? "/" + segments.slice(0, rIndex).join("/") : "";
      workspace = segments[rIndex + 1] || "";
      appAlias = segments[rIndex + 2] || "";
    }

    return {
      prefix: prefix,
      workspace: workspace,
      appAlias: appAlias
    };
  }

  function normalizePdfUrl(rawUrl) {
    var url = String(rawUrl || "").trim();
    var route;
    var routePrefix;
    var wsEsc;
    var prefixEsc;
    var re1;
    var re2;
    var parsed;

    function getRoutePrefix() {
      return currentRouteInfo().prefix || "";
    }

    function ensureRoutePath(path) {
      var prefix = getRoutePrefix();

      if (/^\/r\//i.test(path)) {
        return (prefix || "") + path;
      }
      if (prefix && new RegExp("^" + escapeRegex(prefix) + "/r/", "i").test(path)) {
        return path;
      }
      return path;
    }

    if (!url) {
      return "";
    }

    url = url.replace(/^['\"]|['\"]$/g, "");

    if (/^data:/i.test(url) || /^blob:/i.test(url)) {
      return url;
    }

    if (url.indexOf("//") === 0) {
      return window.location.protocol + url;
    }

    if (/^https?:\/\//i.test(url)) {
      try {
        parsed = new URL(url, window.location.href);
        if (parsed.origin === window.location.origin) {
          parsed.pathname = ensureRoutePath(parsed.pathname);
          return parsed.toString();
        }
      } catch (eAbs) {
        return url;
      }
      return url;
    }

    route = currentRouteInfo();
    routePrefix = route.prefix || getRoutePrefix();

    if (url.indexOf("#APP_FILES#") === 0) {
      if (route.workspace && route.appAlias) {
        return (routePrefix || "") + "/r/" + route.workspace + "/" + route.appAlias + "/files/static/" +
          url.substring("#APP_FILES#".length).replace(/^\/+/, "");
      }
      url = url.substring("#APP_FILES#".length);
    }

    if (url.charAt(0) !== "/") {
      url = "/" + url;
    }

    if (route.workspace && route.appAlias) {
      wsEsc = escapeRegex(route.workspace);
      prefixEsc = escapeRegex(route.prefix || "");
      re1 = new RegExp("^/r/" + wsEsc + "/\\d+/files/static/", "i");
      re2 = new RegExp("^" + prefixEsc + "/r/" + wsEsc + "/\\d+/files/static/", "i");

      if (re1.test(url)) {
        url = url.replace(re1, (routePrefix || "") + "/r/" + route.workspace + "/" + route.appAlias + "/files/static/");
      } else if (re2.test(url)) {
        url = url.replace(re2, (routePrefix || "") + "/r/" + route.workspace + "/" + route.appAlias + "/files/static/");
      }
    }

    url = ensureRoutePath(url);
    return url;
  }

  function resolveWorkerUrl(rawUrl) {
    var url = String(rawUrl || "").trim();
    var scriptEl;
    var src;

    if (url && url.indexOf("#PLUGIN_FILES#") === -1) {
      return url;
    }

    scriptEl = document.querySelector('script[src*="apexrad-pdfdisplay.js"]');
    src = scriptEl ? String(scriptEl.getAttribute("src") || "") : "";
    if (src) {
      return src.replace(/apexrad-pdfdisplay\.js(?:\?[^#]*)?$/i, "pdf.worker.js?v=24.2.0");
    }

    return "pdf.worker.js?v=24.2.0";
  }

  apexrad.pdfDisplay.init = function (cfg) {
    var region$ = $("#" + cfg.regionStaticId);
    var canvas;
    var ctx;
    var pdfDoc = null;
    var pageNum = 1;
    var pageRendering = false;
    var pageNumPending = null;
    var baseScale = 1.5;
    var zoomPercent = 100;
    var scale = baseScale;
    var cachedWords = [];
    var firstBtn$;
    var prevBtn$;
    var nextBtn$;
    var lastBtn$;
    var searchInput$;
    var searchButton$;
    var searchType$;
    var zoomOut$;
    var zoomIn$;
    var zoomValue$;
    var textLayerDiv = null;
    var textLayerTask = null;
    var activeSearchWord = "";
    var stateKey = cfg.regionStaticId || "_default";
    var state = apexrad.pdfDisplay._state[stateKey] || { inFlight: false, lastCall: 0 };

    apexrad.pdfDisplay._state[stateKey] = state;

    function getSearchTypeOptionsHtml(selectedValue) {
      var selected = String(selectedValue || "WHOLE_WORD").toUpperCase();
      var options = [
        { value: "WHOLE_WORD", label: "Match whole word only" },
        { value: "EXACT", label: "Exact match" },
        { value: "STARTS_WITH", label: "Match word at the beginning" },
        { value: "ENDS_WITH", label: "Match word at the end" },
        { value: "PARTIAL", label: "Match partial word" },
        { value: "FUZZY", label: "Fuzzy matching" }
      ];
      return options.map(function (opt) {
        return '<option value="' + apex.util.escapeHTML(opt.value) + '"' +
          (opt.value === selected ? " selected" : "") + ">" +
          apex.util.escapeHTML(opt.label) + "</option>";
      }).join("");
    }

    function setTitle() {
      var heading = document.getElementById(cfg.regionStaticId + "_heading");
      var showSearch = toBool(cfg.displaySearch);
      var showZoom = toBool(cfg.displayZoom);
      var inputId = cfg.regionStaticId + "_search_word";
      var buttonId = cfg.regionStaticId + "_search_btn";
      var typeId = cfg.regionStaticId + "_search_type";
      var zoomOutId = cfg.regionStaticId + "_zoom_out";
      var zoomInId = cfg.regionStaticId + "_zoom_in";
      var zoomValueId = cfg.regionStaticId + "_zoom_value";
      var titleHtml;
      if (heading) {
        titleHtml = '<span class="apexrad-pdfdisplay-title-page">Page: <span id="page_num"></span> / <span id="page_count"></span></span>';
        if (showSearch || showZoom) {
          titleHtml +=
            '<span class="apexrad-pdfdisplay-title-tools">' +
            (showSearch ?
              '<input type="text" id="' + apex.util.escapeHTML(inputId) + '" class="apex-item-text apexrad-pdfdisplay-search" placeholder="Search in PDF" />' +
              '<button type="button" id="' + apex.util.escapeHTML(buttonId) + '" class="t-Button t-Button--noLabel t-Button--icon apexrad-pdfdisplay-search-btn" aria-label="Search">' +
              '<span class="t-Icon fa fa-search" aria-hidden="true"></span></button>' +
              '<select id="' + apex.util.escapeHTML(typeId) + '" class="selectlist apexrad-pdfdisplay-search-type">' +
              getSearchTypeOptionsHtml(cfg.searchType) +
              "</select>" : "") +
            (showZoom ?
              '<span class="apexrad-pdfdisplay-zoom-tools">' +
              '<button type="button" id="' + apex.util.escapeHTML(zoomOutId) + '" class="t-Button apexrad-pdfdisplay-zoom-btn" aria-label="Zoom out">-</button>' +
              '<span id="' + apex.util.escapeHTML(zoomValueId) + '" class="apexrad-pdfdisplay-zoom-value">100%</span>' +
              '<button type="button" id="' + apex.util.escapeHTML(zoomInId) + '" class="t-Button apexrad-pdfdisplay-zoom-btn" aria-label="Zoom in">+</button>' +
              '</span>' : "") +
            "</span>";
        }
        heading.innerHTML = titleHtml;
      }
    }

    function getSelectedSearchType() {
      if (toBool(cfg.displaySearch) && searchType$ && searchType$.length) {
        return String(searchType$.val() || cfg.searchType || "WHOLE_WORD").toUpperCase();
      }
      return String(cfg.searchType || "WHOLE_WORD").toUpperCase();
    }

    function getActiveWords() {
      var out = [];

      if (toBool(cfg.displaySearch) && activeSearchWord) {
        out.push(activeSearchWord);
        return out;
      }

      if (toBool(cfg.findWords)) {
        out = cachedWords.slice(0);
      }

      return out;
    }

    function applySearchWordFromInput() {
      var value = "";
      if (searchInput$ && searchInput$.length) {
        value = String(searchInput$.val() || "").trim();
      }
      activeSearchWord = value;
      if (pdfDoc) {
        queueRenderPage(pageNum);
      }
    }

    function hasSelectableTextLayer() {
      return toBool(cfg.selectableTextLayer);
    }

    function ensurePageStage() {
      var parent;
      var host;
      var stage;

      if (!canvas || !canvas.parentNode) {
        return null;
      }

      parent = canvas.parentNode;
      if (parent.classList && parent.classList.contains("apexrad-pdfdisplay-page-stage")) {
        return parent;
      }

      host = parent;
      stage = document.createElement("div");
      stage.className = "apexrad-pdfdisplay-page-stage";
      host.insertBefore(stage, canvas);
      stage.appendChild(canvas);
      return stage;
    }

    function clearTextLayerTask() {
      if (textLayerTask && typeof textLayerTask.cancel === "function") {
        try {
          textLayerTask.cancel();
        } catch (eCancel) {
          // Ignore cancel race conditions.
        }
      }
      textLayerTask = null;
    }

    function removeTextLayer() {
      var stage;
      var host;

      clearTextLayerTask();

      if (textLayerDiv && textLayerDiv.parentNode) {
        textLayerDiv.parentNode.removeChild(textLayerDiv);
      }
      textLayerDiv = null;

      if (canvas && canvas.parentNode && canvas.parentNode.classList &&
          canvas.parentNode.classList.contains("apexrad-pdfdisplay-page-stage")) {
        stage = canvas.parentNode;
        host = stage.parentNode;
        if (host) {
          host.insertBefore(canvas, stage);
          host.removeChild(stage);
        }
      }
    }

    function ensureTextLayer() {
      var stage;

      if (!hasSelectableTextLayer()) {
        removeTextLayer();
        return null;
      }

      stage = ensurePageStage();
      if (!stage) {
        return null;
      }

      if (!textLayerDiv || !textLayerDiv.parentNode) {
        textLayerDiv = document.createElement("div");
        textLayerDiv.className = "apexrad-pdfdisplay-text-layer";
        stage.appendChild(textLayerDiv);
      }

      return textLayerDiv;
    }

    function updateZoomLabel() {
      if (zoomValue$ && zoomValue$.length) {
        zoomValue$.text(String(zoomPercent) + "%");
      }
    }

    function applyZoomPercent(newPercent) {
      var p = Number(newPercent || 100);
      if (isNaN(p)) {
        p = 100;
      }
      p = Math.max(50, Math.min(300, p));
      zoomPercent = p;
      scale = baseScale * (zoomPercent / 100);
      updateZoomLabel();
      if (pdfDoc) {
        queueRenderPage(pageNum);
      }
    }

    function adjustZoom(step) {
      applyZoomPercent(zoomPercent + step);
    }

    function setCounters(current, total) {
      var pageNumEl = document.getElementById("page_num");
      var pageCountEl = document.getElementById("page_count");
      if (pageNumEl) {
        pageNumEl.textContent = current || "";
      }
      if (pageCountEl) {
        pageCountEl.textContent = total || "";
      }
    }

    function updateNavButtons() {
      var total = pdfDoc ? Number(pdfDoc.numPages || 0) : 0;
      var showFirstLast = total > 5;

      if (!pdfDoc || total <= 1) {
        firstBtn$.hide();
        prevBtn$.hide();
        nextBtn$.hide();
        lastBtn$.hide();
        return;
      }

      prevBtn$.toggle(pageNum > 1);
      nextBtn$.toggle(pageNum < total);

      if (showFirstLast) {
        firstBtn$.toggle(pageNum > 1);
        lastBtn$.toggle(pageNum < total);
      } else {
        firstBtn$.hide();
        lastBtn$.hide();
      }
    }

    function findAllIndexes(haystack, needle) {
      var out = [];
      var from = 0;
      var idx;
      if (!haystack || !needle) {
        return out;
      }
      while (from <= haystack.length) {
        idx = haystack.indexOf(needle, from);
        if (idx < 0) {
          break;
        }
        out.push(idx);
        from = idx + 1;
      }
      return out;
    }

    function getMatchInfosForWord(pdfText, word, searchType, allowMultiple) {
      var normalizedPdf = normalizeText(pdfText, false);
      var normalizedWord = normalizeText(word, false);
      var infos = [];
      var tokens;
      var i;
      var score;
      var idx;
      var hitIndexes;
      var tokenStarts;
      var token;
      var tokenStart;
      var bestScore = 0;

      if (!normalizedPdf || !normalizedWord) {
        return infos;
      }

      if (searchType === "FUZZY") {
        hitIndexes = findAllIndexes(normalizedPdf, normalizedWord);
        for (i = 0; i < hitIndexes.length; i += 1) {
          infos.push({ start: hitIndexes[i], length: normalizedWord.length });
          if (!allowMultiple) {
            return infos;
          }
        }

        tokens = normalizedPdf.split(/[^A-Za-z0-9_\u00C0-\u024F\u0600-\u06FF-]+/);
        tokenStarts = [];
        tokenStart = 0;
        for (i = 0; i < tokens.length; i += 1) {
          token = tokens[i];
          if (!token) {
            continue;
          }
          idx = normalizedPdf.indexOf(token, tokenStart);
          if (idx >= 0) {
            tokenStarts.push({ token: token, start: idx });
            tokenStart = idx + token.length;
          }
        }

        for (i = 0; i < tokens.length; i += 1) {
          if (!tokens[i]) {
            continue;
          }
          score = getSimilarity(tokens[i], normalizedWord);
          if (score >= 0.78) {
            idx = normalizedPdf.indexOf(tokens[i]);
            if (idx >= 0) {
              infos.push({ start: idx, length: tokens[i].length });
              if (!allowMultiple) {
                return infos;
              }
            }
          }
          if (score > bestScore) {
            bestScore = score;
          }
        }

        for (i = 0; i < tokenStarts.length; i += 1) {
          token = tokenStarts[i].token;
          score = getSimilarity(token, normalizedWord);
          if (score >= 0.78) {
            infos.push({ start: tokenStarts[i].start, length: token.length });
            if (!allowMultiple) {
              return infos;
            }
          }
        }

        if (!infos.length && getSimilarity(normalizedPdf, normalizedWord) >= 0.85) {
          infos.push({ start: 0, length: Math.min(normalizedWord.length, normalizedPdf.length) });
        }

        return infos;
      }

      if (searchType === "EXACT") {
        if (normalizedPdf === normalizedWord) {
          infos.push({ start: 0, length: normalizedWord.length });
        }
        return infos;
      } else if (searchType === "STARTS_WITH") {
        if (normalizedPdf.indexOf(normalizedWord) === 0) {
          infos.push({ start: 0, length: normalizedWord.length });
        }
        return infos;
      } else if (searchType === "ENDS_WITH") {
        if (normalizedPdf.length >= normalizedWord.length &&
            normalizedPdf.lastIndexOf(normalizedWord) === normalizedPdf.length - normalizedWord.length) {
          infos.push({ start: normalizedPdf.length - normalizedWord.length, length: normalizedWord.length });
        }
        return infos;
      } else if (searchType === "PARTIAL") {
        hitIndexes = findAllIndexes(normalizedPdf, normalizedWord);
        for (i = 0; i < hitIndexes.length; i += 1) {
          infos.push({ start: hitIndexes[i], length: normalizedWord.length });
          if (!allowMultiple) {
            break;
          }
        }
        return infos;
      } else {
        idx = findWholeWordIndex(normalizedPdf, normalizedWord);
        if (idx >= 0) {
          infos.push({ start: idx, length: normalizedWord.length });
        }
        return infos;
      }
    }

    function collectMatchInfos(pdfText, words, searchType, allowMultiple) {
      var infos = [];
      var seen = {};
      var i;
      var wordInfos;
      var j;
      var info;
      var key;

      for (i = 0; i < words.length; i += 1) {
        wordInfos = getMatchInfosForWord(pdfText, words[i], searchType, allowMultiple);
        if (!wordInfos || !wordInfos.length) {
          continue;
        }
        for (j = 0; j < wordInfos.length; j += 1) {
          info = wordInfos[j];
          key = String(info.start) + ":" + String(info.length);
          if (!seen[key]) {
            seen[key] = true;
            infos.push(info);
            if (!allowMultiple) {
              return infos;
            }
          }
        }
      }

      return infos;
    }

    function applyHighlightStyle(left, top, width, height, baselineY) {
      var mode = String(cfg.highlight || "BACKGROUND").toUpperCase();
      var color = normalizeFillStyle(cfg.fillStyle);

      if (mode === "BOX") {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, width, height);
        ctx.restore();
        return;
      }

      if (mode === "UNDERLINE") {
        ctx.fillStyle = color;
        ctx.fillRect(left, baselineY + 2, width, 2);
        return;
      }

      if (mode === "STRIKE") {
        ctx.fillStyle = color;
        ctx.fillRect(left, top + (height / 2), width, 2);
        return;
      }

      if (mode === "FULL_BLOCK") {
        ctx.fillStyle = color;
        ctx.fillRect(left, baselineY, width, 5);
        return;
      }

      if (mode === "ROUNDED") {
        ctx.fillStyle = hexToRgba(color, 0.35);
        roundRect(ctx, left, top, width, height, 3);
        return;
      }

      ctx.fillStyle = hexToRgba(color, 0.4);
      ctx.fillRect(left, top, width, height);
    }

    function highlightWords(page, viewport) {
      var words = getActiveWords();
      var searchType = getSelectedSearchType();
      if (!words.length || !ctx) {
        return;
      }

      page.getTextContent().then(function (textContent) {
        (textContent.items || []).forEach(function (item) {
          var tx = window.pdfjsLib.Util.transform(
            window.pdfjsLib.Util.transform(viewport.transform, item.transform),
            [1, 0, 0, -1, 0, 0]
          );
          var pdfText = item.str || "";
          var matchInfos;
          var matchInfo;
          var i;
          var charWidth;
          var matchX;
          var matchWidth;
          var textHeight;
          var textTop;

          if (!pdfText) {
            return;
          }

          matchInfos = collectMatchInfos(pdfText, words, searchType, toBool(cfg.multipleWordsInLine));
          if (!matchInfos.length) {
            return;
          }

          charWidth = item.width / Math.max(1, pdfText.length);
          textHeight = Math.max(8, Math.abs((item.height || tx[3] || 10) * scale));
          textTop = tx[5] - textHeight;

          for (i = 0; i < matchInfos.length; i += 1) {
            matchInfo = matchInfos[i];
            matchX = tx[4] + (matchInfo.start * charWidth * scale);
            matchWidth = Math.max(1, matchInfo.length * charWidth * scale);
            applyHighlightStyle(matchX, textTop, matchWidth, textHeight, tx[5]);
          }
        });
      });
    }

    function renderSelectableTextLayer(page, viewport) {
      var layer;

      if (!hasSelectableTextLayer()) {
        removeTextLayer();
        return Promise.resolve();
      }

      layer = ensureTextLayer();
      if (!layer || !window.pdfjsLib || typeof window.pdfjsLib.renderTextLayer !== "function") {
        return Promise.resolve();
      }

      clearTextLayerTask();
      layer.innerHTML = "";
      layer.style.width = Math.ceil(viewport.width) + "px";
      layer.style.height = Math.ceil(viewport.height) + "px";

      return page.getTextContent().then(function (textContent) {
        var task;
        task = window.pdfjsLib.renderTextLayer({
          textContent: textContent,
          container: layer,
          viewport: viewport,
          textDivs: [],
          enhanceTextSelection: true
        });
        textLayerTask = task || null;
        if (task && task.promise && typeof task.promise.then === "function") {
          return task.promise;
        }
        return Promise.resolve();
      }).catch(function () {
        return Promise.resolve();
      });
    }

    function renderPage(num) {
      if (!pdfDoc) {
        return;
      }

      pageRendering = true;
      pdfDoc.getPage(num).then(function (page) {
        var viewport = page.getViewport({ scale: scale });

        if (hasSelectableTextLayer()) {
          ensurePageStage();
        } else {
          removeTextLayer();
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise.then(function () {
          pageRendering = false;
          renderSelectableTextLayer(page, viewport);
          if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
          }
          highlightWords(page, viewport);
        });

        setCounters(num, pdfDoc.numPages);
        updateNavButtons();
      });
    }

    function queueRenderPage(num) {
      if (pageRendering) {
        pageNumPending = num;
      } else {
        renderPage(num);
      }
    }

    function loadPdf(forceLoad) {
      var now = Date.now();

      if (state.inFlight) {
        return;
      }

      if (!forceLoad && now - state.lastCall < 3000) {
        return;
      }

      state.inFlight = true;
      state.lastCall = now;

      apex.server.plugin(
        cfg.ajaxIdentifier,
        {
          pageItems: cfg.itemsToSubmit || ""
        },
        {
          dataType: "json",
          success: function (data) {
            var url = data && data.url ? String(data.url) : "";
            var serverError = data && data.error ? String(data.error) : "";
            var sqlWords = data ? data.sqlWords : "";
            var jsonWords = data ? data.jsonWords : "";

            if (serverError) {
              if (window.console && window.console.error) {
                window.console.error("APEXRAD PDF Display AJAX error:", serverError);
              }
              pdfDoc = null;
              setCounters("", "");
              updateNavButtons();
              return;
            }

            cachedWords = mergeWords(sqlWords, jsonWords);
            url = normalizePdfUrl(url);

            if (!url) {
              pdfDoc = null;
              setCounters("", "");
              updateNavButtons();
              return;
            }

            if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
              // Local worker file; replace this plugin file in future when upgrading pdf.js.
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = resolveWorkerUrl(cfg.pdfWorkerUrl);
            }

            window.pdfjsLib.getDocument(url).promise.then(function (pdf) {
              pdfDoc = pdf;
              pageNum = 1;
              updateNavButtons();
              renderPage(pageNum);
            }).catch(function (err) {
              if (window.console && window.console.error) {
                window.console.error("APEXRAD PDF Display PDF load error:", err);
              }
              pdfDoc = null;
              setCounters("", "");
              updateNavButtons();
            });
          },
          complete: function () {
            state.inFlight = false;
          }
        }
      );
    }

    if (!region$.length) {
      return;
    }

    canvas = region$.find("#preview-pdfpane").get(0);
    if (!canvas) {
      return;
    }

    // Disable right-click on the PDF canvas.
    $(canvas).off("contextmenu.apexradPdfDisplay").on("contextmenu.apexradPdfDisplay", function (e) {
      e.preventDefault();
      return false;
    });

    ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    firstBtn$ = region$.find("#" + cfg.firstButtonId);
    prevBtn$ = region$.find("#" + cfg.prevButtonId);
    nextBtn$ = region$.find("#" + cfg.nextButtonId);
    lastBtn$ = region$.find("#" + cfg.lastButtonId);

    setTitle();
    searchInput$ = region$.find("#" + cfg.regionStaticId + "_search_word");
    searchButton$ = region$.find("#" + cfg.regionStaticId + "_search_btn");
    searchType$ = region$.find("#" + cfg.regionStaticId + "_search_type");
    zoomOut$ = region$.find("#" + cfg.regionStaticId + "_zoom_out");
    zoomIn$ = region$.find("#" + cfg.regionStaticId + "_zoom_in");
    zoomValue$ = region$.find("#" + cfg.regionStaticId + "_zoom_value");
    updateZoomLabel();

    if (String(cfg.direction || "LTR").toUpperCase() === "RTL") {
      region$.addClass("apexrad-pdfdisplay-rtl");
    } else {
      region$.removeClass("apexrad-pdfdisplay-rtl");
    }

    firstBtn$.off("click.apexradPdfDisplay").on("click.apexradPdfDisplay", function () {
      if (!pdfDoc || pageNum <= 1) {
        return;
      }
      pageNum = 1;
      queueRenderPage(pageNum);
    });

    prevBtn$.off("click.apexradPdfDisplay").on("click.apexradPdfDisplay", function () {
      if (!pdfDoc || pageNum <= 1) {
        return;
      }
      pageNum -= 1;
      queueRenderPage(pageNum);
    });

    nextBtn$.off("click.apexradPdfDisplay").on("click.apexradPdfDisplay", function () {
      if (!pdfDoc || pageNum >= pdfDoc.numPages) {
        return;
      }
      pageNum += 1;
      queueRenderPage(pageNum);
    });

    lastBtn$.off("click.apexradPdfDisplay").on("click.apexradPdfDisplay", function () {
      if (!pdfDoc || pageNum >= pdfDoc.numPages) {
        return;
      }
      pageNum = pdfDoc.numPages;
      queueRenderPage(pageNum);
    });

    if (toBool(cfg.displaySearch)) {
      searchInput$.off("keydown.apexradPdfDisplay")
        .on("keydown.apexradPdfDisplay", function (e) {
          if (e.key === "Enter" && pdfDoc) {
            e.preventDefault();
            applySearchWordFromInput();
          }
        });

      searchButton$.off("click.apexradPdfDisplay").on("click.apexradPdfDisplay", function () {
        applySearchWordFromInput();
      });

      searchType$.off("change.apexradPdfDisplay").on("change.apexradPdfDisplay", function () {
        if (pdfDoc) {
          queueRenderPage(pageNum);
        }
      });
    }

    if (toBool(cfg.displayZoom)) {
      zoomOut$.off("click.apexradPdfDisplay").on("click.apexradPdfDisplay", function () {
        adjustZoom(-10);
      });
      zoomIn$.off("click.apexradPdfDisplay").on("click.apexradPdfDisplay", function () {
        adjustZoom(10);
      });
    }

    updateNavButtons();
    loadPdf(true);

    region$.off("apexrefresh.apexradPdfDisplay").on("apexrefresh.apexradPdfDisplay", function (e) {
      if (e.target !== this) {
        return;
      }
      e.stopPropagation();
      loadPdf(false);
    });
  };
})(window, apex, apex.jQuery);
