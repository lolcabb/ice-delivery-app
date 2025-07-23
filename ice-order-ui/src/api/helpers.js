export function handleComponentAuthError(error, navigate) {
    if (error && error.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        if (navigate) {
            navigate('/login');
        } else {
            window.location.replace('/login');
        }
        return true;
    }
    return false;
}
