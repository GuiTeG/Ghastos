import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';  // <= estava ../lib/prisma

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { month, year } = req.query;
  const where = (month && year) ? {
    date: { gte: new Date(+year!, +month!-1, 1), lt: new Date(+year!, +month!, 1) }
  } : {};
  const data = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { category: true, account: true }
  });
  res.json(data);
}
