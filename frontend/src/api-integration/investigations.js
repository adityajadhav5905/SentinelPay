import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL_ANALYTICS || 'http://localhost:3003';

const getAuthHeaders = () => {
    const token = localStorage.getItem('sentinelpay_token') || localStorage.getItem('sentinelpay_token') || 'bypass';
    return {
        Authorization: `Bearer ${token}`
    };
};

export const fetchInvestigations = async (params = {}) => {
    const response = await axios.get(`${API_BASE}/analytics/investigations`, {
        params,
        headers: getAuthHeaders()
    });
    return response.data;
};

export const fetchInvestigationDetail = async (id) => {
    const response = await axios.get(`${API_BASE}/analytics/investigations/${id}`, {
        headers: getAuthHeaders()
    });
    return response.data;
};

export const submitInvestigationDecision = async (id, action, notes = '') => {
    const response = await axios.post(`${API_BASE}/analytics/investigations/${id}/decision`, {
        action,
        notes,
        decisionBy: 'Operations Analyst'
    }, {
        headers: getAuthHeaders()
    });
    return response.data;
};

export const fetchKnowledgeDocs = async (params = {}) => {
    const response = await axios.get(`${API_BASE}/analytics/knowledge`, {
        params,
        headers: getAuthHeaders()
    });
    return response.data;
};

export const queryKnowledgeBase = async (query) => {
    const response = await axios.post(`${API_BASE}/analytics/knowledge/query`, {
        query,
        limit: 5
    }, {
        headers: getAuthHeaders()
    });
    return response.data;
};

export const fetchDecisionPolicies = async () => {
    const response = await axios.get(`${API_BASE}/analytics/policies`, {
        headers: getAuthHeaders()
    });
    return response.data;
};

export const updateDecisionPolicy = async (id, data) => {
    const response = await axios.patch(`${API_BASE}/analytics/policies/${id}`, data, {
        headers: getAuthHeaders()
    });
    return response.data;
};

export const createKnowledgeDoc = async (data) => {
    const response = await axios.post(`${API_BASE}/analytics/knowledge`, data, {
        headers: getAuthHeaders()
    });
    return response.data;
};

export const createDecisionPolicy = async (data) => {
    const response = await axios.post(`${API_BASE}/analytics/policies`, data, {
        headers: getAuthHeaders()
    });
    return response.data;
};

export const deleteKnowledgeDoc = async (id) => {
    const response = await axios.delete(`${API_BASE}/analytics/knowledge/${id}`, {
        headers: getAuthHeaders()
    });
    return response.data;
};

export const deleteDecisionPolicy = async (id) => {
    const response = await axios.delete(`${API_BASE}/analytics/policies/${id}`, {
        headers: getAuthHeaders()
    });
    return response.data;
};
