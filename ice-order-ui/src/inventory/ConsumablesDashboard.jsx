// Enhanced ConsumablesDashboard.jsx - Production-focused transformation
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CriticalStockIcon, ProductionItemsIcon, ValueIcon, ActivityIcon, ClockIcon, RefreshIcon } from '../components/Icons';

// Enhanced helper function for number formatting
const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(parseFloat(num))) return 'N/A';
    return new Intl.NumberFormat('en-US').format(num);
};

// Enhanced Summary Card Component
const SummaryCard = ({ title, value, icon, subValue, valueColor = "text-gray-900" }) => {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
                <span className="inline-flex items-center justify-center">{icon}</span>
            </div>
            <p className={`text-3xl font-bold ${valueColor} mb-1`}>{value}</p>
            {subValue && (
                <p className="text-xs text-gray-500">{subValue}</p>
            )}
        </div>
    );
};

// Production-focused alerts component
const ProductionAlertsPanel = ({ summaryData, recentMovements, usagePatterns, inventoryValue }) => {
    const generateProductionAlerts = () => {
        const alerts = [];
        
        // Critical stock alerts based on actual data
        if (summaryData?.lowStockItemsCount > 0) {
            alerts.push({
                type: 'critical',
                message: `${summaryData.lowStockItemsCount} รายการ ต้องเร่งจัดหา`,
                priority: 'high'
            });
        }
        
        // Out of stock alerts from enhanced data
        if (inventoryValue?.inventory_summary?.out_of_stock_count > 0) {
            alerts.push({
                type: 'critical',
                message: `${inventoryValue.inventory_summary.out_of_stock_count} รายการ หมดสต็อกแล้ว`,
                priority: 'high'
            });
        }
        
        // Usage pattern alerts
        if (usagePatterns?.risk_analysis?.length > 0) {
            const mostUrgent = usagePatterns.risk_analysis[0];
            if (mostUrgent.estimated_days_remaining <= 3) {
                alerts.push({
                    type: 'warning',
                    message: `${mostUrgent.name} เหลือประมาณ ${mostUrgent.estimated_days_remaining} วัน ตามอัตราการใช้งาน`,
                    priority: 'medium'
                });
            }
        }
        
        // Check for unusual activity patterns from enhanced data
        if (inventoryValue?.today_activity) {
            const { total_movements, total_used, total_received } = inventoryValue.today_activity;
            
            if (total_movements === 0) {
                alerts.push({
                    type: 'warning',
                    message: 'ไม่มีการเคลื่อนไหวของสต็อกวันนี้ - ตรวจสอบการผลิต',
                    priority: 'medium'
                });
            } else if (total_used > total_received * 2) {
                alerts.push({
                    type: 'info',
                    message: `การใช้งานสูงกว่าการรับเข้า ${total_used - total_received} หน่วย วันนี้`,
                    priority: 'low'
                });
            }
        }
        
        // Smart high usage alert - calculate dynamic threshold based on usage patterns
        if (summaryData?.mostActiveConsumable && usagePatterns?.high_usage_items?.length > 0) {
            const mostActive = summaryData.mostActiveConsumable;
            const highUsageItems = usagePatterns.high_usage_items;
            
            // Calculate average movement count across all high usage items
            const averageMovements = highUsageItems.reduce((sum, item) => sum + (item.total_used_30d || 0), 0) / highUsageItems.length;
            
            // Create dynamic threshold (150% of average, minimum 5, maximum 50)
            const dynamicThreshold = Math.max(5, Math.min(50, Math.floor(averageMovements * 1.5)));
            
            if (mostActive.movement_count > dynamicThreshold) {
                // Check if this item is actually in our usage patterns to get more context
                const itemUsageData = highUsageItems.find(item => 
                    item.name.toLowerCase().includes(mostActive.consumable_name.toLowerCase()) ||
                    mostActive.consumable_name.toLowerCase().includes(item.name.toLowerCase())
                );
                
                const contextMessage = itemUsageData 
                    ? `ใช้งาน ${itemUsageData.daily_usage.toFixed(1)} หน่วย/วัน (สูงกว่าปกติ ${((mostActive.movement_count / dynamicThreshold - 1) * 100).toFixed(0)}%)`
                    : `${mostActive.movement_count} ครั้ง ใน 30 วัน (เกินค่าเฉลี่ย)`;
                
                alerts.push({
                    type: 'info',
                    message: `${mostActive.consumable_name} ${contextMessage}`,
                    priority: 'low'
                });
            }
        }
        
        return alerts;
    };

    const alerts = generateProductionAlerts();

    if (alerts.length === 0) {
        return (
            <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-green-200 mb-8">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                    ✅ สถานะคลังปกติ
                </h3>
                <p className="text-sm text-green-700">ไม่มีการแจ้งเตือนด่วนสำหรับคงคลัง</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                <CriticalStockIcon className="inline h-5 w-5 mr-2 text-red-500" />
                การแจ้งเตือนคงคลัง
            </h3>
            <div className="space-y-3">
                {alerts.map((alert, index) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 ${
                        alert.priority === 'high' ? 'border-red-500 bg-red-50' :
                        alert.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                    }`}>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-800">{alert.message}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                                alert.priority === 'high' ? 'bg-red-100 text-red-700' :
                                alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                                {alert.priority === 'high' ? 'ด่วน' :
                                 alert.priority === 'medium' ? 'เตือน' : 'ข้อมูล'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function ConsumablesDashboard() {
    const [summaryData, setSummaryData] = useState(null);
    const [recentMovements, setRecentMovements] = useState([]);
    const [itemTypeMovementTrend, setItemTypeMovementTrend] = useState([]);
    const [itemTypes, setItemTypes] = useState([]);

    const [loadingSummary, setLoadingSummary] = useState(true);
    const [loadingRecent, setLoadingRecent] = useState(true);
    const [loadingTrend, setLoadingTrend] = useState(true);
    const [loadingItemTypes, setLoadingItemTypes] = useState(true);
    const [error, setError] = useState(null);

    const [trendChartFilters, setTrendChartFilters] = useState({
        item_type_id: '',
        period: 'last_7_days'
    });

    const fetchTrendData = useCallback(async (itemTypeId, period) => {
        if (!itemTypeId) {
            setItemTypeMovementTrend([]);
            setLoadingTrend(false);
            return;
        }
        setLoadingTrend(true);
        setError(null);
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

    // Add the new API service methods for the enhanced endpoints
    const fetchEnhancedData = useCallback(async () => {
        setLoadingEnhanced(true);
        try {
            const [valueData, usageData] = await Promise.all([
                apiService.getInventoryValueSummary(),
                apiService.getUsagePatterns()
            ]);
            setInventoryValue(valueData);
            setUsagePatterns(usageData);
        } catch (err) {
            console.error("Failed to fetch enhanced data:", err);
            // Set fallback data if new endpoints fail
            setInventoryValue(null);
            setUsagePatterns(null);
        } finally {
            setLoadingEnhanced(false);
        }
    }, []);

    const fetchAllDashboardData = useCallback(async () => {
        setLoadingSummary(true);
        setLoadingRecent(true);
        setLoadingItemTypes(true);
        setError(null);

        try {
            const [summary, recent, types] = await Promise.all([
                apiService.getDashboardConsumablesSummary(),
                apiService.getDashboardConsumablesRecentMovements(10), // Increased limit for better insights
                apiService.getInventoryItemTypes()
            ]);
            setSummaryData(summary);
            setRecentMovements(Array.isArray(recent) ? recent : []);
            const activeTypes = Array.isArray(types) ? types.filter(type => type.is_active !== false) : [];
            setItemTypes(activeTypes);

            // Fetch enhanced data as well
            fetchEnhancedData();
        } catch (err) {
            console.error("Failed to fetch dashboard data:", err);
            setError(err.data?.error || err.message || 'ไม่สามารถโหลดข้อมูลแดชบอร์ด.');
        } finally {
            setLoadingSummary(false);
            setLoadingRecent(false);
            setLoadingItemTypes(false);
        }
    }, [fetchEnhancedData]);

    useEffect(() => {
        fetchAllDashboardData();
    }, [fetchAllDashboardData]);

    useEffect(() => {
        if (trendChartFilters.item_type_id) {
            fetchTrendData(trendChartFilters.item_type_id, trendChartFilters.period);
        } else {
            setItemTypeMovementTrend([]);
        }
    }, [trendChartFilters, fetchTrendData]);

    // Auto-select first item type when item types are loaded
    useEffect(() => {
        if (itemTypes.length > 0 && !trendChartFilters.item_type_id) {
            setTrendChartFilters(prev => ({
                ...prev,
                item_type_id: itemTypes[0].item_type_id.toString()
            }));
        }
    }, [itemTypes, trendChartFilters.item_type_id]);

    const handleTrendFilterChange = (e) => {
        const { name, value } = e.target;
        setTrendChartFilters(prev => ({ ...prev, [name]: value }));
    };

    const MovementTypePill = ({ type }) => {
        let colorClasses = 'bg-gray-100 text-gray-700';
        let displayText = type;
        
        if (type === 'in') {
            colorClasses = 'bg-green-100 text-green-700';
            displayText = 'รับเข้า';
        } else if (type === 'out') {
            colorClasses = 'bg-red-100 text-red-700';
            displayText = 'ใช้งาน'; // Production context
        } else if (type === 'adjustment') {
            colorClasses = 'bg-yellow-100 text-yellow-700';
            displayText = 'ปรับปรุง';
        }
        
        return (
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${colorClasses}`}>
                {displayText}
            </span>
        );
    };

    // New state for enhanced data from your new APIs
    const [inventoryValue, setInventoryValue] = useState(null);
    const [usagePatterns, setUsagePatterns] = useState(null);
    const [loadingEnhanced, setLoadingEnhanced] = useState(true);

    if (error && !loadingRecent && !loadingSummary && !loadingTrend && !loadingItemTypes) {
        return (
            <div className="p-6 bg-red-50 text-red-700 rounded-md shadow">
                <p><strong>ข้อผิดพลาด:</strong> {error}</p>
                <button 
                    onClick={fetchAllDashboardData} 
                    className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                    ลองใหม่ทั้งหมด
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-gray-50 min-h-screen">
            {/* Enhanced Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">แดชบอร์ดคลังวัสดุสิ้นเปลือง</h1>
                    <p className="text-gray-600 mt-1">ติดตามและจัดการคลังวัสดุสิ้นเปลืองแบบเรียลไทม์</p>
                </div>
                <button
                    onClick={fetchAllDashboardData}
                    disabled={loadingSummary || loadingRecent}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    <RefreshIcon className="mr-3" />
                    <span>รีเฟรช</span>
                </button>
            </div>

            {/* Enhanced Summary Cards using real data */}
            {loadingSummary || loadingEnhanced ? (
                <div className="text-center py-8">
                    <p className="text-gray-500">กำลังโหลดข้อมูลสรุป...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SummaryCard 
                        title="รายการทั้งหมด" 
                        value={formatNumber(inventoryValue?.inventory_summary?.total_items || summaryData?.distinctConsumableItems || 0)}
                        icon={<ProductionItemsIcon />}
                        subValue={`${formatNumber(inventoryValue?.inventory_summary?.total_units || 0)} หน่วยรวม`}
                    />
                    <SummaryCard 
                        title="ต้องเร่งจัดหา" 
                        value={formatNumber(inventoryValue?.inventory_summary?.low_stock_count || summaryData?.lowStockItemsCount || 0)} 
                        icon={<CriticalStockIcon />}
                        subValue={
                            inventoryValue?.inventory_summary?.out_of_stock_count > 0 
                                ? `${inventoryValue.inventory_summary.out_of_stock_count} รายการหมดสต็อก` 
                                : "สถานะปกติ"
                        }
                        valueColor={
                            (inventoryValue?.inventory_summary?.low_stock_count || summaryData?.lowStockItemsCount || 0) > 0 
                                ? "text-red-600" : "text-green-600"
                        }
                    />
                    <SummaryCard 
                        title="การเคลื่อนไหววันนี้" 
                        value={formatNumber(inventoryValue?.today_activity?.total_movements || 0)}
                        icon={<ActivityIcon />}
                        subValue={
                            inventoryValue?.today_activity 
                                ? `รับ: ${inventoryValue.today_activity.total_received} ใช้: ${inventoryValue.today_activity.total_used}`
                                : "รายการเคลื่อนไหว"
                        }
                    />
                </div>
            )}

            {/* Enhanced Production Alerts using real data*/}
            <ProductionAlertsPanel 
                summaryData={summaryData} 
                recentMovements={recentMovements} 
                usagePatterns={usagePatterns}
                inventoryValue={inventoryValue}
            />

            {/* Usage Insights Section - More Prominent */}
            {usagePatterns && (usagePatterns.high_usage_items?.length > 0 || usagePatterns.risk_analysis?.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* High Usage Items */}
                    {usagePatterns.high_usage_items?.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-semibold text-blue-800 mb-4">
                                📊 วัสดุที่ใช้บ่อยที่สุด (30 วันที่ผ่านมา)
                            </h3>
                            <div className="space-y-4">
                                {usagePatterns.high_usage_items.slice(0, 5).map((item, index) => (
                                    <div key={index} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-blue-900">{item.name}</p>
                                            <p className="text-xs text-blue-700">
                                                ใช้เฉลี่ย {formatNumber(item.daily_usage)} {item.unit}/วัน
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-blue-800">
                                                คงเหลือ {formatNumber(item.current_stock)}
                                            </p>
                                            <p className="text-xs text-blue-600">
                                                ใช้ทั้งหมด {formatNumber(item.total_used_30d)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risk Analysis */}
                    {usagePatterns.risk_analysis?.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-semibold text-yellow-800 mb-4">
                                ⚠️ รายการเสี่ยงหมดเร็ว
                            </h3>
                            <div className="space-y-4">
                                {usagePatterns.risk_analysis.slice(0, 5).map((item, index) => (
                                    <div key={index} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-yellow-900">{item.name}</p>
                                            <p className="text-xs text-yellow-700">
                                                ใช้เฉลี่ย {formatNumber(item.daily_usage)} {item.unit}/วัน
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-yellow-800">
                                                ~{item.estimated_days_remaining} วัน
                                            </p>
                                            <p className="text-xs text-yellow-600">
                                                คงเหลือ {formatNumber(item.current_stock)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Enhanced Main Content - Single Column for Better Chart Size */}
            <div className="space-y-8">
                {/* Enhanced Movement Trend Chart - Full Width */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-700">แนวโน้มการใช้วัสดุสิ้นเปลือง</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                {trendChartFilters.item_type_id && itemTypes.length > 0 
                                    ? `ประเภท: ${itemTypes.find(t => t.item_type_id.toString() === trendChartFilters.item_type_id)?.type_name || 'ไม่ทราบ'}`
                                    : 'เลือกประเภทวัสดุเพื่อดูแนวโน้ม'
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <select 
                                name="item_type_id"
                                value={trendChartFilters.item_type_id} 
                                onChange={handleTrendFilterChange}
                                disabled={loadingItemTypes || itemTypes.length === 0}
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
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
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="last_7_days">7 วันที่ผ่านมา</option>
                                <option value="last_30_days">30 วันที่ผ่านมา</option>
                            </select>
                        </div>
                    </div>
                    {loadingTrend ? (
                        <div className="text-center py-12 h-[400px] flex items-center justify-center">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                <p className="text-gray-500">กำลังโหลดข้อมูลแนวโน้ม...</p>
                            </div>
                        </div>
                    ) : itemTypeMovementTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={itemTypeMovementTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} 
                                />
                                <YAxis />
                                <Tooltip 
                                    formatter={(value, name) => [
                                        formatNumber(value), 
                                        name === 'total_in' ? 'รับเข้า' : 'ใช้งาน'
                                    ]} 
                                />
                                <Legend />
                                <Area 
                                    type="monotone" 
                                    dataKey="total_in" 
                                    stackId="1" 
                                    stroke="#10b981" 
                                    fill="#10b981" 
                                    fillOpacity={0.6}
                                    name="รับเข้า"
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="total_out" 
                                    stackId="1" 
                                    stroke="#ef4444" 
                                    fill="#ef4444" 
                                    fillOpacity={0.6}
                                    name="ใช้งาน"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center text-gray-500 py-12 h-[400px] flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-4xl mb-4">📊</div>
                                <p className="text-lg mb-2">
                                    {trendChartFilters.item_type_id ? "ไม่มีข้อมูลการเคลื่อนไหว" : "เลือกประเภทวัสดุเพื่อดูแนวโน้ม"}
                                </p>
                                <p className="text-sm text-gray-400">
                                    {trendChartFilters.item_type_id 
                                        ? "ลองเปลี่ยนช่วงเวลาหรือเลือกประเภทอื่น" 
                                        : "กราฟจะแสดงเมื่อเลือกประเภทวัสดุแล้ว"
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Movements - Full Width but Compact */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">การเคลื่อนไหวล่าสุด</h2>
                    
                    {loadingRecent ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
                            <p className="text-gray-500">กำลังโหลดรายการเคลื่อนไหวล่าสุด...</p>
                        </div>
                    ) : recentMovements.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {recentMovements.slice(0, 6).map((movement) => (
                                <div key={movement.movement_id} className="p-4 bg-gray-50 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">{movement.consumable_name}</p>
                                            <div className="flex items-center text-xs text-gray-500 mt-1">
                                                <ClockIcon className="mr-1" />
                                                {new Date(movement.movement_date).toLocaleDateString('th-TH')}
                                            </div>
                                        </div>
                                        <MovementTypePill type={movement.movement_type} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className={`text-sm font-semibold ${
                                            movement.movement_type === 'in' ? 'text-green-600' : 
                                            movement.movement_type === 'out' ? 'text-red-600' : 'text-gray-700'
                                        }`}>
                                            {movement.movement_type === 'in' ? '+' : 
                                             movement.movement_type === 'out' ? '-' : ''}
                                            {formatNumber(Math.abs(movement.quantity_changed))} {movement.unit_of_measure}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            สต็อก: {formatNumber(movement.new_stock_level_after_movement)}
                                        </p>
                                    </div>
                                    {movement.recorded_by_username && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            โดย {movement.recorded_by_username}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-8">ไม่พบการเคลื่อนไหวของสต็อกล่าสุด.</p>
                    )}
                </div>
            </div>
        </div>
    );
}