import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type {
  AppState,
  Session,
  Message,
  ProfileData,
  ProfileFieldDefinition,
  LoadingState,
} from '../types';

type AppAction =
  | { type: 'SET_LOADING'; payload: Partial<LoadingState> }
  | { type: 'START_STREAMING' }
  | { type: 'COMPLETE_STREAMING' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_SESSION'; payload: string | null }
  | { type: 'SET_SESSIONS'; payload: Session[] }
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'REMOVE_SESSION'; payload: string }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { messageId: string; updates: Partial<Message> } }
  | { type: 'REMOVE_MESSAGES'; payload: string[] }
  | { type: 'APPEND_MESSAGE_CONTENT'; payload: { messageId: string; chunk: string } }
  | { type: 'START_PROFILE_REASONING' }
  | { type: 'UPDATE_PROFILE_REASONING'; payload: string }
  | { type: 'COMPLETE_PROFILE_REASONING'; payload?: string | null; reasoning?: string | null }
  | { type: 'SET_PROFILE_DATA'; payload: ProfileData | null }
  | { type: 'MERGE_PROFILE_DATA'; payload: Partial<ProfileData> | null }
  | { type: 'SET_PROFILE_FIELDS'; payload: ProfileFieldDefinition[] }
  | { type: 'MERGE_PROFILE_FIELDS'; payload: ProfileFieldDefinition[] }
  | { type: 'RESET_SESSION' };

const emptyProfile: ProfileData = {
  sessionId: undefined,
  values: {},
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
  profileFieldDefinitions: [],
  loading: {
    sessions: false,
    sessionDetail: false,
    creatingSession: false,
    deletingSessionId: null,
    clearingAllData: false,
    exportingPdf: false,
    analyzingProfile: false,
  },
  isLoading: false,
  isStreaming: false,
  activeStreamCount: 0,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING': {
      const nextLoading = {
        ...state.loading,
        ...action.payload,
      };
      const isLoading = Object.values(nextLoading).some((value) =>
        typeof value === 'boolean' ? value : value !== null
      );
      return { ...state, loading: nextLoading, isLoading };
    }
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
        profileFieldDefinitions: isCurrentSession ? [] : state.profileFieldDefinitions,
        isStreaming: isCurrentSession ? false : state.isStreaming,
        activeStreamCount: isCurrentSession ? 0 : state.activeStreamCount,
      };
    }
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.payload.messageId
            ? { ...message, ...action.payload.updates }
            : message
        ),
      };
    case 'REMOVE_MESSAGES':
      return {
        ...state,
        messages: state.messages.filter((message) => !action.payload.includes(message.id)),
      };
    case 'APPEND_MESSAGE_CONTENT':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.payload.messageId
            ? {
                ...message,
                content: message.content + action.payload.chunk,
              }
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
    case 'SET_PROFILE_FIELDS':
      return {
        ...state,
        profileFieldDefinitions: action.payload,
      };
    case 'MERGE_PROFILE_FIELDS':
      return {
        ...state,
        profileFieldDefinitions: action.payload,
      };
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
          values: action.payload.values
            ? { ...state.profileData.values, ...action.payload.values }
            : state.profileData.values,
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
        profileFieldDefinitions: [],
        isStreaming: false,
        activeStreamCount: 0,
      };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  setLoading: (loading: Partial<LoadingState>) => void;
  startStreaming: () => void;
  completeStreaming: () => void;
  setError: (error: string | null) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessages: (messageIds: string[]) => void;
  appendMessageContent: (messageId: string, chunk: string) => void;
  startProfileReasoning: () => void;
  updateProfileReasoning: (chunk: string) => void;
  completeProfileReasoning: (finalOutputText?: string | null, reasoningText?: string | null) => void;
  setProfileData: (profileData: ProfileData | null) => void;
  mergeProfileData: (profileData: Partial<ProfileData> | null) => void;
  setProfileFields: (definitions: ProfileFieldDefinition[]) => void;
  mergeProfileFields: (definitions: ProfileFieldDefinition[]) => void;
  resetSession: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setLoading = useCallback((loading: Partial<LoadingState>) => {
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

  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId, updates } });
  }, []);

  const removeMessages = useCallback((messageIds: string[]) => {
    dispatch({ type: 'REMOVE_MESSAGES', payload: messageIds });
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
    dispatch({
      type: 'COMPLETE_PROFILE_REASONING',
      payload: finalOutputText,
      reasoning: reasoningText,
    });
  }, []);

  const setProfileData = useCallback((profileData: ProfileData | null) => {
    dispatch({ type: 'SET_PROFILE_DATA', payload: profileData });
  }, []);

  const mergeProfileData = useCallback((profileData: Partial<ProfileData> | null) => {
    dispatch({ type: 'MERGE_PROFILE_DATA', payload: profileData });
  }, []);

  const setProfileFields = useCallback((definitions: ProfileFieldDefinition[]) => {
    dispatch({ type: 'SET_PROFILE_FIELDS', payload: definitions });
  }, []);

  const mergeProfileFields = useCallback((definitions: ProfileFieldDefinition[]) => {
    dispatch({ type: 'MERGE_PROFILE_FIELDS', payload: definitions });
  }, []);

  const resetSession = useCallback(() => {
    dispatch({ type: 'RESET_SESSION' });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
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
        mergeProfileFields,
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
