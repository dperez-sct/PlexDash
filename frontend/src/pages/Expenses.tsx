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
    ExclamationTriangleIcon,
    DocumentTextIcon,
    CalendarIcon,
    ArrowPathIcon,
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
    const [selectedYear, setSelectedYear] = useState(0);

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

    // Delete confirmation modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const yearParam = selectedYear > 0 ? selectedYear : undefined;

            getExpenses(filterCategory || undefined, yearParam)
                .then((res: any) => {
                    if (Array.isArray(res.data)) setExpenses(res.data);
                    else setExpenses([]);
                })
                .catch((err: any) => {
                    console.error('Error fetching expenses:', err);
                    setExpenses([]);
                });

            getExpenseSummary(selectedYear)
                .then((res: any) => setSummary(res.data))
                .catch((err: any) => console.error('Error fetching summary:', err));

            getCurrencySettings()
                .then((res: any) => setCurrencySymbol(res.data.currency_symbol))
                .catch((err: any) => console.error('Error fetching currency:', err));

        } finally {
            setTimeout(() => setLoading(false), 300);
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

    const confirmDelete = (expense: Expense) => {
        setExpenseToDelete(expense);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!expenseToDelete) return;
        setDeleting(true);
        try {
            await deleteExpense(expenseToDelete.id);
            setShowDeleteModal(false);
            setExpenseToDelete(null);
            fetchData();
        } catch (error) {
            console.error('Error deleting expense:', error);
        } finally {
            setDeleting(false);
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
                                <p className="text-gray-400 text-sm">Total Gastos {selectedYear > 0 ? `(${selectedYear})` : '(Todos)'}</p>
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
                                <p className="text-gray-400 text-sm">Total Ingresos {selectedYear > 0 ? `(${selectedYear})` : '(Todos)'}</p>
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
                        <option value={0}>Todos los años</option>
                        {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div className="ml-auto text-gray-400 text-sm flex items-center">
                    {Array.isArray(expenses) ? expenses.length : 0} gasto{expenses.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Expense List - Detailed Cards */}
            {Array.isArray(expenses) && expenses.length === 0 ? (
                <div className="bg-plex-dark rounded-lg p-12 text-center text-gray-500">
                    <CurrencyEuroIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg">No hay gastos registrados para este período</p>
                    <p className="text-sm mt-1">Haz clic en "Nuevo Gasto" para añadir uno</p>
                </div>
            ) : (
                <div className="bg-plex-dark rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-plex-darker text-gray-400 uppercase text-xs font-semibold tracking-wider">
                        <div>Gasto</div>
                        <div>Categoría</div>
                        <div>Importe</div>
                        <div>Recurrencia</div>
                        <div>Fecha</div>
                        <div className="text-right">Acciones</div>
                    </div>

                    {/* Expense Rows */}
                    <div className="divide-y divide-gray-800">
                        {Array.isArray(expenses) && expenses.map((expense) => {
                            const catInfo = CATEGORIES[expense.category] || CATEGORIES.other;
                            return (
                                <div
                                    key={expense.id}
                                    className="px-6 py-4 hover:bg-plex-darker/40 transition-colors"
                                >
                                    {/* Mobile layout */}
                                    <div className="md:hidden space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-white font-semibold text-base">{expense.name}</div>
                                                <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${catInfo.color}`}>
                                                    {catInfo.emoji} {catInfo.label}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-white font-bold text-lg">{currencySymbol}{Number(expense.amount).toFixed(2)}</div>
                                                <div className="text-gray-400 text-xs mt-0.5">
                                                    {RECURRENCES[expense.recurrence] || expense.recurrence}
                                                    {expense.is_recurring && <span className="ml-1">🔄</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <CalendarIcon className="h-4 w-4" />
                                                {new Date(expense.date).toLocaleDateString('es-ES')}
                                            </div>
                                            {expense.notes && (
                                                <div className="flex items-center gap-1 text-gray-500 truncate max-w-[180px]">
                                                    <DocumentTextIcon className="h-4 w-4 flex-shrink-0" />
                                                    <span className="truncate">{expense.notes}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-end gap-3 pt-1">
                                            <button
                                                onClick={() => openEdit(expense)}
                                                className="flex items-center gap-1 text-plex-yellow hover:text-plex-orange text-sm"
                                                title="Editar"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(expense)}
                                                className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm"
                                                title="Eliminar"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Desktop layout */}
                                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center">
                                        <div>
                                            <div className="text-white font-medium">{expense.name}</div>
                                            {expense.notes && (
                                                <div className="flex items-center gap-1 text-gray-500 text-sm mt-0.5">
                                                    <DocumentTextIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                                    <span className="truncate max-w-[220px]">{expense.notes}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${catInfo.color}`}>
                                                {catInfo.emoji} {catInfo.label}
                                            </span>
                                        </div>
                                        <div className="text-white font-semibold">
                                            {currencySymbol}{Number(expense.amount).toFixed(2)}
                                        </div>
                                        <div className="text-gray-300 text-sm">
                                            {expense.is_recurring ? (
                                                <span className="flex items-center gap-1">
                                                    <ArrowPathIcon className="h-3.5 w-3.5 text-plex-yellow" />
                                                    {RECURRENCES[expense.recurrence] || expense.recurrence}
                                                </span>
                                            ) : (
                                                RECURRENCES[expense.recurrence] || expense.recurrence
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-gray-300 text-sm">
                                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                                            {new Date(expense.date).toLocaleDateString('es-ES')}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => openEdit(expense)}
                                                className="text-plex-yellow hover:text-plex-orange transition-colors"
                                                title="Editar"
                                            >
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(expense)}
                                                className="text-red-400 hover:text-red-300 transition-colors"
                                                title="Eliminar"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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

            {/* Delete Confirmation Modal */}
            {showDeleteModal && expenseToDelete && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-plex-dark rounded-lg p-6 max-w-md w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Eliminar Gasto</h3>
                        </div>

                        <p className="text-gray-300 mb-2">
                            ¿Estás seguro de que quieres eliminar este gasto?
                        </p>

                        {/* Expense details */}
                        <div className="bg-plex-darker rounded-lg p-4 mb-6 border border-gray-700">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-white font-semibold">{expenseToDelete.name}</p>
                                    <p className="text-gray-400 text-sm mt-1">
                                        {CATEGORIES[expenseToDelete.category]?.emoji} {CATEGORIES[expenseToDelete.category]?.label || expenseToDelete.category}
                                        {' · '}
                                        {new Date(expenseToDelete.date).toLocaleDateString('es-ES')}
                                    </p>
                                    {expenseToDelete.notes && (
                                        <p className="text-gray-500 text-sm mt-1 italic">{expenseToDelete.notes}</p>
                                    )}
                                </div>
                                <span className="text-red-400 font-bold text-lg">
                                    {currencySymbol}{Number(expenseToDelete.amount).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <p className="text-gray-500 text-sm mb-5">Esta acción no se puede deshacer.</p>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setExpenseToDelete(null);
                                }}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                disabled={deleting}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-6 py-2 bg-red-500 hover:bg-red-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                        </svg>
                                        Eliminando...
                                    </>
                                ) : (
                                    <>
                                        <TrashIcon className="h-4 w-4" />
                                        Eliminar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
