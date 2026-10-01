/**
 * game.js — 2048 순수 게임 로직
 * DOM·localStorage 접근 없음. 입력 그리드를 변경하지 않음(새 배열 반환).
 * 전역 노출: window.Game2048
 */
(function () {
  'use strict';

  /**
   * 4×4 빈 그리드 생성
   * @returns {number[][]}
   */
  function createEmptyGrid() {
    return [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
  }

  /**
   * 길이 4 배열을 왼쪽으로 밀고 병합
   * @param {number[]} line
   * @returns {{ line: number[], gained: number, mergedIdx: number[] }}
   */
  function slideLine(line) {
    // 1. 0이 아닌 값만 추출
    var tiles = line.filter(function (v) { return v !== 0; });

    var result = [];
    var gained = 0;
    var mergedIdx = [];
    var i = 0;

    // 3. 병합 처리
    while (i < tiles.length) {
      if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
        var v = tiles[i] * 2;
        result.push(v);
        gained += v;
        mergedIdx.push(result.length - 1);
        i += 2;
      } else {
        result.push(tiles[i]);
        i += 1;
      }
    }

    // 4. 뒤를 0으로 채워 길이 4
    while (result.length < 4) {
      result.push(0);
    }

    return { line: result, gained: gained, mergedIdx: mergedIdx };
  }

  /**
   * 그리드의 한 방향 이동 처리
   * @param {number[][]} grid
   * @param {'left'|'right'|'up'|'down'} dir
   * @returns {{ grid: number[][], moved: boolean, gained: number, merged: Array<{r:number,c:number}> }}
   */
  function move(grid, dir) {
    // 원본 그리드 깊은 복사
    var newGrid = grid.map(function (row) { return row.slice(); });
    var totalGained = 0;
    var merged = [];

    if (dir === 'left') {
      for (var r = 0; r < 4; r++) {
        var res = slideLine(newGrid[r]);
        newGrid[r] = res.line;
        totalGained += res.gained;
        res.mergedIdx.forEach(function (c) {
          merged.push({ r: r, c: c });
        });
      }
    } else if (dir === 'right') {
      for (var r = 0; r < 4; r++) {
        var reversed = newGrid[r].slice().reverse();
        var res = slideLine(reversed);
        newGrid[r] = res.line.slice().reverse();
        totalGained += res.gained;
        res.mergedIdx.forEach(function (idx) {
          merged.push({ r: r, c: 3 - idx });
        });
      }
    } else if (dir === 'up') {
      for (var c = 0; c < 4; c++) {
        var col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]];
        var res = slideLine(col);
        for (var r = 0; r < 4; r++) {
          newGrid[r][c] = res.line[r];
        }
        totalGained += res.gained;
        res.mergedIdx.forEach(function (idx) {
          merged.push({ r: idx, c: c });
        });
      }
    } else if (dir === 'down') {
      for (var c = 0; c < 4; c++) {
        var col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]];
        var reversed = col.slice().reverse();
        var res = slideLine(reversed);
        var resultCol = res.line.slice().reverse();
        for (var r = 0; r < 4; r++) {
          newGrid[r][c] = resultCol[r];
        }
        totalGained += res.gained;
        res.mergedIdx.forEach(function (idx) {
          merged.push({ r: 3 - idx, c: c });
        });
      }
    }

    // moved 판정: 기존 그리드와 하나라도 다르면 true
    var moved = false;
    outer:
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (grid[r][c] !== newGrid[r][c]) {
          moved = true;
          break outer;
        }
      }
    }

    return {
      grid: newGrid,
      moved: moved,
      gained: totalGained,
      merged: merged,
    };
  }

  /**
   * 빈칸 중 무작위 1곳에 타일 추가 (90% 2, 10% 4)
   * @param {number[][]} grid
   * @returns {{ grid: number[][], pos: {r:number,c:number}|null }}
   */
  function addRandomTile(grid) {
    var empties = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (grid[r][c] === 0) {
          empties.push({ r: r, c: c });
        }
      }
    }

    if (empties.length === 0) {
      return { grid: grid.map(function (row) { return row.slice(); }), pos: null };
    }

    var idx = Math.floor(Math.random() * empties.length);
    var pos = empties[idx];
    var value = Math.random() < 0.9 ? 2 : 4;

    var newGrid = grid.map(function (row) { return row.slice(); });
    newGrid[pos.r][pos.c] = value;

    return { grid: newGrid, pos: pos };
  }

  /**
   * 2048 이상 타일 존재 여부
   * @param {number[][]} grid
   * @returns {boolean}
   */
  function hasWon(grid) {
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (grid[r][c] >= 2048) return true;
      }
    }
    return false;
  }

  /**
   * 이동 가능 여부 (빈칸 or 인접한 같은 값)
   * @param {number[][]} grid
   * @returns {boolean}
   */
  function canMove(grid) {
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (grid[r][c] === 0) return true;
        // 오른쪽 이웃
        if (c + 1 < 4 && grid[r][c] === grid[r][c + 1]) return true;
        // 아래쪽 이웃
        if (r + 1 < 4 && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  // 전역 노출
  window.Game2048 = {
    createEmptyGrid: createEmptyGrid,
    slideLine: slideLine,
    move: move,
    addRandomTile: addRandomTile,
    hasWon: hasWon,
    canMove: canMove,
  };
})();
