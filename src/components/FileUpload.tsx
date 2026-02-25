import React, { useRef, useState } from 'react';
import { RawDataRow, parseFile } from '../utils/parser';

interface FileUploadProps {
  onFileParsed: (data: RawDataRow[]) => void;
  onError: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileParsed, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file ?? null);
    onError('');
  };

  const handleLoadData = async () => {
    if (!selectedFile) {
      onError('파일을 먼저 선택해주세요.');
      return;
    }
    setLoading(true);
    onError('');
    try {
      const data = await parseFile(selectedFile);
      onFileParsed(data);
    } catch (error) {
      onError(error instanceof Error ? error.message : '파일 파싱 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const canLoad = selectedFile && !loading;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            파일 선택
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{
              padding: '8px 12px',
              border: '1.5px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#374151',
              backgroundColor: '#fff',
              cursor: 'pointer',
              maxWidth: '380px',
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleLoadData}
          disabled={!canLoad}
          style={{
            padding: '9px 20px',
            fontSize: '14px',
            fontWeight: 600,
            backgroundColor: canLoad ? '#2563eb' : '#93c5fd',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: canLoad ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s ease',
          }}
        >
          {loading ? '불러오는 중…' : '데이터 불러오기'}
        </button>
      </div>
      {selectedFile && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '10px',
          padding: '6px 12px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          color: '#166534',
          fontSize: '13px',
        }}>
          <span>📄</span>
          <span>{selectedFile.name}</span>
        </div>
      )}
    </div>
  );
};


