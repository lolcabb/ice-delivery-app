// Enhanced Expense Reports with Smart Insights and Alerts
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService';
import { DownloadIcon } from '../components/Icons';
import { getISODate } from '../utils/dateUtils';

// Helper functions
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return 'N/A';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(amount);
};

const formatPercent = (value) => `${value > 0 ? '+' : ''}${value?.toFixed(1)}%`;

const AlertIcon = ({ type }) => {
    const icons = {
        critical: '🚨',
        warning: '⚠️',
        info: 'ℹ️',
        insight: '💡'
    };
    return <span className="text-lg mr-2">{icons[type]}</span>;
};

// Smart Insights Card Component
const InsightCard = ({ insight }) => {
    const typeColors = {
        critical: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
        insight: 'bg-purple-50 border-purple-200 text-purple-800'
    };

    return (
        <div className={`p-4 rounded-lg border ${typeColors[insight.type]}`}>
            <div className="flex items-start">
                <AlertIcon type={insight.type} />
                <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
                    <p className="text-sm">{insight.message}</p>
                    {insight.recommendation && (
                        <p className="text-xs mt-2 font-medium">
                            💡 แนะนำ: {insight.recommendation}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

// Enhanced Summary Section
const ReportSummarySection = ({ summary, insights }) => {
    if (!summary) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Summary Stats */}
            <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">สรุปรายงาน</h3>
                <div className="space-y-3">
                    <div className="flex justify-between">
                        <span className="text-gray-600">จำนวนรายการ:</span>
                        <span className="font-semibold">{summary.numberOfEntries.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">ยอดรวม:</span>
                        <span className="font-bold text-lg">{formatCurrency(summary.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">เฉลี่ยต่อรายการ:</span>
                        <span className="font-medium">{formatCurrency(summary.grandTotal / summary.numberOfEntries)}</span>
                    </div>
                    {summary.paymentMethodBreakdown && (
                        <div className="pt-3 border-t">
                            <p className="text-sm text-gray-600 mb-2">แยกตามการจ่าย:</p>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-green-600">💵 เงินสดย่อย:</span>
                                    <span>{formatCurrency(summary.paymentMethodBreakdown.pettyCash)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-blue-600">🏦 โอนธนาคาร:</span>
                                    <span>{formatCurrency(summary.paymentMethodBreakdown.bankTransfer)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Category Breakdown */}
            {summary.categoryBreakdown && (
                <div className="bg-white p-6 rounded-lg shadow border">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">หมวดหมู่ที่ใช้มากสุด</h3>
                    <div className="space-y-3">
                        {summary.categoryBreakdown.slice(0, 5).map((category, index) => (
                            <div key={index} className="flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-medium text-gray-700">{category.name}</span>
                                        <span className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-indigo-500 h-2 rounded-full" 
                                            style={{ width: `${Math.min(category.percentage, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="ml-3 text-right">
                                    <span className="text-sm font-semibold">{formatCurrency(category.amount)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Trends & Insights */}
            {summary.trends && (
                <div className="bg-white p-6 rounded-lg shadow border">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">แนวโน้มและเปรียบเทียบ</h3>
                    <div className="space-y-3">
                        {summary.trends.vsLastPeriod && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">เทียบช่วงเดียวกันก่อนหน้า:</span>
                                <span className={`font-semibold ${summary.trends.vsLastPeriod > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatPercent(summary.trends.vsLastPeriod)}
                                </span>
                            </div>
                        )}
                        {summary.trends.dailyAverage && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">เฉลี่ยต่อวัน:</span>
                                <span className="font-medium">{formatCurrency(summary.trends.dailyAverage)}</span>
                            </div>
                        )}
                        {summary.trends.weekdayVsWeekend && (
                            <div className="pt-3 border-t">
                                <p className="text-sm text-gray-600 mb-2">เปรียบเทียบ วันธรรมดา vs วันหยุด:</p>
                                <div className="flex justify-between text-sm">
                                    <span>วันธรรมดา: {formatCurrency(summary.trends.weekdayVsWeekend.weekday)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>วันหยุด: {formatCurrency(summary.trends.weekdayVsWeekend.weekend)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Quick Filter Badges
const QuickFilterBadges = ({ onApplyQuickFilter, currentFilters }) => {
    const today = new Date();
    const formatDateForFilter = (date) => getISODate(date);

    const quickFilters = [
        {
            label: 'วันนี้',
            filters: {
                startDate: formatDateForFilter(today),
                endDate: formatDateForFilter(today)
            }
        },
        {
            label: 'สัปดาห์นี้',
            filters: {
                startDate: formatDateForFilter(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())),
                endDate: formatDateForFilter(today)
            }
        },
        {
            label: 'เดือนนี้',
            filters: {
                startDate: formatDateForFilter(new Date(today.getFullYear(), today.getMonth(), 1)),
                endDate: formatDateForFilter(today)
            }
        },
        {
            label: 'เดือนที่แล้ว',
            filters: {
                startDate: formatDateForFilter(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
                endDate: formatDateForFilter(new Date(today.getFullYear(), today.getMonth(), 0))
            }
        },
        {
            label: 'เงินสดย่อย',
            filters: {
                is_petty_cash_expense: 'true'
            }
        },
        {
            label: 'โอนธนาคาร',
            filters: {
                is_petty_cash_expense: 'false'
            }
        }
    ];

    const isFilterActive = (filterSet) => {
        return Object.keys(filterSet).every(key => currentFilters[key] === filterSet[key]);
    };

    return (
        <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-600 self-center mr-2">ตัวกรองด่วน:</span>
            {quickFilters.map((filter, index) => (
                <button
                    key={index}
                    onClick={() => onApplyQuickFilter(filter.filters)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        isFilterActive(filter.filters)
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    );
};

// Enhanced CSV Export with more data
const enhancedExportToCSV = (reportData, summary, insights) => {
    if (!reportData || reportData.length === 0) {
        alert("ไม่มีข้อมูลสำหรับส่งออก");
        return;
    }

    const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (/[,"\n]/.test(str)) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    // Enhanced headers with more business context
    const headers = [
        "วันที่", "หมวดหมู่", "รายละเอียด", "จำนวนเงิน (บาท)", 
        "วิธีการชำระเงิน", "เงินสดย่อย", "บันทึกโดย", "อ้างอิง", 
        "บันทึกเมื่อ", "วันในสัปดาห์", "ประเภท"
    ];

    const rows = reportData.map(row => {
        const expenseDate = new Date(row.expense_date);
        const dayOfWeek = expenseDate.toLocaleDateString('th-TH', { weekday: 'long' });
        const expenseType = row.is_petty_cash_expense ? 'เงินสดย่อย' : 'โอนธนาคาร';

        return [
            escapeCSV(formatDate(row.expense_date)),
            escapeCSV(row.category_name),
            escapeCSV(row.description),
            escapeCSV(row.amount),
            escapeCSV(row.payment_method || ''),
            escapeCSV(row.is_petty_cash_expense ? 'ใช่' : 'ไม่'),
            escapeCSV(row.recorded_by || ''),
            escapeCSV(row.reference_details || ''),
            escapeCSV(row.recorded_at ? new Date(row.recorded_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : ''),
            escapeCSV(dayOfWeek),
            escapeCSV(expenseType)
        ];
    });

    // Add summary information at the top
    const summaryRows = [
        ['สรุปรายงานค่าใช้จ่าย'],
        ['สร้างเมื่อ', new Date().toLocaleString('th-TH')],
        ['จำนวนรายการ', summary?.numberOfEntries || reportData.length],
        ['ยอดรวม', summary?.grandTotal || reportData.reduce((sum, row) => sum + parseFloat(row.amount), 0)],
        [''], // Empty row separator
        ...headers.map(h => [h]) // Convert headers to proper format
    ];

    // Combine summary and data
    const allRows = [
        ...summaryRows.slice(0, -1), // Summary without headers
        [''], // Separator
        headers, // Headers
        ...rows // Data
    ];

    const BOM = "\uFEFF";
    const rowSeparator = "\r\n";
    let csvContent = BOM + allRows.map(row => row.join(",")).join(rowSeparator);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `expense_report_enhanced_${getISODate(new Date())}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// Main Enhanced Expense Reports Component
export default function EnhancedExpenseReports() {
    const [reportData, setReportData] = useState([]);
    const [reportSummary, setReportSummary] = useState(null);
    const [insights, setInsights] = useState([]);
    const [categories, setCategories] = useState([]);
    const [users, setUsers] = useState([]);

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        paid_startDate: '',
        paid_endDate: '',
        category_id: '',
        payment_method: '',
        is_petty_cash_expense: '',
        user_id: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);

    const fetchCategories = useCallback(async () => {
        try {
            const data = await apiService.getExpenseCategories();
            setCategories(Array.isArray(data) ? data.filter(cat => cat.is_active) : []);
        } catch (err) {
            console.error("Failed to fetch categories:", err);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        // Placeholder - implement when user API is available
        setUsers([]);
    }, []);

    useEffect(() => {
        fetchCategories();
        fetchUsers();
    }, [fetchCategories, fetchUsers]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleQuickFilter = (quickFilters) => {
        setFilters(prev => ({ ...prev, ...quickFilters }));
    };

    // Generate smart insights from report data
    const generateInsights = useCallback((data, summary) => {
        if (!data || data.length === 0) return [];

        const insights = [];

        // High spending day detection
        const expensesByDate = data.reduce((acc, expense) => {
            const date = expense.expense_date.split('T')[0];
            acc[date] = (acc[date] || 0) + parseFloat(expense.amount);
            return acc;
        }, {});

        const dailyAmounts = Object.values(expensesByDate);
        const avgDaily = dailyAmounts.reduce((sum, amt) => sum + amt, 0) / dailyAmounts.length;
        const maxDaily = Math.max(...dailyAmounts);

        if (maxDaily > avgDaily * 2) {
            const highSpendDate = Object.keys(expensesByDate).find(date => expensesByDate[date] === maxDaily);
            insights.push({
                type: 'warning',
                title: 'วันที่ใช้จ่ายสูงผิดปกติ',
                message: `วันที่ ${formatDate(highSpendDate)} มีค่าใช้จ่าย ${formatCurrency(maxDaily)} สูงกว่าค่าเฉลี่ย ${(maxDaily / avgDaily * 100 - 100).toFixed(0)}%`,
                recommendation: 'ตรวจสอบรายการใช้จ่ายในวันดังกล่าวเพื่อหาสาเหตุ'
            });
        }

        // Category concentration analysis
        if (summary?.categoryBreakdown) {
            const topCategory = summary.categoryBreakdown[0];
            if (topCategory.percentage > 40) {
                insights.push({
                    type: 'info',
                    title: 'การใช้จ่ายกระจุกตัวในหมวดหมู่เดียว',
                    message: `หมวด "${topCategory.name}" คิดเป็น ${topCategory.percentage.toFixed(1)}% ของค่าใช้จ่ายทั้งหมด`,
                    recommendation: 'พิจารณากระจายค่าใช้จ่ายในหมวดหมู่อื่นๆ หรือทบทวนงบประมาณ'
                });
            }
        }

        // Petty cash vs bank transfer analysis
        const pettyCashExpenses = data.filter(expense => expense.is_petty_cash_expense);
        const pettyCashRatio = (pettyCashExpenses.length / data.length) * 100;

        if (pettyCashRatio > 70) {
            insights.push({
                type: 'insight',
                title: 'การใช้เงินสดย่อยสูง',
                message: `${pettyCashRatio.toFixed(1)}% ของรายการเป็นเงินสดย่อย อาจต้องการการจัดการที่ดีขึ้น`,
                recommendation: 'พิจารณาใช้การโอนธนาคารสำหรับรายการขนาดใหญ่เพื่อการติดตามที่ดีขึ้น'
            });
        }

        // Weekend vs weekday spending
        const weekendExpenses = data.filter(expense => {
            const day = new Date(expense.expense_date).getDay();
            return day === 0 || day === 6; // Sunday or Saturday
        });

        if (weekendExpenses.length > data.length * 0.3) {
            insights.push({
                type: 'info',
                title: 'การใช้จ่ายในวันหยุดสูง',
                message: `${(weekendExpenses.length / data.length * 100).toFixed(1)}% ของรายการเกิดขึ้นในวันหยุด`,
                recommendation: 'ตรวจสอบนโยบายการใช้จ่ายในวันหยุดและความจำเป็น'
            });
        }

        return insights;
    }, []);

    const handleGenerateReport = async () => {
        setIsLoading(true);
        setError(null);
        setHasGeneratedReport(true);

        try {
            const activeFilters = { ...filters };
            Object.keys(activeFilters).forEach(key => {
                if (activeFilters[key] === '' || activeFilters[key] === null || activeFilters[key] === undefined) {
                    delete activeFilters[key];
                }
            });

            // Call your existing API
            const response = await apiService.getDetailedExpenseReport(activeFilters);
            const data = Array.isArray(response.reportData) ? response.reportData : [];
            setReportData(data);

            // Enhanced summary with additional analytics
            const enhancedSummary = {
                ...response.summary,
                // Add payment method breakdown
                paymentMethodBreakdown: {
                    pettyCash: data.filter(item => item.is_petty_cash_expense).reduce((sum, item) => sum + parseFloat(item.amount), 0),
                    bankTransfer: data.filter(item => !item.is_petty_cash_expense).reduce((sum, item) => sum + parseFloat(item.amount), 0)
                },
                // Add category breakdown
                categoryBreakdown: (() => {
                    const categoryTotals = data.reduce((acc, item) => {
                        acc[item.category_name] = (acc[item.category_name] || 0) + parseFloat(item.amount);
                        return acc;
                    }, {});

                    const total = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
                    
                    return Object.entries(categoryTotals)
                        .map(([name, amount]) => ({
                            name,
                            amount,
                            percentage: (amount / total) * 100
                        }))
                        .sort((a, b) => b.amount - a.amount);
                })(),
                // Add trends analysis
                trends: {
                    dailyAverage: data.length > 0 ? response.summary.grandTotal / new Set(data.map(item => item.expense_date.split('T')[0])).size : 0,
                }
            };

            setReportSummary(enhancedSummary);

            // Generate insights
            const generatedInsights = generateInsights(data, enhancedSummary);
            setInsights(generatedInsights);

        } catch (err) {
            console.error("Failed to generate report:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถสร้างรายงานได้');
            setReportData([]);
            setReportSummary(null);
            setInsights([]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">
                    รายงานค่าใช้จ่ายอัจฉริยะ
                </h1>

                {/* Quick Filter Badges */}
                <QuickFilterBadges 
                    onApplyQuickFilter={handleQuickFilter}
                    currentFilters={filters}
                />

                {/* Filter Section */}
                <div className="mb-8 p-6 bg-white shadow rounded-lg border">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">ตัวกรองรายงาน</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">วันที่เริ่มต้น</label>
                            <input
                                type="date"
                                name="startDate"
                                id="startDate"
                                value={filters.startDate}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">วันที่สิ้นสุด</label>
                            <input
                                type="date"
                                name="endDate"
                                id="endDate"
                                value={filters.endDate}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                            <select
                                name="category_id"
                                id="category_id"
                                value={filters.category_id}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                <option value="">ทั้งหมด</option>
                                {categories.map((category) => (
                                    <option key={category.category_id} value={category.category_id}>
                                        {category.category_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="is_petty_cash_expense" className="block text-sm font-medium text-gray-700 mb-1">ประเภทการจ่าย</label>
                            <select
                                name="is_petty_cash_expense"
                                id="is_petty_cash_expense"
                                value={filters.is_petty_cash_expense}
                                onChange={handleFilterChange}
                                className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                <option value="">ทั้งหมด</option>
                                <option value="true">เงินสดย่อย</option>
                                <option value="false">โอนธนาคาร</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={handleGenerateReport}
                            disabled={isLoading}
                            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                        >
                            {isLoading ? (
                                <div className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    กำลังสร้างรายงาน...
                                </div>
                            ) : (
                                'สร้างรายงาน'
                            )}
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
                        <div className="flex">
                            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <div className="ml-3">
                                <p className="text-sm font-medium">ข้อผิดพลาด: {error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Smart Insights Section */}
                {insights.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">💡 ข้อมูลเชิงลึกและการแจ้งเตือน</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights.map((insight, index) => (
                                <InsightCard key={index} insight={insight} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Enhanced Summary Section */}
                {hasGeneratedReport && !isLoading && !error && reportSummary && (
                    <ReportSummarySection summary={reportSummary} insights={insights} />
                )}

                {/* Report Results Section */}
                {hasGeneratedReport && !isLoading && !error && (
                    <div className="bg-white shadow rounded-lg overflow-hidden border">
                        <div className="p-6 flex flex-col sm:flex-row justify-between items-center border-b border-gray-200">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">ตารางรายละเอียด</h3>
                                {reportSummary && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        จำนวนรายการทั้งหมด: {reportSummary.numberOfEntries.toLocaleString()} | 
                                        ยอดรวมสุทธิ: <span className="font-bold">{formatCurrency(reportSummary.grandTotal)}</span>
                                    </p>
                                )}
                            </div>
                            {reportData.length > 0 && (
                                <button
                                    onClick={() => enhancedExportToCSV(reportData, reportSummary, insights)}
                                    className="mt-3 sm:mt-0 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150 flex items-center"
                                >
                                    <DownloadIcon /> ส่งออกเป็น CSV แบบละเอียด
                                </button>
                            )}
                        </div>
                        
                        {reportData.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมวดหมู่</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รายละเอียด</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวนเงิน (บาท)</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภทการจ่าย</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">อ้างอิง</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">บันทึกโดย</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {reportData.map((item) => (
                                            <tr key={item.expense_id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                    {formatDate(item.expense_date)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                                                        {item.category_name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 max-w-xs break-words">
                                                    <div>
                                                        <span className="font-medium">{item.description}</span>
                                                        {item.reference_details && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                อ้างอิง: {item.reference_details}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                                    <div className={`px-3 py-1 rounded-lg ${
                                                        item.is_petty_cash_expense ? 'bg-green-50' : 'bg-blue-50'
                                                    }`}>
                                                        <span className={`font-semibold ${
                                                            item.is_petty_cash_expense ? 'text-green-700' : 'text-blue-700'
                                                        }`}>
                                                            {formatCurrency(item.amount)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    {item.is_petty_cash_expense ? (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                                            เงินสดย่อย
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                                            {item.payment_method || 'โอนธนาคาร'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                                                    {item.reference_details ? (
                                                        <span className="truncate block" title={item.reference_details}>
                                                            {item.reference_details}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic">ไม่มี</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                    {item.recorded_by || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h2m0-13v13m0-13h2a2 2 0 012 2v11a2 2 0 01-2 2h-2m-6-9h6m-6 4h6" />
                                </svg>
                                <p className="text-gray-500 text-sm">
                                    ไม่พบรายการค่าใช้จ่ายตามเงื่อนไขที่กำหนด
                                </p>
                                <p className="text-gray-400 text-xs mt-1">
                                    ลองปรับเงื่อนไขการค้นหาใหม่
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="bg-white shadow rounded-lg p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">กำลังสร้างรายงานและวิเคราะห์ข้อมูล...</p>
                    </div>
                )}
            </div>
        </div>
    );
}