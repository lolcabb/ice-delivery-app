// Suggested path: src/crm/CRMPanelLayout.jsx
import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';

// Define the sub-navigation items for the CRM panel
const crmSubNavItems = [
    // { name: 'แดชบอร์ด CRM', path: '/crm/dashboard', disabled: true }, // Placeholder for a future CRM dashboard
    { name: 'ลูกค้า', path: '/crm/customers', disabled: false },
    { name: 'สายการจัดส่ง', path: '/crm/delivery-routes', disabled: false },
    { name: 'ถังน้ำแข็ง', path: '/crm/ice-containers', disabled: false},
    { name: 'การมอบหมายถังน้ำแข็ง', path: '/crm/container-assignments', disabled: false },
    { name: 'การเก็บเงิน (เครดิต)', path: '/crm/credit-collection', disabled: false },
];

export default function CRMPanelLayout() {
    const location = useLocation();

    const isBaseCRMPath = location.pathname === '/crm' || location.pathname === '/crm/';
    // Default to "Customers" tab if accessing the base /crm path
    if (isBaseCRMPath) {
        return <Navigate to="/crm/customers" replace />; 
    }

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Sub Navigation Header */}
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <h1 className="text-2xl font-bold text-sky-600">การจัดการลูกค้า</h1> {/* CRM Panel Title */}
                    </div>
                    <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto" aria-label="CRM Sections">
                        {crmSubNavItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                onClick={(e) => {
                                    if (item.disabled) e.preventDefault();
                                }}
                                className={({ isActive }) => 
                                    `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${item.disabled 
                                        ? 'text-gray-400 cursor-not-allowed' 
                                        : (isActive || (isBaseCRMPath && item.path === '/crm/customers')) // Default active tab
                                            ? 'border-sky-500 text-sky-600' // Theme color for CRM
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`
                                }
                                aria-current={
                                    (location.pathname.startsWith(item.path) || (isBaseCRMPath && item.path === '/crm/customers'))
                                    ? 'page' 
                                    : undefined
                                }
                            >
                                {item.name}
                                {item.disabled && <span className="text-xs text-gray-400 ml-1">(เร็วๆ นี้)</span>}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </header>

            {/* Main Content Area for Sub-Pages */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <Outlet /> {/* Child CRM routes will render here (e.g., CustomerManager, RouteManager) */}
            </main>
        </div>
    );
}
