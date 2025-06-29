// Suggested path: src/inventory/InventoryPanelLayout.jsx
import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';

// Define the sub-navigation items for the consumables-focused inventory panel
const inventorySubNavItems = [
    { name: 'แดชบอร์ด', path: '/inventory/dashboard', disabled: false },
    { name: 'วัสดุสิ้นเปลือง', path: '/inventory/consumables', disabled: false }, 
    { name: 'ประเภทวัสดุ', path: '/inventory/item-types', disabled: false }, 
];

export default function InventoryPanelLayout() {
    const location = useLocation();

    const isBaseInventoryPath = location.pathname === '/inventory' || location.pathname === '/inventory/';
    // Default to "Dashboard" tab if accessing the base /inventory path
    if (isBaseInventoryPath) {
        return <Navigate to="/inventory/dashboard" replace />; 
    }

    return (
        <div className="flex flex-col h-full bg-gray-100">
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <h1 className="text-2xl font-bold text-teal-600">คลังวัสดุสิ้นเปลือง</h1>
                    </div>
                    <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto" aria-label="Inventory Sections">
                        {inventorySubNavItems.map((item) => (
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
                                        : (isActive || (isBaseInventoryPath && item.path === '/inventory/dashboard')) // Default active tab
                                            ? 'border-teal-500 text-teal-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`
                                }
                                aria-current={ 
                                    (location.pathname.startsWith(item.path) || (isBaseInventoryPath && item.path === '/inventory/dashboard'))
                                    ? 'page' 
                                    : undefined
                                }
                            >
                                {item.name}
                                {item.disabled && <span className="text-xs text-gray-400 ml-1">(Separate Panel)</span>}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <Outlet /> 
            </main>
        </div>
    );
}
