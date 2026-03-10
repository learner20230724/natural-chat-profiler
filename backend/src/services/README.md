# Backend Services

## Overview

`backend/src/services` 现在只保留应用层服务与 prompt/title/PDF 相关逻辑，不再承担数据库连接、建表或底层 DAO 职责。

新的职责划分是：

- **app/**：启动与依赖装配
- **domain/**：纯规则与策略
- **infrastructure/**：MySQL / DeepSeek / Repository 等外部依赖
- **services/**：应用服务与流程编排
- **routes/**：HTTP 路由与响应输出

## Current services

### `ChatService`

位置：`backend/src/services/ChatService.ts`

职责：
- 校验会话存在
- 保存用户消息
- 装载消息上下文与当前 profile
- 调用 `DeepSeekClient` 进行聊天流式输出
- 保存 assistant 消息
- 驱动后续 profile 自动分析触发所需的会话状态更新

依赖：
- `SessionRepository`
- `MessageRepository`
- `ProfileRepository`
- `SummaryRepository`
- `DeepSeekClient`

### `ProfileService`

位置：`backend/src/services/ProfileService.ts`

职责：
- 获取当前 profile
- 手动更新 profile
- 手动 / 自动触发 reasoner 分析
- 根据数据库中的会话状态判断是否应自动触发分析
- 写入 `session_profiles` / `profile_revisions` / `reasoner_jobs`

依赖：
- `SessionRepository`
- `MessageRepository`
- `ProfileRepository`
- `ReasonerJobRepository`
- `DeepSeekClient`

说明：
- 旧版基于内存 Map 的 message counter / timer 已移除
- 触发状态持久化在 `sessions` 与 `reasoner_jobs` 中

### `SessionService`

位置：`backend/src/services/SessionService.ts`

职责：
- 创建会话
- 列出会话
- 获取会话详情
- 删除单会话
- 清空全部数据
- 基于消息与 profile 生成会话标题

依赖：
- `SessionRepository`
- `MessageRepository`
- `ProfileRepository`
- `PrivacyEventRepository`
- `SessionTitleService`

### `PDFService`

位置：`backend/src/services/PDFService.ts`

职责：
- 从会话快照与 profile 快照生成 PDF
- 保持导出布局独立于路由层

### `SessionTitleService`

位置：`backend/src/services/SessionTitleService.ts`

职责：
- 基于对话消息和 profile 信息生成简短标题
- 将“标题生成”从通用 AI client 与 session 生命周期逻辑中拆出

依赖：
- `DeepSeekClient`

### `ChatPromptBuilder`

位置：`backend/src/services/ChatPromptBuilder.ts`

职责：
- 构造聊天系统提示词
- 将当前已收集 / 未收集的 profile 信息纳入聊天 prompt

### `ProfilePromptBuilder`

位置：`backend/src/services/ProfilePromptBuilder.ts`

职责：
- 构造 reasoner 分析 prompt
- 将完整对话历史与当前 profile 快照一起提供给分析模型

## Removed legacy services

以下旧实现已移除，不应再引用：

- `DatabaseService`
- `DeepSeekService`

对应职责已分别迁移到：

- `infrastructure/db/*`
- `infrastructure/repositories/*`
- `infrastructure/ai/DeepSeekClient.ts`

## Environment variables

后端仍使用以下环境变量：

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=natural_chat_profiler
PORT=3001
```

## Related files

- App bootstrap: `backend/src/index.ts`
- Container: `backend/src/app/container.ts`
- Express app: `backend/src/app/createApp.ts`
- Schema init: `backend/src/infrastructure/db/schema.ts`
- Type definitions: `backend/src/types/index.ts`
