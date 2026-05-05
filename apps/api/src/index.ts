import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../../../.env') });
import cors from 'cors';
import express from 'express';
import { prisma } from '@anuva/database';
import {
  createExampleBodySchema,
  exampleResponseSchema,
  type ExampleResponse,
} from '@anuva/shared';
import { ZodError } from 'zod';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/examples', async (_req, res, next) => {
  try {
    const rows = await prisma.example.findMany({ orderBy: { createdAt: 'desc' } });
    const body: ExampleResponse[] = rows.map((row) =>
      exampleResponseSchema.parse({
        id: row.id,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
      })
    );
    res.json(body);
  } catch (e) {
    next(e);
  }
});

app.post('/examples', async (req, res, next) => {
  try {
    const parsed = createExampleBodySchema.parse(req.body);
    const row = await prisma.example.create({ data: { name: parsed.name } });
    const body = exampleResponseSchema.parse({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
    });
    res.status(201).json(body);
  } catch (e) {
    next(e);
  }
});

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed', issues: err.flatten() });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
