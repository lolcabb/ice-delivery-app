// Suggested path: src/expenses/ExpensesPanelLayout.jsx
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

// Define the sub-navigation items for the expenses panel
const expenseSubNavItems = [
    { name: 'แดชบอร์ด', path: '/expenses/dashboard', disabled: false },
    { name: 'เงินสดย่อย', path: '/expenses/petty-cash', disabled: false },
    { name: 'ค่าใช้จ่ายทั้งหมด', path: '/expenses/all', disabled: false },
    { name: 'หมวดหมู่', path: '/expenses/categories', disabled: false },
    { name: 'รายงาน', path: '/expenses/reports', disabled: false },
];

export default function ExpensesPanelLayout() {
    const location = useLocation(); // To help with active NavLink styling

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Header for the Expenses Panel */}
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Title of the panel */}
                    <div className="flex items-center justify-between h-16">
                        <h1 className="text-2xl font-bold text-indigo-600">การจัดการค่าใช้จ่าย</h1>
                        {/* You could add a global action button here later, e.g., "Add New Expense" */}
                    </div>

                    {/* Sub-navigation tabs */}
                    <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto" aria-label="Expense Sections">
                        {expenseSubNavItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                // Prevent navigation if the item is marked as disabled
                                onClick={(e) => {
                                    if (item.disabled) e.preventDefault();
                                }}
                                className={({ isActive }) =>
                                    `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${item.disabled 
                                        ? 'text-gray-400 cursor-not-allowed' 
                                        : isActive || (location.pathname === '/expenses' && item.path === '/expenses/categories') // Highlight "Categories" if on /expenses root
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`
                                }
                                // aria-current helps accessibility by indicating the current page
                                aria-current={
                                    (location.pathname === item.path || (location.pathname === '/expenses' && item.path === '/expenses/dashboard') || (location.pathname.startsWith(item.path) && item.path !== '/expenses/dashboard' && item.path !== '/expenses/categories'))
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

            {/* Main Content Area where child route components will be rendered */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                {/* The Outlet component renders the matched child route's component.
                    For example, if the route is /expenses/categories, it will render
                    the component defined for that path (e.g., ExpenseCategoryManager). */}
                <Outlet />
            </main>
        </div>
    );
}
