import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReasoningStep } from '../types';

interface ReasoningPanelProps {
  sessionId: string | null;
  reasoning: string | null;
  isStreaming?: boolean;
  reasoningHistory?: ReasoningStep[];
}

const AUTO_SCROLL_THRESHOLD = 120;

export function ReasoningPanel({
  sessionId,
  reasoning,
  isStreaming = false,
  reasoningHistory = [],
}: ReasoningPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousHistoryLengthRef = useRef(0);
  const previousSessionRef = useRef<string | null>(null);

  const hasHistory = reasoningHistory.length > 0;
  const streamingVirtualIndex = reasoningHistory.length; // 虚拟索引用于显示流式内容
  const isViewingCurrentStream = isStreaming && currentIndex >= streamingVirtualIndex;

  // 会话切换时重置索引与滚动状态
  useEffect(() => {
    if (previousSessionRef.current !== sessionId) {
      previousSessionRef.current = sessionId;
      setShouldAutoScroll(true);
      if (isStreaming) {
        setCurrentIndex(streamingVirtualIndex);
      } else if (reasoningHistory.length > 0) {
        setCurrentIndex(reasoningHistory.length - 1);
      } else {
        setCurrentIndex(0);
      }
      previousHistoryLengthRef.current = reasoningHistory.length;
    }
  }, [sessionId, isStreaming, reasoningHistory.length, streamingVirtualIndex]);

  // 流式状态变化时，自动跳到当前流
  useEffect(() => {
    if (isStreaming) {
      setCurrentIndex(streamingVirtualIndex);
    } else {
      // 流结束后若在虚拟索引，回落到最新历史项
      if (currentIndex >= streamingVirtualIndex && reasoningHistory.length > 0) {
        setCurrentIndex(reasoningHistory.length - 1);
      }
    }
  }, [isStreaming, streamingVirtualIndex, reasoningHistory.length, currentIndex]);

  // 历史长度变化时，默认展示最新一条
  useEffect(() => {
    const prevLen = previousHistoryLengthRef.current;
    const grew = reasoningHistory.length > prevLen;

    if (grew) {
      if (shouldAutoScroll || currentIndex >= prevLen) {
        setCurrentIndex(reasoningHistory.length - 1);
      }
    } else if (!hasHistory && !isStreaming) {
      setCurrentIndex(0);
    }

    // 边界修正
    if (!isStreaming && currentIndex > Math.max(reasoningHistory.length - 1, 0)) {
      setCurrentIndex(Math.max(reasoningHistory.length - 1, 0));
    }

    previousHistoryLengthRef.current = reasoningHistory.length;
  }, [currentIndex, hasHistory, isStreaming, reasoningHistory.length, shouldAutoScroll]);

  const updateAutoScrollState = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShouldAutoScroll(distanceFromBottom <= AUTO_SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    if (shouldAutoScroll && (isViewingCurrentStream || currentIndex >= reasoningHistory.length - 1)) {
      contentRef.current?.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [
    reasoning,
    currentIndex,
    reasoningHistory.length,
    isStreaming,
    isViewingCurrentStream,
    shouldAutoScroll,
  ]);

  const currentStep = hasHistory && currentIndex < reasoningHistory.length
    ? reasoningHistory[currentIndex]
    : null;

  const displayReasoningText = isStreaming
    ? reasoning
    : currentStep?.reasoningText ?? null;

  const displayFinalOutputText = currentStep?.finalOutputText ?? null;

  const displayTimestamp = !isStreaming && hasHistory && currentIndex < reasoningHistory.length
    ? reasoningHistory[currentIndex]?.timestamp
    : null;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < reasoningHistory.length - 1;
  const isViewingHistory = !isStreaming && hasHistory && currentIndex < reasoningHistory.length - 1;

  const handlePrev = () => {
    if (canGoPrev) {
      setCurrentIndex((prev) => prev - 1);
      setShouldAutoScroll(false);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setCurrentIndex((prev) => prev + 1);
      setShouldAutoScroll(false);
    }
  };

  const handleViewCurrent = () => {
    if (isStreaming) {
      setCurrentIndex(streamingVirtualIndex);
    } else if (reasoningHistory.length > 0) {
      setCurrentIndex(reasoningHistory.length - 1);
    }
    setShouldAutoScroll(true);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;

    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200/80 bg-gradient-to-r from-white to-amber-50/80 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-800">思考过程</h2>
              {isStreaming ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  正在思考
                </div>
              ) : (displayReasoningText || displayFinalOutputText) ? (
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" title="思考完成" />
              ) : null}
            </div>
            <p className="text-sm text-gray-500 mt-1">DeepSeek Reasoner 的分析思路</p>
          </div>

          {(hasHistory || isStreaming) && (
            <div className="flex items-center gap-3">
              {(isViewingHistory || (isStreaming && !shouldAutoScroll)) && (
                <button
                  onClick={handleViewCurrent}
                  className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  查看当前
                </button>
              )}
              {hasHistory && (
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-1.5">
                  <button
                    onClick={handlePrev}
                    disabled={!canGoPrev}
                    className="text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
                    title="上一个"
                  >
                    ←
                  </button>
                  <span className="text-sm text-gray-600 min-w-[60px] text-center">
                    {Math.min(currentIndex + 1, reasoningHistory.length)} / {reasoningHistory.length}
                  </span>
                  <button
                    onClick={handleNext}
                    disabled={!canGoNext}
                    className="text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
                    title="下一个"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {displayTimestamp && (
          <p className="text-xs text-gray-400 mt-2">{formatTimestamp(displayTimestamp)}</p>
        )}
      </div>

      <div
        ref={contentRef}
        onScroll={updateAutoScrollState}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-5 bg-gradient-to-b from-amber-50/40 via-white to-white"
      >
        {displayReasoningText ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">思考过程</span>
            </div>
            <div className="whitespace-pre-wrap text-gray-700 leading-7 text-sm">
              {displayReasoningText}
              {isStreaming && <span className="inline-block w-2 h-4 bg-amber-500 ml-1 animate-pulse rounded-sm" />}
            </div>
          </div>
        ) : isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-3"></div>
            <p className="text-sm">等待思考过程...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center">
              <p className="text-sm italic">暂无思考过程</p>
            </div>
          </div>
        )}
      </div>

      {/* 最终结果固定框 - 始终显示当前最新的最终结果 */}
      <div className="flex-shrink-0 border-t border-gray-200/80 bg-white">
        <div className="px-6 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">最终结果</span>
            {displayFinalOutputText && (
              <div className="h-2 w-2 rounded-full bg-green-500" title="已有最终结果" />
            )}
          </div>
          {displayFinalOutputText ? (
            <div className="text-gray-900 text-sm font-medium whitespace-pre-wrap">
              {displayFinalOutputText}
            </div>
          ) : (
            <div className="text-gray-400 text-sm italic">
              {isStreaming ? '等待生成最终结果...' : '暂无最终结果'}
            </div>
          )}
        </div>
      </div>

      {isStreaming && (
        <div className="px-6 py-3 border-t border-amber-100 bg-amber-50/80 flex-shrink-0">
          <div className="flex items-center space-x-2 text-amber-700">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-sm">DeepSeek Reasoner 正在思考...</span>
          </div>
        </div>
      )}
    </div>
  );
}
