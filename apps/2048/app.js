/**
 * app.js — 렌더링, 입력(키보드/터치), localStorage, 게임 흐름
 * IIFE로 감싸 전역 오염 방지.
 */
(function () {
  'use strict';

  /* ===== DOM 참조 ===== */
  var board       = document.getElementById('board');
  var tilesEl     = document.getElementById('tiles');
  var scoreEl     = document.getElementById('score');
  var bestEl      = document.getElementById('best');
  var overlay     = document.getElementById('overlay');
  var overlayMsg  = document.getElementById('overlay-message');
  var keepBtn     = document.getElementById('keep-playing');
  var tryBtn      = document.getElementById('try-again');
  var newBtn      = document.getElementById('new-game');
  var gridBg      = document.querySelector('.grid-bg');

  /* ===== 빈 셀 16개 생성 ===== */
  for (var i = 0; i < 16; i++) {
    var cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.cssText = 'background:var(--cell-bg);border-radius:6px;';
    gridBg.appendChild(cell);
  }

  /* ===== 상태 ===== */
  var grid        = Game2048.createEmptyGrid();
  var score       = 0;
  var best        = 0;
  var won         = false;   // 승리 오버레이를 이미 표시했는지
  var keepPlaying = false;   // 승리 후 계속하기 선택 여부
  var over        = false;   // 게임 오버

  /* 병합/새 타일 위치 추적 (render에서 애니메이션 클래스 부여) */
  var pendingMerged = []; // [{r,c}]
  var pendingNew    = null; // {r,c} | null

  /* ===== localStorage ===== */
  var BEST_KEY = '2048-best-score';

  function loadBest() {
    try {
      var val = parseInt(localStorage.getItem(BEST_KEY), 10);
      best = isNaN(val) ? 0 : val;
    } catch (e) {
      best = 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (e) {
      /* 실패 시 메모리 값만 사용 */
    }
  }

  /* ===== 렌더 ===== */
  function render() {
    // 타일 레이어 비우기
    tilesEl.innerHTML = '';

    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var val = grid[r][c];
        if (val === 0) continue;

        var tileClass = 'tile tile-' + (val > 2048 ? 'super' : val);

        // 애니메이션 클래스 결정
        var isNew    = pendingNew    && pendingNew.r    === r && pendingNew.c    === c;
        var isMerged = pendingMerged.some(function (m) { return m.r === r && m.c === c; });

        if (isNew)    tileClass += ' tile-new';
        if (isMerged) tileClass += ' tile-merged';

        var el = document.createElement('div');
        el.className = tileClass;
        el.textContent = val;
        el.style.gridRow    = r + 1;
        el.style.gridColumn = c + 1;
        tilesEl.appendChild(el);
      }
    }

    // 점수 갱신
    scoreEl.textContent = score;
    bestEl.textContent  = best;
  }

  /* ===== 오버레이 ===== */
  function showOverlay(msg, showKeep) {
    overlayMsg.textContent = msg;
    if (showKeep) {
      keepBtn.classList.remove('hidden');
    } else {
      keepBtn.classList.add('hidden');
    }
    overlay.classList.remove('hidden', 'win');
    if (showKeep) {
      overlay.classList.add('win');
    }
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
    overlay.classList.remove('win');
  }

  /* ===== 새 게임 ===== */
  function newGame() {
    score       = 0;
    won         = false;
    keepPlaying = false;
    over        = false;
    pendingMerged = [];
    pendingNew    = null;

    var g1 = Game2048.createEmptyGrid();
    var r1 = Game2048.addRandomTile(g1);
    var r2 = Game2048.addRandomTile(r1.grid);
    grid = r2.grid;

    hideOverlay();
    render();
    board.focus({ preventScroll: true });
  }

  /* ===== 이동 처리 ===== */
  function handleMove(dir) {
    // 게임 오버 상태이거나, 승리 오버레이 표시 중이고 keepPlaying이 false면 무시
    if (over) return;
    if (won && !keepPlaying) return;

    var result = Game2048.move(grid, dir);
    if (!result.moved) return;

    // 점수 업데이트
    score += result.gained;
    if (score > best) {
      best = score;
      saveBest();
    }

    // 새 타일 추가
    var tileResult = Game2048.addRandomTile(result.grid);
    grid = tileResult.grid;

    // 애니메이션 정보 저장
    pendingMerged = result.merged;
    pendingNew    = tileResult.pos;

    // 렌더
    render();

    // 승리 판정 (아직 승리 오버레이를 안 띄운 경우)
    if (!won && Game2048.hasWon(grid)) {
      won = true;
      showOverlay('2048 달성! 🎉', true);
      return;
    }

    // 게임 오버 판정
    if (!Game2048.canMove(grid)) {
      over = true;
      showOverlay('게임 오버!', false);
    }
  }

  /* ===== 키보드 입력 ===== */
  var keyMap = {
    ArrowLeft:  'left',
    ArrowRight: 'right',
    ArrowUp:    'up',
    ArrowDown:  'down',
  };

  document.addEventListener('keydown', function (e) {
    var dir = keyMap[e.key];
    if (!dir) return;
    e.preventDefault();
    handleMove(dir);
  });

  /* ===== 터치 스와이프 ===== */
  var touchStartX = 0;
  var touchStartY = 0;
  var touchActive = false; // 한 손가락 스와이프 진행 중 여부

  board.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) {
      touchActive = false; // 멀티 터치가 섞이면 이번 제스처는 무시
      return;
    }
    touchActive = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    board.focus({ preventScroll: true });
  });

  board.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });

  board.addEventListener('touchcancel', function () {
    touchActive = false;
  });

  board.addEventListener('touchend', function (e) {
    if (!touchActive || e.changedTouches.length === 0) return;
    touchActive = false;
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 30) return;

    var dir;
    if (absDx > absDy) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }
    handleMove(dir);
  });

  /* ===== 보드 클릭 시 포커스 ===== */
  board.addEventListener('click', function () {
    board.focus({ preventScroll: true });
  });

  /* ===== 버튼 이벤트 ===== */
  newBtn.addEventListener('click', function () {
    newGame();
  });

  tryBtn.addEventListener('click', function () {
    newGame();
  });

  keepBtn.addEventListener('click', function () {
    keepPlaying = true;
    hideOverlay();
    board.focus({ preventScroll: true });
    // keepPlaying 후에도 이동 불가면 바로 게임 오버
    if (!Game2048.canMove(grid)) {
      over = true;
      showOverlay('게임 오버!', false);
    }
  });

  /* ===== 초기화 ===== */
  loadBest();
  newGame();
})();
