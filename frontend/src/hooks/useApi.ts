import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  sessionApi,
  messageApi,
  profileApi,
  exportApi,
  ApiClientError,
} from '../api/client';
import type { Message } from '../types';

export function useApi() {
  const {
    setLoading,
    startStreaming,
    completeStreaming,
    setError,
    setCurrentSession,
    setSessions,
    addSession,
    removeSession,
    setMessages,
    addMessage,
    appendMessageContent,
    startProfileReasoning,
    updateProfileReasoning,
    completeProfileReasoning,
    setProfileData,
    mergeProfileData,
    resetSession,
  } = useAppContext();

  const createSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await sessionApi.createSession();
      resetSession();
      addSession(session);
      setCurrentSession(session.id);

      // 加载新会话的完整数据（包括 profile）
      const sessionDetail = await sessionApi.getSession(session.id);
      setMessages(sessionDetail.messages);
      const profileData = await profileApi.getProfileData(session.id);
      setProfileData(profileData);

      return session.id;
    } catch (error) {
      const errorMessage =
        error instanceof ApiClientError ? error.message : '创建会话失败';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, resetSession, addSession, setCurrentSession, setMessages, setProfileData]);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const sessions = await sessionApi.listSessions();
      setSessions(sessions);
      return sessions;
    } catch (error) {
      const errorMessage =
        error instanceof ApiClientError ? error.message : '加载会话列表失败';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSessions]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        setLoading(true);
        setError(null);

        const sessionDetail = await sessionApi.getSession(sessionId);
        setCurrentSession(sessionId);
        setMessages(sessionDetail.messages);

        // 获取完整的 profile 数据（包括 reasoningHistory）
        const profileData = await profileApi.getProfileData(sessionId);
        setProfileData(profileData);

        return sessionDetail;
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '加载会话失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setCurrentSession, setMessages, setProfileData]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        setLoading(true);
        setError(null);

        await sessionApi.deleteSession(sessionId);
        removeSession(sessionId);
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '删除会话失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, removeSession]
  );

  const clearAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await sessionApi.clearAllData();
      setSessions([]);
      setCurrentSession(null);
      resetSession();
    } catch (error) {
      const errorMessage =
        error instanceof ApiClientError ? error.message : '清除数据失败';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSessions, setCurrentSession, resetSession]);

  const sendMessage = useCallback(
    (sessionId: string, content: string): AbortController => {
      startStreaming();
      setError(null);

      const requestId = `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userMessage: Message = {
        id: `user-${requestId}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      addMessage(userMessage);

      const assistantMessageId = `assistant-${requestId}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      addMessage(assistantMessage);

      return messageApi.sendMessage(
        sessionId,
        content,
        (chunk) => {
          appendMessageContent(assistantMessageId, chunk);
        },
        () => {
          completeStreaming();
          // 注意：这里不再调用 getProfileData，因为 onReasoningComplete 会处理
          // 只有当 reasoner 触发时（3条消息后），才会更新 reasoningHistory
        },
        (error) => {
          completeStreaming();
          const errorMessage =
            error instanceof ApiClientError ? error.message : '发送消息失败';
          setError(errorMessage);
        },
        (profileData) => {
          mergeProfileData(profileData);
        },
        (reasoningChunk) => {
          updateProfileReasoning(reasoningChunk);
        },
        () => {
          startProfileReasoning();
        },
        (finalOutputText, reasoningText) => {
          completeProfileReasoning(finalOutputText, reasoningText);
        },
        () => {
          // Abort: 保留已生成内容并标记取消，确保流状态归位
          appendMessageContent(assistantMessageId, '（已取消）');
          completeStreaming();
          completeProfileReasoning();
        }
      );
    },
    [
      startStreaming,
      completeStreaming,
      setError,
      addMessage,
      appendMessageContent,
      mergeProfileData,
      updateProfileReasoning,
      startProfileReasoning,
      completeProfileReasoning,
    ]
  );

  const loadProfileData = useCallback(
    async (sessionId: string) => {
      try {
        const profileData = await profileApi.getProfileData(sessionId);
        setProfileData(profileData);
        return profileData;
      } catch (error) {
        console.error('Failed to load profile data:', error);
      }
    },
    [setProfileData]
  );

  const analyzeProfile = useCallback(
    async (sessionId: string) => {
      try {
        setLoading(true);
        setError(null);
        const profileData = await profileApi.analyzeProfile(sessionId);
        setProfileData(profileData);
        return profileData;
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '分析信息失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setProfileData]
  );

  const updateProfileField = useCallback(
    async (sessionId: string, field: string, value: string) => {
      try {
        setError(null);
        const profileData = await profileApi.updateProfileField(sessionId, field, value);
        setProfileData(profileData);
        return profileData;
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '更新信息失败';
        setError(errorMessage);
        throw error;
      }
    },
    [setError, setProfileData]
  );

  const exportPDF = useCallback(
    async (sessionId: string, filename?: string) => {
      try {
        setLoading(true);
        setError(null);
        await exportApi.downloadPDF(sessionId, filename);
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '导出 PDF 失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  const organizeSessions = useCallback(async () => {
    try {
      const result = await sessionApi.organizeSessions();
      setSessions(result.sessions);
      return result;
    } catch (error) {
      console.error('Failed to organize sessions:', error);
      throw error;
    }
  }, [setSessions]);

  return {
    createSession,
    loadSessions,
    loadSession,
    deleteSession,
    clearAllData,
    organizeSessions,
    sendMessage,
    loadProfileData,
    analyzeProfile,
    updateProfileField,
    exportPDF,
  };
}
