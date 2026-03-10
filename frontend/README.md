# 自然聊天信息提取器 - 前端

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具和开发服务器
- **Tailwind CSS** - 样式框架

## 项目结构

```
frontend/
├── src/
│   ├── api/              # API 客户端
│   │   ├── client.ts     # HTTP 和 SSE 请求封装
│   │   └── index.ts      # API 导出
│   ├── context/          # 全局状态管理
│   │   └── AppContext.tsx # React Context 状态管理
│   ├── hooks/            # 自定义 Hooks
│   │   ├── useApi.ts     # API 操作 Hook
│   │   └── index.ts      # Hooks 导出
│   ├── types/            # TypeScript 类型定义
│   │   └── index.ts      # 所有接口定义
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # 应用入口
│   └── index.css         # 全局样式
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 核心功能

### 1. TypeScript 接口定义

所有数据类型都在 `src/types/index.ts` 中定义：

- `Message` - 聊天消息
- `ProfileData` - 用户信息数据
- `Session` - 会话信息
- `SessionDetail` - 会话详情
- `AppState` - 应用全局状态

### 2. API 客户端

`src/api/client.ts` 提供完整的 API 调用封装：

#### 会话管理 (sessionApi)
- `createSession()` - 创建新会话
- `listSessions()` - 获取会话列表
- `getSession(sessionId)` - 获取会话详情
- `deleteSession(sessionId)` - 删除会话

#### 消息管理 (messageApi)
- `getMessages(sessionId)` - 获取消息历史
- `sendMessage(sessionId, content, callbacks)` - 发送消息并接收流式响应

#### 信息提取 (profileApi)
- `getProfileData(sessionId)` - 获取 Profile 数据
- `analyzeProfile(sessionId)` - 手动触发信息分析

#### 导出功能 (exportApi)
- `exportPDF(sessionId)` - 导出 PDF
- `downloadPDF(sessionId, filename)` - 下载 PDF 文件

#### 特性
- ✅ 自动处理 HTTP 错误
- ✅ SSE (Server-Sent Events) 流式响应支持
- ✅ 自动日期类型转换
- ✅ 统一的错误处理 (ApiClientError)
- ✅ 支持请求取消 (AbortController)

### 3. 全局状态管理

使用 React Context API 实现全局状态管理：

#### AppContext 提供的状态
- `currentSessionId` - 当前会话 ID
- `sessions` - 会话列表
- `messages` - 当前会话消息
- `profileData` - 当前会话的 Profile 数据
- `isLoading` - 加载状态
- `isStreaming` - 流式传输状态
- `error` - 错误信息

#### 状态操作方法
- `setCurrentSession()` - 设置当前会话
- `setSessions()` - 设置会话列表
- `addSession()` - 添加新会话
- `removeSession()` - 删除会话
- `setMessages()` - 设置消息列表
- `addMessage()` - 添加新消息
- `updateLastMessage()` - 更新最后一条消息（用于流式显示）
- `setProfileData()` - 设置 Profile 数据
- `resetSession()` - 重置会话状态

### 4. 自定义 Hooks

#### useApi Hook

`src/hooks/useApi.ts` 提供集成了状态管理的 API 操作：

```typescript
const {
  createSession,      // 创建新会话
  loadSessions,       // 加载会话列表
  loadSession,        // 加载特定会话
  deleteSession,      // 删除会话
  sendMessage,        // 发送消息
  loadProfileData,    // 加载 Profile 数据
  analyzeProfile,     // 分析 Profile
  exportPDF,          // 导出 PDF
} = useApi();
```

所有操作自动处理：
- 加载状态更新
- 错误处理和显示
- 状态同步

## 开发指南

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

开发服务器将在 http://localhost:3000 启动，并自动代理 `/api` 请求到后端 (http://localhost:3001)。

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

### 代码格式化

```bash
npm run format
```

## 使用示例

### 在组件中使用 API

```typescript
import { useAppContext } from './context/AppContext';
import { useApi } from './hooks/useApi';

function MyComponent() {
  const { state } = useAppContext();
  const { createSession, sendMessage } = useApi();

  const handleCreateSession = async () => {
    try {
      const sessionId = await createSession();
      console.log('Created session:', sessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!state.currentSessionId) return;
    
    const abortController = sendMessage(
      state.currentSessionId,
      content
    );
    
    // 可以取消请求
    // abortController.abort();
  };

  return (
    <div>
      {state.isLoading && <p>加载中...</p>}
      {state.error && <p>错误: {state.error}</p>}
      {/* 其他 UI */}
    </div>
  );
}
```

### 直接使用 API 客户端

```typescript
import { sessionApi, messageApi } from './api';

// 创建会话
const sessionId = await sessionApi.createSession();

// 发送消息并接收流式响应
const abortController = messageApi.sendMessage(
  sessionId,
  'Hello!',
  (chunk) => console.log('Received:', chunk),
  () => console.log('Complete'),
  (error) => console.error('Error:', error)
);
```

## 配置

### Vite 配置

`vite.config.ts` 配置了：
- React 插件
- 开发服务器端口 (3000)
- API 代理到后端 (http://localhost:3001)

### Tailwind CSS 配置

`tailwind.config.js` 配置了：
- 内容扫描路径
- 主题扩展（如需要）

### TypeScript 配置

`tsconfig.json` 配置了：
- 严格模式
- React JSX 支持
- 模块解析策略

## 下一步

前端基础设施已完成，接下来可以实现：

1. **ChatPanel 组件** - 聊天界面
2. **ProfilePanel 组件** - 信息表格面板
3. **SessionList 组件** - 会话列表
4. **ExportButton 组件** - PDF 导出按钮
5. **主应用布局** - 双栏布局集成

## 注意事项

- 所有 API 调用都会自动处理错误并更新全局状态
- 使用 `useApi` Hook 可以自动管理加载状态和错误
- SSE 连接支持自动重连（需要在组件中实现）
- 日期类型会自动从 ISO 字符串转换为 Date 对象
