import React, { useEffect, useState } from 'react';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    XMarkIcon,
    FunnelIcon,
    CurrencyEuroIcon,
    ArrowTrendingDownIcon,
    ArrowTrendingUpIcon,
    CalculatorIcon,
} from '@heroicons/react/24/outline';
import {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseSummary,
    getCurrencySettings,
    Expense,
    ExpenseCreate,
    ExpenseSummary,
} from '../services/api';

const CATEGORIES: Record<string, { label: string; emoji: string; color: string }> = {
    hardware: { label: 'Hardware', emoji: '🖥️', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    licenses: { label: 'Licencias', emoji: '📄', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    hosting: { label: 'Hosting', emoji: '🌐', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    plex_pass: { label: 'Plex Pass', emoji: '🎬', color: 'bg-plex-yellow/20 text-plex-yellow border-plex-yellow/30' },
    domain: { label: 'Dominio', emoji: '🌍', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    subscriptions: { label: 'Suscripciones', emoji: '📦', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    other: { label: 'Otro', emoji: '📋', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const RECURRENCES: Record<string, string> = {
    one_time: 'Pago único',
    monthly: 'Mensual',
    yearly: 'Anual',
};

const currentYear = new Date().getFullYear();

export default function Expenses() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [summary, setSummary] = useState<ExpenseSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [currencySymbol, setCurrencySymbol] = useState('€');
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [form, setForm] = useState<ExpenseCreate>({
        name: '',
        category: 'other',
        amount: 0,
        is_recurring: false,
        recurrence: 'one_time',
        date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    const fetchData = async () => {
        try {
            const [expRes, sumRes, curRes] = await Promise.all([
                getExpenses(filterCategory || undefined, selectedYear),
                getExpenseSummary(selectedYear),
                getCurrencySettings(),
            ]);

            if (Array.isArray(expRes.data)) {
                setExpenses(expRes.data);
            } else {
                console.error('Expected array for expenses but got:', expRes.data);
                setExpenses([]);
            }

            setSummary(sumRes.data);
            setCurrencySymbol(curRes.data.currency_symbol);
        } catch (error) {
            console.error('Error fetching expenses:', error);
            setExpenses([]); // Ensure it's an array on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterCategory, selectedYear]);

    const openCreate = () => {
        setEditingExpense(null);
        setForm({
            name: '',
            category: 'other',
            amount: 0,
            is_recurring: false,
            recurrence: 'one_time',
            date: new Date().toISOString().split('T')[0],
            notes: '',
        });
        setShowModal(true);
    };

    const openEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setForm({
            name: expense.name,
            category: expense.category,
            amount: expense.amount,
            is_recurring: expense.is_recurring,
            recurrence: expense.recurrence,
            date: expense.date.split('T')[0],
            notes: expense.notes || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                date: new Date(form.date).toISOString(),
            };
            if (editingExpense) {
                await updateExpense(editingExpense.id, payload);
            } else {
                await createExpense(payload);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error('Error saving expense:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
        try {
            await deleteExpense(id);
            fetchData();
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Cargando...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-white">Gastos de Plataforma</h1>
                <button
                    onClick={openCreate}
                    className="flex items-center px-4 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors"
                >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Nuevo Gasto
                </button>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-plex-dark rounded-lg p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Total Gastos ({selectedYear})</p>
                                <p className="text-2xl font-bold text-red-400 mt-1">
                                    {currencySymbol}{Number(summary.total_expenses).toFixed(2)}
                                </p>
                            </div>
                            <ArrowTrendingDownIcon className="h-8 w-8 text-red-400/50" />
                        </div>
                    </div>
                    <div className="bg-plex-dark rounded-lg p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Total Ingresos ({selectedYear})</p>
                                <p className="text-2xl font-bold text-green-400 mt-1">
                                    {currencySymbol}{Number(summary.total_income).toFixed(2)}
                                </p>
                            </div>
                            <ArrowTrendingUpIcon className="h-8 w-8 text-green-400/50" />
                        </div>
                    </div>
                    <div className="bg-plex-dark rounded-lg p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Beneficio Neto</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Control de Amortización</p>
                                <p className={`text-2xl font-bold mt-1 ${Number(summary.net_profit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {currencySymbol}{Number(summary.net_profit).toFixed(2)}
                                </p>
                            </div>
                            <CurrencyEuroIcon className={`h-8 w-8 ${Number(summary.net_profit) >= 0 ? 'text-green-400/50' : 'text-red-400/50'}`} />
                        </div>
                    </div>
                    <div className="bg-plex-dark rounded-lg p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Media Mensual</p>
                                <p className="text-2xl font-bold text-plex-yellow mt-1">
                                    {currencySymbol}{Number(summary.monthly_avg_expense).toFixed(2)}
                                </p>
                            </div>
                            <CalculatorIcon className="h-8 w-8 text-plex-yellow/50" />
                        </div>
                    </div>
                </div>
            )}

            {/* Category Breakdown */}
            {summary && Object.keys(summary.by_category).length > 0 && (
                <div className="bg-plex-dark rounded-lg p-5 mb-8">
                    <h3 className="text-white font-bold mb-4">Desglose por Categoría</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {Object.entries(summary.by_category).map(([cat, amount]) => {
                            const catInfo = CATEGORIES[cat] || CATEGORIES.other;
                            return (
                                <div key={cat} className={`rounded-lg border p-3 ${catInfo.color}`}>
                                    <div className="text-sm">{catInfo.emoji} {catInfo.label}</div>
                                    <div className="text-lg font-bold mt-1">{currencySymbol}{Number(amount).toFixed(2)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <FunnelIcon className="h-5 w-5 text-gray-400" />
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-plex-dark text-white border border-gray-700 rounded-lg px-3 py-2 focus:border-plex-yellow focus:outline-none"
                    >
                        <option value="">Todas las categorías</option>
                        {Object.entries(CATEGORIES).map(([key, { label, emoji }]) => (
                            <option key={key} value={key}>{emoji} {label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-plex-dark text-white border border-gray-700 rounded-lg px-3 py-2 focus:border-plex-yellow focus:outline-none"
                    >
                        {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Expenses Table */}
            <div className="bg-plex-dark rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-plex-darker text-gray-400 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Nombre</th>
                            <th className="px-6 py-4">Categoría</th>
                            <th className="px-6 py-4">Importe</th>
                            <th className="px-6 py-4">Recurrencia</th>
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {Array.isArray(expenses) && expenses.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No hay gastos registrados para este período
                                </td>
                            </tr>
                        ) : (
                            Array.isArray(expenses) && expenses.map((expense) => {
                                const catInfo = CATEGORIES[expense.category] || CATEGORIES.other;
                                return (
                                    <tr key={expense.id} className="hover:bg-plex-darker/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-white font-medium">{expense.name}</div>
                                                {expense.notes && (
                                                    <div className="text-gray-500 text-sm truncate max-w-[200px]">{expense.notes}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${catInfo.color}`}>
                                                {catInfo.emoji} {catInfo.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-white font-medium">
                                            {currencySymbol}{Number(expense.amount).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {RECURRENCES[expense.recurrence] || expense.recurrence}
                                            {expense.is_recurring && (
                                                <span className="ml-2 text-xs text-plex-yellow">🔄</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {new Date(expense.date).toLocaleDateString('es-ES')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-3">
                                                <button
                                                    onClick={() => openEdit(expense)}
                                                    className="text-plex-yellow hover:text-plex-orange"
                                                    title="Editar"
                                                >
                                                    <PencilIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(expense.id)}
                                                    className="text-red-400 hover:text-red-300"
                                                    title="Eliminar"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-plex-dark rounded-lg p-6 max-w-lg w-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">
                                {editingExpense ? 'Editar Gasto' : 'Nuevo Gasto'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-plex-yellow focus:outline-none"
                                    placeholder="Ej: Servidor NAS, Plex Pass..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Categoría</label>
                                    <select
                                        value={form.category}
                                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                                        className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-plex-yellow focus:outline-none"
                                    >
                                        {Object.entries(CATEGORIES).map(([key, { label, emoji }]) => (
                                            <option key={key} value={key}>{emoji} {label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Importe ({currencySymbol})</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.amount}
                                        onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-plex-yellow focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Recurrencia</label>
                                    <select
                                        value={form.recurrence}
                                        onChange={(e) => setForm({
                                            ...form,
                                            recurrence: e.target.value,
                                            is_recurring: e.target.value !== 'one_time',
                                        })}
                                        className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-plex-yellow focus:outline-none"
                                    >
                                        {Object.entries(RECURRENCES).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                        className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-plex-yellow focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Notas (opcional)</label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    className="w-full bg-plex-darker text-white border border-gray-700 rounded-lg px-4 py-2 focus:border-plex-yellow focus:outline-none"
                                    rows={2}
                                    placeholder="Detalles adicionales..."
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-plex-yellow text-plex-darker font-medium rounded-lg hover:bg-plex-orange transition-colors"
                                >
                                    {editingExpense ? 'Guardar Cambios' : 'Crear Gasto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
