import { useCallback, useState } from 'react';
import { useAppContext } from './context/AppContext';
import { useApi } from './hooks/useApi';
import { useSessionInit } from './hooks/useSessionInit';
import type { ProfileFieldDefinition } from './types';
import {
  ChatPanel,
  ExportButton,
  PrivacyNotice,
  ProfilePanel,
  ReasoningPanel,
  SessionList,
} from './components';

function App() {
  const { state, setError } = useAppContext();
  const [mobileTab, setMobileTab] = useState<'chat' | 'profile' | 'reasoning'>('chat');
  const [isMobileSessionOpen, setIsMobileSessionOpen] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [clearDataSuccessMessage, setClearDataSuccessMessage] = useState<string | null>(null);

  const {
    loadSessions,
    createSession,
    loadSession,
    deleteSession,
    clearAllData,
    organizeSessions,
    sendMessage,
    abortCurrentStream,
    updateProfileField,
    updateProfileFieldDefinitions,
    exportPDF,
  } = useApi();

  const { isInitComplete, setShouldAutoCreateSession } = useSessionInit({
    loadSessions,
    createSession,
    organizeSessions,
    setError,
    currentSessionId: state.currentSessionId,
    isCreatingSession: state.loading.creatingSession,
  });

  const isInitialSessionLoading = state.loading.sessions || state.loading.sessionDetail;
  const isCreatingSession = state.loading.creatingSession;
  const isClearingAllData = state.loading.clearingAllData;
  const isExportingPdf = state.loading.exportingPdf;
  const deletingSessionId = state.loading.deletingSessionId;

  const confirmAbortIfStreaming = useCallback(async () => {
    if (!state.isStreaming) return true;
    const confirmed = window.confirm('当前正在生成，确定要中止并继续此操作吗？');
    if (!confirmed) return false;
    abortCurrentStream();
    return true;
  }, [state.isStreaming, abortCurrentStream]);

  const openClearDataConfirm = useCallback(async () => {
    if (!(await confirmAbortIfStreaming())) return;
    setShowClearDataConfirm(true);
  }, [confirmAbortIfStreaming]);

  const closeClearDataConfirm = useCallback(() => {
    if (isClearingAllData) return;
    setShowClearDataConfirm(false);
  }, [isClearingAllData]);

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
      setMobileTab('chat');
    } catch (error) {
      console.error('Failed to load session:', error);
      setError('加载会话失败，请重试');
    }
  };

  const handleNewSession = async () => {
    if (!(await confirmAbortIfStreaming())) return;

    try {
      setShouldAutoCreateSession(true);
      setClearDataSuccessMessage(null);
      await createSession();
      setIsMobileSessionOpen(false);
      setMobileTab('chat');
    } catch (error) {
      console.error('Failed to create session:', error);
      setError('创建会话失败，请重试');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!(await confirmAbortIfStreaming())) return;

    const sessionIndex = state.sessions.findIndex((session) => session.id === sessionId);
    const fallbackSessionId =
      state.currentSessionId === sessionId && sessionIndex !== -1
        ? state.sessions[sessionIndex + 1]?.id ?? state.sessions[sessionIndex - 1]?.id ?? null
        : null;

    try {
      await deleteSession(sessionId);
      if (fallbackSessionId) {
        await loadSession(fallbackSessionId);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      setError('删除会话失败，请重试');
    }
  };

  const handleExportPDF = async () => {
    if (!state.currentSessionId) return;

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      await exportPDF(state.currentSessionId, `profile-${timestamp}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      setError('导出 PDF 失败，请重试');
      throw error;
    }
  };

  const handleClearAllData = async () => {
    setShouldAutoCreateSession(false);
    try {
      await clearAllData();
    } catch (error) {
      // clearAllData failed — restore auto-create so the user isn't left with an empty UI
      setShouldAutoCreateSession(true);
      console.error('Failed to clear all data:', error);
      setError('清除数据失败，请重试');
      throw error;
    }

    try {
      await loadSessions();
    } catch {
      // Sessions were cleared successfully; loadSessions failing is non-critical.
      // Allow auto-create so user can start a fresh session.
      setShouldAutoCreateSession(true);
    }

    setClearDataSuccessMessage('所有本地会话与画像数据已清除。');
    setShowClearDataConfirm(false);
    setIsMobileSessionOpen(false);
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleDismissClearDataSuccess = () => {
    setClearDataSuccessMessage(null);
  };

  const handleUpdateProfileField = async (field: string, value: string) => {
    if (!state.currentSessionId) return;

    try {
      await updateProfileField(state.currentSessionId, field, value);
    } catch (error) {
      console.error('Failed to update profile field:', error);
      throw error;
    }
  };

  const handleUpdateProfileFieldDefinitions = async (definitions: ProfileFieldDefinition[]) => {
    if (!state.currentSessionId) return;

    try {
      await updateProfileFieldDefinitions(state.currentSessionId, definitions);
    } catch (error) {
      console.error('Failed to update profile field definitions:', error);
      throw error;
    }
  };

  const mobileTabButtonClass = (tab: 'chat' | 'profile' | 'reasoning') =>
    `flex-1 py-2.5 px-4 rounded-xl transition-colors ${
      mobileTab === tab
        ? 'bg-blue-500 text-white shadow-sm'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`;

  const showNoSessionHint = isInitComplete && !isInitialSessionLoading && !state.currentSessionId;

  return (
    <div className="h-full bg-gray-100">
      <div className="container mx-auto h-full max-w-[1920px] overflow-hidden px-3 py-3 sm:px-4 sm:py-4 flex flex-col">
        <div className="mb-3 flex-shrink-0 sm:mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">自然聊天信息提取器</h1>
                <p className="mt-1 text-sm text-gray-500 lg:hidden">
                  {state.currentSessionId
                    ? '当前主任务区已就绪，可随时切换会话或查看画像。'
                    : '先创建一个会话，开始聊天与信息提取。'}
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
            <ExportButton
              sessionId={state.currentSessionId}
              onExport={handleExportPDF}
              disabled={isExportingPdf || !state.currentSessionId}
              compact
            />
          </div>
        </div>

        {state.error && (
          <div className="mb-4 flex flex-shrink-0 items-center justify-between rounded-lg bg-red-100 p-4 text-red-700">
            <span>错误: {state.error}</span>
            <button
              onClick={handleDismissError}
              className="ml-4 font-semibold text-red-900 hover:text-red-700"
              aria-label="关闭错误提示"
            >
              ✕
            </button>
          </div>
        )}

        {clearDataSuccessMessage && (
          <div className="mb-4 flex flex-shrink-0 items-center justify-between rounded-lg bg-green-100 p-4 text-green-700">
            <span>{clearDataSuccessMessage}</span>
            <button
              onClick={handleDismissClearDataSuccess}
 className="ml-4 font-semibold text-green-900 hover:text-green-700"
              aria-label="关闭清除成功提示"
            >
              ✕
            </button>
          </div>
        )}

        {(isInitialSessionLoading || !isInitComplete) && !state.currentSessionId && (
          <div className="mb-4 flex-shrink-0 rounded-lg bg-blue-100 p-4 text-center text-blue-700">
            <div className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-b-2 border-blue-700"></div>
            正在初始化会话列表...
          </div>
        )}

        {showNoSessionHint && (
          <div className="mb-4 flex-shrink-0 rounded-2xl border border-dashed border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-500 lg:hidden">
            暂无活动会话。你可以先新建一个会话，随后在这里进行聊天、查看画像和思考过程。
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-10">
          <div className="hidden min-h-0 flex-col gap-3 lg:col-span-2 lg:flex">
            <div className="min-h-0 flex-1">
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
            <PrivacyNotice
              onClearAllData={openClearDataConfirm}
              isLoading={isClearingAllData}
              actionLabel="清除中..."
            />
          </div>

          <div className="col-span-1 mb-2 flex-shrink-0 lg:hidden">
            <div className="flex space-x-2 rounded-2xl border border-gray-200/80 bg-white p-2 shadow-sm">
              <button onClick={() => setMobileTab('chat')} className={mobileTabButtonClass('chat')}>
                对话
              </button>
              <button onClick={() => setMobileTab('profile')} className={mobileTabButtonClass('profile')}>
                信息
              </button>
              <button onClick={() => setMobileTab('reasoning')} className={mobileTabButtonClass('reasoning')}>
                思考
              </button>
            </div>
          </div>

          <div className={`flex min-h-0 flex-col lg:col-span-3 ${mobileTab === 'chat' ? 'block' : 'hidden'} lg:block`}>
            <ChatPanel
              sessionId={state.currentSessionId}
              messages={state.messages}
              onSendMessage={handleSendMessage}
              isStreaming={state.isStreaming}
              onAbortStream={abortCurrentStream}
              onCreateSession={handleNewSession}
            />
          </div>

          <div className={`flex min-h-0 flex-col lg:col-span-2 ${mobileTab === 'profile' ? 'block' : 'hidden'} lg:block`}>
            <ProfilePanel
              profileData={state.profileData}
              fieldDefinitions={state.profileFieldDefinitions}
              isUpdating={state.profileData.isReasoningStreaming}
              onUpdateField={handleUpdateProfileField}
              onUpdateFieldDefinitions={handleUpdateProfileFieldDefinitions}
            />
          </div>

          <div className={`flex min-h-0 flex-col lg:col-span-3 ${mobileTab === 'reasoning' ? 'block' : 'hidden'} lg:block`}>
            <ReasoningPanel
              key={state.currentSessionId ?? 'no-session'}
              sessionId={state.currentSessionId}
              reasoning={state.profileData.reasoning}
              isStreaming={state.profileData.isReasoningStreaming}
              reasoningHistory={state.profileData.reasoningHistory}
            />
          </div>
        </div>

        {showClearDataConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default"
              aria-label="关闭清除数据确认弹层"
              onClick={closeClearDataConfirm}
            />
            <div className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-gray-800">确认清除所有数据</h2>
              <p className="mt-3 text-sm leading-6 text-gray-500">
                这将删除所有会话、提取结果与本地画像信息，且无法恢复。
              </p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeClearDataConfirm}
                  disabled={isClearingAllData}
                  className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleClearAllData()}
                  disabled={isClearingAllData}
                  className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {isClearingAllData ? '清除中...' : '确认清除'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">会话与隐私</h2>
                  <p className="mt-1 text-sm text-gray-500">切换会话、查看说明或清理本地数据。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSessionOpen(false)}
                  className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="关闭会话面板"
                >
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
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
                <PrivacyNotice
                  onClearAllData={openClearDataConfirm}
                  isLoading={isClearingAllData}
                  actionLabel="清除中..."
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

export default App;
