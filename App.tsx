import React, { useState, useEffect, useMemo } from 'react';
import { FinanceState, MonthKey, Transaction, Category, UserProfile } from './types';
import { MONTHS, INITIAL_CATEGORIES } from './constants';
import Dashboard from './Dashboard';
import TransactionForm from './TransactionForm';
import { getFinancialAdvice } from './geminiService';
import { authService } from './authService';

type MobileTab = 'home' | 'records' | 'ai';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('bliq_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isLocked, setIsLocked] = useState(!!currentUser);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const handleUnlock = () => setIsLocked(false);

  const handleAuthSubmit = async (e: React.FormEvent, email: string, pass: string, name?: string) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (authView === 'login') {
        const session = await authService.login(email, pass, true);
        setCurrentUser(session.user);
        setIsLocked(false);
      } else {
        const session = await authService.signup(name || 'Usuário', email, pass, '');
        setCurrentUser(session.user);
        setIsLocked(false);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const currentMonthData = state.months[currentMonth] || { transactions: [], settings: { carryOverBalance: false } };

  const totals = useMemo(() => {
    const txs = currentMonthData.transactions;
    const confirmedIncome = txs.filter(t => t.type === 'INCOME' && t.status === 'CONFIRMED').reduce((a, b) => a + b.amount, 0);
    const confirmedExpense = txs.filter(t => t.type === 'EXPENSE' && t.status === 'CONFIRMED').reduce((a, b) => a + b.amount, 0);
    const pendingIncome = txs.filter(t => t.type === 'INCOME' && t.status === 'PENDING').reduce((a, b) => a + b.amount, 0);
    const pendingExpense = txs.filter(t => t.type === 'EXPENSE' && t.status === 'PENDING').reduce((a, b) => a + b.amount, 0);
    
    return {
      income: confirmedIncome,
      expense: confirmedExpense,
      net: confirmedIncome - confirmedExpense,
      projected: (confirmedIncome + pendingIncome) - (confirmedExpense + pendingExpense)
    };
  }, [state, currentMonth]);

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
      const currentMonthTxs = [...(prev.months[currentMonth]?.transactions || [])].map(tx => 
        tx.id === id ? { ...tx, status: 'CONFIRMED' as const } : tx
      );
      return {
        ...prev,
        months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: currentMonthTxs } }
      };
    });
  };

  // Added handleDeleteTransaction to fix "Cannot find name 'handleDeleteTransaction'" error.
  const handleDeleteTransaction = (id: string) => {
    setState(prev => {
      const currentMonthTxs = (prev.months[currentMonth]?.transactions || []).filter(tx => tx.id !== id);
      return {
        ...prev,
        months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: currentMonthTxs } }
      };
    });
  };

  if (currentUser && isLocked) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-lime-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-lime-500/20">
           <i className="fa-solid fa-bolt-lightning text-2xl text-black"></i>
        </div>
        <h1 className="text-xl font-bold text-white mb-8">Olá, {currentUser.name.split(' ')[0]}</h1>
        <button onClick={handleUnlock} className="bg-white text-black px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">Desbloquear App</button>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-10 safe-top-padding">
        <div className="w-14 h-14 bg-lime-500 rounded-2xl flex items-center justify-center mb-6"><i className="fa-solid fa-bolt-lightning text-xl text-black"></i></div>
        <h1 className="text-3xl font-black mb-8 tracking-tighter">BLIQ <span className="text-lime-500">MONEY</span></h1>
        
        <form onSubmit={(e) => {
            const fd = new FormData(e.currentTarget);
            handleAuthSubmit(e, fd.get('email') as string, fd.get('pass') as string, fd.get('name') as string);
          }} className="w-full max-w-sm space-y-4">
          {authView === 'signup' && <input name="name" required placeholder="Seu Nome" className="w-full bg-slate-900 border border-white/5 rounded-xl px-6 py-4 text-white font-semibold" />}
          <input name="email" required type="email" placeholder="E-mail" className="w-full bg-slate-900 border border-white/5 rounded-xl px-6 py-4 text-white font-semibold" />
          <input name="pass" required type="password" placeholder="Senha" className="w-full bg-slate-900 border border-white/5 rounded-xl px-6 py-4 text-white font-semibold" />
          <button type="submit" className="w-full bg-white text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest mt-4 active:scale-95 transition-all">{isAuthLoading ? 'Aguarde...' : authView === 'login' ? 'Entrar' : 'Cadastrar'}</button>
        </form>
        <button onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')} className="mt-8 text-[10px] text-slate-500 font-bold uppercase tracking-widest">{authView === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Login'}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
      {/* HEADER PREMIUM */}
      <header className="bg-black/80 backdrop-blur-2xl border-b border-white/5 safe-top-padding z-50">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-lime-500 rounded-lg flex items-center justify-center"><i className="fa-solid fa-bolt-lightning text-xs text-black"></i></div>
            <span className="font-black text-sm tracking-tighter uppercase">Bliq <span className="text-lime-500">Money</span></span>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={currentMonth} 
              onChange={(e) => setCurrentMonth(e.target.value as MonthKey)} 
              className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase text-white outline-none"
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={() => setIsLocked(true)} className="text-slate-600"><i className="fa-solid fa-lock text-sm"></i></button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL SCROLLÁVEL */}
      <main className="scroll-container px-6 pt-6 pb-32">
        {/* DASHBOARD TAB */}
        <div className={`${activeTab === 'home' ? 'block' : 'hidden'} space-y-6`}>
          {/* CARD DE SALDO DINÂMICO */}
          <section className={`p-8 rounded-[2rem] transition-colors duration-500 shadow-xl ${totals.net >= 0 ? 'bg-lime-500' : 'bg-rose-600'}`}>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-2 ${totals.net >= 0 ? 'text-black/60' : 'text-white/60'}`}>Saldo Disponível</span>
            <div className={`text-4xl font-black tracking-tighter ${totals.net >= 0 ? 'text-black' : 'text-white'}`}>
              R$ {totals.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className={`mt-6 pt-6 border-t ${totals.net >= 0 ? 'border-black/5' : 'border-white/10'} flex justify-between`}>
               <div>
                 <span className={`text-[9px] font-bold uppercase block ${totals.net >= 0 ? 'text-black/50' : 'text-white/50'}`}>Recebido</span>
                 <span className={`text-sm font-black ${totals.net >= 0 ? 'text-black' : 'text-white'}`}>R$ {totals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
               </div>
               <div className="text-right">
                 <span className={`text-[9px] font-bold uppercase block ${totals.net >= 0 ? 'text-black/50' : 'text-white/50'}`}>Gasto Real</span>
                 <span className={`text-sm font-black ${totals.net >= 0 ? 'text-black' : 'text-white'}`}>R$ {totals.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
               </div>
            </div>
          </section>

          <Dashboard data={state} />
        </div>

        {/* RECORDS TAB */}
        <div className={`${activeTab === 'records' ? 'block' : 'hidden'} space-y-4`}>
           <div className="flex gap-2 mb-4">
             {['ALL', 'INCOME', 'EXPENSE'].map(type => (
               <button 
                 key={type} 
                 onClick={() => setFilterType(type as any)}
                 className={`flex-1 py-3 rounded-xl text-[9px] font-black transition-all ${filterType === type ? 'bg-white text-black' : 'bg-slate-900 text-slate-500 border border-white/5'}`}
               >
                 {type === 'ALL' ? 'TODOS' : type === 'INCOME' ? 'GANHOS' : 'GASTOS'}
               </button>
             ))}
           </div>
           
           <div className="space-y-3">
             {currentMonthData.transactions
               .filter(t => filterType === 'ALL' || t.type === filterType)
               .map(tx => (
               <div key={tx.id} className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   {tx.status === 'PENDING' ? (
                     <button onClick={() => handleQuickConfirm(tx.id)} className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-500 active:bg-lime-500 active:text-black transition-all">
                       <i className="fa-solid fa-check text-xs"></i>
                     </button>
                   ) : (
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'INCOME' ? 'bg-lime-500/10 text-lime-400' : 'bg-rose-500/10 text-rose-400'}`}>
                       <i className="fa-solid fa-check-double text-xs"></i>
                     </div>
                   )}
                   <div>
                     <h4 className="text-sm font-bold truncate max-w-[120px]">{tx.description}</h4>
                     <p className="text-[9px] text-slate-500 font-bold uppercase">{tx.category}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <div className={`text-sm font-black ${tx.type === 'INCOME' ? 'text-lime-400' : 'text-white'}`}>
                     {tx.type === 'INCOME' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                   </div>
                   <div className="flex gap-3 justify-end mt-1">
                     <button onClick={() => setEditingTransaction(tx)} className="text-slate-600 text-xs"><i className="fa-solid fa-pen"></i></button>
                     <button onClick={() => { if(confirm("Apagar?")) handleDeleteTransaction(tx.id); }} className="text-slate-600 text-xs"><i className="fa-solid fa-trash-can"></i></button>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* AI TAB */}
        <div className={`${activeTab === 'ai' ? 'block' : 'hidden'} text-center py-10`}>
           <div className="w-16 h-16 bg-gradient-to-br from-lime-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
             <i className="fa-solid fa-brain text-2xl text-black"></i>
           </div>
           <h2 className="text-2xl font-black mb-4 tracking-tighter">Bliq Intelligence</h2>
           <p className="text-slate-500 text-xs font-medium px-10 mb-10">Análise preditiva baseada no seu comportamento financeiro real.</p>
           
           <button 
             onClick={async () => { setIsAiLoading(true); const advice = await getFinancialAdvice(currentMonth, currentMonthData.transactions); setAiInsight(advice); setIsAiLoading(false); }}
             className="w-full bg-white text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
             disabled={isAiLoading}
           >
             {isAiLoading ? 'Processando Dados...' : 'Gerar Insight Estratégico'}
           </button>
           
           {aiInsight && (
             <div className="mt-8 text-left bg-slate-900/50 p-6 rounded-2xl border border-white/5 text-sm leading-relaxed text-slate-300">
                {aiInsight.split('\n').map((l, i) => <p key={i} className="mb-3">{l}</p>)}
             </div>
           )}
        </div>
      </main>

      {/* TAB BAR CORRIGIDA (DIAGRAMAÇÃO PERFEITA) */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] safe-bottom-padding bg-black/60 backdrop-blur-3xl border-t border-white/5">
        <div className="h-16 flex items-center px-6 relative">
          <button onClick={() => setActiveTab('home')} className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeTab === 'home' ? 'text-lime-400' : 'text-slate-600'}`}>
            <i className="fa-solid fa-house text-lg"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Início</span>
          </button>
          
          <div className="relative -top-8 px-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-14 h-14 bg-lime-500 rounded-full flex items-center justify-center text-black shadow-2xl shadow-lime-500/30 border-[4px] border-black active:scale-90 transition-all"
            >
              <i className="fa-solid fa-plus text-xl"></i>
            </button>
          </div>
          
          <button onClick={() => setActiveTab('records')} className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeTab === 'records' ? 'text-lime-400' : 'text-slate-600'}`}>
            <i className="fa-solid fa-receipt text-lg"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Extrato</span>
          </button>

          <button onClick={() => setActiveTab('ai')} className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeTab === 'ai' ? 'text-lime-400' : 'text-slate-600'}`}>
            <i className="fa-solid fa-robot text-lg"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">IA Bliq</span>
          </button>
        </div>
      </nav>

      {(isModalOpen || editingTransaction) && (
        <TransactionForm 
          categories={state.categories} 
          initialData={editingTransaction || undefined} 
          onSave={handleSaveTransaction} 
          onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }} 
        />
      )}
    </div>
  );
};

export default App;
