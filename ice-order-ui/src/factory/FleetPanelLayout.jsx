import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';

const fleetSubNavItems = [
    { name: 'Vehicles', path: '/fleet/vehicles' },
    { name: 'Tire Stock', path: '/fleet/tires' },
    { name: 'Water Test', path: '/fleet/water-test' },
];

export default function FleetPanelLayout() {
    const location = useLocation();
    const isBaseFleetPath = location.pathname === '/fleet' || location.pathname === '/fleet/';
    if (isBaseFleetPath) {
        return <Navigate to="/fleet/vehicles" replace />;
    }

    return (
        <div className="flex flex-col h-full bg-gray-100">
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <h1 className="text-2xl font-bold text-indigo-600">Fleet Management</h1>
                    </div>
                    <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto" aria-label="Fleet Sections">
                        {fleetSubNavItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                className={({ isActive }) =>
                                    `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        isActive
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`
                                }
                            >
                                {item.name}
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