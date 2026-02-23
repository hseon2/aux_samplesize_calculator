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

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

## 사용 방법

1. CSV 또는 Excel 파일을 업로드합니다.
2. 데이터 미리보기를 확인합니다.
3. 테스트 파라미터를 설정합니다 (날짜 범위, Offers 수, Confidence Level, Statistical Power).
4. 세그먼트 라벨을 선택합니다 (Visits, Cart Add, Order).
5. "계산하기" 버튼을 클릭합니다.
6. 결과 테이블에서 각 Site Code별 예상 일수를 확인합니다.

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


