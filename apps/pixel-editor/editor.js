(function () {
  'use strict';

  var SIZE = 16;

  var DEFAULT_PALETTE = [
    '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
    '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
    '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
    '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30'
  ];

  function createGrid() {
    return new Array(256).fill(null);
  }

  function index(x, y) {
    return y * SIZE + x;
  }

  function inBounds(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }

  function setPixel(grid, x, y, color) {
    if (!inBounds(x, y)) return false;
    var i = index(x, y);
    if (grid[i] === color) return false;
    grid[i] = color;
    return true;
  }

  function lineCells(x0, y0, x1, y1) {
    var cells = [];
    var dx = Math.abs(x1 - x0);
    var sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0);
    var sy = y0 < y1 ? 1 : -1;
    var err = dx + dy;
    while (true) {
      cells.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return cells;
  }

  function isEmpty(grid) {
    for (var i = 0; i < grid.length; i++) {
      if (grid[i] !== null) return false;
    }
    return true;
  }

  function normalizeHex(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (/^#[0-9a-f]{3}$/.test(s)) {
      return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }
    return null;
  }

  function serialize(grid) {
    return { v: 1, size: 16, pixels: grid.slice() };
  }

  function deserialize(obj) {
    if (!obj || obj.v !== 1 || obj.size !== 16) return null;
    if (!Array.isArray(obj.pixels) || obj.pixels.length !== 256) return null;
    for (var i = 0; i < obj.pixels.length; i++) {
      var v = obj.pixels[i];
      if (v !== null && (typeof v !== 'string' || !/^#[0-9a-f]{6}$/.test(v))) return null;
    }
    return obj.pixels.slice();
  }

  function rgbaToCell(r, g, b, a) {
    if (a < 128) return null;
    var rh = r.toString(16).padStart(2, '0');
    var gh = g.toString(16).padStart(2, '0');
    var bh = b.toString(16).padStart(2, '0');
    return '#' + rh + gh + bh;
  }

  window.PixelEditor = {
    SIZE: SIZE,
    DEFAULT_PALETTE: DEFAULT_PALETTE,
    createGrid: createGrid,
    index: index,
    inBounds: inBounds,
    setPixel: setPixel,
    lineCells: lineCells,
    isEmpty: isEmpty,
    normalizeHex: normalizeHex,
    serialize: serialize,
    deserialize: deserialize,
    rgbaToCell: rgbaToCell
  };
})();
