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
      amount: parseFloat(amount),
      type,
      status,
      category,
      date
    };

    if (initialData) {
      onSave({ ...data, id: initialData.id });
    } else {
      onSave(data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] overflow-y-auto flex justify-center p-4">
      <div className="my-auto w-full max-w-md animate-in fade-in zoom-in duration-300">
        <div className="bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {initialData ? 'Editar Registro' : 'Novo Registro'}
              </h2>
              <p className="text-slate-400 text-xs mt-1">Ajuste os detalhes da movimentação</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${type === 'INCOME' ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${type === 'EXPENSE' ? 'bg-[#E52B50] text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Despesa
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <button
                type="button"
                onClick={() => setStatus('CONFIRMED')}
                className={`py-3 rounded-2xl text-[10px] font-black tracking-widest border transition-all ${status === 'CONFIRMED' ? (type === 'INCOME' ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-rose-500 bg-rose-500/10 text-rose-400') : 'border-white/5 text-slate-600'}`}
              >
                {type === 'INCOME' ? 'RECEBIDO' : 'PAGO'}
              </button>
              <button
                type="button"
                onClick={() => setStatus('PENDING')}
                className={`py-3 rounded-2xl text-[10px] font-black tracking-widest border transition-all ${status === 'PENDING' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/5 text-slate-600'}`}
              >
                {type === 'INCOME' ? 'A RECEBER' : 'A PAGAR'}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Descrição</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-slate-700 focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none transition-all font-medium"
                  placeholder="Ex: Aluguel, Pro-labore..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-slate-700 focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none transition-all font-bold"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Data</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none transition-all font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Categoria</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-black/40 border border-white/10 text-white focus:ring-2 focus:ring-lime-500 outline-none appearance-none cursor-pointer font-medium"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name} className="bg-slate-900">{cat.name}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 mt-4 ${type === 'INCOME' ? 'bg-lime-500 text-black hover:bg-lime-400' : 'bg-[#E52B50] text-white hover:bg-rose-500'}`}
            >
              {initialData ? 'Atualizar Dados' : 'Confirmar Lançamento'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TransactionForm;