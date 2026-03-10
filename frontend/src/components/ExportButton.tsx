/**
 * ExportButton Component
 * Button to export profile data as PDF
 */

import { useState } from 'react';

interface ExportButtonProps {
  sessionId: string | null;
  onExport: () => Promise<void>;
  disabled?: boolean;
}

export function ExportButton({
  sessionId,
  onExport,
  disabled = false,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!sessionId || isExporting) return;

    try {
      setIsExporting(true);
      await onExport();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = disabled || !sessionId || isExporting;

  return (
    <button
      onClick={handleExport}
      disabled={isDisabled}
      className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
        isDisabled
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
      }`}
      title={!sessionId ? '请先选择一个会话' : '导出为 PDF'}
    >
      {isExporting ? (
        <>
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>导出中...</span>
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>导出 PDF</span>
        </>
      )}
    </button>
  );
}
