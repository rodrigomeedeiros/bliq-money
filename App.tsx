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
  
  const [isLocked, setIsLocked] = useState(!!currentUser); // Se tem usuário, começa travado para simular biometria
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

  const handleUnlock = async () => {
    // Tenta usar a biometria nativa do navegador (FaceID/TouchID/Passcode)
    if (window.PublicKeyCredential) {
      try {
        // Isso apenas "acorda" a interface de segurança do celular
        // Em um PWA real, usaríamos WebAuthn, aqui simulamos o fluxo de sucesso
        setIsLocked(false);
      } catch (e) {
        setIsLocked(false);
      }
    } else {
      setIsLocked(false);
    }
  };

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

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('bliq_current_user');
    setIsLocked(false);
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
      const currentMonthTxs = [...(prev.months[currentMonth]?.transactions || [])];
      const index = currentMonthTxs.findIndex(t => t.id === id);
      if (index !== -1) {
        currentMonthTxs[index] = { ...currentMonthTxs[index], status: 'CONFIRMED' };
      }
      return {
        ...prev,
        months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: currentMonthTxs } }
      };
    });
  };

  const handleDeleteTransaction = (id: string) => {
    if(!confirm("Deseja apagar este registro?")) return;
    setState(prev => ({
      ...prev,
      months: { ...prev.months, [currentMonth]: { ...prev.months[currentMonth]!, transactions: prev.months[currentMonth]!.transactions.filter(t => t.id !== id) } }
    }));
  };

  // TELA DE BLOQUEIO (BIOMETRIA SIMULADA)
  if (currentUser && isLocked) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 safe-top">
        <div className="w-20 h-20 bg-lime-500 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(190,242,100,0.3)] mb-8">
           <i className="fa-solid fa-bolt-lightning text-3xl text-black"></i>
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Olá, {currentUser.name.split(' ')[0]}</h1>
        <p className="text-slate-500 text-sm mb-12 uppercase tracking-widest font-bold">App Bloqueado</p>
        
        <button 
          onClick={handleUnlock}
          className="bg-white text-black px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all flex items-center gap-3"
        >
          <i className="fa-solid fa-face-smile"></i>
          Desbloquear
        </button>
        
        <button onClick={handleLogout} className="mt-12 text-rose-500 text-xs font-black uppercase tracking-widest">Sair da Conta</button>
      </div>
    );
  }

  // TELA DE LOGIN
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex flex-col font-sans p-8 items-center justify-center safe-top">
        <div className="w-full max-w-md">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-lime-500 rounded-[2rem] flex items-center justify-center shadow-lg mx-auto mb-6">
              <i className="fa-solid fa-bolt-lightning text-3xl text-black"></i>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter">BLIQ MONEY</h1>
          </div>
          
          {authError && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-5 rounded-2xl text-xs font-black uppercase mb-6">{authError}</div>}
          
          <form onSubmit={(e) => {
            const fd = new FormData(e.currentTarget);
            handleAuthSubmit(e, fd.get('email') as string, fd.get('pass') as string, fd.get('name') as string);
          }} className="space-y-4">
            {authView === 'signup' && (
              <input name="name" required type="text" placeholder="Seu Nome" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-white font-bold" />
            )}
            <input name="email" required type="email" placeholder="E-mail" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-white font-bold" />
            <input name="pass" required type="password" placeholder="Senha" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-white font-bold" />
            <button disabled={isAuthLoading} type="submit" className="w-full bg-white text-black py-6 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all mt-4">
              {isAuthLoading ? 'Carregando...' : authView === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>
          
          <button onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')} className="w-full mt-8 text-xs text-slate-500 font-bold uppercase tracking-widest hover:text-white transition-colors">
            {authView === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça o Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      {/* HEADER AJUSTADO PARA O NOTCH */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 safe-top">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-lg"><i className="fa-solid fa-bolt-lightning text-black"></i></div>
            <h1 className="text-xl font-black tracking-tighter">BLIQ <span className="text-lime-400">MONEY</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={currentMonth} 
              onChange={(e) => setCurrentMonth(e.target.value as MonthKey)} 
              className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs font-black uppercase text-white outline-none"
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={() => setIsLocked(true)} className="text-slate-500 text-xl"><i className="fa-solid fa-lock"></i></button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pt-8 pb-32 max-w-2xl mx-auto w-full">
        {/* RESUMO DE SALDOS COM FONTES MAIORES */}
        <div className={`${activeTab === 'home' ? 'block' : 'hidden'} space-y-8`}>
          <section className="grid grid-cols-1 gap-4">
            <div className="bg-rose-600 p-8 rounded-[2rem] shadow-[0_20px_40px_rgba(229,43,80,0.2)]">
                <span className="text-[10px] font-black text-white/60 uppercase block mb-2 tracking-[0.2em]">Saldo Disponível</span>
                <div className="text-4xl font-black tracking-tighter">R$ {totals.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                  <span className="text-[9px] font-black text-lime-400 uppercase block mb-1">Recebido</span>
                  <div className="text-xl font-black">R$ {totals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                  <span className="text-[9px] font-black text-rose-400 uppercase block mb-1">Pago</span>
                  <div className="text-xl font-black">R$ {totals.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </section>

          <Dashboard data={state} />
        </div>

        {/* LISTA DE REGISTROS COM BOTÃO DE BAIXA RÁPIDA */}
        <div className={`${activeTab === 'records' ? 'block' : 'hidden'} space-y-6`}>
           <div className="bg-slate-900/30 rounded-[2.5rem] border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5 flex gap-3">
                 <button onClick={() => setFilterType('ALL')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black ${filterType === 'ALL' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>TODOS</button>
                 <button onClick={() => setFilterType('INCOME')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black ${filterType === 'INCOME' ? 'text-lime-400 bg-lime-400/10' : 'text-slate-600'}`}>GANHOS</button>
                 <button onClick={() => setFilterType('EXPENSE')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black ${filterType === 'EXPENSE' ? 'text-rose-500 bg-rose-500/10' : 'text-slate-600'}`}>GASTOS</button>
              </div>
              
              <div className="divide-y divide-white/5">
                {currentMonthData.transactions
                  .filter(t => filterType === 'ALL' || t.type === filterType)
                  .map(tx => (
                  <div key={tx.id} className="p-6 flex items-center justify-between active:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      {tx.status === 'PENDING' ? (
                        <button 
                          onClick={() => handleQuickConfirm(tx.id)}
                          className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-600 hover:border-lime-500 hover:text-lime-500 transition-all"
                        >
                          <i className="fa-solid fa-check"></i>
                        </button>
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tx.type === 'INCOME' ? 'bg-lime-500/20 text-lime-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          <i className="fa-solid fa-check-double"></i>
                        </div>
                      )}
                      <div>
                        <div className="text-lg font-bold">{tx.description}</div>
                        <div className="text-[10px] text-slate-600 font-black uppercase tracking-wider">{tx.category} • {tx.status === 'CONFIRMED' ? 'PAGO/RECEBIDO' : 'PENDENTE'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-black ${tx.type === 'INCOME' ? 'text-lime-400' : 'text-white'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'} {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="flex gap-4 justify-end mt-2">
                        <button onClick={() => setEditingTransaction(tx)} className="text-slate-600 text-lg"><i className="fa-solid fa-pen"></i></button>
                        <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-600 text-lg"><i className="fa-solid fa-trash"></i></button>
                      </div>
                    </div>
                  </div>
                ))}
                {currentMonthData.transactions.length === 0 && (
                  <div className="p-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Nenhum registro este mês</div>
                )}
              </div>
           </div>
        </div>

        {/* INTELIGÊNCIA ARTIFICIAL */}
        <div className={`${activeTab === 'ai' ? 'block' : 'hidden'} space-y-6`}>
           <div className="bg-slate-900 p-10 rounded-[3rem] border border-white/10 text-center">
              <div className="w-20 h-20 bg-gradient-to-tr from-lime-500 to-emerald-400 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-lime-500/20">
                <i className="fa-solid fa-brain text-black text-3xl"></i>
              </div>
              <h3 className="font-black text-2xl tracking-tighter mb-4">Mestria Bliq IA</h3>
              <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">Analise seu fluxo de caixa e receba estratégias personalizadas para sobrar mais dinheiro.</p>
              
              <button 
                onClick={async () => { setIsAiLoading(true); const advice = await getFinancialAdvice(currentMonth, currentMonthData.transactions); setAiInsight(advice); setIsAiLoading(false); }} 
                disabled={isAiLoading} 
                className="w-full bg-white text-black py-6 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-xl"
              >
                {isAiLoading ? 'Analisando Mercado...' : 'Gerar Diagnóstico'}
              </button>
              
              {aiInsight && (
                <div className="mt-10 text-left text-sm text-slate-300 leading-relaxed bg-black/50 p-8 rounded-[2rem] border border-white/5">
                  <div className="prose prose-invert prose-sm">
                    {aiInsight.split('\n').map((line, i) => <p key={i} className="mb-4">{line}</p>)}
                  </div>
                </div>
              )}
           </div>
        </div>
      </main>

      {/* TAB BAR AJUSTADA PARA O IPHONE */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] safe-bottom bg-black/80 backdrop-blur-3xl border-t border-white/5">
        <div className="h-20 flex items-center justify-around px-4">
          <button onClick={() => setActiveTab('home')} className={`w-14 h-14 flex items-center justify-center rounded-2xl text-xl ${activeTab === 'home' ? 'text-lime-400' : 'text-slate-600'}`}>
            <i className="fa-solid fa-chart-pie"></i>
          </button>
          
          <button onClick={() => setIsModalOpen(true)} className="w-16 h-16 bg-lime-500 text-black rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(190,242,100,0.4)] -translate-y-6 border-[6px] border-black active:scale-90 transition-all">
            <i className="fa-solid fa-plus text-2xl"></i>
          </button>
          
          <button onClick={() => setActiveTab('records')} className={`w-14 h-14 flex items-center justify-center rounded-2xl text-xl ${activeTab === 'records' ? 'text-lime-400' : 'text-slate-600'}`}>
            <i className="fa-solid fa-receipt"></i>
          </button>

          <button onClick={() => setActiveTab('ai')} className={`w-14 h-14 flex items-center justify-center rounded-2xl text-xl ${activeTab === 'ai' ? 'text-lime-400' : 'text-slate-600'}`}>
            <i className="fa-solid fa-bolt-lightning"></i>
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
