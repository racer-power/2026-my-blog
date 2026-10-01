# 픽셀 아트 에디터 — 구현 명세 (spec.md)

> Build 서브에이전트는 이 문서만 보고 구현한다. `/apps/pixel-editor/` 폴더 안만 수정한다. 블로그의 다른 파일(`/index.html`, `/css`, `/js`, `/posts`, `/apps/2048`)은 건드리지 않는다.

## 0. 개요

- 16×16 격자에 마우스나 터치로 도트를 찍어 그림을 그리는 에디터
- HTML / CSS / JavaScript만 쓴다. 외부 라이브러리, CDN, 빌드 도구, 웹폰트를 쓰지 않는다.
- 자체 완결: 블로그 CSS/JS를 참조하지 않는다. 나중에 Embed 단계에서 블로그 메인에 `<iframe>`으로 들어가므로 iframe 안에서도 동작해야 한다.
- `index.html`을 더블클릭(file://)으로 열어도 동작해야 한다. 그래서 ES 모듈(`type="module"`)과 `fetch`를 쓰지 않고 일반 `<script>`만 쓴다.

### 범위 밖 (구현하지 않음)
- 되돌리기/다시하기, 채우기(버킷)·스포이드·선·도형 도구, 레이어, 격자 크기 변경, 여러 작품 저장, 호버 미리보기, 사운드

---

## 1. 파일 구조

```
/apps/pixel-editor/
├── spec.md      # 이 문서 (수정 금지)
├── index.html   # 마크업: 헤더, 캔버스, 도구, 팔레트, 액션 버튼
├── style.css    # 레이아웃, 반응형, 라이트/다크 테마, 스와치 스타일
├── editor.js    # 순수 로직 + 기본 팔레트 상수 (DOM, localStorage 접근 없음)
└── app.js       # 렌더링, 입력 이벤트, 팔레트 UI, 저장/불러오기/내보내기
```

스크립트 로드 순서: `editor.js` → `app.js`. 둘 다 `<body>` 끝에 `defer` 없이 넣는다.

---

## 2. 파일별 역할과 기능

### 2.1 `index.html`

- `<!DOCTYPE html>`, `<html lang="ko">`, `<meta charset="UTF-8">`
- `<meta name="viewport" content="width=device-width, initial-scale=1">`
- `<title>픽셀 아트 에디터</title>`

DOM 구조. id와 class 이름은 이대로 고정한다. Review 단계에서 이 이름들을 기준으로 확인한다.

```html
<body>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">픽셀 아트 에디터</h1>
      <p class="app-subtitle">16×16 도트를 찍어 그림을 그려보세요</p>
    </header>

    <main class="editor-layout">
      <section class="canvas-area">
        <div class="canvas-wrap" id="canvas-wrap">
          <canvas id="pixel-canvas" aria-label="16×16 픽셀 캔버스"></canvas>
        </div>
        <p class="status" id="status" role="status" aria-live="polite"></p>
      </section>

      <aside class="sidebar">
        <!-- 도구 -->
        <div class="panel tools-panel">
          <h2 class="panel-title">도구</h2>
          <div class="tool-group">
            <button type="button" class="tool-btn is-active" id="tool-pencil" data-tool="pencil" aria-pressed="true">✏️ 펜</button>
            <button type="button" class="tool-btn" id="tool-eraser" data-tool="eraser" aria-pressed="false">🧽 지우개</button>
          </div>
          <div class="current-color">
            <span class="current-color-swatch" id="current-color"></span>
            <span class="current-color-hex" id="current-color-hex">#000000</span>
          </div>
        </div>

        <!-- 기본 팔레트 -->
        <div class="panel palette-panel">
          <h2 class="panel-title">기본 팔레트</h2>
          <div class="palette-grid" id="base-palette"></div>
        </div>

        <!-- 커스텀 색 -->
        <div class="panel custom-panel">
          <h2 class="panel-title">내 색상</h2>
          <div class="custom-controls">
            <input type="color" id="color-picker" value="#ff6b6b" aria-label="커스텀 색 선택">
            <button type="button" class="btn" id="add-color-btn">+ 추가</button>
            <button type="button" class="btn btn-ghost" id="clear-custom-btn">모두 삭제</button>
          </div>
          <div class="palette-grid" id="custom-palette"></div>
          <p class="custom-empty" id="custom-empty">추가한 색이 여기에 표시됩니다</p>
        </div>

        <!-- 파일 작업 -->
        <div class="panel actions-panel">
          <h2 class="panel-title">파일</h2>
          <div class="action-group">
            <button type="button" class="btn" id="new-btn">새 캔버스</button>
            <button type="button" class="btn" id="load-btn">불러오기</button>
            <input type="file" id="load-input" accept="image/png,image/*" hidden>
          </div>
          <div class="export-group">
            <label for="export-scale" class="export-label">크기</label>
            <select id="export-scale">
              <option value="1">16×16</option>
              <option value="8">128×128</option>
              <option value="16" selected>256×256</option>
              <option value="32">512×512</option>
            </select>
            <button type="button" class="btn btn-primary" id="export-btn">PNG 내보내기</button>
          </div>
        </div>
      </aside>
    </main>
  </div>
  <script src="editor.js"></script>
  <script src="app.js"></script>
</body>
```

- 팔레트 스와치는 `app.js`가 동적으로 만든다. 마크업: `<button type="button" class="swatch" data-color="#rrggbb" title="#rrggbb" aria-label="#rrggbb" style="background:#rrggbb">`
- 선택된 스와치에는 class `is-selected`를 붙인다. 기본 팔레트와 커스텀 팔레트를 합쳐 한 번에 하나만 선택된다.

### 2.2 `style.css`

CSS 변수(`:root`):
```css
--bg; --surface; --border; --text; --text-muted; --accent; --accent-text;
--grid-line;      /* 격자선 색, 예: rgba(0,0,0,0.12) */
--checker-a: #ffffff; --checker-b: #e5e5e5;   /* 빈 칸 체커보드 */
--canvas-size: min(92vw, 60vh, 512px);
--swatch-size: 32px;
--radius: 8px;
```
- 다크 테마: `@media (prefers-color-scheme: dark)` 안에서 `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--grid-line`(예: `rgba(255,255,255,0.15)`), `--checker-a: #3a3a3a`, `--checker-b: #2e2e2e`를 다시 정의한다.
- 폰트: `system-ui, -apple-system, "Segoe UI", "Malgun Gothic", sans-serif`

레이아웃:
- `.editor-layout`: 기본(모바일)은 `display:flex; flex-direction:column; gap:16px; align-items:center`
- `@media (min-width: 768px)`: `flex-direction:row; align-items:flex-start; justify-content:center`. `.sidebar`는 `width: 300px`
- `.canvas-wrap`: `width/height: var(--canvas-size)`, `aspect-ratio:1`, 테두리와 `--radius`
- `#pixel-canvas`: `width:100%; height:100%; display:block; touch-action:none; image-rendering:pixelated; cursor:crosshair;` + `user-select:none; -webkit-user-select:none; -webkit-touch-callout:none`
- `.palette-grid`: `display:grid; grid-template-columns: repeat(8, var(--swatch-size)); gap:6px`. 모바일(`max-width: 767px`)에서는 `--swatch-size: 36px`, 화면이 좁으면 `repeat(auto-fill, minmax(var(--swatch-size), 1fr))`로 바꾼다.
- `.swatch`: 정사각형, `border:2px solid var(--border)`, `border-radius:6px`, `padding:0`, `cursor:pointer`
- `.swatch.is-selected`: `outline:3px solid var(--accent); outline-offset:2px`
- `.tool-btn.is-active`: `background:var(--accent); color:var(--accent-text)`
- 버튼, 스와치, select: `min-height:36px`(터치 대상), `touch-action:manipulation`(더블탭 확대 방지)
- `.custom-empty`: `#custom-palette`가 비었을 때만 보인다. JS가 `hidden` 속성으로 켜고 끈다.
- `.status`: 작은 회색 글씨, `min-height:1.2em`(글자가 바뀌어도 레이아웃이 흔들리지 않게)
- `body`: `margin:0`, 가로 스크롤이 생기면 안 된다(가로 360px 기준).

### 2.3 `editor.js` — 순수 로직

`window.PixelEditor` 전역 객체 하나만 노출한다(IIFE). DOM, `localStorage`, `document`를 참조하지 않는다.

| 이름 | 설명 |
|---|---|
| `SIZE = 16` | 격자 한 변의 칸 수 |
| `DEFAULT_PALETTE` | 4절의 32색 배열(소문자 `#rrggbb`) |
| `createGrid()` | `new Array(256).fill(null)`을 반환한다. `null`은 투명(빈 칸) |
| `index(x, y)` | `y * SIZE + x` |
| `inBounds(x, y)` | 0 ≤ x, y < 16 |
| `setPixel(grid, x, y, color)` | `color`는 `#rrggbb` 또는 `null`. 범위 밖이면 무시. 값이 바뀌었으면 `true`를 반환 |
| `lineCells(x0, y0, x1, y1)` | 브레젠험 알고리즘으로 두 칸 사이의 모든 칸 `[[x,y], ...]`을 반환(양 끝 포함) |
| `isEmpty(grid)` | 모든 칸이 `null`이면 `true` |
| `normalizeHex(str)` | `#abc`/`#AABBCC`를 `#aabbcc`로 바꾼다. 잘못된 값이면 `null` |
| `serialize(grid)` | `{ v: 1, size: 16, pixels: [...] }` 반환 |
| `deserialize(obj)` | 검증: `v === 1`, `size === 16`, `pixels.length === 256`, 각 값은 `null` 또는 `/^#[0-9a-f]{6}$/`. 통과하면 grid 복사본, 아니면 `null` 반환 |
| `rgbaToCell(r, g, b, a)` | `a < 128`이면 `null`, 아니면 `#rrggbb` |

### 2.4 `app.js` — UI와 입력

상태(모듈 내부 변수):
```js
let grid;                // PixelEditor.createGrid()
let tool = 'pencil';     // 'pencil' | 'eraser'
let currentColor = '#000000';
let customColors = [];   // 최대 16개, 소문자 hex, 중복 없음
let drawing = false;
let activePointerId = null;
let lastCell = null;     // {x, y}
let strokeChanged = false;
let cellPx = 0;          // 캔버스 내부 해상도 기준 한 칸 크기
```

기능 목록:
1. **초기화** `init()`: 저장된 데이터 불러오기 → 팔레트 렌더 → `resizeCanvas()` → `render()` → 이벤트 등록
2. **캔버스 크기 맞추기** `resizeCanvas()`: 3.1절 참고. `ResizeObserver`로 `#canvas-wrap`을 관찰한다. 지원하지 않는 브라우저에서는 `window` `resize` 이벤트를 쓴다.
3. **렌더링** `render()`: 3.1절 참고. 칸 하나가 바뀌어도 전체를 다시 그린다(256칸이라 충분히 빠르다).
4. **그리기 입력**: Pointer Events. 3.2절 참고
5. **도구 전환**: `#tool-pencil`, `#tool-eraser` 클릭으로 `tool`을 바꾸고 `is-active`와 `aria-pressed`를 갱신한다. 단축키 `B` = 펜, `E` = 지우개(포커스가 `input`/`select`에 있으면 무시)
6. **색 선택**: 스와치를 클릭하면 `currentColor`를 바꾸고, 도구를 펜으로 전환하고, `is-selected`, `#current-color`의 배경, `#current-color-hex` 글자를 갱신한다.
7. **커스텀 색**
   - `#color-picker`의 `input` 이벤트: `currentColor`를 그 값으로 바꾸고 펜으로 전환한다(미리 써보기). 스와치 선택은 해제한다.
   - `#add-color-btn`: 피커 값을 `normalizeHex` 한 뒤, 기본 팔레트나 `customColors`에 이미 있으면 그 스와치만 선택한다. 없으면 맨 뒤에 추가하고, 16개가 넘으면 가장 오래된 색을 지운다. 그다음 저장하고 다시 렌더하고 새 색을 선택한다.
   - `#clear-custom-btn`: `customColors`가 비어 있지 않을 때만 `confirm('내 색상을 모두 삭제할까요?')` → 비운다 → 저장. 지운 색 중에 `currentColor`가 있어도 `currentColor`는 그대로 둔다.
   - `#custom-empty`는 `customColors.length === 0`일 때만 보인다.
8. **새 캔버스** `#new-btn`: `isEmpty(grid)`가 아니면 `confirm('현재 그림을 지우고 새로 시작할까요?')`. 확인하면 `grid = createGrid()` → render → 저장 → 상태 메시지 "새 캔버스".
9. **불러오기** `#load-btn` → `#load-input.click()`. 3.4절 참고
10. **PNG 내보내기** `#export-btn`. 3.3절 참고
11. **자동 저장 / 복원**. 3.5절 참고
12. **상태 메시지** `showStatus(msg)`: `#status`에 글자를 넣고 2초 뒤 지운다. 이전 타이머가 있으면 취소한다.

---

## 3. 핵심 구현 방법

### 3.1 캔버스 렌더링

화면에 보이는 캔버스 하나(`#pixel-canvas`)만 쓴다. 그림 데이터의 원본은 언제나 `grid` 배열이다. 캔버스는 화면 표시용일 뿐이다.

**선명한 해상도 맞추기** `resizeCanvas()`:
```js
const cssSize = wrap.clientWidth;                 // 정사각형
const dpr = window.devicePixelRatio || 1;
cellPx = Math.max(1, Math.floor(cssSize * dpr / 16));
canvas.width = canvas.height = cellPx * 16;       // 반드시 16의 배수
render();
```
- `canvas.width`는 16의 배수여야 칸 경계가 번지지 않는다. CSS 크기는 100%로 두고, 남는 몇 px 차이는 `image-rendering:pixelated`가 처리한다.

**그리기 순서** `render()`:
1. 빈 칸(`null`)마다 체커보드를 그린다. 한 칸을 2×2로 나눠 `--checker-a`/`--checker-b`를 번갈아 칠한다. 색은 `getComputedStyle(document.documentElement)`로 읽어 캐시하고, `matchMedia('(prefers-color-scheme: dark)')`의 `change` 이벤트가 오면 다시 읽고 다시 그린다.
2. 색이 있는 칸은 `ctx.fillStyle = color; ctx.fillRect(x*cellPx, y*cellPx, cellPx, cellPx)`
3. 격자선: `--grid-line` 색으로 `x = 1..15`, `y = 1..15` 위치에 폭 `Math.max(1, Math.round(dpr))`인 선을 `fillRect`로 그린다(`stroke`보다 선명하다). 바깥 테두리는 CSS `border`가 맡는다.

### 3.2 이벤트 처리 (마우스 + 터치 통합)

Pointer Events만 쓴다. `mouse*`, `touch*` 이벤트는 따로 등록하지 않는다.

```js
canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
canvas.addEventListener('lostpointercapture', onUp);
canvas.addEventListener('contextmenu', e => e.preventDefault());
```

- **좌표를 칸으로 바꾸기** `eventToCell(e)`:
  ```js
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * 16);
  const y = Math.floor((e.clientY - r.top) / r.height * 16);
  return PixelEditor.inBounds(x, y) ? {x, y} : null;
  ```
- **onDown**:
  - 이미 그리는 중(`drawing`)이거나 `!e.isPrimary`이면 무시한다(멀티터치 방지).
  - 마우스는 `e.button`이 0(왼쪽)이나 2(오른쪽)일 때만 처리한다. 오른쪽 버튼은 이번 획만 지우개로 동작한다.
  - `e.preventDefault()`, `canvas.setPointerCapture(e.pointerId)`, `drawing = true`, `activePointerId = e.pointerId`, `strokeChanged = false`
  - 이번 획에 칠할 값 `strokeColor`를 정한다: 지우개이거나 오른쪽 버튼이면 `null`, 아니면 `currentColor`
  - 현재 칸을 칠하고 `lastCell`에 저장한다.
- **onMove**: `drawing`이 아니거나 `e.pointerId !== activePointerId`이면 무시한다. 칸이 `lastCell`과 다르면 `lineCells(lastCell → 현재)`로 사이 칸까지 모두 칠한다(빠르게 드래그해도 끊기지 않게). 브라우저가 지원하면 `e.getCoalescedEvents()`의 각 이벤트도 같은 방식으로 처리한다.
  - 포인터가 캔버스 밖으로 나가 `eventToCell`이 `null`이면 그 이벤트는 건너뛴다. `lastCell`은 그대로 둔다.
- **onUp**: `activePointerId`가 같을 때만 처리한다. `drawing = false`, `lastCell = null`, `activePointerId = null`. `strokeChanged`이면 `saveCanvas()`
- 칠하는 함수 `paint(x, y, color)`: `setPixel`이 `true`를 반환하면 `strokeChanged = true`로 하고, `requestAnimationFrame`으로 render를 예약한다(한 프레임에 한 번만).
- 그리는 중 페이지가 스크롤되거나 확대되지 않게 막는 건 CSS `touch-action:none`이다. `touchmove`에 `preventDefault`를 걸지 않는다. 캔버스 밖 영역은 정상적으로 스크롤되어야 한다.

### 3.3 PNG 내보내기 (`canvas.toDataURL`)

화면 캔버스를 그대로 내보내지 않는다. 격자선과 체커보드가 섞이기 때문이다. 내보낼 때는 오프스크린 캔버스를 새로 만든다.

```js
function exportPNG() {
  const scale = parseInt(exportScale.value, 10);   // 1 | 8 | 16 | 32
  const off = document.createElement('canvas');
  off.width = off.height = 16 * scale;
  const octx = off.getContext('2d');
  octx.imageSmoothingEnabled = false;
  grid.forEach((c, i) => {
    if (!c) return;                                 // 빈 칸은 투명으로 둔다
    octx.fillStyle = c;
    octx.fillRect((i % 16) * scale, Math.floor(i / 16) * scale, scale, scale);
  });
  const url = off.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `pixel-art-${timestamp()}.png`;      // timestamp: YYYYMMDD-HHMMSS
  document.body.appendChild(a); a.click(); a.remove();
  showStatus('PNG를 저장했습니다');
}
```
- 그림이 비어 있으면 내보내지 않고 `showStatus('그릴 내용이 없습니다')`만 띄운다.

### 3.4 불러오기 (PNG 파일)

"불러오기"는 이 에디터에서 내보낸 PNG(또는 다른 이미지)를 16×16 격자로 읽어 들이는 기능이다. 페이지를 열 때 하는 복원은 3.5절의 자동 저장이 맡는다.

1. `#load-input`의 `change` 이벤트: 파일이 없으면 끝. `isEmpty(grid)`가 아니면 `confirm('현재 그림을 불러온 이미지로 바꿀까요?')`
2. `FileReader.readAsDataURL(file)` → `new Image()`의 `src`로 넣는다. data URL이라 캔버스가 오염(tainted)되지 않아 file://에서도 `getImageData`를 쓸 수 있다.
3. `img.onload`: 16×16 오프스크린 캔버스에 `imageSmoothingEnabled = false`로 `drawImage(img, 0, 0, 16, 16)` 한다. 정사각형이 아닌 이미지는 늘려서 맞춘다.
4. `getImageData(0,0,16,16)`의 RGBA를 `rgbaToCell`로 바꿔 새 grid를 만든다 → render → 저장
5. 원본이 16의 배수 정사각형이 아니면 `showStatus('16×16으로 변환해 불러왔습니다')`, 맞으면 `showStatus('불러오기 완료')`
6. `img.onerror`이거나 이미지 파일이 아니면 `showStatus('이미지를 불러올 수 없습니다')`
7. 끝나면 항상 `loadInput.value = ''`로 비운다. 그래야 같은 파일을 다시 골라도 `change`가 발생한다.

### 3.5 자동 저장 (localStorage)

| 키 | 값 |
|---|---|
| `pixelEditor.canvas` | `JSON.stringify(PixelEditor.serialize(grid))` |
| `pixelEditor.customColors` | `JSON.stringify(customColors)` |
| `pixelEditor.prefs` | `JSON.stringify({ tool, currentColor, exportScale })` |

- **저장 시점**: 획이 끝날 때(`strokeChanged`인 경우), 새 캔버스 후, 불러오기 후, 커스텀 색을 바꾼 후, 도구·색·내보내기 크기를 바꾼 후. 추가로 `pagehide` 때 한 번 더 저장한다.
- **복원**: `init`에서 각 키를 읽어 `JSON.parse` → 검증한다(`deserialize`, hex 배열 검사, prefs 각 필드 검사). 실패하면 기본값을 쓴다.
- 모든 `localStorage` 접근은 `try/catch`로 감싼다. 사생활 보호 모드, 일부 iframe/file:// 환경, 저장 공간 초과에서는 예외가 날 수 있다. 실패하면 처음 한 번만 `showStatus('자동 저장을 사용할 수 없습니다')`를 띄우고 앱은 계속 동작해야 한다.
- 획마다 "저장됨" 메시지를 띄우지 않는다(너무 시끄럽다).

---

## 4. 기본 색상 팔레트 (32색, DawnBringer 32)

`editor.js`의 `DEFAULT_PALETTE`에 아래 순서 그대로 넣는다. 화면에서는 8열 × 4행으로 표시된다.

```js
[
  '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
  '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
  '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
  '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30'
]
```

- 기본 선택 색: `#000000`. 저장된 prefs가 있으면 그 값을 쓴다.
- `#ffffff` 같은 밝은 스와치도 `.swatch`의 `border` 덕분에 배경과 구분된다.

---

## 5. 구현 시 주의사항

1. **원본 데이터는 grid 하나다.** 저장, 내보내기, 렌더 모두 `grid`에서 출발한다. 화면 캔버스 픽셀을 읽어 저장하지 않는다.
2. **좌표 변환은 `getBoundingClientRect` 비율로 한다.** CSS 크기와 내부 해상도(`canvas.width`)가 달라도 맞는 칸을 계산해야 한다.
3. **터치**: 스크롤 방지는 캔버스의 `touch-action:none`으로만 한다. 멀티터치에서는 첫 번째 포인터만 그린다. 길게 누를 때 뜨는 iOS 메뉴와 텍스트 선택은 CSS로 막는다.
4. **iframe 호환**: `alert`는 쓰지 않는다. `confirm`은 새 캔버스·불러오기·색 전체 삭제에만 쓴다. `window.top`이나 부모 페이지에 접근하지 않는다. Embed 때 iframe에 `sandbox`를 걸면 `allow-scripts allow-same-origin allow-downloads allow-modals`가 필요하다. 이 내용을 Embed 단계에 전달할 수 있도록 Build 보고에 한 줄 남긴다.
5. **전역 오염 최소화**: `editor.js`는 `window.PixelEditor`만, `app.js`는 IIFE로 감싸 전역 변수를 만들지 않는다.
6. `innerHTML`에 사용자 입력을 넣지 않는다. 스와치는 `createElement`로 만들고, 색은 `normalizeHex`를 통과한 값만 쓴다.
7. 콘솔 에러와 경고가 0개여야 한다.
8. 이 폴더 밖 파일은 만들거나 고치지 않는다. 이 `spec.md`도 고치지 않는다.

---

## 6. 완료 기준 체크리스트

**그리기**
- [ ] 16×16 격자와 격자선이 보이고, 빈 칸은 체커보드로 표시된다
- [ ] 마우스 클릭으로 한 칸이 현재 색으로 칠해진다
- [ ] 드래그하면 빠르게 움직여도 칸이 끊기지 않고 이어진다
- [ ] 지우개 도구로 칸이 투명(체커보드)으로 돌아간다. 마우스 오른쪽 드래그도 지우개로 동작한다
- [ ] 캔버스 밖으로 드래그했다가 손을 떼도 그리기 상태가 남지 않는다
- [ ] `B`/`E` 단축키로 도구가 바뀌고 버튼 강조가 함께 바뀐다

**팔레트**
- [ ] 기본 32색이 4절 순서대로 8열로 표시되고, 클릭하면 선택 표시와 현재 색 표시가 갱신된다
- [ ] 색 피커로 고른 색을 바로 칠할 수 있고, "+ 추가"로 내 색상에 저장된다
- [ ] 이미 있는 색은 중복으로 추가되지 않는다. 17번째 색을 추가하면 가장 오래된 색이 빠진다
- [ ] "모두 삭제"는 확인을 받은 뒤 비우고, 비면 안내 문구가 다시 보인다

**파일**
- [ ] "PNG 내보내기"를 누르면 고른 크기(16/128/256/512px)의 PNG가 다운로드되고, 격자선 없이 빈 칸이 투명이다
- [ ] 내보낸 PNG를 "불러오기"로 다시 열면 원래 그림과 칸 단위로 똑같다
- [ ] "새 캔버스"는 그림이 있을 때 확인을 받고 캔버스를 비운다
- [ ] 이미지가 아닌 파일이나 깨진 파일을 불러오면 에러 메시지가 뜨고 앱이 멈추지 않는다

**저장**
- [ ] 그림을 그리고 새로고침해도 그림, 내 색상, 선택한 도구·색·내보내기 크기가 그대로다
- [ ] localStorage를 막은 환경(또는 저장 시 예외)에서도 앱이 동작하고 안내 메시지가 한 번만 뜬다
- [ ] localStorage에 잘못된 JSON을 넣고 열어도 기본 상태로 정상 시작한다

**모바일 / 반응형**
- [ ] 가로 360px 화면에서 가로 스크롤 없이 캔버스가 위, 도구가 아래로 배치된다
- [ ] 768px 이상에서는 캔버스 왼쪽, 사이드바 오른쪽 2열로 배치된다
- [ ] 터치로 그릴 때 페이지가 스크롤되거나 확대되지 않는다. 캔버스 밖에서는 스크롤이 된다
- [ ] 두 손가락으로 터치해도 엉뚱한 선이 그려지지 않는다
- [ ] 버튼과 스와치의 터치 대상이 36px 이상이다
- [ ] 고해상도 화면(DPR 2 이상)에서도 칸 경계와 격자선이 선명하다

**공통**
- [ ] file://로 직접 열어도 모든 기능이 동작한다
- [ ] iframe 안에 넣어도 그리기, 저장, 내보내기가 동작한다
- [ ] OS 다크 모드에서 배경, 글자, 체커보드가 어두운 테마로 바뀐다
- [ ] 콘솔 에러 0개, 외부 리소스 요청 0개
