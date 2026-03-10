# 实现计划: 自然聊天信息提取器

## 概述

本实现计划将自然聊天信息提取器分解为一系列增量式的开发任务。每个任务都建立在前一个任务的基础上，确保代码逐步集成。实现将使用 TypeScript 进行前后端开发。

## 任务

- [x] 1. 项目初始化和数据库搭建
  - 创建前后端项目结构（使用 Vite + React + TypeScript 前端，Node.js + Express 后端）
  - 配置 TypeScript、ESLint、Prettier
  - 设置 MySQL 8.0.44 数据库连接池
  - 创建数据库表（sessions, messages, profile_data）
  - _需求: 8.1, 8.7_-

- [x] 2. 实现数据库服务层 (DatabaseService)
  - 实现完整的 DatabaseService 类，包含所有数据库操作方法
  - 会话管理：createSession, getSession, listSessions, deleteSession
  - 消息管理：saveMessage, getMessages
  - Profile 数据管理：saveProfileData, getProfileData
  - _需求: 8.1-8.7, 10.1-10.6_

- [ ]* 2.1 编写数据库服务属性测试
  - **属性 12: 对话历史持久化**
  - **属性 13: Profile 数据持久化**
  - **属性 14: 会话 ID 唯一性**
  - **属性 17: 数据删除完整性**

- [x] 3. 实现 DeepSeek API 集成
  - 创建 DeepSeek API 客户端（配置管理、请求头、错误处理）
  - 实现 DeepSeek Chat 调用（流式响应支持）
  - 实现 DeepSeek Reasoner 调用（信息提取）
  - 设计系统提示词和信息提取提示词
  - _需求: 1.1, 1.6, 6.1-6.7_

- [ ]* 3.1 编写 API 集成属性测试
  - **属性 1: API 流式调用配置**
  - **属性 10: API 模型选择**
  - **属性 11: API 配置正确性**

- [x] 4. 实现后端核心服务
  - 实现 ChatService（对话管理、消息保存、上下文管理）
  - 实现 ProfileService（消息计数、定时器、Reasoner 触发、信息提取）
  - 实现 SessionService（会话生命周期管理）
  - 实现 PDFService（PDF 生成，使用 pdfmake）
  - _需求: 1.1, 2.1-2.7, 3.1-3.6, 4.2-4.5, 7.1-7.6, 10.1-10.6_

- [ ]* 4.1 编写后端服务属性测试
  - **属性 2: 信息提取和更新**
  - **属性 4: Reasoner 触发机制**
  - **属性 5: Reasoner 调用完整性**
  - **属性 6: Reasoner 调用后状态重置**
  - **属性 7: PDF 内容完整性**

- [x] 5. 实现后端 API 路由
  - 创建 Express 应用（配置 CORS、错误处理、日志）
  - 实现会话管理路由（POST/GET/DELETE /api/sessions）
  - 实现对话路由（POST/GET /api/sessions/:id/messages，SSE 流式响应）
  - 实现信息提取路由（GET/POST /api/sessions/:id/profile）
  - 实现 PDF 导出路由（GET /api/sessions/:id/export/pdf）
  - _需求: 所有 API 相关需求_

- [x] 6. 检查点 - 后端完成
  - 验证数据库操作正常
  - 验证 DeepSeek API 集成正常
  - 测试所有 API 端点
  - 如有问题请询问用户

- [x] 7. 实现前端基础设施
  - 创建 React + TypeScript 项目（使用 Vite）
  - 配置 Tailwind CSS
  - 实现 API 客户端（HTTP 请求、SSE 连接、错误处理）
  - 实现全局状态管理（使用 Context 或 Zustand）
  - 定义所有 TypeScript 接口（AppState, Session, Message, ProfileData）
  - _需求: 1.6, 2.6, 5.4, 7.1_

- [x] 8. 实现聊天界面 (ChatPanel)
  - 创建 ChatPanel 组件（消息列表、输入框、发送按钮）
  - 实现流式消息显示（SSE 连接、逐块显示）
  - 实现消息发送功能（调用 API、立即显示用户消息）
  - _需求: 1.6, 5.1, 5.3, 5.4, 7.1_

- [ ]* 8.1 编写聊天界面属性测试
  - **属性 8: 消息显示一致性**
  - **属性 9: 流式回复显示**

- [x] 9. 实现信息表格面板 (ProfilePanel)
  - 创建 ProfilePanel 组件（表格布局、所有字段显示）
  - 实现实时更新功能（监听数据变化、平滑更新）
  - 处理空值显示（显示"待了解"）
  - _需求: 2.6, 2.7, 5.2, 5.5_

- [ ]* 9.1 编写信息表格属性测试
  - **属性 3: Profile 数据同步**

- [x] 10. 实现会话管理和其他功能
  - 创建会话列表组件（显示历史会话、时间、预览）
  - 实现会话切换、新建、删除功能
  - 创建 ExportButton 组件（PDF 导出按钮、下载触发）
  - 实现隐私说明和清除数据功能
  - _需求: 4.1-4.3, 5.6, 9.2-9.6, 10.1-10.6_

- [x] 11. 实现主应用布局和集成
  - 创建 App 组件（双栏布局：左侧聊天、右侧表格）
  - 集成所有子组件（ChatPanel, ProfilePanel, ExportButton, 会话列表）
  - 实现响应式布局
  - 实现全局错误处理和加载状态
  - _需求: 5.1, 5.2, 5.6_

- [x] 12. 最终测试和优化
  - 运行端到端测试（对话流程、信息提取、会话管理、PDF 导出）
  - 优化数据库查询（添加索引、优化语句）
  - 优化前端性能（懒加载、减少重渲染）
  - 验证所有功能正常工作
  - 如有问题请询问用户

## 注意事项

- 标记为 `*` 的任务是可选的测试任务，可以根据需要跳过以加快 MVP 开发
- 每个任务完成后进行基本验证
- 遇到问题时及时停下来询问用户
- 保持代码简洁，避免过度设计
