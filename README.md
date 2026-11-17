# 조이쀼의 가계부

부부 공용 가계부 웹앱. 순수 HTML/CSS/JavaScript + Supabase(로그인·DB·실시간), GitHub Pages로 배포합니다. 빌드 과정이 없어서 파일을 고쳐 올리면 그대로 반영돼요.

## 파일 구성

```
index.html          화면 뼈대(HTML)와 모달. 스크립트를 순서대로 불러와요
css/style.css       모든 스타일
js/                 앱 코드 (아래 "실행 순서" 참고)
manifest.json       홈 화면 앱(PWA) 정보
sw.js               서비스 워커 (항상 최신 화면 우선, 오프라인일 때만 저장본)
icon-192.png, icon-512.png, apple-touch-icon.png
supabase-security-check.sql   보안(RLS) 점검용
supabase-app-kv.sql           템플릿·예산·메모·잠금·이력 저장용 테이블
supabase-realtime.sql         실시간 동시 수정 반영용 설정
.github/workflows/keepalive.yml   무료 Supabase 일시정지 방지(주 2회 조회)
```

## 실행 순서 (js/)

모든 파일이 **하나의 전역 공간을 같이 써요.** 앞 파일의 변수·함수를 뒤 파일이 쓰기 때문에 `index.html`에 적힌 순서가 곧 실행 순서예요. 각 파일은 `"use strict";`로 시작해요.

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `config.js` | Supabase 접속 정보 (공개용 키만 사용) |
| 2 | `core.js` | 상수(`SECS`, `VARS`, `ALL`), 전역 상태 `S`, 공통 함수, 합계 계산 `calc()` |
| 3 | `data.js` | 저장 계층: 되돌리기, 백업 날짜, `flush()`(저장), 불러오기, 시드 |
| 4 | `month.js` | 월 화면: 카드·행 그리기, 전월 복사, `refresh()` |
| 5 | `overview.js` | 종합 현황 화면과 차트 |
| 6 | `kv.js` | 공용 저장소 `app_kv`, 월 잠금, 반복 항목 템플릿, 예산 설정 |
| 7 | `views.js` | 월별 비교·검색·메모 화면, 월 화면 밖의 입력/클릭 처리 |
| 8 | `tools.js` | 변경 이력 기록, 여러 줄 붙여넣기, 항목 수정·이동·복사, 월 요약, 연간 결산 |
| 9 | `extras.js` | 작은 안내, 예산 알림, 태그, 빠른 추가, CSV 내보내기 |
| 10 | `offline-pin.js` | 오프라인 임시 저장, 앱 잠금(PIN·생체 인증) |
| 11 | `realtime.js` | 실시간 동시 수정 반영 |
| 12 | `insights.js` | 중복 항목 감지, 홈 대시보드, 달력 보기 |
| 13 | `car.js` | 차계부: 주유·보험·세금·정비 기록, 요약(유지비·연비 추정), 기록 추가·수정 모달, CSV |
| 14 | `quick.js` | 한 줄 빠른 입력, 결제수단 표시(@신용 등), 항목 나누기, 홈 화면 바로가기(#add, #caradd) 처리 |
| 15 | `projects.js` | 프로젝트 가계부(#태그로 묶어 목표 예산과 비교, 여러 해 합산) |
| 16 | `tax.js` | 연말정산 도우미(사람별 신용·체크·현금 사용액, 소득공제 대략 계산, 일괄 지정) |
| 17 | `shell.js` | 라우팅·메뉴·화면 그리기, 로그인, 시작(`boot`), 이벤트 연결, 백업·복원, 테마, 더보기 |

## 데이터 흐름 한눈에

- 상태: `S.months[1..12][섹션]` 배열 (섹션: income, saving, fixed, food, living, life, etc)
- 입력 → `dirty`/`dels`/`metaDirty`에 표시 → `schedule()`이 0.6초 뒤 `flush()`로 Supabase에 저장 (저장 못 하면 이 기기에 남겨 두었다가 다시 올려요)
- 공용 저장소 `app_kv`의 키: `templates`, `budgets`, `memo`, `locks`, `history`, `car`(차계부; 기록 id별로 병합해서 저장), `projects`, `tax`
- 화면은 주소의 `#연도-화면`(예: `#2026-m10`, `#2026-home`)으로 정해지고, `render()`가 해당 `xxxView()`로 `main`을 통째로 다시 그려요.

## 수정할 때 주의

1. **최상위(함수 밖) 코드는 앞 파일에 있는 것만 쓸 수 있어요.** 예: `shell.js`에서 정의하는 `main`, `navEl`은 그보다 앞 파일의 최상위에서 쓰면 안 돼요. 함수 안에서(실행 시점에) 쓰는 건 괜찮아요.
2. 새 파일을 만들면 `index.html`의 `<script>` 목록에 **알맞은 위치**에 추가하세요. `shell.js`는 맨 끝에 있어야 해요(마지막 줄에서 `boot()`를 실행해요).
3. 전역 이름이 겹치지 않게 주의하세요. 이미 만든 이름은 `window`에 그대로 붙어요.
4. 개인 금융 데이터(`backup-*.json`, `*백업*.json`, `*-seed.sql`)는 `.gitignore`로 제외돼 있어요. 절대 올리지 마세요.

## 내 컴퓨터에서 확인하기

```bash
python -m http.server 8000
```

그다음 브라우저에서 `http://localhost:8000/`을 엽니다. (Supabase 로그인이 필요해요.)
