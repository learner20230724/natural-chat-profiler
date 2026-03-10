# 需求文档

## 简介

自然聊天信息提取器是一个智能对话系统，通过自然、真诚的聊天方式逐步了解用户的基本信息，而不会让用户感到被审问或采集信息。系统使用 DeepSeek API（deepseek-chat 和 deepseek-reasoner）提供智能对话能力，并在右侧面板实时显示提取的信息表格，支持导出为 PDF 格式。

## 术语表

- **System**: 自然聊天信息提取器系统
- **User**: 与系统进行对话的用户
- **Profile_Data**: 从对话中提取的用户信息（年龄、城市、性格等）
- **DeepSeek_Chat**: DeepSeek-V3.2 的非思考模式，用于日常对话
- **DeepSeek_Reasoner**: DeepSeek-V3.2 的思考模式，用于分析和完善表格内容
- **Chat_Interface**: 用户与系统交互的聊天界面（左侧）
- **Profile_Table**: 实时显示提取信息的表格（右侧）
- **Message_Counter**: 跟踪对话消息数量的计数器
- **Reasoner_Timer**: 控制 DeepSeek_Reasoner 调用间隔的计时器
- **MySQL_Database**: MySQL 8.0.44 数据库，用于持久化存储会话和用户数据
- **Session**: 一次完整的对话会话，包含会话 ID、对话历史和提取的信息

## 需求

### 需求 1: 自然对话信息提取

**用户故事:** 作为用户，我希望通过自然的聊天方式分享我的信息，而不是被逐项提问，这样我能感到更加舒适和自在。

#### 验收标准

1. WHEN User 发送消息 THEN THE System SHALL 调用 DeepSeek_Chat 生成自然、真诚、轻松的回复
2. WHEN System 回复 User THEN THE System SHALL NOT 在每次回复结尾都提出问题
3. WHEN System 需要了解信息 THEN THE System SHALL 通过上下文自然衔接而非直接提问
4. WHEN User 分享个人信息 THEN THE System SHALL 提供共情和适当的回应
5. WHEN System 检测到 User 是未成年人或不想聊相关话题 THEN THE System SHALL 自然转向生活、兴趣等轻松话题
6. WHEN 调用 DeepSeek_Chat THEN THE System SHALL 使用流式输出以提供流畅的用户体验

### 需求 2: 实时信息提取与表格显示

**用户故事:** 作为用户，我希望在对话过程中能够在右侧实时看到系统提取的信息表格，这样我可以随时了解已收集的信息。

#### 验收标准

1. WHEN User 在对话中提及年龄信息 THEN THE System SHALL 提取该信息并立即更新 Profile_Table
2. WHEN User 在对话中提及家庭所在城市 THEN THE System SHALL 提取该信息并立即更新 Profile_Table
3. WHEN User 在对话中提及现居城市 THEN THE System SHALL 提取该信息并立即更新 Profile_Table
4. WHEN User 在对话中展现性格特征 THEN THE System SHALL 识别该信息并立即更新 Profile_Table
5. WHEN User 在对话中提及期待的对象特征 THEN THE System SHALL 提取该信息并立即更新 Profile_Table
6. WHEN Profile_Data 更新 THEN THE Profile_Table SHALL 在右侧面板实时刷新显示
7. WHEN Profile_Data 中某些字段为空 THEN THE Profile_Table SHALL 显示为空或"待了解"

### 需求 3: 智能表格完善机制

**用户故事:** 作为系统，我需要定期使用深度思考模型来分析对话内容，完善和优化提取的信息表格。

#### 验收标准

1. WHEN Message_Counter 达到 3 条消息 THEN THE System SHALL 触发 DeepSeek_Reasoner 调用
2. WHEN Reasoner_Timer 达到 1 分钟 THEN THE System SHALL 触发 DeepSeek_Reasoner 调用
3. WHEN DeepSeek_Reasoner 被触发 THEN THE System SHALL 分析完整对话历史和当前 Profile_Data
4. WHEN DeepSeek_Reasoner 完成分析 THEN THE System SHALL 更新和完善 Profile_Data
5. WHEN DeepSeek_Reasoner 调用完成 THEN THE System SHALL 重置 Message_Counter 和 Reasoner_Timer
6. IF DeepSeek_Reasoner 调用失败 THEN THE System SHALL 记录错误但不影响正常对话流程

### 需求 4: PDF 导出功能

**用户故事:** 作为用户，我希望能够通过点击按钮将当前的信息表格导出为 PDF 文件，方便保存和分享。

#### 验收标准

1. THE System SHALL 在界面上提供一个"导出 PDF"按钮
2. WHEN User 点击"导出 PDF"按钮 THEN THE System SHALL 生成包含 Profile_Table 内容的 PDF 文件
3. WHEN PDF 生成完成 THEN THE System SHALL 触发浏览器下载该 PDF 文件
4. WHEN 生成 PDF THEN THE System SHALL 包含表格标题、字段名称和对应的值
5. WHEN Profile_Data 中某些字段为空 THEN THE PDF SHALL 显示为"待了解"或留空
6. WHEN PDF 生成 THEN THE System SHALL 使用清晰易读的格式和布局

### 需求 5: 用户界面布局

**用户故事:** 作为用户，我希望有一个清晰的双栏界面，左侧用于聊天，右侧实时显示信息表格。

#### 验收标准

1. THE Chat_Interface SHALL 显示在界面左侧并占据合理的宽度比例
2. THE Profile_Table SHALL 显示在界面右侧并占据合理的宽度比例
3. WHEN User 发送消息 THEN THE Chat_Interface SHALL 立即显示用户消息
4. WHEN System 生成回复 THEN THE Chat_Interface SHALL 以流式方式显示系统回复
5. WHEN Profile_Data 更新 THEN THE Profile_Table SHALL 平滑更新而不闪烁
6. THE System SHALL 在界面顶部或底部提供"导出 PDF"按钮

### 需求 6: DeepSeek API 集成

**用户故事:** 作为系统，我需要与 DeepSeek API 集成，使用 deepseek-chat 进行对话，使用 deepseek-reasoner 进行深度分析。

#### 验收标准

1. WHEN System 需要生成对话回复 THEN THE System SHALL 调用 DeepSeek_Chat 模型
2. WHEN System 需要分析和完善表格 THEN THE System SHALL 调用 DeepSeek_Reasoner 模型
3. WHEN 调用 DeepSeek API THEN THE System SHALL 使用正确的 base_url (https://api.deepseek.com)
4. WHEN 调用 DeepSeek API THEN THE System SHALL 在请求头中包含有效的 API 密钥
5. WHEN 调用 DeepSeek_Chat THEN THE System SHALL 设置 stream 为 true 以启用流式输出
6. IF DeepSeek API 调用失败 THEN THE System SHALL 显示友好的错误提示并允许重试
7. WHEN 使用 DeepSeek API THEN THE System SHALL 安全存储和使用 API 密钥

### 需求 7: 对话上下文管理

**用户故事:** 作为系统，我需要维护对话上下文，以便生成连贯和相关的回复。

#### 验收标准

1. WHEN User 发送新消息 THEN THE System SHALL 将消息添加到对话历史
2. WHEN System 生成回复 THEN THE System SHALL 基于完整的对话历史
3. WHEN 对话历史超过一定长度 THEN THE System SHALL 保留最近的对话并总结早期内容
4. WHEN 新会话开始 THEN THE System SHALL 清空之前的对话历史和 Profile_Data
5. THE System SHALL 在整个对话过程中保持一致的语气和风格
6. WHEN 调用 DeepSeek_Reasoner THEN THE System SHALL 提供完整的对话历史用于分析

### 需求 8: 数据存储

**用户故事:** 作为系统，我需要在会话期间可靠地存储对话历史和提取的信息，并支持跨会话的数据持久化。

#### 验收标准

1. WHEN 应用启动 THEN THE System SHALL 连接到 MySQL 8.0.44 数据库
2. WHEN Profile_Data 更新 THEN THE System SHALL 立即保存到 MySQL 数据库
3. WHEN 对话消息产生 THEN THE System SHALL 立即保存到 MySQL 数据库
4. WHEN 用户开始新会话 THEN THE System SHALL 在数据库中创建新的会话记录
5. WHEN 用户返回应用 THEN THE System SHALL 能够从数据库加载历史会话列表
6. THE System SHALL 为每个会话分配唯一的会话 ID
7. THE System SHALL 在数据库中存储会话 ID、对话历史、Profile_Data 和时间戳

### 需求 9: 隐私和安全

**用户故事:** 作为用户，我希望我的个人信息得到安全处理，并且我能够控制数据的保存和删除。

#### 验收标准

1. WHEN 存储 Profile_Data THEN THE System SHALL 将数据安全存储在 MySQL_Database 中
2. WHEN 会话结束 THEN THE System SHALL 提供选项清除当前会话的所有数据
3. THE System SHALL NOT 在未经用户同意的情况下将数据发送到除 DeepSeek API 之外的第三方服务
4. WHEN 处理敏感信息 THEN THE System SHALL 在界面上提供明确的隐私说明
5. WHEN 用户清除数据 THEN THE System SHALL 从 MySQL_Database 中完全删除所有相关信息
6. THE System SHALL 提供"清除所有数据"按钮供用户随时使用
7. WHEN 连接 MySQL_Database THEN THE System SHALL 使用安全的连接配置和凭据管理

### 需求 10: 会话管理

**用户故事:** 作为用户，我希望能够管理多个对话会话，查看历史会话，并在需要时恢复之前的对话。

#### 验收标准

1. WHEN 用户首次访问 THEN THE System SHALL 自动创建新的 Session
2. WHEN 用户点击"新建会话" THEN THE System SHALL 创建新的 Session 并清空当前界面
3. THE System SHALL 提供会话列表界面显示所有历史 Session
4. WHEN 用户选择历史 Session THEN THE System SHALL 加载该会话的对话历史和 Profile_Data
5. WHEN 显示会话列表 THEN THE System SHALL 显示会话创建时间和简要信息预览
6. WHEN 用户删除 Session THEN THE System SHALL 从 MySQL_Database 中删除该会话的所有数据
