import React from 'react';

// Filter Badge Component for quick selection
const FilterBadge = ({ label, isActive, onClick, color = 'indigo' }) => {
    const colorClasses = {
        indigo: isActive ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
        green: isActive ? 'bg-green-100 text-green-800 border-green-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
        blue: isActive ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md transition-colors duration-150 ${colorClasses[color]}`}
        >
            {label}
        </button>
    );
};

// Quick Date Range Selector
const QuickDateSelector = ({ onSelect, currentFilters }) => {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];

    const quickRanges = [
        {
            label: 'วันนี้',
            startDate: formatDate(today),
            endDate: formatDate(today)
        },
        {
            label: 'สัปดาห์นี้',
            startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())),
            endDate: formatDate(today)
        },
        {
            label: 'เดือนนี้',
            startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
            endDate: formatDate(today)
        },
        {
            label: 'เดือนที่แล้ว',
            startDate: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
            endDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 0))
        }
    ];

    const isRangeActive = (range) => {
        return currentFilters.startDate === range.startDate && currentFilters.endDate === range.endDate;
    };

    return (
        <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 self-center mr-2">ช่วงเวลา:</span>
            {quickRanges.map((range, index) => (
                <FilterBadge
                    key={index}
                    label={range.label}
                    isActive={isRangeActive(range)}
                    onClick={() => onSelect(range)}
                    color="indigo"
                />
            ))}
        </div>
    );
};

// Main Enhanced Filter Section Component
const EnhancedFilterSection = React.memo(({ 
    filters, 
    categories, 
    onFilterChange, 
    onApplyFilters, 
    isLoading, 
    isFiltering 
}) => {
    const [showAdvanced, setShowAdvanced] = React.useState(false);

    // Handle quick payment method selection
    const handlePaymentMethodQuickSelect = (method) => {
        const syntheticEvent = {
            target: {
                name: 'is_petty_cash_expense',
                value: method
            }
        };
        onFilterChange(syntheticEvent);
    };

    // Handle quick date range selection
    const handleQuickDateSelect = (range) => {
        // Create synthetic events to update both dates
        onFilterChange({ target: { name: 'startDate', value: range.startDate } });
        // Use setTimeout to ensure the first update completes
        setTimeout(() => {
            onFilterChange({ target: { name: 'endDate', value: range.endDate } });
        }, 0);
    };

    // Handle category quick select
    const handleCategorySelect = (categoryId) => {
        const syntheticEvent = {
            target: {
                name: 'category_id',
                value: categoryId
            }
        };
        onFilterChange(syntheticEvent);
    };

    // Handle clearing all filters
    const handleClearFilters = () => {
        const clearEvents = [
            { target: { name: 'startDate', value: '' } },
            { target: { name: 'endDate', value: '' } },
            { target: { name: 'category_id', value: '' } },
            { target: { name: 'payment_method', value: '' } },
            { target: { name: 'is_petty_cash_expense', value: '' } }
        ];
        
        clearEvents.forEach((event, index) => {
            setTimeout(() => onFilterChange(event), index * 10);
        });
    };

    // Check if any filters are applied
    const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== null && value !== undefined);

    return (
        <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                    <h3 className="text-md font-semibold text-gray-700">กรองและค้นหา</h3>
                    <div className="flex items-center space-x-3">
                        {hasActiveFilters && (
                            <button
                                onClick={handleClearFilters}
                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                            >
                                ล้างตัวกรอง
                            </button>
                        )}
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
                        >
                            {showAdvanced ? 'ซ่อน' : 'แสดง'}ตัวกรองขั้นสูง
                            <svg 
                                className={`ml-1 w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Quick Payment Method Filter */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">ประเภทการจ่าย</label>
                    <div className="flex flex-wrap gap-2">
                        <FilterBadge
                            label="ทั้งหมด"
                            isActive={filters.is_petty_cash_expense === ''}
                            onClick={() => handlePaymentMethodQuickSelect('')}
                            color="indigo"
                        />
                        <FilterBadge
                            label="💵 เงินสดย่อย"
                            isActive={filters.is_petty_cash_expense === 'true'}
                            onClick={() => handlePaymentMethodQuickSelect('true')}
                            color="green"
                        />
                        <FilterBadge
                            label="🏦 โอนธนาคาร"
                            isActive={filters.is_petty_cash_expense === 'false'}
                            onClick={() => handlePaymentMethodQuickSelect('false')}
                            color="blue"
                        />
                    </div>
                </div>

                {/* Quick Date Range Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">ช่วงวันที่</label>
                    <QuickDateSelector onSelect={handleQuickDateSelect} currentFilters={filters} />
                </div>

                {/* Advanced Filters */}
                {showAdvanced && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Custom Date Range */}
                            <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                                    วันที่เริ่มต้น
                                </label>
                                <input
                                    type="date"
                                    name="startDate"
                                    id="startDate"
                                    value={filters.startDate}
                                    onChange={onFilterChange}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>

                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                                    วันที่สิ้นสุด
                                </label>
                                <input
                                    type="date"
                                    name="endDate"
                                    id="endDate"
                                    value={filters.endDate}
                                    onChange={onFilterChange}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>

                            {/* Category Filter */}
                            <div>
                                <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">
                                    หมวดหมู่
                                </label>
                                <select
                                    name="category_id"
                                    id="category_id"
                                    value={filters.category_id}
                                    onChange={onFilterChange}
                                    className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    <option value="">ทั้งหมด</option>
                                    {categories.map((category) => (
                                        <option key={category.category_id} value={category.category_id}>
                                            {category.category_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Payment Method Text Filter */}
                            <div>
                                <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 mb-1">
                                    วิธีการชำระ
                                </label>
                                <input
                                    type="text"
                                    name="payment_method"
                                    id="payment_method"
                                    value={filters.payment_method}
                                    onChange={onFilterChange}
                                    placeholder="เช่น เงินสด, โอน, บัตรเครดิต"
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        {/* Category Quick Select */}
                        {categories && categories.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่ยอดนิยม</label>
                                <div className="flex flex-wrap gap-2">
                                    <FilterBadge
                                        label="ทั้งหมด"
                                        isActive={filters.category_id === ''}
                                        onClick={() => handleCategorySelect('')}
                                        color="indigo"
                                    />
                                    {categories.slice(0, 6).map((category) => (
                                        <FilterBadge
                                            key={category.category_id}
                                            label={category.category_name}
                                            isActive={filters.category_id === category.category_id.toString()}
                                            onClick={() => handleCategorySelect(category.category_id.toString())}
                                            color="indigo"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Apply Filter Button */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-500">
                        {hasActiveFilters && (
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                                </svg>
                                มีการกรองข้อมูล
                            </span>
                        )}
                    </div>
                    <div className="flex space-x-3">
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                ล้างตัวกรอง
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onApplyFilters}
                            disabled={isLoading || isFiltering}
                            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isFiltering ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    กำลังกรอง...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    ค้นหา
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default EnhancedFilterSection;