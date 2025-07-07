// src/salesops/DailyOperationsManager.jsx (Consolidated & Final Version)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../apiService';
import { getCurrentLocalDateISO, formatDisplayDate } from '../utils/dateUtils';
import { PlusIcon, EditIcon, CheckCircleIcon, PlayCircleIcon, DocumentTextIcon } from '../components/Icons';
import LoadingLogForm from './LoadingLogForm';
import ProductReturnModal from './ProductReturnModal';

const formatCurrency = (amount) => `฿${parseFloat(amount || 0).toFixed(2)}`;

// Helper to aggregate quantities loaded per product from an array of loading logs
const aggregateLoadsByProduct = (loadingLogs = []) => {
    const result = {};
    loadingLogs.forEach(log => {
        const routeId = log.route_id;
        (log.items || []).forEach(item => {
            if (!result[item.product_id]) {
                result[item.product_id] = {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    loaded: 0,
                    route_id: routeId
                };
            }
            result[item.product_id].loaded += parseFloat(item.quantity_loaded || 0);
            if (!result[item.product_id].route_id) result[item.product_id].route_id = routeId;
        });
    });
    return result;
};

// Helper to aggregate quantities sold per product from an array of sales records
const aggregateSalesByProduct = (sales = []) => {
    const result = {};
    sales.forEach(sale => {
        (sale.sale_items || []).forEach(item => {
            if (!result[item.product_id]) {
                result[item.product_id] = {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sold: 0
                };
            }
            result[item.product_id].sold += parseFloat(item.quantity_sold || 0);
        });
    });
    return result;
};

// --- Sub-Component for each driver's daily card ---
const DriverDayCard = ({ driverLog, onOpenLoadingLog, onOpenReturnLog, onNavigateToSales, onStartDay, isProcessing }) => {
    const { driver, summary, loading_logs, product_returns, product_reconciliation } = driverLog;
    const [isExpanded, setIsExpanded] = useState(false);

    const dayHasBeenStarted = !!summary;
    const hasLoadingLogs = loading_logs && loading_logs.length > 0;
    const returnsAreLogged = product_returns && product_returns.length > 0;
    const totalLoaded = Array.isArray(product_reconciliation)
        ? product_reconciliation.reduce((acc, item) => acc + parseFloat(item.loaded || 0), 0)
        : (hasLoadingLogs
            ? loading_logs.reduce((acc, log) => acc + log.items.reduce((sum, item) => sum + parseFloat(item.quantity_loaded || 0), 0), 0)
            : 0);

    const initialLog = hasLoadingLogs ? loading_logs.find(log => log.load_type === 'initial') : null;
    const refillLogs = hasLoadingLogs ? loading_logs.filter(log => log.load_type !== 'initial').sort((a, b) => new Date(a.load_timestamp) - new Date(b.load_timestamp)) : [];

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 transition-shadow hover:shadow-md">
            {/* Card Header */}
            <div className="p-4 flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg text-gray-800">{driver.name}</p>
                    <p className="text-xs text-gray-500">
                        {dayHasBeenStarted ? `สถานะ: ${summary.reconciliation_status}` : 'ยังไม่ได้เริ่มวัน'}
                    </p>
                </div>
                {returnsAreLogged && (
                    <span title="บันทึกคืนสินค้าแล้ว" className="flex items-center text-xs text-green-600 font-semibold">
                        <CheckCircleIcon className="w-5 h-5" /> บันทึกแล้ว
                    </span>
                )}
            </div>

            {/* Card Body */}
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                <div><span className="text-xs font-medium text-gray-500">เส้นทาง</span><p className="text-gray-800">{summary?.route_name || <span className="italic text-gray-400">N/A</span>}</p></div>
                <div><span className="text-xs font-medium text-gray-500">ยอดขึ้นของ</span><p className="text-gray-800">{totalLoaded} ถุง</p></div>
                <div><span className="text-xs font-medium text-gray-500">ยอดขายเงินสด</span><p className="text-gray-800">{formatCurrency(summary?.total_cash_sales_value)}</p></div>
                <div><span className="text-xs font-medium text-gray-500">ยอดขายเครดิต</span><p className="text-gray-800">{formatCurrency(summary?.total_new_credit_sales_value)}</p></div>
            </div>

             {/* Footer & Actions */}
            <div className="border-t bg-gray-50/70 rounded-b-lg p-2 flex justify-between items-center">
                 <button onClick={() => setIsExpanded(!isExpanded)} className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-black">
                    {isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                </button>
                {dayHasBeenStarted ? (
                    <div className="flex space-x-2">
                        <button onClick={() => onOpenReturnLog(driverLog)} className="px-3 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">บันทึกคืนสินค้า</button>
                        <button onClick={() => onNavigateToSales(driverLog)} className="px-3 py-1 text-xs font-semibold text-white bg-cyan-600 rounded-md shadow-sm hover:bg-cyan-700 flex items-center"><DocumentTextIcon className="w-4 h-4 mr-1"/>บันทึกการขาย</button>
                    </div>
                ) : (
                    <button onClick={() => onStartDay(driver.driver_id, loading_logs[0]?.route_id)} disabled={isProcessing || !hasLoadingLogs} title={!hasLoadingLogs ? "ต้องสร้างบันทึกการขึ้นของก่อน" : "เริ่มวันสำหรับการบันทึกการขาย"} className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center">
                        <PlayCircleIcon className="w-4 h-4 mr-1.5"/>เริ่มวัน
                    </button>
                )}
            </div>

            {/* Expandable Section */}
            {isExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 border-t">
                    <div>
                        <h4 className="font-semibold text-sm mb-2 text-gray-700">รายการขึ้นของ</h4>
                        {hasLoadingLogs ? (
                            <div className="space-y-3">
                                {initialLog && (
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-xs text-gray-500 uppercase">การขึ้นของเริ่มต้น</p>
                                            <ul className="list-disc list-inside pl-2 text-sm">{initialLog.items.map((item, i) => <li key={i}>{item.product_name} - <span className="font-semibold">{item.quantity_loaded}</span></li>)}</ul>
                                        </div>
                                        <button onClick={() => onOpenLoadingLog(initialLog)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md" title="แก้ไขการขึ้นของเริ่มต้น"><EditIcon className="w-4 h-4" /></button>
                                    </div>
                                )}
                                {refillLogs.map((log, index) => (
                                    <div key={log.batch_id} className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-xs text-gray-500 uppercase">การเติมของ #{index + 1}</p>
                                            <ul className="list-disc list-inside pl-2 text-sm">{log.items.map((item, i) => <li key={i}>{item.product_name} - <span className="font-semibold">{item.quantity_loaded}</span></li>)}</ul>
                                        </div>
                                        <button onClick={() => onOpenLoadingLog(log)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md" title={`แก้ไขการเติมของ #${index + 1}`}><EditIcon className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-sm text-gray-500 italic">ไม่มีข้อมูลการขึ้นของ</p>}
                    </div>
                     <div>
                        <h4 className="font-semibold text-sm mb-2 text-gray-700">รายการคืนสินค้า</h4>
                        {returnsAreLogged ? (
							<ul className="list-disc list-inside space-y-1 text-sm text-gray-700">{product_returns.map(item => <li key={item.return_id}>{item.product_name} - <span className="font-semibold">{item.quantity_returned}</span></li>)}</ul>
						) : <p className="text-sm text-gray-500 italic">ยังไม่มีการบันทึกคืน</p>}
                    </div>
                </div>
            )}
        </div>
    );
};


export default function DailyOperationsManager() {
    const [selectedDate, setSelectedDate] = useState(getCurrentLocalDateISO());
    const [driverLogs, setDriverLogs] = useState([]);
    const [allDrivers, setAllDrivers] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [allRoutes, setAllRoutes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [editingBatch, setEditingBatch] = useState(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [selectedDriverDataForReturn, setSelectedDriverDataForReturn] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debounceTimeoutRef = useRef(null);
    const navigate = useNavigate();

    const fetchDataForDay = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const loadingLogsForDay = await apiService.getLoadingLogs({ date: selectedDate });
            const driverDataMap = new Map();

            if (Array.isArray(loadingLogsForDay)) {
                loadingLogsForDay.forEach(log => {
                    if (!driverDataMap.has(log.driver_id)) {
                        driverDataMap.set(log.driver_id, {
                            driver: { driver_id: log.driver_id, name: log.driver_name },
                            summary: null,
                            loading_logs: [],
                            product_returns: [],
                            product_reconciliation: []
                        });
                    }
                    const entry = driverDataMap.get(log.driver_id);
                    const batchUUID = log.load_batch_uuid || `${log.driver_id}-${log.load_timestamp}-${log.load_type}`;
                    let batch = entry.loading_logs.find(b => b.load_batch_uuid === batchUUID);
                    if (!batch) {
                        batch = { ...log, batch_id: batchUUID, load_batch_uuid: log.load_batch_uuid, items: [] };
                        entry.loading_logs.push(batch);
                    }
                    batch.items.push({ product_id: log.product_id, product_name: log.product_name, quantity_loaded: log.quantity_loaded });
                });
            }
            
            // Pre-compute load aggregates for each driver
            const loadAggregates = new Map();
            for (const [dId, data] of driverDataMap.entries()) {
                loadAggregates.set(dId, aggregateLoadsByProduct(data.loading_logs));
            }

            for (const driverId of driverDataMap.keys()) {
                const driverLog = driverDataMap.get(driverId);
                const loadAgg = loadAggregates.get(driverId);
                try {
                    const [reconciliationData, productReturns] = await Promise.all([
                        apiService.getReconciliationSummary(driverId, selectedDate).catch(() => null),
                        apiService.getProductReturns({ driver_id: driverId, date: selectedDate }).catch(() => [])
                    ]);

                    driverLog.summary = reconciliationData?.summary || null;
                    driverLog.product_returns = productReturns || [];

                    let salesAgg = {};
                    if (driverLog.summary?.summary_id) {
                        try {
                            const salesData = await apiService.getDriverSales(driverLog.summary.summary_id);
                            if (Array.isArray(salesData)) salesAgg = aggregateSalesByProduct(salesData);
                        } catch (salesErr) {
                            console.error(`Error fetching sales for driver ${driverId}`, salesErr);
                        }
                    }

                    if (reconciliationData?.product_reconciliation && reconciliationData.product_reconciliation.length > 0) {
                        driverLog.product_reconciliation = reconciliationData.product_reconciliation;
                    } else {
                        const productIds = new Set([...Object.keys(loadAgg), ...Object.keys(salesAgg)]);
                        driverLog.product_reconciliation = Array.from(productIds).map(pid => ({
                            product_id: parseInt(pid),
                            product_name: loadAgg[pid]?.product_name || salesAgg[pid]?.product_name || '',
                            loaded: loadAgg[pid]?.loaded || 0,
                            sold: salesAgg[pid]?.sold || 0,
                            returned: 0,
                            route_id: loadAgg[pid]?.route_id || null
                        }));
                    }
                } catch (err) {
                    console.error(`Error fetching details for driver ${driverId}`, err);
                    driverLog.product_reconciliation = Object.entries(loadAgg).map(([pid, item]) => ({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        loaded: item.loaded,
                        sold: 0,
                        returned: 0,
                        route_id: item.route_id
                    }));
                }
            }
            setDriverLogs(Array.from(driverDataMap.values()));
        } catch (err) {
            setError("ไม่สามารถโหลดข้อมูลปฏิบัติงานรายวันได้ " + (err.data?.error || err.message));
            setDriverLogs([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        const fetchPrereqs = async () => {
            try {
                const [driversResponse, productsResponse, routesResponse] = await Promise.all([
                    apiService.getDrivers({ is_active: true }), 
                    apiService.getSalesProducts(), 
                    apiService.getDeliveryRoutes()
                ]);
            
                // Fix: Handle response objects properly
                const driversData = Array.isArray(driversResponse) ? driversResponse : 
                               (driversResponse?.data ? driversResponse.data : []);
                const productsData = Array.isArray(productsResponse) ? productsResponse : 
                                (productsResponse?.data ? productsResponse.data : []);
                const routesData = Array.isArray(routesResponse) ? routesResponse : 
                              (routesResponse?.data ? routesResponse.data : []);
            
                setAllDrivers(driversData);
                setAllProducts(productsData);
                setAllRoutes(routesData);
            } catch (err) { 
                console.error("Failed to fetch prerequisites:", err);
                setError("ไม่สามารถโหลดข้อมูลที่จำเป็นสำหรับฟอร์มได้ " + (err.data?.error || err.message)); 
                // Set empty arrays as fallback to prevent iteration errors
                setAllDrivers([]);
                setAllProducts([]);
                setAllRoutes([]);
            }
        };
        fetchPrereqs();
    }, []);

    useEffect(() => { fetchDataForDay(); }, [fetchDataForDay]);

    const handleSearchChange = (e) => {
        const query = e.target.value;
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = setTimeout(() => setSearchTerm(query), 300);
    };

    const filteredDriverLogs = useMemo(() => {
        if (!searchTerm) return driverLogs;
        return driverLogs.filter(log => log.driver.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [driverLogs, searchTerm]);

    const handleOpenLoadingLogModal = (batchToEdit = null) => {
        setEditingBatch(batchToEdit);
        setIsLoadModalOpen(true);
    };

    const handleSaveLoadingLog = async (logDataPayload) => {
        try {
            if (editingBatch) {
                if (editingBatch.load_batch_uuid) {
                    await apiService.updateLoadingLogBatch(editingBatch.load_batch_uuid, logDataPayload);
                } else {
                    setError('ไม่สามารถแก้ไขบันทึกชุดเก่าได้ จะสร้างชุดใหม่แทน');
                    await apiService.addLoadingLog(logDataPayload);
                }
            } else {
                await apiService.addLoadingLog(logDataPayload);
            }

            setSuccessMessage(`บันทึกการขึ้นของ ${editingBatch ? 'แก้ไข' : 'สร้างใหม่'} สำเร็จแล้ว!`);
            setIsLoadModalOpen(false);
            setEditingBatch(null);
            fetchDataForDay();
        } catch(err) {
            setError("บันทึกการขึ้นของไม่สำเร็จ " + (err.data?.error || err.message));
            throw err;
        }
    };

    const handleStartDay = async (driverId, routeId) => {
        setIsProcessing(true);
        try {
            await apiService.addDriverDailySummary({ driver_id: driverId, sale_date: selectedDate, route_id: routeId || null });
            setSuccessMessage("เริ่มต้นวันสำเร็จ!");
            await fetchDataForDay();
        } catch (err) { setError("เริ่มต้นวันไม่สำเร็จ " + (err.data?.error || err.message));
        } finally { setIsProcessing(false); }
    };

    const handleOpenReturnModal = (driverLog) => {
        if (!driverLog.summary) { setError("กรุณาเริ่มวันสำหรับคนขับนี้ก่อนบันทึกการคืนสินค้า"); return; }
        setSelectedDriverDataForReturn(driverLog); setIsReturnModalOpen(true);
    };

    const handleReturnSaveSuccess = () => {
        setSuccessMessage(`บันทึกการคืนสินค้าสำเร็จ!`); setIsReturnModalOpen(false); fetchDataForDay();
    };

    const handleNavigateToSalesEntry = (driverLog) => {
        if (driverLog.driver?.driver_id && selectedDate) {
            navigate(`/sales-ops/entry/${driverLog.summary.summary_id}`);
        } else {
            setError("Cannot navigate: Missing driver ID or date information.");
        }
    };

    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-gray-200">
                     <h2 className="text-xl sm:text-2xl font-semibold text-gray-700">การจัดการปฏิบัติงานรายวัน</h2>
                    <div className="flex items-center gap-x-4 mt-3 sm:mt-0">
                        <button onClick={() => handleOpenLoadingLogModal(null)} className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-cyan-700 flex items-center">
                            <PlusIcon className="w-5 h-5 mr-1.5"/> เพิ่มบันทึกขึ้นของ
                        </button>
                         <div>
                            <label htmlFor="operation-date-picker" className="text-sm font-medium sr-only">เลือกวันที่:</label>
                            <input type="date" id="operation-date-picker" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input-field text-sm w-44"/>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <label htmlFor="driver-search" className="block text-sm font-medium text-gray-600 mb-1">ค้นหาคนขับ</label>
                    <input type="text" id="driver-search" placeholder="พิมพ์ชื่อเพื่อค้นหา..." onChange={handleSearchChange} className="w-full md:w-1/3 input-field"/>
                </div>

                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm mb-4" role="alert">{error}</div>}
                {successMessage && <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm mb-4" role="alert">{successMessage}</div>}

                {isLoading ? (
                    <div className="text-center py-10"><p>กำลังโหลดข้อมูล...</p></div>
                ) : (
                    <div className="space-y-4">
                        {filteredDriverLogs.length > 0 ? filteredDriverLogs.map(log => (
                            <DriverDayCard 
                                key={log.driver.driver_id} driverLog={log}
                                onOpenLoadingLog={handleOpenLoadingLogModal} onOpenReturnLog={handleOpenReturnModal}
                                onNavigateToSales={handleNavigateToSalesEntry} onStartDay={handleStartDay}
                                isProcessing={isProcessing}
                            />
                        )) : (
                            <p className="text-center text-gray-500 py-8">
                                {searchTerm 
                                    ? `ไม่พบคนขับที่ชื่อ "${searchTerm}"` 
                                    : `ไม่พบบันทึกการขึ้นของสำหรับวันที่ ${formatDisplayDate(selectedDate)}`}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {isLoadModalOpen && (
                <LoadingLogForm
                    isOpen={isLoadModalOpen} onClose={() => { setIsLoadModalOpen(false); setEditingBatch(null); }}
                    onSave={handleSaveLoadingLog} drivers={allDrivers} products={allProducts} deliveryRoutes={allRoutes}
                    isLoadingDropdowns={!allDrivers.length || !allProducts.length} editingBatch={editingBatch} allDriverLogs={driverLogs}
                />
            )}
            {isReturnModalOpen && (
                 <ProductReturnModal
                    isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} onSaveSuccess={handleReturnSaveSuccess}
                    driver={selectedDriverDataForReturn?.driver} date={selectedDate} summary={selectedDriverDataForReturn?.summary}
                    loadedItems={selectedDriverDataForReturn?.product_reconciliation || []}
                    existingReturns={selectedDriverDataForReturn?.existingReturns || []} existingPackagingReturns={[]}
                />
            )}
             <style jsx global>{` .input-field { display: block; width: 100%; padding-left: 0.75rem; padding-right: 0.75rem; padding-top: 0.5rem; padding-bottom: 0.5rem; border-width: 1px; border-color: #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); } `}</style>
        </div>
    );
}