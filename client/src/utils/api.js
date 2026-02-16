const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE_URL || 'http://localhost:3001/uploads';

export { API_BASE, UPLOADS_BASE };

function getHeaders() {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

export async function api(endpoint, options = {}) {
    const { method = 'GET', body, isFormData = false } = options;
    const config = { method, headers: isFormData ? {} : getHeaders() };

    if (isFormData) {
        const token = localStorage.getItem('token');
        if (token) config.headers = { Authorization: `Bearer ${token}` };
        config.body = body;
    } else if (body) {
        config.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) {
        // If unauthorized, clear stale auth and redirect to login
        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        const error = new Error(data.error || 'Request failed');
        Object.assign(error, data); // Attach status, key_required, etc.
        throw error;
    }
    return data;
}

// Auth
export const login = (email, password) => api('/auth/login', { method: 'POST', body: { email, password } });
export const register = (email, password, name, role) => api('/auth/register', { method: 'POST', body: { email, password, name, role } });
export const getProfile = () => api('/auth/profile');
export const updateProfile = (data) => api('/auth/profile', { method: 'PUT', body: data });

// Institutions
export const getInstitutions = (search = '') => api(`/institutions${search ? `?search=${encodeURIComponent(search)}` : ''}`);
export const getInstitution = (id, key = '') => api(`/institutions/${id}${key ? `?access_key=${encodeURIComponent(key)}` : ''}`);
export const createInstitution = (data) => api('/institutions', { method: 'POST', body: data });
export const updateInstitution = (id, data, isFormData = false) => api(`/institutions/${id}`, { method: 'PUT', body: data, isFormData });
export const deleteInstitution = (id) => api(`/institutions/${id}`, { method: 'DELETE' });
export const getMyInstitutions = () => api('/institutions/my/list');

// Buildings
export const getBuildings = (instId) => api(`/institutions/${instId}/buildings`);
export const createBuilding = (instId, data) => api(`/institutions/${instId}/buildings`, { method: 'POST', body: data });
export const updateBuilding = (id, data) => api(`/institutions/buildings/${id}`, { method: 'PUT', body: data });
export const deleteBuilding = (id) => api(`/institutions/buildings/${id}`, { method: 'DELETE' });

// Floors
export const getFloors = (buildingId) => api(`/institutions/buildings/${buildingId}/floors`);
export const createFloor = (buildingId, formData) => api(`/institutions/buildings/${buildingId}/floors`, { method: 'POST', body: formData, isFormData: true });
export const uploadFloorImage = (floorId, formData) => api(`/institutions/floors/${floorId}/image`, { method: 'PUT', body: formData, isFormData: true });
export const deleteFloor = (floorId) => api(`/institutions/floors/${floorId}`, { method: 'DELETE' });

// Nodes & Edges
export const getNodes = (floorId) => api(`/maps/floors/${floorId}/nodes`);
export const createNode = (floorId, data) => api(`/maps/floors/${floorId}/nodes`, { method: 'POST', body: data });
export const updateNode = (id, data) => api(`/maps/nodes/${id}`, { method: 'PUT', body: data });
export const deleteNode = (id) => api(`/maps/nodes/${id}`, { method: 'DELETE' });
export const getEdges = (floorId) => api(`/maps/floors/${floorId}/edges`);
export const createEdge = (floorId, data) => api(`/maps/floors/${floorId}/edges`, { method: 'POST', body: data });
export const updateEdge = (id, data) => api(`/maps/edges/${id}`, { method: 'PUT', body: data });
export const deleteEdge = (id) => api(`/maps/edges/${id}`, { method: 'DELETE' });
export const getFloorGraph = (floorId) => api(`/maps/floors/${floorId}/graph`);
export const getFullGraph = (instId, key = '') => api(`/maps/institution/${instId}/full-graph${key ? `?access_key=${encodeURIComponent(key)}` : ''}`);

// Comments & Feedback
export const getComments = (floorId) => api(`/maps/floors/${floorId}/comments`);
export const createComment = (floorId, data) => api(`/maps/floors/${floorId}/comments`, { method: 'POST', body: data });
export const submitFeedback = (instId, data) => api(`/maps/institution/${instId}/feedback`, { method: 'POST', body: data });
export const getFeedback = (instId) => api(`/maps/institution/${instId}/feedback`);

// Saved maps & history
export const getSavedMaps = () => api('/maps/saved');
export const saveMap = (instId) => api(`/maps/save/${instId}`, { method: 'POST' });
export const unsaveMap = (instId) => api(`/maps/save/${instId}`, { method: 'DELETE' });
export const getHistory = () => api('/maps/history');
export const logHistory = (data) => api('/maps/history', { method: 'POST', body: data });

// Navigation
export const logNavigation = (data) => api('/navigation/log', { method: 'POST', body: data });
export const searchNodes = (instId, q) => api(`/navigation/search/${instId}?q=${encodeURIComponent(q)}`);

// Access Control
export const getAccessRules = (instId) => api(`/access/${instId}`);
export const setAccessRule = (instId, data) => api(`/access/${instId}`, { method: 'POST', body: data });
export const deleteAccessRule = (id) => api(`/access/rule/${id}`, { method: 'DELETE' });
export const checkAccess = (instId, data) => api(`/access/${instId}/check`, { method: 'POST', body: data || {} });
export const getAccessRequests = (instId) => api(`/access/${instId}/requests`);
export const respondAccessRequest = (id, data) => api(`/access/request/${id}`, { method: 'PUT', body: data });
export const requestAccess = (instId, message) => api(`/access/${instId}/request`, { method: 'POST', body: { message } });
export const getMyAccessRequests = () => api('/access/my/requests');

// Analytics
export const getAnalytics = (instId) => api(`/analytics/${instId}`);

// Events
export const getEvents = (params = '') => api(`/events?${params}`);
export const getEvent = (id) => api(`/events/${id}`);
export const createEvent = (data) => api('/events', { method: 'POST', body: data });
export const updateEvent = (id, data) => api(`/events/${id}`, { method: 'PUT', body: data });
export const deleteEvent = (id) => api(`/events/${id}`, { method: 'DELETE' });
export const getMyEvents = () => api('/events/my/list');

// Admin
export const getAdminUsers = () => api('/admin/users');
export const updateUserRole = (id, role) => api(`/admin/users/${id}/role`, { method: 'PUT', body: { role } });
export const deleteUser = (id) => api(`/admin/users/${id}`, { method: 'DELETE' });
export const getAdminInstitutions = () => api('/admin/institutions');
export const moderateInstitution = (id, data) => api(`/admin/institutions/${id}/moderate`, { method: 'PUT', body: data });
export const adminDeleteInstitution = (id) => api(`/admin/institutions/${id}`, { method: 'DELETE' });
export const getAdminAnalytics = () => api('/admin/analytics');
