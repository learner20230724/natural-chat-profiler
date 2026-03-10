import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import type { Message } from '../types';

interface ChatPanelProps {
  sessionId: string | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isStreaming: boolean;
}

const AUTO_SCROLL_THRESHOLD = 120;

const MessageItem = memo(({ message }: { message: Message }) => {
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ring-1 ${
          message.role === 'user'
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-blue-300/60'
            : 'bg-white text-gray-800 ring-gray-200'
        }`}
      >
        <div className="whitespace-pre-wrap break-words leading-7">{message.content}</div>
        <div
          className={`text-[11px] mt-2 ${
            message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
          }`}
        >
          {formatTimestamp(message.timestamp)}
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
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200/80 bg-gradient-to-r from-white to-blue-50/70 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">对话</h2>
            <p className="text-sm text-gray-500 mt-1">
              {sessionId ? '可以一边等待回复，一边继续输入下一句。' : '请先创建或选择一个会话'}
            </p>
          </div>
          {isStreaming && (
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              回复生成中
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={updateAutoScrollState}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4 bg-gradient-to-b from-slate-50/60 via-white to-white"
      >
        {messages.length === 0 && sessionId && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 px-6 py-8 text-center text-gray-500">
            <p className="text-lg font-medium text-gray-700 mb-2">你好，开始聊天吧</p>
            <p className="text-sm leading-6">系统会在右侧同步展示信息提取和思考过程，你可以连续自然地聊下去。</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-gray-100 px-4 py-3 shadow-sm ring-1 ring-gray-200">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200/80 bg-white/90 px-6 py-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
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
            发送
          </button>
        </form>
      </div>
    </div>
  );
});
