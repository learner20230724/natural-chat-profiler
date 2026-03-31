import { DeepSeekClient } from '../infrastructure/ai/DeepSeekClient';
import { ProfileSnapshot, SessionMessageRecord } from '../types';

export class SessionTitleService {
  constructor(private readonly aiClient: DeepSeekClient) {}

  async generateTitle(messages: SessionMessageRecord[], profile: ProfileSnapshot | null) {
    if (messages.length === 0) {
      return null;
    }

    const conversationSample = messages
      .slice(0, 12)
      .map((message) => `${message.role === 'user' ? '用户' : '助手'}: ${message.content}`)
      .join('\n');

    const profileSummary = profile
      ? Object.values(profile.values || {})
          .filter((value) => value)
          .map((value, index) => `信息${index + 1}: ${value}`)
          .join('\n')
      : '';

    return this.aiClient.createSessionTitle([
      {
        role: 'system',
        content: '根据对话内容和用户信息生成一个简短标题（5-10个字）。只返回标题文本。',
      },
      {
        role: 'user',
        content: `对话内容：\n${conversationSample}${profileSummary ? `\n\n用户信息：\n${profileSummary}` : ''}`,
      },
    ]);
  }
}
