// src/salesops/SalesOperationsLayout.jsx
import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';

// Define the sub-navigation items for the Sales Operations panel
const salesOpsSubNavItems = [
    { name: 'ปฏิบัติงานรายวัน', path: '/sales-ops/daily-operations' }, //
    { name: 'บันทึกการขาย', path: '/sales-ops/sales-entry' }, //
    { name: 'กระทบยอดรายวัน', path: '/sales-ops/daily-reconciliation' }, //
    { name: 'จัดการคนขับ', path: '/sales-ops/driver-manager' }, //
];

export default function SalesOperationsLayout() {
    const location = useLocation();

    // Default to "Daily Operations" if accessing the base /sales-ops path
    const isBaseSalesOpsPath = location.pathname === '/sales-ops' || location.pathname === '/sales-ops/'; //
    if (isBaseSalesOpsPath) {
        return <Navigate to="/sales-ops/daily-operations" replace />; //
    }

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Sub Navigation Header */}
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <h1 className="text-2xl font-bold text-cyan-600">การดำเนินงานฝ่ายขาย</h1>
                    </div>
                    <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto" aria-label="Sales Operations Sections">
                        {salesOpsSubNavItems.map((item) => {
                            // --- NEW: Custom logic to keep "Sales Entry" tab active on the grid page ---
                            let isItemActive;
                            if (item.path === '/sales-ops/sales-entry') {
                                // This tab is active if the path is exactly "/sales-ops/sales-entry" OR starts with "/sales-ops/entry/"
                                isItemActive = location.pathname === item.path || location.pathname.startsWith('/sales-ops/entry');
                            }
                            
                            return (
                                <NavLink
                                    key={item.name}
                                    to={item.path}
                                    // Use a function for className to receive the default `isActive` property
                                    className={({ isActive }) =>
                                        `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                        ${
                                            // Use our custom active state for the sales entry tab, otherwise use the default
                                            item.path === '/sales-ops/sales-entry' ? isItemActive : isActive
                                                ? 'border-cyan-500 text-cyan-600' // Active tab color
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`
                                    }
                                >
                                    {item.name}
                                </NavLink>
                            )
                        })}
                    </nav>
                </div>
            </header>

            {/* Main Content Area for Sub-Pages */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <Outlet /> {/* Child Sales Ops routes will render here */}
            </main>
        </div>
    );
}