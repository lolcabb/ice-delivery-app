import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, AlertCircle, X, CheckCircle, Truck, AlertTriangle } from 'lucide-react';
import { apiService } from '../apiService';

import TireCard from './TireCard';
import TireFormModal from './TireFormModal';
import TireAssignmentModal from './TireAssignmentModal';
import TireFilterBar from './TireFilterBar';

export default function TireStockManager() {
    const [tires, setTires] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [filteredTires, setFilteredTires] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedTire, setSelectedTire] = useState(null);
    
    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [brandFilter, setBrandFilter] = useState('All');
    const [sizeFilter, setSizeFilter] = useState('All');

    // Form states
    const [tireForm, setTireForm] = useState({
        serial_number: '',
        brand: '',
        sidewall: '',
        status: 'In Stock',
        purchase_date: ''
    });

    const [assignmentForm, setAssignmentForm] = useState({
        vehicle_id: '',
        position: '',
        mount_date: ''
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [tiresData, vehiclesData, assignmentsData] = await Promise.all([
                apiService.getVehicleTires(),
                apiService.getVehicles(),
                apiService.getTireAssignments()
            ]);
            
            setTires(Array.isArray(tiresData) ? tiresData : []);
            setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
            setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
        } catch (err) {
            console.error('Failed to fetch tire data:', err);
            setError('ไม่สามารถโหลดข้อมูลยางได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filter tires based on search and filters
    useEffect(() => {
        let filtered = tires;

        if (searchTerm) {
            filtered = filtered.filter(tire => 
                tire.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tire.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tire.sidewall?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'All') {
            filtered = filtered.filter(tire => tire.status === statusFilter);
        }

        if (brandFilter !== 'All') {
            filtered = filtered.filter(tire => tire.brand === brandFilter);
        }

        if (sizeFilter !== 'All') {
            filtered = filtered.filter(tire => tire.sidewall === sizeFilter);
        }

        setFilteredTires(filtered);
    }, [tires, searchTerm, statusFilter, brandFilter, sizeFilter]);

    const resetTireForm = () => {
        setTireForm({
            serial_number: '',
            brand: '',
            sidewall: '',
            status: 'In Stock',
            purchase_date: ''
        });
    };

    const resetAssignmentForm = () => {
        setAssignmentForm({
            vehicle_id: '',
            position: '',
            mount_date: ''
        });
    };

    const handleAddTire = async () => {
        if (!tireForm.serial_number || !tireForm.brand || !tireForm.sidewall) {
            setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }

        setLoading(true);
        try {
            const newTire = await apiService.addVehicleTire(tireForm);
            setTires(prev => [newTire, ...prev]);
            setShowAddModal(false);
            resetTireForm();
            setError(null);
        } catch (err) {
            console.error('Failed to add tire:', err);
            setError('ไม่สามารถเพิ่มยางได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    const handleEditTire = async () => {
        if (!tireForm.serial_number || !tireForm.brand || !tireForm.sidewall) {
            setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }

        setLoading(true);
        try {
            const updatedTire = await apiService.updateVehicleTire(selectedTire.tire_id, tireForm);
            setTires(prev => prev.map(t => 
                t.tire_id === selectedTire.tire_id ? updatedTire : t
            ));
            setShowEditModal(false);
            setSelectedTire(null);
            resetTireForm();
            setError(null);
        } catch (err) {
            console.error('Failed to update tire:', err);
            setError('ไม่สามารถแก้ไขข้อมูลยางได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTire = async (tireId) => {
        if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบยางนี้?')) return;
        
        setLoading(true);
        try {
            await apiService.deleteVehicleTire(tireId);
            setTires(prev => prev.filter(t => t.tire_id !== tireId));
            setError(null);
        } catch (err) {
            console.error('Failed to delete tire:', err);
            setError('ไม่สามารถลบยางได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignTire = async () => {
        if (!assignmentForm.vehicle_id || !assignmentForm.position || !assignmentForm.mount_date) {
            setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }

        setLoading(true);
        try {
            const assignmentData = {
                tire_id: selectedTire.tire_id,
                vehicle_id: assignmentForm.vehicle_id,
                position: assignmentForm.position,
                mount_date: assignmentForm.mount_date
            };
            
            const newAssignment = await apiService.assignVehicleTire(assignmentData);

            setTires(prev => prev.map(t =>
                t.tire_id === selectedTire.tire_id ? { ...t, status: 'On Vehicle' } : t
            ));

            setAssignments(prev => [newAssignment, ...prev]);

            setShowAssignModal(false);
            setSelectedTire(null);
            resetAssignmentForm();
            setError(null);
            
        } catch (err) {
            console.error('Failed to assign tire:', err);
            setError('ไม่สามารถติดตั้งยางได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    const handleUnmountTire = async (tire) => {
        if (!window.confirm('คุณแน่ใจหรือไม่ที่จะถอดยางนี้?')) return;
        
        setLoading(true);
        try {
            await apiService.unmountVehicleTire(tire.tire_id, {
                unmount_date: new Date().toISOString(),
                new_status: 'In Stock'
            });
            
            setTires(prev => prev.map(t =>
                t.tire_id === tire.tire_id ? { ...t, status: 'In Stock' } : t
            ));
            
            const assignmentsData = await apiService.getTireAssignments();
            setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
            setError(null);
        } catch (err) {
            console.error('Failed to unmount tire:', err);
            setError('ไม่สามารถถอดยางได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (tire) => {
        setSelectedTire(tire);
        setTireForm({
            serial_number: tire.serial_number || '',
            brand: tire.brand || '',
            sidewall: tire.sidewall || '',
            status: tire.status || 'In Stock',
            purchase_date: tire.purchase_date || ''
        });
        setShowEditModal(true);
    };

    const openAssignModal = (tire) => {
        setSelectedTire(tire);
        resetAssignmentForm();
        setShowAssignModal(true);
    };

    const getTireAssignment = (tireId) => {
        return assignments.find(a => a.tire_id === tireId && !a.unmount_date);
    };

    // Dynamic filter options from actual data
    const tireBrands = [...new Set(tires.map(t => t.brand).filter(Boolean))];
    const tireSizes = [...new Set(tires.map(t => t.sidewall).filter(Boolean))];

    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Package className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">การจัดการคลังยางรถยนต์</h1>
                                <p className="text-gray-600">จัดการสต๊อกยางและการติดตั้ง</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Add Tire
                        </button>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">ในคลัง</p>
                                <p className="text-xl font-semibold text-gray-900">
                                    {tires.filter(t => t.status === 'In Stock').length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Truck className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">ติดรถ</p>
                                <p className="text-xl font-semibold text-gray-900">
                                    {tires.filter(t => t.status === 'On Vehicle').length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">เลิกใช้</p>
                                <p className="text-xl font-semibold text-gray-900">
                                    {tires.filter(t => t.status === 'Retired').length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Package className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">ยางทั้งหมด</p>
                                <p className="text-xl font-semibold text-gray-900">{tires.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}

                <TireFilterBar
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    brandFilter={brandFilter}
                    setBrandFilter={setBrandFilter}
                    sizeFilter={sizeFilter}
                    setSizeFilter={setSizeFilter}
                    tireBrands={tireBrands}
                    tireSizes={tireSizes}
                />

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <p className="text-red-700">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="ml-auto text-red-400 hover:text-red-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        Array(6).fill(0).map((_, i) => (
                            <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                                <div className="h-4 bg-gray-200 rounded"></div>
                            </div>
                        ))
                    ) : filteredTires.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">ไม่พบยางในระบบ</p>
                            <p className="text-gray-400">กรุณาปรับคำค้นหาหรือตัวกรองของคุณ</p>
                        </div>
                    ) : (
                        filteredTires.map((tire) => (
                            <TireCard
                                key={tire.tire_id}
                                tire={tire}
                                assignment={getTireAssignment(tire.tire_id)}
                                onEdit={openEditModal}
                                onDelete={handleDeleteTire}
                                onAssign={openAssignModal}
                                onUnmount={handleUnmountTire}
                            />
                        ))
                    )}
                </div>
                <TireFormModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddTire}
                    tireForm={tireForm}
                    setTireForm={setTireForm}
                    loading={loading}
                    isEdit={false}
                />

                <TireFormModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSubmit={handleEditTire}
                    tireForm={tireForm}
                    setTireForm={setTireForm}
                    loading={loading}
                    isEdit={true}
                />

                <TireAssignmentModal
                    isOpen={showAssignModal}
                    onClose={() => setShowAssignModal(false)}
                    onSubmit={handleAssignTire}
                    assignmentForm={assignmentForm}
                    setAssignmentForm={setAssignmentForm}
                    selectedTire={selectedTire}
                    vehicles={vehicles}
                    loading={loading}
                />
                
            </div>
        </div>
    );
}