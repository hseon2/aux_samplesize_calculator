import Papa from 'papaparse';
import * as ExcelJS from 'exceljs';

export interface RawDataRow {
  segment: string;
  siteCode: string;
  value: number;
}

export interface ParsedDataRow {
  siteCode: string;
  visits: number | 'N/A';
  cartAdd: number | 'N/A';
  order: number | 'N/A';
}

export interface SegmentLabel {
  label: string;
  type: 'visits' | 'cartAdd' | 'order' | 'unknown';
}

/**
 * CSV/Excel 파일을 읽어서 원시 데이터로 변환
 */
export function parseFile(file: File): Promise<RawDataRow[]> {
  return new Promise((resolve, reject) => {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    
    if (isExcel) {
      parseExcelFile(file, resolve, reject);
    } else {
      parseCSVFile(file, resolve, reject);
    }
  });
}

/**
 * Excel 파일 파싱
 */
function parseExcelFile(
  file: File,
  resolve: (data: RawDataRow[]) => void,
  reject: (error: Error) => void
) {
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const buffer = e.target?.result as ArrayBuffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      
      const worksheet = workbook.worksheets[0];
      const rawData: RawDataRow[] = [];
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 헤더 건너뛰기
        
        const segment = String(row.getCell(1).value || '').trim();
        const siteCode = String(row.getCell(2).value || '').trim();
        const value = row.getCell(3).value;
        
        // 주석이나 헤더 라인 건너뛰기
        if (!segment || segment.startsWith('#') || segment === 'Segments' || 
            siteCode === 'Site Code (v1)' || siteCode === 'Visits') {
          return;
        }
        
        // 숫자 값이 있는 경우만 추가
        const numValue = typeof value === 'number' ? value : Number(value);
        if (siteCode && !isNaN(numValue) && numValue > 0) {
          rawData.push({
            segment,
            siteCode,
            value: numValue
          });
        }
      });
      
      resolve(rawData);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Excel 파일 파싱 실패'));
    }
  };
  
  reader.onerror = () => reject(new Error('파일 읽기 실패'));
  reader.readAsArrayBuffer(file);
}

/**
 * CSV 파일 파싱
 */
function parseCSVFile(
  file: File,
  resolve: (data: RawDataRow[]) => void,
  reject: (error: Error) => void
) {
  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: (results) => {
      try {
        const rawData: RawDataRow[] = [];
        const rows = results.data as any[][];
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 3) continue;
          
          const segment = String(row[0] || '').trim();
          const siteCode = String(row[1] || '').trim();
          const value = row[2];
          
          // 주석이나 헤더 라인 건너뛰기
          if (!segment || segment.startsWith('#') || segment === 'Segments' || 
              siteCode === 'Site Code (v1)' || siteCode === 'Visits') {
            continue;
          }
          
          // 숫자 값이 있는 경우만 추가
          const numValue = Number(value);
          if (siteCode && !isNaN(numValue) && numValue > 0) {
            rawData.push({
              segment,
              siteCode,
              value: numValue
            });
          }
        }
        
        resolve(rawData);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('CSV 파일 파싱 실패'));
      }
    },
    error: (error) => {
      reject(new Error(`CSV 파싱 오류: ${error.message}`));
    }
  });
}

/**
 * 세그먼트 라벨 목록 추출
 */
export function extractSegmentLabels(rawData: RawDataRow[]): SegmentLabel[] {
  const labelSet = new Set<string>();
  
  rawData.forEach(row => {
    labelSet.add(row.segment);
  });
  
  return Array.from(labelSet).map(label => {
    const lowerLabel = label.toLowerCase();
    let type: SegmentLabel['type'] = 'unknown';
    
    if (lowerLabel.includes('visit') && !lowerLabel.includes('cart') && !lowerLabel.includes('order')) {
      type = 'visits';
    } else if (lowerLabel.includes('cart')) {
      type = 'cartAdd';
    } else if (lowerLabel.includes('order')) {
      type = 'order';
    }
    
    return { label, type };
  });
}

/**
 * 선택된 세그먼트 라벨로부터 Site Code 목록 추출
 */
export function extractSiteCodes(rawData: RawDataRow[], visitsLabel: string): string[] {
  const siteCodeSet = new Set<string>();
  
  rawData.forEach(row => {
    if (row.segment === visitsLabel) {
      siteCodeSet.add(row.siteCode);
    }
  });
  
  return Array.from(siteCodeSet).sort();
}

/**
 * 데이터 파싱: Site Code별로 Visits, Cart Add, Order 데이터 정리
 */
export function parseData(
  rawData: RawDataRow[],
  visitsLabel: string,
  cartAddLabel: string,
  orderLabel: string,
  siteCodes: string[]
): ParsedDataRow[] {
  // 각 Site Code별 데이터 맵 생성
  const dataMap = new Map<string, { visits?: number; cartAdd?: number; order?: number }>();
  
  siteCodes.forEach(code => {
    dataMap.set(code, {});
  });
  
  // 원시 데이터에서 값 추출
  rawData.forEach(row => {
    const code = row.siteCode;
    if (!dataMap.has(code)) return;
    
    if (row.segment === visitsLabel) {
      dataMap.get(code)!.visits = row.value;
    } else if (row.segment === cartAddLabel) {
      dataMap.get(code)!.cartAdd = row.value;
    } else if (row.segment === orderLabel) {
      dataMap.get(code)!.order = row.value;
    }
  });
  
  // 파싱된 데이터 배열로 변환
  return siteCodes.map(code => {
    const data = dataMap.get(code)!;
    return {
      siteCode: code,
      visits: data.visits ?? 'N/A',
      cartAdd: data.cartAdd ?? 'N/A',
      order: data.order ?? 'N/A'
    };
  });
}

