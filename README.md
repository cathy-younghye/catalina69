# 10코아 노트

암웨이 10코아(10가지 핵심 실천 항목)를 매일 기록하는 개인용 웹 노트.
폰(아이폰)과 노트북에서 같은 Google 계정으로 로그인하면 기록이 자동으로 연동된다.

- **사용 주소**: https://ten-core-note.web.app
- **코드 저장소**: https://github.com/cathy-younghye/catalina69 (브랜치 `master`)
- **Firebase 프로젝트**: `ten-core-note` (https://console.firebase.google.com/project/ten-core-note)

---

## 주요 기능

| 기능 | 내용 |
|---|---|
| 사업연도 | 9월 1일 ~ 다음해 8월 31일 단위로 선택 |
| 달력 | 월 버튼 + 날짜 칸. 기록한 날 표시, 10개 모두 완료한 날 강조, 일정 있는 날 점 표시 |
| 주말·공휴일 | 토요일 파란색, 일요일·공휴일 빨간색. 대체공휴일 자동 계산 (2024~2031) |
| 일정 | 날짜별 일정 등록 (15분 단위 시간 + 내용 → 확인 버튼), 달력 아래 월별 일정 목록 |
| 10코아 | 항목별 완료 체크 + 내용 칸 (글 양에 따라 자동으로 늘어남), 진행 막대 n/10 |
| 마지막 칸 | 감사일기 + 다음날 스케쥴 (각 3줄, 자동 확장) |
| 저장 | 입력 즉시 자동 저장 (브라우저) + 로그인 시 Firebase 동기화 |
| 백업 | JSON 백업 저장 / 불러오기, 인쇄 |

### 10코아 항목과 안내 문구
1. 운동 — 매일 30분 이상 운동, 사업을 지속할 수 있는 건강 관리
2. 책 읽기 — 매일 30분씩
3. 음원듣기 — 매일 1개 이상
4. 미팅 참석 — 오픈 미팅(OM), 세미나, 랠리 등 공식 행사에 빠짐없이 참석
5. 제품 애용 — 100% 제품 애용, 암웨이 전 제품을 직접 써보고 애용하기
6. 소비자관리 — 꾸준히 제품을 사용하는 고정 소비자 30명 만들기
7. 사업설명 — STP(Show The Plan) 주 3회 이상
8. 상담 — 업라인 스폰서와 매일 상담
9. 신뢰 쌓기 — 약속 준수, 금전 거래 주의, 높은 도덕성 유지
10. E-Com — 온라인 시스템 및 단체 커뮤니케이션 적극 활용

---

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 구조 |
| `style.css` | 디자인. 맨 위 `:root`의 색 변수만 바꾸면 전체 색이 바뀜 |
| `app.js` | 노트 기능 전체 (달력, 10코아, 일정, 자동 저장, 백업) |
| `holidays.js` | 공휴일 표. 음력 공휴일·선거일은 해마다 직접 추가 |
| `cloud.js` | Google 로그인 + Firestore 동기화 |
| `firebase.json`, `.firebaserc` | Firebase 호스팅 설정 |

### 디자인
- 글꼴: 맑은 고딕
- 색: 따뜻한 회색 바탕, 흰 패널, 아이보리 칸, **오렌지 포인트(#e8711c)**, 연한 살구색 보조
- 색 변경은 `style.css` 맨 위 `--strong`(포인트 색), `--accent-soft`, `--accent-mid` 등을 수정

---

## 데이터 저장 구조

- **브라우저**: `localStorage` 키 `amway-10core-notes-v1` (오프라인 캐시)
- **Firestore**: `users/{로그인 uid}/notes/{YYYY-MM-DD}`
- 날짜 하나의 데이터 모양:
  ```json
  {
    "items": [{ "done": false, "text": "" }, "... 10개"],
    "thanks": "감사일기",
    "schedule": "다음날 스케쥴",
    "events": [{ "time": "14:00", "text": "부산퀸미팅" }]
  }
  ```

### Firestore 보안 규칙 (콘솔 → Firestore → 규칙)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## 수정 후 인터넷에 올리기 (배포)

Claude 앱의 터미널이나 윈도우 명령 프롬프트에서 실행한다.

```
cd "C:\클로드 작업-1\amway-10core-note"
firebase.cmd deploy --only hosting --project ten-core-note
```

- PowerShell에서는 `firebase`, `npm` 대신 **`firebase.cmd`, `npm.cmd`**를 써야 한다 (실행 정책 때문에 `.ps1` 실행이 막혀 있음)
- 로그인이 풀렸으면 먼저 `firebase.cmd login`
- 올린 뒤 폰에서는 새로고침해야 새 버전이 보인다

GitHub에 올리기:
```
git add .
git commit -m "변경 내용"
git push
```

---

## 겪었던 문제와 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| Google 로그인 시 `400 redirect_uri_mismatch` | 로그인 도메인(authDomain)을 `web.app`으로 바꿔 보냄 | `cloud.js`의 authDomain을 `ten-core-note.firebaseapp.com`으로 유지 |
| 로그인했는데 계속 "오프라인" 표시 | 스냅샷 메타데이터 변화를 받지 않음 | `onSnapshot`에 `includeMetadataChanges: true` |
| `Missing or insufficient permissions` | Firestore 규칙 미게시 / 오타(`rurules_version`) | 규칙을 다시 붙여 넣고 게시 |
| 배포 시 `.git` 폴더까지 공개됨 | 호스팅 폴더가 프로젝트 전체 | `firebase.json`의 ignore에 숨김 폴더 추가 |
| Firebase 결제 등록 시 4만 원 선불 요구 | 유료 요금제(Blaze) 등록 절차 | 결제 등록 불필요. 무료(Spark) 요금제로 충분, Firestore는 Standard 버전 |
| 아이폰 "보안 연결할 수 없음" | 와이파이 차단·날짜 설정·VPN 등 기기 쪽 문제 | LTE로 열기, 날짜 자동 설정, VPN/광고 차단 끄기 |

---

## 앞으로 해볼 만한 것
- Firestore 규칙을 내 이메일(kyyhsw@gmail.com) 전용으로 좁히기
- 홈 화면용 앱 아이콘 (manifest + 아이콘 이미지)
- `holidays.js`에 2032년 이후 음력 공휴일 추가
- 제헌절(7/17)·노동절(5/1) 공휴일 여부 확인 후 반영
