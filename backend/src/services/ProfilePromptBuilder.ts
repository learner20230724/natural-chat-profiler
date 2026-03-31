import { AIMessage } from '../infrastructure/ai/DeepSeekClient';
import { ProfileFieldDefinition, ProfileSnapshot, SessionMessageRecord } from '../types';

export function buildProfileReasonerPrompt(
  messages: SessionMessageRecord[],
  profile: ProfileSnapshot | null,
  profileFields: ProfileFieldDefinition[]
): AIMessage[] {
  const current = profile?.values ?? {};
  const history = messages
    .map((message) => `${message.role === 'user' ? '用户' : '助手'}: ${message.content}`)
    .join('\n\n');

  const fieldDefinitions = profileFields
    .map((field) => {
      const hint = field.promptHint ? `（提示：${field.promptHint}）` : '';
      return `- ${field.key}：${field.label}${hint}`;
    })
    .join('\n');

  const outputSchema = profileFields
    .map((field) => `  "${field.key}": null`)
    .join(',\n');

  return [
    {
      role: 'system',
      content: `你是一个专业的对话分析助手，负责从对话中提取和更新用户信息。

要求：
1. 只提取明确提到或可以合理推断的信息。
2. 新信息比旧信息更明确时才覆盖旧信息。
3. 模糊信息不要覆盖明确信息。
4. 只返回 JSON，key 必须严格来自字段定义列表，对无法确定的字段返回 null。

字段定义：
${fieldDefinitions}

返回格式示例：
{
${outputSchema}
}`,
    },
    {
      role: 'user',
      content: `对话历史：\n${history}\n\n当前资料：\n${JSON.stringify(current, null, 2)}\n\n请分析并更新资料。`,
    },
  ];
}
