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
            const [tiresData, vehiclesData] = await Promise.all([
                apiService.getVehicleTires(),
                apiService.getVehicles()
            ]);
            
            setTires(Array.isArray(tiresData) ? tiresData : []);
            setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
            
            // Try to get tire assignments if API exists
            try {
                // This might not exist yet in your API - add when ready
                // const assignmentsData = await apiService.getTireAssignments();
                // setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
            } catch (err) {
                console.log('Tire assignments API not available yet');
                setAssignments([]);
            }
        } catch (err) {
            console.error('Failed to fetch tire data:', err);
            setError('Failed to fetch tire data. Please try again.');
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
            setError('Please fill in all required fields');
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
            setError('Failed to add tire. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditTire = async () => {
        if (!tireForm.serial_number || !tireForm.brand || !tireForm.sidewall) {
            setError('Please fill in all required fields');
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
            setError('Failed to update tire. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTire = async (tireId) => {
        if (!window.confirm('Are you sure you want to delete this tire?')) return;
        
        setLoading(true);
        try {
            await apiService.deleteVehicleTire(tireId);
            setTires(prev => prev.filter(t => t.tire_id !== tireId));
            setError(null);
        } catch (err) {
            console.error('Failed to delete tire:', err);
            setError('Failed to delete tire. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignTire = async () => {
        if (!assignmentForm.vehicle_id || !assignmentForm.position || !assignmentForm.mount_date) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            // When you add tire assignment API, replace this section
            const assignmentData = {
                tire_id: selectedTire.tire_id,
                vehicle_id: assignmentForm.vehicle_id,
                position: assignmentForm.position,
                mount_date: assignmentForm.mount_date
            };
            
            // For now, just update tire status - replace with actual assignment API
            await apiService.updateVehicleTire(selectedTire.tire_id, {
                ...selectedTire,
                status: 'On Vehicle'
            });
            
            setTires(prev => prev.map(t => 
                t.tire_id === selectedTire.tire_id ? { ...t, status: 'On Vehicle' } : t
            ));
            
            setShowAssignModal(false);
            setSelectedTire(null);
            resetAssignmentForm();
            setError(null);
            
            console.log('Tire assignment data (ready for API):', assignmentData);
        } catch (err) {
            console.error('Failed to assign tire:', err);
            setError('Failed to assign tire. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleUnmountTire = async (tire) => {
        if (!window.confirm('Are you sure you want to unmount this tire?')) return;
        
        setLoading(true);
        try {
            await apiService.updateVehicleTire(tire.tire_id, {
                ...tire,
                status: 'In Stock'
            });
            
            setTires(prev => prev.map(t => 
                t.tire_id === tire.tire_id ? { ...t, status: 'In Stock' } : t
            ));
            setError(null);
        } catch (err) {
            console.error('Failed to unmount tire:', err);
            setError('Failed to unmount tire. Please try again.');
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
                                <h1 className="text-2xl font-bold text-gray-900">Tire Inventory Management</h1>
                                <p className="text-gray-600">Manage tire stock and vehicle assignments</p>
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
                                <p className="text-sm text-gray-600">In Stock</p>
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
                                <p className="text-sm text-gray-600">On Vehicle</p>
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
                                <p className="text-sm text-gray-600">Retired</p>
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
                                <p className="text-sm text-gray-600">Total Tires</p>
                                <p className="text-xl font-semibold text-gray-900">{tires.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter Bar - Replace with TireFilterBar component */}
                { <TireFilterBar 
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
                /> */}

                {/* Temporary simple filter bar - replace with TireFilterBar component */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Search tires..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-4">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="All">All Statuses</option>
                                <option value="In Stock">In Stock</option>
                                <option value="On Vehicle">On Vehicle</option>
                                <option value="Retired">Retired</option>
                            </select>
                            <select
                                value={brandFilter}
                                onChange={(e) => setBrandFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="All">All Brands</option>
                                {tireBrands.map(brand => (
                                    <option key={brand} value={brand}>{brand}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

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

                {/* Tire Grid - Replace with TireCard components */}
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
                            <p className="text-gray-500 text-lg">No tires found</p>
                            <p className="text-gray-400">Try adjusting your search or filters</p>
                        </div>
                    ) : (
                        filteredTires.map((tire) => (
                            /* Replace with TireCard component:
                            <TireCard
                                key={tire.tire_id}
                                tire={tire}
                                assignment={getTireAssignment(tire.tire_id)}
                                onEdit={openEditModal}
                                onDelete={handleDeleteTire}
                                onAssign={openAssignModal}
                                onUnmount={handleUnmountTire}
                            />
                            
                            <div key={tire.tire_id} className="bg-white rounded-lg shadow-sm p-6">
                                <h3 className="text-lg font-semibold text-gray-900">{tire.serial_number}</h3>
                                <p className="text-gray-600">{tire.brand} - {tire.sidewall}</p>
                                <p className="text-sm text-gray-500">Status: {tire.status}</p>
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={() => openEditModal(tire)}
                                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm"
                                    >
                                        Edit
                                    </button>
                                    {tire.status === 'In Stock' && (
                                        <button
                                            onClick={() => openAssignModal(tire)}
                                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                                        >
                                            Assign
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteTire(tire.tire_id)}
                                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modals - Replace with actual modal components */}
                {/* 
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
                */}

                {/* Placeholder modals - replace with actual modals */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                            <h3 className="text-lg font-semibold mb-4">Add Tire Modal</h3>
                            <p className="text-gray-600 mb-4">Replace with TireFormModal component</p>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}