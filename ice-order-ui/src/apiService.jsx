// src/apiService.jsx
// Legacy API wrapper. Gradually delegates to new modular API in ./api.
import { request, API_BASE_URL } from './api/base.js';
import { login as authLogin, register as authRegister } from './api/auth.js';

const TOKEN_KEY = 'authToken';

export const apiService = {
    get: async (endpoint, options = {}) => {
        const { data } = await request(endpoint, 'GET', null, options);
        return data;
    },
    // This is for components that specifically need caching metadata.
    getWithMetadata: (endpoint, options = {}) => {
        return request(endpoint, 'GET', null, options);
    },
    post: async (endpoint, body, options = {}) => {
        const { data } = await request(endpoint, 'POST', body, options);
        return data;
    },
    put: async (endpoint, body, options = {}) => {
        const { data } = await request(endpoint, 'PUT', body, options);
        return data;
    },
    delete: async (endpoint, options = {}) => {
        const { data } = await request(endpoint, 'DELETE', null, options);
        return data;
    },
    patch: async (endpoint, body, options = {}) => { 
        const { data } = await request(endpoint, 'PATCH', body, options);
        return data;
    },
    
    login: authLogin,
    register: authRegister,

    handleComponentAuthError: (error, navigate) => {
        if (error.status === 401) {
            console.warn('Component-level auth error: Token invalid/expired. Clearing session.');
            localStorage.removeItem('authToken');
            localStorage.removeItem('authUser');
            if (navigate) {
                navigate('/login');
            } else {
                window.location.href = '/login'; 
            }
            return true; 
        }
        return false; 
    },

    getUsers: (filters = {}) => { 
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/users?${queryParams}`);
    },


    // --- Sales Operations API Functions ---
    getRouteCustomers: (routeId) => apiService.get(`/sales-ops/routes/${routeId}/customers`),
    addCustomerToRoute: (routeId, customerId) => apiService.post(`/sales-ops/routes/${routeId}/customers`, { customer_id: customerId }),
    removeCustomerFromRoute: (routeId, customerId) => apiService.delete(`/sales-ops/routes/${routeId}/customers/${customerId}`),
    saveCustomerOrder: (routeId, customerIds) => apiService.put(`/sales-ops/routes/${routeId}/customer-order`, { customer_ids: customerIds }),

    // Customer pricing
    getCustomerPrices: (customerId) => apiService.get(`/customers/${customerId}/prices`),
    updateCustomerPrice: (customerId, productId, unitPrice, reason) => apiService.put(`/customers/${customerId}/prices/${productId}`, { unit_price: unitPrice, reason }),

    // Sales editing
    getDriverSalesForEdit: (summaryId) => apiService.get(`/sales-ops/driver-sales/edit/${summaryId}`),
    updateDriverSale: (saleId, saleData) => apiService.put(`/sales-ops/driver-sales/${saleId}`, saleData),
    deleteDriverSale: (saleId, reason) => apiService.delete(`/sales-ops/driver-sales/${saleId}`, { reason }),

    // Customer search
    searchCustomers: (search, excludeRouteId) => {
        const params = new URLSearchParams({ search, limit: 10 });
        if (excludeRouteId) params.append('exclude_route_id', excludeRouteId);
        return apiService.get(`/customers/search?${params}`);
    },


    // --- Driver Management API Functions ---
    addDriver: (driverData) => apiService.post('/drivers', driverData),
    getDrivers: async (params = {}) => { 
        const queryParams = new URLSearchParams(params).toString();
        const response = await apiService.get(`/drivers?${queryParams}`);
        return response.data || response || [];
    },
    getDriverById: (driverId) => apiService.get(`/drivers/${driverId}`),
    updateDriver: (driverId, driverData) => apiService.put(`/drivers/${driverId}`, driverData),
    deleteDriver: (driverId) => apiService.delete(`/drivers/${driverId}`), 

    // --- Sales Operations API Functions ---
    getSalesProducts: async () => { 
        const response = await request('/sales-ops/products');
        return response.data || response || [];
    },
    getLossReasons: () => apiService.get('/sales-ops/loss-reasons'),
    
    addLoadingLog: async (logData) => {
        const response = await apiService.post('/sales-ops/loading-logs', logData);
        return response.data || response;
    }, 
    getLoadingLogs: async (params = {}) => { 
        const queryParams = new URLSearchParams(params).toString();
        const response = await apiService.get(`/sales-ops/loading-logs?${queryParams}`);
        return response.data || response || [];
    },
    updateLoadingLogBatch: async (batchUUID, batchData) => {
        const response = await apiService.put(`/sales-ops/loading-logs/batch/${batchUUID}`, batchData);
        return response.data || response;
    },

    addDriverDailySummary: (summaryData) => apiService.post('/sales-ops/driver-daily-summaries', summaryData),
    getDriverDailySummaries: (params = {}) => { 
        const queryParams = new URLSearchParams(params).toString();
        // **FIX**: Change from apiService.get to the base request function to get the full response object
        return request(`/sales-ops/driver-daily-summaries?${queryParams}`);
    },
    updateDriverDailySummary: (summaryId, summaryData) => apiService.put(`/sales-ops/driver-daily-summaries/${summaryId}`, summaryData),

    // --- New Reconciliation Functions ---
    getReconciliationSummary: (driverId, date) => {
        const queryParams = new URLSearchParams({ driver_id: driverId, date }).toString();
        return apiService.get(`/sales-ops/reconciliation-summary?${queryParams}`);
    },
    reconcileDriverDailySummary: (summaryId, reconciliationData) => {
        return apiService.put(`/sales-ops/driver-daily-summaries/${summaryId}/reconcile`, reconciliationData);
    },
    // --- End New Functions ---

    // *** NEW function to call the new batch endpoint ***
    saveBatchReturns: (batchData) => apiService.post('/sales-ops/batch-returns', batchData),
    
    addDriverSale: (saleData) => apiService.post('/sales-ops/driver-sales', saleData),
    getDriverSales: (driverDailySummaryId) => apiService.get(`/sales-ops/driver-sales?driver_daily_summary_id=${driverDailySummaryId}`),

    saveBatchSales: (batchPayload) => apiService.post('/sales-ops/sales-entry/batch', batchPayload),

    addProductReturn: (returnData) => apiService.post('/sales-ops/product-returns', returnData),
    getProductReturns: (params = {}) => { 
        const queryParams = new URLSearchParams(params).toString();
        return apiService.get(`/sales-ops/product-returns?${queryParams}`);
    },

    getPackagingTypes: () => apiService.get('/sales-ops/packaging-types'), 
    addPackagingLog: (logData) => apiService.post('/sales-ops/packaging-logs', logData),
    getPackagingLogs: (params = {}) => { 
        const queryParams = new URLSearchParams(params).toString();
        return apiService.get(`/sales-ops/packaging-logs?${queryParams}`);
    },

    // --- (Keep other existing specific methods for expenses, inventory, crm, orders (front-office), etc.)
    getEnhancedDashboardSummary: () => apiService.get('/expenses/dashboard/enhanced-summary'),
    getTodayOrdersWithMetadata: (etag) => { 
        const options = etag ? { headers: { 'If-None-Match': etag } } : {};
        return request('/orders/today', 'GET', null, options); 
    },
    updateOrderStatusAndDriver: (orderId, data) => { 
        return apiService.put(`/orders/${orderId}`, data);
    },
    addExpenseWithFile: (formData) => {
        return fetch(`${API_BASE_URL}/expenses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
                // Don't set Content-Type - let browser set it with boundary for FormData
            },
            body: formData // Send FormData directly
        }).then(async response => {
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error || `HTTP ${response.status}`);
                error.status = response.status;
                error.data = errorData;
                throw error;
            }
            return response.json();
        });
    },

    // New method for updating expense with file upload
    updateExpenseWithFile: (expenseId, formData) => {
        return fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
                // Don't set Content-Type - let browser set it with boundary for FormData
            },
            body: formData // Send FormData directly
        }).then(async response => {
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error || `HTTP ${response.status}`);
                error.status = response.status;
                error.data = errorData;
                throw error;
            }
            return response.json();
        });
    },
    getExpenseCategories: () => apiService.get('/expenses/expense-categories'),
    addExpenseCategory: (categoryData) => apiService.post('/expenses/expense-categories', categoryData),
    updateExpenseCategory: (categoryId, categoryData) => apiService.put(`/expenses/expense-categories/${categoryId}`, categoryData),
    deleteExpenseCategory: (categoryId) => apiService.delete(`/expenses/expense-categories/${categoryId}`),
    getExpenses: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/expenses?${queryParams}`);
    },
    getExpenseById: (expenseId) => apiService.get(`/expenses/${expenseId}`),
    addExpense: (expenseData) => apiService.post('/expenses', expenseData),
    updateExpense: (expenseId, expenseData) => apiService.put(`/expenses/${expenseId}`, expenseData),
    deleteExpense: (expenseId) => apiService.delete(`/expenses/${expenseId}`),
    getPettyCashLogs: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/expenses/petty-cash?${queryParams}`);
    },
    getPettyCashLogByDate: (logDate) => apiService.get(`/expenses/petty-cash/${logDate}`),
    addPettyCashLog: (logData) => apiService.post('/expenses/petty-cash', logData),
    updatePettyCashLog: (logDate, logData) => apiService.put(`/expenses/petty-cash/${logDate}`, logData),
    reconcilePettyCashLog: (logDate) => apiService.post(`/expenses/petty-cash/${logDate}/reconcile`, {}),
    getDashboardSummaryCards: () => apiService.get('/expenses/dashboard/summary-cards'),
    getDashboardExpensesByCategory: (period = 'current_month') => {
        const queryParams = new URLSearchParams({ period }).toString();
        return apiService.get(`/expenses/dashboard/expenses-by-category?${queryParams}`);
    },
    getDashboardMonthlyTrend: (months = 6) => {
        const queryParams = new URLSearchParams({ months }).toString();
        return apiService.get(`/expenses/dashboard/monthly-trend?${queryParams}`);
    },
    getDashboardRecentExpenses: (limit = 5) => {
        const queryParams = new URLSearchParams({ limit }).toString();
        return apiService.get(`/expenses/dashboard/recent-expenses?${queryParams}`);
    },
    getDetailedExpenseReport: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/expenses/reports/detailed?${queryParams}`);
    },
    getInventoryItemTypes: () => apiService.get('/inventory/item-types'),
    addInventoryItemType: (itemTypeData) => apiService.post('/inventory/item-types', itemTypeData),
    updateInventoryItemType: (itemTypeId, itemTypeData) => apiService.put(`/inventory/item-types/${itemTypeId}`, itemTypeData),
    deleteInventoryItemType: (itemTypeId) => apiService.delete(`/inventory/item-types/${itemTypeId}`),
    getInventoryConsumables: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/inventory/consumables?${queryParams}`);
    },
    getInventoryConsumablesWithMetadata: async (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        const response = await apiService.getWithMetadata(`/inventory/consumables?${queryParams}`);
        const { data, pagination } = response.data || {};
        return { data, pagination };
    },
    getInventoryConsumableById: (consumableId) => apiService.get(`/inventory/consumables/${consumableId}`),
    addInventoryConsumable: (consumableData) => apiService.post('/inventory/consumables', consumableData),
    updateInventoryConsumable: (consumableId, consumableData) => apiService.put(`/inventory/consumables/${consumableId}`, consumableData),
    deleteInventoryConsumable: (consumableId) => apiService.delete(`/inventory/consumables/${consumableId}`),
    addConsumableMovement: (consumableId, movementData) => apiService.post(`/inventory/consumables/${consumableId}/movements`, movementData),
    getConsumableMovements: (consumableId, filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/inventory/consumables/${consumableId}/movements?${queryParams}`);
    },
    getDashboardConsumablesSummary: () => apiService.get('/inventory/dashboard/consumables/summary'),
    getDashboardConsumablesRecentMovements: (limit = 5) => {
        const queryParams = new URLSearchParams({ limit }).toString();
        return apiService.get(`/inventory/dashboard/consumables/recent-movements?${queryParams}`);
    },
    getDashboardConsumablesItemTypeMovementTrend: (itemTypeId, period = 'last_7_days') => {
        if (!itemTypeId) return Promise.resolve([]);
        const queryParams = new URLSearchParams({ item_type_id: itemTypeId, period }).toString();
        return apiService.get(`/inventory/dashboard/consumables/item-type-movement-trend?${queryParams}`);
    },
    // Enhanced dashboard methods
    getInventoryValueSummary: () => apiService.get('/inventory/dashboard/consumables/inventory-value'),
    getUsagePatterns: () => apiService.get('/inventory/dashboard/consumables/usage-patterns'),
    getContainerSizes: () => apiService.get('/containers/sizes'),
    getReturnReasons: () => apiService.get('/containers/return-reasons'), // For CRM Container Returns
    addIceContainer: (containerData) => apiService.post('/containers/items', containerData),
    getIceContainers: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/containers/items?${queryParams}`);
    },
    getIceContainerById: (containerId) => apiService.get(`/containers/items/${containerId}`),
    updateIceContainer: (containerId, containerData) => apiService.put(`/containers/items/${containerId}`, containerData),
    retireIceContainer: (containerId) => apiService.delete(`/containers/items/${containerId}`),
    assignIceContainer: (containerId, assignmentData) => apiService.post(`/containers/items/${containerId}/assign`, assignmentData),
    returnIceContainer: (assignmentId, returnData) => apiService.put(`/containers/assignments/${assignmentId}/return`, returnData),
    getContainerAssignmentHistory: (containerId, filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/containers/items/${containerId}/assignments?${queryParams}`);
    },
    getAllAssignments: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/containers/assignments?${queryParams}`);
    },
    updateAssignmentDetails: (assignmentId, data) => apiService.put(`/containers/assignments/${assignmentId}`, data),
    addCustomer: (customerData) => apiService.post('/customers', customerData),
    getCustomers: async (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        const response = await apiService.get(`/customers?${queryParams}`);
        return response;  // Keep returning full response for pagination info
    },
    getCustomerById: (customerId) => apiService.get(`/customers/${customerId}`),
    updateCustomer: (customerId, customerData) => apiService.put(`/customers/${customerId}`, customerData),
    deleteCustomer: (customerId) => apiService.delete(`/customers/${customerId}`),
    getDeliveryRoutes: async () => {
        const response = await apiService.get('/customers/delivery-routes');
        return response.data || response || [];
    },

    // --- Fleet management API functions ---
    getVehicles: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/vehicles?${queryParams}`);
    },
    getVehicleById: (vehicleId) => apiService.get(`/vehicles/${vehicleId}`),
    addVehicle: (vehicleData) => apiService.post('/vehicles', vehicleData),
    updateVehicle: (vehicleId, vehicleData) => apiService.put(`/vehicles/${vehicleId}`, vehicleData),
    deleteVehicle: (vehicleId) => apiService.delete(`/vehicles/${vehicleId}`),
    addVehicleMaintenance: (vehicleId, maintenanceData) =>
        apiService.post(`/vehicles/${vehicleId}/maintenance`, maintenanceData),

    // --- Tire management ---
    getVehicleTires: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/tires?${queryParams}`);
    },
    addVehicleTire: (tireData) => apiService.post('/tires', tireData),
    updateVehicleTire: (tireId, tireData) => apiService.put(`/tires/${tireId}`, tireData),
    deleteVehicleTire: (tireId) => apiService.delete(`/tires/${tireId}`),
    getTireAssignments: (filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/tires/assignments?${queryParams}`);
    },
    assignVehicleTire: (assignmentData) => apiService.post('/tires/assign', assignmentData),
    unmountVehicleTire: (tireId, data) => apiService.put(`/tires/unmount/${tireId}`, data),
    
    getCustomerCreditSales: (customerId) => apiService.get(`/customers/${customerId}/credit-sales`),
    // This is different because it sends FormData
    addCustomerCreditPayment: (customerId, paymentData) => {
        // paymentData must be a FormData object
        return request(`/customers/${customerId}/credit-payments`, 'POST', paymentData);
    },
    getCustomerCreditPayments: (customerId, filters = {}) => {
        const queryParams = new URLSearchParams(filters).toString();
        return apiService.get(`/customers/${customerId}/credit-payments?${queryParams}`);
    },
    getCustomerOutstandingCredit: (customerId) => apiService.get(`/customers/${customerId}/outstanding-credit`),

    updateCreditPayment: (paymentId, paymentData) => apiService.put(`/customers/credit-payments/${paymentId}`, paymentData),
    voidCreditPayment: (paymentId, reason) => apiService.post(`/customers/credit-payments/${paymentId}/void`, { void_reason: reason }),

};
