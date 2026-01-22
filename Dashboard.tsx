import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { FinanceState, Transaction, MonthData } from './types';
import { MONTHS } from './constants';

interface DashboardProps {
  data: FinanceState;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const monthlyData = useMemo(() => {
    return MONTHS.map(month => {
      const monthData = data.months[month] || { transactions: [] };
      const income = monthData.transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = monthData.transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);
      
      return {
        name: month.substring(0, 3),
        Receita: income,
        Despesa: expense,
      };
    });
  }, [data]);

  const categoryData = useMemo(() => {
    const allTransactions: Transaction[] = [];
    (Object.values(data.months) as MonthData[]).forEach(m => {
      if (m && m.transactions) {
        allTransactions.push(...m.transactions);
      }
    });
    
    const expenses = allTransactions.filter(t => t.type === 'EXPENSE');
    const categoriesMap: Record<string, number> = {};
    
    expenses.forEach(t => {
      categoriesMap[t.category] = (categoriesMap[t.category] || 0) + t.amount;
    });

    const entries = Object.entries(categoriesMap).map(([name, value]) => ({
      name,
      value
    }));

    return entries.sort((a, b) => b.value - a.value);
  }, [data]);

  const COLORS = ['#BEF264', '#E52B50', '#0EA5E9', '#A855F7', '#F59E0B', '#64748B'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-slate-900/30 backdrop-blur-xl p-6 rounded-3xl border border-white/5">
        <h3 className="text-[10px] font-black mb-6 text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-chart-column text-lime-400"></i>
          Sazonalidade de Fluxo
        </h3>
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.3} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 700}} />
              <Tooltip 
                cursor={{fill: 'rgba(255,255,255,0.02)'}}
                contentStyle={{ 
                  backgroundColor: '#000', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: '#fff'
                }}
              />
              <Bar dataKey="Receita" fill="#BEF264" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="Despesa" fill="#E52B50" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-5 bg-slate-900/30 backdrop-blur-xl p-6 rounded-3xl border border-white/5">
        <h3 className="text-[10px] font-black mb-6 text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-layer-group text-rose-400"></i>
          Mix de Despesas
        </h3>
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {categoryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.8} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#000', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '10px'
                }}
              />
              <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase'}} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;