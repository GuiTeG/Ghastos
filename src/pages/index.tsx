// src/pages/index.tsx
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';

if (typeof window !== 'undefined') {
  ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
  );
}

const PieChart = dynamic(() => import('react-chartjs-2').then(m => m.Pie), { ssr: false });
const LineChart = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false });
const BarChart = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });

type Tx = {
  id: number;
  date: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category?: { name: string };
  account?: { name: string };
};

type Account = { id: number; name: string; type: string };

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* Componente Field */
function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div style={{ minWidth: 160, ...(grow ? { flex: 1 } : {}) }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

/* Opções de gráficos */
const saldoLineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: 'index', intersect: false },
  },
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#6b7280' },
    },
    y: {
      grid: { color: 'rgba(148,163,184,0.3)' },
      ticks: { color: '#6b7280' },
    },
  },
};

const barOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#6b7280' },
    },
    y: {
      grid: { color: 'rgba(148,163,184,0.3)' },
      ticks: { color: '#6b7280' },
    },
  },
};

const horizontalBarOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => BRL(ctx.parsed.x || 0),
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(148,163,184,0.3)' },
      ticks: { color: '#6b7280' },
    },
    y: {
      grid: { display: false },
      ticks: { color: '#6b7280' },
    },
  },
};

const pieOptions: ChartOptions<'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    tooltip: {
      callbacks: {
        label: ctx => {
          const label = ctx.label || '';
          const value = ctx.parsed || 0;
          return `${label}: ${BRL(value)}`;
        },
      },
    },
  },
  cutout: '55%',
};

const TAB_LABELS: Record<'DASH' | 'LANC' | 'CONTAS', string> = {
  DASH: 'Dashboard',
  LANC: 'Lançamentos',
  CONTAS: 'Contas',
};

export default function Home() {
  // Tab ativa
  const [tab, setTab] = useState<'DASH' | 'LANC' | 'CONTAS'>('DASH');

  // Dados
  const [txs, setTxs] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Layout responsivo
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Form lançamento
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '' as string | number,
    type: 'EXPENSE' as 'EXPENSE' | 'INCOME',
    category: 'Outros',
    account: 'Conta Corrente',
  });
  const descRef = useRef<HTMLInputElement>(null);

  // Form conta
  const [accForm, setAccForm] = useState({ name: '', type: 'Conta Corrente' });

  // Filtros
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] =
    useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const loadTx = async () => {
    const r = await fetch('/api/transactions');
    setTxs(await r.json());
    setLoading(false);
  };
  const loadAcc = async () => {
    const r = await fetch('/api/accounts');
    setAccounts(await r.json());
  };

  useEffect(() => {
    loadTx();
    loadAcc();
    const id = setInterval(loadTx, 8000);
    return () => clearInterval(id);
  }, []);

  // Responsivo: detectar mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');

    const handleChange = (event: any) => {
      const matches = event.matches;
      setIsMobile(matches);
      if (!matches) setSidebarOpen(false);
    };

    setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', handleChange);
    else mq.addListener(handleChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handleChange);
      else mq.removeListener(handleChange);
    };
  }, []);

  // Dataset filtrado (mês/ano)
  const filtered = useMemo(() => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return txs
      .filter(t => {
        const d = new Date(t.date);
        return d >= start && d < end;
      })
      .filter(t =>
        q.trim()
          ? t.description.toLowerCase().includes(q.trim().toLowerCase())
          : true,
      )
      .filter(t => (typeFilter === 'ALL' ? true : t.type === typeFilter))
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [txs, year, month, q, typeFilter]);

  // KPIs principais
  const income = filtered
    .filter(t => t.type === 'INCOME')
    .reduce((a, b) => a + Number(b.amount), 0);
  const expense = filtered
    .filter(t => t.type === 'EXPENSE')
    .reduce((a, b) => a + Number(b.amount), 0); // negativo
  const balance = income + expense;
  const totalExpenseAbs = Math.abs(expense);
  const totalCount = filtered.length;

  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
  const avgDailyExpense =
    daysElapsed > 0 ? totalExpenseAbs / daysElapsed : 0;

  const netPerDay = daysElapsed > 0 ? balance / daysElapsed : 0;
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0);
  const projectedEndBalance = balance + netPerDay * daysRemaining;

  // Comparativo mês anterior
  const prevComparison = useMemo(() => {
    if (!txs.length) return null;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const startPrev = new Date(prevYear, prevMonth - 1, 1);
    const endPrev = new Date(prevYear, prevMonth, 1);

    const prevTxs = txs.filter(t => {
      const d = new Date(t.date);
      return d >= startPrev && d < endPrev;
    });

    const prevIncome = prevTxs
      .filter(t => t.type === 'INCOME')
      .reduce((a, b) => a + Number(b.amount), 0);
    const prevExpense = prevTxs
      .filter(t => t.type === 'EXPENSE')
      .reduce((a, b) => a + Number(b.amount), 0);
    const prevExpenseAbs = Math.abs(prevExpense);

    let incomePct: number | null = null;
    let expensePct: number | null = null;

    if (prevIncome > 0) {
      incomePct = ((income - prevIncome) / prevIncome) * 100;
    }
    if (prevExpenseAbs > 0) {
      expensePct =
        ((totalExpenseAbs - prevExpenseAbs) / prevExpenseAbs) * 100;
    }

    return {
      prevMonth,
      prevYear,
      prevIncome,
      prevExpenseAbs,
      incomePct,
      expensePct,
    };
  }, [txs, year, month, income, totalExpenseAbs]);

  // Saldo diário acumulado
  const saldoLineData = useMemo(() => {
    if (!txs.length) return { labels: [], datasets: [] as any[] };

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const saldoAnterior = txs
      .filter(t => new Date(t.date) < start)
      .reduce((a, b) => a + Number(b.amount), 0);

    const dailyNet = new Map<string, number>();
    txs.forEach(t => {
      const d = new Date(t.date);
      if (d >= start && d < end) {
        const key = d.toISOString().slice(0, 10);
        dailyNet.set(key, (dailyNet.get(key) || 0) + Number(t.amount));
      }
    });

    const labels: string[] = [];
    const values: number[] = [];
    let running = saldoAnterior;
    const lastDay = new Date(year, month, 0).getDate();

    for (let d = 1; d <= lastDay; d++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(
        d,
      ).padStart(2, '0')}`;
      running += dailyNet.get(key) || 0;
      labels.push(String(d).padStart(2, '0'));
      values.push(running);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Saldo acumulado',
          data: values,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.15)',
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [txs, year, month]);

  // Receitas x Despesas últimos 6 meses
  const monthlyBarData = useMemo(() => {
    if (!txs.length) return { labels: [], datasets: [] as any[] };

    const agg = new Map<string, { income: number; expense: number }>();
    txs.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      const cur = agg.get(key) || { income: 0, expense: 0 };
      if (t.type === 'INCOME') cur.income += Number(t.amount);
      else cur.expense += Number(t.amount);
      agg.set(key, cur);
    });

    const labels: string[] = [];
    const incomes: number[] = [];
    const expenses: number[] = [];

    const ref = new Date(year, month - 1, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(
        d.getFullYear(),
      ).slice(-2)}`;
      const cur = agg.get(key) || { income: 0, expense: 0 };
      labels.push(label);
      incomes.push(cur.income);
      expenses.push(Math.abs(cur.expense));
    }

    return {
      labels,
      datasets: [
        {
          label: 'Receitas',
          data: incomes,
          backgroundColor: '#16a34a',
        },
        {
          label: 'Despesas',
          data: expenses,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [txs, year, month]);

  // Top categorias (mês)
  const topCategoriesData = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const key = t.category?.name || 'Outros';
        map.set(key, (map.get(key) || 0) + Math.abs(Number(t.amount)));
      });

    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 6);

    return {
      labels: top.map(([name]) => name),
      datasets: [
        {
          data: top.map(([, value]) => value),
          backgroundColor: '#0f766e',
        },
      ],
    };
  }, [filtered]);

  // Top locais (descrição) mês
  const topPlacesData = useMemo(() => {
    const map = new Map<string, number>();

    filtered
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const key = t.description?.trim() || 'Sem descrição';
        map.set(key, (map.get(key) || 0) + Math.abs(Number(t.amount)));
      });

    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 8);

    return {
      labels: top.map(([name]) => name),
      datasets: [
        {
          data: top.map(([, value]) => value),
          backgroundColor: '#f97316',
        },
      ],
    };
  }, [filtered]);

  // Despesa por dia da semana
  const weekdayData = useMemo(() => {
    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const sums = Array(7).fill(0);

    filtered
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const d = new Date(t.date);
        const dow = d.getDay();
        sums[dow] += Math.abs(Number(t.amount));
      });

    return {
      labels,
      datasets: [
        {
          label: 'Despesas por dia da semana',
          data: sums,
          backgroundColor: '#6366f1',
        },
      ],
    };
  }, [filtered]);

  // Pizza de categorias
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const key = t.category?.name || 'Outros';
        map.set(key, (map.get(key) || 0) + Math.abs(Number(t.amount)));
      });

    const labels = Array.from(map.keys());
    const values = Array.from(map.values());
    const palette = [
      '#0ea5e9',
      '#22c55e',
      '#f97316',
      '#e11d48',
      '#a855f7',
      '#facc15',
      '#14b8a6',
      '#6366f1',
      '#fb7185',
      '#4b5563',
    ];
    const backgroundColor = labels.map((_, i) => palette[i % palette.length]);

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor,
          borderWidth: 1,
          borderColor: '#fff',
        },
      ],
    };
  }, [filtered]);

  // Destaques do mês
  const monthHighlights = useMemo(() => {
    const expenses = filtered.filter(t => t.type === 'EXPENSE');
    if (!expenses.length) {
      return {
        priciestDay: null as null | { date: string; total: number },
        topExpenses: [] as Tx[],
      };
    }

    const byDay = new Map<string, number>();
    expenses.forEach(t => {
      const dayKey = new Date(t.date).toISOString().slice(0, 10);
      byDay.set(
        dayKey,
        (byDay.get(dayKey) || 0) + Math.abs(Number(t.amount)),
      );
    });

    let priciestDay: { date: string; total: number } | null = null;
    byDay.forEach((total, date) => {
      if (!priciestDay || total > priciestDay.total) {
        priciestDay = { date, total };
      }
    });

    const topExpenses = [...expenses]
      .sort(
        (a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)),
      )
      .slice(0, 3);

    return { priciestDay, topExpenses };
  }, [filtered]);

  // Assinaturas / gastos recorrentes
  const recurringExpenses = useMemo(() => {
    if (!txs.length) return [] as { name: string; avg: number; count: number }[];

    const map = new Map<
      string,
      { name: string; total: number; count: number }
    >();
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - 6);

    txs.forEach(t => {
      if (t.type !== 'EXPENSE') return;
      const d = new Date(t.date);
      if (d < thresholdDate) return;

      const key = (t.description || 'Sem descrição').trim().toLowerCase();
      const existing =
        map.get(key) || {
          name: t.description || 'Sem descrição',
          total: 0,
          count: 0,
        };
      existing.total += Math.abs(Number(t.amount));
      existing.count += 1;
      map.set(key, existing);
    });

    const arr = Array.from(map.values())
      .filter(x => x.count >= 3)
      .map(x => ({
        name: x.name,
        avg: x.total / x.count,
        count: x.count,
      }))
      .sort((a, b) => b.avg * b.count - a.avg * a.count)
      .slice(0, 6);

    return arr;
  }, [txs]);

  // Anos disponíveis
  const years = useMemo(() => {
    const set = new Set<number>();
    txs.forEach(t => set.add(new Date(t.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [txs]);

  // Insights textuais
  const mainCategoryName =
    topCategoriesData.labels && topCategoriesData.labels.length
      ? topCategoriesData.labels[0]
      : null;
  const mainPlaceName =
    topPlacesData.labels && topPlacesData.labels.length
      ? topPlacesData.labels[0]
      : null;

  const insights: string[] = [];
  if (mainCategoryName && totalExpenseAbs > 0) {
    insights.push(
      `Sua categoria com maior gasto foi ${mainCategoryName}, somando ${BRL(
        totalExpenseAbs,
      )} em ${String(month).padStart(2, '0')}/${year}.`,
    );
  }
  if (mainPlaceName && totalExpenseAbs > 0) {
    insights.push(`Você gastou mais em "${mainPlaceName}" neste mês.`);
  }
  if (monthHighlights.priciestDay) {
    const d = new Date(monthHighlights.priciestDay.date);
    insights.push(
      `Seu dia mais caro foi ${d.toLocaleDateString(
        'pt-BR',
      )}, com ${BRL(monthHighlights.priciestDay.total)} em despesas.`,
    );
  }
  if (
    prevComparison &&
    (prevComparison.incomePct != null || prevComparison.expensePct != null)
  ) {
    const { prevMonth, prevYear, incomePct, expensePct } = prevComparison;
    if (incomePct != null) {
      insights.push(
        `Suas receitas variaram ${
          incomePct >= 0 ? 'positivamente' : 'negativamente'
        } em ${incomePct.toFixed(1)}% em relação a ${String(
          prevMonth,
        ).padStart(2, '0')}/${prevYear}.`,
      );
    }
    if (expensePct != null) {
      insights.push(
        `Suas despesas variaram ${
          expensePct >= 0 ? 'para cima' : 'para baixo'
        } em ${expensePct.toFixed(1)}% em relação ao mês anterior.`,
      );
    }
  }
  if (projectedEndBalance !== balance && isCurrentMonth) {
    insights.push(
      `Se mantiver o ritmo atual, você deve terminar o mês com saldo próximo de ${BRL(
        projectedEndBalance,
      )}.`,
    );
  }
  if (!insights.length) {
    insights.push(
      'Registre mais lançamentos para ver um resumo inteligente do mês 😊',
    );
  }

  // Criar lançamento
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.description || form.amount === '' || Number(form.amount) === 0) {
      setToast('Preencha descrição e valor.');
      return;
    }
    setPosting(true);
    const body = {
      ...form,
      amount: Number(
        String(form.amount)
          .replace(/\./g, '')
          .replace(',', '.'),
      ),
    };
    const res = await fetch('/api/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setPosting(false);
    if (!res.ok) return setToast('Erro ao salvar.');
    setToast('Lançamento adicionado!');
    setForm(f => ({ ...f, description: '', amount: '' }));
    descRef.current?.focus();
    loadTx();
  };

  // Deletar lançamento
  const delTx = async (id: number) => {
    if (!confirm('Excluir este lançamento?')) return;
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    setToast('Excluído.');
    loadTx();
  };

  // Criar conta
  const submitAcc = async (e: FormEvent) => {
    e.preventDefault();
    if (!accForm.name.trim())
      return setToast('Informe um nome para a conta.');
    const r = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accForm),
    });
    if (!r.ok) return setToast('Erro ao criar conta.');
    setAccForm({ name: '', type: 'Conta Corrente' });
    setToast('Conta criada!');
    loadAcc();
  };

  // Deletar conta
  const delAcc = async (id: number) => {
    if (
      !confirm(
        'Excluir conta? (Se houver lançamentos vinculados, não será possível)',
      )
    )
      return;
    const r = await fetch(`/api/accounts/${id}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      setToast('Não foi possível excluir esta conta.');
      return;
    }
    setToast('Conta excluída.');
    loadAcc();
  };

  return (
    <div style={s.app}>
      {/* Sidebar (fixa no desktop, flyout no mobile) */}
      {(!isMobile || sidebarOpen) && (
        <>
          {isMobile && (
            <div
              style={s.backdrop}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside
            style={{
              ...s.sidebar,
              ...(isMobile ? s.sidebarMobile : {}),
            }}
          >
            <div style={s.logo}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Gastos</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>controle financeiro</div>
            </div>

            <nav style={s.menu}>
              <MenuItem
                label="Dashboard"
                icon="📊"
                active={tab === 'DASH'}
                onClick={() => {
                  setTab('DASH');
                  if (isMobile) setSidebarOpen(false);
                }}
              />
              <MenuItem
                label="Lançamentos"
                icon="✏️"
                active={tab === 'LANC'}
                onClick={() => {
                  setTab('LANC');
                  if (isMobile) setSidebarOpen(false);
                }}
              />
              <MenuItem
                label="Contas"
                icon="🏦"
                active={tab === 'CONTAS'}
                onClick={() => {
                  setTab('CONTAS');
                  if (isMobile) setSidebarOpen(false);
                }}
              />
            </nav>

            <div style={s.sidebarFooter}>
              <span>{txs.length} lançamentos cadastrados</span>
            </div>
          </aside>
        </>
      )}

      {/* Conteúdo principal */}
      <main style={{ ...s.page, ...(isMobile ? s.pageMobile : {}) }}>
        {/* Header */}
        <header style={s.nav}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                style={s.burger}
              >
                ☰
              </button>
            )}
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {TAB_LABELS[tab]}
              </div>
              {tab === 'DASH' && (
                <div style={s.headerSub}>
                  Visão geral de {String(month).padStart(2, '0')}/{year}
                </div>
              )}
              {tab === 'LANC' && (
                <div style={s.headerSub}>
                  Gerencie seus lançamentos do mês selecionado
                </div>
              )}
              {tab === 'CONTAS' && (
                <div style={s.headerSub}>
                  Configure as contas usadas nos lançamentos
                </div>
              )}
            </div>
          </div>
        </header>

        {/* FILTROS */}
        {(tab === 'DASH' || tab === 'LANC') && (
          <section style={{ ...s.card, padding: 12, marginBottom: 12 }}>
            <div style={s.filters}>
              <div>
                <label style={s.label}>Mês</label>
                <select
                  value={month}
                  onChange={e => setMonth(+e.target.value)}
                  style={s.input}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Ano</label>
                <select
                  value={year}
                  onChange={e => setYear(+e.target.value)}
                  style={s.input}
                >
                  {Array.from(new Set([now.getFullYear(), ...years]))
                    .sort((a, b) => b - a)
                    .map(y => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Tipo</label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as any)}
                  style={s.input}
                >
                  <option value="ALL">Todos</option>
                  <option value="INCOME">Receitas</option>
                  <option value="EXPENSE">Despesas</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Buscar</label>
                <input
                  placeholder="Descrição..."
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  style={s.input}
                />
              </div>
            </div>
          </section>
        )}

        {/* Dash */}
        {tab === 'DASH' && (
          <>
            <section style={s.cardsGrid}>
              <Stat title="Receitas" value={income} />
              <Stat title="Despesas" value={expense} negative />
              <Stat title="Saldo" value={balance} bold />
              <Stat title="Gasto médio diário" value={avgDailyExpense} />
              <Stat
                title="Lançamentos no mês"
                value={totalCount}
                format="integer"
                suffix="lançamentos"
              />
              <Stat
                title="Projeção de saldo no fim do mês"
                value={projectedEndBalance}
              />
            </section>

            <section style={s.chartsGrid}>
              <div style={s.card}>
                <h3 style={s.h3}>Saldo diário acumulado</h3>
                {saldoLineData.labels?.length ? (
                  <div style={{ height: 260 }}>
                    <LineChart data={saldoLineData} options={saldoLineOptions} />
                  </div>
                ) : (
                  <Empty>Sem dados suficientes para calcular o saldo.</Empty>
                )}
              </div>

              <div style={s.card}>
                <h3 style={s.h3}>Receitas x Despesas (últimos 6 meses)</h3>
                {monthlyBarData.labels?.length ? (
                  <div style={{ height: 260 }}>
                    <BarChart data={monthlyBarData} options={barOptions} />
                  </div>
                ) : (
                  <Empty>Sem dados para os últimos meses.</Empty>
                )}
              </div>

              <div style={s.card}>
                <h3 style={s.h3}>Top categorias de despesa (mês)</h3>
                {topCategoriesData.labels?.length ? (
                  <div style={{ height: 260 }}>
                    <BarChart
                      data={topCategoriesData}
                      options={horizontalBarOptions}
                    />
                  </div>
                ) : (
                  <Empty>Sem despesas no período.</Empty>
                )}
              </div>

              <div style={s.card}>
                <h3 style={s.h3}>Locais onde mais gastou (mês)</h3>
                {topPlacesData.labels?.length ? (
                  <div style={{ height: 260 }}>
                    <BarChart
                      data={topPlacesData}
                      options={horizontalBarOptions}
                    />
                  </div>
                ) : (
                  <Empty>Sem despesas no período.</Empty>
                )}
              </div>

              <div style={s.card}>
                <h3 style={s.h3}>Gastos por categoria</h3>
                {pieData.labels?.length ? (
                  <div style={{ height: 260 }}>
                    <PieChart data={pieData} options={pieOptions} />
                  </div>
                ) : (
                  <Empty>Sem dados de despesa no período.</Empty>
                )}
              </div>

              <div style={s.card}>
                <h3 style={s.h3}>Despesas por dia da semana</h3>
                {weekdayData.labels?.length ? (
                  <div style={{ height: 260 }}>
                    <BarChart data={weekdayData} options={barOptions} />
                  </div>
                ) : (
                  <Empty>Sem dados para o período.</Empty>
                )}
              </div>
            </section>

            {/* Destaques + Insights */}
            <section style={s.highlightsGrid}>
              <div style={s.card}>
                <h3 style={s.h3}>Destaques do mês</h3>
                {monthHighlights.priciestDay ? (
                  <>
                    <p style={s.p}>
                      <strong>Dia mais caro:</strong>{' '}
                      {new Date(
                        monthHighlights.priciestDay.date,
                      ).toLocaleDateString('pt-BR')}{' '}
                      ({BRL(monthHighlights.priciestDay.total)})
                    </p>
                    <p style={s.p}>
                      <strong>Maiores gastos individuais:</strong>
                    </p>
                    <ul style={s.ul}>
                      {monthHighlights.topExpenses.map(tx => (
                        <li key={tx.id} style={s.li}>
                          {new Date(tx.date).toLocaleDateString('pt-BR')} —{' '}
                          <strong>{BRL(Math.abs(Number(tx.amount)))}</strong>{' '}
                          {tx.description && `em "${tx.description}"`}{' '}
                          {tx.category?.name && (
                            <span style={{ color: '#6b7280' }}>
                              ({tx.category.name})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <Empty>Sem despesas no período.</Empty>
                )}
              </div>

              <div style={s.card}>
                <h3 style={s.h3}>Resumo do mês</h3>
                <ul style={s.ul}>
                  {insights.map((line, idx) => (
                    <li key={idx} style={s.li}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Assinaturas / recorrentes */}
            <section style={{ marginTop: 16 }}>
              <div style={s.card}>
                <h3 style={s.h3}>Assinaturas / gastos recorrentes</h3>
                {recurringExpenses.length ? (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th>Descrição</th>
                        <th style={{ textAlign: 'right' }}>Valor médio</th>
                        <th style={{ textAlign: 'right' }}>Ocorrências</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringExpenses.map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.name}</td>
                          <td style={{ textAlign: 'right' }}>
                            {BRL(r.avg)}
                          </td>
                          <td style={{ textAlign: 'right' }}>{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Empty>
                    Não identificamos gastos recorrentes (3+ vezes) nos últimos
                    meses.
                  </Empty>
                )}
              </div>
            </section>
          </>
        )}

        {/* Lançamentos */}
        {tab === 'LANC' && (
          <>
            <section style={s.cardsGrid}>
              <Stat title="Receitas" value={income} />
              <Stat title="Despesas" value={expense} negative />
              <Stat title="Saldo" value={balance} bold />
            </section>

            <form onSubmit={submit} style={s.form}>
              <Field label="Data">
                <input
                  type="date"
                  value={form.date}
                  style={s.input}
                  onChange={e =>
                    setForm({ ...form, date: e.target.value })
                  }
                />
              </Field>
              <Field label="Descrição" grow>
                <input
                  ref={descRef}
                  value={form.description}
                  style={s.input}
                  onChange={e =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Valor (R$)">
                <input
                  inputMode="decimal"
                  value={form.amount}
                  placeholder="0,00"
                  style={s.input}
                  onChange={e =>
                    setForm({
                      ...form,
                      amount: e.target.value
                        .replace(/[^\d,.-]/g, '')
                        .replace(/\.(?=.*\.)/g, ''),
                    })
                  }
                />
              </Field>
              <Field label="Tipo">
                <select
                  value={form.type}
                  onChange={e =>
                    setForm({
                      ...form,
                      type: e.target.value as any,
                    })
                  }
                  style={s.input}
                >
                  <option value="EXPENSE">Despesa</option>
                  <option value="INCOME">Receita</option>
                </select>
              </Field>
              <Field label="Conta">
                <input
                  value={form.account}
                  style={s.input}
                  onChange={e =>
                    setForm({
                      ...form,
                      account: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Categoria">
                <input
                  value={form.category}
                  style={s.input}
                  onChange={e =>
                    setForm({
                      ...form,
                      category: e.target.value,
                    })
                  }
                />
              </Field>
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'right',
                }}
              >
                <button disabled={posting} style={s.button}>
                  {posting ? 'Adicionando…' : 'Adicionar'}
                </button>
              </div>
            </form>

            {loading ? (
              <div style={{ padding: 12 }}>Carregando…</div>
            ) : (
              <div style={s.card}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Conta</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => (
                      <tr
                        key={t.id}
                        style={{
                          background: i % 2 ? '#f3f4f6' : undefined,
                        }}
                      >
                        <td>{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                        <td>{t.description}</td>
                        <td>{t.category?.name}</td>
                        <td>{t.account?.name}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            color:
                              t.type === 'EXPENSE' ? '#ef4444' : '#16a34a',
                            fontWeight: 600,
                          }}
                        >
                          {BRL(Number(t.amount))}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => delTx(t.id)}
                            style={s.btnGhost}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && (
                      <tr>
                        <td colSpan={6}>
                          <Empty>Nenhum lançamento no período.</Empty>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Contas */}
        {tab === 'CONTAS' && (
          <section style={{ display: 'grid', gap: 12 }}>
            <div style={s.card}>
              <h3 style={s.h3}>Nova conta</h3>
              <form
                onSubmit={submitAcc}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <Field label="Nome" grow>
                  <input
                    value={accForm.name}
                    onChange={e =>
                      setAccForm(a => ({
                        ...a,
                        name: e.target.value,
                      }))
                    }
                    style={s.input}
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    value={accForm.type}
                    onChange={e =>
                      setAccForm(a => ({
                        ...a,
                        type: e.target.value,
                      }))
                    }
                    style={s.input}
                  >
                    <option>Conta Corrente</option>
                    <option>Cartão</option>
                    <option>Poupança</option>
                    <option>Outros</option>
                  </select>
                </Field>
                <div>
                  <button className="btn" style={s.button}>
                    Criar
                  </button>
                </div>
              </form>
            </div>

            <div style={s.card}>
              <h3 style={s.h3}>Minhas contas</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{a.type}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => delAcc(a.id)}
                          style={s.btnGhost}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!accounts.length && (
                    <tr>
                      <td colSpan={3}>
                        <Empty>Nenhuma conta cadastrada.</Empty>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {toast && (
          <div style={s.toast} onAnimationEnd={() => setToast(null)}>
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}

/* UI helpers */

function MenuItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...s.menuItem,
        ...(active ? s.menuItemActive : {}),
      }}
    >
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

function Stat({
  title,
  value,
  negative,
  bold,
  format = 'currency',
  suffix,
}: {
  title: string;
  value: number;
  negative?: boolean;
  bold?: boolean;
  format?: 'currency' | 'integer';
  suffix?: string;
}) {
  const color =
    format === 'currency'
      ? negative
        ? '#ef4444'
        : value >= 0
        ? '#16a34a'
        : '#ef4444'
      : '#111827';

  const display =
    format === 'currency'
      ? BRL(value)
      : `${value.toFixed(0)}${suffix ? ` ${suffix}` : ''}`;

  return (
    <div style={s.card}>
      <div style={{ fontSize: 12, color: '#667085' }}>{title}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: bold ? 700 : 600,
          color,
        }}
      >
        {display}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 8, color: '#667085' }}>{children}</div>;
}

/* styles */
const s: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    minHeight: '100vh',
    background: '#e5e7eb',
    fontFamily: 'Inter, system-ui, Segoe UI, Roboto, Arial',
  },

  /* SIDEBAR */
  sidebar: {
    width: 240,
    background:
      'linear-gradient(180deg, #0369a1 0%, #0ea5e9 35%, #0f766e 100%)',
    color: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    padding: '18px 16px',
    boxSizing: 'border-box',
    boxShadow: '4px 0 24px rgba(15,23,42,0.25)',
  },
  sidebarMobile: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 40,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.55)',
    zIndex: 30,
  },
  logo: {
    marginBottom: 28,
  },
  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '10px 12px',
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    color: 'rgba(241,245,249,0.92)',
    cursor: 'pointer',
    fontSize: 14,
    textAlign: 'left',
    gap: 8,
  },
  menuItemActive: {
    background: 'rgba(15,23,42,0.24)',
    boxShadow: '0 0 0 1px rgba(15,23,42,0.28), 0 10px 22px rgba(15,23,42,0.35)',
    color: '#f9fafb',
  },
  sidebarFooter: {
    marginTop: 18,
    borderTop: '1px solid rgba(15,23,42,0.32)',
    paddingTop: 10,
    fontSize: 12,
    color: 'rgba(226,232,240,0.9)',
  },

  /* CONTEÚDO PRINCIPAL */
  page: {
    flex: 1,
    padding: 24,
    maxWidth: 1300,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  pageMobile: {
    padding: 16,
  },

  /* HEADER */
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  burger: {
    border: 'none',
    background: '#0f172a',
    color: '#f9fafb',
    borderRadius: 999,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(15,23,42,0.35)',
  },

  /* CARDS */
  card: {
    borderRadius: 18,
    padding: 18,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    boxShadow:
      '0 18px 45px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.01)',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
    gap: 16,
    marginBottom: 12,
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
    gap: 18,
    marginTop: 14,
  },
  highlightsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
    gap: 18,
    marginTop: 14,
  },

  /* FORM / FILTROS */
  form: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    margin: '12px 0',
    borderRadius: 18,
    padding: 20,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
  },
  filters: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  input: {
    borderRadius: 999,
    padding: '10px 14px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
    background: '#f9fafb',
    boxSizing: 'border-box',
    border: '1px solid #e5e7eb',
  },

  /* BOTÕES */
  button: {
    background: 'linear-gradient(90deg, #0ea5e9, #14b8a6)',
    color: '#fff',
    border: 0,
    borderRadius: 999,
    padding: '10px 22px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 0.2,
  },
  btnGhost: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    padding: '7px 16px',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: 13,
    color: '#374151',
  },

  /* TABELA */
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    boxSizing: 'border-box',
    fontSize: 14,
  },

  h3: {
    margin: '0 0 14px 0',
    fontWeight: 600,
    color: '#111827',
    fontSize: 15,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /* TOAST */
  toast: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    background: '#22c55e',
    color: '#fff',
    padding: '10px 18px',
    borderRadius: 999,
    fontWeight: 600,
    boxShadow: '0 20px 40px rgba(22,163,74,0.35)',
    fontSize: 13,
  },

  ul: {
    margin: 0,
    paddingLeft: 18,
  },
  li: {
    fontSize: 14,
    marginBottom: 4,
    color: '#374151',
  },
  p: {
    margin: '0 0 8px 0',
    fontSize: 14,
    color: '#374151',
  },
};
