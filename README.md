# 自然聊天信息提取器

一个基于自然对话进行信息采集、画像提取、思考过程展示与 PDF 导出的本地 Web 应用。

## 项目概览

系统由前后端两部分组成：

- **前端**：React + TypeScript + Vite + TailwindCSS
- **后端**：Node.js + Express + TypeScript
- **数据库**：MySQL 8
- **模型服务**：DeepSeek Chat + DeepSeek Reasoner

核心能力：

- 自然对话式信息采集
- 流式回复渲染
- 会话画像自动提取与更新
- Reasoner 思考过程展示
- 会话管理与历史记录
- PDF 导出
- 隐私清理事件记录

---

## 目录结构

```text
.
├── frontend/                # React 前端
├── backend/                 # Express 后端
├── 启动应用.bat             # Windows 一键启动脚本
└── README.md
```

---

## 环境要求

- Node.js 18+
- MySQL 8.0+
- DeepSeek API Key
- Windows 环境下可直接使用 `启动应用.bat`

---

## 后端配置

在 `backend/.env` 中配置：

```env
PORT=3001

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=natural_chat_profiler

DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

说明：

- 前端开发服务器默认运行在 `http://localhost:5173`
- 后端默认运行在 `http://localhost:3001`
- 前端通过 `/api` 访问后端接口

---

## 快速开始

### 方式一：使用启动脚本

在项目根目录直接运行：

```bash
启动应用.bat
```

该脚本会：

1. 检查 Node.js
2. 检查 MySQL 服务状态
3. 自动安装前后端依赖（若缺失）
4. 启动后端开发服务
5. 启动前端开发服务
6. 自动打开浏览器访问前端页面

启动后访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

### 方式二：手动启动

#### 启动后端

```bash
cd backend
npm install
npm run dev
```

#### 启动前端

```bash
cd frontend
npm install
npm run dev
```

---

## 构建与检查

### 后端

```bash
cd backend
npm run build
npm run lint
```

### 前端

```bash
cd frontend
npm run build
npm run lint
```

---

## 运行流程

## 1. 启动流程

### 后端启动

后端入口在 `backend/src/index.ts`，启动顺序如下：

1. 创建依赖容器
2. 验证 MySQL 连接
3. 初始化数据库 schema
4. 输出当前 schema 版本或本次应用的迁移步骤
5. 创建 Express 应用并注册路由
6. 监听端口并提供 API 服务

当前 schema 初始化机制已调整为**最小版本化步骤**：

- 使用 `schema_migrations` 记录已应用版本
- 通过 `SCHEMA_STEPS` 顺序执行初始化步骤
- 保留兼容修补逻辑，但不再是完全无状态的弱初始化

### 前端启动

前端入口在 `frontend/src/main.tsx`。

应用启动后会：

1. 挂载 `AppProvider`
2. 初始化全局状态
3. 加载会话列表
4. 若存在会话则自动加载首个会话
5. 若不存在会话则自动创建会话
6. 在后台异步执行会话整理逻辑

---

## 2. 一次对话的完整链路

### 前端侧

用户在 `ChatPanel` 输入消息后：

1. 前端先把用户消息插入本地状态
2. 创建 assistant 占位消息
3. 向后端发起 `POST /api/sessions/:sessionId/chat`
4. 通过 SSE 接收流式事件
5. 边接收边更新聊天区、画像区、思考区

### 后端侧

聊天主链路位于：

- `backend/src/routes/chat.ts`
- `backend/src/services/ChatService.ts`
- `backend/src/services/ProfileService.ts`

处理顺序如下：

1. 校验会话与请求参数
2. 在事务中写入用户消息、更新会话计数、清理初始化状态
3. 读取消息历史与当前画像
4. 调用 DeepSeek Chat 生成回复
5. 先落一条 assistant 占位消息
6. 流式生成过程中持续把内容回推前端，并同步更新该 assistant 消息内容
7. 生成结束后将 `stream_completed` 标记为完成
8. 根据策略决定是否触发画像分析
9. 若触发，则调用 DeepSeek Reasoner 提取画像并记录修订历史
10. 将 `reasoner_started` / `reasoner_chunk` / `profile_updated` / `reasoner_completed` 等事件通过 SSE 返回前端

这意味着当前实现已经避免了“前端看到流式回复但数据库完全没有 assistant 记录”的问题。

---

## 3. 画像提取与修订流程

画像分析主要由 `backend/src/services/ProfileService.ts` 负责。

流程如下：

1. 判断是否满足自动分析条件
2. 创建 reasoner job
3. 读取当前消息历史与现有画像
4. 调用 DeepSeek Reasoner
5. 解析结构化画像结果
6. 合并画像快照
7. 写入 `session_profiles`
8. 写入 `profile_revisions`
9. 更新 `reasoner_jobs`
10. 更新 session 的画像版本与最近分析时间

这些关键写入现在已收敛到事务中，减少了多表部分成功导致的不一致问题。

---

## 4. 前端状态管理

前端使用 Context + Reducer 管理全局状态，核心文件：

- `frontend/src/context/AppContext.tsx`
- `frontend/src/hooks/useApi.ts`

当前 loading 状态已经从单一布尔值拆分为细粒度状态：

- `sessions`
- `sessionDetail`
- `creatingSession`
- `deletingSessionId`
- `clearingAllData`
- `exportingPdf`
- `analyzingProfile`

同时保留聚合后的 `isLoading`，用于兼容已有 UI 判断。

这样可以减少：

- 导出 PDF 时误锁住整个页面
- 删除会话与加载会话互相干扰
- 清空数据与其他操作共用一个 loading 状态的问题

---

## 5. 数据表与数据语义

当前后端主要使用以下表：

- `sessions`
- `session_messages`
- `session_profiles`
- `profile_revisions`
- `reasoner_jobs`
- `session_summaries`
- `privacy_events`
- `schema_migrations`

### 删除与隐私处理

当前数据删除语义为：

- **删除单个会话**：软删除
  - `sessions.status = 'deleted'`
  - 写入 `privacy_cleared_at`
  - 默认列表与查询会排除已删除会话
- **清空全部数据**：硬删除
  - 删除全部会话数据
  - 同时记录隐私事件

隐私事件会写入 `privacy_events`，并在元数据中标记：

- `scope`
- `deletionMode`

---

## 6. 主要接口

常用接口包括：

- `GET /api/sessions`：获取会话列表
- `POST /api/sessions`：创建会话
- `GET /api/sessions/:sessionId`：获取会话详情
- `DELETE /api/sessions/:sessionId`：删除单个会话（当前为软删除）
- `DELETE /api/sessions/data`：清空全部数据
- `POST /api/sessions/:sessionId/chat`：发送消息并建立 SSE 流
- `GET /api/sessions/:sessionId/profile`：获取当前画像
- `GET /api/sessions/:sessionId/profile/revisions`：获取画像修订历史
- `GET /api/sessions/:sessionId/export/pdf`：导出 PDF

---

## 7. 工程改进摘要

本次代码整理后，项目具备了这些更稳定的特性：

- 修复了前端删除会话逻辑中的明显错误
- 消息写入与会话状态更新改为事务处理
- `sequence_no` 分配避免了 `MAX + 1` 带来的并发竞争
- assistant 流式消息改为占位落库 + 流中更新 + 完成标记
- 画像分析关键多表写入改为事务提交
- 清理了会泄漏聊天正文、画像内容、推理文本的敏感日志
- schema 初始化改为带版本号的最小迁移步骤
- 前端 loading 状态改为细粒度管理
- 单会话删除语义与数据库字段设计重新对齐

---

## 8. 适用场景

适合用于：

- 毕业设计展示
- 对话式画像采集原型
- 人机对话驱动的信息提取实验
- Reasoner 可视化流程演示

---

## 9. 注意事项

- 本项目依赖 MySQL 与 DeepSeek API，首次运行前请先配置 `backend/.env`
- 若 MySQL 未启动，后端将无法完成 schema 初始化与服务启动
- 当前前端和后端都以开发模式运行时，推荐通过根目录的 `启动应用.bat` 使用
- 若用于公开演示或部署，仍建议进一步补充权限控制、生产配置管理与正式数据库迁移方案
