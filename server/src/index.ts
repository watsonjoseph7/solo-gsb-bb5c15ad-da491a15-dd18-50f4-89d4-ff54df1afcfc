import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { router } from './routes';

const app = express();
app.use(express.json({ limit: '20mb' }));

app.use('/api', router);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// 生产模式：托管前端构建产物
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 统一错误处理
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ errors: ['服务器内部错误'] });
  },
);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`clause renumber workbench listening on http://localhost:${port}`);
});
