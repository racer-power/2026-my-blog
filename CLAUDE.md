# 2026 My Blog

마크다운 파일을 읽어 블로그 웹사이트로 변환하는 정적 블로그 생성기.

## 프로젝트 개요

- 마크다운(`.md`) 파일을 파싱해 HTML 블로그 페이지로 렌더링
- 프레임워크 없이 순수 HTML / CSS / JavaScript로만 구현
- 다크 모드 지원 (시스템 설정 감지 + 수동 토글)
- 모바일 반응형 레이아웃

## 디렉터리 구조

```
2026_My_Blog/
├── index.html          # 블로그 목록 페이지
├── post.html           # 개별 포스트 렌더링 페이지
├── css/
│   ├── style.css       # 공통 스타일 (레이아웃, 타이포그래피)
│   └── dark.css        # 다크 모드 오버라이드
├── js/
│   ├── parser.js       # 마크다운 → HTML 파서
│   ├── loader.js       # 포스트 목록 로드 및 라우팅
│   └── theme.js        # 다크/라이트 모드 토글
├── posts/
│   └── *.md            # 블로그 포스트 마크다운 파일
└── CLAUDE.md
```

## 기술 결정

- **마크다운 파싱**: 외부 라이브러리 없이 직접 구현하거나, 단일 파일 CDN 스크립트(예: marked.js via `<script src>`)만 허용
- **라우팅**: `?post=slug` 쿼리스트링 방식으로 SPA처럼 동작
- **다크 모드**: `prefers-color-scheme` 미디어 쿼리 감지 + `localStorage`에 사용자 선택 저장
- **폰트**: 시스템 폰트 스택 사용 (웹폰트 요청 최소화)

## 마크다운 포스트 형식

파일명: `YYYY-MM-DD-slug.md`

```markdown
---
title: 포스트 제목
date: 2026-01-01
tags: [tag1, tag2]
description: 짧은 설명 (목록 페이지 미리보기에 사용)
---

본문 내용...
```

## 디자인 원칙

- 최대 본문 너비: `720px` (가독성 기준)
- 모바일 브레이크포인트: `768px`
- 라이트 모드: 흰 배경(`#ffffff`), 어두운 텍스트(`#1a1a1a`)
- 다크 모드: 어두운 배경(`#0f0f0f`), 밝은 텍스트(`#e8e8e8`)
- 코드 블록: 모노스페이스, 살짝 다른 배경색으로 구분
- 이미지: `max-width: 100%`, `border-radius` 적용

## 개발 규칙

- DOM 조작은 `querySelector` / `querySelectorAll` 사용, jQuery 금지
- CSS 변수(`--color-bg`, `--color-text` 등)로 테마 값 관리
- 외부 요청은 마크다운 파서 CDN 스크립트 하나로 제한
- `localStorage` 키: `blog-theme` (`"dark"` | `"light"`)
- 접근성: `<img>` alt 필수, 버튼에 `aria-label`, 키보드 탐색 지원

## 실행 방법

로컬에서 CORS 없이 파일을 로드하려면 간단한 로컬 서버가 필요:

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .
```

브라우저에서 `http://localhost:8080` 접속.
