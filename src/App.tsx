import React, { useEffect, useMemo, useState } from 'react';
import * as ExcelJS from 'exceljs';
import { FileUpload } from './components/FileUpload';
import { ApiDataLoader } from './components/ApiDataLoader';
import { DataPreview } from './components/DataPreview';
import { InputForm, InputParams } from './components/InputForm';
import { SegmentSelector } from './components/SegmentSelector';
import { ResultTable } from './components/ResultTable';
import { MilestoneCalculator } from './components/MilestoneCalculator';
import { 
  RawDataRow, 
  extractSegmentLabels, 
  extractSiteCodes, 
  parseData 
} from './utils/parser';
import { 
  calculateAll, 
  calculateDays,
  CalculationParams,
  TestDurationResult 
} from './utils/calculator';

const makeId = () => {
  try {
    // 일부 환경에서 crypto.randomUUID가 없을 수 있어 fallback 제공
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCrypto: any = (globalThis as any).crypto;
    if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  } catch { /* ignore */ }
  return `tp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const isUnspecifiedSiteCode = (siteCode: string) =>
  String(siteCode ?? '').trim().toLowerCase() === 'unspecified';

function App() {
  const SUMMARY_TAB_ID = '__summary__';
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [segmentLabels, setSegmentLabels] = useState<ReturnType<typeof extractSegmentLabels>>([]);
  const [, setParsedData] = useState<ReturnType<typeof parseData>>([]);
  type TargetPageSet = {
    id: string;
    displayName: string; // 사용자가 지정하는 Target Page 표시명
    visitsLabel: string;
    cartAddLabel: string;
    orderLabel: string;
    siteCodes: string[];
    selectedSiteCodes: string[]; // Site Code 다중 선택(표에서 체크)
    results: TestDurationResult[];
  };
  const [initialTargetPageId] = useState(() => makeId());
  const [targetPages, setTargetPages] = useState<TargetPageSet[]>(() => ([
    { id: initialTargetPageId, displayName: '', visitsLabel: '', cartAddLabel: '', orderLabel: '', siteCodes: [], selectedSiteCodes: [], results: [] },
  ]));
  const [activeTargetPageId, setActiveTargetPageId] = useState<string>(() => initialTargetPageId);
  const [error, setError] = useState<string>('');
  const [view, setView] = useState<'setup' | 'result'>('setup');
  const [dataSource, setDataSource] = useState<'file' | 'api'>('file');
  const [activeTool, setActiveTool] = useState<'sample-size' | 'milestone'>('sample-size');

  /** true면 Site Code가 Unspecified인 행을 표/엑셀에서 제외 (기본: 제외) */
  const [excludeUnspecified, setExcludeUnspecified] = useState(true);
  /** Summary 탭에서 선택한 Site Code */
  const [summarySelectedSiteCodes, setSummarySelectedSiteCodes] = useState<string[]>([]);
  /** "선택 다운로드" 체크박스(선택 모드)를 노출할 탭 id */
  const [selectionModeTabId, setSelectionModeTabId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  // 추천 조건(적용값) + 편집용(draft)
  const [suggestCartLimitDays, setSuggestCartLimitDays] = useState<number>(14);
  const [suggestUseOrderLimit, setSuggestUseOrderLimit] = useState<boolean>(true);
  const [suggestOrderLimitDays, setSuggestOrderLimitDays] = useState<number>(30);
  const [suggestDraftCartLimitDays, setSuggestDraftCartLimitDays] = useState<number>(14);
  const [suggestDraftUseOrderLimit, setSuggestDraftUseOrderLimit] = useState<boolean>(true);
  const [suggestDraftOrderLimitDays, setSuggestDraftOrderLimitDays] = useState<number>(30);
  const [suggestEditing, setSuggestEditing] = useState<boolean>(false);
  const [tpNameEditing, setTpNameEditing] = useState<boolean>(false);
  const [tpNameDraftById, setTpNameDraftById] = useState<Record<string, string>>({});

  const getTargetPageDisplayName = (tp: TargetPageSet, idx: number): string => {
    const dn = String(tp.displayName ?? '').trim();
    if (dn) return dn;
    const vl = String(tp.visitsLabel ?? '').trim();
    return vl || `Target Page ${idx + 1}`;
  };

  const getTargetPageDefaultName = (tp: TargetPageSet, idx: number): string => {
    const vl = String(tp.visitsLabel ?? '').trim();
    return vl || `Target Page ${idx + 1}`;
  };

  const [inputParams, setInputParams] = useState<InputParams>({
    rangeDays: 30,
    startDate: '',
    endDate: '',
    numberOfOffers: 2,
    confidenceLevel: 0.95,
    statisticalPower: 0.80
  });

  const handleDataLoaded = (data: RawDataRow[], meta?: { startDate: string; endDate: string }) => {
    setRawData(data);
    setError('');
    setView('setup');
    const labels = extractSegmentLabels(data);
    setSegmentLabels(labels);
    
    if (meta?.startDate && meta?.endDate) {
      const start = new Date(meta.startDate);
      const end = new Date(meta.endDate);
      setInputParams((prev) => ({
        ...prev,
        startDate: meta.startDate,
        endDate: meta.endDate,
        rangeDays: calculateDays(start, end),
      }));
    }
    
    const visitsLabel = labels.find(l => l.type === 'visits')?.label ?? '';
    const cartAddLabel = labels.find(l => l.type === 'cartAdd')?.label ?? '';
    const orderLabel = labels.find(l => l.type === 'order')?.label ?? '';
    const codes = visitsLabel ? extractSiteCodes(data, visitsLabel) : [];

    const first: TargetPageSet = {
      id: makeId(),
      displayName: '',
      visitsLabel,
      cartAddLabel,
      orderLabel,
      siteCodes: codes,
      selectedSiteCodes: [],
      results: [],
    };
    setTargetPages([first]);
    setActiveTargetPageId(first.id);
  };

  useEffect(() => {
    if (!excludeUnspecified) return;
    setTargetPages((prev) => {
      let changed = false;
      const next = prev.map((tp) => {
        const filtered = tp.selectedSiteCodes.filter((c) => !isUnspecifiedSiteCode(c));
        if (filtered.length !== tp.selectedSiteCodes.length) changed = true;
        return { ...tp, selectedSiteCodes: filtered };
      });
      return changed ? next : prev;
    });
    setSummarySelectedSiteCodes((prev) => prev.filter((c) => !isUnspecifiedSiteCode(c)));
  }, [excludeUnspecified]);

  // 탭 변경 시 선택 모드는 해제(체크박스 숨김)
  useEffect(() => {
    setSelectionModeTabId(null);
  }, [activeTargetPageId]);

  // 결과가 바뀌면 추천 상세는 접어둔다
  useEffect(() => {
    setAiOpen(false);
  }, [excludeUnspecified, targetPages]);

  const updateTargetPage = (id: string, patch: Partial<TargetPageSet>) => {
    setTargetPages(prev => prev.map(tp => tp.id === id ? { ...tp, ...patch } : tp));
  };

  const handleVisitsChange = (id: string, label: string) => {
    const codes = label && rawData.length > 0 ? extractSiteCodes(rawData, label) : [];
    // Visits 라벨이 바뀌면 Site Code/결과가 달라지므로 선택/필터는 초기화
    updateTargetPage(id, { visitsLabel: label, siteCodes: codes, selectedSiteCodes: [] });
  };

  const handleCalculate = () => {
    const invalid = targetPages.find(tp => !tp.visitsLabel || (!tp.cartAddLabel && !tp.orderLabel));
    if (invalid) {
      setError('각 Target Page에서 Visits는 필수이며, Cart 또는 Order 중 최소 1개는 선택해주세요.');
      return;
    }

    const hasRangeDays = inputParams.rangeDays > 0;
    const hasDates = Boolean(inputParams.startDate && inputParams.endDate);
    if (!hasRangeDays && !hasDates) {
      setError('Data range(일수) 또는 시작일/종료일을 입력해주세요.');
      return;
    }

    const noCodes = targetPages.find(tp => tp.siteCodes.length === 0);
    if (noCodes) {
      setError('Site Code를 찾을 수 없습니다. Visits 라벨 선택을 확인해주세요.');
      return;
    }

    try {
      // 계산 수행
      const calcParams: CalculationParams = {
        rangeDays: hasRangeDays ? inputParams.rangeDays : undefined,
        startDate: hasDates ? new Date(inputParams.startDate) : undefined,
        endDate: hasDates ? new Date(inputParams.endDate) : undefined,
        numberOfOffers: inputParams.numberOfOffers,
        confidenceLevel: inputParams.confidenceLevel,
        statisticalPower: inputParams.statisticalPower
      };

      const nextPages = targetPages.map(tp => {
        const parsed = parseData(rawData, tp.visitsLabel, tp.cartAddLabel, tp.orderLabel, tp.siteCodes);
        setParsedData(parsed);
        const calculated = calculateAll(parsed, calcParams);
        const sorted = [...calculated].sort((a, b) => b.dailyVisits - a.dailyVisits);
        return { ...tp, results: sorted };
      });

      if (nextPages.some(tp => tp.results.length === 0)) {
        setError('Data range(일수) 또는 날짜 입력이 올바르지 않아 계산할 수 없습니다.');
        return;
      }

      setTargetPages(nextPages);
      // Target Page가 여러 개면 결과 기본 탭은 Summary
      setActiveTargetPageId(nextPages.length > 1 ? SUMMARY_TAB_ID : (nextPages[0]?.id ?? activeTargetPageId));

      setError('');
      setView('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산 중 오류가 발생했습니다.');
    }
  };

  const safeSheetName = (name: string, fallback: string) => {
    const raw = (name || fallback).trim() || fallback;
    // Excel 시트명 제한: 31자, 금지문자: \ / ? * [ ]
    const cleaned = raw.replace(/[\\\/\?\*\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
  };

  const buildDataRangeLabel = (): string => {
    const start = (inputParams.startDate || '').trim();
    const end = (inputParams.endDate || '').trim();
    const days = inputParams.rangeDays;
    const daysText = Number.isFinite(days) && days > 0 ? `${days}days` : '';
    if (start && end && daysText) return `${start}~${end}, ${daysText}`;
    if (start && end) return `${start}~${end}`;
    if (daysText) return daysText;
    return '-';
  };

  type ExportRow = {
    siteCode: string;
    targetPage: string;
    targetPageOrder: number; // Target Page 추가 순서(0부터)
    dailyVisits: number | '';
    cartCVR: number | '';
    cart5: number | string | '';
    cart10: number | string | '';
    orderCVR: number | '';
    order5: number | string | '';
    order10: number | string | '';
    minCart: number | string | '';
    minOrder: number | string | '';
  };

  const buildExportRowsAll = (): ExportRow[] => {
    const rows: ExportRow[] = [];
    targetPages.forEach((tp, idx) => {
      if (!tp.results || tp.results.length === 0) return;
      const targetPage = getTargetPageDisplayName(tp, idx);
      const showCart = Boolean(tp.cartAddLabel);
      const showOrder = Boolean(tp.orderLabel);
      tp.results.forEach((r) => {
        if (excludeUnspecified && isUnspecifiedSiteCode(r.siteCode)) return;
        rows.push({
          siteCode: r.siteCode,
          targetPage,
          targetPageOrder: idx,
          // Daily Visits는 엑셀에서 정수로 반올림 표시
          dailyVisits: Math.round(r.dailyVisits),
          cartCVR: showCart ? r.cartCVR : '',
          cart5: showCart ? r.cartTestDuration5Percent : '',
          cart10: showCart ? r.cartTestDuration10Percent : '',
          orderCVR: showOrder ? r.orderCVR : '',
          order5: showOrder ? r.orderTestDuration5Percent : '',
          order10: showOrder ? r.orderTestDuration10Percent : '',
          minCart: showCart ? r.minDaysForCart : '',
          minOrder: showOrder ? r.minDaysForOrder : '',
        });
      });
    });
    return rows;
  };

  const buildExportRowsSelected = (): ExportRow[] => {
    const active = targetPages.find(tp => tp.id === activeTargetPageId) ?? targetPages[0];
    if (!active || !active.results || active.results.length === 0) return [];
    const selected = active.selectedSiteCodes ?? [];
    if (selected.length === 0) return [];
    const selectedSet = new Set(selected);
    const showCart = Boolean(active.cartAddLabel);
    const showOrder = Boolean(active.orderLabel);
    const activeIdx = Math.max(0, targetPages.findIndex((tp) => tp.id === active.id));
    const targetPage = getTargetPageDisplayName(active, activeIdx);
    return active.results
      .filter((r) => selectedSet.has(r.siteCode))
      .filter((r) => !excludeUnspecified || !isUnspecifiedSiteCode(r.siteCode))
      .map((r) => ({
        siteCode: r.siteCode,
        targetPage,
        targetPageOrder: 0,
        dailyVisits: Math.round(r.dailyVisits),
        cartCVR: showCart ? r.cartCVR : '',
        cart5: showCart ? r.cartTestDuration5Percent : '',
        cart10: showCart ? r.cartTestDuration10Percent : '',
        orderCVR: showOrder ? r.orderCVR : '',
        order5: showOrder ? r.orderTestDuration5Percent : '',
        order10: showOrder ? r.orderTestDuration10Percent : '',
        minCart: showCart ? r.minDaysForCart : '',
        minOrder: showOrder ? r.minDaysForOrder : '',
      }));
  };

  const buildExportRowsSelectedSummary = (selected: string[]): ExportRow[] => {
    if (!selected || selected.length === 0) return [];
    const selectedSet = new Set(selected);
    const rows: ExportRow[] = [];
    targetPages.forEach((tp, idx) => {
      if (!tp.results || tp.results.length === 0) return;
      const targetPage = getTargetPageDisplayName(tp, idx);
      const showCart = Boolean(tp.cartAddLabel);
      const showOrder = Boolean(tp.orderLabel);
      tp.results.forEach((r) => {
        if (!selectedSet.has(r.siteCode)) return;
        if (excludeUnspecified && isUnspecifiedSiteCode(r.siteCode)) return;
        rows.push({
          siteCode: r.siteCode,
          targetPage,
          targetPageOrder: idx,
          dailyVisits: Math.round(r.dailyVisits),
          cartCVR: showCart ? r.cartCVR : '',
          cart5: showCart ? r.cartTestDuration5Percent : '',
          cart10: showCart ? r.cartTestDuration10Percent : '',
          orderCVR: showOrder ? r.orderCVR : '',
          order5: showOrder ? r.orderTestDuration5Percent : '',
          order10: showOrder ? r.orderTestDuration10Percent : '',
          minCart: showCart ? r.minDaysForCart : '',
          minOrder: showOrder ? r.minDaysForOrder : '',
        });
      });
    });
    return rows;
  };

  const writeWorkbookAndDownload = async (rows: ExportRow[], fileName: string) => {
    if (rows.length === 0) return;

    const toNumForSort = (v: number | string | ''): number | null => {
      if (v === '' || v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      const n = Number(String(v).replace(/,/g, '').trim());
      return Number.isFinite(n) ? n : null;
    };

    // 정렬 시 0은 "의미 없는 값"으로 보고 최하단으로 보낸다.
    const normalizeSortKey = (n: number | null): number => {
      if (n === null) return Infinity;
      if (!Number.isFinite(n)) return Infinity;
      if (n === 0) return Infinity;
      return n;
    };

    // 엑셀 행 정렬:
    // - Site Code 기준으로 묶음 유지
    // - Site Code 내 Target Page가 여러 개면 "첫 번째 Target Page 행"의 H(=minCart) 값으로만 그룹 정렬
    // - 그룹 내부는 Target Page 오름차순
    const rowsBySite = new Map<string, ExportRow[]>();
    rows.forEach((r) => {
      const key = String(r.siteCode ?? '');
      const list = rowsBySite.get(key) ?? [];
      list.push(r);
      rowsBySite.set(key, list);
    });

    const siteGroups = Array.from(rowsBySite.entries()).map(([siteCode, groupRows]) => {
      // Target Page는 "추가했던 순서" 기준으로 정렬
      const within = [...groupRows].sort((a, b) => {
        if (a.targetPageOrder !== b.targetPageOrder) return a.targetPageOrder - b.targetPageOrder;
        return a.targetPage.localeCompare(b.targetPage);
      });
      const first = within[0];
      const firstKey = first ? normalizeSortKey(toNumForSort(first.minCart)) : Infinity; // H 기준
      const secondKey = first ? normalizeSortKey(toNumForSort(first.minOrder)) : Infinity; // L 기준
      return { siteCode, firstKey, secondKey, rows: within };
    });

    siteGroups.sort((a, b) => {
      if (a.firstKey !== b.firstKey) return a.firstKey - b.firstKey; // asc
      if (a.secondKey !== b.secondKey) return a.secondKey - b.secondKey; // asc
      return a.siteCode.localeCompare(b.siteCode);
    });

    const sortedRows = siteGroups.flatMap((g) => g.rows);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'AB Test Sample Size Calculator';
    wb.created = new Date();

    // ── 스타일 토큰 ─────────────────────────────────────────────
    const WHITE = 'FFFFFFFF';
    const BORDER_LIGHT_GRAY = 'FF9CA3AF';
    // 서비스 테이블 헤더 컬러와 통일
    const HEADER_BASE = 'FF1F2937'; // #1f2937
    const HEADER_SUB = 'FF334155'; // #334155
    const CART_GROUP = 'FF13523C'; // #13523c
    const CART_SUB = 'FF038658'; // #038658 (연한 부분만)
    const ORDER_GROUP = 'FF1E3A8A'; // #1e3a8a
    const ORDER_SUB = 'FF2B61DD'; // #2b61dd (5%/10% uplift 배경 더 연하게)
    const HEADER_TEXT = 'FFF8FAFC'; // #f8fafc
    const YELLOW = 'FFFFE699'; // <= 14 (차분한 개나리)
    const YELLOW_LIGHT = 'FFFFF2CC'; // 15~30 (차분한 연개나리)

    const setFill = (cell: ExcelJS.Cell, argb: string) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    };
    const setBorder = (cell: ExcelJS.Cell, argb: string) => {
      cell.border = {
        top: { style: 'thin', color: { argb } },
        left: { style: 'thin', color: { argb } },
        bottom: { style: 'thin', color: { argb } },
        right: { style: 'thin', color: { argb } },
      };
    };
    const center = { vertical: 'middle' as const, horizontal: 'center' as const, wrapText: false };


    const buildSheet = (opts: {
      sheetName: string;
      sheetRows: ExportRow[];
      includeTargetPage: boolean;
      enableCountryDividerDouble: boolean;
    }) => {
      const ws = wb.addWorksheet(safeSheetName(opts.sheetName, opts.sheetName));
      // 엑셀 기본 보기 확대/축소 비율(줌): 85%
      // Freeze(첫 행 고정)는 설정하지 않음
      ws.views = [{ state: 'normal', zoomScale: 85 }];

      const includeTarget = opts.includeTargetPage;
      const metaRows = 3;
      const headerTopRow = 4;
      const headerBottomRow = 5;
      const firstDataRow = 6;
      const tableFirstCol = 2; // B
      const tableLastCol = includeTarget ? 12 : 11; // L or K

      // A열(여백) 추가: 열 너비 8
      ws.getColumn(1).width = 8;

      // ── Row 1~3 meta ─────────────────────────────────────────
      const rangeText = buildDataRangeLabel();
      ws.addRow([]); // Row 1 (빈 행)
      ws.addRow(['', `Data range: ${rangeText}`]); // Row 2
      ws.addRow([]); // Row 3

      // ── Header (Row 4~5) ─────────────────────────────────────
      if (includeTarget) {
        ws.addRow(['', 'Site Code', 'Target Page', 'Daily Visits', 'Add to Cart CVR 기반 예상 테스트 기간', '', '', '', 'Order CVR 기반 예상 테스트 기간', '', '', '']);
        ws.addRow(['', 'Site Code', 'Target Page', 'Daily Visits', 'Cart CVR', '5% uplift', '10% uplift', 'Cart 기준 모수 확보 일수\n(각 그룹당 100건 이상)', 'Order CVR', '5% uplift', '10% uplift', 'Order 기준 모수 확보 일수\n(각 그룹당 100건 이상)']);
        ws.mergeCells(headerTopRow, 2, headerBottomRow, 2); // Site Code
        ws.mergeCells(headerTopRow, 3, headerBottomRow, 3); // Target Page
        ws.mergeCells(headerTopRow, 4, headerBottomRow, 4); // Daily Visits
        ws.mergeCells(headerTopRow, 5, headerTopRow, 8); // Cart group
        ws.mergeCells(headerTopRow, 9, headerTopRow, 12); // Order group

        // widths
        ws.getColumn(2).width = 12;
        ws.getColumn(3).width = 36;
        ws.getColumn(4).width = 12;
        ws.getColumn(5).width = 12;
        ws.getColumn(6).width = 12;
        ws.getColumn(7).width = 12;
        ws.getColumn(8).width = 25;
        ws.getColumn(9).width = 12;
        ws.getColumn(10).width = 12;
        ws.getColumn(11).width = 12;
        ws.getColumn(12).width = 25;
      } else {
        ws.addRow(['', 'Site Code', 'Daily Visits', 'Add to Cart CVR 기반 예상 테스트 기간', '', '', '', 'Order CVR 기반 예상 테스트 기간', '', '', '']);
        ws.addRow(['', 'Site Code', 'Daily Visits', 'Cart CVR', '5% uplift', '10% uplift', 'Cart 기준 모수 확보 일수\n(각 그룹당 100건 이상)', 'Order CVR', '5% uplift', '10% uplift', 'Order 기준 모수 확보 일수\n(각 그룹당 100건 이상)']);
        ws.mergeCells(headerTopRow, 2, headerBottomRow, 2); // Site Code
        ws.mergeCells(headerTopRow, 3, headerBottomRow, 3); // Daily Visits
        ws.mergeCells(headerTopRow, 4, headerTopRow, 7); // Cart group
        ws.mergeCells(headerTopRow, 8, headerTopRow, 11); // Order group

        // widths
        ws.getColumn(2).width = 12;
        ws.getColumn(3).width = 12;
        ws.getColumn(4).width = 12;
        ws.getColumn(5).width = 12;
        ws.getColumn(6).width = 12;
        ws.getColumn(7).width = 25;
        ws.getColumn(8).width = 12;
        ws.getColumn(9).width = 12;
        ws.getColumn(10).width = 12;
        ws.getColumn(11).width = 25;
      }

      // ── 기본 서식: 상단(meta+header) 흰 배경/흰 테두리 ─────────
      for (let r = 1; r <= headerBottomRow; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= tableLastCol; c++) {
          const cell = row.getCell(c);
          setFill(cell, WHITE);
          setBorder(cell, WHITE);
          cell.alignment = center;
        }
      }

      // 헤더 색/텍스트
      const r4 = ws.getRow(headerTopRow);
      const r5 = ws.getRow(headerBottomRow);
      if (includeTarget) {
        [2, 3, 4].forEach((c) => setFill(r4.getCell(c), HEADER_BASE));
        [5, 6, 7, 8].forEach((c) => setFill(r4.getCell(c), CART_GROUP));
        [9, 10, 11, 12].forEach((c) => setFill(r4.getCell(c), ORDER_GROUP));
        [2, 3, 4].forEach((c) => setFill(r5.getCell(c), HEADER_SUB));
        // uplift 헤더는 진한색, 모수 헤더는 연한색
        [5, 6, 7].forEach((c) => setFill(r5.getCell(c), CART_GROUP));
        setFill(r5.getCell(8), CART_SUB);
        [9, 10, 11].forEach((c) => setFill(r5.getCell(c), ORDER_GROUP));
        setFill(r5.getCell(12), ORDER_SUB);
      } else {
        [2, 3].forEach((c) => setFill(r4.getCell(c), HEADER_BASE));
        [4, 5, 6, 7].forEach((c) => setFill(r4.getCell(c), CART_GROUP));
        [8, 9, 10, 11].forEach((c) => setFill(r4.getCell(c), ORDER_GROUP));
        [2, 3].forEach((c) => setFill(r5.getCell(c), HEADER_SUB));
        // uplift 헤더는 진한색, 모수 헤더는 연한색
        [4, 5, 6].forEach((c) => setFill(r5.getCell(c), CART_GROUP));
        setFill(r5.getCell(7), CART_SUB);
        [8, 9, 10].forEach((c) => setFill(r5.getCell(c), ORDER_GROUP));
        setFill(r5.getCell(11), ORDER_SUB);
      }

      // 헤더 텍스트 색상(흰색)
      [headerTopRow, headerBottomRow].forEach((rr) => {
        const row = ws.getRow(rr);
        for (let c = 2; c <= tableLastCol; c++) {
          row.getCell(c).font = { ...(row.getCell(c).font ?? {}), bold: true, color: { argb: HEADER_TEXT } };
        }
      });
      // 요청: E5~L5(혹은 대응 범위)는 bold 해제
      const bottomBoldStart = includeTarget ? 5 : 4;
      for (let c = bottomBoldStart; c <= tableLastCol; c++) {
        const cell = ws.getRow(headerBottomRow).getCell(c);
        cell.font = { ...(cell.font ?? {}), bold: false, color: { argb: HEADER_TEXT } };
      }

      // 헤더 정렬/테두리
      for (let r = headerTopRow; r <= headerBottomRow; r++) {
        const row = ws.getRow(r);
        for (let c = 2; c <= tableLastCol; c++) {
          const cell = row.getCell(c);
          cell.alignment = center;
          setBorder(cell, BORDER_LIGHT_GRAY);
        }
      }

      // Data range가 있는 B2는 왼쪽 정렬
      ws.getRow(2).getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };

      // 모수 헤더 줄바꿈 허용
      if (includeTarget) {
        ws.getRow(headerBottomRow).getCell(8).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.getRow(headerBottomRow).getCell(12).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      } else {
        ws.getRow(headerBottomRow).getCell(7).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.getRow(headerBottomRow).getCell(11).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      ws.getRow(headerTopRow).height = 32;
      ws.getRow(headerBottomRow).height = 44;

      // 포맷
      const cartCvrCol = includeTarget ? 5 : 4;
      const orderCvrCol = includeTarget ? 9 : 8;
      ws.getColumn(cartCvrCol).numFmt = '0.00%';
      ws.getColumn(orderCvrCol).numFmt = '0.00%';
      const commaCols = includeTarget ? [6, 7, 8, 10, 11, 12] : [5, 6, 7, 9, 10, 11];
      commaCols.forEach((col) => { ws.getColumn(col).numFmt = '#,##0'; });

      // 데이터 행
      opts.sheetRows.forEach((r) => {
        ws.addRow(includeTarget
          ? ['', r.siteCode, r.targetPage, r.dailyVisits, r.cartCVR, r.cart5, r.cart10, r.minCart, r.orderCVR, r.order5, r.order10, r.minOrder]
          : ['', r.siteCode, r.dailyVisits, r.cartCVR, r.cart5, r.cart10, r.minCart, r.orderCVR, r.order5, r.order10, r.minOrder]
        );
      });

      const lastDataRow = ws.rowCount;
      const tableFirstRow = headerTopRow;
      const tableLastRow = Math.max(lastDataRow, headerBottomRow);

      // 테이블 스타일
      for (let r = tableFirstRow; r <= tableLastRow; r++) {
        const row = ws.getRow(r);
        for (let c = tableFirstCol; c <= tableLastCol; c++) {
          const cell = row.getCell(c);
          cell.alignment = center;
          if (r >= firstDataRow) setFill(cell, WHITE);
          setBorder(cell, BORDER_LIGHT_GRAY);
        }
      }

      // 데이터 행 높이
      for (let r = firstDataRow; r <= lastDataRow; r++) ws.getRow(r).height = 20;

      // 조건부 배경색(일수)
      const dayCols = includeTarget ? [6, 7, 8, 10, 11, 12] : [5, 6, 7, 9, 10, 11];
      const getNumeric = (v: unknown): number | null => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        const s = String(v).trim();
        if (!s) return null;
        const n = Number(s.replace(/,/g, ''));
        return Number.isFinite(n) ? n : null;
      };
      for (let r = firstDataRow; r <= lastDataRow; r++) {
        dayCols.forEach((c) => {
          const cell = ws.getRow(r).getCell(c);
          const n = getNumeric(cell.value);
          if (n === null) return;
          if (n <= 14) setFill(cell, YELLOW);
          else if (n <= 30) setFill(cell, YELLOW_LIGHT);
        });
      }

      // 표 바깥 흰 배경/흰 테두리 + A열 여백 흰 처리
      for (let r = 1; r <= lastDataRow; r++) {
        const a = ws.getRow(r).getCell(1);
        setFill(a, WHITE);
        setBorder(a, WHITE);
        a.alignment = center;
      }
      for (let r = 1; r <= metaRows; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= tableLastCol; c++) {
          const cell = row.getCell(c);
          setFill(cell, WHITE);
          setBorder(cell, WHITE);
          cell.alignment = center;
        }
      }
      // 표 바깥 영역(L~S)은 흰 배경/흰 테두리로 강제
      // - Summary 시트는 L이 테이블 컬럼이므로 M(13)부터
      // - Target Page별 시트는 L(12)부터
      const outsideStartCol = includeTarget ? 13 : 12; // M or L
      const outsideEndCol = 19; // S
      for (let r = 1; r <= Math.max(lastDataRow, 200); r++) {
        const row = ws.getRow(r);
        for (let c = outsideStartCol; c <= outsideEndCol; c++) {
          const cell = row.getCell(c);
          setFill(cell, WHITE);
          setBorder(cell, WHITE);
          cell.alignment = center;
        }
      }
      // 테이블 끝~200 흰
      for (let r = tableLastRow; r <= 200; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= 19; c++) {
          const inTable = r >= tableFirstRow && r <= tableLastRow && c >= tableFirstCol && c <= tableLastCol;
          if (inTable) continue;
          const cell = row.getCell(c);
          setFill(cell, WHITE);
          setBorder(cell, WHITE);
          cell.alignment = center;
        }
      }

      // 마지막 강제(정렬/랩)
      ws.getRow(2).getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      if (includeTarget) {
        ws.getRow(headerBottomRow).getCell(8).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.getRow(headerBottomRow).getCell(12).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      } else {
        ws.getRow(headerBottomRow).getCell(7).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.getRow(headerBottomRow).getCell(11).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      ws.getRow(headerTopRow).height = 32;
      ws.getRow(headerBottomRow).height = 44;

      // Site Code 병합(항상 B열)
      if (lastDataRow >= firstDataRow) {
        let groupStart = firstDataRow;
        let current = String(ws.getRow(firstDataRow).getCell(2).value ?? '');
        for (let r = firstDataRow + 1; r <= lastDataRow + 1; r++) {
          const next = r <= lastDataRow ? String(ws.getRow(r).getCell(2).value ?? '') : '__END__';
          if (next !== current) {
            const groupEnd = r - 1;
            if (groupEnd > groupStart && current) {
              ws.mergeCells(groupStart, 2, groupEnd, 2);
              ws.getRow(groupStart).getCell(2).alignment = center;
            }
            groupStart = r;
            current = next;
          }
        }
      }

      // 국가 간 double divider(마지막 행 제외)
      if (opts.enableCountryDividerDouble && opts.sheetRows.length > 0) {
        const setBottomBorderDouble = (cell: ExcelJS.Cell) => {
          const prev = cell.border ?? {};
          cell.border = {
            top: prev.top ?? { style: 'thin', color: { argb: BORDER_LIGHT_GRAY } },
            left: prev.left ?? { style: 'thin', color: { argb: BORDER_LIGHT_GRAY } },
            right: prev.right ?? { style: 'thin', color: { argb: BORDER_LIGHT_GRAY } },
            bottom: { style: 'double', color: { argb: BORDER_LIGHT_GRAY } },
          };
        };
        for (let i = 0; i < opts.sheetRows.length; i++) {
          const cur = String(opts.sheetRows[i]?.siteCode ?? '');
          const next = i + 1 < opts.sheetRows.length ? String(opts.sheetRows[i + 1]?.siteCode ?? '') : '';
          if (!cur || cur === next || i === opts.sheetRows.length - 1) continue;
          const rowIdx = firstDataRow + i;
          for (let c = tableFirstCol; c <= tableLastCol; c++) setBottomBorderDouble(ws.getRow(rowIdx).getCell(c));
        }
      }
    };

    const uniqueTargetOrders = Array.from(new Set(sortedRows.map((r) => r.targetPageOrder))).sort((a, b) => a - b);
    const hasMultipleTargetPages = uniqueTargetOrders.length > 1;

    // Summary 시트(기존 그대로: Target Page 포함)
    buildSheet({
      sheetName: 'Summary',
      sheetRows: sortedRows,
      includeTargetPage: true,
      enableCountryDividerDouble: hasMultipleTargetPages,
    });

    // Target Page별 시트(여러 개일 때만): Target Page 컬럼 제외
    if (hasMultipleTargetPages) {
      uniqueTargetOrders.forEach((order) => {
        const sheetRows = sortedRows.filter((r) => r.targetPageOrder === order);
        const title = sheetRows[0]?.targetPage?.trim() || `Target Page ${order + 1}`;
        buildSheet({
          sheetName: title,
          sheetRows,
          includeTargetPage: false,
          enableCountryDividerDouble: false,
        });
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadResultsExcel = async () => {
    try {
      const rows = buildExportRowsAll();
      await writeWorkbookAndDownload(rows, 'ab-test-results.xlsx');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel 다운로드 중 오류가 발생했습니다.');
    }
  };

  const downloadSelectedCountryExcel = async () => {
    try {
      const rows = activeTargetPageId === SUMMARY_TAB_ID
        ? buildExportRowsSelectedSummary(summarySelectedSiteCodes)
        : buildExportRowsSelected();
      await writeWorkbookAndDownload(rows, 'ab-test-results_selected.xlsx');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel 다운로드 중 오류가 발생했습니다.');
    }
  };

  const enterSelectionMode = () => {
    setSelectionModeTabId(activeTargetPageId);
  };

  const toggleSummarySiteCodeSelection = (siteCode: string) => {
    setSummarySelectedSiteCodes((prev) => {
      const set = new Set(prev);
      if (set.has(siteCode)) set.delete(siteCode);
      else set.add(siteCode);
      return Array.from(set);
    });
  };

  const toggleAllSummarySiteCodesSelection = (allCodes: string[], checked: boolean) => {
    setSummarySelectedSiteCodes(checked ? [...allCodes] : []);
  };

  const buildSuggestionDetailText = (): string => {
    const candidates = aiTableModel.candidates ?? [];
    const tps = aiTableModel.targetPages ?? [];
    if (!candidates.length || !tps.length) return '• N/A';

    const lines: string[] = [];
    candidates.slice(0, 8).forEach((c) => {
      const parts = tps.map((tp, idx) => {
        const v = c.byTp?.[idx];
        const cart = v?.cart ?? 'N/A';
        const order = v?.order ?? 'N/A';
        return `(${tp.label}) Cart ${cart} / Order ${order}`;
      });
      lines.push(`• **${c.siteCode}**: ${parts.join(' · ')}`);
    });
    return lines.join('\n');
  };

  const aiTableModel = useMemo(() => {
    const cartLimitDays = Math.max(1, Math.floor(Number(suggestCartLimitDays) || 0));
    const orderLimitDays = suggestUseOrderLimit
      ? Math.max(1, Math.floor(Number(suggestOrderLimitDays) || 0))
      : null;

    const toNumOrNull = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      if (v === 'N/A' || v === '-') return null;
      const n = Number(String(v).replace(/,/g, '').trim());
      return Number.isFinite(n) ? n : null;
    };
    const norm = (n: number | null): number => (n === null || !Number.isFinite(n) || n === 0 ? Infinity : n);
    const fmt = (n: number | null): string => (norm(n) === Infinity ? 'N/A' : `${Math.round(norm(n))}일`);

    const tpCount = targetPages.length;
    if (tpCount === 0) {
      return {
        cartLimitDays: Math.max(1, Math.floor(Number(suggestCartLimitDays) || 0)) || 14,
        orderLimitDays: suggestUseOrderLimit ? (Math.max(1, Math.floor(Number(suggestOrderLimitDays) || 0)) || 30) : null,
        targetPages: [] as Array<{ index: number; label: string }>,
        candidates: [] as Array<{ siteCode: string; byTp: Array<{ cart: string; order: string }> }>,
      };
    }

    // 수집: tpIndex/label/siteCode/minCart/minOrder
    type Row = { tpIndex: number; tpLabel: string; siteCode: string; minCart: number | null; minOrder: number | null };
    const rows: Row[] = [];
    targetPages.forEach((tp, idx) => {
      const tpLabel = getTargetPageDisplayName(tp, idx);
      (tp.results ?? []).forEach((r) => {
        if (!r?.siteCode) return;
        if (excludeUnspecified && isUnspecifiedSiteCode(r.siteCode)) return;
        rows.push({
          tpIndex: idx,
          tpLabel,
          siteCode: r.siteCode,
          minCart: toNumOrNull(r.minDaysForCart),
          minOrder: toNumOrNull(r.minDaysForOrder),
        });
      });
    });

    const targetPageMeta = targetPages.map((tp, idx) => ({
      index: idx,
      label: getTargetPageDisplayName(tp, idx),
    }));

    // siteCode -> tpIndex -> row
    const bySite = new Map<string, Map<number, Row>>();
    rows.forEach((r) => {
      const site = String(r.siteCode ?? '').trim();
      if (!site) return;
      const perTp = bySite.get(site) ?? new Map<number, Row>();
      perTp.set(r.tpIndex, r);
      bySite.set(site, perTp);
    });

    const buildCandidates = (cartLimitDays: number, orderLimitDays: number | null) => {
      return Array.from(bySite.entries())
        .map(([siteCode, perTp]) => {
          // 조건: 모든 TP에서 Cart <= cartLimitDays (필수)
          // + orderLimitDays가 있으면 Order <= orderLimitDays (결측/0은 탈락)
          const cartDaysPerTp: number[] = [];
          const orderDaysPerTpStrict: number[] = [];
          for (let i = 0; i < tpCount; i++) {
            const r = perTp.get(i);
            const mc = r ? norm(r.minCart) : Infinity;
            const mo = r ? norm(r.minOrder) : Infinity;
            if (mc === Infinity) return null;
            if (orderLimitDays !== null && mo === Infinity) return null;
            cartDaysPerTp.push(mc);
            if (orderLimitDays !== null) orderDaysPerTpStrict.push(mo);
          }
          const worstCart = Math.max(...cartDaysPerTp);
          if (worstCart > cartLimitDays) return null;
          if (orderLimitDays !== null) {
            const worstOrderStrict = Math.max(...orderDaysPerTpStrict);
            if (worstOrderStrict > orderLimitDays) return null;
          }

          // 정렬키(참고): worstOrder
          const orderDaysPerTp: number[] = [];
          for (let i = 0; i < tpCount; i++) {
            const r = perTp.get(i);
            orderDaysPerTp.push(r ? norm(r.minOrder) : Infinity);
          }
          const worstOrder = Math.max(...orderDaysPerTp);

          const byTp = targetPageMeta.map(({ index }) => {
            const r = perTp.get(index);
            return {
              cart: r ? fmt(r.minCart) : 'N/A',
              order: r ? fmt(r.minOrder) : 'N/A',
            };
          });

          return { siteCode, worstCart, worstOrder, byTp };
        })
        .filter(Boolean)
        .sort((a, b) => (a!.worstCart - b!.worstCart) || (a!.worstOrder - b!.worstOrder) || a!.siteCode.localeCompare(b!.siteCode))
        .slice(0, 30)
        .map((c) => ({ siteCode: c!.siteCode, byTp: c!.byTp })) as Array<{ siteCode: string; byTp: Array<{ cart: string; order: string }> }>;
    };

    const candidates = buildCandidates(cartLimitDays, orderLimitDays);
    return { cartLimitDays, orderLimitDays, targetPages: targetPageMeta, candidates };
  }, [excludeUnspecified, suggestCartLimitDays, suggestOrderLimitDays, suggestUseOrderLimit, targetPages]);



  const renderBoldMarkdown = (text: string): React.ReactNode => {
    // 아주 단순한 **bold** 렌더러 (AI 응답용)
    const parts = String(text ?? '').split(/(\*\*[^*]+\*\*)/g);
    return (
      <>
        {parts.map((p, i) => {
          const m = p.match(/^\*\*([^*]+)\*\*$/);
          if (m) return <strong key={i} style={{ fontWeight: 800 }}>{m[1]}</strong>;
          const chunks = String(p).split('\n');
          return (
            <React.Fragment key={i}>
              {chunks.map((c, j) => (
                <React.Fragment key={j}>
                  {c}
                  {j < chunks.length - 1 ? <br /> : null}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  const normalizeBulletLines = (text: string): string => {
    const lines = String(text ?? '').split('\n');
    const normalized = lines.map((line) => {
      const s = String(line ?? '');
      // "- ..." 형태로 오는 경우를 "• ..."로 통일
      const asBullet = s.replace(/^\s*-\s+/, '• ');
      // "•" 뒤에 공백이 없으면 추가
      const ensuredSpace = asBullet.replace(/^\s*•(?!\s)/, '• ');
      // 사이트 코드 표기 "**XX** - ..." -> "**XX**: ..."로 통일
      return ensuredSpace.replace(/^(\s*•\s+\*\*[^*]+\*\*)\s*-\s+/, '$1: ');
    });
    return normalized.join('\n').trim();
  };

  const renderSuggestedSiteCodesInline = (): React.ReactNode => {
    const list = aiTableModel.candidates.slice(0, 6);
    if (list.length === 0) return 'N/A';
    return (
      <>
        {list.map((c, idx) => (
          <React.Fragment key={c.siteCode}>
            <strong style={{ fontWeight: 900 }}>{c.siteCode}</strong>
            {idx < list.length - 1 ? ', ' : null}
          </React.Fragment>
        ))}
      </>
    );
  };

  const toggleSiteCodeSelection = (tpId: string, siteCode: string) => {
    setTargetPages((prev) => prev.map((tp) => {
      if (tp.id !== tpId) return tp;
      const current = tp.selectedSiteCodes ?? [];
      const set = new Set(current);
      if (set.has(siteCode)) set.delete(siteCode);
      else set.add(siteCode);
      return { ...tp, selectedSiteCodes: Array.from(set) };
    }));
  };

  const toggleAllSiteCodesSelection = (tpId: string, allCodes: string[], checked: boolean) => {
    setTargetPages((prev) => prev.map((tp) => {
      if (tp.id !== tpId) return tp;
      return { ...tp, selectedSiteCodes: checked ? [...allCodes] : [] };
    }));
  };

  const canCalculate = useMemo(() => {
    const hasDays = inputParams.rangeDays > 0 || Boolean(inputParams.startDate && inputParams.endDate);
    const okLabels = targetPages.every(tp => tp.visitsLabel && (tp.cartAddLabel || tp.orderLabel));
    const okCodes = targetPages.every(tp => tp.siteCodes.length > 0);
    return Boolean(hasDays && okLabels && okCodes);
  }, [inputParams.rangeDays, inputParams.startDate, inputParams.endDate, targetPages]);

  // 단계: 1=데이터 입력, 2=설정 및 계산, 3=결과
  const step = view === 'result' ? 3 : rawData.length > 0 ? 2 : 1;

  // ── 디자인 토큰 ──────────────────────────────────────────
  const ds = {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryDisabled: '#93c5fd',
    secondary: '#374151',
    secondaryHover: '#1f2937',
    surface: '#ffffff',
    surfaceHover: '#f9fafb',
    pageBg: '#f3f4f6',
    border: '#e5e7eb',
    borderFocus: '#2563eb',
    textPrimary: '#111827',
    textMuted: '#6b7280',
    textLight: '#9ca3af',
    errorBg: '#fef2f2',
    errorBorder: '#fecaca',
    errorText: '#dc2626',
    infoBg: '#eff6ff',
    infoBorder: '#bfdbfe',
    infoText: '#1e40af',
    successBg: '#f0fdf4',
    successBorder: '#bbf7d0',
    successText: '#166534',
    cardShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    cardRadius: '12px',
  } as const;

  const stepDotStyle = (s: number): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    flexShrink: 0,
    backgroundColor: step === s ? ds.primary : step > s ? '#d1fae5' : '#e5e7eb',
    color: step === s ? '#fff' : step > s ? '#065f46' : ds.textMuted,
    transition: 'all 0.2s ease',
  });

  const stepLabelStyle = (s: number): React.CSSProperties => ({
    fontSize: '13px',
    fontWeight: step === s ? 700 : 500,
    color: step === s ? ds.textPrimary : step > s ? '#059669' : ds.textMuted,
    cursor: (s < step || (s === 2 && step === 3)) ? 'pointer' : 'default',
    transition: 'color 0.2s ease',
  });

  const btnStyle = (variant: 'primary' | 'secondary', disabled?: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s ease',
    ...(variant === 'primary'
      ? { backgroundColor: disabled ? ds.primaryDisabled : ds.primary, color: '#fff' }
      : { backgroundColor: ds.secondary, color: '#fff' }),
  });

  const ctaButton = (label: string, onClick: () => void, disabled?: boolean, primary = true) => (
    <button onClick={onClick} disabled={disabled} style={btnStyle(primary ? 'primary' : 'secondary', disabled)}>
      {label}
    </button>
  );

  const toolTabStyle = (tool: 'sample-size' | 'milestone'): React.CSSProperties => {
    const isActive = activeTool === tool;
    return {
      padding: '8px 14px',
      borderRadius: '999px',
      border: `1px solid ${isActive ? '#93c5fd' : '#4b5563'}`,
      backgroundColor: isActive ? '#1d4ed8' : 'transparent',
      color: '#f9fafb',
      fontSize: '13px',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    };
  };

  const card: React.CSSProperties = {
    backgroundColor: ds.surface,
    borderRadius: ds.cardRadius,
    border: `1px solid ${ds.border}`,
    boxShadow: ds.cardShadow,
    padding: '24px',
    marginBottom: '16px',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: ds.pageBg }}>
      {/* ── 네비게이션 바 ── */}
      <header style={{
        backgroundColor: '#1f2937',
        borderBottom: '1px solid #111827',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '18px' }}>{activeTool === 'milestone' ? '🗓️' : '📊'}</span>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#f9fafb',
            letterSpacing: '-0.02em',
          }}>
            {activeTool === 'milestone' ? 'AUX Milestone Calculator' : 'AUX AB Test Sample Size Calculator'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTool('sample-size')}
              style={toolTabStyle('sample-size')}
            >
              Sample Size
            </button>
            <button
              onClick={() => setActiveTool('milestone')}
              style={toolTabStyle('milestone')}
            >
              Milestone
            </button>
          </div>
        </div>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
        {activeTool === 'sample-size' ? (
          <>
        {/* ── 스텝 바 + CTA ── */}
        <div style={{
          ...card,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px 24px',
          marginBottom: '24px',
          position: 'sticky',
          top: '12px',
          zIndex: 50,
        }}>
          {/* 스텝 인디케이터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Step 1 */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: step > 1 ? 'pointer' : 'default' }}
              onClick={() => { if (step > 1) { setRawData([]); setView('setup'); } }}
            >
              <div style={stepDotStyle(1)}>1</div>
              <span style={stepLabelStyle(1)}>데이터 입력</span>
            </div>
            <span style={{ color: ds.border, fontSize: '18px', margin: '0 4px' }}>›</span>
            {/* Step 2 */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: step === 3 ? 'pointer' : 'default' }}
              onClick={() => { if (step === 3) setView('setup'); }}
            >
              <div style={stepDotStyle(2)}>2</div>
              <span style={stepLabelStyle(2)}>설정 및 계산</span>
            </div>
            <span style={{ color: ds.border, fontSize: '18px', margin: '0 4px' }}>›</span>
            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={stepDotStyle(3)}>3</div>
              <span style={stepLabelStyle(3)}>결과</span>
            </div>
          </div>

          {/* CTA 버튼 */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {step === 2 && (
              <>
                {ctaButton('← 뒤로가기', () => { setRawData([]); setView('setup'); }, false, false)}
                {ctaButton('계산하기', handleCalculate, !canCalculate)}
              </>
            )}
            {step === 3 && (
              <>
                <button
                  onClick={downloadResultsExcel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 800,
                    borderRadius: '10px',
                    border: `1.5px solid ${ds.border}`,
                    backgroundColor: ds.surface,
                    color: ds.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  📗 전체 Excel 다운로드
                </button>
                {(() => {
                  const inSelectionMode = selectionModeTabId === activeTargetPageId;
                  const selectedCount = (() => {
                    if (activeTargetPageId === SUMMARY_TAB_ID) return summarySelectedSiteCodes.length;
                    const active = targetPages.find(tp => tp.id === activeTargetPageId) ?? targetPages[0];
                    return active?.selectedSiteCodes?.length ?? 0;
                  })();
                  const canDownload = selectedCount > 0;

                  const baseBtn: React.CSSProperties = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 800,
                    borderRadius: '10px',
                    border: `1.5px solid ${ds.border}`,
                    backgroundColor: ds.surface,
                    color: ds.textPrimary,
                    cursor: 'pointer',
                  };

                  if (!inSelectionMode) {
                    return (
                      <button
                        onClick={enterSelectionMode}
                        style={baseBtn}
                        title="클릭하면 국가 선택(체크박스)이 노출됩니다."
                      >
                        📗 선택 항목 Excel 다운로드
                      </button>
                    );
                  }

                  return (
                    <>
                      <button
                        onClick={() => setSelectionModeTabId(null)}
                        style={{
                          ...baseBtn,
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: '1.5px solid #d1d5db',
                        }}
                        title="선택 모드 취소"
                      >
                        취소
                      </button>
                      <button
                        onClick={downloadSelectedCountryExcel}
                        disabled={!canDownload}
                        style={{
                          ...baseBtn,
                          opacity: canDownload ? 1 : 0.55,
                          cursor: canDownload ? 'pointer' : 'not-allowed',
                        }}
                        title={canDownload ? '선택한 국가만 엑셀로 내려받기' : '국가를 먼저 선택해주세요'}
                      >
                        다운로드
                      </button>
                    </>
                  );
                })()}
                {ctaButton('← 뒤로가기', () => setView('setup'), false, false)}
              </>
            )}
          </div>
        </div>

        {/* ── 에러 배너 ── */}
        {error && view === 'setup' && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '14px 16px',
            backgroundColor: ds.errorBg,
            border: `1px solid ${ds.errorBorder}`,
            borderRadius: '8px',
            color: ds.errorText,
            fontSize: '14px',
            marginBottom: '20px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
            {error}
          </div>
        )}

        {/* ── Step 1: 데이터 입력 ── */}
        {step === 1 && (
          <section>
            <div style={card}>
              {/* 소스 선택 탭 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {(['file', 'api'] as const).map((src) => (
                  <button
                    key={src}
                    onClick={() => { setDataSource(src); setRawData([]); setError(''); }}
                    style={{
                      padding: '8px 20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: `1.5px solid ${dataSource === src ? ds.primary : ds.border}`,
                      borderRadius: '20px',
                      cursor: 'pointer',
                      backgroundColor: dataSource === src ? ds.infoBg : ds.surface,
                      color: dataSource === src ? ds.primary : ds.textMuted,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {src === 'file' ? '📂 CSV/Excel 파일 업로드' : '🔗 API로 불러오기'}
                  </button>
                ))}
              </div>
              {dataSource === 'file' && (
                <div>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', color: ds.textMuted }}>
                      Adobe Analytics 데이터가 아닌 경우, 아래 Excel 템플릿을 내려받아 사용하세요.
                    </div>
                    <a
                      href="/raw-data_template.xlsx"
                      download
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '10px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        borderRadius: '10px',
                        border: `1.5px solid ${ds.border}`,
                        backgroundColor: ds.surface,
                        color: ds.textPrimary,
                        textDecoration: 'none',
                      }}
                    >
                      📗 Excel 템플릿 다운로드
                    </a>
                  </div>
                  <FileUpload onFileParsed={handleDataLoaded} onError={setError} />
                </div>
              )}
              {dataSource === 'api' && <ApiDataLoader onDataLoaded={handleDataLoaded} onError={setError} />}
            </div>
          </section>
        )}

        {/* ── Step 2: 설정 및 계산 ── */}
        {step === 2 && (
          <section>
            {rawData.length > 0 ? (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: ds.infoBg,
                  border: `1px solid ${ds.infoBorder}`,
                  borderRadius: '8px',
                  color: ds.infoText,
                  fontSize: '13px',
                  marginBottom: '16px',
                }}>
                  <span>ℹ️</span>
                  <span>파라미터를 설정한 뒤 상단 <strong>계산하기</strong>를 누르세요.</span>
                </div>
                <InputForm params={inputParams} onChange={setInputParams} />
                <DataPreview data={rawData} />
                {targetPages.map((tp, idx) => (
                  <SegmentSelector
                    key={tp.id}
                    labels={segmentLabels}
                    title={`Target Page ${idx + 1}`}
                    actions={idx === 0 ? undefined : (
                      <button
                        onClick={() => {
                          setTargetPages(prev => prev.filter(p => p.id !== tp.id));
                          setActiveTargetPageId((prevActive) => prevActive === tp.id ? (targetPages[0]?.id ?? prevActive) : prevActive);
                        }}
                        style={{
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 800,
                          backgroundColor: '#fee2e2',
                          color: '#991b1b',
                          border: '1px solid #fecaca',
                          borderRadius: '999px',
                          cursor: 'pointer',
                        }}
                      >
                        제거
                      </button>
                    )}
                    selectedVisits={tp.visitsLabel}
                    selectedCartAdd={tp.cartAddLabel}
                    selectedOrder={tp.orderLabel}
                    onVisitsChange={(label) => handleVisitsChange(tp.id, label)}
                    onCartAddChange={(label) => updateTargetPage(tp.id, { cartAddLabel: label })}
                    onOrderChange={(label) => updateTargetPage(tp.id, { orderLabel: label })}
                  />
                ))}

                <div style={{ marginTop: '4px', marginBottom: '12px' }}>
                  <button
                    onClick={() => {
                      const next: TargetPageSet = {
                        id: makeId(),
                        displayName: '',
                        visitsLabel: '',
                        cartAddLabel: '',
                        orderLabel: '',
                        siteCodes: [],
                        selectedSiteCodes: [],
                        results: [],
                      };
                      setTargetPages(prev => [...prev, next]);
                    }}
                    style={{
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: '#111827',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    + 타겟 페이지 추가
                  </button>
                </div>

                {targetPages.some(tp => tp.siteCodes.length > 0) && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '12px',
                    padding: '8px 14px',
                    backgroundColor: ds.successBg,
                    border: `1px solid ${ds.successBorder}`,
                    borderRadius: '8px',
                    color: ds.successText,
                    fontSize: '13px',
                    fontWeight: 600,
                  }}>
                    ✓ 발견된 Site Code:{' '}
                    <strong>
                      {targetPages.map((tp, idx) => `Target Page ${idx + 1} ${tp.siteCodes.length}개`).join(' · ')}
                    </strong>
                  </div>
                )}
              </>
            ) : (
              <div style={{ ...card, color: ds.textMuted, fontSize: '14px', textAlign: 'center', padding: '48px 24px' }}>
                1단계에서 파일을 업로드하거나 API로 데이터를 불러오세요.
              </div>
            )}
          </section>
        )}

        {/* ── Step 3: 결과 ── */}
        {step === 3 && (
          <section>
            {targetPages.some(tp => tp.results.length > 0) ? (
              <>
                {/* 엑셀 다운로드 CTA는 상단 스텝 바로 이동 */}

                <div style={{
                  ...card,
                  padding: '16px 20px',
                  marginBottom: '12px',
                }}>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    {/* 좌측: 제안/코드 + 상세보기(화이트 CTA) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
                      <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>✨</span>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#111827', minWidth: 0 }}>
                        테스트 대상 사이트 제안 : {renderSuggestedSiteCodesInline()}
                      </div>
                      <button
                        onClick={() => setAiOpen((v) => !v)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          minWidth: '72px',
                          textAlign: 'center',
                          borderRadius: '999px',
                          border: `1px solid ${ds.border}`,
                          backgroundColor: '#fff',
                          color: '#111827',
                          cursor: 'pointer',
                          marginLeft: '4px',
                        }}
                        title={aiOpen ? '접기' : '상세보기'}
                      >
                        {aiOpen ? '접기' : '상세보기'}
                      </button>
                    </div>

                    {/* 우측: CTA 2개 + 화살표 아이콘(만) */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: ds.textMuted, whiteSpace: 'nowrap', marginRight: '4px' }}>
                        *모든 Target Page에서 Cart ≤ {aiTableModel.cartLimitDays}일
                        {aiTableModel.orderLimitDays === null ? '' : `, Order ≤ ${aiTableModel.orderLimitDays}일`}
                      </div>
                      <button
                        onClick={() => {
                          setSuggestEditing((prev) => {
                            const next = !prev;
                            if (next) {
                              setSuggestDraftCartLimitDays(suggestCartLimitDays);
                              setSuggestDraftUseOrderLimit(suggestUseOrderLimit);
                              setSuggestDraftOrderLimitDays(suggestOrderLimitDays);
                            }
                            return next;
                          });
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '999px',
                          border: 'none',
                          backgroundColor: '#111827',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                        title="조건 변경"
                      >
                        조건 변경
                      </button>
                      <button
                        onClick={() => {
                          setTpNameEditing((prev) => {
                            const nextOpen = !prev;
                            if (nextOpen) {
                              const next: Record<string, string> = {};
                              targetPages.forEach((tp, idx) => { next[tp.id] = getTargetPageDisplayName(tp, idx); });
                              setTpNameDraftById(next);
                            }
                            return nextOpen;
                          });
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '999px',
                          border: 'none',
                          backgroundColor: '#111827',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                        title="타겟페이지명 수정"
                      >
                        타겟페이지명 수정
                      </button>
                      <button
                        onClick={() => setAiOpen((v) => !v)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 999,
                          backgroundColor: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#111827',
                          flexShrink: 0,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        aria-label={aiOpen ? '접기' : '상세보기'}
                        title={aiOpen ? '접기' : '상세보기'}
                      >
                        {aiOpen ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {tpNameEditing && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      border: `1px solid ${ds.border}`,
                      borderRadius: '10px',
                      backgroundColor: '#fff',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '340px' }}>
                        {targetPages.map((tp, idx) => (
                          <label key={tp.id} style={{ fontSize: '12px', color: ds.textMuted, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '92px', color: '#374151', fontWeight: 800, whiteSpace: 'nowrap' }}>
                              Target {idx + 1}
                            </span>
                            <input
                              value={tpNameDraftById[tp.id] ?? ''}
                              onChange={(e) => setTpNameDraftById((prev) => ({ ...prev, [tp.id]: e.target.value }))}
                              placeholder=""
                              style={{
                                flex: 1,
                                minWidth: '220px',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: `1px solid ${ds.border}`,
                                outline: 'none',
                              }}
                            />
                          </label>
                        ))}
                        <div style={{ fontSize: '11px', color: ds.textMuted }}>
                          비워두면 기본값(Visits 라벨 또는 Target Page 번호)로 표시됩니다.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => {
                            const next: Record<string, string> = {};
                            targetPages.forEach((tp, idx) => { next[tp.id] = getTargetPageDefaultName(tp, idx); });
                            setTpNameDraftById(next);
                          }}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 800,
                            borderRadius: '999px',
                            border: `1px solid ${ds.border}`,
                            backgroundColor: '#fff',
                            color: '#374151',
                            cursor: 'pointer',
                          }}
                        >
                          초기화
                        </button>
                        <button
                          onClick={() => setTpNameEditing(false)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 800,
                            borderRadius: '999px',
                            border: `1px solid ${ds.border}`,
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            cursor: 'pointer',
                          }}
                        >
                          취소
                        </button>
                        <button
                          onClick={() => {
                            setTargetPages((prev) => prev.map((tp, idx) => {
                              const draft = String(tpNameDraftById[tp.id] ?? '').trim();
                              const def = getTargetPageDefaultName(tp, idx);
                              // 기본값과 동일하면 displayName은 비워서(=동적 기본값 유지) 저장
                              const nextDisplayName = draft && draft !== def ? draft : '';
                              return { ...tp, displayName: nextDisplayName };
                            }));
                            setTpNameEditing(false);
                          }}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 900,
                            borderRadius: '999px',
                            border: `1px solid ${ds.border}`,
                            backgroundColor: '#111827',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          적용
                        </button>
                      </div>
                    </div>
                  )}

                  {suggestEditing && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      border: `1px solid ${ds.border}`,
                      borderRadius: '10px',
                      backgroundColor: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '12px', color: ds.textMuted, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          Cart ≤
                          <input
                            type="number"
                            min={1}
                            value={suggestDraftCartLimitDays}
                            onChange={(e) => setSuggestDraftCartLimitDays(Number(e.target.value))}
                            style={{
                              width: '72px',
                              padding: '4px 6px',
                              borderRadius: '8px',
                              border: `1px solid ${ds.border}`,
                              outline: 'none',
                            }}
                          />
                          일
                        </label>
                        {suggestDraftUseOrderLimit && (
                          <label style={{ fontSize: '12px', color: ds.textMuted, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            Order ≤
                            <input
                              type="number"
                              min={1}
                              value={suggestDraftOrderLimitDays}
                              onChange={(e) => setSuggestDraftOrderLimitDays(Number(e.target.value))}
                              style={{
                                width: '72px',
                                padding: '4px 6px',
                                borderRadius: '8px',
                                border: `1px solid ${ds.border}`,
                                outline: 'none',
                              }}
                            />
                            일
                          </label>
                        )}
                        <div style={{ width: 6 }} />
                        <label style={{ fontSize: '12px', color: ds.textMuted, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="checkbox"
                            checked={suggestDraftUseOrderLimit}
                            onChange={(e) => setSuggestDraftUseOrderLimit(e.target.checked)}
                          />
                          Order 조건 사용
                        </label>
                        <button
                          onClick={() => {
                            setSuggestEditing(false);
                          }}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 800,
                            borderRadius: '999px',
                            border: `1px solid ${ds.border}`,
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            cursor: 'pointer',
                          }}
                        >
                          취소
                        </button>
                        <button
                          onClick={() => {
                            setSuggestCartLimitDays(suggestDraftCartLimitDays);
                            setSuggestUseOrderLimit(suggestDraftUseOrderLimit);
                            setSuggestOrderLimitDays(suggestDraftOrderLimitDays);
                            setSuggestEditing(false);
                          }}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 900,
                            borderRadius: '999px',
                            border: `1px solid ${ds.border}`,
                            backgroundColor: '#111827',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          적용
                        </button>
                      </div>
                    </div>
                  )}

                  {aiOpen && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ marginTop: '6px', paddingLeft: '26px', fontSize: '13px', color: '#374151', lineHeight: 1.55 }}>
                        {renderBoldMarkdown(normalizeBulletLines(buildSuggestionDetailText()))}
                      </div>
                    </div>
                  )}
                </div>
                {targetPages.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button
                      key={SUMMARY_TAB_ID}
                      onClick={() => setActiveTargetPageId(SUMMARY_TAB_ID)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '999px',
                        border: `1.5px solid ${activeTargetPageId === SUMMARY_TAB_ID ? ds.primary : ds.border}`,
                        backgroundColor: activeTargetPageId === SUMMARY_TAB_ID ? ds.infoBg : ds.surface,
                        color: activeTargetPageId === SUMMARY_TAB_ID ? ds.primary : ds.textMuted,
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                      title="Summary"
                    >
                      Summary
                    </button>
                    {targetPages.map((tp, idx) => {
                      const isActive = activeTargetPageId === tp.id;
                      const label = getTargetPageDisplayName(tp, idx);
                      return (
                        <button
                          key={tp.id}
                          onClick={() => setActiveTargetPageId(tp.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '999px',
                            border: `1.5px solid ${isActive ? ds.primary : ds.border}`,
                            backgroundColor: isActive ? ds.infoBg : ds.surface,
                            color: isActive ? ds.primary : ds.textMuted,
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '13px',
                            maxWidth: '520px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={label}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(() => {
                  // Summary 탭: 모든 Target Page 결과를 합쳐서(Target Page 컬럼 포함) 표시
                  if (targetPages.length > 1 && activeTargetPageId === SUMMARY_TAB_ID) {
                    const summaryAll = targetPages.flatMap((tp, idx) => {
                      const label = getTargetPageDisplayName(tp, idx);
                      return (tp.results ?? []).map((r) => ({ ...r, targetPageLabel: label, targetPageOrder: idx }));
                    });
                    const viewResults = excludeUnspecified
                      ? summaryAll.filter((r) => !isUnspecifiedSiteCode(r.siteCode))
                      : summaryAll;
                    const allSiteCodes = Array.from(new Set(viewResults.map(r => r.siteCode).filter(Boolean))).sort();
                    const showCart = targetPages.some((tp) => Boolean(tp.cartAddLabel));
                    const showOrder = targetPages.some((tp) => Boolean(tp.orderLabel));
                    return (
                      <ResultTable
                        results={viewResults}
                        showCartMetrics={showCart}
                        showOrderMetrics={showOrder}
                        showTargetPageColumn
                        hideDailyCartOrder
                        groupBySiteCode
                        disableSorting
                        selectedSiteCodes={summarySelectedSiteCodes}
                        onToggleSiteCode={selectionModeTabId === SUMMARY_TAB_ID ? toggleSummarySiteCodeSelection : undefined}
                        onToggleAll={selectionModeTabId === SUMMARY_TAB_ID ? ((checked) => toggleAllSummarySiteCodesSelection(allSiteCodes, checked)) : undefined}
                        excludeUnspecified={excludeUnspecified}
                        onExcludeUnspecifiedChange={setExcludeUnspecified}
                      />
                    );
                  }

                  const active = targetPages.find(tp => tp.id === activeTargetPageId) ?? targetPages[0];
                  const showCart = Boolean(active?.cartAddLabel);
                  const showOrder = Boolean(active?.orderLabel);
                  const allResults = active?.results ?? [];
                  const viewResults = excludeUnspecified
                    ? allResults.filter((r) => !isUnspecifiedSiteCode(r.siteCode))
                    : allResults;
                  const allSiteCodes = Array.from(new Set(viewResults.map(r => r.siteCode).filter(Boolean))).sort();
                  return (
                    <ResultTable
                      results={viewResults}
                      showCartMetrics={showCart}
                      showOrderMetrics={showOrder}
                      selectedSiteCodes={active?.selectedSiteCodes ?? []}
                      onToggleSiteCode={selectionModeTabId === activeTargetPageId ? ((siteCode) => { if (active) toggleSiteCodeSelection(active.id, siteCode); }) : undefined}
                      onToggleAll={selectionModeTabId === activeTargetPageId ? ((checked) => { if (active) toggleAllSiteCodesSelection(active.id, allSiteCodes, checked); }) : undefined}
                      excludeUnspecified={excludeUnspecified}
                      onExcludeUnspecifiedChange={setExcludeUnspecified}
                    />
                  );
                })()}
                <div style={{ height: 80 }} />
              </>
            ) : (
              <div style={{
                ...card,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 16px',
                backgroundColor: ds.errorBg,
                border: `1px solid ${ds.errorBorder}`,
                color: ds.errorText,
                fontSize: '14px',
              }}>
                <span>⚠️</span>결과가 없습니다. 뒤로 가서 다시 계산해주세요.
              </div>
            )}
          </section>
        )}
          </>
        ) : (
          <MilestoneCalculator />
        )}
      </main>
    </div>
  );
}

export default App;

