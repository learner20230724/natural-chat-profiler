import { useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  sessionApi,
  messageApi,
  profileApi,
  exportApi,
  ApiClientError,
} from '../api/client';
import type { Message, ProfileData, ProfileFieldDefinition } from '../types';

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
    updateMessage,
    removeMessages,
    appendMessageContent,
    startProfileReasoning,
    updateProfileReasoning,
    completeProfileReasoning,
    setProfileData,
    mergeProfileData,
    setProfileFields,
    resetSession,
  } = useAppContext();

  // Streaming / send queue (global)
  const currentStreamControllerRef = useRef<AbortController | null>(null);
  const reasonerStreamControllerRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const latestLoadSessionRequestRef = useRef(0);
  const latestStreamGenerationRef = useRef(0);
  const sendQueueRef = useRef<Array<{ sessionId: string; content: string; requestId: string }>>([]);
  const isDrainingQueueRef = useRef(false);

  const clearQueuedSends = useCallback(() => {
    const queuedRequestIds = sendQueueRef.current.map((item) => `user-${item.requestId}`);
    if (queuedRequestIds.length > 0) {
      removeMessages(queuedRequestIds);
    }
    sendQueueRef.current = [];
    isDrainingQueueRef.current = false;
  }, [removeMessages]);

  const mapProfileMerge = useCallback((profileData: ProfileData) => {
    // Preserve locally loaded reasoningHistory; streaming profile updates do not include it.
    const { reasoningHistory: _ignored, ...rest } = profileData;
    return rest as Partial<ProfileData>;
  }, []);

  const connectReasonerStream = useCallback(
    (sessionId: string) => {
      // Disconnect any existing reasoner stream.
      reasonerStreamControllerRef.current?.abort();

      const controller = messageApi.connectReasonerStream(
        sessionId,
        () => {
          if (currentSessionIdRef.current !== sessionId) return;
          startProfileReasoning();
        },
        (chunk) => {
          if (currentSessionIdRef.current !== sessionId) return;
          updateProfileReasoning(chunk);
        },
        (finalOutputText, reasoningText) => {
          if (currentSessionIdRef.current !== sessionId) return;
          completeProfileReasoning(finalOutputText, reasoningText);
        },
        (profileData) => {
          if (currentSessionIdRef.current !== sessionId) return;
          mergeProfileData(mapProfileMerge(profileData));
        },
        (error) => {
          console.warn('[reasoner stream] error:', error);
        }
      );
      reasonerStreamControllerRef.current = controller;
    },
    [startProfileReasoning, updateProfileReasoning, completeProfileReasoning, mergeProfileData, mapProfileMerge]
  );

  const abortCurrentStream = useCallback(() => {
    // Abort only the active stream; clear any queued sends to avoid unexpected sends after abort
    latestStreamGenerationRef.current += 1;
    clearQueuedSends();

    const controller = currentStreamControllerRef.current;
    // Ensure any abort-triggered callbacks won't auto-drain queued sends after abort
    currentStreamControllerRef.current = null;
    controller?.abort();
  }, [clearQueuedSends]);

  const createSession = useCallback(async () => {
    let sessionId: string | null = null;

    try {
      setLoading({ creatingSession: true });
      setError(null);

      const session = await sessionApi.createSession();
      sessionId = session.id;
      latestStreamGenerationRef.current += 1;
      currentSessionIdRef.current = session.id;
      resetSession();
      addSession(session);
      setCurrentSession(session.id);
      connectReasonerStream(session.id);

      try {
        const sessionDetail = await sessionApi.getSession(session.id);
        if (currentSessionIdRef.current === session.id) {
          setMessages(sessionDetail.messages);
          setProfileFields(sessionDetail.profileFieldDefinitions ?? []);
        }
      } catch (hydrationError) {
        console.error('Failed to hydrate new session detail:', hydrationError);
        if (currentSessionIdRef.current === session.id) {
          setProfileFields(session.profileFieldDefinitions ?? []);
          setError('会话已创建，详情加载失败，可稍后重试');
        }
        return session.id;
      }

      try {
        const profileData = await profileApi.getProfileData(session.id);
        if (currentSessionIdRef.current === session.id) {
          setProfileData(profileData);
        }
      } catch (profileError) {
        console.error('Failed to load new session profile data:', profileError);
        if (currentSessionIdRef.current === session.id) {
          setError('会话已创建，画像加载不完整');
        }
      }

      return session.id;
    } catch (error) {
      const errorMessage =
        error instanceof ApiClientError ? error.message : '创建会话失败';
      if (!sessionId) {
        setError(errorMessage);
      }
      throw error;
    } finally {
      setLoading({ creatingSession: false });
    }
  }, [setLoading, setError, resetSession, addSession, setCurrentSession, setMessages, setProfileFields, setProfileData, connectReasonerStream]);

  const loadSessions = useCallback(async () => {
    try {
      setLoading({ sessions: true });
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
      setLoading({ sessions: false });
    }
  }, [setLoading, setError, setSessions]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      const requestId = latestLoadSessionRequestRef.current + 1;
      latestLoadSessionRequestRef.current = requestId;

      try {
        setLoading({ sessionDetail: true });
        setError(null);

        const sessionDetail = await sessionApi.getSession(sessionId);
        if (latestLoadSessionRequestRef.current !== requestId) {
          return sessionDetail;
        }

        // Switching session invalidates any in-flight stream callbacks.
        latestStreamGenerationRef.current += 1;
        currentSessionIdRef.current = sessionId;

        setCurrentSession(sessionId);
        setMessages(sessionDetail.messages);
        setProfileFields(sessionDetail.profileFieldDefinitions ?? []);
        connectReasonerStream(sessionId);

        try {
          const profileData = await profileApi.getProfileData(sessionId);
          if (latestLoadSessionRequestRef.current === requestId && currentSessionIdRef.current === sessionId) {
            setProfileData(profileData);
          }
        } catch (profileError) {
          console.error('Failed to load profile data:', profileError);
          if (latestLoadSessionRequestRef.current === requestId && currentSessionIdRef.current === sessionId) {
            setProfileData(sessionDetail.profile);
            setError('画像加载不完整，已先显示会话内容');
          }
        }

        return sessionDetail;
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '加载会话失败';
        setError(errorMessage);
        throw error;
      } finally {
        if (latestLoadSessionRequestRef.current === requestId) {
          setLoading({ sessionDetail: false });
        }
      }
    },
    [setLoading, setError, setCurrentSession, setMessages, setProfileFields, setProfileData, connectReasonerStream]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        setLoading({ deletingSessionId: sessionId });
        setError(null);

        await sessionApi.deleteSession(sessionId);
        removeSession(sessionId);
        if (currentSessionIdRef.current === sessionId) {
          currentSessionIdRef.current = null;
          latestStreamGenerationRef.current += 1;
        }
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '删除会话失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading({ deletingSessionId: null });
      }
    },
    [setLoading, setError, removeSession]
  );

  const clearAllData = useCallback(async () => {
    try {
      setLoading({ clearingAllData: true });
      setError(null);
      await sessionApi.clearAllData();
      latestStreamGenerationRef.current += 1;
      currentSessionIdRef.current = null;
      setSessions([]);
      setCurrentSession(null);
      resetSession();
    } catch (error) {
      const errorMessage =
        error instanceof ApiClientError ? error.message : '清除数据失败';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading({ clearingAllData: false });
    }
  }, [setLoading, setError, setSessions, setCurrentSession, resetSession]);

  const sendMessage = useCallback(
    (sessionId: string, content: string): AbortController | null => {
      const requestId = `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (currentStreamControllerRef.current) {
        const userMessage: Message = {
          id: `user-${requestId}`,
          role: 'user',
          content,
          timestamp: new Date(),
          uiStatus: 'queued',
        };
        addMessage(userMessage);

        sendQueueRef.current.push({ sessionId, content, requestId });
        return null;
      }

      const beginStream = (targetSessionId: string, targetContent: string, targetRequestId: string, queued = false) => {
        const assistantMessageId = `assistant-${targetRequestId}`;
        const generation = latestStreamGenerationRef.current + 1;
        latestStreamGenerationRef.current = generation;
        currentSessionIdRef.current = targetSessionId;

        startStreaming();
        setError(null);

        if (!queued) {
          const userMessage: Message = {
            id: `user-${targetRequestId}`,
            role: 'user',
            content: targetContent,
            timestamp: new Date(),
          };
          addMessage(userMessage);
        } else {
          updateMessage(`user-${targetRequestId}`, { uiStatus: undefined });
        }

        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          uiStatus: 'streaming',
        };
        addMessage(assistantMessage);

        const controller = new AbortController();
        currentStreamControllerRef.current = controller;

        let chatCompleted = false;

        const isActive = () => (
          latestStreamGenerationRef.current === generation &&
          currentSessionIdRef.current === targetSessionId &&
          currentStreamControllerRef.current === controller &&
          controller.signal.aborted === false
        );

        const finalize = () => {
          if (currentStreamControllerRef.current === controller) {
            currentStreamControllerRef.current = null;
          }
          if (latestStreamGenerationRef.current === generation) {
            startNextFromQueue();
          }
        };

        const startNextFromQueue = () => {
          if (isDrainingQueueRef.current) return;
          if (sendQueueRef.current.length === 0) return;

          isDrainingQueueRef.current = true;
          const next = sendQueueRef.current.shift();
          isDrainingQueueRef.current = false;
          if (!next) return;

          beginStream(next.sessionId, next.content, next.requestId, true);
        };

        messageApi.sendMessage(
          targetSessionId,
          targetContent,
          (chunk) => {
            if (!isActive()) return;
            appendMessageContent(assistantMessageId, chunk);
          },
          () => {
            // assistant_done: chat reply is complete; mark message and release streaming state
            if (!isActive()) return;
            chatCompleted = true;
            updateMessage(assistantMessageId, { uiStatus: undefined, streamCompleted: true });
            completeStreaming();
          },
          () => {
            // done: chat SSE closed; finalize and drain queue
            if (!isActive()) return;
            finalize();
          },
          (error) => {
            if (!isActive()) return;
            if (!chatCompleted) {
              updateMessage(assistantMessageId, { uiStatus: 'error' });
              completeStreaming();
            }
            finalize();
            const errorMessage = error instanceof ApiClientError ? error.message : '发送失败，请重试';
            setError(errorMessage === '流式响应异常结束' ? '流式响应异常结束，请重试' : errorMessage);
          },
          () => {
            if (!isActive() && currentStreamControllerRef.current !== controller) return;
            updateMessage(assistantMessageId, {
              uiStatus: 'cancelled',
              streamCompleted: true,
            });
            appendMessageContent(assistantMessageId, '当前回复已中止，排队消息已清空。');
            completeStreaming();
            finalize();
          },
          controller
        );

        return controller;
      };

      return beginStream(sessionId, content, requestId, false);
    },
    [
      addMessage,
      appendMessageContent,
      completeStreaming,
      setError,
      startStreaming,
      updateMessage,
    ]
  );
  const loadProfileData = useCallback(
    async (sessionId: string) => {
      try {
        const profileData = await profileApi.getProfileData(sessionId);
        if (currentSessionIdRef.current === sessionId) {
          setProfileData(profileData);
        }
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
        setLoading({ analyzingProfile: true });
        setError(null);
        const profileData = await profileApi.analyzeProfile(sessionId);
        if (currentSessionIdRef.current === sessionId) {
          setProfileData(profileData);
        }
        return profileData;
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '分析信息失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading({ analyzingProfile: false });
      }
    },
    [setLoading, setError, setProfileData]
  );

  const updateProfileField = useCallback(
    async (sessionId: string, field: string, value: string) => {
      try {
        setError(null);
        const profileData = await profileApi.updateProfileField(sessionId, field, value);
        // Preserve reasoningHistory loaded from revisions; PATCH response doesn't include it.
        mergeProfileData(profileData);
        return profileData;
      } catch (error) {
        throw error;
      }
    },
    [setError, mergeProfileData]
  );

  const updateProfileFieldDefinitions = useCallback(
    async (sessionId: string, definitions: ProfileFieldDefinition[]) => {
      try {
        setError(null);
        const updated = await sessionApi.updateProfileFieldDefinitions(sessionId, definitions);
        if (currentSessionIdRef.current === sessionId) {
          setProfileFields(updated);
        }
        return updated;
      } catch (error) {
        const errorMessage = error instanceof ApiClientError ? error.message : '更新字段定义失败';
        setError(errorMessage);
        throw error;
      }
    },
    [setError, setProfileFields]
  );

  const exportPDF = useCallback(
    async (sessionId: string, filename?: string) => {
      try {
        setLoading({ exportingPdf: true });
        setError(null);
        await exportApi.downloadPDF(sessionId, filename);
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError ? error.message : '导出 PDF 失败';
        setError(errorMessage);
        throw error;
      } finally {
        setLoading({ exportingPdf: false });
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
    updateProfileFieldDefinitions,
    exportPDF,
    abortCurrentStream,
  };
}
