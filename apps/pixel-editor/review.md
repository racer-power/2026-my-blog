# 픽셀 아트 에디터 — Review 결과 (review.md)

- 검증일: 2026-10-01
- 검증자: Review 서브에이전트 (Build 서브에이전트와 분리)
- 대상: `index.html`, `style.css`, `editor.js`, `app.js`
- 기준: `spec.md` 6장 완료 기준 + `review-instructions.md` 중점 확인 항목 10개

## 결론

**수정 후 통과.** 처음 받은 빌드에는 **데스크톱 레이아웃이 깨지는 심각한 CSS 버그**가 1건 있었다(768px 이상에서 사이드바가 화면 전체 폭을 차지해 캔버스가 왼쪽 화면 밖으로 밀려남). 그 밖에 중간~낮은 등급 문제 9건을 찾았다. 10건 모두 직접 고쳤고, 고친 뒤 같은 테스트를 다시 돌려 통과를 확인했다.

## 검증 방법

1. 4개 파일을 모두 읽고 spec과 한 줄씩 대조했다.
2. **Node 단위 테스트** (`editor.js`): `lineCells`를 16×16 격자의 모든 점 쌍(65,536쌍)에 돌려 검사했다(양 끝 포함, 길이 = max(|dx|,|dy|)+1, 이웃 칸끼리 8방향으로 붙어 있음, 중복 없음, 범위 안). `normalizeHex`, `deserialize`, `rgbaToCell`, `setPixel`, `isEmpty`도 테스트했다.
3. **헤드리스 Chrome + DevTools Protocol** (`file://`로 열기):
   - 레이아웃 측정: 360×740@3x, 768×1024@2x, 820×1180@2x, 1024×768@1x, 1280×800@2x
   - 실제 입력 이벤트 주입: 마우스 클릭/빠른 드래그/오른쪽 드래그/캔버스 밖에서 놓기, 두 손가락 터치, 키보드(B/E, 한글 IME 상태)
   - PNG 내보내기 4가지 크기 → 결과 픽셀 분석(크기, 투명 픽셀 수, 반투명 픽셀 0개) → 같은 PNG를 "불러오기"로 다시 열어 저장 데이터가 완전히 같은지 비교
   - 이미지가 아닌 파일 불러오기, localStorage에 잘못된 JSON 넣기, localStorage 접근 시 예외, 설정 유지, 내 색상 16개 제한·중복 처리
   - 다크 모드 에뮬레이션, 칸 크기가 홀수일 때 체커보드
   - 콘솔 에러·경고와 외부 네트워크 요청 수집
4. 수정 전 사본과 수정 후 사본에 같은 테스트를 돌려 결과를 비교했다.

> 실제 iOS/Android 기기, 실제 다운로드 대화상자, 블로그 iframe 삽입은 이 환경에서 확인할 수 없었다(아래 "남은 확인 사항" 참고).

## 중점 확인 항목 (review-instructions.md)

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | `lineCells` 브레젠험 | ✅ | 모든 8방향을 처리하는 정수 오차 버전. 65,536쌍 전수 검사에서 실패 0개. 빠른 드래그(2번 이동으로 대각선) 시 빈 칸 0개 |
| 2 | Pointer Events | ✅ | `isPrimary`/`drawing` 검사, `setPointerCapture`, `activePointerId` 비교, `pointerup`/`pointercancel`/`lostpointercapture` → `onUp`. `pointerup` 뒤에 오는 `lostpointercapture`는 `activePointerId === null`이라 무시됨. 두 손가락 터치 시 첫 손가락 경로만 칠해짐(2,2→3,2). 캔버스 밖에서 놓은 뒤 hover해도 칠해지지 않음. (보강: `setPointerCapture` 예외 처리 추가 — 아래 #7) |
| 3 | PNG 내보내기 | ✅ | 오프스크린 캔버스 사용, 16/128/256/512px 크기 정확. 빈 칸 alpha=0, 반투명 픽셀 0개(격자선·체커보드 섞이지 않음). 빈 그림이면 "그릴 내용이 없습니다". 파일명 `pixel-art-YYYYMMDD-HHMMSS.png` |
| 4 | 불러오기 흐름 | ✅ | `FileReader` → `Image` → 16×16 오프스크린 → `getImageData` → `rgbaToCell`. 4가지 크기 모두 다시 불러오면 원본과 완전히 같음. 텍스트 파일은 "이미지를 불러올 수 없습니다". 끝나면 항상 `loadInput.value=''`. (보강: 디코딩 예외 처리 — #8) |
| 5 | localStorage | ✅ (수정 후) | 모든 접근이 `try/catch` 안에 있음. 접근 예외 시 안내 메시지는 한 번만 뜸. `deserialize`의 타입 검증 구멍(#3)과 잘못된 JSON에 엉뚱한 안내가 뜨는 문제(#4)를 고침 |
| 6 | 전역 오염 | ✅ | `editor.js`는 `window.PixelEditor`만 만듦. `app.js`는 IIFE + `'use strict'` |
| 7 | `innerHTML` | ✅ | `innerHTML` 사용 0곳. 스와치는 `createElement` + `dataset`/`style.background`로 만듦. 색은 정규식이나 `normalizeHex`를 통과한 값만 씀 |
| 8 | ES 모듈 미사용 | ✅ | 일반 `<script src>` 2개만, `editor.js` → `app.js` 순서, `defer` 없음, `fetch` 없음 |
| 9 | 반응형 | ✅ (수정 후) | 수정 전에는 **❌ 768px 이상에서 레이아웃이 깨짐**(#1), 360px에서 캔버스가 정사각형이 아님(#2). 수정 후 모든 뷰포트에서 가로 스크롤 0px, 캔버스 정사각형 |
| 10 | 다크 모드 | ✅ | `@media (prefers-color-scheme: dark)`에서 변수를 다시 정의함. 에뮬레이션 결과 배경 rgb(26,26,26), 체커 #3a3a3a/#2e2e2e. `matchMedia` `change` 때 색을 다시 읽고 다시 그림 |

## spec.md 6장 완료 기준 체크리스트

**그리기**
- ✅ 16×16 격자 + 격자선, 빈 칸 체커보드 (홀수 칸 크기에서 경계가 번지던 문제는 #6에서 고침)
- ✅ 클릭으로 한 칸이 현재 색으로 칠해짐
- ✅ 빠른 드래그에도 끊기지 않음 (`lineCells` + coalesced events)
- ✅ 지우개 / 오른쪽 드래그로 지우기 (도구 상태는 펜 그대로)
- ✅ 캔버스 밖으로 드래그한 뒤 놓아도 그리기 상태가 남지 않음
- ✅ `B`/`E` 단축키 + 버튼 강조/`aria-pressed` 갱신 (한글 입력 상태에서 동작하지 않던 문제는 #5에서 고침)

**팔레트**
- ✅ 기본 32색이 spec 순서대로. 데스크톱 8열. 360px에서는 spec의 `auto-fill` 규칙 때문에 7열(400px 이상이면 8열)
- ✅ 색 피커로 바로 칠하기, "+ 추가"로 저장
- ✅ 중복은 추가하지 않고 그 스와치를 선택함(기본 팔레트 색 포함). 17번째 색을 넣으면 가장 오래된 색이 빠짐
- ✅ "모두 삭제"는 확인 → 비우기 → 안내 문구 표시. `currentColor`는 유지

**파일**
- ✅ PNG 크기 4종, 격자선 없음, 빈 칸 투명
- ✅ 내보낸 PNG를 다시 불러오면 칸 단위로 똑같음 (4종 모두)
- ✅ 새 캔버스: 그림이 있을 때만 확인을 받음
- ✅ 이미지가 아닌 파일 → 에러 메시지, 앱 계속 동작

**저장**
- ✅ 새로고침 후 그림, 내 색상, 도구, 색, 내보내기 크기 복원
- ✅ localStorage 예외 환경에서도 동작, 안내는 한 번만
- ✅ 잘못된 JSON으로도 기본 상태로 정상 시작 (수정 전에는 "자동 저장을 사용할 수 없습니다"가 잘못 뜸 → #4)

**모바일 / 반응형**
- ✅ 360px: 가로 스크롤 0, 캔버스 위·도구 아래 (수정 후 캔버스 328×328 정사각형)
- ✅ 768px 이상 2열 (**수정 전 ❌** → #1)
- ✅ `touch-action:none`은 캔버스에만 있음. `touchmove`에 `preventDefault`를 걸지 않음
- ✅ 두 손가락 터치 시 엉뚱한 선 없음
- ⚠️ 터치 대상 36px: 모바일(767px 이하) 스와치·버튼 36px ✅. 768px 이상 사이드바(300px)에서는 spec대로 8열을 넣으면 스와치가 약 30.8px이 됨 — spec 안의 수치가 서로 맞지 않음(#9 참고)
- ✅ DPR 2/3: 캔버스 내부 해상도가 16의 배수, 격자선은 `fillRect`로 그림

**공통**
- ✅ file://로 열어 모든 기능 동작 (헤드리스 Chrome에서 확인)
- ⏸ iframe 삽입: 코드상 `window.top`/`alert` 사용 없음. 실제 삽입 확인은 Embed 단계에서
- ✅ 다크 모드
- ✅ 콘솔 에러 0개, 외부 요청 0개 (테스트 중 보인 `willReadFrequently` 경고는 테스트 코드가 낸 것이고 앱과 무관)

## 발견한 문제와 수정 내역

### ❌ #1 [CRITICAL] 768px 이상에서 사이드바가 화면 전체 폭이 되어 캔버스가 화면 밖으로 밀려남 — `style.css`
- 원인: `@media (min-width:768px) { .sidebar { width:300px } }`가 **파일 앞쪽**에 있고, 같은 선택자 우선순위의 `.sidebar { width:100% }`가 **뒤에** 있어 미디어쿼리가 무시됨. 사이드바는 `flex-shrink:0`이라 줄어들지 않음.
- 측정(수정 전): 1024px 화면에서 사이드바 폭 992px, 캔버스 영역 left = −222px(캔버스 절반이 화면 밖), 문서 scrollWidth 1246px. 1280px에서도 left = −142px.
- 추가 원인: `.canvas-area`의 flex 최소 폭(`min-width:auto`)이 512px이라 768~860px에서는 300px 사이드바와 합치면 넘침.
- 수정: 768px 미디어쿼리의 `.sidebar` 규칙을 기본 `.sidebar` 규칙 **뒤로** 옮김. 768px 미디어쿼리 안에 `.canvas-area { min-width:0 }` 추가.
- 결과: 768px → 캔버스 420×420 + 사이드바 300, 1024px → 460.8 + 300(가운데 정렬), 모든 뷰포트에서 scrollWidth = 화면 폭.

### ❌ #2 [MEDIUM] `max-width:100%`로 폭이 줄면 캔버스가 정사각형이 아님 — `style.css` `.canvas-wrap`
- 원인: `width`와 `height`를 둘 다 `var(--canvas-size)`로 고정해서 `aspect-ratio`가 적용되지 않음. 360px에서 92vw(331.2px) > 사용 가능한 폭(328px)이라 폭만 줄어 328×331.2가 됨(그림이 세로로 늘어남).
- 수정: `height: auto;` (폭은 그대로 `var(--canvas-size)` + `max-width:100%`, 높이는 `aspect-ratio:1`을 따름). spec이 뜻한 "정사각형"을 그대로 지킴.

### ❌ #3 [MEDIUM] `deserialize`와 내 색상 복원이 문자열이 아닌 값을 통과시킴 — `editor.js`, `app.js`
- 원인: `/^#[0-9a-f]{6}$/.test(v)`는 `v`를 문자열로 바꿔서 검사한다. 그래서 `["#aabbcc"]`(배열)도 `"#aabbcc"`로 바뀌어 통과함. 손상되거나 조작된 저장 데이터가 grid/customColors에 배열로 들어갈 수 있었음(테스트로 확인: 수정 전 내 색상에 `["#aabbcc"]`와 중복된 `#123456`이 표시됨).
- 수정: `deserialize`에 `typeof v !== 'string'` 검사 추가. 내 색상 복원은 `typeof === 'string'` + 중복 제거 + 최대 16개(`slice(-16)`)로 spec의 상태 조건에 맞춤.

### ❌ #4 [MEDIUM] localStorage에 잘못된 JSON이 있으면 "자동 저장을 사용할 수 없습니다"가 잘못 뜸 — `app.js` `loadFromStorage`
- 원인: `JSON.parse` 예외까지 `tryStorage`가 잡아 저장소 장애로 처리하고 `storageWarned=true`로 만듦. 사용자에게 틀린 안내를 하고, 나중에 진짜 저장 실패가 나도 안내가 뜨지 않음.
- 수정: `readJSON(key)` 함수 추가. 저장소 접근은 `tryStorage`가, 파싱은 따로 `try/catch`가 맡아 실패하면 조용히 `null`(기본값). 테스트: 잘못된 JSON → 안내 없이 기본 상태로 시작. 저장소 예외 → 안내 한 번.

### ❌ #5 [MEDIUM] 한글 입력 상태에서 B/E 단축키가 동작하지 않고, Ctrl+E 같은 브라우저 단축키도 가로챔 — `app.js` keydown
- 원인: 한글 IME가 켜져 있으면 `e.key`가 `'ㅠ'`/`'ㄷ'`라 `'b'`/`'e'`와 같지 않음(한국어 블로그라 흔한 상황). 수정자 키도 확인하지 않음.
- 수정: `e.ctrlKey/metaKey/altKey`이면 무시. `e.code === 'KeyB'/'KeyE'`로도 판별.

### ❌ #6 [LOW] 칸 크기(`cellPx`)가 홀수면 체커보드 안쪽 경계가 번짐 — `app.js` `render`
- 원인: `half = S/2`가 소수(예: 10.5)가 되어 안티앨리어싱된 경계가 생김. 측정: 빈 캔버스 색 종류 9개 → 수정 후 5개, 경계 픽셀이 238(중간색) → 229(정확한 체커 색).
- 수정: `h1 = Math.floor(S/2)`, `h2 = S - h1`로 정수로 나눔.

### ❌ #7 [LOW] `setPointerCapture` 예외 처리 없음 — `app.js` `onDown`
- 포인터가 이미 사라진 경우(`InvalidStateError`/`NotFoundError`) 핸들러가 중간에 멈춤. `try/catch`로 감싸 캡처 없이 그리기를 계속함. `getCoalescedEvents()`를 두 번 부르던 것도 한 번으로 줄임.

### ❌ #8 [LOW] 불러오기에서 `drawImage`/`getImageData` 예외 처리 없음 — `app.js` `loadFile`
- 일부 SVG처럼 캔버스를 오염시키는 이미지는 `SecurityError`가 나서 처리되지 않은 예외가 생기고, 안내도 없고 `loadInput.value`도 비워지지 않음. `try/catch` → "이미지를 불러올 수 없습니다" + 입력값 비우기.

### ❌ #9 [MEDIUM] 데스크톱 팔레트가 패널 밖으로 넘치고 스와치가 정사각형이 아님 — `style.css`
- 원인: 사이드바 300px − 테두리 2 − 패딩 24 = 내용 폭 274px인데, `repeat(8, 32px)` + gap 6×7 = 298px. 마지막 열이 패널 테두리 밖으로 약 12px 튀어나옴. 또 `width:32px`에 `min-height:36px`가 겹쳐 스와치가 32×36이 됨.
- 수정: 768px 이상에서 `grid-template-columns: repeat(8, minmax(0,1fr)); gap:4px`, `.swatch { width:100%; height:auto; min-height:0; aspect-ratio:1 }` → 30.8px 정사각형 8열이 패널 안에 들어감.
- **spec 안의 충돌**: 300px 사이드바 + 8열 + 36px 터치 대상은 산술적으로 같이 만족시킬 수 없음(8×36 + 간격 = 316px 이상 > 274px). 모바일(767px 이하)은 36px을 그대로 지킴. 태블릿(768px 이상)에서도 36px이 꼭 필요하면 사이드바 폭을 약 340px로 늘리는 spec 변경이 필요 → **사용자 결정 사항**.

### ❌ #10 [LOW] `image-rendering` 선언 순서 — `style.css`
- `pixelated` 다음에 `crisp-edges`가 와서, 둘 다 지원하는 브라우저에서는 spec이 정한 `pixelated`가 덮어써짐. 순서를 바꿔 `pixelated`가 최종 값이 되게 함(`crisp-edges`는 대체값).

## 남은 확인 사항 / 참고 (수정하지 않음)

- [LOW] 창을 DPR이 다른 모니터로 옮겨 CSS 크기는 그대로이고 DPR만 바뀌면 `ResizeObserver`가 호출되지 않아 다시 그리기 전까지 살짝 흐릴 수 있음(`matchMedia('(resolution: …dppx)')` 감시로 보강 가능). spec 범위 밖이라 그대로 둠.
- [LOW] 너비/높이 정보가 없는 SVG는 `naturalWidth=0`이라 "16×16으로 변환" 대신 "불러오기 완료"가 뜰 수 있음(표시 문구만 다름).
- [INFO] 캔버스 밖으로 나갔다가 다시 들어오면 나간 지점과 들어온 지점이 직선으로 이어짐 — spec 3.2("`lastCell`은 그대로 둔다")대로의 동작.
- [INFO] `body { overflow-x:hidden }`은 가로 넘침을 가리기만 함. #1 버그가 스크롤바 없이 숨어 있던 이유. 지금은 넘침 자체가 0이라 문제 없음.
- ⏸ 실제 iOS Safari(길게 누르기 메뉴, 확대 방지), Android Chrome, 실제 다운로드 대화상자는 실기기에서 확인 권장.
- **Embed 단계 전달 사항**: iframe에 `sandbox`를 걸면 `allow-scripts allow-same-origin allow-downloads allow-modals`가 필요하다(spec 5.4). 사이드바 2열 레이아웃은 iframe 폭이 768px 이상일 때만 나오므로, 카드 미리보기 iframe이 좁으면 모바일 1열 레이아웃으로 보인다.

## 수정한 파일 요약

| 파일 | 수정 |
|---|---|
| `style.css` | #1 사이드바 미디어쿼리 위치 + `.canvas-area{min-width:0}`, #2 `.canvas-wrap{height:auto}`, #9 데스크톱 팔레트 8열 맞추기, #10 `image-rendering` 순서 |
| `editor.js` | #3 `deserialize` 타입 검사, `normalizeHex`의 3자리 hex가 대문자로 반환되던 문제(`#ABC` → `#AABBCC`, spec은 소문자) 수정 |
| `app.js` | #3 내 색상 복원 검증, #4 `readJSON`, #5 단축키, #6 체커 정수 분할, #7 `setPointerCapture` 예외 처리, #8 불러오기 예외 처리 |
| `index.html` | 수정 없음 (spec DOM 구조와 id/class 일치 확인) |
