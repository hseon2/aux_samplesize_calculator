import React, { useRef } from 'react';
import { RawDataRow, parseFile } from '../utils/parser';

interface FileUploadProps {
  onFileParsed: (data: RawDataRow[]) => void;
  onError: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileParsed, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseFile(file);
      onFileParsed(data);
    } catch (error) {
      onError(error instanceof Error ? error.message : '파일 파싱 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
        CSV/Excel 파일 업로드
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileChange}
        style={{
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          width: '100%',
          maxWidth: '400px'
        }}
      />
    </div>
  );
};


