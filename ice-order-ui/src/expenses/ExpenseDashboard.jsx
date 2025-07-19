// Suggested path: src/expenses/ExpenseDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService'; // Adjust path if needed
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUpIcon, TrendingDownIcon, CategoryIcon, CashTodayIcon, CustomWalletIcon } from '../components/Icons';

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

// --- New components for enhanced features ---
const StatusIndicator = ({ status, size = 'sm' }) => {
    const statusConfig = {
        reconciled: { color: 'bg-green-100 text-green-800', icon: '✓', text: 'กระทบยอดแล้ว' },
        pending: { color: 'bg-yellow-100 text-yellow-800', icon: '⏳', text: 'รอกระทบยอด' },
        discrepancy: { color: 'bg-red-100 text-red-800', icon: '⚠️', text: 'ไม่ตรงกัน' }
    };
    
    const config = statusConfig[status] || statusConfig.reconciled;
    const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

    return (
        <span className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClass}`}>
            <span className="mr-1">{config.icon}</span>
            {config.text}
        </span>
    );
};

const PaymentMethodBadge = ({ isPettyCash, amount }) => {
    if (isPettyCash) {
        return (
            <div className="flex items-center text-xs">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                <span className="text-green-700 font-medium">เงินสดย่อย</span>
            </div>
        );
    } else {
        return (
            <div className="flex items-center text-xs">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                <span className="text-blue-700 font-medium">โอนธนาคาร</span>
            </div>
        );
    }
};

// --- Enhanced Summary Card Component ---
const EnhancedSummaryCard = ({ title, value, icon, trendValue, trendDirection, subtitle, details = [], status }) => {
    const trendColor = trendDirection === 'up' ? 'text-red-600' : trendDirection === 'down' ? 'text-green-600' : 'text-gray-500';
    const TrendArrow = () => trendDirection === 'up' ? '↗️' : trendDirection === 'down' ? '↘️' : '➡️';
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
                    {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
                </div>
                <div className="flex flex-col items-end space-y-1">
                    {icon}
                    {status && <StatusIndicator status={status} />}
                </div>
            </div>
            <p className="text-3xl font-bold text-gray-800 mb-3">{value}</p>
            
            {trendValue && (
                <div className={`text-sm flex items-center mb-3 ${trendColor}`}>
                    <TrendArrow />
                    <span className="ml-1">{trendValue}</span>
                </div>
            )}

            {details.length > 0 && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                    {details.map((detail, index) => (
                        <div key={index} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">{detail.label}</span>
                            <span className="font-medium text-gray-800">{detail.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Category variance mini widget ---
const CategoryVarianceWidget = ({ categories, type = 'above' }) => {
    if (!categories || categories.length === 0) return null;
    
    const isAbove = type === 'above';
    const bgColor = isAbove ? 'bg-red-50' : 'bg-green-50';
    const textColor = isAbove ? 'text-red-800' : 'text-green-800';
    const borderColor = isAbove ? 'border-red-200' : 'border-green-200';

    return (
        <div className={`${bgColor} ${borderColor} border rounded-lg p-4`}>
            <h4 className={`text-sm font-medium ${textColor} mb-3`}>
                {isAbove ? '📈 สูงกว่าค่าเฉลี่ยรายไตรมาส' : '📉 ต่ำกว่าค่าเฉลี่ยรายไตรมาส'}
            </h4>
            <div className="space-y-2">
                {categories.slice(0, 3).map((category, index) => (
                    <div key={index} className="flex justify-between items-center">
                        <span className="text-xs text-gray-700">{category.name}</span>
                        <div className="text-right">
                            <div className={`text-xs font-medium ${isAbove ? 'text-red-600' : 'text-green-600'}`}>
                                {Math.abs(category.variance).toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500">{formatCurrency(category.amount)}</div>
                        </div>
                    </div>
                ))}
            </div>
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

    // Enhanced fetch function that calls both old and new endpoints
    const fetchDashboardData = useCallback(async () => {
        setLoadingSummary(true);
        setLoadingByCategory(true);
        setLoadingTrend(true);
        setLoadingRecent(true);
        setError(null);

        try {
            const [enhancedSummary, byCategory, trend, recent] = await Promise.all([
                // Use the new enhanced endpoint
                apiService.getEnhancedDashboardSummary(),
                apiService.getDashboardExpensesByCategory(categoryChartPeriod),
                apiService.getDashboardMonthlyTrend(6),
                apiService.getDashboardRecentExpenses(5)
            ]);
            
            setSummaryData(enhancedSummary);
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
    const totalBankTransferThisMonth = summaryData?.totalBankTransferThisMonth || 0;
    const totalPettyCashThisMonth = summaryData?.totalPettyCashThisMonth || 0;
    
    // Calculate trend values
    let trendValue = '';
    let trendDirection = '';
    if (summaryData?.momChange !== undefined) {
        const change = summaryData.momChange;
        trendDirection = change >= 0 ? 'up' : 'down';
        trendValue = `${Math.abs(change).toFixed(1)}% เทียบกับเดือนที่แล้ว`;
    } else if (totalExpensesThisMonth > 0) {
        trendValue = '100%'; // If last month was 0, and this month > 0, it's a 100% increase from 0 base
        trendDirection = 'up';
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ดค่าใช้จ่าย</h1>

            {/* Summary Cards */}
            {loadingSummary ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, index) => (
                        <div key={index} className="bg-white p-6 rounded-xl shadow-lg animate-pulse">
                            <div className="h-4 bg-gray-200 rounded mb-3"></div>
                            <div className="h-8 bg-gray-200 rounded mb-4"></div>
                            <div className="h-3 bg-gray-200 rounded"></div>
                        </div>
                    ))}
                </div>
            ) : summaryData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <EnhancedSummaryCard
                        title="ค่าใช้จ่ายในเดือนนี้"
                        subtitle="แยกตามประเภทการจ่าย" 
                        value={formatCurrency(totalExpensesThisMonth)} 
                        icon={<TrendingUpIcon />}
                        trendValue={trendValue}
                        trendDirection={trendDirection}
                        details={[
                            { label: '🏦 โอนธนาคาร', value: formatCurrency(totalBankTransferThisMonth) },
                            { label: '💵 เงินสดย่อย', value: formatCurrency(totalPettyCashThisMonth) },
                            { label: 'YoY เปลี่ยนแปลง', value: `${summaryData.yoyChange?.toFixed(1)}%` }
                        ]}
                    />
                    <EnhancedSummaryCard 
                        title="ค่าใช้จ่ายวันนี้"
                        subtitle="เปรียบเทียบกับค่าเฉลี่ยรายวัน" 
                        value={formatCurrency(totalExpensesToday)} 
                        icon={<CashTodayIcon />}
                        details={[
                            { label: 'ค่าเฉลี่ย/วัน', value: formatCurrency(summaryData.averageDailySpend || 0) },
                            { label: 'ธุรกรรมเดือนนี้', value: `${summaryData.totalTransactionsThisMonth || 0} รายการ` }
                        ]}
                    />
                    <EnhancedSummaryCard 
                        title="เงินสดย่อย" 
                        subtitle="สถานะและยอดคงเหลือ"
                        value={formatCurrency(summaryData.pettyCashBalance || 0)} 
                        icon={<CustomWalletIcon />}
                        status={summaryData.pettyCashReconciliationStatus}
                        details={[
                            { label: 'ใช้ได้อีก', value: `${summaryData.pettyCashDaysRemaining || 0} วัน` },
                            { label: 'ใช้เดือนนี้', value: formatCurrency(totalPettyCashThisMonth) },
                            ...(summaryData.pettyCashVariance > 0 ? [
                                { label: 'ความคลาดเคลื่อน', value: formatCurrency(summaryData.pettyCashVariance) }
                            ] : [])
                        ]}
                    />
                    <EnhancedSummaryCard 
                        title="เดือนที่แล้ว" 
                        subtitle="เปรียบเทียบกับค่าเฉลี่ยรายไตรมาส"
                        value={formatCurrency(totalExpensesLastMonth)} 
                        icon={<TrendingDownIcon />}
                        details={[
                            { label: 'ค่าเฉลี่ย Q', value: formatCurrency(summaryData.quarterlyAverage || 0) },
                            { label: 'หมวดหมู่ใช้งาน', value: `${summaryData.totalCategoriesActive || 0} หมวด` },
                            { label: 'ปีจนถึงปัจจุบัน', value: formatCurrency(summaryData.totalExpensesYearToDate || 0) }
                        ]}
                    />
                </div>
            )}

            {/* Category Variance Analysis */}
            {summaryData && (summaryData.categoriesAboveAverage?.length > 0 || summaryData.categoriesBelowAverage?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CategoryVarianceWidget 
                        categories={summaryData.categoriesAboveAverage || []} 
                        type="above" 
                    />
                    <CategoryVarianceWidget 
                        categories={summaryData.categoriesBelowAverage || []} 
                        type="below" 
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
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">แนวโน้มค่าใช้จ่ายรายเดือน</h2>
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
                                <Line type="monotone" dataKey="total_expenses" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} name="ยอดรวมค่าใช้จ่าย"/>
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
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-indigo-600">{expense.description}</p>
                                        <PaymentMethodBadge 
                                            isPettyCash={expense.is_petty_cash_expense} 
                                            amount={expense.amount} 
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {new Date(expense.expense_date).toLocaleDateString('th-TH')} - {expense.category_name}
                                    </p>
                                </div>
                                <p className="text-sm font-semibold text-gray-800 ml-4">{formatCurrency(expense.amount)}</p>
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

