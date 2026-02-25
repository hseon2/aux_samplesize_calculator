# AB Test Sample Size Calculator

AB 테스트 예상 소요 일수를 계산하는 웹 애플리케이션입니다.

## 기능

1. **CSV/Excel 파일 업로드**: 데이터 파일을 업로드하고 미리보기로 확인
2. **테스트 파라미터 설정**:
   - Data range (시작일, 종료일)
   - Number of Offers (기본값: 2)
   - Confidence Level (기본값: 95%)
   - Statistical Power (기본값: 80%)
3. **세그먼트 라벨 선택**: Visits, Cart Add, Order 라벨 선택
4. **데이터 파싱**: Site Code별로 데이터 정리
5. **통계 계산**:
   - 5% Uplift 기준 예상 테스트 기간
   - 10% Uplift 기준 예상 테스트 기간
   - Cart 모수 확보 필요 일수
   - Order 모수 확보 필요 일수

## GitHub 저장소에서 설치 및 실행 (배포)

```bash
# 저장소 클론
git clone https://github.com/<사용자명>/<저장소명>.git
cd <저장소명>

# 의존성 설치
npm install

# 개발 서버 + API 서버 동시 실행 (API로 불러오기 사용 시)
npm run dev:all
```

- **프론트만** 사용(파일 업로드만): `npm run dev` → http://localhost:5173
- **API로 불러오기**까지 사용: `npm run dev:all` → API 서버(5000) + Vite(5173) 동시 실행

### API 사용 시 추가 설정

1. **환경 변수**  
   `server/.env.example` 을 복사해 `server/.env` 로 저장한 뒤, Adobe Analytics API 값(Org ID, Client ID, Client Secret, Report Suite ID 등)을 채워 넣으세요.  
   **`.env` 파일은 절대 GitHub에 올리지 마세요.** (이미 .gitignore에 포함됨)

2. **세그먼트 CSV**  
   `server/Segment define_v2.csv` 를 두어야 "API로 불러오기" 옵션이 동작합니다.  
   형식은 아래 [API로 불러오기 – 세그먼트 CSV](#api로-불러오기--세그먼트-csv-업데이트-방법) 섹션을 참고하세요.

## 설치 및 실행 (로컬)

```bash
npm install
npm run dev      # 프론트만
npm run dev:all  # 프론트 + API 서버
npm run build    # 프로덕션 빌드
```

## 사용 방법

1. CSV 또는 Excel 파일을 업로드합니다.
2. 데이터 미리보기를 확인합니다.
3. 테스트 파라미터를 설정합니다 (날짜 범위, Offers 수, Confidence Level, Statistical Power).
4. 세그먼트 라벨을 선택합니다 (Visits, Cart Add, Order).
5. "계산하기" 버튼을 클릭합니다.
6. 결과 테이블에서 각 Site Code별 예상 일수를 확인합니다.

## API로 불러오기 – 세그먼트 CSV 업데이트 방법

**API로 불러오기**를 사용할 때, 사업부/페이지 타입/상세 타입 옵션과 Adobe Analytics 세그먼트 ID는 **Segment define_v2.csv**에서 읽습니다.

### 1. 어떤 파일을 수정하나요?

- **파일 이름:** `Segment define_v2.csv`
- **위치 (둘 중 하나):**
  - `aux_samplesize_calculator/server/Segment define_v2.csv` (우선 사용)
  - 또는 `AA API 확인/Segment define_v2.csv`

파일을 수정한 뒤 **서버를 재시작**하면 옵션에 반영됩니다.

### 2. CSV 헤더(컬럼명)

첫 번째 줄에는 아래 **영문 헤더**를 사용해야 합니다.

| 컬럼명 | 의미 | 필수 |
|--------|------|------|
| `Division` | 사업부 | ✅ |
| `Page type` | 페이지 타입 | ✅ |
| `Additional option` | 상세 타입 | ✅ |
| `segment Name(Visit)` | Visit 세그먼트 이름 (표시용) | 선택 |
| `Segment id(Visit)` | Visit용 세그먼트 ID (API 호출에 사용) | ✅ |
| `segment Name(Cart)` | Cart 세그먼트 이름 | 선택 |
| `Segment id(Cart)` | Cart용 세그먼트 ID | ✅ |
| `segment Name(Order)` | Order 세그먼트 이름 | 선택 |
| `Segment id(Order)` | Order용 세그먼트 ID | ✅ |

### 3. 작성 예시

```csv
Division,Page type,Additional option,segment Name(Visit),Segment id(Visit),segment Name(Cart),Segment id(Cart),segment Name(Order),Segment id(Order)
MX,Product,All,Samsung MX Visit,seg_id_visit_1,Samsung MX Cart,seg_id_cart_1,Samsung MX Order,seg_id_order_1
```

- 구분자: 쉼표(`,`), 세미콜론(`;`), 탭 중 하나 사용 가능
- 인코딩: UTF-8 권장 (Excel 저장 시 “CSV UTF-8”로 저장)

### 4. 이후 CSV 업데이트 절차

세그먼트나 옵션을 바꿀 때는 아래 순서대로 하면 됩니다.

1. **파일 열기**  
   `server/Segment define_v2.csv` 를 Excel 또는 메모장/VS Code 등으로 엽니다.

2. **내용 수정**  
   - 새 사업부/페이지 타입/상세 타입 조합을 **한 행씩** 추가  
   - 각 행에 해당하는 **Segment id(Visit)**, **Segment id(Cart)**, **Segment id(Order)** 값을 넣습니다.  
   - 기존 행 수정·삭제도 가능합니다. **첫 줄 헤더는 변경하지 마세요.**

3. **저장**  
   - **다른 이름으로 저장** 시 파일명은 그대로 `Segment define_v2.csv` 로 두고, **인코딩: UTF-8** 로 저장합니다.  
   - Excel에서는 "CSV UTF-8(쉼표로 분리)"로 저장하면 됩니다.

4. **서버 재시작**  
   - 터미널에서 `npm run dev:all` 을 실행 중이었다면 **Ctrl+C**로 멈춘 뒤, 다시 `npm run dev:all` 로 서버를 띄웁니다.  
   - 브라우저를 새로 고침하면 **API로 불러오기** 옵션(사업부/페이지 타입/상세 타입)에 변경 내용이 반영됩니다.

> **요약:** CSV 수정 → UTF-8로 저장 → 서버 재시작 → 브라우저 새로 고침

---

## 파일 형식

업로드하는 CSV/Excel 파일은 다음 형식을 따라야 합니다:
- A열: 세그먼트 라벨 (예: "MD Click > BF Visit")
- B열: Site Code (예: "de", "uk", "es")
- C열: 숫자 값 (Visits, Cart Add, Order 수)

## 계산 공식

### 5% Uplift 기준 예상 테스트 기간
```
= ROUNDUP((
  (NORM.S.INV(1-(1-Confidence)/2) * SQRT(2*Pooled*(1-Pooled))
  + NORM.S.INV(Power) * SQRT(CVR*(1-CVR) + (CVR*1.05)*(1-(CVR*1.05)))
)^2 / ((CVR*1.05 - CVR)^2) * NumberOfOffers / DailyVisits, 0)
```

### 10% Uplift 기준 예상 테스트 기간
위 공식에서 1.05를 1.10으로 변경

### 모수 확보 필요 일수
```
= IF(DailyMetric >= 100*NumberOfOffers, 1, 
     ROUNDUP(100*NumberOfOffers / DailyMetric, 0))
```

## 기술 스택

- React 18
- TypeScript
- Vite
- xlsx (Excel 파일 처리)


