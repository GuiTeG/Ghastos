import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';  // <= estava ../lib/prisma


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const data = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    return res.json(data);
  }
  if (req.method === 'POST') {
    const { name, kind } = req.body || {};
    if (!name || !kind) return res.status(400).json({ error: 'name and kind required' });
    const c = await prisma.category.upsert({ where: { name }, update: { kind }, create: { name, kind } });
    return res.status(201).json(c);
  }
  res.status(405).end();
}
