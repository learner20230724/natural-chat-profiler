import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProfileData, ProfileFieldDefinition } from '../types';

interface ProfilePanelProps {
  profileData: ProfileData;
  fieldDefinitions: ProfileFieldDefinition[];
  isUpdating?: boolean;
  onUpdateField?: (field: string, value: string) => Promise<void> | void;
  onUpdateFieldDefinitions?: (definitions: ProfileFieldDefinition[]) => Promise<void> | void;
}

export function ProfilePanel({
  profileData,
  fieldDefinitions,
  isUpdating = false,
  onUpdateField,
  onUpdateFieldDefinitions,
}: ProfilePanelProps) {
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const previousValuesRef = useRef<Record<string, string | null>>(profileData.values);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const [isManagingFields, setIsManagingFields] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [addFieldError, setAddFieldError] = useState<string | null>(null);
  const [savingDefinitions, setSavingDefinitions] = useState(false);

  const resolvedFields = useMemo(() => {
    if (fieldDefinitions.length > 0) {
      return fieldDefinitions;
    }

    return Object.keys(profileData.values).map((key) => ({
      key,
      label: key,
      placeholder: '待了解',
      promptHint: null,
    }));
  }, [fieldDefinitions, profileData.values]);

  useEffect(() => {
    const changedFields = new Set<string>();

    resolvedFields.forEach(({ key }) => {
      const nextValue = profileData.values[key];
      const previousValue = previousValuesRef.current[key];
      if (nextValue !== previousValue && nextValue !== null) {
        changedFields.add(key);
      }
    });

    previousValuesRef.current = profileData.values;

    if (changedFields.size > 0) {
      setHighlightedFields(changedFields);
      const timer = setTimeout(() => setHighlightedFields(new Set()), 2000);
      return () => clearTimeout(timer);
    }
  }, [profileData.values, resolvedFields]);

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
    setFieldErrors((prev) => ({ ...prev, [key]: null }));
  };

  const saveEdit = async (key: string) => {
    if (!onUpdateField) {
      setEditingField(null);
      setEditValue('');
      return;
    }

    try {
      setSavingField(key);
      setFieldErrors((prev) => ({ ...prev, [key]: null }));
      await onUpdateField(key, editValue.trim());
      setEditingField(null);
      setEditValue('');
    } catch {
      setFieldErrors((prev) => ({ ...prev, [key]: '保存失败，请重试' }));
    } finally {
      setSavingField(null);
    }
  };

  const clearField = async (key: string) => {
    if (!onUpdateField) return;

    try {
      setSavingField(key);
      setFieldErrors((prev) => ({ ...prev, [key]: null }));
      await onUpdateField(key, '');
      if (editingField === key) {
        setEditingField(null);
        setEditValue('');
      }
    } catch {
      setFieldErrors((prev) => ({ ...prev, [key]: '清空失败，请重试' }));
    } finally {
      setSavingField(null);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>, key: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await saveEdit(key);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const hasFields = resolvedFields.length > 0;

  const addField = async () => {
    const label = newFieldLabel.trim();
    if (!label) {
      setAddFieldError('字段名称不能为空');
      return;
    }
    const key = `field_${Date.now()}`;
    if (resolvedFields.some((f) => f.key === key)) {
      setAddFieldError('请重试');
      return;
    }
    const newDefs: ProfileFieldDefinition[] = [
      ...resolvedFields,
      { key, label, placeholder: null, promptHint: null },
    ];
    try {
      setSavingDefinitions(true);
      setAddFieldError(null);
      await onUpdateFieldDefinitions?.(newDefs);
      setNewFieldLabel('');
    } catch {
      setAddFieldError('保存失败，请重试');
    } finally {
      setSavingDefinitions(false);
    }
  };

  const deleteField = async (key: string) => {
    const newDefs = resolvedFields.filter((f) => f.key !== key);
    if (newDefs.length === 0) {
      return; // keep at least one field
    }
    try {
      setSavingDefinitions(true);
      await onUpdateFieldDefinitions?.(newDefs);
    } catch {
      // ignore
    } finally {
      setSavingDefinitions(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">用户信息表格</h2>
            <p className="text-sm text-gray-500 mt-1">{formatLastUpdated(profileData.lastUpdated)}</p>
          </div>
          {onUpdateFieldDefinitions && (
            <button
              type="button"
              onClick={() => setIsManagingFields((v) => !v)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                isManagingFields
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              管理字段
            </button>
          )}
        </div>
      </div>

      {isManagingFields && onUpdateFieldDefinitions && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
          <p className="text-xs text-gray-500">添加或删除字段后，AI 对话指令和画像提取将自动更新。</p>
          <div className="space-y-2">
            {resolvedFields.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-mono text-gray-600 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{key}</span>
                <span className="flex-1 text-gray-700">{label}</span>
                <button
                  type="button"
                  onClick={() => void deleteField(key)}
                  disabled={savingDefinitions || resolvedFields.length <= 1}
                  className="text-red-500 hover:text-red-700 text-xs disabled:text-gray-300 px-2 py-1"
                  title={resolvedFields.length <= 1 ? '至少保留一个字段' : '删除'}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-start flex-wrap">
            <input
              type="text"
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="字段名称"
              className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => void addField()}
              disabled={savingDefinitions}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-blue-300 whitespace-nowrap"
            >
              {savingDefinitions ? '保存中...' : '添加'}
            </button>
          </div>
          {addFieldError && <p className="text-xs text-red-500">{addFieldError}</p>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {!hasFields ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
            当前会话还没有可展示的画像字段定义。
          </div>
        ) : (
          <div className="space-y-4">
            {resolvedFields.map(({ key, label, placeholder, promptHint }) => {
              const value = profileData.values[key];
              const isHighlighted = highlightedFields.has(key);
              const hasValue = value !== null && value !== undefined && value !== '';
              const isEditing = editingField === key;
              const isSaving = savingField === key;
              const helperText = fieldErrors[key];
              const resolvedPlaceholder = placeholder?.trim() || promptHint?.trim() || '待了解';

              return (
                <div
                  key={key}
                  className={`p-4 rounded-lg border transition-all duration-500 ${
                    isHighlighted ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-gray-200 bg-gray-50'
                  } ${isUpdating ? 'opacity-75' : 'opacity-100'}`}
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-gray-700">{label}</label>
                      {isSaving && <span className="text-xs text-blue-600">保存中...</span>}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => void handleKeyPress(e, key)}
                          className="w-full px-3 py-2 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                          placeholder={resolvedPlaceholder}
                          autoFocus
                          disabled={isSaving}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void saveEdit(key)}
                            disabled={isSaving}
                            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:bg-blue-300"
                          >
                            {isSaving ? '保存中...' : '保存'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void clearField(key)}
                            disabled={isSaving}
                            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 text-sm disabled:bg-gray-100"
                          >
                            清空
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm disabled:bg-gray-200"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between group gap-3">
                        <div
                          className={`text-base transition-colors duration-300 flex-1 ${
                            hasValue ? 'text-gray-900' : 'text-gray-400 italic'
                          }`}
                        >
                          {hasValue ? value : resolvedPlaceholder}
                        </div>
                        {onUpdateField && (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startEditing(key, value)}
                              className="px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
                              title="编辑"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => void clearField(key)}
                              disabled={!hasValue || isSaving}
                              className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 disabled:text-gray-300"
                              title="清空"
                            >
                              清空
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {helperText && <div className="text-xs text-red-500">{helperText}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
