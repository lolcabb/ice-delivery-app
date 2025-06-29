// Suggested path: src/expenses/ExpenseDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService'; // Adjust path if needed
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

// --- Helper to format currency ---
const formatCurrency = (amount, currency = 'THB') => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return 'N/A';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: currency, minimumFractionDigits: 2 }).format(amount);
};

// --- Helper for Pie Chart ---
const processPieChartData = (data, topN = 6) => {
    if(!data || data.length === 0) return [];
    // Sort data by value and get the top N items
    const sortedData = [...data].sort((a, b) => b.total_amount - a.total_amount);

    if (sortedData.length <= topN) return sortedData;
    const topEntries = sortedData.slice(0, topN);
    const otherEntries = sortedData.slice(topN);
    const otherSum = otherEntries.reduce((acc, entry) => acc + entry.total_amount, 0);

    const results = [...topEntries];
    if (otherEntries.length > 0) {
        results.push({ 
        category_name: 'อื่นๆ',
        total_amount: otherSum, 
        isOther: true,
        });
    }
    return results;
};

// --- Icon Components (simple SVGs for cards) ---
const TrendingUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-green-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
);
const TrendingDownIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
    </svg>
);
const CategoryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.39m3.422 1.659a15.99 0 00-1.622-3.39m3.388 1.621a15.99 0 00-3.388-1.621m-5.043-.025L9.53 16.122m0 0L12.94 12.715m0 0A15.97 15.97 0 0121.88 8.39m-5.042-.024a15.995 15.995 0 01-3.39 1.622m-3.39-1.622a15.995 15.995 0 00-1.621 3.39m5.042.024a15.998 15.998 0 01-3.388 1.621m3.388-1.621L12.94 12.715" />
    </svg>
);
const CashTodayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8 text-indigo-500" strokeMiterlimit="10">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M22 6V8.42C22 10 21 11 19.42 11H16V4.01C16 2.9 16.91 2 18.02 2C19.11 2.01 20.11 2.45 20.83 3.17C21.55 3.9 22 4.9 22 6Z M2 7V21C2 21.83 2.94 22.3 3.6 21.8L5.31 20.52C5.71 20.22 6.27 20.26 6.63 20.62L8.29 22.29C8.68 22.68 9.32 22.68 9.71 22.29L11.39 20.61C11.74 20.26 12.3 20.22 12.69 20.52L14.4 21.8C15.06 22.29 16 21.82 16 21V4C16 2.9 16.9 2 18 2H7H6C3 2 2 3.79 2 6V7Z M9 13.01H12 M9 9.01001H12" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.99561 13H6.00459 M5.99561 9H6.00459" />
    </svg>
);
// Using your custom SVG path for the wallet icon
const CustomWalletIcon = () => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" // Assuming the path is designed for a 24x24 viewBox
        fill="none" // Common for outline icons, adjust if your path is for a filled icon
        stroke="currentColor" 
        strokeWidth={1.5} // Consistent with other icons, adjust if needed
        className="w-8 h-8 text-purple-500"
    >
        <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M21,8.5 C20.582,8.186 20.063,8 19.5,8 L18.95,8 C18.718,6.859 17.709,6 16.5,6 L7.5,6 C6.291,6 5.282,6.859 5.05,8 L4.5,8 C3.671,8 3,7.329 3,6.5 L3,5.5 C3,4.671 3.671,4 4.5,4 L19.5,4 C20.329,4 21,4.671 21,5.5 L21,8.5 Z M6.085,8 C6.291,7.417 6.847,7 7.5,7 L16.5,7 C17.153,7 17.709,7.417 17.915,8 L6.085,8 Z M21,12 L17.5,12 C16.119,12 15,13.119 15,14.5 C15,15.881 16.119,17 17.5,17 L21,17 L21,18.5 C21,19.328 20.329,20 19.5,20 L4.5,20 C3.671,20 3,19.328 3,18.5 L3,8.5 C3.418,8.814 3.937,9 4.5,9 L19.5,9 C20.329,9 21,9.672 21,10.5 L21,12 Z M21,16 L17.5,16 C16.671,16 16,15.328 16,14.5 C16,13.672 16.671,13 17.5,13 L21,13 L21,16 Z M19.5,3 L4.5,3 C3.119,3 2,4.119 2,5.5 L2,18.5 C2,19.881 3.119,21 4.5,21 L19.5,21 C20.881,21 22,19.881 22,18.5 L22,5.5 C22,4.119 20.881,3 19.5,3 L19.5,3 Z"
        />
    </svg>
);
// --- End Icon Components ---


// --- Summary Card Component ---
const SummaryCard = ({ title, value, icon, trendValue, trendDirection }) => {
    const trendColor = trendDirection === 'up' ? 'text-green-600' : trendDirection === 'down' ? 'text-red-600' : 'text-gray-500';
    const TrendArrow = () => trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '';
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
                {icon}
            </div>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
            {trendValue && (
                <p className={`text-sm mt-1 flex items-center ${trendColor}`}>
                    <TrendArrow /> {trendValue} เทียบกับเดือนที่แล้ว
                </p>
            )}
        </div>
    );
};

// --- Main Dashboard Component ---
export default function ExpenseDashboard() {
    const [summaryData, setSummaryData] = useState(null);
    const [expensesByCategory, setExpensesByCategory] = useState([]);
    const [monthlyTrend, setMonthlyTrend] = useState([]);
    const [recentExpenses, setRecentExpenses] = useState([]);
    
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [loadingByCategory, setLoadingByCategory] = useState(true);
    const [loadingTrend, setLoadingTrend] = useState(true);
    const [loadingRecent, setLoadingRecent] = useState(true);
    
    const [error, setError] = useState(null); // General error for the page

    const [categoryChartPeriod, setCategoryChartPeriod] = useState('current_month');

    const processedPieData = processPieChartData(expensesByCategory, 6); // Process data for Pie Chart

    const fetchDashboardData = useCallback(async () => {
        setLoadingSummary(true);
        setLoadingByCategory(true);
        setLoadingTrend(true);
        setLoadingRecent(true);
        setError(null);

        try {
            const [summary, byCategory, trend, recent] = await Promise.all([
                apiService.getDashboardSummaryCards(),
                apiService.getDashboardExpensesByCategory(categoryChartPeriod),
                apiService.getDashboardMonthlyTrend(6), // Last 6 months
                apiService.getDashboardRecentExpenses(5) // Last 5 expenses
            ]);
            setSummaryData(summary);
            setExpensesByCategory(Array.isArray(byCategory) ? byCategory : []);
            setMonthlyTrend(Array.isArray(trend) ? trend : []);
            setRecentExpenses(Array.isArray(recent) ? recent : []);
        } catch (err) {
            console.error("Failed to fetch dashboard data:", err);
            setError(err.data?.error || err.message || "Could not load dashboard data.");
            if (err.status === 401) {
                apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
            }
        } finally {
            setLoadingSummary(false);
            setLoadingByCategory(false);
            setLoadingTrend(false);
            setLoadingRecent(false);
        }
    }, [categoryChartPeriod]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]); // fetchDashboardData will change if categoryChartPeriod changes

    const handleCategoryPeriodChange = (e) => {
        setCategoryChartPeriod(e.target.value);
        // fetchDashboardData will be called by useEffect due to dependency change
    };

    // Colors for Pie Chart
    const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1'];

    if (error) {
        return (
            <div className="p-6 bg-red-50 text-red-700 rounded-md shadow">
                <p><strong>ข้อผิดพลาด:</strong> {error}</p>
                <button onClick={fetchDashboardData} className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">
                    ลองอีกครั้ง
                </button>
            </div>
        );
    }
    
    const totalExpensesToday = summaryData?.expensesToday || 0;
    const totalExpensesThisMonth = summaryData?.totalExpensesThisMonth || 0;
    const totalExpensesLastMonth = summaryData?.totalExpensesLastMonth || 0;
    let trendValue = 0;
    let trendDirection = '';
    if (totalExpensesLastMonth > 0) {
        trendValue = ((totalExpensesThisMonth - totalExpensesLastMonth) / totalExpensesLastMonth) * 100;
        trendDirection = trendValue >= 0 ? 'up' : 'down';
        trendValue = `${Math.abs(trendValue).toFixed(1)}%`;
    } else if (totalExpensesThisMonth > 0) {
        trendValue = '100%'; // If last month was 0, and this month > 0, it's a 100% increase from 0 base
        trendDirection = 'up';
    }


    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ดค่าใช้จ่าย</h1>

            {/* Summary Cards */}
            {loadingSummary ? (
                <div className="text-center py-8"><p className="text-gray-500">กำลังโหลดข้อมูลสรุป...</p></div>
            ) : summaryData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <SummaryCard 
                        title="ค่าใช้จ่ายในเดือนนี้" 
                        value={formatCurrency(totalExpensesThisMonth)} 
                        icon={<TrendingUpIcon />}
                        trendValue={trendValue}
                        trendDirection={trendDirection}
                    />
                    <SummaryCard 
                        title="ค่าใช้จ่ายวันนี้" 
                        value={formatCurrency(totalExpensesToday)} 
                        icon={<CashTodayIcon />}
                    />
                    <SummaryCard 
                        title="ยอดเงินสดย่อยคงเหลือ" 
                        value={formatCurrency(summaryData.recentPettyCashClosing)} 
                        icon={<CustomWalletIcon />}
                    />
                     <SummaryCard 
                        title="ค่าใช้จ่ายในเดือนที่แล้ว" 
                        value={formatCurrency(totalExpensesLastMonth)} 
                        icon={<TrendingDownIcon />} // Example, could be neutral
                    />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Expenses by Category (Pie Chart) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">ค่าใช้จ่ายตามหมวดหมู่</h2>
                        <select 
                            value={categoryChartPeriod} 
                            onChange={handleCategoryPeriodChange}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="current_month">เดือนนี้</option>
                            <option value="last_month">เดือนที่แล้ว</option>
                            <option value="year_to_date">ปีนี้จนถึงปัจจุบัน</option>
                        </select>
                    </div>
                    {loadingByCategory ? (
                        <div className="text-center py-8"><p className="text-gray-500">กำลังโหลดข้อมูลกราฟ...</p></div>
                    ) : processedPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={processedPieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent, total_amount }) => {
                                        if (percent < 0.05 && processedPieData.length > 6) return null;
                                        return `${name} (${(percent * 100).toFixed(0)}%)`;
                                    }}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="total_amount"
                                    nameKey="category_name"
                                >
                                    {processedPieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center text-gray-500 py-8">ไม่มีข้อมูลค่าใช้จ่ายสำหรับช่วงเวลานี้.</p>
                    )}
                </div>

                {/* Monthly Expense Trend (Line Chart) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">แนวโน้มค่าใช้จ่ายรายเดือน (6 เดือนที่ผ่านมา)</h2>
                    {loadingTrend ? (
                         <div className="text-center py-8"><p className="text-gray-500">กำลังโหลดข้อมูลแนวโน้ม...</p></div>
                    ) : monthlyTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={monthlyTrend} margin={{ top: 5, right: 20, left: 35, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
                                <XAxis dataKey="month" />
                                <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{fontSize: '0.75em'}} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Line type="monotone" dataKey="total_expenses" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} name="Total Expenses"/>
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                         <p className="text-center text-gray-500 py-8">ข้อมูลไม่เพียงพอสำหรับแนวโน้มรายเดือน.</p>
                    )}
                </div>
            </div>

            {/* Recent Expenses List */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">ค่าใช้จ่ายล่าสุด</h2>
                {loadingRecent ? (
                    <div className="text-center py-8"><p className="text-gray-500">กำลังโหลดค่าใช้จ่ายล่าสุด...</p></div>
                ) : recentExpenses.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {recentExpenses.map((expense) => (
                            <li key={expense.expense_id} className="py-4 flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-medium text-indigo-600">{expense.description}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(expense.expense_date).toLocaleDateString()} - {expense.category_name}
                                    </p>
                                </div>
                                <p className="text-sm font-semibold text-gray-800">{formatCurrency(expense.amount)}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-8">ไม่พบรายการค่าใช้จ่ายล่าสุด.</p>
                )}
            </div>
        </div>
    );
}

