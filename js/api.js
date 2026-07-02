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
    loginUser: async (username, password) => {
        // Handle object payload
        if (typeof username === 'object' && username !== null) {
            password = username.password;
            username = username.username;
        }
        
        return new Promise(resolve => {
            setTimeout(() => {
                if (username === 'admin' && password === '1234') {
                    resolve({ success: true, user: { name: 'ผู้ดูแลระบบสูงสุด', role: 'admin' } });
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
                    success: true,
                    data: {
                        summary: { total: 1000000, used: 450000, reserve: 50000, remain: 500000 },
                        typeDetails: [
                            { name: 'งบอุดหนุน', received: 600000, used: 300000, remain: 300000 },
                            { name: 'งบพัฒนาผู้เรียน', received: 400000, used: 150000, remain: 250000 }
                        ],
                        projects: [
                            { status: 'อนุมัติแล้ว', name: 'โครงการเข้าค่ายคุณธรรม', budget: 50000, used: 20000, pct: 40 }
                        ]
                    }
                });
            }, 500);
        });
    },

    getCentralBudgetData: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data: {
                        summary: { total: 1000000, used: 450000, reserve: 50000, remain: 500000 },
                        projects: [],
                        utils: []
                    }
                });
            }, 500);
        });
    },

    getBudgetTrackingData: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data: {
                        budgetSummary: [
                            { name: 'งบอุดหนุน', received: 600000, used: 300000, remain: 300000 }
                        ],
                        transactions: []
                    }
                });
            }, 500);
        });
    },

    getDocTemplates: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data: window.mock_docTemplates || []
                });
            }, 500);
        });
    },

    saveDocTemplate: async (data) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (!window.mock_docTemplates) window.mock_docTemplates = [];
                const newDoc = {
                    id: Date.now().toString(),
                    name: data.name,
                    desc: data.desc,
                    url: data.url,
                    icon: data.icon || 'fas fa-file-alt'
                };
                window.mock_docTemplates.push(newDoc);
                resolve({ success: true, message: 'บันทึกแบบฟอร์มแล้ว' });
            }, 500);
        });
    },

    deleteDocTemplate: async (id) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (window.mock_docTemplates) {
                    window.mock_docTemplates = window.mock_docTemplates.filter(d => d.id !== id);
                }
                resolve({ success: true, message: 'ลบแบบฟอร์มแล้ว' });
            }, 500);
        });
    },

    getUsers: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({ success: true, data: window.mock_users || [] });
            }, 500);
        });
    },

    saveUser: async (data) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (!window.mock_users) window.mock_users = [];
                const newUser = {
                    id: data.id || Date.now().toString(),
                    username: data.username,
                    name: data.name,
                    dept: data.dept,
                    role: data.role,
                    password: data.password || '1234'
                };
                if (data.id) {
                    const idx = window.mock_users.findIndex(u => u.id === data.id);
                    if (idx !== -1) window.mock_users[idx] = newUser;
                    else window.mock_users.push(newUser);
                } else {
                    window.mock_users.push(newUser);
                }
                resolve({ success: true, message: 'บันทึกข้อมูลผู้ใช้แล้ว' });
            }, 500);
        });
    },

    deleteUser: async (id) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (window.mock_users) {
                    window.mock_users = window.mock_users.filter(u => u.id !== id);
                }
                resolve({ success: true, message: 'ลบผู้ใช้งานแล้ว' });
            }, 500);
        });
    },

    getMenuPermissions: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({ success: true, data: window.mock_permissions || [] });
            }, 500);
        });
    },

    saveMenuPermissions: async (data) => {
        return new Promise(resolve => {
            setTimeout(() => {
                window.mock_permissions = data;
                resolve({ success: true, message: 'บันทึกสิทธิ์เรียบร้อยแล้ว' });
            }, 500);
        });
    }
};

window.mock_docTemplates = [
    { id: '1', name: 'แบบฟอร์มขออนุมัติโครงการ', desc: 'ดาวน์โหลดไปแก้ไขสำหรับเสนอโครงการ', url: '#', icon: 'fas fa-file-word' },
    { id: '2', name: 'ตัวอย่างโครงการ', desc: 'ไฟล์ตัวอย่างโครงการที่สมบูรณ์', url: '#', icon: 'fas fa-file-pdf' },
    { id: '3', name: 'แบบฟอร์มเบิกจ่าย', desc: 'ใช้เมื่อต้องการเบิกจ่ายงบประมาณ', url: '#', icon: 'fas fa-money-check-alt' }
];

window.mock_users = [
    { id: 'u1', username: 'admin', name: 'ผู้ดูแลระบบสูงสุด', dept: 'ผู้บริหาร', role: 'ADMIN' },
    { id: 'u2', username: 'boss', name: 'ผอ.โรงเรียน', dept: 'ผู้บริหาร', role: 'EXECUTIVE' },
    { id: 'u3', username: 'kru', name: 'คุณครูสมศรี', dept: 'วิชาการ', role: 'TEACHER' }
];

window.mock_permissions = [
    { menu: 'dashboard', roles: { ADMIN: true, EXECUTIVE: true, TEACHER: true } },
    { menu: 'central-budget', roles: { ADMIN: true, EXECUTIVE: true, TEACHER: false } },
    { menu: 'projects', roles: { ADMIN: true, EXECUTIVE: false, TEACHER: true } },
    { menu: 'proposals', roles: { ADMIN: true, EXECUTIVE: true, TEACHER: true } },
    { menu: 'disbursements', roles: { ADMIN: true, EXECUTIVE: true, TEACHER: true } },
    { menu: 'tracking', roles: { ADMIN: true, EXECUTIVE: true, TEACHER: true } },
    { menu: 'doctemplates', roles: { ADMIN: true, EXECUTIVE: true, TEACHER: true } },
    { menu: 'reports', roles: { ADMIN: true, EXECUTIVE: true, TEACHER: true } },
    { menu: 'settings', roles: { ADMIN: true, EXECUTIVE: false, TEACHER: false } }
];

const API = {
    USE_MOCK: true,
    
    call: async (action, ...args) => {
        if (API.USE_MOCK) {
            if (MOCK_API[action]) return MOCK_API[action](...args);
            
            // Generic mock response for any unimplemented function
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve({ success: true, message: 'ดำเนินการสำเร็จ (Mock Mode)', data: [] });
                }, 500);
            });
        }
        
        // Wrap args in payload for fetch
        // Note: For multi-argument functions, we should ideally serialize them.
        // For simplicity, we just pass the first argument if it's the only one, or an array.
        let payload = args.length === 1 ? args[0] : args;
        if (args.length === 0) payload = {};
        
        return apiCall(action, payload);
    }
};

// Polyfill for google.script.run so the original 2500 lines of JS work out of the box!
window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = new Proxy({}, {
    get: function(target, prop) {
        if (prop === 'withSuccessHandler') {
            return function(callback) {
                return new Proxy({}, {
                    get: function(t, action) {
                        return function(...args) {
                            API.call(action, ...args)
                                .then(callback)
                                .catch(err => {
                                    console.error('API Error:', err);
                                    if (typeof Swal !== 'undefined') {
                                        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ' + err.message, 'error');
                                    }
                                });
                        };
                    }
                });
            };
        }
        
        // Direct call without success handler
        return function(...args) {
            API.call(prop, ...args).catch(err => console.error(err));
        };
    }
});
