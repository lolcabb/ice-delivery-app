// src/salesops/ReturnsLogManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService';
import { getCurrentLocalDateISO } from '../utils/dateUtils';
import ProductReturnModal from './ProductReturnModal';
import ProductReturnList from './ProductReturnList';
import { CheckCircleIcon, PlayCircleIcon } from '../components/Icons';

//Helper to aggregate loaded quantities by prodct for each driver
const aggregateLoadsByProduct = (logs) => {
    const byDriver = {};
    logs.forEach(log => {
        if (!byDriver[log.driver_id]) byDriver[log.driver_id] = {};
        const driverMap = byDriver[log.driver_id];
        if (!driverMap[log.product_id]) {
            driverMap[log.product_id] = {
                product_id: log.product_id,
                product_name: log.product_name,
                route_id: log.route_id,
                loaded: 0
            };
        }
        driverMap[log.product_id].loaded += Number(log.quantity_loaded || 0);
    });
    const result = {};
    Object.keys(byDriver).forEach(did => {
        result[did] = Object.values(byDriver[did]);
    });
    return result;
};

//Helper to aggregate quantity sold per product from driver sales
const aggregateSalesByProduct = (sales = []) => {
    return sales.reduce((acc, sale) => {
        (sale.sale_items || []).forEach(item => {
            if(!acc[item.product_id]) {
                acc[item.product_id] = {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sold: 0
                };
            }
            acc[item.product_id].sold += Number(item.quantity_sold || 0);
        });
        return acc;
    }, {});
};

const DriverCard = ({ driverLog, onOpenModal, onStartDay, isProcessing }) => {
    const { driver, summary, product_reconciliation: loadedItems, existingReturns } = driverLog;
    const dayHasBeenStarted = !!summary;

    const handleCardClick = () => {
        if (dayHasBeenStarted) {
            onOpenModal(driverLog);
        }
    };

    const handleStartDayClick = (e) => {
        e.stopPropagation();
        onStartDay(driver.driver_id);
    };

    return (
        <div
            onClick={handleCardClick}
            className={`p-4 border rounded-lg shadow-sm transition-all duration-200 ${dayHasBeenStarted ? 'bg-white hover:shadow-md hover:border-blue-500 cursor-pointer' : 'bg-gray-100 text-gray-500'}`}
        >
            <div className="flex justify-between items-center">
                <p className="font-bold text-gray-800">{driver.name}</p>
                {existingReturns?.length > 0 && (
                     <span title="Returns have been logged" className="flex items-center text-xs text-green-600 font-semibold">
                        <CheckCircleIcon className="w-4 h-4 mr-1" /> บันทึกแล้ว
                     </span>
                )}
            </div>
            <p className="text-xs text-gray-600 mt-1">{loadedItems?.length || 0} รายการที่บันทึก</p>
            
            {!dayHasBeenStarted && (
                <div className="mt-3 text-center">
                    <button 
                        onClick={handleStartDayClick} 
                        disabled={isProcessing}
                        className="w-full px-2 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-green-700 flex items-center justify-center disabled:opacity-50"
                    >
                        <PlayCircleIcon className="w-4 h-4 mr-1.5" />
                        เริ่มวัน
                    </button>
                    <p className="text-xs text-gray-400 mt-1">ยังไม่ได้เริ่มวันขาย</p>
                </div>
            )}
        </div>
    );
};


export default function ReturnsLogManager() {
    const [selectedDate, setSelectedDate] = useState(getCurrentLocalDateISO());
    const [driverLogs, setDriverLogs] = useState([]);
    const [allProductReturns, setAllProductReturns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDriverData, setSelectedDriverData] = useState(null);

    const fetchDataForDay = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const allLogs = await apiService.getLoadingLogs({ date: selectedDate });
            if (!Array.isArray(allLogs)) {
                setDriverLogs([]);
                setIsLoading(false);
                return;
            }

            const driverDataMap = new Map();
            allLogs.forEach(log => {
                if (!driverDataMap.has(log.driver_id)) {
                    driverDataMap.set(log.driver_id, {
                        driver: { driver_id: log.driver_id, name: log.driver_name },
                        summary: null, product_reconciliation: [],
                        existingReturns: [], existingPackagingReturns: []
                    });
                }
            });

            const loadsAggregated = aggregateLoadsByProduct(allLogs);

            const [productReturnsResult, packagingReturnsResult] = await Promise.all([
                apiService.getProductReturns({ date: selectedDate }).catch(e => { console.error("Failed to get product returns:", e); return []; }),
                apiService.getPackagingLogs({ date: selectedDate }).catch(e => { console.error("Failed to get packaging logs:", e); return []; })
            ]);

            const allProductReturns = Array.isArray(productReturnsResult) ? productReturnsResult : [];
            const allPackagingReturns = Array.isArray(packagingReturnsResult) ? packagingReturnsResult : [];

            for (const driverId of driverDataMap.keys()) {
                const driverLog = driverDataMap.get(driverId);
                const aggregatedLoad = loadsAggregated[driverId] || [];
                let salesAggregated = {};

                try {
                    const reconciliationData = await apiService.getReconciliationSummary(driverId, selectedDate);
                    if (reconciliationData.summary) driverLog.summary = reconciliationData.summary;
                    if (reconciliationData && reconciliationData.product_reconciliation) driverLog.product_reconciliation = reconciliationData.product_reconciliation;
                } catch (summaryErr) {
                    console.log(`No summary found for driver ${driverId} on ${selectedDate}, they may need to "Start Day".`);
                }

                if(driverLog.summary && driverLog.summary.summary_id) {
                    try {
                        const salesData = await apiService.getDriverSales(driverLog.summary.summary_id);
                        salesAggregated = aggregateSalesByProduct(Array.isArray(salesData) ? salesData : []);
                    } catch (salesErr) {
                        console.error(`Failed to get driver sales for summary ${driverLog.summary.summary_id}:`, salesErr);
                    }
                }

                if(!driverLog.product_reconciliation || driverLog.product_reconciliation.length === 0) {
                    driverLog.product_reconciliation = aggregatedLoad.map(item => ({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        loaded: item.loaded,
                        sold: salesAggregated[item.product_id]?.sold || 0,
                        returned: 0,
                        route_id: item.route_id
                    }));
                }

                driverLog.existingReturns = allProductReturns.filter(r => r.driver_id === driverId);
                driverLog.existingPackagingReturns = allPackagingReturns.filter(p => p.driver_id === driverId);
            }

            setDriverLogs(Array.from(driverDataMap.values()));
            setAllProductReturns(allProductReturns);

        } catch (err) {
            setError("ไม่สามารถโหลดข้อมูลได้ " + (err.data?.error || err.message));
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchDataForDay();
    }, [fetchDataForDay]);

    const handleOpenModal = (data) => {
        setSelectedDriverData(data);
        setIsModalOpen(true);
    };

    const handleStartDay = async (driverId) => {
        setIsProcessing(true);
        setError(null);
        setSuccessMessage('');
        try {
            const driverInfo = driverLogs.find(d => d.driver.driver_id === driverId);
            // Safely access the route_id from the first loading log for the day
            const routeIdForDay = driverInfo?.product_reconciliation?.[0]?.route_id || null;

            await apiService.addDriverDailySummary({
                driver_id: driverId,
                sale_date: selectedDate,
                route_id: routeIdForDay // Pass the correct route_id
            });
            setSuccessMessage("เริ่มต้นวันสำเร็จ! ตอนนี้คุณสามารถบันทึกคืนสินค้าได้แล้ว");
            await fetchDataForDay();
        } catch (err) {
             setError("เริ่มต้นวันไม่สำเร็จ " + (err.data?.error || err.message));
        } finally {
            setIsProcessing(false);
        }
    };
    
    // ** FIX: This is the new, simplified success handler. It replaces handleSaveReturns. **
    const handleSaveSuccess = () => {
        setSuccessMessage(`บันทึกคืนสินค้าสำเร็จ!`);
        fetchDataForDay(); // Refresh the data on the main page
    };


    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-gray-200">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700">บันทึกคืนสินค้ารายวัน</h2>
                    <div>
                        <label htmlFor="return-date-picker" className="text-sm font-medium mr-2">เลือกวันที่:</label>
                        <input
                            type="date"
                            id="return-date-picker"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="input-field text-sm"
                        />
                    </div>
                </div>

                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm mb-4" role="alert">{error}</div>}
                {successMessage && <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm mb-4" role="alert">{successMessage}</div>}

                <h3 className="text-md font-semibold text-gray-700 mb-3">พนักงานขับรถที่มีบันทึกการขึ้นของสำหรับวันที่ {selectedDate}</h3>
                {isLoading ? (
                    <p className="text-center text-gray-500 py-8">กำลังโหลด...</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {driverLogs.map((driverLog) => (
                            <DriverCard
                                key={driverLog.driver.driver_id}
                                driverLog={driverLog}
                                onOpenModal={handleOpenModal}
                                onStartDay={handleStartDay}
                                isProcessing={isProcessing}
                            />
                        ))}
                    </div>
                )}

                <ProductReturnList returns={allProductReturns} isLoading={isLoading} />
            </div>

            {isModalOpen && (
                <ProductReturnModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    // *** FIX: Pass the correct success handler prop. The 'onSave' prop is removed. ***
                    onSaveSuccess={handleSaveSuccess}
                    driver={selectedDriverData?.driver}
                    date={selectedDate}
                    summary={selectedDriverData?.summary}
                    loadedItems={selectedDriverData?.product_reconciliation || []}
                    existingReturns={selectedDriverData?.existingReturns || []}
                    existingPackagingReturns={selectedDriverData?.existingPackagingReturns || []}
                />
            )}
        </div>
    );
}
