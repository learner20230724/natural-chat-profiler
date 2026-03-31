import { useState } from 'react';

interface PrivacyNoticeProps {
  onClearAllData: () => Promise<void> | void;
  isLoading?: boolean;
  compact?: boolean;
  actionLabel?: string;
}

export function PrivacyNotice({
  onClearAllData,
  isLoading = false,
  compact = false,
  actionLabel = '处理中...',
}: PrivacyNoticeProps) {
  const [showNotice, setShowNotice] = useState(false);

  const handleClearAllData = async () => {
    await onClearAllData();
  };

  return (
    <div className={`rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-sm ${compact ? 'p-3' : 'p-4'}`}>
      <button
        onClick={() => setShowNotice(!showNotice)}
        className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-gray-800">隐私说明</div>
            <div className="text-xs text-gray-500 mt-0.5">查看数据使用方式与清理选项</div>
          </div>
        </div>
        <svg className={`w-5 h-5 text-gray-500 transition-transform ${showNotice ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showNotice && (
        <div className="mt-4 space-y-3 text-sm text-gray-600">
          <div className="rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
            <h3 className="font-semibold text-blue-900 mb-2">数据存储</h3>
            <p className="leading-6">您的对话历史和提取的信息安全存储在本地数据库中。我们不会将您的数据发送到除 DeepSeek API 之外的任何第三方服务。</p>
          </div>

          {!compact && (
            <div className="rounded-2xl bg-green-50 px-4 py-3 ring-1 ring-green-100">
              <h3 className="font-semibold text-green-900 mb-2">数据使用</h3>
              <p className="leading-6">您的数据仅用于提供智能对话服务和信息提取功能。DeepSeek API 会处理您的对话内容以生成回复和分析信息。</p>
            </div>
          )}

          <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
            <h3 className="font-semibold text-amber-900 mb-2">数据控制</h3>
            <p className="leading-6">您可以随时删除单个会话或清除所有数据。删除操作将从数据库中完全移除相关信息。</p>
          </div>

          <div className="rounded-2xl bg-red-50/70 px-4 py-4 ring-1 ring-red-100">
            <button
              onClick={() => void handleClearAllData()}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isLoading ? actionLabel : '清除所有数据'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
