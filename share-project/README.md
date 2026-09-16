# ⚡ 拥抱Agent（50 分钟培训材料）

## 培训目标

这套材料不追求讲全 Agent 的底层知识，而是让大家找到一个真实任务并开始使用 Agent，覆盖四类工作：

- 开发：代码、测试、排错、脚本和文档
- 交付：巡检、日志、配置、操作手册和验证
- 项目管理：会议纪要、计划、周报和风险
- 咨询：调研、分析、方案初稿和问答演练

## 讲课主线

先亮明五个观点和最小概念，再从岗位任务进入工具地图，最后用任务模板、工具边界和真实案例跑通闭环：

1. 未来企业间、国家间、人与人之间的竞争，都会被 Agent 放大。
2. 我们的步伐已经慢了，需要尽快把 Agent 放进日常工作。
3. 网络、模型、客户现场和安全是常见门槛，要逐个解决。
4. 技术正在平权；不拥抱技术，就可能被重新归零，先归零，再把能力长出来。
5. 丝滑使用 Agent 的四个要件：Linux / macOS、网络、顶级大模型、AI 解决问题的第一性思维；其中推荐 Linux。

## 时间总表

| 时间 | 页面 | 讲法 |
|---|---|---|
| 0–5′ | `slides/00-open.html` | 五个观点，先形成共识 |
| 5–12′ | `slides/01-base.html` | 只讲 Agent 的最小公式和工作闭环 |
| 12–22′ | `slides/05-roles.html` | 先从开发、交付、PM、咨询找到自己的切入口 |
| 22–27′ | `slides/06-agents.html` | 再认识国内外主流 Agent，按形态和任务选择 |
| 27–32′ | `slides/02-eyes.html` | 用五项模板把任务说清楚 |
| 32–39′ | `slides/03-hands.html` | 工具、Coding、验证和安全边界 |
| 39–43′ | `slides/04-evolve.html` | 四个要件和四个现实门槛 |
| 43–47′ | `slides/07-repo.html` | 用三个真实仓库看 Agent 如何进入看板、工程和产品 |
| 47–49′ | `slides/06-tools.html` | 按任务选主用方案和备用方案 |
| 49–50′ | `slides/07-action.html` | 明天三步，一周留下一个案例 |

## 讲师提示

- 少讲术语，不展开模型训练、复杂架构和学术细节。
- 讲 Linux / macOS 时并列说明：两者都能开发，重点推荐 Linux；抓住 CLI 自由编排、开源工具秒体验、Hermes/OpenClaw 接社交软件、Agent 串起完整工作链、Omarchy 作为个人实验工作台。
- 讲主流 Agent 时不要只讲开源终端工具：补充 GitHub Copilot、Microsoft 365 Copilot、Cursor、Windsurf、Gemini、Amazon Q、Devin，以及国内的 Kimi Code、Qwen Code、通义灵码/Qoder CN、TRAE/MarsCode、文心快码、CodeBuddy、CodeGeeX、CodeArts；同时说明模型、Agent 产品和编排平台的区别。
- 讲仓库案例时依次介绍 `agent-board`、`dcx-langgraph-dashboard`、`kids-quiz`：看见 Agent、组织 Agent、把 Agent 做成产品。
- 每页只抓住标题和加粗结论，底部提示词可以直接照着讲。
- 最好准备一个真实材料：代码、日志、会议纪要或方案材料任选一段。
- 结束前请每个人选定一个明天要尝试的小任务。

## 开讲前检查

- [ ] 浏览器离线打开 `index.html` 后自动进入开场页，主题切换正常
- [ ] 确认公司允许的网络、模型和数据使用边界
- [ ] 准备网络受限时的备用方案：离线资料、脚本、热点或人工流程
- [ ] 准备一个真实案例，现场演示“给背景 → 执行 → 验证”

## 目录

```
share-project/
├── index.html              # 自动进入开场页
├── style.css / theme.js    # 离线样式和主题切换
├── assets/                 # 培训页使用的本地图片素材
├── README.md               # 讲师手册
└── slides/
    ├── 00-open.html        # 先讲观点
    ├── 01-base.html        # Agent 是什么
    ├── 05-roles.html       # 四类岗位
    ├── 06-agents.html      # 主流 Agent 速览
    ├── 02-eyes.html        # 让它看懂
    ├── 03-hands.html       # 让它做事
    ├── 04-evolve.html      # 丝滑使用的要件
    ├── 07-repo.html        # 我的 GitHub 仓库
    ├── 06-tools.html       # 工具与边界
    └── 07-action.html      # 明天开始
```

本地预览：`python3 -m http.server -d . 8000`，然后打开 `http://localhost:8000/`。
