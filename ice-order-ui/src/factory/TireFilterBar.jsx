import React from 'react';
import { Search, Filter, Package, CheckCircle, Truck, AlertTriangle } from 'lucide-react';

const TireFilterBar = ({ 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter, 
    brandFilter, 
    setBrandFilter, 
    sizeFilter,
    setSizeFilter,
    tireBrands = [],
    tireSizes = []
}) => {
    const statuses = [
        { value: 'In Stock', label: 'In Stock', icon: CheckCircle, color: 'text-green-600' },
        { value: 'On Vehicle', label: 'On Vehicle', icon: Truck, color: 'text-blue-600' },
        { value: 'Retired', label: 'Retired', icon: AlertTriangle, color: 'text-red-600' }
    ];

    const handleSearchChange = (value) => {
        setSearchTerm(value);
    };

    const handleStatusChange = (value) => {
        setStatusFilter(value);
    };

    const handleBrandChange = (value) => {
        setBrandFilter(value);
    };

    const handleSizeChange = (value) => {
        setSizeFilter(value);
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setStatusFilter('All');
        setBrandFilter('All');
        setSizeFilter('All');
    };

    const hasActiveFilters = searchTerm || statusFilter !== 'All' || brandFilter !== 'All' || sizeFilter !== 'All';

    return (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Search & Filter Tires</h3>
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="ml-auto text-sm text-green-600 hover:text-green-800 underline"
                    >
                        Clear all filters
                    </button>
                )}
            </div>

            {/* Filter Controls */}
            <div className="space-y-4">
                {/* Search Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Search Tires
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by serial number, brand, or sidewall size..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Filter Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                            <option value="All">All Statuses</option>
                            {statuses.map(status => (
                                <option key={status.value} value={status.value}>
                                    {status.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Brand Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Brand
                        </label>
                        <select
                            value={brandFilter}
                            onChange={(e) => handleBrandChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                            <option value="All">All Brands</option>
                            {tireBrands.map(brand => (
                                <option key={brand} value={brand}>
                                    {brand}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Size Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sidewall Size
                        </label>
                        <select
                            value={sizeFilter}
                            onChange={(e) => handleSizeChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                            <option value="All">All Sizes</option>
                            {tireSizes.map(size => (
                                <option key={size} value={size}>
                                    <span className="font-mono">{size}</span>
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-gray-600">Active filters:</span>
                        
                        {/* Search Filter Tag */}
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Search className="w-3 h-3" />
                                Search: "{searchTerm}"
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="ml-1 hover:text-blue-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        
                        {/* Status Filter Tag */}
                        {statusFilter !== 'All' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {(() => {
                                    const status = statuses.find(s => s.value === statusFilter);
                                    const IconComponent = status?.icon || Package;
                                    return <IconComponent className="w-3 h-3" />;
                                })()}
                                Status: {statusFilter}
                                <button
                                    onClick={() => setStatusFilter('All')}
                                    className="ml-1 hover:text-green-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        
                        {/* Brand Filter Tag */}
                        {brandFilter !== 'All' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Package className="w-3 h-3" />
                                Brand: {brandFilter}
                                <button
                                    onClick={() => setBrandFilter('All')}
                                    className="ml-1 hover:text-purple-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        
                        {/* Size Filter Tag */}
                        {sizeFilter !== 'All' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Size: <span className="font-mono">{sizeFilter}</span>
                                <button
                                    onClick={() => setSizeFilter('All')}
                                    className="ml-1 hover:text-orange-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Quick Filter Buttons */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-gray-600 mr-2">Quick filters:</span>
                    
                    {/* Status Quick Filters */}
                    {statuses.map(status => (
                        <button
                            key={status.value}
                            onClick={() => handleStatusChange(status.value)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                statusFilter === status.value
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <status.icon className="w-3 h-3" />
                            {status.label}
                        </button>
                    ))}
                    
                    {/* Common Brand Quick Filters */}
                    {['Bridgestone', 'Michelin', 'Goodyear'].filter(brand => tireBrands.includes(brand)).map(brand => (
                        <button
                            key={brand}
                            onClick={() => handleBrandChange(brand)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                brandFilter === brand
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <Package className="w-3 h-3" />
                            {brand}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TireFilterBar;