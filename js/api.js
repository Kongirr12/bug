// Configuration for the Google Apps Script API
const CONFIG = {
    // Replace this URL with the Web App URL generated when you deploy Code.gs in Google Apps Script
    API_URL: 'https://script.google.com/macros/s/AKfycbyJi8hhxx-L_3xqokw_ceLcPPl5KPHMEU-Cqt1aIVjfIsGUZvRKsv6jitRvZGV_eFWx/exec'
};

/**
 * Make an API call to the Google Apps Script backend.
 * @param {string} action The function name to call in Apps Script
 * @param {object} payload The data to send
 * @returns {Promise<any>}
 */
async function apiCall(action, payload = {}) {
    try {
        // Since GAS Web Apps handle CORS by default, we can POST to them.
        // For simplicity and avoiding CORS preflight issues with complex headers, 
        // a common pattern is to send POST requests with text/plain, or use URL parameters for GET.
        
        // However, standard fetch with JSON usually works if GAS is configured properly with doPost.
        // We will send a POST request containing the action and payload.
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            // text/plain avoids CORS preflight OPTIONS request which GAS doesn't handle well natively
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: action,
                payload: payload
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message || 'API Error');
        }
        
        return data.data;
    } catch (error) {
        console.error(`API Call failed (${action}):`, error);
        throw error;
    }
}

// Simulated API calls for development before connecting to real GAS
const MOCK_API = {
    login: async (username, password) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (username === 'admin' && password === '1234') {
                    resolve({ success: true, user: { name: 'ผู้ดูแลระบบ', role: 'admin' } });
                } else if (username === 'kru' && password === '1234') {
                    resolve({ success: true, user: { name: 'คุณครูสมศรี', role: 'ครู' } });
                } else if (username === 'boss' && password === '1234') {
                    resolve({ success: true, user: { name: 'ผอ.โรงเรียน', role: 'ผู้บริหาร' } });
                } else {
                    resolve({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
                }
            }, 1000);
        });
    },
    getDashboardData: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    totalBudget: 1500000,
                    usedBudget: 450000,
                    pendingBudget: 50000,
                    remainBudget: 1000000,
                    chartData: {
                        labels: ['งบอุดหนุน', 'งบกลาง', 'งบอื่นๆ'],
                        datasets: [{
                            data: [800000, 500000, 200000],
                            backgroundColor: ['#2563eb', '#10b981', '#f59e0b']
                        }]
                    },
                    recentProjects: [
                        { id: 'P001', name: 'ปรับปรุงห้องสมุด', owner: 'ครูสมศรี', status: 'อนุมัติ' },
                        { id: 'P002', name: 'ค่ายคณิตศาสตร์', owner: 'ครูสมชาย', status: 'รอตรวจสอบ' }
                    ]
                });
            }, 800);
        });
    }
};

const API = {
    // Set this to false when connecting to the real backend
    USE_MOCK: true,
    
    login: async (username, password) => {
        if (API.USE_MOCK) return MOCK_API.login(username, password);
        return apiCall('login', { username, password });
    },
    
    getDashboardData: async () => {
        if (API.USE_MOCK) return MOCK_API.getDashboardData();
        return apiCall('getDashboardData');
    }
    // Add other API functions here as needed
};
