# 10코아 노트 — Claude 작업 안내

사용자 한 명이 폰(아이폰)과 노트북에서 쓰는 개인용 일일 기록 웹앱. 프레임워크·빌드 도구 없이 순수 HTML/CSS/JS.
자세한 기능·문제 해결 기록은 `README.md` 참고.

## 사용자와 대화
- 한국어로, 쉬운 말로 설명한다 (개발자가 아님). 단계별 안내는 번호 목록으로.
- 기능을 바꾸면 브라우저에서 확인 → git 커밋 → (요청 시) 배포·push 순서로 진행한다.

## 구조
- `app.js`: IIFE 하나. 상태(`notes`, `current`)·렌더링·자동 저장. `window.TenCore`로 cloud.js와 연결
- `cloud.js`: ES 모듈. Firebase SDK 10.12.2 (gstatic CDN). `window.TenCoreCloud.push()`로 변경분 업로드
- `holidays.js`: `KoreanHolidays.get("YYYY-MM-DD")` → 공휴일 이름. 음력 공휴일은 `LUNAR` 표에 연도별로 추가
- 색은 `style.css` 맨 위 `:root` 변수로만 관리. 하드코딩 색 추가하지 말 것

## 데이터
- 날짜 키 `YYYY-MM-DD` → `{ items[10]{done,text}, thanks, schedule, events[{time,text}] }`
- localStorage `amway-10core-notes-v1` + Firestore `users/{uid}/notes/{date}`
- 수정 시 `afterEdit(key)` → `dirty` 집합에 추가 → `persist()`가 로컬 저장 후 `pushDirty()`로 업로드
- 데이터 모양을 바꾸면 `pick()`, `emptyNote()`, `isEmpty()`와 기존 저장 데이터 호환을 함께 처리

## 반드시 지킬 것
- `cloud.js`의 `authDomain`은 `ten-core-note.firebaseapp.com` 유지 (web.app으로 바꾸면 redirect_uri_mismatch)
- 호스팅 public 폴더가 프로젝트 루트(`.`)다. 새 문서·데이터·백업 파일을 만들면 `firebase.json`의 `ignore`에 넣거나 폴더 밖에 둔다. 노트 백업 JSON은 절대 이 폴더에 두지 않는다
- 사용자 노트 데이터(localStorage, Firestore)를 테스트로 덮어쓰거나 지우지 않는다. 테스트 입력은 반드시 지운다
- Google 로그인·Firebase 로그인은 사용자가 직접 한다

## 명령 (Windows, PowerShell 실행 정책 때문에 .cmd 사용)
- 로컬 미리보기: `.claude/launch.json`의 `10core-note` (상위 폴더, http-server 5180 포트)
- 배포: `firebase.cmd deploy --only hosting --project ten-core-note` — 사용자 터미널 패널에서 실행
- GitHub: `git push` (origin = cathy-younghye/catalina69, 브랜치 master)
- 커밋 메시지는 한국어
