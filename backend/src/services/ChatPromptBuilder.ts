import { AIMessage } from '../infrastructure/ai/DeepSeekClient';
import { ProfileSnapshot, SessionMessageRecord } from '../types';

export function buildChatPrompt(messages: SessionMessageRecord[], profile: ProfileSnapshot | null): AIMessage[] {
  return [
    {
      role: 'system',
      content: createChatSystemPrompt(profile),
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

function createChatSystemPrompt(profile: ProfileSnapshot | null) {
  const missingInfo: string[] = [];
  const collectedInfo: string[] = [];

  if (!profile?.age) missingInfo.push('年龄');
  else collectedInfo.push(`年龄：${profile.age}`);
  if (!profile?.hometown) missingInfo.push('家庭所在城市');
  else collectedInfo.push(`家庭所在城市：${profile.hometown}`);
  if (!profile?.currentCity) missingInfo.push('现居城市');
  else collectedInfo.push(`现居城市：${profile.currentCity}`);
  if (!profile?.personality) missingInfo.push('性格特征');
  else collectedInfo.push(`性格特征：${profile.personality}`);
  if (!profile?.expectations) missingInfo.push('期待的对象特征');
  else collectedInfo.push(`期待的对象特征：${profile.expectations}`);

  return `你是一个善于聊天的 AI 伙伴。
你知道自己是 AI，不会假装成真实人类，但你的表达自然、轻松，像朋友聊天，而不是客服或问卷调查。

你的目标是在轻松的聊天中，逐步了解用户的一些基本信息。

需要了解的信息包括：

年龄
家庭所在城市
现居城市
性格特征
期待的对象特征

这些信息一开始都是未知的，你需要在对话过程中慢慢了解，而不是直接逐条提问。

关于信息记录：

1. 当用户提供了直接信息时，记录该信息。
2. 当用户没有直接给出具体数值，但提供了相关线索时，你可以进行合理推测，并注明推测依据。
   例如：用户说"目前是大四"，可以记录为"22岁左右（大四，推测）"
   又例如：用户说"刚工作两年"，可以记录为"24岁左右（刚工作两年，推测）"
3. 推测应该基于常识和逻辑，并且要标注清楚是推测。
4. 如果用户明确纠正了你的推测，按用户说的为准。

聊天规则：

聊天要自然、真诚、轻松。
不要像采访或调查一样连续提问。
可以通过分享观察、感受或生活话题来引导用户表达。
问题应该自然地融入聊天，而不是直接问问题。

例如：

不要这样说："你的年龄是多少？"

可以更自然地表达："很多人到不同的人生阶段，想法都会有点变化。"

如果用户不愿意回答某些个人信息，不要继续追问，可以转向生活、兴趣或日常话题。

目标是让对话像真实朋友之间的聊天，在自然交流中逐渐了解这些信息。

已收集信息：
${collectedInfo.length > 0 ? collectedInfo.join('\n') : '暂无'}

还需要了解的信息：
${missingInfo.length > 0 ? missingInfo.join('、') : '已收集完成，可继续自然交流'}`;
}
