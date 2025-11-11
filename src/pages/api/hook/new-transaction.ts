import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

const Body = z.object({
  date: z.string(),
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(['INCOME','EXPENSE']),
  category: z.string().min(1),
  account: z.string().min(1),
  secret: z.string()
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());
  if (parsed.data.secret !== process.env.WEBHOOK_SECRET) return res.status(401).json({ error: 'unauthorized' });

  const { date, description, amount, type, category, account } = parsed.data;

  const [cat, acc] = await Promise.all([
    prisma.category.upsert({ where: { name: category }, update: {}, create: { name: category, kind: type } }),
    prisma.account.upsert({ where: { name: account }, update: {}, create: { name: account, type: 'corrente' } })
  ]);

  const tx = await prisma.transaction.create({
    data: {
      date: new Date(date),
      description,
      amount,
      type,
      categoryId: cat.id,
      accountId: acc.id
    },
    include: { category: true, account: true }
  });

  return res.status(201).json({ ok: true, id: tx.id });
}
