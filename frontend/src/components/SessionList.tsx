import type { Session } from '../types';

interface SessionListProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
  isLoading?: boolean;
}

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
}: SessionListProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">会话列表</h2>
        <button
          onClick={onNewSession}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          新建会话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading && sessions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">暂无会话，点击“新建会话”开始</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                currentSessionId === session.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.preview || session.title || '新会话'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(session.createdAt)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('确定要删除这个会话吗？')) {
                      onDeleteSession(session.id);
                    }
                  }}
                  className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                  title="删除会话"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
