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
      ? [
          profile.age ? `年龄: ${profile.age}` : null,
          profile.hometown ? `家乡: ${profile.hometown}` : null,
          profile.currentCity ? `现居地: ${profile.currentCity}` : null,
          profile.personality ? `性格: ${profile.personality}` : null,
          profile.expectations ? `期待: ${profile.expectations}` : null,
        ]
          .filter(Boolean)
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
