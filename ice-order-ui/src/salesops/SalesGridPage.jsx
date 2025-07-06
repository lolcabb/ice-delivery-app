import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../apiService';
import SalesEntryGrid from './SalesEntryGrid';
import { formatDate } from '../utils/dateUtils';
import { ArrowPathIcon } from '../components/Icons';

function SalesGridPage() {
    const { driverId, date } = useParams();
    const [summary, setSummary] = useState(null);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');
    const saveOrderTimeoutRef = useRef(null);

    const fetchData = useCallback(async () => {
        if (!driverId || !date) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccess('');
        try {
            const [summaryData, productsData] = await Promise.all([
                apiService.getReconciliationSummary(driverId, date),
                apiService.getProducts({ is_active: true, limit: 500 })
            ]);

            setSummary(summaryData);
            setProducts(productsData.data || []);

            if (summaryData?.route_id) {
                const customerResponse = await apiService.getRouteCustomers(summaryData.route_id);
                setCustomers(customerResponse.customers || []);
            } else {
                setCustomers([]);
            }
        } catch (err) {
            // FIXED: Make error message handling more robust to prevent crashes inside the catch block.
            const errorMessage = err?.data?.error || err?.message || "An unknown error occurred.";
            setError(`ไม่สามารถโหลดข้อมูลได้: ${errorMessage}`);
            setSummary(null);
            setProducts([]);
            setCustomers([]);
        } finally {
            // This will now be reached reliably.
            setIsLoading(false);
        }
    }, [driverId, date]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOrderChange = useCallback((customerIds) => {
        if (saveOrderTimeoutRef.current) {
            clearTimeout(saveOrderTimeoutRef.current);
        }
        saveOrderTimeoutRef.current = setTimeout(async () => {
            if (summary?.route_id) {
                try {
                    await apiService.saveCustomerOrder(summary.route_id, customerIds);
                    setSuccess('บันทึกลำดับลูกค้าอัตโนมัติแล้ว');
                    setTimeout(() => setSuccess(''), 3000); // Clear message after 3s
                } catch (err) {
                    setError("ไม่สามารถบันทึกลำดับลูกค้าได้");
                }
            }
        }, 2000); // 2-second debounce
    }, [summary?.route_id]);

    const handleAddCustomer = async (customerId) => {
        if (summary?.route_id) {
            try {
                await apiService.addCustomerToRoute(summary.route_id, customerId);
                const customerResponse = await apiService.getRouteCustomers(summary.route_id);
                setCustomers(customerResponse.customers || []);
                setSuccess('เพิ่มลูกค้าในเส้นทางแล้ว');
            } catch (err) {
                setError("ไม่สามารถเพิ่มลูกค้าได้: " + (err?.data?.error || err?.message));
            }
        }
    };

    const handleRemoveCustomer = async (customerId) => {
        if (summary?.route_id) {
            try {
                await apiService.removeCustomerFromRoute(summary.route_id, customerId);
                setCustomers(prev => prev.filter(c => c.customer_id !== customerId));
                setSuccess('นำลูกค้าออกจากเส้นทางแล้ว');
            } catch (err) {
                setError("ไม่สามารถนำลูกค้าออกได้: " + (err?.data?.error || err?.message));
            }
        }
    };
    
    const handleSaveSuccess = () => {
        setSuccess('บันทึกข้อมูลการขายทั้งหมดเรียบร้อยแล้ว!');
        fetchData(); // Refresh data after saving
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">บันทึกการขาย</h1>
                    <p className="text-gray-600">
                        พนักงานขับรถ: <span className="font-semibold">{summary?.driver_name || '...'}</span> | วันที่: <span className="font-semibold">{formatDate(date)}</span>
                    </p>
                </div>

                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
                {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">{success}</div>}

                {isLoading ? (
                    <div className="text-center p-10"><ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></div>
                ) : (
                    summary && products.length > 0 ? (
                        <SalesEntryGrid
                            summary={summary}
                            products={products}
                            initialCustomers={customers}
                            onOrderChange={handleOrderChange}
                            onAddCustomer={handleAddCustomer}
                            onRemoveCustomer={handleRemoveCustomer}
                            onSaveSuccess={handleSaveSuccess}
                        />
                    ) : (
                        <div className="text-center p-10 bg-white rounded-lg shadow">
                            <h3 className="text-lg font-semibold text-gray-700">ไม่พบข้อมูล</h3>
                            <p className="text-gray-500 mt-2">ไม่สามารถโหลดข้อมูลสรุปรายวัน สินค้า หรือข้อมูลลูกค้าได้ กรุณาตรวจสอบว่าพนักงานได้เริ่มงานสำหรับวันนี้แล้ว</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

export default SalesGridPage;
