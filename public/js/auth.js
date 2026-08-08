const API_URL = '/api';

// Global fetch wrapper
async function fetchAPI(endpoint, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    options.headers = { ...defaultHeaders, ...options.headers };
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
}
