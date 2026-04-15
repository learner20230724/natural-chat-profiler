import { useCallback, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useApi } from '../hooks/useApi';
import { useSessionInit } from '../hooks/useSessionInit';
import { ChatPanel, SessionList } from '../components';

export default function UserPage() {
  const { state, setError } = useAppContext();
  const [isMobileSessionOpen, setIsMobileSessionOpen] = useState(false);

  const {
    loadSessions,
    createSession,
    loadSession,
    deleteSession,
    organizeSessions,
    sendMessage,
    abortCurrentStream,
  } = useApi();

  const { isInitComplete, setShouldAutoCreateSession } = useSessionInit({
    loadSessions,
    createSession,
    organizeSessions,
    setError,
    currentSessionId: state.currentSessionId,
    isCreatingSession: state.loading.creatingSession,
  });

  const isCreatingSession = state.loading.creatingSession;
  const deletingSessionId = state.loading.deletingSessionId;
  const isInitialSessionLoading = state.loading.sessions || state.loading.sessionDetail;

  const confirmAbortIfStreaming = useCallback(async () => {
    if (!state.isStreaming) return true;
    const confirmed = window.confirm('当前正在生成，确定要中止并继续此操作吗？');
    if (!confirmed) return false;
    abortCurrentStream();
    return true;
  }, [state.isStreaming, abortCurrentStream]);

  const handleSendMessage = (content: string) => {
    if (!state.currentSessionId) {
      setError('没有活动会话，请创建新会话');
      return;
    }
    sendMessage(state.currentSessionId, content);
  };

  const handleSelectSession = async (sessionId: string) => {
    if (!(await confirmAbortIfStreaming())) return;
    try {
      await loadSession(sessionId);
      setIsMobileSessionOpen(false);
    } catch {
      setError('加载会话失败，请重试');
    }
  };

  const handleNewSession = async () => {
    if (!(await confirmAbortIfStreaming())) return;
    try {
      setShouldAutoCreateSession(true);
      await createSession();
      setIsMobileSessionOpen(false);
    } catch {
      setError('创建会话失败，请重试');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!(await confirmAbortIfStreaming())) return;
    const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId);
    const fallbackSessionId =
      state.currentSessionId === sessionId && sessionIndex !== -1
        ? state.sessions[sessionIndex + 1]?.id ?? state.sessions[sessionIndex - 1]?.id ?? null
        : null;
    try {
      await deleteSession(sessionId);
      if (fallbackSessionId) await loadSession(fallbackSessionId);
    } catch {
      setError('删除会话失败，请重试');
    }
  };

  return (
    <div className="h-full bg-gray-100">
      <div className="container mx-auto h-full max-w-[1920px] overflow-hidden px-3 py-3 sm:px-4 sm:py-4 flex flex-col">
        <div className="mb-3 flex-shrink-0 sm:mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">聊天</h1>
            <p className="mt-1 text-sm text-gray-500 lg:hidden">
              {state.currentSessionId ? '会话已就绪，可以开始聊天。' : '先创建一个会话，开始聊天。'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSessionOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm lg:hidden"
          >
            会话
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 ring-1 ring-blue-100">
              {state.sessions.length}
            </span>
          </button>
        </div>

        {state.error && (
          <div className="mb-4 flex flex-shrink-0 items-center justify-between rounded-lg bg-red-100 p-4 text-red-700">
            <span>错误: {state.error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 font-semibold text-red-900 hover:text-red-700"
              aria-label="关闭错误提示"
            >
              ✕
            </button>
          </div>
        )}

        {(isInitialSessionLoading || !isInitComplete) && !state.currentSessionId && (
          <div className="mb-4 flex-shrink-0 rounded-lg bg-blue-100 p-4 text-center text-blue-700">
            <div className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-b-2 border-blue-700" />
            正在初始化会话列表...
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-10">
          <div className="hidden min-h-0 lg:col-span-2 lg:flex lg:flex-col">
            <SessionList
              sessions={state.sessions}
              currentSessionId={state.currentSessionId}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onNewSession={handleNewSession}
              isLoading={state.loading.sessions}
              isCreating={isCreatingSession}
              deletingSessionId={deletingSessionId}
            />
          </div>

          <div className="flex min-h-0 flex-col lg:col-span-8">
            <ChatPanel
              sessionId={state.currentSessionId}
              messages={state.messages}
              onSendMessage={handleSendMessage}
              isStreaming={state.isStreaming}
              onAbortStream={abortCurrentStream}
              onCreateSession={handleNewSession}
            />
          </div>
        </div>

        {isMobileSessionOpen && (
          <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden">
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default"
              aria-label="关闭会话面板遮罩"
              onClick={() => setIsMobileSessionOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
                <h2 className="text-lg font-semibold text-gray-800">会话列表</h2>
                <button
                  type="button"
                  onClick={() => setIsMobileSessionOpen(false)}
                  className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="关闭会话面板"
                >
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <SessionList
                  sessions={state.sessions}
                  currentSessionId={state.currentSessionId}
                  onSelectSession={handleSelectSession}
                  onDeleteSession={handleDeleteSession}
                  onNewSession={handleNewSession}
                  isLoading={state.loading.sessions}
                  isCreating={isCreatingSession}
                  deletingSessionId={deletingSessionId}
                  compact
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
