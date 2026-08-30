# 奇趣知识岛

面向儿童的多学科肉鸽答题闯关项目。

## 技术栈

- React + Vite
- Express
- SQLite（Node.js `node:sqlite`）
- Web Audio API

## 启动

```bash
npm install
npm run dev
```

前端地址：`http://localhost:5173`
后端地址：`http://localhost:8787`

## 功能

- 数学、语文、英语、科学、生活、地理六类题库
- 热身、进阶、挑战三档难度
- 5、8、10、12 道题量设置
- 5 层肉鸽式答题闯关与随机增益
- SQLite 个人档案和作答记录
- 间隔复习记忆曲线：1、3、7、14、30 天
- 到期复习题优先进入题目队列

## 构建

```bash
npm run build
npm run preview
```

SQLite 数据保存在 `data/kids-quiz.db`，不会提交到 Git。
