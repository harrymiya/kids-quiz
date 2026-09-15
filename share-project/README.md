# ⚡ Agent 实战培训（50分钟）· 讲师手册

> 基座：`ai-agent-book-html`（《深入理解 AI Agent》李博杰 v2.0 知识图谱）
> 输出：本目录 `~/code/share-project`，离线可用（零外部依赖，复用基座 `style.css/theme.js`）
> 受众：开发 / 交付 / 项目经理 / 咨询。目标：了解基本方法，带走一份可尝试的清单。

## 时间总表（参考安排）

| 时间 | 页 | 讲法 | 时间不够时可略过 |
|---|---|---|---|
| 0–3′ | `slides/00-open.html` | 先聊三个观察 | 追问可留到最后集中讨论 |
| 3–15′ | `slides/01-base.html` | 公式、ReAct、Harness 和两种路线 | 可略过护栏细节 |
| 15–24′ | `slides/02-eyes.html` | 上下文、Skills、状态栏和 RAG | 可略过 RAPTOR/GraphRAG 展开 |
| 24–33′ | `slides/03-hands.html` | 工具、安全和 Coding Agent | 可略过主动发现的例子 |
| 33–40′ | `slides/04-evolve.html` | 每块讲一个工作上的结论 | 可只讲表格 |
| 40–45′ | `slides/05-roles.html` | 每岗约 1 分钟，重点看清单 | 可略过限制条件的展开 |
| 45–48′ | `slides/06-tools.html` | 三个选型问题和备用方案 | 可略过 B 档细节 |
| 48–50′+ | `slides/07-action.html` | 使用前准备和下一步行动 | 观点部分可简短讨论 |

知识点约37′（75%），实战约13′（25%）。底层数学、检索公式和协议细节只做简要介绍。

## 概念覆盖自查（主要内容）

- ch01：公式三视图/Environment/ReAct/静态前缀+轨迹/Harness五件套/五阶段演进/工作流vs自主/三护栏/5模式 ✓（01-base）
- ch02：4角色/无状态/KV 注意点/时间戳/Skills三层/状态栏TODO/压缩5层+信息腐化/隔离 ✓（02-eyes）
- ch03：个体vs群体/三规则/三评估/三层次/4格式/认知三类/RAG+chunk/稠密稀疏混合RRF/RAPTORvsGraph/OpenViking/PR流水线/AgenticRAG/上下文感知检索/双层记忆/注入防御 ✓（02-eyes表）
- ch04：五类/通用vs专用/MCP/感知粒度/提议审核vsSidecar/沙盒强度/幂等/语义解析/子Agent+HITL/主动发现 ✓（03-hands）
- ch05：七工具/OpenClaw/流程/四象限/约束优先/故障分类+熔断+重试/并行/搜索/编辑5方案/风险组合+持久记忆/代码与文件能力 ✓（03-hands）
- ch06-10+后记：交互/评估/后训练/进化四载体/多Agent/A2A/仍待解决的问题 ✓（04-evolve，只给工作上的结论）

## 7 个观察在材料中的位置

1. 工具在拉近差距，但经验仍重要 → 00-open + 07-action-1
2. 外部也在变化，团队需要关注 → 00-open + 07-action-2
3. 使用前准备（inode/流量/操作系统/网络/模型费用）→ 07-action-3 + 准备表
4. 不同岗位都可以从小环节开始 → 05-roles 四步方法
5. 环境各异，先在允许范围内试用 → 05-roles note + 06-tools 备用方案
6. 团队进展不一，可以用结果推动讨论 → 07-action-6
7. 公司、团队和个人都在形成自己的用法 → 00-open + 07-action-7

## 开讲前检查

- [ ] 浏览器离线打开 `index.html` 正常，主题切换正常
- [ ] 准备热点、合规的网络方案和模型账号，现场演示有备用安排
- [ ] 准备1个自己的真实案例（周报/排错/标书），40′后live 1′
- [ ] 打印或投屏“下一步 3 件事”，散会前请大家各自选一个要尝试的环节

## 目录

```
share-project/
├── index.html          # 总览+时间轴
├── style.css / theme.js # 复用基座（离线）
├── README.md           # 本手册
└── slides/
    ├── 00-open.html    # 0–3′
    ├── 01-base.html    # 3–15′
    ├── 02-eyes.html    # 15–24′
    ├── 03-hands.html   # 24–33′
    ├── 04-evolve.html  # 33–40′
    ├── 05-roles.html   # 40–45′
    ├── 06-tools.html   # 45–48′
    └── 07-action.html  # 48–50′
```

本地预览：`python3 -m http.server -d ~/code/share-project 8000` 或直接双击 `index.html`。
