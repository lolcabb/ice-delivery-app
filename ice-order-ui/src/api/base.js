export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const debugToken = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.warn("No auth token found in localStorage for debugging.");
        return null;
    }
    console.log(`Debug Token: ${token.substring(0, 15)}...`);
    return token;
};

export const handleGlobalAuthError = (status, endpoint) => {
    if (status === 401) {
        console.warn(`Unauthorized (401) response from ${endpoint}. Token may be invalid or expired. Redirecting to login.`);
        const lastAuthErrorTime = parseInt(sessionStorage.getItem('lastAuthErrorTime') || '0');
        const now = Date.now();
        if (now - lastAuthErrorTime > 2000) {
            sessionStorage.setItem('lastAuthErrorTime', now.toString());
            localStorage.removeItem('authToken');
            localStorage.removeItem('authUser');
            window.location.replace('/login');
        }
        return true;
    }
    return false;
};

export const request = async (endpoint, method = 'GET', body = null, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    const token = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { method, headers, signal: controller.signal, ...options };

    if (body) {
        config.body = (body instanceof FormData) ? body : JSON.stringify(body);
        if (body instanceof FormData) {
            delete headers['Content-Type'];
        }
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        clearTimeout(timeoutId);

        const metadata = {
            status: response.status,
            statusText: response.statusText,
            headers: { etag: response.headers.get('ETag') }
        };

        if (handleGlobalAuthError(response.status, endpoint)) {
            throw new Error('Session expired or unauthorized.');
        }

        if (response.status === 204) return { data: null, metadata };
        if (response.status === 304) return { data: null, metadata, notModified: true };

        let responseData;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            try {
                const text = await response.text();
                responseData = text ? JSON.parse(text) : null;
            } catch (e) {
                console.error('Failed to parse JSON response:', e);
                responseData = null;
            }
        } else {
            responseData = await response.text();
        }

        if (!response.ok) {
            const error = new Error(
                (typeof responseData === 'object' && responseData?.message) ||
                responseData ||
                'API Request Failed'
            );
            error.status = response.status;
            error.data = typeof responseData === 'object' ? responseData : { message: responseData };
            throw error;
        }

        return { data: responseData, metadata };

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            const timeoutError = new Error('Request timed out after 15 seconds.');
            timeoutError.status = 408;
            throw timeoutError;
        }
        throw error;
    }
};