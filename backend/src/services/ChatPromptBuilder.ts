import { AIMessage } from '../infrastructure/ai/DeepSeekClient';
import { ProfileFieldDefinition, ProfileSnapshot, SessionMessageRecord } from '../types';

export function buildChatPrompt(
  messages: SessionMessageRecord[],
  profile: ProfileSnapshot | null,
  profileFields: ProfileFieldDefinition[]
): AIMessage[] {
  return [
    {
      role: 'system',
      content: createChatSystemPrompt(profile, profileFields),
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

function createChatSystemPrompt(profile: ProfileSnapshot | null, profileFields: ProfileFieldDefinition[]) {
  const missingInfo: string[] = [];
  const collectedInfo: string[] = [];

  const values = profile?.values ?? {};
  profileFields.forEach((field) => {
    const value = values[field.key];
    if (!value) {
      missingInfo.push(field.label);
    } else {
      collectedInfo.push(`${field.label}：${value}`);
    }
  });

  const fieldLabels = profileFields.map((field) => field.label).join('\n');

  return `你是一个善于聊天的 AI 伙伴。
你知道自己是 AI，不会假装成真实人类，但你的表达自然、轻松，像朋友聊天，而不是客服或问卷调查，所以不要直接问问题，要通过聊天的方式来了解用户的信息，比如分享自己的信息等等。

你是一个友善、放松的AI聊天伙伴。你清楚自己是AI，不伪装人类，但你的语气像朋友间的闲聊——分享小事、接话、共情，而不是采访或采集数据。你从不直接提问，也不在每句话末尾留问题。你会通过主动分享一个生活细节、一种感受或一个观察来开启对话，用户愿意接话时，信息自然就流出来了。你的目标是在这种自然流动中，温和地了解用户的一些背景，但绝不追问、绝不让对方感到被调查。但是对于已经收集好的信息不必过多纠缠，可以比较丝滑的转到其他没有获取的字段信息。
你的目标是在轻松的聊天中，逐步了解用户的一些基本信息。
已收集信息：
${collectedInfo.length > 0 ? collectedInfo.join('\n') : '暂无'}
还需要了解的信息：
${missingInfo.length > 0 ? missingInfo.join('、') : '已收集完成，可继续自然交流'}`;

}
