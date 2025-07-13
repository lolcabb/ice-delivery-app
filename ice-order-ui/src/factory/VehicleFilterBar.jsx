import React from 'react';
import { Search, Filter } from 'lucide-react';

const VehicleFilterBar = ({ 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter, 
    typeFilter, 
    setTypeFilter, 
    vehicleTypes = [] 
}) => {
    const statuses = ['Active', 'In-Shop', 'Out of Service'];

    const handleSearchChange = (value) => {
        setSearchTerm(value);
    };

    const handleStatusChange = (value) => {
        setStatusFilter(value);
    };

    const handleTypeChange = (value) => {
        setTypeFilter(value);
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setStatusFilter('All');
        setTypeFilter('All');
    };

    const hasActiveFilters = searchTerm || statusFilter !== 'All' || typeFilter !== 'All';

    return (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Search & Filters</h3>
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="ml-auto text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Search Vehicles
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by name, license plate, make, or model..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Status Filter */}
                <div className="w-full lg:w-48">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                    </label>
                    <select
                        value={statusFilter}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="All">All Statuses</option>
                        {statuses.map(status => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Vehicle Type Filter */}
                <div className="w-full lg:w-48">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type
                    </label>
                    <select
                        value={typeFilter}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="All">All Types</option>
                        {vehicleTypes.map(type => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-gray-600">Active filters:</span>
                        
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Search: "{searchTerm}"
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="ml-1 hover:text-blue-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        
                        {statusFilter !== 'All' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Status: {statusFilter}
                                <button
                                    onClick={() => setStatusFilter('All')}
                                    className="ml-1 hover:text-green-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        
                        {typeFilter !== 'All' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Type: {typeFilter}
                                <button
                                    onClick={() => setTypeFilter('All')}
                                    className="ml-1 hover:text-purple-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleFilterBar;