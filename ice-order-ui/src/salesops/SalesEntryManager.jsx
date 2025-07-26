// src/salesops/SalesEntryManager.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../apiService';
import { getCurrentLocalDateISO, formatDisplayDate } from '../utils/dateUtils';
import { UserGroupIcon, CalendarDaysIcon, MapPinIcon, DocumentTextIcon, CheckCircleIcon, ArrowPathIcon } from '../components/Icons'; 
import SalesEntryTable from './SalesEntryTable';
import SalesEntryList from './SalesEntryList'; 

export default function SalesEntryManager() {
    const salesFormRef = useRef(null); // Reference to the sales entry form component
    // ... (state for selectedDriverId, selectedDate, etc. remains the same)
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [selectedDate, setSelectedDate] = useState(getCurrentLocalDateISO());
    const [selectedRouteId, setSelectedRouteId] = useState(''); 
    const [drivers, setDrivers] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [products, setProducts] = useState([]); 
    const [currentDailySummary, setCurrentDailySummary] = useState(null);
    const [existingSales, setExistingSales] = useState([]);
    const [isLoadingSummary, setIsLoadingSummary] = useState(false); 
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    // --- NEW STATE TO MANAGE EDITING ---
    const [editingSale, setEditingSale] = useState(null); // This will hold the sale object being edited, or null for new entries

    const currentUser = JSON.parse(localStorage.getItem('authUser'));
    const currentUserRole = currentUser?.role?.toLowerCase();

    // ... (fetchInitialData and loadOrCreateDailySummary remain the same)
    const fetchInitialData = useCallback(async () => {
        setIsLoadingDropdowns(true);
        setError(null);
        try {
            const [driversData, routesData, productsData] = await Promise.all([
                apiService.getDrivers({ is_active: true }),
                apiService.getDeliveryRoutes(),
                apiService.getSalesProducts(), 
            ]);
            setDrivers(Array.isArray(driversData) ? driversData : []);
            setRoutes(Array.isArray(routesData) ? routesData : []);
            setProducts(Array.isArray(productsData) ? productsData : []); 
        } catch (err) {
            setError("ไม่สามารถโหลดข้อมูลที่จำเป็น (พนักงานขับรถ, เส้นทาง, หรือสินค้า) ได้ " + (err.data?.error || err.message));
        } finally {
            setIsLoadingDropdowns(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const loadOrCreateDailySummary = useCallback(async () => {
        if (!selectedDriverId || !selectedDate) {
            setCurrentDailySummary(null);
            setExistingSales([]);
            setError("กรุณาเลือกพนักงานขับรถและวันที่");
            return;
        }
        setIsLoadingSummary(true);
        setError(null);
        setSuccessMessage('');
        setEditingSale(null); // Reset editing state when loading a new day

        try {
            const { data: fetchedSummaries } = await apiService.getDriverDailySummaries({ driver_id: selectedDriverId, sale_date: selectedDate });
            let summaryToUse = Array.isArray(fetchedSummaries) ? fetchedSummaries[0] : null;

            if (!summaryToUse) {
                summaryToUse = await apiService.addDriverDailySummary({ driver_id: selectedDriverId, sale_date: selectedDate, route_id: selectedRouteId || null });
                setSuccessMessage(`สร้างสรุปรายวันใหม่แล้ว`);
            } else {
                setSuccessMessage(`โหลดสรุปที่มีอยู่แล้ว`);
            }
            
            setCurrentDailySummary(summaryToUse);

            if (summaryToUse && summaryToUse.summary_id) {
                const salesData = await apiService.getDriverSales(summaryToUse.summary_id);
                setExistingSales(Array.isArray(salesData) ? salesData : []);
            } else {
                setExistingSales([]);
            }
        } catch (err) {
             if (err.status === 404) {
                 // Handle case where getDriverDailySummaries returns 404 -> create new one
                try {
                     const summaryToUse = await apiService.addDriverDailySummary({ driver_id: selectedDriverId, sale_date: selectedDate, route_id: selectedRouteId || null });
                     setCurrentDailySummary(summaryToUse);
                     setExistingSales([]);
                     setSuccessMessage(`สร้างสรุปรายวันใหม่แล้ว`);
                } catch(createErr) {
                     setError("สร้างสรุปรายวันใหม่ไม่สำเร็จ " + (createErr.data?.error || createErr.message));
                }
            } else {
                setError("ประมวลผลสรุปรายวันไม่สำเร็จ " + (err.data?.error || err.message));
                setCurrentDailySummary(null); 
                setExistingSales([]);
            }
        } finally {
            setIsLoadingSummary(false);
        }
    }, [selectedDriverId, selectedDate, selectedRouteId]);

    // --- NEW "SMART" SAVE/UPDATE HANDLER ---
    const handleSubmitSale = async (saleDataFromForm) => {
        if (!currentDailySummary || !currentDailySummary.summary_id) {
            throw new Error("No active daily summary.");
        }

        const payload = {
            ...saleDataFromForm,
            driver_daily_summary_id: currentDailySummary.summary_id,
            sale_items: saleDataFromForm.items
        };
        delete payload.items;

        setSuccessMessage('');

        try {
            let updatedOrCreatedSale;
            if (editingSale && editingSale.sale_id) {
                // UPDATE existing sale
                updatedOrCreatedSale = await apiService.updateDriverSale(editingSale.sale_id, payload);
                setSuccessMessage(`การขาย ID #${editingSale.sale_id} อัปเดตสำเร็จ`);
            } else {
                // CREATE new sale
                updatedOrCreatedSale = await apiService.addDriverSale(payload);
                setSuccessMessage(`บันทึกการขายใหม่ (ID: ${updatedOrCreatedSale.sale_id}) สำเร็จ`);
            }
            
            // --- Refresh data and reset form ---
            const salesData = await apiService.getDriverSales(currentDailySummary.summary_id);
            setExistingSales(Array.isArray(salesData) ? salesData : []);
            setEditingSale(null); // Go back to "New Sale" mode

            return updatedOrCreatedSale;
        } catch (err) {
            const submissionError = `${editingSale ? 'อัปเดต' : 'สร้าง'} การขายไม่สำเร็จ ` + (err.data?.error || err.message);
            setError(submissionError);
            throw new Error(submissionError);
        }
    };
    
    // --- NEW HANDLERS FOR LIST ACTIONS ---
    const handleEditSale = (saleToEdit) => {
        console.log("Loading sale into form for editing:", saleToEdit);
        setEditingSale(saleToEdit);
        salesFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); // Scroll to Sales Entry Form
    };

    const handleDeleteSale = async (saleId) => {
        if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบการขาย ID #${saleId}? การดำเนินการนี้ไม่สามารถย้อนกลับได้`)) {
            return;
        }
        try {
            await apiService.deleteDriverSale(saleId);
            setSuccessMessage(`การขาย ID #${saleId} ถูกลบเรียบร้อยแล้ว`);
            const salesData = await apiService.getDriverSales(currentDailySummary.summary_id);
            setExistingSales(Array.isArray(salesData) ? salesData : []);
        } catch (err) {
            setError("ลบการขายไม่สำเร็จ " + (err.data?.error || err.message));
        }
    };

    // --- NEW HANDLER EDITING ROUTE ---
    const handleUpdateRoute = async () => {
        if (!currentDailySummary || selectedRouteId === (currentDailySummary.route_id?.toString() || '')) {
            return; // No change to update
        }
        setError(null);
        setSuccessMessage('');
        try {
            const updatedSummary = await apiService.updateDriverDailySummary(currentDailySummary.summary_id, {
                route_id: selectedRouteId || null
            });
            setCurrentDailySummary(updatedSummary); // Update state with fresh data from API
            setSuccessMessage("อัปเดตเส้นทางสำเร็จ!");
        } catch (err) {
            setError("อัปเดตเส้นทางไม่สำเร็จ " + (err.data?.error || err.message));
        }
    };

    // --- NEW HANDLER FOR CUSTOMER SELECTION LOGIC ---
    const handleCustomerSelect = (customer) => {
        if (!customer) {
            setEditingSale(null); // Clear form if customer is deselected
            return;
        }
        const customerSalesToday = existingSales.filter(s => s.customer_id === customer.customer_id);
        if (customerSalesToday.length === 1) {
            // If exactly one sale exists, load it for editing
            handleEditSale(customerSalesToday[0]);
        } else {
            // If zero or multiple sales exist, prepare a new entry form for this customer
            setEditingSale({
                // This is a "pre-filled" new sale object
                sale_id: null, // Indicates it's a new sale
                customer_id: customer.customer_id,
                actual_customer_name: customer.customer_name,
                payment_type: 'Cash', // Default payment type
                sale_items: [] // Start with empty items
            });
        }
    };

    const isSalesEntryDisabled = !currentDailySummary || 
                                (currentDailySummary.reconciliation_status === 'Reconciled' && 
                                 !['admin', 'manager'].includes(currentUserRole));
                                 
    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="bg-white shadow-md rounded-lg">
                {/* Header and Load/Start Day section remains the same */}
                <div className="p-4 sm:p-6 border-b border-gray-200">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-1">บันทึกการขาย</h2>
                    <p className="text-sm text-gray-500">บันทึกรายการขายสำหรับพนักงานขับรถและวันที่ที่เลือก</p>
                </div>
                <div className="p-4 sm:p-6 bg-gray-50/70">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 items-end">
                       {/* Dropdowns and button remain the same */}
                       <div>
                            <label htmlFor="sales-driver" className="block text-xs font-medium text-gray-600 mb-1">พนักงานขับรถ *</label>
                            <select id="sales-driver" value={selectedDriverId} onChange={(e) => { setSelectedDriverId(e.target.value); setCurrentDailySummary(null); setExistingSales([]); setError(null); setSuccessMessage(''); setEditingSale(null); }} className="w-full input-field text-sm" disabled={isLoadingDropdowns}>
                                <option value="">{isLoadingDropdowns ? "กำลังโหลด..." : "-- เลือกพนักงานขับรถ --"}</option>
                                {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.name || `${d.first_name} ${d.last_name || ''}`.trim()}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="sales-date" className="block text-xs font-medium text-gray-600 mb-1">วันที่ *</label>
                            <input type="date" id="sales-date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setCurrentDailySummary(null); setExistingSales([]); setError(null); setSuccessMessage(''); setEditingSale(null); }} className="w-full input-field text-sm" disabled={isLoadingDropdowns} />
                        </div>
                        <div>
                            <label htmlFor="sales-route" className="block text-xs font-medium text-gray-600 mb-1">เส้นทาง (ไม่บังคับ)</label>
                            <select id="sales-route" value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)} className="w-full input-field text-sm" disabled={isLoadingDropdowns}>
                                <option value="">{isLoadingDropdowns ? "กำลังโหลด..." : "-- ทุกเส้นทาง --"}</option>
                                {routes.map(r => <option key={r.route_id} value={r.route_id}>{r.route_name}</option>)}
                            </select>
                        </div>
                        {/* Conditionally show "Load Day" or "Update Route" button */}
                        {currentDailySummary ? (
                        <button
                            onClick={handleUpdateRoute}
                            disabled={isLoadingSummary || selectedRouteId === (currentDailySummary.route_id?.toString() || '')}
                            className="w-full lg:w-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                            อัปเดตเส้นทาง
                        </button>
                            ) : (
                        <button onClick={loadOrCreateDailySummary} disabled={!selectedDriverId || !selectedDate || isLoadingSummary || isLoadingDropdowns} className="w-full lg:w-auto px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 flex items-center justify-center">
                            {isLoadingSummary ? <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin"/> : <DocumentTextIcon className="w-4 h-4 mr-2"/>}
                            {isLoadingSummary ? "กำลังโหลดวัน..." : "โหลด / เริ่มต้นวัน"}
                        </button>
                        )}
                    </div>
                </div>

                {/* Messages and Summary Display remain the same */}
                {successMessage && <div className="mx-4 sm:mx-6 mt-4 p-3 bg-green-100 text-green-700 border border-green-200 rounded-md text-sm shadow-sm">{successMessage}</div>}
                {error && <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm shadow-sm">{error}</div>}
                {isLoadingSummary && <div className="p-6 text-center text-gray-500"><ArrowPathIcon className="w-6 h-6 mx-auto animate-spin mb-2 text-indigo-500"/>Loading summary...</div>}
                
                {!isLoadingSummary && currentDailySummary && (
                    <div className="p-4 sm:p-6">
                        {/* Active Day Summary Box */}
                        <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded-lg mb-6 shadow">
                            <h3 className="text-md font-semibold text-blue-800 mb-2">สรุปวันทำงานปัจจุบัน</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 items-center text-xs sm:text-sm">
                                <div className="flex items-center col-span-2 sm:col-span-1">
                                    <UserGroupIcon className="w-4 h-4 text-blue-600 mr-1.5 flex-shrink-0"/>
                                    <span className="font-medium text-gray-600">พนักงานขับรถ:</span>
                                    <span className="ml-1 text-blue-700 font-semibold truncate" title={currentDailySummary.driver_name}>
                                        {currentDailySummary.driver_name || `ID: ${currentDailySummary.driver_id}`}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <CalendarDaysIcon className="w-4 h-4 text-blue-600 mr-1.5 flex-shrink-0"/>
                                    <span className="font-medium text-gray-600">วันที่:</span>
                                    <span className="ml-1 text-blue-700 font-semibold">{formatDisplayDate(currentDailySummary.sale_date)}</span>
                                </div>
                                {currentDailySummary.route_name && (
                                <div className="flex items-center">
                                    <MapPinIcon className="w-4 h-4 text-blue-600 mr-1.5 flex-shrink-0"/>
                                    <span className="font-medium text-gray-600">สาย:</span>
                                    <span className="ml-1 text-blue-700 font-semibold truncate" title={currentDailySummary.route_name}>{currentDailySummary.route_name}</span>
                                </div>
                                )}
                                <div className="flex items-center">
                                    <CheckCircleIcon className={`w-4 h-4 mr-1.5 flex-shrink-0 ${currentDailySummary.reconciliation_status === 'Reconciled' ? 'text-green-600' : 'text-yellow-500'}`}/>
                                    <span className="font-medium text-gray-600">สถานะ:</span>
                                    <span className={`ml-1 font-semibold ${currentDailySummary.reconciliation_status === 'Reconciled' ? 'text-green-700' : 'text-yellow-600'}`}>
                                        {currentDailySummary.reconciliation_status || 'Pending'}
                                    </span>
                                </div>
                                <div className="text-gray-600"><span className="font-medium">ยอดขายเงินสด:</span> <span className="font-semibold text-blue-700">฿{parseFloat(currentDailySummary.total_cash_sales_value || 0).toFixed(2)}</span></div>
                                <div className="text-gray-600"><span className="font-medium">ยอดขายเครดิต:</span> <span className="font-semibold text-blue-700">฿{parseFloat(currentDailySummary.total_new_credit_sales_value || 0).toFixed(2)}</span></div>
                                <div className="text-gray-600"><span className="font-medium">ยอดขายอื่นๆ:</span> <span className="font-semibold text-blue-700">฿{parseFloat(currentDailySummary.total_other_payment_sales_value || 0).toFixed(2)}</span></div>
                            </div>
                            {isSalesEntryDisabled && (
                                <p className="mt-2 text-xs text-red-600 font-medium">วันดังกล่าวได้รับการปรับยอดแล้ว การบันทึกการขายถูกล็อค ติดต่อผู้ดูแลระบบ/ผู้จัดการเพื่อขอปรับเปลี่ยน</p>
                            )}
                        </div>
                        
                        <div ref={salesFormRef}>
                        {/* The Unified Form/List Component */}
                        <SalesEntryTable 
                            key={editingSale ? editingSale.sale_id : 'new-sale'} // IMPORTANT: Add a key to force re-render when switching between new/edit
                            products={products}
                            onSubmitSale={handleSubmitSale}
                            disabled={isSalesEntryDisabled}
                            saleToEdit={editingSale} // Pass the sale to be edited
                            onCustomerSelect={handleCustomerSelect} // Pass the new handler
                            existingSales={existingSales} // Pass existing sales for the "search-to-edit" logic
                            onClearForm={() => setEditingSale(null)} // Add a way to clear the form
                        />
                        </div>

                        <SalesEntryList
                            sales={existingSales}
                            onEdit={handleEditSale}
                            onDelete={handleDeleteSale}
                        />
                    </div>
                )}
                
                {/* Prompt to load a day */}
                {!isLoadingSummary && !currentDailySummary && selectedDriverId && selectedDate && (
                     <div className="p-6 text-center text-gray-500 italic">คลิก "โหลด / เริ่มต้นวัน" เพื่อเริ่มบันทึกการขาย</div>
                )}
            </div>
            <style jsx global>{`
                .input-field { display: block; width: 100%; padding-left: 0.75rem; padding-right: 0.75rem; padding-top: 0.5rem; padding-bottom: 0.5rem; border-width: 1px; border-color: #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); background-color: white; }
                select.input-field { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); background-position: right 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em; padding-right: 2.5rem; }
                input[type="date"].input-field { padding-right: 0.75rem; }
                .input-field:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3); }
                .input-field:disabled { background-color: #f3f4f6; color: #6b7280; border-color: #e5e7eb; cursor: not-allowed; opacity: 0.7; }
            `}</style>
        </div>
    );
}
