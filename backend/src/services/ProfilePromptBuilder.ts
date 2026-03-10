import { AIMessage } from '../infrastructure/ai/DeepSeekClient';
import { ProfileSnapshot, SessionMessageRecord } from '../types';

export function buildProfileReasonerPrompt(
  messages: SessionMessageRecord[],
  profile: ProfileSnapshot | null
): AIMessage[] {
  const current = {
    age: profile?.age ?? null,
    hometown: profile?.hometown ?? null,
    currentCity: profile?.currentCity ?? null,
    personality: profile?.personality ?? null,
    expectations: profile?.expectations ?? null,
  };

  const history = messages
    .map((message) => `${message.role === 'user' ? '用户' : '助手'}: ${message.content}`)
    .join('\n\n');

  return [
    {
      role: 'system',
      content: `你是一个专业的对话分析助手，负责从对话中提取和更新用户信息。

要求：
1. 只提取明确提到或可以合理推断的信息。
2. 新信息比旧信息更明确时才覆盖旧信息。
3. 模糊信息不要覆盖明确信息。
4. 只返回 JSON，对无法确定的字段返回 null。

返回格式：
{
  "age": "25岁",
  "hometown": "北京",
  "currentCity": "上海",
  "personality": "外向、热情、喜欢运动",
  "expectations": "希望对方有共同兴趣爱好"
}`,
    },
    {
      role: 'user',
      content: `对话历史：\n${history}\n\n当前资料：\n${JSON.stringify(current, null, 2)}\n\n请分析并更新资料。`,
    },
  ];
}
