import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import type { Message } from '../types';

interface ChatPanelProps {
  sessionId: string | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isStreaming: boolean;
  onAbortStream?: () => void;
  onCreateSession?: () => void;
}

const AUTO_SCROLL_THRESHOLD = 120;

const MessageItem = memo(({ message }: { message: Message }) => {
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatus = () => {
    if (message.uiStatus === 'queued') {
      return '排队中';
    }
    if (message.uiStatus === 'streaming') {
      return message.role === 'assistant' ? '生成中' : '发送中';
    }
    if (message.uiStatus === 'cancelled') {
      return '已中止';
    }
    if (message.uiStatus === 'error') {
      return '异常结束';
    }
    return null;
  };

  const statusText = renderStatus();

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ring-1 ${
          message.role === 'user'
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-blue-300/60'
            : 'bg-white text-gray-800 ring-gray-200'
        }`}
      >
        <div className="whitespace-pre-wrap break-words leading-7 min-h-[1.75rem]">
          {message.content || (message.uiStatus === 'streaming' && message.role === 'assistant' ? (
            <span className="inline-flex items-center gap-2 text-gray-400">
              <span className="flex space-x-1">
                <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0.2s' }} />
              </span>
              正在生成回复
            </span>
          ) : null)}
        </div>
        <div
          className={`mt-2 flex items-center gap-2 text-[11px] ${
            message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
          }`}
        >
          <span>{formatTimestamp(message.timestamp)}</span>
          {statusText && (
            <>
              <span>•</span>
              <span>{statusText}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export const ChatPanel = memo(function ChatPanel({
  sessionId,
  messages,
  onSendMessage,
  isStreaming,
  onAbortStream,
  onCreateSession,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasQueuedMessages = messages.some((message) => message.role === 'user' && message.uiStatus === 'queued');

  const updateAutoScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShouldAutoScroll(distanceFromBottom <= AUTO_SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, shouldAutoScroll]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedValue = inputValue.trim();
      if (!trimmedValue || !sessionId) {
        return;
      }

      onSendMessage(trimmedValue);
      setInputValue('');
      setShouldAutoScroll(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
    [inputValue, sessionId, onSendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (isComposing || (e.nativeEvent as unknown as { isComposing?: boolean })?.isComposing) {
          return;
        }
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit, isComposing]
  );

  const handleAbort = useCallback(() => {
    if (onAbortStream) {
      onAbortStream();
    }
  }, [onAbortStream]);

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200/80 bg-gradient-to-r from-white to-blue-50/70 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">对话</h2>
            <p className="text-sm text-gray-500 mt-1">
              {sessionId
                ? isStreaming
                  ? '当前回复生成中，可继续输入，新的消息会自动排队发送。'
                  : '可以一边等待回复，一边继续输入下一句。'
                : '请先创建或选择一个会话'}
            </p>
          </div>
          {isStreaming && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                {hasQueuedMessages ? '队列处理中' : '回复生成中'}
              </div>
              {onAbortStream && (
                <button
                  type="button"
                  onClick={handleAbort}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 px-3 py-1 rounded-full border border-blue-200 hover:border-blue-300 bg-white"
                >
                  中止
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={updateAutoScrollState}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4 bg-gradient-to-b from-slate-50/60 via-white to-white"
      >
        {!sessionId ? (
          <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center rounded-3xl border border-dashed border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 px-8 py-12 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 ring-1 ring-blue-200">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 3V8a2 2 0 012-2z" />
              </svg>
            </div>
            <p className="mt-5 text-2xl font-semibold text-gray-800">当前还没有打开的会话</p>
            <p className="mt-3 max-w-md text-sm leading-7 text-gray-500">
              先新建一个会话，随后即可在这里连续聊天，并在右侧查看画像提取和思考过程。
            </p>
            {onCreateSession && (
              <button
                type="button"
                onClick={onCreateSession}
                className="mt-6 inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                新建会话开始聊天
              </button>
            )}
          </div>
        ) : messages.length === 0 && sessionId && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 px-6 py-8 text-center text-gray-500">
            <p className="text-lg font-medium text-gray-700 mb-2">你好，开始聊天吧</p>
            <p className="text-sm leading-6">系统会在右侧同步展示信息提取和思考过程，你可以连续自然地聊下去。</p>
          </div>
        )}

        {isStreaming && hasQueuedMessages && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-700 shadow-sm">
            正在生成上一条回复，新的消息会自动排队发送。
          </div>
        )}

        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200/80 bg-white/90 px-6 py-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isStreaming && hasQueuedMessages && (
            <div className="text-xs text-gray-500">排队中的消息会在当前回复结束后自动发送。</div>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder={sessionId ? '输入消息... (Enter 发送, Shift+Enter 换行)' : '请先创建或选择一个会话'}
                disabled={!sessionId}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-gray-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                rows={1}
                style={{ maxHeight: '150px' }}
              />
            </div>
            <button
              type="submit"
              disabled={!sessionId || !inputValue.trim()}
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isStreaming ? '加入队列' : '发送'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
