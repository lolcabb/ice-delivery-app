import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../apiService';
import SalesEntryGrid from './SalesEntryGrid';
import { formatDisplayDate } from '../utils/dateUtils';
import { ArrowPathIcon } from '../components/Icons';

function SalesGridPage() {
    const { summaryId } = useParams();
    const [summary, setSummary] = useState(null);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [existingSales, setExistingSales] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');
    const saveOrderTimeoutRef = useRef(null);

    const fetchData = useCallback(async () => {
        if (!summaryId) {
            console.warn('⚠️ Missing summaryId parameter');
            setIsLoading(false);
            setError('ไม่พบข้อมูล Summary ID');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess('');
        try {
            const [{ data: summaryList }, productsData] = await Promise.all([
                apiService.getDriverDailySummaries({ summary_id: summaryId }),
                apiService.getSalesProducts()
            ]);
        

        const fetchedSummary = Array.isArray(summaryList) ? summaryList[0] : null;
        setSummary(fetchedSummary);
        setProducts(Array.isArray(productsData) ? productsData : []);

        const SalesResponse = await apiService.getDriverSalesForEdit(summaryId);
        setExistingSales(SalesResponse?.sales || []);

        if(fetchedSummary?.route_id) {
            const customerResponse = await apiService.getRouteCustomers(fetchedSummary.route_id);
            setCustomers(customerResponse.customers || []);
        } else {
            setCustomers([]);
        }
    } catch (err) {
        const errorMessage = err?.data?.error || err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
        setError(`ไม่สามารถโหลดข้อมูลได้: ${errorMessage}`);
        setSummary(null);
        setProducts([]);
        setCustomers([]);
        setExistingSales([]);
    } finally {
        setIsLoading(false);
    }

    }, [summaryId]); // CHANGED: Now depends on summaryId

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
                    <div classsName="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                            <h1 className="text-2x1 font-bold text-gray-800">บันทึกการขาย</h1>
                            <p className="text-gray-600">
                                พนักงานขับรถ: <span className="font-semibold">{summary?.driver_name || '...'}</span> 
                                วันที่: <span classNAme="font-semibold">{formatDisplayDate(summary?.sale_date)}</span>
                            </p>
                    </div>
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
                            initialSales={existingSales}
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
            <style jsx>{`
                .input-field {
                    display: block;
                    width: 100%;
                    padding-left: 0.75rem;
                    padding-right: 0.75rem;
                    padding-top: 0.5rem;
                    padding-bottom: 0.5rem;
                    border-width: 1px;
                    border-style: solid;
                    border-color: #D1D5DB;
                    border-radius: 0.375rem;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                    background-color: white;
                }
                input[type="date"].input-field {
                    padding-right: 0.75rem;
                }
                .input-field:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #6366F1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5);
                }
                .btn-primary {
                    background-color: #4f46e5;
                    color: white;
                    padding: 0.625rem 1.25rem;
                    font-weight: 500;
                    font-size: 0.875rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06);
                }
                .btn-primary:hover {
                    background-color: #4338ca;
                }
                .btn-primary:disabled {
                    opacity: 0.5;
                }
            `}</style>
        </div>
    );
}

export default SalesGridPage;
