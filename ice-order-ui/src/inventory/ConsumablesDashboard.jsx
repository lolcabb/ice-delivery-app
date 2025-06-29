// Suggested path: src/inventory/ConsumablesDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService'; // Adjust path as needed
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// --- Helper to format currency (if needed for any value, though mostly counts here) ---
const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(parseFloat(num))) return 'N/A';
    return new Intl.NumberFormat('en-US').format(num); // Basic number formatting
};

// --- Icon Components (simple SVGs for cards) ---
const LowStockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);
const ItemsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10.5 11.25h3M12 15h.008m-7.008 0h14.016m0 0A48.108" />
    </svg>
);
const ActivityIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-green-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
    </svg>
);
// --- End Icon Components ---

// --- Summary Card Component ---
const SummaryCard = ({ title, value, icon, subValue }) => {    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
                <span className="inline-flex items-center justify-center">{icon}</span> 
            </div>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
            {subValue && (
                <p className="text-xs text-gray-500 mt-1">{subValue}</p>
            )}
        </div>
    );
};

export default function ConsumablesDashboard() {
    const [summaryData, setSummaryData] = useState(null);
    const [recentMovements, setRecentMovements] = useState([]);
    const [itemTypeMovementTrend, setItemTypeMovementTrend] = useState([]);
    const [itemTypes, setItemTypes] = useState([]); // For the trend chart filter

    const [loadingSummary, setLoadingSummary] = useState(true);
    const [loadingRecent, setLoadingRecent] = useState(true);
    const [loadingTrend, setLoadingTrend] = useState(true);
    const [loadingItemTypes, setLoadingItemTypes] = useState(true);
    const [error, setError] = useState(null);

    const [trendChartFilters, setTrendChartFilters] = useState({
        item_type_id: '',
        period: 'last_7_days' // 'last_7_days', 'last_30_days'
    });

    const fetchTrendData = useCallback(async (itemTypeId, period) => {
        if (!itemTypeId) {
            setItemTypeMovementTrend([]);
            setLoadingTrend(false);
            return;
        }
        setLoadingTrend(true);
        setError(null); // clear previous trend errors
        try {
            const trendData = await apiService.getDashboardConsumablesItemTypeMovementTrend(itemTypeId, period);
            setItemTypeMovementTrend(Array.isArray(trendData) ? trendData : []);
        } catch (err) {
            console.error("Failed to fetch item type movement trend:", err);
            setError(prevErr => prevErr || `ไม่สามารถโหลดข้อมูลแนวโน้มสำหรับประเภทวัสดุ ${itemTypeId}.`);
            setItemTypeMovementTrend([]);
        } finally {
            setLoadingTrend(false);
        }
    }, []);

    const fetchAllDashboardData = useCallback(async () => {
        setLoadingSummary(true);
        setLoadingRecent(true);
        //setLoadingTrend(true); // Will also be set by fetchTrendData
        setLoadingItemTypes(true);
        setError(null);

        try {
            const [summary, recent, types] = await Promise.all([
                apiService.getDashboardConsumablesSummary(),
                apiService.getDashboardConsumablesRecentMovements(5),
                apiService.getInventoryItemTypes() // Fetch all active item types for the dropdown
            ]);
            setSummaryData(summary);
            setRecentMovements(Array.isArray(recent) ? recent : []);
            const activeTypes = Array.isArray(types) ? types.filter(t => t.is_active !== false) : [];
            setItemTypes(activeTypes);

            // Logic to set initial filter or fetch trend data based on types
            if (activeTypes.length > 0) {
                if (!trendChartFilters.item_type_id && activeTypes[0]?.item_type_id) {
                    // If no filter set, default to first active type and trigger trend fetch via state update
                    setTrendChartFilters(prev => ({ ...prev, item_type_id: activeTypes[0].item_type_id.toString() }));
                } else if (trendChartFilters.item_type_id) {
                    // If a filter is already set (or was just set), explicitly fetch trend data
                    fetchTrendData(trendChartFilters.item_type_id, trendChartFilters.period);
                } else {
                    setLoadingTrend(false); // No specific item type to fetch trend for
                }
            } else {
                setItemTypeMovementTrend([]); // No types, so clear trend data
                setLoadingTrend(false);
            }

        } catch (err) {
            console.error("Failed to fetch initial dashboard data:", err);
            setError(err.data?.error || err.message || "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้.");
            if (err.status === 401) {
                apiService.handleComponentAuthError(err, () => window.location.replace('/login'));
            }
        } finally {
            setLoadingSummary(false);
            setLoadingRecent(false);
            setLoadingItemTypes(false);
            // setLoadingTrend will be handled by fetchTrendData or if no types
        }
    }, [trendChartFilters.item_type_id, trendChartFilters.period, fetchTrendData]); // Added dependencies

    useEffect(() => {
        fetchAllDashboardData();
    }, [fetchAllDashboardData]); // Initial fetch

    useEffect(() => {
        // Re-fetch trend data specifically when trendChartFilters change,
        // if an item_type_id is selected.
        if (trendChartFilters.item_type_id) {
            fetchTrendData(trendChartFilters.item_type_id, trendChartFilters.period);
        } else {
            // If no item_type_id selected (e.g., cleared), clear trend data
            setItemTypeMovementTrend([]);
        }
    }, [trendChartFilters, fetchTrendData]); // Depends on the filters object and the memoized fetchTrendData


    const handleTrendFilterChange = (e) => {
        const { name, value } = e.target;
        setTrendChartFilters(prev => ({ ...prev, [name]: value }));
    };
    
    const MovementTypePill = ({ type }) => {
        let colorClasses = 'bg-gray-100 text-gray-700';
        if (type === 'in') colorClasses = 'bg-green-100 text-green-700';
        else if (type === 'out') colorClasses = 'bg-red-100 text-red-700';
        else if (type === 'adjustment') colorClasses = 'bg-yellow-100 text-yellow-700';
        return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${colorClasses}`}>{type}</span>;
    };


    if (error && !loadingRecent && !loadingSummary && !loadingTrend && !loadingItemTypes ) { // Show general error if no specific loading is active
        return (
            <div className="p-6 bg-red-50 text-red-700 rounded-md shadow">
                <p><strong>ข้อผิดพลาด:</strong> {error}</p>
                <button onClick={fetchAllDashboardData} className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">
                    ลองใหม่ทั้งหมด
                </button>
            </div>
        );
    }
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ดวัสดุสิ้นเปลือง</h1>

            {/* Summary Cards */}
            {loadingSummary ? (
                <div className="text-center py-8"><p className="text-gray-500">กำลังโหลดข้อมูลสรุป...</p></div>
            ) : summaryData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SummaryCard 
                        title="รายการสต็อกต่ำ" 
                        value={formatNumber(summaryData.lowStockItemsCount)} 
                        icon={<LowStockIcon />}
                        subValue={summaryData.lowStockItemsCount > 0 ? "รายการที่มีสต็อกต่ำกว่าจุดสั่งซื้อ" : "รายการทั้งหมดมีสต็อกสูงกว่าจุดสั่งซื้อ"}
                    />
                    <SummaryCard 
                        title="จำนวนชนิดวัสดุสิ้นเปลือง" 
                        value={formatNumber(summaryData.distinctConsumableItems)} 
                        icon={<ItemsIcon />}
                        subValue="จำนวนชนิดวัสดุสิ้นเปลืองทั้งหมดที่ติดตาม"
                    />
                    <SummaryCard 
                        title="วัสดุใช้บ่อยสุดใน 30 วันที่ผ่านมา" 
                        value={summaryData.mostActiveConsumable?.consumable_name || 'N/A'}
                        icon={<ActivityIcon />}
                        subValue={summaryData.mostActiveConsumable?.movement_count > 0 ? `${summaryData.mostActiveConsumable.movement_count} ครั้ง 'จ่ายออก'` : "ไม่มีการเคลื่อนไหวที่สำคัญ"}
                    />
                </div>
            )}

            {/* Item Type Movement Trend (Bar Chart) */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold text-gray-700">แนวโน้มการเคลื่อนไหวรายวันตามประเภทวัสดุ</h2>
                    <div className="flex items-center gap-4">
                        <select 
                            name="item_type_id"
                            value={trendChartFilters.item_type_id} 
                            onChange={handleTrendFilterChange}
                            disabled={loadingItemTypes || itemTypes.length === 0}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">{loadingItemTypes ? "กำลังโหลดประเภท..." : "เลือกประเภทวัสดุ"}</option>
                            {itemTypes.map(type => (
                                <option key={type.item_type_id} value={type.item_type_id.toString()}>
                                    {type.type_name}
                                </option>
                            ))}
                        </select>
                        <select 
                            name="period"
                            value={trendChartFilters.period} 
                            onChange={handleTrendFilterChange}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="last_7_days">7 วันที่ผ่านมา</option>
                            <option value="last_30_days">30 วันที่ผ่านมา</option>
                        </select>
                    </div>
                </div>
                {loadingTrend ? (
                    <div className="text-center py-8 h-[300px] flex items-center justify-center"><p className="text-gray-500">กำลังโหลดข้อมูลแนวโน้ม...</p></div>
                ) : itemTypeMovementTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={itemTypeMovementTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
                            <XAxis dataKey="date" tickFormatter={(dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} />
                            <YAxis />
                            <Tooltip formatter={(value) => formatNumber(value)} />
                            <Legend />
                            <Bar dataKey="total_in" fill="#00C49F" name="Stock In" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="total_out" fill="#FF8042" name="Stock Out" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-center text-gray-500 py-8 h-[300px] flex items-center justify-center">
                        {trendChartFilters.item_type_id ? "ไม่มีข้อมูลการเคลื่อนไหวสำหรับประเภท/ช่วงเวลาที่เลือก." : "กรุณาเลือกประเภทวัสดุเพื่อดูแนวโน้ม."}
                    </p>
                )}
            </div>

            {/* Recent Consumable Stock Movements List */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">การเคลื่อนไหวของสต็อกวัสดุสิ้นเปลืองล่าสุด</h2>
                {loadingRecent ? (
                    <div className="text-center py-8"><p className="text-gray-500">กำลังโหลดรายการเคลื่อนไหวล่าสุด...</p></div>
                ) : recentMovements.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {recentMovements.map((movement) => (
                            <li key={movement.movement_id} className="py-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div>
                                        <p className="text-sm font-medium text-indigo-600">{movement.consumable_name}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(movement.movement_date).toLocaleString()}
                                            {movement.recorded_by_username && ` โดย ${movement.recorded_by_username}`}
                                        </p>
                                        {movement.notes && <p className="text-xs text-gray-500 italic mt-1">หมายเหตุ: {movement.notes}</p>}
                                    </div>
                                    <div className="flex items-center gap-2 sm:text-right">
                                        <MovementTypePill type={movement.movement_type} />
                                        <p className={`text-sm font-semibold ${movement.quantity_changed > 0 && movement.movement_type !== 'out' ? 'text-green-600' : (movement.quantity_changed < 0 || movement.movement_type === 'out' ? 'text-red-600' : 'text-gray-700')}`}>
                                            จำนวน: {movement.quantity_changed > 0 && movement.movement_type !== 'out' ? '+' : ''}{formatNumber(movement.quantity_changed)} {movement.unit_of_measure}
                                        </p>
                                        <p className="text-xs text-gray-500">(สต็อกใหม่: {formatNumber(movement.new_stock_level_after_movement)})</p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-8">ไม่พบการเคลื่อนไหวของสต็อกล่าสุด.</p>
                )}
            </div>
        </div>
    );
}
