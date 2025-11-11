// src/pages/index.tsx
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, PointElement, LineElement,
} from 'chart.js';
if (typeof window !== 'undefined') {
  ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);
}
const PieChart = dynamic(() => import('react-chartjs-2').then(m => m.Pie), { ssr: false });
const LineChart = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false });

type Tx = {
  id: number; date: string; description: string;
  type: 'INCOME' | 'EXPENSE'; amount: number;
  category?: { name: string }; account?: { name: string };
};
type Account = { id: number; name: string; type: string };

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Home() {
  // tab: dashboard | lanc | contas
  const [tab, setTab] = useState<'DASH' | 'LANC' | 'CONTAS'>('DASH');

  // dados
  const [txs, setTxs] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // form lançamento
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '' as string | number,
    type: 'EXPENSE' as 'EXPENSE' | 'INCOME',
    category: 'Outros',
    account: 'Conta Corrente',
  });
  const descRef = useRef<HTMLInputElement>(null);

  // form conta
  const [accForm, setAccForm] = useState({ name: '', type: 'Conta Corrente' });

  // filtros
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const loadTx = async () => {
    const r = await fetch('/api/transactions'); setTxs(await r.json()); setLoading(false);
  };
  const loadAcc = async () => {
    const r = await fetch('/api/accounts'); setAccounts(await r.json());
  };

  useEffect(() => { loadTx(); loadAcc(); const id = setInterval(loadTx, 8000); return () => clearInterval(id); }, []);

  // criar lançamento
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.description || form.amount === '' || Number(form.amount) === 0) { setToast('Preencha descrição e valor.'); return; }
    setPosting(true);
    const body = { ...form, amount: Number(String(form.amount).replace(/\./g, '').replace(',', '.')) };
    const res = await fetch('/api/new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setPosting(false);
    if (!res.ok) return setToast('Erro ao salvar.');
    setToast('Lançamento adicionado!'); setForm(f => ({ ...f, description: '', amount: '' })); descRef.current?.focus(); loadTx();
  };

  // deletar lançamento
  const delTx = async (id: number) => {
    if (!confirm('Excluir este lançamento?')) return;
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    setToast('Excluído.'); loadTx();
  };

  // criar conta
  const submitAcc = async (e: FormEvent) => {
    e.preventDefault();
    if (!accForm.name.trim()) return setToast('Informe um nome para a conta.');
    const r = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accForm) });
    if (!r.ok) return setToast('Erro ao criar conta.');
    setAccForm({ name: '', type: 'Conta Corrente' }); setToast('Conta criada!'); loadAcc();
  };

  // deletar conta
  const delAcc = async (id: number) => {
    if (!confirm('Excluir conta? (Se houver lançamentos vinculados, não será possível)')) return;
    const r = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (!r.ok) { setToast('Não foi possível excluir esta conta.'); return; }
    setToast('Conta excluída.'); loadAcc();
  };

  // dataset filtrado
  const filtered = useMemo(() => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return txs
      .filter((t) => { const d = new Date(t.date); return d >= start && d < end; })
      .filter((t) => (q.trim() ? t.description.toLowerCase().includes(q.trim().toLowerCase()) : true))
      .filter((t) => (typeFilter === 'ALL' ? true : t.type === typeFilter))
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [txs, year, month, q, typeFilter]);

  const income = filtered.filter((t) => t.type === 'INCOME').reduce((a, b) => a + Number(b.amount), 0);
  const expense = filtered.filter((t) => t.type === 'EXPENSE').reduce((a, b) => a + Number(b.amount), 0);
  const balance = income + expense;

  // charts
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.filter((t) => t.type === 'EXPENSE').forEach((t) => {
      const key = t.category?.name || 'Outros';
      map.set(key, (map.get(key) || 0) + Math.abs(Number(t.amount)));
    });
    return { labels: Array.from(map.keys()), datasets: [{ data: Array.from(map.values()) }] };
  }, [filtered]);

  const lineData = useMemo(() => {
    const daily = new Map<string, number>();
    filtered.forEach((t) => {
      const key = new Date(t.date).toISOString().slice(0, 10);
      daily.set(key, (daily.get(key) || 0) + Number(t.amount));
    });
    const last = new Date(year, month, 0).getDate();
    let acc = 0; const labels: string[] = []; const values: number[] = [];
    for (let d = 1; d <= last; d++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      acc += daily.get(key) || 0; labels.push(String(d).padStart(2, '0')); values.push(acc);
    }
    return { labels, datasets: [{ data: values }] };
  }, [filtered, year, month]);

  // anos distintos dos dados
  const years = useMemo(() => {
    const set = new Set<number>(); txs.forEach((t) => set.add(new Date(t.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [txs]);

  return (
    <main style={s.page}>
      {/* NAV */}
      <nav style={s.nav}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>Gastos</div>
        <div style={s.tabs}>
          <Tab label="Dash" active={tab === 'DASH'} onClick={() => setTab('DASH')} />
          <Tab label="Lançamentos" active={tab === 'LANC'} onClick={() => setTab('LANC')} />
          <Tab label="Contas" active={tab === 'CONTAS'} onClick={() => setTab('CONTAS')} />
        </div>
        <div style={{ opacity: .6, fontSize: 12 }}>{txs.length} lançamentos</div>
      </nav>

      {/* FILTROS (presentes em Dash e Lançamentos) */}
      {(tab === 'DASH' || tab === 'LANC') && (
        <section style={{ ...s.card, padding: 12, marginBottom: 12 }}>
          <div style={s.filters}>
            <div>
              <label style={s.label}>Mês</label>
              <select value={month} onChange={(e) => setMonth(+e.target.value)} style={s.input}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Ano</label>
              <select value={year} onChange={(e) => setYear(+e.target.value)} style={s.input}>
                {Array.from(new Set([now.getFullYear(), ...years])).sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Tipo</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} style={s.input}>
                <option value="ALL">Todos</option>
                <option value="INCOME">Receitas</option>
                <option value="EXPENSE">Despesas</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Buscar</label>
              <input placeholder="Descrição..." value={q} onChange={(e) => setQ(e.target.value)} style={s.input} />
            </div>
          </div>
        </section>
      )}

      {/* DASHBOARD */}
      {tab === 'DASH' && (
        <>
          <section style={s.cardsGrid}>
            <Stat title="Receitas" value={income} />
            <Stat title="Despesas" value={expense} negative />
            <Stat title="Saldo" value={balance} bold />
          </section>
          <section style={s.chartsGrid}>
            <div style={s.card}>
              <h3 style={s.h3}>Gastos por categoria</h3>
              {pieData.labels?.length ? <PieChart data={pieData} /> : <Empty>Sem dados de despesa no período.</Empty>}
            </div>
            <div style={s.card}>
              <h3 style={s.h3}>Saldo acumulado (dia)</h3>
              <LineChart data={lineData} />
            </div>
          </section>
        </>
      )}

      {/* LANÇAMENTOS */}
      {tab === 'LANC' && (
        <>
          <section style={s.cardsGrid}>
            <Stat title="Receitas" value={income} />
            <Stat title="Despesas" value={expense} negative />
            <Stat title="Saldo" value={balance} bold />
          </section>

          <form onSubmit={submit} style={s.form}>
            <Field label="Data">
              <input type="date" value={form.date} style={s.input}
                     onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Descrição" grow>
              <input ref={descRef} value={form.description} style={s.input}
                     onChange={(e) => setForm({ ...form, description: e.target.value })}
                     onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.form as any)?.requestSubmit()} />
            </Field>
            <Field label="Valor (R$)">
              <input inputMode="decimal" value={form.amount} placeholder="0,00" style={s.input}
                     onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d,.-]/g, '').replace(/\.(?=.*\.)/g, '') })}/>
            </Field>
            <Field label="Tipo">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} style={s.input}>
                <option value="EXPENSE">Despesa</option><option value="INCOME">Receita</option>
              </select>
            </Field>
            <Field label="Conta">
              <input value={form.account} style={s.input} onChange={(e) => setForm({ ...form, account: e.target.value })}/>
            </Field>
            <Field label="Categoria">
              <input value={form.category} style={s.input} onChange={(e) => setForm({ ...form, category: e.target.value })}/>
            </Field>
            <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
              <button disabled={posting} style={s.button}>{posting ? 'Adicionando…' : 'Adicionar'}</button>
            </div>
          </form>

          {loading ? (
            <div style={{ padding: 12 }}>Carregando…</div>
          ) : (
            <div style={s.card}>
              <table style={s.table}>
                <thead>
                  <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th style={{textAlign:'right'}}>Valor</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.id} style={{ background: i % 2 ? '#fafafa' : undefined }}>
                      <td>{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                      <td>{t.description}</td>
                      <td>{t.category?.name}</td>
                      <td>{t.account?.name}</td>
                      <td style={{ textAlign:'right', color: t.type==='EXPENSE' ? '#ef4444' : '#16a34a', fontWeight:600 }}>
                        {BRL(Number(t.amount))}
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <button onClick={() => delTx(t.id)} style={s.btnGhost}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={6}><Empty>Nenhum lançamento no período.</Empty></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* CONTAS */}
      {tab === 'CONTAS' && (
        <section style={{ display:'grid', gap:12 }}>
          <div style={s.card}>
            <h3 style={s.h3}>Nova conta</h3>
            <form onSubmit={submitAcc} style={{ display:'flex', gap:8, alignItems:'end', flexWrap:'wrap' }}>
              <Field label="Nome" grow>
                <input value={accForm.name} onChange={(e) => setAccForm(a => ({ ...a, name: e.target.value }))} style={s.input}/>
              </Field>
              <Field label="Tipo">
                <select value={accForm.type} onChange={(e) => setAccForm(a => ({ ...a, type: e.target.value }))} style={s.input}>
                  <option>Conta Corrente</option><option>Cartão</option><option>Poupança</option><option>Outros</option>
                </select>
              </Field>
              <div><button className="btn" style={s.button}>Criar</button></div>
            </form>
          </div>

          <div style={s.card}>
            <h3 style={s.h3}>Minhas contas</h3>
            <table style={s.table}>
              <thead><tr><th>Nome</th><th>Tipo</th><th style={{textAlign:'right'}}>Ações</th></tr></thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td>{a.name}</td><td>{a.type}</td>
                    <td style={{ textAlign:'right' }}>
                      <button onClick={() => delAcc(a.id)} style={s.btnGhost}>Excluir</button>
                    </td>
                  </tr>
                ))}
                {!accounts.length && <tr><td colSpan={3}><Empty>Nenhuma conta cadastrada.</Empty></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {toast && <div style={s.toast} onAnimationEnd={() => setToast(null)}>{toast}</div>}
    </main>
  );
}

/* UI helpers */
function Tab({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 12,
        border: '1px solid #e5e7eb',
        background: active ? '#111827' : '#fff',
        color: active ? '#fff' : '#111',
        cursor: 'pointer'
      }}>
      {label}
    </button>
  );
}
function Stat({ title, value, negative, bold }: { title: string; value: number; negative?: boolean; bold?: boolean }) {
  const color = negative ? '#ef4444' : value >= 0 ? '#16a34a' : '#ef4444';
  return (
    <div style={s.card}>
      <div style={{ fontSize: 12, color: '#667085' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: bold ? 700 : 600, color }}>{BRL(value)}</div>
    </div>
  );
}
function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div style={{ minWidth: 160, ...(grow ? { flex: 1 } : {}) }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 8, color: '#667085' }}>{children}</div>;
}

/* styles */
const s: Record<string, React.CSSProperties> = {
  page: { padding: 24, maxWidth: 1100, margin: '0 auto', fontFamily: 'Inter, system-ui, Segoe UI, Roboto, Arial', background: '#f8fafc' },
  nav: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 },
  tabs: { display:'flex', gap:8 },
  card: { border: '1px solid #eee', borderRadius: 16, padding: 16, background: '#fff', boxShadow: '0 1px 0 rgba(0,0,0,.03)' },
  cardsGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12, marginBottom:12 },
  chartsGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:12, margin:'12px 0' },
  form: { display:'flex', gap:8, flexWrap:'wrap', alignItems:'end', margin:'12px 0', border:'1px solid #eee', borderRadius:16, padding:12, background:'#fff' },
  filters: { display:'flex', gap:8, flexWrap:'wrap' },
  input: { border:'1px solid #e5e7eb', borderRadius:10, padding:'8px 10px', outline:'none', width:'100%', background:'#fff' },
  button: { background:'#111827', color:'#fff', border:0, borderRadius:10, padding:'10px 16px', cursor:'pointer' },
  btnGhost: { background:'#fff', border:'1px solid #e5e7eb', padding:'6px 10px', borderRadius:10, cursor:'pointer' },
  table: { width:'100%', borderCollapse:'collapse' },
  h3: { margin:'0 0 8px 0' },
  label: { display:'block', fontSize:12, color:'#667085', marginBottom:4 },
  toast: { position:'fixed', right:16, bottom:16, background:'#111827', color:'#fff', padding:'10px 14px', borderRadius:10, animation:'fadeout 2.2s forwards' },
};
