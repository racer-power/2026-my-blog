---
title: 마크다운 문법 가이드
date: 2026-01-15
tags: [마크다운, 가이드]
description: 이 블로그에서 사용할 수 있는 마크다운 문법을 모두 정리했습니다.
---

# 마크다운 문법 가이드

이 포스트는 블로그에서 지원하는 마크다운 요소를 확인하는 테스트 겸 가이드입니다.

## 텍스트 강조

일반 텍스트 안에서 **굵게**, *기울임*, ~~취소선~~ 을 사용할 수 있습니다.

## 목록

**순서 없는 목록:**

- 사과
- 바나나
  - 노란 바나나
  - 초록 바나나
- 체리

**순서 있는 목록:**

1. 첫 번째
2. 두 번째
3. 세 번째

## 코드

인라인 코드: `const greeting = "Hello, World!"`

코드 블록:

```javascript
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
```

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
}
```

## 인용

> 단순함은 궁극의 정교함이다.
> — 레오나르도 다 빈치

## 링크와 이미지

[마크다운 공식 문서](https://daringfireball.net/projects/markdown/)를 참고하세요.

## 표

| 요소 | 문법 | 예시 |
|------|------|------|
| 굵게 | `**텍스트**` | **굵게** |
| 기울임 | `*텍스트*` | *기울임* |
| 코드 | `` `코드` `` | `코드` |
| 링크 | `[텍스트](URL)` | [링크](#) |

## 구분선

---

이상으로 마크다운 가이드를 마칩니다.
