// src/pages/api/accounts/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma'; // 3 níveis

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const data = await prisma.account.findMany({ orderBy: { name: 'asc' } });
    return res.json(data);
  }
  if (req.method === 'POST') {
    const { name, type } = req.body as { name?: string; type?: string };
    if (!name || !type) return res.status(400).json({ error: 'name e type obrigatórios' });
    const created = await prisma.account.create({ data: { name, type } });
    return res.status(201).json(created);
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}
