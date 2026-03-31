import { useEffect, useState } from 'react';
import type { Session } from '../types';

interface SessionListProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
  isLoading?: boolean;
  isCreating?: boolean;
  deletingSessionId?: string | null;
  compact?: boolean;
}

const formatSessionLabel = (session: Session) => session.preview || session.title || '新会话';

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  isLoading = false,
  isCreating = false,
  deletingSessionId = null,
  compact = false,
}: SessionListProps) {
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);
  const pendingDeleteSession = sessions.find((session) => session.id === pendingDeleteSessionId) ?? null;

  useEffect(() => {
    if (pendingDeleteSessionId && deletingSessionId !== pendingDeleteSessionId && !pendingDeleteSession) {
      setPendingDeleteSessionId(null);
    }
  }, [pendingDeleteSessionId, deletingSessionId, pendingDeleteSession]);

  return (
    <>
      <div className={`bg-white rounded-2xl shadow-lg min-h-0 flex flex-col border border-gray-200/80 ${compact ? 'p-3' : 'p-4'}`}>
        <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-4'}`}>
          <div>
            <h2 className={`${compact ? 'text-base' : 'text-xl'} font-semibold text-gray-800`}>会话列表</h2>
            {compact && <p className="text-xs text-gray-500 mt-0.5">切换会话或新建对话</p>}
          </div>
          <button
            onClick={onNewSession}
            disabled={isCreating}
            className={`${compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors`}
          >
            {isCreating ? '新建中...' : '新建会话'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2" role="list" aria-label="会话列表">
          {isLoading && sessions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">正在加载会话...</div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              <p className="font-medium text-gray-700 mb-1">还没有会话</p>
              <p>点击“新建会话”开始第一段对话。</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                role="listitem"
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  currentSessionId === session.id
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => onSelectSession(session.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectSession(session.id);
                  }
                }}
                tabIndex={0}
                aria-current={currentSessionId === session.id ? 'true' : undefined}
                aria-label={`会话：${formatSessionLabel(session)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{formatSessionLabel(session)}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(session.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteSessionId(session.id);
                    }}
                    disabled={deletingSessionId === session.id}
                    className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:cursor-not-allowed disabled:text-red-300 disabled:hover:bg-transparent"
                    title="删除会话"
                    aria-label={`删除会话：${formatSessionLabel(session)}`}
                  >
                    {deletingSessionId === session.id ? '删除中...' : '删除'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pendingDeleteSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="关闭删除会话确认弹层"
            onClick={() => setPendingDeleteSessionId(null)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-800">确认删除会话</h3>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              删除后将无法恢复“{formatSessionLabel(pendingDeleteSession)}”。
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteSessionId(null)}
                disabled={deletingSessionId === pendingDeleteSession.id}
                className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  void onDeleteSession(pendingDeleteSession.id);
                }}
                disabled={deletingSessionId === pendingDeleteSession.id}
                className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deletingSessionId === pendingDeleteSession.id ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
