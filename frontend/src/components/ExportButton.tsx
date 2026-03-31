import { useState } from 'react';

interface ExportButtonProps {
  sessionId: string | null;
  onExport: () => Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

export function ExportButton({
  sessionId,
  onExport,
  disabled = false,
  compact = false,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleExport = async () => {
    if (!sessionId || isExporting) return;

    try {
      setIsExporting(true);
      setFeedbackMessage(null);
      await onExport();
    } catch {
      setFeedbackMessage('导出失败，请稍后重试。');
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = disabled || !sessionId || isExporting;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleExport}
        disabled={isDisabled}
        className={`${compact ? 'px-4 py-2 text-sm' : 'px-6 py-3'} rounded-xl font-medium transition-all flex items-center gap-2 ${
          isDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
        }`}
        title={!sessionId ? '请先选择一个会话' : '导出为 PDF'}
      >
        {isExporting ? <span>导出中...</span> : <span>{compact ? '导出' : '导出 PDF'}</span>}
      </button>
      {feedbackMessage && (
        <div className="max-w-xs rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">
          {feedbackMessage}
        </div>
      )}
    </div>
  );
}
