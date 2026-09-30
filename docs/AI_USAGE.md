# AI 工具使用说明

本项目在需求梳理、开源方案调研、架构比较、测试用例设计、代码初稿和文档整理中使用了 Codex。项目成员负责确认功能范围、选择实现方案，并通过自动化测试、类型检查、生产构建和人工验收检查生成内容。

核心算法采用可解释的基础实现：递归回溯生成迷宫，队列实现 BFS，曼哈顿距离启发式实现 A*。提交前应能说明各模块输入、输出、复杂度和测试依据，并在课程报告中按学校要求披露 AI 辅助范围。

运行时 AI 扩展使用 DeepSeek Chat Completions：后端从环境变量读取 `DEEPSEEK_API_KEY`，向 `https://api.deepseek.com/chat/completions` 发送经过校验的报告摘要，默认模型为 `deepseek-flash`，关闭思考并限制输出长度。无密钥、超时、上游错误或异常响应时，后端返回确定性的本地规则解释；AI 文本不写入运行历史，数字指标始终来自本地算法。接口参数依据 DeepSeek 官方文档：<https://api-docs.deepseek.com/api/create-chat-completion/>。
