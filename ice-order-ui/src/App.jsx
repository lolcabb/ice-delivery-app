// 📁 src/App.jsx
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import LoginPage from './LoginPage';
import MainLayout from './MainLayout';
import AdminPanel from './AdminPanel';

import ExpensesPanelLayout from './expenses/ExpensesPanelLayout'; 
import ExpenseListManager from './expenses/ExpenseListManager'; 
import ExpenseCategoryManager from './expenses/ExpenseCategoryManager';
import PettyCashLogManager from './expenses/PettyCashLogManager';
import ExpenseDashboard from './expenses/ExpenseDashboard';
import ExpenseReports from './expenses/ExpenseReports';

import InventoryPanelLayout from './inventory/InventoryPanelLayout';
import ConsumablesManager from './inventory/ConsumablesManager';
import ItemTypesManager from './inventory/ItemTypesManager'; 
import ConsumablesDashboard from './inventory/ConsumablesDashboard';

import CRMPanelLayout from './crm/CRMPanelLayout';
import CustomersManager from './crm/CustomerManager';
import IceContainerManager from './crm/IceContainerManager';
import ContainerAssignmentManager from './crm/ContainerAssignmentManager';
import DeliveryRouteManager from './crm/DeliveryRouteManager';
import CreditCollectionManager from './crm/CreditCollectionManager';

// SalesOperationsLayout
import SalesOperationsLayout from './salesops/SalesOperationsLayout';
//import LoadingLogManager from './salesops/LoadingLogManager';
import SalesEntryManager from './salesops/SalesEntryManager';
//import ReturnsLogManager from './salesops/ReturnsLogManager';
import DriverManager from './salesops/DriverManager';
import DailyReconciliation from './salesops/DailyReconciliation';

import DailyOperationsManager from './salesops/DailyOperationsManager';
import SalesGridPage from './salesops/SalesGridPage';

// --- Factory Management ---
// Water Info
import WaterTestLogManager from './factory/WaterTestLogManager';
// Factory management components
import FactoryPanelLayout from './factory/FactoryPanelLayout';
import VehicleMonitor from './factory/VehicleMonitor';
import TireStockManager from './factory/TireStockManager';
// --- Factory Management ---


// Use React.lazy for code splitting to prevent initialization errors
//const AdminPanel = React.lazy(() => import('./AdminPanel'));

// Dummy components for placeholders if not yet created
const ComingSoon = ({ title }) => 
    <div className="p-6 bg-white shadow rounded-lg">
        <h2 className="text-2xl font-semibold text-gray-700">{title}</h2>
        <p className="text-gray-600 mt-2">This section is under construction. Coming soon!</p>
    </div>;

// Error Fallback Component
function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
        <div className="bg-gray-100 p-4 rounded mb-4 overflow-auto">
          <pre className="text-sm text-gray-800">{error.message}</pre>
        </div>
        <p className="text-gray-600 mb-4">
          The application encountered an error. You can try refreshing the page or returning to the main screen.
        </p>
        <div className="flex space-x-4">
          <button 
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

// Styled NavLink component
function NavLinkStyled({ to, children, className: additionalClassName = "" }) {
    const location = useLocation(); // useLocation hook
    const isActive = (to !== "/" && location.pathname.startsWith(to)) || location.pathname === to;

    return (
        <Link 
            to={to}
            className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors
                        ${isActive
                            ? 'border-indigo-500 text-indigo-600' 
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
                        ${additionalClassName}`}
        >
            {children}
        </Link>
    );
}

// App Shell with Navbar
function AppShell({ handleLogout }) {
    const storedUser = localStorage.getItem('authUser');
    const user = storedUser ? JSON.parse(storedUser) : null;
    const location = useLocation(); // For active NavLink styling

    // Determine which roles should see the Expenses link
    const canViewExpenses = user && ['admin', 'accountant', 'manager'].includes(user.role?.toLowerCase());
    const canViewInventory = user && ['admin', 'accountant', 'manager', 'staff'].includes(user.role?.toLowerCase());
    const canViewCRM = user && ['admin', 'accountant', 'manager', 'staff'].includes(user.role?.toLowerCase());
    const canViewSalesOps = user && ['admin', 'manager', 'staff'].includes(user.role?.toLowerCase());
    const canViewFactory = user && ['admin', 'accountant', 'manager', 'staff'].includes(user.role?.toLowerCase());

    return (
        <div className="min-h-screen bg-zinc-50">
            <nav className="bg-white shadow-sm">
                <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center font-bold text-indigo-600">
                                Company Portal
                            </div>
                            <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                                <NavLinkStyled to="/main">Front Office</NavLinkStyled>
                                {user && user.role?.toLowerCase() === 'admin' && (
                                    <NavLinkStyled to="/admin">Admin Panel</NavLinkStyled>
                                )}
                                {canViewSalesOps && ( // Show Sales Operations link based on role
                                    <NavLinkStyled to="/sales-ops/daily-operations">Sales Operations</NavLinkStyled>
                                )}
                                {canViewExpenses && ( // Show Expenses link based on role
                                    <NavLinkStyled to="/expenses">Expenses</NavLinkStyled>
                                )}
                                {canViewInventory && ( // Show Inventory link based on role
                                    <NavLinkStyled to="/inventory">Inventory</NavLinkStyled>
                                )}
                                {canViewCRM && ( // Show CRM link based on role
                                    <NavLinkStyled to="/crm">CRM</NavLinkStyled>
                                )}
                                {canViewFactory && (
                                    <NavLinkStyled to="/factory">Factory</NavLinkStyled>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="text-sm text-gray-600 mr-3">
                                Welcome, {user ? `${user.username} (${user.role})` : 'Guest'}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 hover:bg-red-600 text-white text-xs py-1.5 px-3 rounded-md"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="py-6"> {/* Removed h-[calc(100vh-4rem)] to allow content to define height */}
                <div className="mx-auto px-4 sm:px-6 lg:px-8 h-full"> {/* Added h-full for potential flex children */}
                    <ErrorBoundary FallbackComponent={ErrorFallback}>
                        <Suspense fallback={<div className="text-center p-8">Loading page...</div>}>
                            <Outlet />
                        </Suspense>
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    );
}

// Protected Route Component
function ProtectedRoute({ isAuthenticated, redirectPath = '/login' }) {
    if (!isAuthenticated) {
        console.log("ProtectedRoute: Not authenticated, redirecting to", redirectPath);
        return <Navigate to={redirectPath} replace />;
    }
    return <Outlet />;
}

// Main App Component
function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const navigateRef = React.useRef(null);

    // Initial authentication check
    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('authToken');
            const userJson = localStorage.getItem('authUser');
            console.log('Authentication check:', !!token);
            
            if (token && userJson) {
                try {
                    const user = JSON.parse(userJson);
                    setIsAuthenticated(true);
                    setCurrentUser(user);
                } catch (e) {
                    console.error("App.jsx: Error parsing authUser from localStorage", e);
                    // Clear potentially corrupted storage
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('authUser');
                    setIsAuthenticated(false);
                    setCurrentUser(null);
                }
            } else {
                setIsAuthenticated(false);
                setCurrentUser(null);
            }
        };
        
        // Run immediately
        checkAuth();
        
        // Also listen for storage events (for multi-tab support)
        window.addEventListener('storage', checkAuth);
        return () => {
            window.removeEventListener('storage', checkAuth);
        };
    }, []);

    const handleLoginSuccess = (userData, token) => {
        console.log('Login success handler called with user:', userData);
        
        // First ensure we have a valid token
        if (!token && userData && userData.token) {
            token = userData.token;
        }
        
        if (!token) {
            console.error('No valid token available for authentication!');
            return; // Don't proceed with authentication
        }
        if (!userData) {
            console.error('App.jsx: No user data provided in login success data!');
            return;
        }
        
        // Store token and verify it was stored correctly
        localStorage.setItem('authToken', token);
        localStorage.setItem('authUser', JSON.stringify(userData));
        
        // Verify token was actually stored
        const storedToken = localStorage.getItem('authToken');
        console.log('Token stored successfully:', !!storedToken);
        
        // Only set authenticated if token was actually stored
        if (storedToken) {
            setIsAuthenticated(true);
            setCurrentUser(userData);
        }
    };

    const handleLogout = useCallback(() => {
        console.log('Logout handler called');
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        setIsAuthenticated(false);
        setCurrentUser(null);
        if (navigateRef.current) {
            navigateRef.current('/login');
        } else {
            // Fallback if navigateRef is not set
            window.location.href = '/login';
        }
    }, []);

    // Wrapper component that provides navigation reference
    function AppContent() {
        const navigate = useNavigate();
        
        // Set navigate function to ref when component mounts
        React.useEffect(() => {
            navigateRef.current = navigate;
        }, [navigate]);

        const canAccessExpenses = currentUser && ['admin', 'accountant', 'manager'].includes(currentUser.role?.toLowerCase());
        const canAccessInventory = currentUser && ['admin', 'accountant', 'manager', 'staff'].includes(currentUser.role?.toLowerCase());
        const canAccessCRM = currentUser && ['admin', 'accountant', 'manager', 'staff'].includes(currentUser.role?.toLowerCase());
        const canAccessSalesOps = currentUser && ['admin', 'manager', 'staff'].includes(currentUser.role?.toLowerCase());
        const canAccessFactory = currentUser && ['admin', 'accountant', 'manager', 'staff'].includes(currentUser.role?.toLowerCase());

        return (
            <Routes>
                <Route
                    path="/login"
                    element={
                        isAuthenticated ? (
                            <Navigate to="/main" replace />
                        ) : (
                            <LoginPage onLoginSuccess={handleLoginSuccess} />
                        )
                    }
                />
                <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
                    <Route element={<AppShell handleLogout={handleLogout} />}>
                        <Route path="/main" element={<MainLayout />} />
                        <Route 
                            path="/admin/*" // Changed to handle nested admin routes if any
                            element={
                                currentUser && currentUser.role?.toLowerCase() === 'admin' ? (
                                    <AdminPanel />
                                ) : (
                                    <Navigate to="/main" replace state={{ message: "Access denied: Admins only." }} />
                                )
                            } 
                        />
                        {/* CRM Panel Routes */}
                        <Route
                            path="/crm/*"
                            element={
                                canAccessCRM ? (
                                    <CRMPanelLayout />
                                ) : (
                                    <Navigate to="/main" replace state={{ message: "Access denied: Insufficient role for CRM."}} />
                                )
                            }
                        >
                            {/* Default child route for /crm is already handled in CRMPanelLayout to redirect to customers */}
                            {/* <Route index element={<Navigate to="customers" replace />} />  // Or keep default in Layout */}
                            <Route path="dashboard" element={<ComingSoon title="CRM Dashboard" />} />
                            <Route path="customers" element={<CustomersManager />} />
                            <Route path="delivery-routes" element={<DeliveryRouteManager />} />
                            <Route path="ice-containers" element={<IceContainerManager />} />
                            <Route path="container-assignments" element={<ContainerAssignmentManager />} />
                            <Route path="credit-collection" element={<CreditCollectionManager />} />
                            {/* Add more CRM sub-routes here */}
                        </Route>
                        {/* Expenses Panel Routes */}
                        <Route 
                            path="/expenses/*" // Use /* to allow nested routes within ExpensesPanelLayout
                            element={
                                canAccessExpenses ? (
                                    <ExpensesPanelLayout />
                                ) : (
                                    // If user is authenticated but not authorized for expenses, redirect to /main
                                    // Or show a specific "Access Denied" component
                                    <Navigate to="/main" replace state={{ message: "Access denied: Insufficient role for Expenses." }} />
                                )
                            }
                        >
                            <Route index element={<Navigate to="dashboard" replace />} /> {/* Default to categories */}
                            <Route path="dashboard" element={<ExpenseDashboard/>} />
                            <Route path="all" element={<ExpenseListManager />} />
                            <Route path="categories" element={<ExpenseCategoryManager />} />
                            <Route path="petty-cash" element={<PettyCashLogManager />} />
                            <Route path="reports" element={<ExpenseReports />} />
                            {/* Add more nested routes for expenses here as needed */}
                        </Route>
                        {/* Inventory Panel Routes */}
                        <Route
                            path="/inventory/*"
                            element={
                                canAccessInventory ? (
                                    <InventoryPanelLayout />
                                ) : (
                                    <Navigate to="/main" replace state={{ message: "Access denied: Insufficient role for Inventory."}} />
                                )
                            }
                        >
                            {/* Default child route for /inventory is already handled in InventoryPanelLayout to redirect to consumables */}
                            {/* <Route index element={<Navigate to="consumables" replace />} />  // Or keep default in Layout */}
                            <Route path="dashboard" element={<ConsumablesDashboard />} />
                            <Route path="consumables" element={<ConsumablesManager />} /> {/* Use actual component */}
                            <Route path="item-types" element={<ItemTypesManager />} />
                            {/* Add more inventory sub-routes here */}
                        </Route>
                        {/* Sales Operations Panel Routes */}
                        <Route
                            path="/sales-ops/*"
                            element={
                                canAccessSalesOps ? (
                                    <SalesOperationsLayout />
                                ) : (
                                    <Navigate to="/main" replace state={{ message: "Access denied: Insufficient role for Sales Operations."}} />
                                )
                            }
                        >
                            <Route index element={<Navigate to="daily-operations" replace />} />
                            <Route path="daily-operations" element={<DailyOperationsManager />} />
                            {/*<Route path="loading-logs" element={<LoadingLogManager />} />*/}
                            {/*<Route path="returns-log" element={<ReturnsLogManager />} />*/}
                            <Route path="entry/:summaryId" element={<SalesGridPage />} />
                            <Route path="sales-entry" element={<SalesEntryManager />} />
                            <Route path="daily-reconciliation" element={<DailyReconciliation />} />
                            <Route path="driver-manager" element={<DriverManager />} />
                            {/* Add more sales-ops sub-routes here */}
                        </Route>
                        {/* Factory Operations Panel Routes */}
                        <Route 
                            path="/factory/*" 
                            element={
                                canAccessFactory ? (
                                    <FactoryPanelLayout />
                                ) : (
                                    <Navigate to="/main" replace state={{ message: "Access denied: Insufficient role for Factory Operations."}} />
                                )
                            }
                        >
                            <Route index element={<Navigate to="vehicles" replace />} />
                            <Route path="vehicles" element={<VehicleMonitor />} />
                            <Route path="tires" element={<TireStockManager />} />
                            <Route path="water-test" element={<WaterTestLogManager />} />
                            {/* Add more factory sub-routes here */}
                        </Route>
                        <Route path="/" element={<Navigate to="/main" replace />} />
                    </Route>
                </Route>
                <Route path="*" element={<Navigate to={isAuthenticated ? "/main" : "/login"} replace />} />
            </Routes>
        );
    }

    return (
        <BrowserRouter>
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <AppContent />
            </ErrorBoundary>
        </BrowserRouter>
    );
}

export default App;
