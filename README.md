# 自然聊天信息提取器

通过自然对话方式提取用户信息的智能系统。

## 快速开始

```bash
# 启动应用（前端 + 后端）
启动应用.bat

# 停止应用
停止应用.bat
```

访问: http://localhost:3000

## 功能特性

- 自然对话式信息收集
- 实时信息提取和展示
- DeepSeek Reasoner 思考过程可视化
- 会话管理和历史记录
- PDF 导出功能

## 技术栈

- 前端: React + TypeScript + Vite + TailwindCSS
- 后端: Node.js + Express + TypeScript
- 数据库: MySQL
- AI: DeepSeek API

## 环境要求

- Node.js 18+
- MySQL 8.0+
- DeepSeek API Key

## 配置

编辑 `backend/.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=natural_chat_profiler

DEEPSEEK_API_KEY=your_api_key
```

## 项目结构

```
├── frontend/          # React 前端应用
├── backend/           # Express 后端服务
├── 启动应用.bat       # 启动脚本
└── 停止应用.bat       # 停止脚本
```
