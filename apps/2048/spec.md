# 2048 퍼즐 게임 — 구현 명세 (spec.md)

> Build 서브에이전트는 이 문서만 보고 구현한다. 수정 범위는 `/apps/2048/` 폴더 내부로 한정한다. 블로그의 다른 파일(`/index.html`, `/css`, `/js`, `/posts`)은 건드리지 않는다.

## 0. 개요

- 4×4 그리드에서 방향키(←↑→↓) 또는 터치 스와이프로 타일을 밀어 같은 숫자를 합치는 게임
- 순수 HTML / CSS / JavaScript (외부 라이브러리, CDN, 빌드 도구 없음)
- 자체 완결: 블로그 CSS/JS를 참조하지 않는다. 이후 Embed 단계에서 블로그 메인 페이지에 `<iframe>`으로 삽입되므로 iframe 안에서도 정상 동작해야 한다.
- `index.html`을 더블클릭(file://)으로 열어도 동작해야 한다.

### 범위 밖 (구현하지 않음)
- 타일 슬라이딩(이동 경로) 애니메이션 — 등장/병합 애니메이션만 구현
- 되돌리기(Undo), 진행 중 게임 상태 저장/복원, 사운드, 그리드 크기 변경

---

## 1. 파일 구조

```
/apps/2048/
├── spec.md      # 이 문서 (수정 금지)
├── index.html   # 마크업 (헤더, 점수판, 보드, 오버레이)
├── style.css    # 레이아웃, 색상 팔레트, 반응형, 애니메이션
├── game.js      # 순수 게임 로직 (DOM 접근 없음)
└── app.js       # 렌더링, 입력(키보드/터치), localStorage, 게임 흐름
```

스크립트 로드 순서: `game.js` → `app.js` (둘 다 `<body>` 끝에서 일반 `<script>`로 로드).
**ES 모듈(`type="module"`)을 쓰지 않는다** — file:// 환경에서 CORS로 실패한다.

---

## 2. 파일별 역할과 기능 목록

### 2.1 `index.html`
- `<!DOCTYPE html>`, `lang="ko"`, `<meta charset="UTF-8">`
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">` (모바일 더블탭 줌 방지)
- `<title>2048</title>`, `style.css` 링크
- 구조 (id/class 이름은 아래를 그대로 사용):

```html
<div class="app">
  <header class="game-header">
    <h1 class="title">2048</h1>
    <div class="scores">
      <div class="score-box"><span class="score-label">점수</span><span id="score" class="score-value">0</span></div>
      <div class="score-box"><span class="score-label">최고</span><span id="best" class="score-value">0</span></div>
    </div>
  </header>

  <div class="game-intro">
    <p class="hint">같은 숫자를 합쳐 <strong>2048</strong>을 만드세요!</p>
    <button id="new-game" class="btn" type="button">새 게임</button>
  </div>

  <div id="board" class="board" tabindex="0" aria-label="2048 게임 보드">
    <div class="grid-bg"><!-- 16개의 .cell (app.js가 생성하거나 HTML에 직접 작성) --></div>
    <div id="tiles" class="tile-layer"></div>

    <div id="overlay" class="overlay hidden" role="dialog" aria-live="polite">
      <p id="overlay-message" class="overlay-message"></p>
      <div class="overlay-actions">
        <button id="keep-playing" class="btn hidden" type="button">계속하기</button>
        <button id="try-again" class="btn" type="button">다시 하기</button>
      </div>
    </div>
  </div>

  <p class="instructions">방향키 또는 스와이프로 타일을 이동하세요.</p>
</div>
<script src="game.js"></script>
<script src="app.js"></script>
```

### 2.2 `style.css`
- CSS 변수로 팔레트/크기 정의 (4장 참고)
- 보드 크기: `--board-size: min(92vw, 460px, 70vh);` (가로·세로 모두 화면에 들어오도록)
- 간격: `--gap: calc(var(--board-size) * 0.03);`
- 셀 크기: `--cell: calc((var(--board-size) - var(--gap) * 5) / 4);`
- `.board`: `position: relative; width/height: var(--board-size); padding: var(--gap); border-radius; background: var(--board-bg); touch-action: none; user-select: none;`
- `.grid-bg`와 `.tile-layer`는 **동일한 CSS Grid** (`grid-template: repeat(4, 1fr) / repeat(4, 1fr); gap: var(--gap);`)이며 `.tile-layer`는 `position: absolute; inset: var(--gap);`로 겹친다.
- 타일 위치는 `grid-row` / `grid-column`으로 지정 (absolute 좌표 계산 불필요)
- `.tile`: 가운데 정렬, `border-radius`, 굵은 글씨, 값별 배경/글자색 (`.tile-2` … `.tile-2048`, `.tile-super`)
- 글자 크기는 자릿수별 클래스로 조정:
  - 1~2자리: `calc(var(--cell) * 0.45)`
  - 3자리 (`.tile-128`~`.tile-512`): `calc(var(--cell) * 0.38)`
  - 4자리 (`.tile-1024`, `.tile-2048`): `calc(var(--cell) * 0.30)`
  - 5자리 이상 (`.tile-super`): `calc(var(--cell) * 0.24)`
- 애니메이션:
  - `.tile-new`: `@keyframes appear` — scale 0 → 1, 200ms
  - `.tile-merged`: `@keyframes pop` — scale 1 → 1.2 → 1, 200ms
- `.overlay`: `position: absolute; inset: 0;` 반투명 배경(`rgba(238,228,218,0.73)`), 메시지 + 버튼 가운데 정렬, 페이드인. 승리 시 `.overlay.win`은 금색 반투명(`rgba(237,194,46,0.5)`) + 흰 글씨
- `.hidden { display: none !important; }`
- 반응형: `@media (max-width: 480px)` — 타이틀/점수판 글자 축소, 헤더 여백 축소. 최소 지원 폭 320px에서 가로 스크롤이 생기지 않아야 한다.
- 버튼 `:focus-visible` 스타일 제공, 버튼 최소 터치 영역 44px

### 2.3 `game.js` — 순수 로직 (DOM, localStorage 접근 금지)
전역 객체 하나만 노출: `window.Game2048 = { ... }`

| 함수 | 설명 |
|---|---|
| `createEmptyGrid()` | 4×4 배열 `number[][]`, 빈칸은 `0` |
| `slideLine(line)` | 길이 4 배열을 **왼쪽으로** 밀고 병합. `{ line, gained, mergedIdx }` 반환 (`mergedIdx`: 병합이 일어난 결과 인덱스 배열) |
| `move(grid, dir)` | `dir ∈ 'left'\|'right'\|'up'\|'down'`. 원본을 변경하지 않고 `{ grid, moved, gained, merged }` 반환. `merged`: 병합된 셀 좌표 `[{r,c}]` |
| `addRandomTile(grid)` | 빈칸 중 무작위 1곳에 90% `2`, 10% `4`를 놓은 새 그리드와 위치 `{ grid, pos:{r,c} \| null }` 반환 |
| `hasWon(grid)` | 2048 이상 타일 존재 여부 |
| `canMove(grid)` | 빈칸이 있거나 가로/세로로 인접한 같은 값이 있으면 `true` |

### 2.4 `app.js` — UI와 게임 흐름
- 상태: `grid`, `score`, `best`, `won`(승리 메시지 표시 여부), `keepPlaying`, `over`
- `newGame()`: 빈 그리드 → 랜덤 타일 2개 → 점수 0 → 오버레이 숨김 → 렌더 → `board.focus()`
- `handleMove(dir)`:
  1. `over`이거나 (승리 오버레이가 떠 있고 `keepPlaying`이 false)면 무시
  2. `Game2048.move()` 호출, `moved === false`면 아무것도 하지 않음 (타일도 생성하지 않음)
  3. 점수 += `gained`, 최고 점수 갱신 시 localStorage 저장
  4. `addRandomTile()` → 렌더 (새 타일은 `.tile-new`, 병합 셀은 `.tile-merged`)
  5. `!won && hasWon(grid)` → `won = true`, 승리 오버레이 ("2048 달성! 🎉" — 이모지 선택 사항, "계속하기" + "다시 하기" 버튼)
  6. `!canMove(grid)` → `over = true`, 게임 오버 오버레이 ("게임 오버!", "다시 하기" 버튼만)
- `render()`: `#tiles` 비우고 값이 0이 아닌 셀마다 `<div class="tile tile-{값}">` 생성 (값 > 2048이면 `tile-super`), `style.gridRow = r+1`, `style.gridColumn = c+1`. 점수/최고 점수 텍스트 갱신
- 키보드: `document`에 `keydown` 리스너. `ArrowLeft/Right/Up/Down` 매핑 → `e.preventDefault()` 후 `handleMove`. 다른 키는 무시. `e.repeat` 허용
- 터치 스와이프 (`#board`에 바인딩):
  - `touchstart`: 시작 좌표 저장 (`e.touches.length > 1`이면 무시)
  - `touchmove`: `{ passive: false }`로 등록하고 `e.preventDefault()` (페이지 스크롤/당겨서 새로고침 방지)
  - `touchend`: `e.changedTouches[0]`로 dx, dy 계산. `max(|dx|,|dy|) < 30px`이면 무시. `|dx| > |dy|`면 좌/우, 아니면 상/하
- 버튼: `#new-game`, `#try-again` → `newGame()`. `#keep-playing` → `keepPlaying = true`, 오버레이 숨김, 보드 포커스
- 최고 점수 저장 키: `"2048-best-score"`. 읽기/쓰기 모두 `try/catch`로 감싸고 실패 시 메모리 값만 사용. 읽은 값은 `parseInt` 후 `NaN`이면 0

---

## 3. 핵심 알고리즘

### 3.1 한 줄 밀기 + 병합 (`slideLine`) — 모든 방향의 기본 단위
```
입력: [a, b, c, d] (왼쪽으로 민다고 가정)
1. tiles = 0이 아닌 값만 순서대로 추출
2. result = [], gained = 0, mergedIdx = []
3. i = 0부터:
     if tiles[i] === tiles[i+1]:
         v = tiles[i] * 2
         result.push(v); gained += v; mergedIdx.push(result.length - 1)
         i += 2            // 병합된 타일은 이번 이동에서 다시 병합되지 않음
     else:
         result.push(tiles[i]); i += 1
4. result 뒤를 0으로 채워 길이 4
5. return { line: result, gained, mergedIdx }
```

필수 검증 케이스 (Review에서 콘솔로 확인 가능해야 함):

| 입력 | 결과 | gained |
|---|---|---|
| `[2,2,2,2]` | `[4,4,0,0]` | 8 |
| `[2,2,4,0]` | `[4,4,0,0]` | 4 (연쇄 병합 없음) |
| `[4,0,0,4]` | `[8,0,0,0]` | 8 |
| `[2,2,2,0]` | `[4,2,0,0]` | 4 (이동 방향 쪽부터 병합) |
| `[0,0,0,2]` | `[2,0,0,0]` | 0 |
| `[2,4,2,4]` | `[2,4,2,4]` | 0 (moved = false) |

### 3.2 방향 처리 (`move`)
각 방향을 "왼쪽 밀기"로 변환한다.
- `left`: 각 행 `grid[r]` 그대로
- `right`: 각 행을 뒤집어 처리 후 다시 뒤집기
- `up`: 각 열 `[grid[0][c], grid[1][c], grid[2][c], grid[3][c]]`
- `down`: 각 열을 뒤집어 처리 후 다시 뒤집기

처리 결과를 새 그리드에 써넣고, `mergedIdx`도 같은 규칙으로 원래 좌표 `{r,c}`로 되돌린다 (뒤집은 경우 인덱스 `i → 3 - i`).
`moved` = 새 그리드와 기존 그리드가 한 칸이라도 다르면 `true`.

### 3.3 점수
- 병합 시 **생성된 타일 값**만큼 가산 (2+2 → +4, 4+4 → +8)
- 이동 1회의 `gained`는 해당 이동에서 발생한 모든 병합 값의 합
- `score > best`이면 `best = score` 후 즉시 localStorage 저장

### 3.4 타일 생성
- 게임 시작 시 2개, 이후 **유효한 이동(moved === true)마다** 1개
- 빈칸 목록에서 `Math.floor(Math.random() * n)`으로 선택, 값은 `Math.random() < 0.9 ? 2 : 4`

### 3.5 판정
- 승리: 이동 후 2048 이상 타일이 처음 생기면 1회만 승리 오버레이. "계속하기" 선택 시 이후로는 다시 띄우지 않음
- 게임 오버: 타일 생성 후 `canMove(grid) === false`
  - `canMove`: 빈칸(0) 존재 → true, 또는 어떤 셀이 오른쪽/아래 이웃과 값이 같으면 → true, 그 외 false
- 승리와 게임 오버가 동시에 성립하면 승리 오버레이를 우선 표시하고, "계속하기"를 눌러도 이동이 불가하면 바로 게임 오버를 표시한다 (`keepPlaying` 처리 시 `canMove` 재검사)

---

## 4. CSS 색상 팔레트

### 4.1 UI 색상 (`:root` 변수)
| 변수 | 값 | 용도 |
|---|---|---|
| `--page-bg` | `#faf8ef` | 페이지 배경 |
| `--text` | `#776e65` | 기본 글자 |
| `--board-bg` | `#bbada0` | 보드 배경 |
| `--cell-bg` | `rgba(238, 228, 218, 0.35)` | 빈 셀 |
| `--btn-bg` | `#8f7a66` | 버튼 배경 |
| `--btn-text` | `#f9f6f2` | 버튼 글자 |
| `--score-bg` | `#bbada0` | 점수 박스 |
| `--score-label` | `#eee4da` | 점수 라벨 |
| `--light-text` | `#f9f6f2` | 진한 타일 위 글자 |

### 4.2 타일 값별 색상
| 값 | 배경 | 글자 | 비고 |
|---|---|---|---|
| 2 | `#eee4da` | `#776e65` | |
| 4 | `#ede0c8` | `#776e65` | |
| 8 | `#f2b179` | `#f9f6f2` | |
| 16 | `#f59563` | `#f9f6f2` | |
| 32 | `#f67c5f` | `#f9f6f2` | |
| 64 | `#f65e3b` | `#f9f6f2` | |
| 128 | `#edcf72` | `#f9f6f2` | `box-shadow: 0 0 10px rgba(243,215,116,0.24)` |
| 256 | `#edcc61` | `#f9f6f2` | `box-shadow: 0 0 15px rgba(243,215,116,0.32)` |
| 512 | `#edc850` | `#f9f6f2` | `box-shadow: 0 0 20px rgba(243,215,116,0.40)` |
| 1024 | `#edc53f` | `#f9f6f2` | `box-shadow: 0 0 25px rgba(243,215,116,0.48)` |
| 2048 | `#edc22e` | `#f9f6f2` | `box-shadow: 0 0 30px rgba(243,215,116,0.56)` |
| >2048 (`.tile-super`) | `#3c3a32` | `#f9f6f2` | |

다크 모드는 지원하지 않는다 (클래식 라이트 팔레트 고정).

---

## 5. 구현 시 주의사항

1. **로직/UI 분리**: `game.js`는 DOM·localStorage를 쓰지 않고 입력 그리드를 변경하지 않는다(항상 새 배열 반환). 브라우저 콘솔에서 `Game2048.slideLine([2,2,2,2])`로 3.1 표의 케이스를 확인할 수 있어야 한다.
2. **유효하지 않은 이동**: 아무 타일도 움직이지 않으면 새 타일을 만들지 않고 점수도 바뀌지 않는다.
3. **이중 병합 금지**: 한 번의 이동에서 병합으로 생긴 타일은 다시 병합되지 않는다 (`[2,2,4,0]` → `[4,4,0,0]`).
4. **스크롤 방지**: 방향키 `preventDefault()` (iframe/페이지 스크롤 방지), 보드에 `touch-action: none` + `touchmove`에서 `preventDefault()` (`passive: false` 필수).
5. **iframe 대응**: iframe 안에서는 포커스가 있어야 키 입력을 받는다. 보드 클릭/터치 시와 `newGame()` 호출 시 `board.focus({ preventScroll: true })`. 높이가 낮은 iframe에서도 보드가 잘리지 않도록 `--board-size`에 `70vh` 상한을 둔다.
6. **오버레이 중 입력**: 게임 오버 상태 또는 승리 오버레이 표시 중에는 방향 입력을 무시한다. 버튼 클릭은 `click` 이벤트로 처리하며, 터치 핸들러가 버튼 클릭을 막지 않도록 `touchstart`/`touchend`에서는 `preventDefault()`를 호출하지 않는다.
7. **애니메이션 재적용**: `render()`가 매번 타일 DOM을 새로 만들므로 `.tile-new`/`.tile-merged` 클래스는 해당 이동에서 새로 생긴/병합된 위치에만 붙인다. 다음 렌더에서는 자연히 제거된다.
8. **localStorage 예외**: 사파리 개인 정보 보호 모드, file:// 환경 등에서 예외가 날 수 있으므로 반드시 `try/catch`.
9. **반응형 검증 폭**: 320px, 375px, 768px, 1280px에서 가로 스크롤 없이 보드·점수판·버튼이 모두 보여야 한다. 4자리 숫자(1024/2048)가 320px 폭에서도 타일 밖으로 넘치지 않아야 한다.
10. **콘솔 오류 0개**, 전역 변수는 `Game2048` 외에 남기지 않는다 (`app.js`는 IIFE 또는 블록으로 감싼다).

## 6. 완료 기준 (Review 체크리스트)
- [ ] 시작 시 타일 2개가 보이고, 방향키 4개 모두 정상 동작
- [ ] 3.1 표의 6개 케이스가 콘솔에서 일치
- [ ] 병합 시 점수가 병합 값만큼 증가, 최고 점수가 새로고침 후에도 유지
- [ ] 이동 불가 방향 입력 시 아무 변화 없음
- [ ] 2048 달성 시 승리 메시지 1회, "계속하기" 후 게임 진행 가능
- [ ] 이동 불가 상태에서 게임 오버 메시지, "다시 하기"로 재시작
- [ ] "새 게임" 버튼이 언제든 점수만 초기화(최고 점수 유지)하고 새 판 시작
- [ ] 모바일(개발자 도구 터치 에뮬레이션)에서 스와이프 4방향 동작, 스와이프 중 페이지 스크롤 없음
- [ ] 320px~1280px 폭에서 레이아웃 깨짐 없음
- [ ] file://로 열어도 동작, 콘솔 오류 없음
