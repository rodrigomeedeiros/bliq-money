import React, { useState, useEffect, useMemo } from 'react';
import { FinanceState, MonthKey, Transaction, Category, UserProfile } from './types';
import { MONTHS, INITIAL_CATEGORIES } from './constants';
import Dashboard from './Dashboard';
import TransactionForm from './TransactionForm';
import { getFinancialAdvice } from './geminiService';
import { authService } from './authService';

type AuthView = 'login' | 'signup' | 'forgot';
type MobileTab = 'home' | 'records' | 'ai';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('bliq_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authView, setAuthView] = useState<AuthView>('login');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [email, setEmail] = useState(localStorage.getItem('bliq_remember_email') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [state, setState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem('bliq_money_v1');
    if (saved) return JSON.parse(saved);
    
    const initialMonths: { [key in MonthKey]?: any } = {};
    MONTHS.forEach(m => {
      initialMonths[m] = { transactions: [], settings: { carryOverBalance: false } };
    });
    return { months: initialMonths, categories: INITIAL_CATEGORIES };
  });

  const [currentMonth, setCurrentMonth] = useState<MonthKey>(MONTHS[new Date().getMonth()]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('bliq_money_v1', JSON.stringify(state));
      localStorage.setItem('bliq_current_user', JSON.stringify(currentUser));
    }
  }, [state, currentUser]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (authView === 'login') {
        const session = await authService.login(email, password, rememberMe);
        setCurrentUser(session.user);
        if (rememberMe) localStorage.setItem('bliq_remember_email', email);
        else localStorage.removeItem('bliq_remember_email');
      } else if (authView === 'signup') {
        const session = await authService.signup(name, email, password, birthDate);
        setCurrentUser(session.user);
      } else {
        await authService.resetPassword(email);
        alert("Instruções de recuperação enviadas para seu e-mail.");
        setAuthView('login');
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('bliq_current_user');
  };

  const calculateBalanceChain = (targetMonth: MonthKey): number => {
    let cumulative = 0;
    const targetIdx = MONTHS.indexOf(targetMonth);
    for (let i = 0; i <= targetIdx; i++) {
      const mKey = MONTHS[i];
      const mData = state.months[mKey];
      if (!mData) continue;
      if (i > 0 && !mData.settings.carryOverBalance) cumulative = 0;
      const mIncome = mData.transactions
        .filter(t => t.type === 'INCOME' && t.status === 'CONFIRMED')
        .reduce((sum, t) => sum + t.amount, 0);
      const mExpense = mData.transactions
        .filter(t => t.type === 'EXPENSE' && t.status === 'CONFIRMED')
        .reduce((sum, t) => sum + t.amount, 0);
      cumulative += (mIncome - mExpense);
    }
    return cumulative;
  };

  const currentMonthData = state.months[currentMonth] || { transactions: [], settings: { carryOverBalance: false } };

  const totals = useMemo(() => {
    const txs = currentMonthData.transactions;
    const prevIdx = MONTHS.indexOf(currentMonth) - 1;
    const carryAmount = (currentMonthData.settings.carryOverBalance && prevIdx >= 0) 
      ? calculateBalanceChain(MONTHS[prevIdx]) 
      : 0;
    const confirmedIncome = txs.filter(t => t.type === 'INCOME' && t.status === 'CONFIRMED').reduce((a, b) => a + b.amount, 0);
    const confirmedExpense = txs.filter(t => t.type === 'EXPENSE' && t.status === 'CONFIRMED').reduce((a, b) => a + b.amount, 0);
    const pendingIncome = txs.filter(t => t.type === 'INCOME' && t.status === 'PENDING').reduce((a, b) => a + b.amount, 0);
    const pendingExpense = txs.filter(t => t.type === 'EXPENSE' && t.status === 'PENDING').reduce((a, b) => a + b.amount, 0);
    return {
      carryAmount,
      income: confirmedIncome,
      expense: confirmedExpense,
      pendingIncome,
      pendingExpense,
      net: carryAmount + confirmedIncome - confirmedExpense,
      projected: carryAmount + (confirmedIncome + pendingIncome) - (confirmedExpense + pendingExpense)
    };
  }, [state, currentMonth]);

  const filteredTransactions = useMemo(() => {
    return currentMonthData.transactions.filter(t => {
      const matchSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'ALL' || t.type === filterType;
      return matchSearch && matchType;
    });
  }, [currentMonthData, searchTerm, filterType]);

  const handleSaveTransaction = (newTx: Omit<Transaction, 'id'> | Transaction) => {
    setState(prev => {
      const currentMonthTxs = [...(prev.months[currentMonth]?.transactions || [])];
      if ('id' in newTx) {
        const index = currentMonthTxs.findIndex(t => t.id === newTx.id);
        if (index !== -1) currentMonthTxs[index] = newTx as Transaction;
      } else {
        const tx: Transaction = { ...newTx, id: Math.random().toString(36).substring(2, 9) };
        currentMonthTxs.unshift(tx);
      }
      return {
        ...prev,
        months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: currentMonthTxs } }
      };
    });
    setEditingTransaction(null);
    setIsModalOpen(false);
  };

  const handleQuickConfirm = (id: string) => {
    setState(prev => {
      const currentMonthTxs = [...(prev.months[currentMonth]?.transactions || [])];
      const index = currentMonthTxs.findIndex(t => t.id === id);
      if (index !== -1) currentMonthTxs[index] = { ...currentMonthTxs[index], status: 'CONFIRMED' };
      return {
        ...prev,
        months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: currentMonthTxs } }
      };
    });
  };

  const toggleCarryOver = () => {
    setState(prev => ({
      ...prev,
      months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, settings: { ...prev.months[currentMonth]!.settings, carryOverBalance: !prev.months[currentMonth]!.settings.carryOverBalance } } }
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    setState(prev => ({
      ...prev,
      months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: prev.months[currentMonth]!.transactions.filter(t => t.id !== id) } }
    }));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex flex-col lg:flex-row font-sans p-6 items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-lime-500 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
              <i className="fa-solid fa-bolt-lightning text-2xl text-black"></i>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter">BLIQ MONEY</h1>
          </div>
          {authError && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl text-xs font-black uppercase mb-6">{authError}</div>}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authView === 'signup' && (
              <input required type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold" />
            )}
            <input required type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold" />
            {authView !== 'forgot' && (
              <input required type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold" />
            )}
            <button disabled={isAuthLoading} type="submit" className="w-full bg-white text-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
              {isAuthLoading ? 'Processando...' : authView === 'login' ? 'Entrar' : 'Começar Agora'}
            </button>
          </form>
          <button onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')} className="w-full mt-6 text-xs text-slate-500 font-bold uppercase hover:text-white transition-colors">
            {authView === 'login' ? 'Não tem conta? Crie uma grátis' : 'Já tem conta? Faça o login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 py-4 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-lime-500 rounded-lg flex items-center justify-center"><i className="fa-solid fa-bolt-lightning text-black"></i></div>
            <h1 className="text-lg font-black tracking-tighter">BLIQ <span className="text-lime-400">MONEY</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <select value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value as MonthKey)} className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black uppercase text-white outline-none">
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={handleLogout} className="text-slate-500 hover:text-rose-500"><i className="fa-solid fa-power-off"></i></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 pb-32">
        <div className={`${activeTab === 'home' ? 'block' : 'hidden'} lg:block space-y-6`}>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
             <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Abertura</span>
                <div className="text-md font-black">R$ {totals.carryAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <span className="text-[9px] font-black text-lime-400 uppercase block mb-1">Realizado</span>
                <div className="text-md font-black">R$ {(totals.income - totals.expense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-rose-600 p-4 rounded-xl border border-white/10">
                <span className="text-[9px] font-black text-white/60 uppercase block mb-1">Saldo Atual</span>
                <div className="text-md font-black">R$ {totals.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <span className="text-[9px] font-black text-amber-400 uppercase block mb-1">Projetado</span>
                <div className="text-md font-black">R$ {totals.projected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </section>
          <Dashboard data={state} />
        </div>

        <div className={`${activeTab === 'records' ? 'block' : 'hidden'} lg:block mt-6`}>
           <div className="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 flex gap-2">
                 <button onClick={() => setFilterType('ALL')} className={`flex-1 py-1 rounded-lg text-[8px] font-black ${filterType === 'ALL' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>TODOS</button>
                 <button onClick={() => setFilterType('INCOME')} className={`flex-1 py-1 rounded-lg text-[8px] font-black ${filterType === 'INCOME' ? 'text-lime-400' : 'text-slate-600'}`}>RECEITAS</button>
                 <button onClick={() => setFilterType('EXPENSE')} className={`flex-1 py-1 rounded-lg text-[8px] font-black ${filterType === 'EXPENSE' ? 'text-rose-500' : 'text-slate-600'}`}>DESPESAS</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredTransactions.map(tx => (
                  <div key={tx.id} className="p-4 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">{tx.description}</div>
                      <div className="text-[8px] text-slate-600 font-bold uppercase">{tx.category} • {tx.status === 'CONFIRMED' ? 'Efetuado' : 'Pendente'}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black ${tx.type === 'INCOME' ? 'text-lime-400' : 'text-white'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'} {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="flex gap-2 justify-end mt-1">
                        <button onClick={() => setEditingTransaction(tx)} className="text-slate-600 text-[10px]"><i className="fa-solid fa-pen"></i></button>
                        <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-600 text-[10px]"><i className="fa-solid fa-trash"></i></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>

        <div className={`${activeTab === 'ai' ? 'block' : 'hidden'} lg:block mt-6`}>
           <div className="bg-slate-900 p-6 rounded-2xl border border-white/5">
              <h3 className="font-black text-xs uppercase mb-4 text-center">Estratégia Bliq IA</h3>
              <button onClick={async () => { setIsAiLoading(true); const advice = await getFinancialAdvice(currentMonth, currentMonthData.transactions); setAiInsight(advice); setIsAiLoading(false); }} disabled={isAiLoading} className="w-full bg-white text-black py-4 rounded-xl font-black text-xs uppercase active:scale-95 transition-all">{isAiLoading ? 'Analisando...' : 'Gerar Insight'}</button>
              {aiInsight && <div className="mt-6 text-[10px] text-slate-400 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5">{aiInsight}</div>}
           </div>
        </div>
      </main>

      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] z-[100]">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2rem] h-16 flex items-center justify-around px-2 shadow-2xl">
          <button onClick={() => setActiveTab('home')} className={`w-12 h-12 flex items-center justify-center rounded-xl ${activeTab === 'home' ? 'text-lime-400' : 'text-slate-500'}`}><i className="fa-solid fa-house"></i></button>
          <button onClick={() => setActiveTab('records')} className={`w-12 h-12 flex items-center justify-center rounded-xl ${activeTab === 'records' ? 'text-lime-400' : 'text-slate-500'}`}><i className="fa-solid fa-list-check"></i></button>
          <button onClick={() => setIsModalOpen(true)} className="w-14 h-14 bg-lime-500 text-black rounded-full flex items-center justify-center shadow-lg -translate-y-4 border-4 border-black active:scale-90 transition-all"><i className="fa-solid fa-plus text-xl"></i></button>
          <button onClick={() => setActiveTab('ai')} className={`w-12 h-12 flex items-center justify-center rounded-xl ${activeTab === 'ai' ? 'text-lime-400' : 'text-slate-500'}`}><i className="fa-solid fa-brain"></i></button>
          <button onClick={handleLogout} className="w-12 h-12 flex items-center justify-center text-slate-500"><i className="fa-solid fa-power-off"></i></button>
        </div>
      </div>

      {(isModalOpen || editingTransaction) && (
        <TransactionForm categories={state.categories} initialData={editingTransaction || undefined} onSave={handleSaveTransaction} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }} />
      )}
    </div>
  );
};

export default App;