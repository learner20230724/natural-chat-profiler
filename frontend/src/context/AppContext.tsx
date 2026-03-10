import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type {
  AppState,
  Session,
  Message,
  ProfileData,
} from '../types';

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'START_STREAMING' }
  | { type: 'COMPLETE_STREAMING' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_SESSION'; payload: string | null }
  | { type: 'SET_SESSIONS'; payload: Session[] }
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'REMOVE_SESSION'; payload: string }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'APPEND_MESSAGE_CONTENT'; payload: { messageId: string; chunk: string } }
  | { type: 'START_PROFILE_REASONING' }
  | { type: 'UPDATE_PROFILE_REASONING'; payload: string }
  | { type: 'COMPLETE_PROFILE_REASONING'; payload?: string | null; reasoning?: string | null }
  | { type: 'SET_PROFILE_DATA'; payload: ProfileData | null }
  | { type: 'MERGE_PROFILE_DATA'; payload: Partial<ProfileData> | null }
  | { type: 'RESET_SESSION' };

const emptyProfile: ProfileData = {
  sessionId: undefined,
  age: null,
  hometown: null,
  currentCity: null,
  personality: null,
  expectations: null,
  reasoning: null,
  reasoningHistory: [],
  currentReasoningDraft: null,
  currentFinalDraft: null,
  isReasoningStreaming: false,
  lastUpdated: null,
  version: 0,
};

const initialState: AppState = {
  currentSessionId: null,
  sessions: [],
  messages: [],
  profileData: emptyProfile,
  isLoading: false,
  isStreaming: false,
  activeStreamCount: 0,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'START_STREAMING': {
      const nextActiveStreamCount = state.activeStreamCount + 1;
      return {
        ...state,
        activeStreamCount: nextActiveStreamCount,
        isStreaming: nextActiveStreamCount > 0,
      };
    }
    case 'COMPLETE_STREAMING': {
      const nextActiveStreamCount = Math.max(0, state.activeStreamCount - 1);
      return {
        ...state,
        activeStreamCount: nextActiveStreamCount,
        isStreaming: nextActiveStreamCount > 0,
      };
    }
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CURRENT_SESSION':
      return { ...state, currentSessionId: action.payload };
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };
    case 'ADD_SESSION':
      return { ...state, sessions: [action.payload, ...state.sessions] };
    case 'REMOVE_SESSION': {
      const isCurrentSession = state.currentSessionId === action.payload;
      return {
        ...state,
        sessions: state.sessions.filter((session) => session.id !== action.payload),
        currentSessionId: isCurrentSession ? null : state.currentSessionId,
        messages: isCurrentSession ? [] : state.messages,
        profileData: isCurrentSession ? emptyProfile : state.profileData,
        isStreaming: isCurrentSession ? false : state.isStreaming,
        activeStreamCount: isCurrentSession ? 0 : state.activeStreamCount,
      };
    }
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'APPEND_MESSAGE_CONTENT':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.payload.messageId
            ? { ...message, content: message.content + action.payload.chunk }
            : message
        ),
      };
    case 'START_PROFILE_REASONING':
      return {
        ...state,
        profileData: {
          ...state.profileData,
          reasoning: '',
          isReasoningStreaming: true,
        },
      };
    case 'UPDATE_PROFILE_REASONING':
      return {
        ...state,
        profileData: {
          ...state.profileData,
          reasoning: (state.profileData.reasoning || '') + action.payload,
          isReasoningStreaming: true,
        },
      };
    case 'COMPLETE_PROFILE_REASONING': {
      // 优先使用 SSE 事件中传入的完整 reasoningText，否则使用流式传输累积的
      const currentReasoning = action.reasoning ?? state.profileData.reasoning;
      const finalOutputText = action.payload ?? null;
      const nextHistory = currentReasoning || finalOutputText
        ? [
            ...state.profileData.reasoningHistory,
            {
              reasoningText: currentReasoning,
              finalOutputText,
              timestamp: new Date(),
            },
          ]
        : state.profileData.reasoningHistory;

      return {
        ...state,
        profileData: {
          ...state.profileData,
          reasoning: null,
          isReasoningStreaming: false,
          reasoningHistory: nextHistory,
        },
      };
    }
    case 'SET_PROFILE_DATA':
      return {
        ...state,
        profileData: action.payload ?? emptyProfile,
      };
    case 'MERGE_PROFILE_DATA': {
      if (!action.payload) {
        return state;
      }

      return {
        ...state,
        profileData: {
          ...state.profileData,
          ...action.payload,
          reasoningHistory: state.profileData.reasoningHistory,
          currentReasoningDraft: state.profileData.currentReasoningDraft,
          currentFinalDraft: state.profileData.currentFinalDraft,
          isReasoningStreaming: state.profileData.isReasoningStreaming,
        },
      };
    }
    case 'RESET_SESSION':
      return {
        ...state,
        messages: [],
        profileData: emptyProfile,
        isStreaming: false,
        activeStreamCount: 0,
      };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setLoading: (loading: boolean) => void;
  startStreaming: () => void;
  completeStreaming: () => void;
  setError: (error: string | null) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendMessageContent: (messageId: string, chunk: string) => void;
  startProfileReasoning: () => void;
  updateProfileReasoning: (chunk: string) => void;
  completeProfileReasoning: (finalOutputText?: string | null, reasoningText?: string | null) => void;
  setProfileData: (profileData: ProfileData | null) => void;
  mergeProfileData: (profileData: Partial<ProfileData> | null) => void;
  resetSession: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const startStreaming = useCallback(() => {
    dispatch({ type: 'START_STREAMING' });
  }, []);

  const completeStreaming = useCallback(() => {
    dispatch({ type: 'COMPLETE_STREAMING' });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const setCurrentSession = useCallback((sessionId: string | null) => {
    dispatch({ type: 'SET_CURRENT_SESSION', payload: sessionId });
  }, []);

  const setSessions = useCallback((sessions: Session[]) => {
    dispatch({ type: 'SET_SESSIONS', payload: sessions });
  }, []);

  const addSession = useCallback((session: Session) => {
    dispatch({ type: 'ADD_SESSION', payload: session });
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    dispatch({ type: 'REMOVE_SESSION', payload: sessionId });
  }, []);

  const setMessages = useCallback((messages: Message[]) => {
    dispatch({ type: 'SET_MESSAGES', payload: messages });
  }, []);

  const addMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const appendMessageContent = useCallback((messageId: string, chunk: string) => {
    dispatch({ type: 'APPEND_MESSAGE_CONTENT', payload: { messageId, chunk } });
  }, []);

  const startProfileReasoning = useCallback(() => {
    dispatch({ type: 'START_PROFILE_REASONING' });
  }, []);

  const updateProfileReasoning = useCallback((chunk: string) => {
    dispatch({ type: 'UPDATE_PROFILE_REASONING', payload: chunk });
  }, []);

  const completeProfileReasoning = useCallback((finalOutputText?: string | null, reasoningText?: string | null) => {
    dispatch({ type: 'COMPLETE_PROFILE_REASONING', payload: finalOutputText, reasoning: reasoningText });
  }, []);

  const setProfileData = useCallback((profileData: ProfileData | null) => {
    dispatch({ type: 'SET_PROFILE_DATA', payload: profileData });
  }, []);

  const resetSession = useCallback(() => {
    dispatch({ type: 'RESET_SESSION' });
  }, []);

  const mergeProfileData = useCallback((profileData: Partial<ProfileData> | null) => {
    dispatch({ type: 'MERGE_PROFILE_DATA', payload: profileData });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
