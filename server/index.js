// 装配层：中间件 / 路由挂载 / 静态资源 / 启动（业务逻辑见 routes/，存储见 db.js，网关见 llm.js）
import express from 'express';
import { resolve } from 'node:path';
import { db, rootDir } from './db.js';
import { resolveLLM } from './llm.js';
import profilesRouter from './routes/profiles.js';
import learningRouter from './routes/learning.js';
import aiRouter from './routes/ai.js';
import questionBanksRouter from './routes/question-banks.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/api', profilesRouter);
app.use('/api', learningRouter);
app.use('/api', aiRouter);
app.use('/api', questionBanksRouter);

app.use((error, _request, response, _next) => {
  if (error?.type === 'entity.too.large') return response.status(413).json({ error: '请求内容过大' });
  console.error(error);
  return response.status(500).json({ error: '服务器处理请求时出错' });
});

if (process.env.NODE_ENV === 'production') app.use(express.static(resolve(rootDir, 'dist')));
const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  const llm = resolveLLM();
  console.log(`Kids Quiz API: http://localhost:${port} | LLM: ${llm.baseUrl} / ${llm.model || '未配置模型(请到设置页选择)'}`);
});

// 导出 db 供测试/脚本使用
export { db };
