import { useState } from 'react';

interface PrivacyNoticeProps {
  onClearAllData: () => Promise<void>;
  isLoading?: boolean;
}

export function PrivacyNotice({
  onClearAllData,
  isLoading = false,
}: PrivacyNoticeProps) {
  const [showNotice, setShowNotice] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllData = async () => {
    if (isClearing) return;

    const confirmed = window.confirm(
      '确定要清除所有数据吗？这将删除所有会话和信息，此操作不可恢复。'
    );

    if (!confirmed) return;

    try {
      setIsClearing(true);
      await onClearAllData();
      alert('所有数据已清除');
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('清除数据失败，请重试');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/95 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <button
        onClick={() => setShowNotice(!showNotice)}
        className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <div className="font-medium text-gray-800">隐私说明</div>
            <div className="text-xs text-gray-500 mt-0.5">查看数据使用方式与清理选项</div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${showNotice ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showNotice && (
        <div className="mt-4 space-y-3 text-sm text-gray-600">
          <div className="rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
            <h3 className="font-semibold text-blue-900 mb-2">数据存储</h3>
            <p className="leading-6">
              您的对话历史和提取的信息安全存储在本地数据库中。我们不会将您的数据发送到除
              DeepSeek API 之外的任何第三方服务。
            </p>
          </div>

          <div className="rounded-2xl bg-green-50 px-4 py-3 ring-1 ring-green-100">
            <h3 className="font-semibold text-green-900 mb-2">数据使用</h3>
            <p className="leading-6">
              您的数据仅用于提供智能对话服务和信息提取功能。DeepSeek API
              会处理您的对话内容以生成回复和分析信息。
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
            <h3 className="font-semibold text-amber-900 mb-2">数据控制</h3>
            <p className="leading-6">
              您可以随时删除单个会话或清除所有数据。删除操作将从数据库中完全移除相关信息。
            </p>
          </div>

          <div className="rounded-2xl bg-red-50/70 px-4 py-4 ring-1 ring-red-100">
            <button
              onClick={handleClearAllData}
              disabled={isLoading || isClearing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isClearing ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin"
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
                  <span>清除中...</span>
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span>清除所有数据</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
