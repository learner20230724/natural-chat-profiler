import { SessionRecord } from '../types';

export function buildSessionPreview(session: SessionRecord) {
  if (session.title?.trim()) {
    return session.title.trim();
  }

  return `新会话 · ${session.createdAt.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
