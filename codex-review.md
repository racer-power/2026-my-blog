# Codex-Style Code Review

- 검토일: 2026-10-01
- 검토 범위: apps/2048 (4파일), apps/pixel-editor (4파일), index.html, css/style.css
- 참고: 기존 review.md의 수정 완료 항목은 재확인하지 않음. 이전 리뷰에서 발견하지 못하거나 "수정하지 않음"으로 남긴 항목 위주로 추가 검토.

---

## 2048

### MEDIUM

#### M1. `app.js:183` — 게임 종료 후에도 방향키 `preventDefault()` 호출

```js
document.addEventListener('keydown', function (e) {
    var dir = keyMap[e.key];
    if (!dir) return;
    e.preventDefault();   // ← game state 체크 전에 항상 실행
    handleMove(dir);
});
```

- **문제**: `over === true`(게임 오버) 또는 `won && !keepPlaying`(승리 오버레이 표시 중)일 때도 `e.preventDefault()`가 호출됨. 가로 모드 모바일(세로 600px 미만)이나 짧은 iframe에서 게임 콘텐츠가 뷰포트 높이를 초과하면 스크롤이 필요한데, 이때 ↑↓ 키로 스크롤할 수 없어짐.
- **재현**: 화면 높이를 600px 이하(또는 landscape 모바일)로 두고 게임 오버 후 ↓ 키 → 페이지 스크롤 안 됨.
- **수정**: 게임 상태를 먼저 확인한 뒤 preventDefault 호출.

```js
document.addEventListener('keydown', function (e) {
    var dir = keyMap[e.key];
    if (!dir) return;
    if (over || (won && !keepPlaying)) return;
    e.preventDefault();
    handleMove(dir);
});
```

**→ 수정함 (아래 "수정 내역" 참고)**

---

#### M2. `style.css` — 다크 모드 미지원

- **문제**: 앱 전체 색상이 `--page-bg: #faf8ef` 등 하드코딩된 밝은 색. `@media (prefers-color-scheme: dark)` 선언 없음. OS 다크 모드에서 블로그 메인(어두운 배경)에서 카드를 눌러 진입하면 갑자기 밝은 베이지 화면이 뜸.
- **수정**: 2048 고유 팔레트를 유지하되 최소한 배경과 텍스트에 다크 모드 변수 추가.

```css
@media (prefers-color-scheme: dark) {
  :root {
    --page-bg:   #1a1a18;
    --text:      #c9c0b5;
    --board-bg:  #4a4038;
    --cell-bg:   rgba(80,70,60,0.4);
    --btn-bg:    #6b5b4e;
    --score-bg:  #4a4038;
  }
}
```

**→ 수정함 (아래 "수정 내역" 참고)**

---

### LOW

#### L1. `style.css:172` — 효과 없는 CSS 규칙

```css
.grid-bg::before {
  content: none;  /* 기본값과 같음. 아무 효과 없음 */
}
```

- **문제**: `content` 기본값은 이미 `none`이므로 규칙 전체가 no-op. 이전 review.md에도 지적됐으나 수정되지 않음.
- **수정**: 블록 삭제.

**→ 수정함**

---

#### L2. `index.html:28` — `role="dialog"` 에 접근 가능한 이름 없음

```html
<div id="overlay" class="overlay hidden" role="dialog" aria-live="polite">
    <p id="overlay-message" class="overlay-message"></p>
```

- **문제 1**: WCAG 4.1.2 — `role="dialog"` 요소는 `aria-labelledby` 또는 `aria-label`로 이름을 제공해야 함.
- **문제 2**: `aria-live="polite"`가 `display:none` 요소에 붙어 있음. hidden 상태에서 내용이 바뀌어도 스크린 리더가 알림을 보내지 않음. `aria-live`는 항상 DOM에 존재하는 컨테이너에 붙여야 함.
- **수정 제안**: `role="dialog"` 제거하거나 `aria-labelledby="overlay-message"` 추가. `aria-live="polite"`는 `overlay-message` 안쪽의 별도 live region으로 이동.
- **이번 리뷰에서 수정 안 함**: 구조 변경이 필요하고 기능상 영향 없음. 향후 접근성 개선 시 처리 권장.

---

#### L3. `app.js` — 게임 오버·승리 시 오버레이 버튼으로 포커스 이동 없음

- **문제**: `showOverlay()` 호출 후 포커스가 보드에 남아 있음. 스크린 리더 사용자는 오버레이가 떴다는 것을 놓칠 수 있음(aria-live가 hidden 요소에 있어 발표 안 됨 — L2 참고).
- **수정 제안**: `showOverlay()` 끝에 `tryBtn.focus()` 또는 `keepBtn.focus()` 추가.
- **이번 리뷰에서 수정 안 함**: 기능상 영향 없음.

---

## 픽셀 아트 에디터

### MEDIUM

#### M3. `style.css` — `--accent` 다크 모드에서 대비 불충분

```css
:root { --accent: #5b6ee1; }

@media (prefers-color-scheme: dark) {
  :root {
    /* --accent 재정의 없음 */
    --bg: #1a1a1a;
    --surface: #2a2a2a;
    ...
  }
}
```

- **문제**: `#5b6ee1`(파랑)을 다크 배경 `#2a2a2a`에 올리면 명암비 ≈ 2.6:1. WCAG AA 기준 비텍스트 UI 요소 최소 3:1 미달. 선택된 스와치의 `outline: 3px solid var(--accent)`가 어두운 배경에서 잘 안 보임.
- **수정**: 다크 모드에서 더 밝은 파랑 사용.

```css
@media (prefers-color-scheme: dark) {
  :root {
    --accent: #8494f0;   /* 명암비 ~4.6:1 on #2a2a2a */
    /* 기존 변수들 */
  }
}
```

**→ 수정함**

---

### LOW

#### L4. `app.js:471` — `ResizeObserver` 해제 없음

```js
var ro = new ResizeObserver(function () { resizeCanvas(); });
ro.observe(wrap);
// ro.disconnect()가 어디에도 없음
```

- **문제**: 앱을 iframe으로 로드 후 iframe을 DOM에서 제거하면 ResizeObserver가 해제되지 않아 잠재적 메모리 누수. 독립 실행(직접 열기)에서는 문제없지만 블로그 embed 컨텍스트에서는 해당.
- **수정 제안**: `window.addEventListener('pagehide', function() { ro.disconnect(); })` 추가.
- **이번 리뷰에서 수정 안 함**: 실제 embed 방식이 iframe이 아닌 링크 이동이라 현재 영향 없음.

---

#### L5. `app.js:396` — `img.naturalWidth === 0` 시 상태 메시지 오류

```js
var isExact = (img.naturalWidth === img.naturalHeight) && (img.naturalWidth % 16 === 0);
if (!isExact) {
    showStatus('16×16으로 변환해 불러왔습니다');
} else {
    showStatus('불러오기 완료');
}
```

- **문제**: 치수가 0×0인 SVG(폭/높이 속성 없는 일부 SVG)를 불러오면 `naturalWidth=0`. `(0===0)&&(0%16===0)` → `isExact=true`가 되어 "불러오기 완료"를 표시함. 실제로는 변환이 발생한 것이므로 메시지가 부정확함.
- **수정 제안**: `img.naturalWidth % 16 !== 0` 조건에 `img.naturalWidth === 0` 포함.
- **이번 리뷰에서 수정 안 함**: 동작에 영향 없고 드문 케이스.

---

## 블로그 메인

### LOW

#### L6. `index.html:14` — 테마 토글 버튼 `aria-label` ✅ 문제 없음

```js
// js/theme.js:18
btn.setAttribute('aria-label', theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
```

- **확인**: `applyTheme()` 호출 시마다 `aria-label`과 이모지가 함께 갱신됨. 탭 간 동기화(`storage` 이벤트)에서도 동일하게 처리됨. 이슈 없음.

---

## 요약

| 심각도 | 개수 | 항목 |
|--------|------|------|
| MEDIUM | 3 | M1(화살표키 preventDefault), M2(2048 다크모드), M3(픽셀에디터 액센트 대비) |
| LOW | 5 | L1(dead CSS), L2(dialog 접근성), L3(포커스 이동), L4(ResizeObserver), L5(naturalWidth), L6(aria-label) |

**이번 리뷰에서 수정한 항목: M1, M2, L1, M3 (총 4건)**
**수정 보류 항목: L2, L3, L4, L5, L6 (구조적 변경 또는 영향 없음)**
