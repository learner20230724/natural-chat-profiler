import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppContext } from './context/AppContext';
import { useApi } from './hooks/useApi';
import {
  ChatPanel,
  ProfilePanel,
  ReasoningPanel,
  SessionList,
  ExportButton,
  PrivacyNotice,
} from './components';

function App() {
  const { state, setError } = useAppContext();
  const [mobileTab, setMobileTab] = useState<'chat' | 'profile' | 'reasoning'>('chat');
  const [shouldAutoCreateSession, setShouldAutoCreateSession] = useState(true);
  const activeStreamControllerRef = useRef<AbortController | null>(null);
  const initialCreateInFlightRef = useRef(false);

  const {
    loadSessions,
    createSession,
    loadSession,
    deleteSession,
    clearAllData,
    organizeSessions,
    sendMessage,
    updateProfileField,
    exportPDF,
  } = useApi();

  useEffect(() => {
    const initApp = async () => {
      try {
        await organizeSessions();
      } catch (e) {
        // 静默忽略组织会话错误
      }
      try {
        await loadSessions();
      } catch (e) {
        // 静默忽略加载会话错误
      }
    };
    initApp();
  }, [loadSessions, organizeSessions]);

  useEffect(() => {
    if (
      initialCreateInFlightRef.current ||
      state.currentSessionId ||
      state.sessions.length > 0 ||
      state.isLoading ||
      !shouldAutoCreateSession
    ) {
      return;
    }

    initialCreateInFlightRef.current = true;
    createSession()
      .catch((error) => {
        console.error('Failed to create initial session:', error);
      })
      .finally(() => {
        initialCreateInFlightRef.current = false;
      });
  }, [state.sessions.length, state.currentSessionId, state.isLoading, shouldAutoCreateSession, createSession]);

  // 清理 active controller 当 streaming 结束
  useEffect(() => {
    if (!state.isStreaming) {
      activeStreamControllerRef.current = null;
    }
  }, [state.isStreaming]);

  const confirmAbortIfStreaming = useCallback(async () => {
    if (!state.isStreaming) return true;
    const confirmed = window.confirm('当前正在生成，确定要中止并继续此操作吗？');
    if (!confirmed) return false;
    activeStreamControllerRef.current?.abort();
    return true;
  }, [state.isStreaming]);

  const handleSendMessage = (content: string) => {
    if (!state.currentSessionId) {
      setError('没有活动会话，请创建新会话');
      return;
    }

    const controller = sendMessage(state.currentSessionId, content);
    activeStreamControllerRef.current = controller;
  };

  const handleSelectSession = async (sessionId: string) => {
    if (!(await confirmAbortIfStreaming())) return;
    try {
      await loadSession(sessionId);
    } catch (error) {
      console.error('Failed to load session:', error);
      setError('加载会话失败，请重试');
    }
  };

  const handleNewSession = async () => {
    if (!(await confirmAbortIfStreaming())) return;
    try {
      setShouldAutoCreateSession(true);
      await createSession();
    } catch (error) {
      console.error('Failed to create session:', error);
      setError('创建会话失败，请重试');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!(await confirmAbortIfStreaming())) return;
    try {
      await deleteSession(sessionId);
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
    }
  };

  const handleClearAllData = async () => {
    if (!(await confirmAbortIfStreaming())) return;
    try {
      setShouldAutoCreateSession(false);
      await clearAllData();
      await loadSessions();
    } catch (error) {
      console.error('Failed to clear all data:', error);
      setError('清除数据失败，请重试');
      throw error;
    }
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleUpdateProfileField = async (field: string, value: string) => {
    if (!state.currentSessionId) return;

    try {
      await updateProfileField(state.currentSessionId, field, value);
    } catch (error) {
      console.error('Failed to update profile field:', error);
      setError('更新信息失败，请重试');
    }
  };

  return (
    <div className="h-full bg-gray-100">
      <div className="container mx-auto h-full px-4 py-4 flex flex-col overflow-hidden max-w-[1920px]">
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-bold text-gray-800">自然聊天信息提取器</h1>
            <ExportButton
              sessionId={state.currentSessionId}
              onExport={handleExportPDF}
              disabled={state.isLoading || !state.currentSessionId}
            />
          </div>
        </div>

        {state.error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center justify-between flex-shrink-0">
            <span>错误: {state.error}</span>
            <button
              onClick={handleDismissError}
              className="ml-4 text-red-900 hover:text-red-700 font-semibold"
              aria-label="关闭错误提示"
            >
              ✕
            </button>
          </div>
        )}

        {state.isLoading && !state.currentSessionId && (
          <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded-lg text-center flex-shrink-0">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-2"></div>
            加载中...
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-10 gap-3">
          <div className="hidden lg:flex lg:col-span-2 flex-col min-h-0 gap-3">
            <div className="flex-1 min-h-0">
              <SessionList
                sessions={state.sessions}
                currentSessionId={state.currentSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onNewSession={handleNewSession}
                isLoading={state.isLoading}
              />
            </div>
            <PrivacyNotice onClearAllData={handleClearAllData} isLoading={state.isLoading} />
          </div>

          <div className="lg:hidden col-span-1 mb-2 flex-shrink-0">
            <div className="flex space-x-2 bg-white rounded-lg p-2 shadow">
              <button
                onClick={() => setMobileTab('chat')}
                className={`flex-1 py-2 px-4 rounded transition-colors ${
                  mobileTab === 'chat' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                对话
              </button>
              <button
                onClick={() => setMobileTab('profile')}
                className={`flex-1 py-2 px-4 rounded transition-colors ${
                  mobileTab === 'profile' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                信息
              </button>
              <button
                onClick={() => setMobileTab('reasoning')}
                className={`flex-1 py-2 px-4 rounded transition-colors ${
                  mobileTab === 'reasoning' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                思考
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col min-h-0">
            <ChatPanel
              sessionId={state.currentSessionId}
              messages={state.messages}
              onSendMessage={handleSendMessage}
              isStreaming={state.isStreaming}
            />
          </div>

          <div className="lg:col-span-2 flex flex-col min-h-0">
            <ProfilePanel
              profileData={state.profileData}
              isUpdating={state.isLoading}
              onUpdateField={handleUpdateProfileField}
            />
          </div>

          <div className="lg:col-span-3 flex flex-col min-h-0">
            <ReasoningPanel
              key={state.currentSessionId ?? 'no-session'}
              sessionId={state.currentSessionId}
              reasoning={state.profileData.reasoning}
              isStreaming={state.profileData.isReasoningStreaming}
              reasoningHistory={state.profileData.reasoningHistory}
            />
          </div>
        </div>

        <div className="lg:hidden mt-4 flex-shrink-0">
          <SessionList
            sessions={state.sessions}
            currentSessionId={state.currentSessionId}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onNewSession={handleNewSession}
            isLoading={state.isLoading}
          />
          <div className="mt-4">
            <PrivacyNotice onClearAllData={handleClearAllData} isLoading={state.isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
