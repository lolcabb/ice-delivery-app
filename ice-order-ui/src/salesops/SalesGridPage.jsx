// src/salesops/SalesGridPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../apiService';
import { formatDisplayDate } from '../utils/dateUtils';
import { 
    ArrowLeftIcon, 
    UserGroupIcon, 
    CalendarDaysIcon, 
    MapPinIcon, 
    ArrowPathIcon,
    CheckCircleIcon
} from '../components/Icons';
import SalesEntryGrid from './SalesEntryGrid';

export default function SalesGridPage() {
    const { summaryId } = useParams();
    const navigate = useNavigate();

    const [summary, setSummary] = useState(null);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    const [orderSaveStatus, setOrderSaveStatus] = useState(null); // null, 'saving', 'saved', 'error'

    const fetchData = useCallback(async () => {
        if (!summaryId) return;
        setIsLoading(true);
        setError(null);
        try {
            const [summaryResponse, productsResponse] = await Promise.all([
                apiService.getDriverDailySummaries({ summary_id: summaryId }),
                apiService.getSalesProducts()
            ]);
            
            if (!summaryResponse.notModified) {
                const summaryResult = Array.isArray(summaryResponse.data) ? summaryResponse.data[0] : null;
                if (!summaryResult) {
                    throw new Error("Sales summary for this day could not be found.");
                }
                setSummary(summaryResult);
            }
            
            if (!productsResponse.notModified) {
                setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);
            }
        } catch (err) {
            setError("Could not load data for this sales entry page. " + (err.message || err.data?.error));
        } finally {
            setIsLoading(false);
        }
    }, [summaryId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle customer order changes
    const handleOrderChange = useCallback(async (customerIds) => {
        if (!summary?.route_id || customerIds.length === 0) return;

        setIsSavingOrder(true);
        setOrderSaveStatus('saving');

        try {
            await apiService.saveCustomerOrder(summary.route_id, customerIds);
            setOrderSaveStatus('saved');
            
            // Clear success message after 3 seconds
            setTimeout(() => {
                setOrderSaveStatus(null);
            }, 3000);

        } catch (err) {
            console.error('Failed to save customer order:', err);
            setOrderSaveStatus('error');
            
            // Clear error message after 5 seconds
            setTimeout(() => {
                setOrderSaveStatus(null);
            }, 5000);
        } finally {
            setIsSavingOrder(false);
        }
    }, [summary]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600"/>
                    <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <h3 className="text-red-800 font-semibold mb-2">เกิดข้อผิดพลาด</h3>
                        <p className="text-red-700">{error}</p>
                        <button
                            onClick={() => navigate(-1)}
                            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
                        >
                            <ArrowLeftIcon className="w-4 h-4 mr-2"/>
                            กลับ
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <button
                                onClick={() => navigate(-1)}
                                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeftIcon className="w-5 h-5"/>
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">บันทึกการขาย</h1>
                        </div>
                        
                        {/* Order Save Status */}
                        {orderSaveStatus && (
                            <div className={`
                                flex items-center px-3 py-1.5 rounded-full text-sm font-medium
                                ${orderSaveStatus === 'saving' ? 'bg-blue-100 text-blue-700' : ''}
                                ${orderSaveStatus === 'saved' ? 'bg-green-100 text-green-700' : ''}
                                ${orderSaveStatus === 'error' ? 'bg-red-100 text-red-700' : ''}
                            `}>
                                {orderSaveStatus === 'saving' && (
                                    <>
                                        <ArrowPathIcon className="w-4 h-4 mr-1.5 animate-spin"/>
                                        กำลังบันทึกลำดับ...
                                    </>
                                )}
                                {orderSaveStatus === 'saved' && (
                                    <>
                                        <CheckCircleIcon className="w-4 h-4 mr-1.5"/>
                                        บันทึกลำดับแล้ว
                                    </>
                                )}
                                {orderSaveStatus === 'error' && 'เกิดข้อผิดพลาดในการบันทึกลำดับ'}
                            </div>
                        )}
                    </div>

                    {/* Summary Info */}
                    {summary && (
                        <div className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center text-gray-700">
                                <UserGroupIcon className="w-5 h-5 mr-2 text-gray-400"/>
                                <span className="font-medium mr-2">พนักงานขับรถ:</span>
                                <span>{summary.driver_name || 'ไม่ระบุ'}</span>
                            </div>
                            <div className="flex items-center text-gray-700">
                                <CalendarDaysIcon className="w-5 h-5 mr-2 text-gray-400"/>
                                <span className="font-medium mr-2">วันที่:</span>
                                <span>{formatDisplayDate(summary.sale_date)}</span>
                            </div>
                            {summary.route_name && (
                                <div className="flex items-center text-gray-700">
                                    <MapPinIcon className="w-5 h-5 mr-2 text-gray-400"/>
                                    <span className="font-medium mr-2">เส้นทาง:</span>
                                    <span>{summary.route_name}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sales Entry Grid */}
                <SalesEntryGrid 
                    summary={summary}
                    products={products}
                    onSaveSuccess={() => {
                        // Show success message before navigating
                        alert('บันทึกข้อมูลการขายเรียบร้อยแล้ว');
                        navigate(-1);
                    }}
                    onOrderChange={handleOrderChange}
                />

                {/* Help Text */}
                <div className="mt-4 text-sm text-gray-600">
                    <p>💡 เคล็ดลับ:</p>
                    <ul className="mt-1 space-y-1 ml-6">
                        <li>• ลากแถวเพื่อจัดเรียงลำดับลูกค้าตามเส้นทางจริง</li>
                        <li>• พิมพ์ชื่อลูกค้าเพื่อค้นหาอย่างรวดเร็ว</li>
                        <li>• ลำดับการจัดเรียงจะถูกบันทึกอัตโนมัติทุก 5 วินาที</li>
                        <li>• กดปุ่ม + เพื่อเพิ่มแถวใหม่</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}