import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, AlertCircle, X, Edit, Trash2, Wrench } from 'lucide-react';
import { apiService } from '../apiService';

import VehicleCard from './VehicleCard';
import VehicleFormModal from './VehicleFormModal';
import MaintenanceModal from './MaintenanceModal';
import VehicleFilterBar from './VehicleFilterBar';

export default function VehicleMonitor() {
    const [vehicles, setVehicles] = useState([]);
    const [filteredVehicles, setFilteredVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    
    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');

    // Form states
    const [vehicleForm, setVehicleForm] = useState({
        vehicle_name: '',
        license_plate: '',
        vehicle_type: '',
        make: '',
        model: '',
        year: '',
        status: 'Active'
    });

    const [maintenanceForm, setMaintenanceForm] = useState({
        maintenance_date: '',
        description: '',
        cost: '',
        next_maintenance_due: ''
    });

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.getVehicles();
            setVehicles(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch vehicles:', err);
            setError('Failed to fetch vehicles. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    // Filter vehicles based on search and filters
    useEffect(() => {
        let filtered = vehicles;

        if (searchTerm) {
            filtered = filtered.filter(vehicle => 
                vehicle.vehicle_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                vehicle.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                vehicle.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'All') {
            filtered = filtered.filter(vehicle => vehicle.status === statusFilter);
        }

        if (typeFilter !== 'All') {
            filtered = filtered.filter(vehicle => vehicle.vehicle_type === typeFilter);
        }

        setFilteredVehicles(filtered);
    }, [vehicles, searchTerm, statusFilter, typeFilter]);

    const resetVehicleForm = () => {
        setVehicleForm({
            vehicle_name: '',
            license_plate: '',
            vehicle_type: '',
            make: '',
            model: '',
            year: '',
            status: 'Active'
        });
    };

    const resetMaintenanceForm = () => {
        setMaintenanceForm({
            maintenance_date: '',
            description: '',
            cost: '',
            next_maintenance_due: ''
        });
    };

    const handleAddVehicle = async () => {
        if (!vehicleForm.vehicle_name || !vehicleForm.license_plate || !vehicleForm.vehicle_type) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const newVehicle = await apiService.addVehicle(vehicleForm);
            setVehicles(prev => [newVehicle, ...prev]);
            setShowAddModal(false);
            resetVehicleForm();
            setError(null);
        } catch (err) {
            console.error('Failed to add vehicle:', err);
            setError('Failed to add vehicle. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditVehicle = async () => {
        if (!vehicleForm.vehicle_name || !vehicleForm.license_plate || !vehicleForm.vehicle_type) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const updatedVehicle = await apiService.updateVehicle(selectedVehicle.vehicle_id, vehicleForm);
            setVehicles(prev => prev.map(v => 
                v.vehicle_id === selectedVehicle.vehicle_id ? updatedVehicle : v
            ));
            setShowEditModal(false);
            setSelectedVehicle(null);
            resetVehicleForm();
            setError(null);
        } catch (err) {
            console.error('Failed to update vehicle:', err);
            setError('Failed to update vehicle. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVehicle = async (vehicleId) => {
        if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
        
        setLoading(true);
        try {
            await apiService.deleteVehicle(vehicleId);
            setVehicles(prev => prev.filter(v => v.vehicle_id !== vehicleId));
            setError(null);
        } catch (err) {
            console.error('Failed to delete vehicle:', err);
            setError('Failed to delete vehicle. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (vehicle) => {
        setSelectedVehicle(vehicle);
        setVehicleForm({
            vehicle_name: vehicle.vehicle_name || '',
            license_plate: vehicle.license_plate || '',
            vehicle_type: vehicle.vehicle_type || '',
            make: vehicle.make || '',
            model: vehicle.model || '',
            year: vehicle.year || '',
            status: vehicle.status || 'Active'
        });
        setShowEditModal(true);
    };

    const openMaintenanceModal = (vehicle) => {
        setSelectedVehicle(vehicle);
        resetMaintenanceForm();
        setShowMaintenanceModal(true);
    };

    const handleAddMaintenance = async () => {
        if (!maintenanceForm.maintenance_date || !maintenanceForm.description) {
            setError('Please fill in the maintenance date and description');
            return;
        }

        setLoading(true);
        try {
            // Assuming you have an API endpoint for maintenance
            // If not, you can add this to your backend and apiService
            const maintenanceData = {
                vehicle_id: selectedVehicle.vehicle_id,
                ...maintenanceForm
            };
            
            // Replace with actual API call when available
            console.log('Maintenance data to submit:', maintenanceData);
            
            setShowMaintenanceModal(false);
            setSelectedVehicle(null);
            resetMaintenanceForm();
            setError(null);
        } catch (err) {
            console.error('Failed to add maintenance record:', err);
            setError('Failed to add maintenance record. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const vehicleTypes = [...new Set(vehicles.map(v => v.vehicle_type).filter(Boolean))];

    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Truck className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Vehicle Fleet Management</h1>
                                <p className="text-gray-600">Manage your fleet vehicles and maintenance records</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Add Vehicle
                        </button>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Search vehicles..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-4">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="In-Shop">In-Shop</option>
                                <option value="Out of Service">Out of Service</option>
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="All">All Types</option>
                                {vehicleTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
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

                {/* Vehicle Grid */}
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
                    ) : filteredVehicles.length === 0 ? (
                        <div className="col-span-full text-center py-12">
                            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">No vehicles found</p>
                            <p className="text-gray-400">Try adjusting your search or filters</p>
                        </div>
                    ) : (
                        filteredVehicles.map((vehicle) => (
                            <VehicleCard
                                key={vehicle.vehicle_id}
                                vehicle={vehicle}
                                onEdit={openEditModal}
                                onDelete={handleDeleteVehicle}
                                onMaintenance={openMaintenanceModal}
                            />
                        ))
                    )}
                </div>

                {/* Modals */}
                <VehicleFormModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddVehicle}
                    vehicleForm={vehicleForm}
                    setVehicleForm={setVehicleForm}
                    loading={loading}
                    isEdit={false}
                />

                <VehicleFormModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSubmit={handleEditVehicle}
                    vehicleForm={vehicleForm}
                    setVehicleForm={setVehicleForm}
                    loading={loading}
                    isEdit={true}
                />

                <MaintenanceModal
                    isOpen={showMaintenanceModal}
                    onClose={() => setShowMaintenanceModal(false)}
                    onSubmit={handleAddMaintenance}
                    maintenanceForm={maintenanceForm}
                    setMaintenanceForm={setMaintenanceForm}
                    selectedVehicle={selectedVehicle}
                    loading={loading}
                />
            </div>
        </div>
    );
}
