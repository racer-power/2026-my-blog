(function () {
  'use strict';

  var PE = window.PixelEditor;

  // ===== State =====
  var grid;
  var tool = 'pencil';
  var currentColor = '#000000';
  var customColors = [];
  var drawing = false;
  var activePointerId = null;
  var lastCell = null;
  var strokeChanged = false;
  var cellPx = 0;

  // ===== DOM refs =====
  var canvas, ctx, wrap, statusEl, statusTimer;
  var toolPencil, toolEraser, currentColorEl, currentColorHexEl;
  var basePaletteEl, customPaletteEl, customEmpty;
  var colorPicker, addColorBtn, clearCustomBtn;
  var newBtn, loadBtn, loadInput, exportScale, exportBtn;

  // ===== Rendering state =====
  var rafPending = false;
  var checkerA = '#ffffff';
  var checkerB = '#e5e5e5';
  var gridLineColor = 'rgba(0,0,0,0.12)';

  // ===== Storage =====
  var storageWarned = false;

  function tryStorage(fn) {
    try {
      return fn();
    } catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        showStatus('자동 저장을 사용할 수 없습니다');
      }
      return undefined;
    }
  }

  function saveCanvas() {
    tryStorage(function () {
      localStorage.setItem('pixelEditor.canvas', JSON.stringify(PE.serialize(grid)));
    });
  }

  function saveCustomColors() {
    tryStorage(function () {
      localStorage.setItem('pixelEditor.customColors', JSON.stringify(customColors));
    });
  }

  function savePrefs() {
    tryStorage(function () {
      localStorage.setItem('pixelEditor.prefs', JSON.stringify({
        tool: tool,
        currentColor: currentColor,
        exportScale: exportScale ? exportScale.value : '16'
      }));
    });
  }

  // Storage access errors -> tryStorage (warn once). Bad JSON is NOT a storage
  // failure: it silently falls back to defaults (and must not consume the warning).
  function readJSON(key) {
    var raw = tryStorage(function () { return localStorage.getItem(key); });
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function loadFromStorage() {
    var g = PE.deserialize(readJSON('pixelEditor.canvas'));
    if (g) grid = g;

    var arr = readJSON('pixelEditor.customColors');
    if (Array.isArray(arr)) {
      customColors = arr.filter(function (c, i) {
        return typeof c === 'string' && /^#[0-9a-f]{6}$/.test(c) && arr.indexOf(c) === i;
      }).slice(-16);
    }

    var prefs = readJSON('pixelEditor.prefs');
    if (prefs && typeof prefs === 'object') {
      if (prefs.tool === 'pencil' || prefs.tool === 'eraser') {
        tool = prefs.tool;
      }
      if (typeof prefs.currentColor === 'string' && /^#[0-9a-f]{6}$/.test(prefs.currentColor)) {
        currentColor = prefs.currentColor;
      }
      if (exportScale && ['1', '8', '16', '32'].indexOf(String(prefs.exportScale)) !== -1) {
        exportScale.value = String(prefs.exportScale);
      }
    }
  }

  // ===== Status message =====
  function showStatus(msg) {
    if (statusTimer) clearTimeout(statusTimer);
    statusEl.textContent = msg;
    statusTimer = setTimeout(function () { statusEl.textContent = ''; }, 2000);
  }

  // ===== CSS color reading =====
  function readCSSColors() {
    var style = getComputedStyle(document.documentElement);
    checkerA = style.getPropertyValue('--checker-a').trim() || '#ffffff';
    checkerB = style.getPropertyValue('--checker-b').trim() || '#e5e5e5';
    gridLineColor = style.getPropertyValue('--grid-line').trim() || 'rgba(0,0,0,0.12)';
  }

  // ===== Rendering =====
  function render() {
    rafPending = false;
    if (!ctx || cellPx === 0) return;
    var S = cellPx;
    var N = 16;
    // Integer split so odd cellPx does not produce anti-aliased seams
    var h1 = Math.floor(S / 2);
    var h2 = S - h1;

    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var c = grid[PE.index(x, y)];
        if (c === null) {
          // Checkerboard: 2×2 sub-cells
          for (var sy = 0; sy < 2; sy++) {
            for (var sx = 0; sx < 2; sx++) {
              ctx.fillStyle = ((sx + sy) % 2 === 0) ? checkerA : checkerB;
              ctx.fillRect(x * S + sx * h1, y * S + sy * h1, sx ? h2 : h1, sy ? h2 : h1);
            }
          }
        } else {
          ctx.fillStyle = c;
          ctx.fillRect(x * S, y * S, S, S);
        }
      }
    }

    // Grid lines (fillRect for sharpness, no stroke)
    var dpr = window.devicePixelRatio || 1;
    var lineW = Math.max(1, Math.round(dpr));
    ctx.fillStyle = gridLineColor;
    for (var i = 1; i < N; i++) {
      ctx.fillRect(i * S, 0, lineW, canvas.height);
      ctx.fillRect(0, i * S, canvas.width, lineW);
    }
  }

  function scheduleRender() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(render);
    }
  }

  function resizeCanvas() {
    var cssSize = wrap.clientWidth;
    if (cssSize === 0) return;
    var dpr = window.devicePixelRatio || 1;
    cellPx = Math.max(1, Math.floor(cssSize * dpr / 16));
    canvas.width = cellPx * 16;
    canvas.height = cellPx * 16;
    render();
  }

  // ===== Input helpers =====
  function eventToCell(e) {
    var r = canvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / r.width * 16);
    var y = Math.floor((e.clientY - r.top) / r.height * 16);
    return PE.inBounds(x, y) ? { x: x, y: y } : null;
  }

  function paint(x, y, color) {
    if (PE.setPixel(grid, x, y, color)) {
      strokeChanged = true;
      scheduleRender();
    }
  }

  var strokeColor = null;

  // ===== Pointer events =====
  function onDown(e) {
    if (drawing || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // pointer already gone (InvalidStateError/NotFoundError): keep drawing without capture
    }
    drawing = true;
    activePointerId = e.pointerId;
    strokeChanged = false;

    strokeColor = (tool === 'eraser' || e.button === 2) ? null : currentColor;

    var cell = eventToCell(e);
    if (cell) {
      paint(cell.x, cell.y, strokeColor);
      lastCell = cell;
    }
  }

  function onMove(e) {
    if (!drawing || e.pointerId !== activePointerId) return;
    var coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    var events = (coalesced && coalesced.length > 0) ? coalesced : [e];

    for (var ei = 0; ei < events.length; ei++) {
      var ev = events[ei];
      var cell = eventToCell(ev);
      if (!cell) continue;
      if (lastCell) {
        if (cell.x !== lastCell.x || cell.y !== lastCell.y) {
          var line = PE.lineCells(lastCell.x, lastCell.y, cell.x, cell.y);
          for (var li = 0; li < line.length; li++) {
            paint(line[li][0], line[li][1], strokeColor);
          }
        }
      } else {
        paint(cell.x, cell.y, strokeColor);
      }
      lastCell = cell;
    }
  }

  function onUp(e) {
    if (e.pointerId !== activePointerId) return;
    drawing = false;
    lastCell = null;
    activePointerId = null;
    if (strokeChanged) {
      saveCanvas();
    }
  }

  // ===== Tool management =====
  function setTool(t) {
    tool = t;
    toolPencil.classList.toggle('is-active', t === 'pencil');
    toolEraser.classList.toggle('is-active', t === 'eraser');
    toolPencil.setAttribute('aria-pressed', t === 'pencil' ? 'true' : 'false');
    toolEraser.setAttribute('aria-pressed', t === 'eraser' ? 'true' : 'false');
    savePrefs();
  }

  // ===== Color selection =====
  function updateCurrentColorDisplay() {
    currentColorEl.style.background = currentColor;
    currentColorHexEl.textContent = currentColor;
  }

  function updateSelectedSwatch() {
    var found = false;
    var allSwatches = document.querySelectorAll('.swatch');
    for (var i = 0; i < allSwatches.length; i++) {
      var s = allSwatches[i];
      if (!found && s.dataset.color === currentColor) {
        s.classList.add('is-selected');
        found = true;
      } else {
        s.classList.remove('is-selected');
      }
    }
  }

  function selectColor(color, swatchEl) {
    currentColor = color;
    updateCurrentColorDisplay();
    // Clear all selections
    var allSwatches = document.querySelectorAll('.swatch');
    for (var i = 0; i < allSwatches.length; i++) {
      allSwatches[i].classList.remove('is-selected');
    }
    if (swatchEl) swatchEl.classList.add('is-selected');
    setTool('pencil'); // also saves prefs
  }

  // ===== Palette rendering =====
  function createSwatch(color) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.color = color;
    btn.title = color;
    btn.setAttribute('aria-label', color);
    btn.style.background = color;
    btn.addEventListener('click', function () { selectColor(color, btn); });
    return btn;
  }

  function renderBasePalette() {
    while (basePaletteEl.firstChild) basePaletteEl.removeChild(basePaletteEl.firstChild);
    PE.DEFAULT_PALETTE.forEach(function (color) {
      basePaletteEl.appendChild(createSwatch(color));
    });
    updateSelectedSwatch();
  }

  function renderCustomPalette() {
    while (customPaletteEl.firstChild) customPaletteEl.removeChild(customPaletteEl.firstChild);
    customColors.forEach(function (color) {
      customPaletteEl.appendChild(createSwatch(color));
    });
    if (customColors.length === 0) {
      customEmpty.removeAttribute('hidden');
    } else {
      customEmpty.setAttribute('hidden', '');
    }
    updateSelectedSwatch();
  }

  // ===== Export =====
  function timestamp() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, '0'); }
    return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  function exportPNG() {
    if (PE.isEmpty(grid)) {
      showStatus('그릴 내용이 없습니다');
      return;
    }
    var scale = parseInt(exportScale.value, 10);
    var off = document.createElement('canvas');
    off.width = 16 * scale;
    off.height = 16 * scale;
    var octx = off.getContext('2d');
    octx.imageSmoothingEnabled = false;
    grid.forEach(function (c, i) {
      if (!c) return;
      octx.fillStyle = c;
      octx.fillRect((i % 16) * scale, Math.floor(i / 16) * scale, scale, scale);
    });
    var url = off.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pixel-art-' + timestamp() + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showStatus('PNG를 저장했습니다');
  }

  // ===== Load image =====
  function loadFile(file) {
    if (!file) return;
    if (!PE.isEmpty(grid)) {
      if (!confirm('현재 그림을 불러온 이미지로 바꿀까요?')) {
        loadInput.value = '';
        return;
      }
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var imageData;
        try {
          var off = document.createElement('canvas');
          off.width = 16;
          off.height = 16;
          var octx = off.getContext('2d');
          octx.imageSmoothingEnabled = false;
          octx.drawImage(img, 0, 0, 16, 16);
          imageData = octx.getImageData(0, 0, 16, 16);
        } catch (err) {
          // e.g. SecurityError from a tainted canvas (some SVG files)
          showStatus('이미지를 불러올 수 없습니다');
          loadInput.value = '';
          return;
        }
        var newGrid = PE.createGrid();
        for (var i = 0; i < 256; i++) {
          var r = imageData.data[i * 4];
          var g = imageData.data[i * 4 + 1];
          var b = imageData.data[i * 4 + 2];
          var a = imageData.data[i * 4 + 3];
          newGrid[i] = PE.rgbaToCell(r, g, b, a);
        }
        grid = newGrid;
        render();
        saveCanvas();
        var isExact = (img.naturalWidth === img.naturalHeight) && (img.naturalWidth % 16 === 0);
        if (!isExact) {
          showStatus('16×16으로 변환해 불러왔습니다');
        } else {
          showStatus('불러오기 완료');
        }
        loadInput.value = '';
      };
      img.onerror = function () {
        showStatus('이미지를 불러올 수 없습니다');
        loadInput.value = '';
      };
      img.src = e.target.result;
    };
    reader.onerror = function () {
      showStatus('이미지를 불러올 수 없습니다');
      loadInput.value = '';
    };
    reader.readAsDataURL(file);
  }

  // ===== Init =====
  function init() {
    canvas = document.getElementById('pixel-canvas');
    ctx = canvas.getContext('2d');
    wrap = document.getElementById('canvas-wrap');
    statusEl = document.getElementById('status');
    toolPencil = document.getElementById('tool-pencil');
    toolEraser = document.getElementById('tool-eraser');
    currentColorEl = document.getElementById('current-color');
    currentColorHexEl = document.getElementById('current-color-hex');
    basePaletteEl = document.getElementById('base-palette');
    customPaletteEl = document.getElementById('custom-palette');
    customEmpty = document.getElementById('custom-empty');
    colorPicker = document.getElementById('color-picker');
    addColorBtn = document.getElementById('add-color-btn');
    clearCustomBtn = document.getElementById('clear-custom-btn');
    newBtn = document.getElementById('new-btn');
    loadBtn = document.getElementById('load-btn');
    loadInput = document.getElementById('load-input');
    exportScale = document.getElementById('export-scale');
    exportBtn = document.getElementById('export-btn');

    // Initialize grid then load saved state
    grid = PE.createGrid();
    loadFromStorage();

    // Read CSS custom properties for rendering
    readCSSColors();
    var darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
    if (darkMQ.addEventListener) {
      darkMQ.addEventListener('change', function () {
        readCSSColors();
        render();
      });
    } else if (darkMQ.addListener) {
      // older Safari
      darkMQ.addListener(function () {
        readCSSColors();
        render();
      });
    }

    // Render palettes
    renderBasePalette();
    renderCustomPalette();

    // Sync UI to loaded state
    updateCurrentColorDisplay();
    toolPencil.classList.toggle('is-active', tool === 'pencil');
    toolEraser.classList.toggle('is-active', tool === 'eraser');
    toolPencil.setAttribute('aria-pressed', tool === 'pencil' ? 'true' : 'false');
    toolEraser.setAttribute('aria-pressed', tool === 'eraser' ? 'true' : 'false');

    // Set up canvas sizing with ResizeObserver (or fallback)
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () { resizeCanvas(); });
      ro.observe(wrap);
    } else {
      window.addEventListener('resize', resizeCanvas);
    }
    resizeCanvas(); // Initial size immediately

    // ===== Canvas pointer events =====
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('lostpointercapture', onUp);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // ===== Tool buttons =====
    toolPencil.addEventListener('click', function () { setTool('pencil'); });
    toolEraser.addEventListener('click', function () { setTool('eraser'); });

    // ===== Keyboard shortcuts =====
    document.addEventListener('keydown', function (e) {
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // keep browser shortcuts (Ctrl+E etc.)
      // e.code fallback: with the Korean IME active, e.key is a jamo, not 'b'/'e'
      if (e.key === 'b' || e.key === 'B' || e.code === 'KeyB') setTool('pencil');
      else if (e.key === 'e' || e.key === 'E' || e.code === 'KeyE') setTool('eraser');
    });

    // ===== Color picker input (live preview) =====
    colorPicker.addEventListener('input', function () {
      var c = PE.normalizeHex(colorPicker.value);
      if (!c) return;
      currentColor = c;
      updateCurrentColorDisplay();
      // Deselect all swatches — no swatch represents the picker color
      var allSwatches = document.querySelectorAll('.swatch');
      for (var i = 0; i < allSwatches.length; i++) {
        allSwatches[i].classList.remove('is-selected');
      }
      setTool('pencil');
    });

    // ===== Add custom color =====
    addColorBtn.addEventListener('click', function () {
      var c = PE.normalizeHex(colorPicker.value);
      if (!c) return;

      // Already in base palette?
      var baseIdx = PE.DEFAULT_PALETTE.indexOf(c);
      if (baseIdx !== -1) {
        var baseSwatches = basePaletteEl.querySelectorAll('.swatch');
        selectColor(c, baseSwatches[baseIdx] || null);
        return;
      }

      // Already in custom colors?
      var customIdx = customColors.indexOf(c);
      if (customIdx !== -1) {
        var customSwatches = customPaletteEl.querySelectorAll('.swatch');
        selectColor(c, customSwatches[customIdx] || null);
        return;
      }

      // Add new color
      customColors.push(c);
      if (customColors.length > 16) {
        customColors.shift();
      }
      saveCustomColors();
      renderCustomPalette();

      // Select the newly added swatch
      var newSwatches = customPaletteEl.querySelectorAll('.swatch');
      var lastSwatch = newSwatches[newSwatches.length - 1] || null;
      selectColor(c, lastSwatch);
    });

    // ===== Clear custom colors =====
    clearCustomBtn.addEventListener('click', function () {
      if (customColors.length === 0) return;
      if (!confirm('내 색상을 모두 삭제할까요?')) return;
      customColors = [];
      saveCustomColors();
      renderCustomPalette();
    });

    // ===== New canvas =====
    newBtn.addEventListener('click', function () {
      if (!PE.isEmpty(grid)) {
        if (!confirm('현재 그림을 지우고 새로 시작할까요?')) return;
      }
      grid = PE.createGrid();
      render();
      saveCanvas();
      showStatus('새 캔버스');
    });

    // ===== Load file =====
    loadBtn.addEventListener('click', function () { loadInput.click(); });
    loadInput.addEventListener('change', function () {
      if (loadInput.files && loadInput.files[0]) {
        loadFile(loadInput.files[0]);
      }
    });

    // ===== Export PNG =====
    exportBtn.addEventListener('click', exportPNG);
    exportScale.addEventListener('change', function () { savePrefs(); });

    // ===== Auto-save on page hide =====
    window.addEventListener('pagehide', function () {
      saveCanvas();
      saveCustomColors();
      savePrefs();
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
