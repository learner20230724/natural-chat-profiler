/**
 * ProfilePanel Component
 * Displays extracted user profile information in a table format
 * Updates in real-time as information is extracted from conversations
 */

import { useEffect, useState } from 'react';
import type { ProfileData } from '../types';

interface ProfilePanelProps {
  profileData: ProfileData;
  isUpdating?: boolean;
  onUpdateField?: (
    field: keyof Omit<ProfileData, 'lastUpdated' | 'reasoning' | 'reasoningHistory' | 'isReasoningStreaming' | 'version' | 'sessionId'>,
    value: string
  ) => void;
}

interface ProfileField {
  key: keyof Omit<ProfileData, 'lastUpdated' | 'reasoning' | 'reasoningHistory' | 'isReasoningStreaming' | 'version' | 'sessionId'>;
  label: string;
  placeholder: string;
}

const PROFILE_FIELDS: ProfileField[] = [
  { key: 'age', label: '年龄', placeholder: '待了解' },
  { key: 'hometown', label: '家庭所在城市', placeholder: '待了解' },
  { key: 'currentCity', label: '现居城市', placeholder: '待了解' },
  { key: 'personality', label: '性格特征', placeholder: '待了解' },
  { key: 'expectations', label: '期待的对象特征', placeholder: '待了解' },
];

export function ProfilePanel({ profileData, isUpdating = false, onUpdateField }: ProfilePanelProps) {
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const [previousData, setPreviousData] = useState<ProfileData>(profileData);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const changedFields = new Set<string>();

    PROFILE_FIELDS.forEach(({ key }) => {
      if (profileData[key] !== previousData[key] && profileData[key] !== null) {
        changedFields.add(key);
      }
    });

    if (changedFields.size > 0) {
      setHighlightedFields(changedFields);
      const timer = setTimeout(() => setHighlightedFields(new Set()), 2000);
      setPreviousData(profileData);
      return () => clearTimeout(timer);
    }
  }, [profileData, previousData]);

  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return '暂无更新';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return '刚刚更新';
    if (minutes < 60) return `${minutes} 分钟前更新`;
    if (hours < 24) return `${hours} 小时前更新`;

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const startEditing = (key: string, currentValue: string | null | undefined) => {
    setEditingField(key);
    setEditValue(currentValue || '');
  };

  const saveEdit = (
    key: keyof Omit<ProfileData, 'lastUpdated' | 'reasoning' | 'reasoningHistory' | 'isReasoningStreaming' | 'version' | 'sessionId'>
  ) => {
    if (onUpdateField && editValue.trim()) {
      onUpdateField(key, editValue.trim());
    }
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyPress = (
    e: React.KeyboardEvent,
    key: keyof Omit<ProfileData, 'lastUpdated' | 'reasoning' | 'reasoningHistory' | 'isReasoningStreaming' | 'version' | 'sessionId'>
  ) => {
    if (e.key === 'Enter') {
      saveEdit(key);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">用户信息表格</h2>
        <p className="text-sm text-gray-500 mt-1">{formatLastUpdated(profileData.lastUpdated)}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <div className="space-y-4">
          {PROFILE_FIELDS.map(({ key, label, placeholder }) => {
            const value = profileData[key] as string | null;
            const isHighlighted = highlightedFields.has(key);
            const hasValue = value !== null && value !== '';

            return (
              <div
                key={key}
                className={`p-4 rounded-lg border transition-all duration-500 ${
                  isHighlighted ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-gray-200 bg-gray-50'
                } ${isUpdating ? 'opacity-75' : 'opacity-100'}`}
              >
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">{label}</label>

                  {editingField === key ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, key)}
                        className="flex-1 px-3 py-2 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={placeholder}
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(key)}
                        className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group">
                      <div className={`text-base transition-colors duration-300 flex-1 ${hasValue ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                        {hasValue ? value : placeholder}
                      </div>
                      {onUpdateField && (
                        <button
                          onClick={() => startEditing(key, value)}
                          className="ml-2 px-2 py-1 text-sm text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="编辑"
                        >
                          编辑
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isUpdating && (
        <div className="px-6 py-3 border-t border-gray-200 bg-blue-50 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-600">正在分析对话内容...</span>
          </div>
        </div>
      )}
    </div>
  );
}
