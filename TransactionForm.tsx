import React, { useState } from 'react';
import { TransactionType, Transaction, Category, TransactionStatus } from './types';

interface TransactionFormProps {
  categories: Category[];
  initialData?: Transaction;
  onSave: (transaction: Omit<Transaction, 'id'> | Transaction) => void;
  onClose: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ categories, initialData, onSave, onClose }) => {
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount.toString() || '');
  const [type, setType] = useState<TransactionType>(initialData?.type || 'EXPENSE');
  const [status, setStatus] = useState<TransactionStatus>(initialData?.status || 'CONFIRMED');
  const [category, setCategory] = useState(initialData?.category || categories[0]?.name || 'Outros');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const data = {
      description,
      amount: parseFloat(amount.replace(',', '.')),
      type,
      status,
      category,
      date
    };

    onSave(initialData ? { ...data, id: initialData.id } : data);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] overflow-y-auto flex flex-col justify-end safe-top">
      {/* Botão para fechar no topo */}
      <div className="p-6 flex justify-end">
        <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      <div className="bg-slate-900 rounded-t-[3rem] p-8 space-y-8 animate-in slide-in-from-bottom duration-500 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <header>
          <h2 className="text-3xl font-black text-white tracking-tighter">
            {initialData ? 'Editar' : 'Novo Lançamento'}
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] mt-1 tracking-widest">Controle sua movimentação</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex bg-black p-2 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setType('INCOME')}
              className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'INCOME' ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20' : 'text-slate-500'}`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              className={`flex-1 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'EXPENSE' ? 'bg-[#E52B50] text-white shadow-lg shadow-rose-500/20' : 'text-slate-500'}`}
            >
              Despesa
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <button
              type="button"
              onClick={() => setStatus('CONFIRMED')}
              className={`py-4 rounded-2xl text-[9px] font-black tracking-widest border transition-all ${status === 'CONFIRMED' ? (type === 'INCOME' ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-rose-500 bg-rose-500/10 text-rose-400') : 'border-white/5 text-slate-600'}`}
            >
              {type === 'INCOME' ? 'RECEBIDO' : 'PAGO'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('PENDING')}
              className={`py-4 rounded-2xl text-[9px] font-black tracking-widest border transition-all ${status === 'PENDING' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/5 text-slate-600'}`}
            >
              {type === 'INCOME' ? 'PENDENTE' : 'A PAGAR'}
            </button>
          </div>

          <div className="space-y-5">
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-6 py-5 rounded-2xl bg-black border border-white/5 text-white placeholder:text-slate-700 outline-none font-bold"
              placeholder="O que é?"
            />

            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-6 py-5 rounded-2xl bg-black border border-white/5 text-white placeholder:text-slate-700 outline-none font-black text-xl"
                placeholder="R$ 0,00"
              />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-6 py-5 rounded-2xl bg-black border border-white/5 text-white outline-none font-bold"
              />
            </div>

            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-6 py-5 rounded-2xl bg-black border border-white/5 text-white outline-none appearance-none font-bold"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name} className="bg-slate-900">{cat.name.toUpperCase()}</option>
                ))}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${type === 'INCOME' ? 'bg-lime-500 text-black' : 'bg-[#E52B50] text-white'}`}
          >
            {initialData ? 'Atualizar Dados' : 'Confirmar Registro'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
