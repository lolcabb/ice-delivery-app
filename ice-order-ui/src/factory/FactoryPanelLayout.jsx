import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';

const factorySubNavItems = [
    { name: 'ยานพาหนะ', path: '/factory/vehicles', disabled: false },
    { name: 'คลังยาง', path: '/factory/tires', disabled: false },
    { name: 'บันทึกผลตรวจน้ำ', path: '/factory/water-test', disabled: false },
];

export default function FactoryPanelLayout() {
    const location = useLocation();

    const isBaseFactoryPath = location.pathname === '/factory' || location.pathname === '/factory/';
    if (isBaseFactoryPath) {
        return <Navigate to="/factory/vehicles" replace />;
    }

    return (
        <div className="flex flex-col h-full bg-gray-100">
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <h1 className="text-2xl font-bold text-orange-800">Factory Operations</h1>
                    </div>
                    <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto" aria-label="Factory Sections">
                        {factorySubNavItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                onClick={(e) => {
                                    if (item.disabled) e.preventDefault();
                                }}
                                className={({ isActive }) =>
                                    `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        item.disabled
                                            ? 'text-gray-400 cursor-not-allowed'
                                            : (isActive || (isBaseFactoryPath && item.path === '/factory/vehicles'))
                                                ? 'border-orange-500 text-orange-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`
                                }
                                aria-current={
                                    (location.pathname.startsWith(item.path) || (isBaseFactoryPath && item.path === '/factory/vehicles'))
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

            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
