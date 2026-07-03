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
                    resolve({ success: true, user: { name: 'ผู้ดูแลระบบสูงสุด', role: 'ADMIN' } });
                } else if (username === 'kru' && password === '1234') {
                    resolve({ success: true, user: { name: 'คุณครูสมศรี', role: 'TEACHER' } });
                } else if (username === 'boss' && password === '1234') {
                    resolve({ success: true, user: { name: 'ผอ.โรงเรียน', role: 'EXECUTIVE' } });
                } else {
                    resolve({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
                }
            }, 1000);
        });
    },
    
    _calculateBudgetSummary: () => {
        const allocations = window.mock_Allocations || loadFromLocalStorage('mock_Allocations', []);
        const projects = window.mock_Projects || loadFromLocalStorage('mock_Projects', []);
        const utils = window.mock_Utilities || loadFromLocalStorage('mock_Utilities', []);
        
        let total = 0, used = 0, reserve = 0, remain = 0;
        const typeMap = {};

        allocations.forEach(a => {
            let amt = parseFloat(a.amount || 0);
            if (isNaN(amt)) amt = 0;
            total += amt;
            const bt = a.budgetType || 'ไม่ระบุ';
            if (!typeMap[bt]) typeMap[bt] = { name: bt, received: 0, used: 0, remain: 0 };
            typeMap[bt].received += amt;
        });

        projects.forEach(p => {
            if (p.status !== 'ไม่อนุมัติ') {
                let amt = parseFloat(p.budget || 0);
                if (isNaN(amt)) amt = 0;
                used += amt;
                const bt = p.budgetType || 'ไม่ระบุ';
                if (!typeMap[bt]) typeMap[bt] = { name: bt, received: 0, used: 0, remain: 0 };
                typeMap[bt].used += amt;
            }
        });

        utils.forEach(u => {
            let amt = parseFloat(u.amount || 0);
            if (isNaN(amt)) amt = 0;
            reserve += amt;
            const bt = u.budgetType || 'ไม่ระบุ';
            if (!typeMap[bt]) typeMap[bt] = { name: bt, received: 0, used: 0, remain: 0 };
            typeMap[bt].used += amt;
        });

        remain = total - used - reserve;
        const typeDetails = Object.values(typeMap).map(t => {
            t.remain = t.received - t.used;
            return t;
        });

        return { summary: { total, used, reserve, remain }, typeDetails };
    },

    getBudgetTypes: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                const types = window.mock_BudgetTypes || loadFromLocalStorage('mock_BudgetTypes', []);
                const calculated = MOCK_API._calculateBudgetSummary();
                const typeMap = {};
                calculated.typeDetails.forEach(t => {
                    typeMap[t.name] = t;
                });
                const enriched = types.map(t => {
                    const stats = typeMap[t.name] || { received: 0, used: 0, remain: 0 };
                    return {
                        id: t.id,
                        name: t.name,
                        received: stats.received,
                        used: stats.used,
                        remain: stats.remain
                    };
                });
                resolve({ success: true, data: enriched });
            }, 500);
        });
    },

    getDashboardData: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                const calculated = MOCK_API._calculateBudgetSummary();
                const projects = (window.mock_Projects || loadFromLocalStorage('mock_Projects', [])).map(p => ({
                    status: p.status || 'รออนุมัติ',
                    name: p.name,
                    budget: parseFloat(p.budget || 0),
                    used: parseFloat(p.used || 0),
                    pct: parseFloat(p.budget || 0) > 0 ? (parseFloat(p.used || 0) / parseFloat(p.budget)) * 100 : 0
                }));
                resolve({
                    success: true,
                    data: {
                        summary: calculated.summary,
                        typeDetails: calculated.typeDetails,
                        projects: projects
                    }
                });
            }, 500);
        });
    },

    getCentralBudgetData: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                const calculated = MOCK_API._calculateBudgetSummary();
                const projects = (window.mock_Projects || loadFromLocalStorage('mock_Projects', [])).map(p => {
                    let budget = parseFloat(p.budget || 0);
                    if (isNaN(budget)) budget = 0;
                    let used = parseFloat(p.used || 0);
                    if (isNaN(used)) used = 0;
                    return {
                        name: p.name,
                        allocated: budget,
                        totalUsed: used,
                        overAmount: used > budget ? used - budget : 0
                    };
                });
                resolve({
                    success: true,
                    data: {
                        summary: calculated.summary,
                        projects: projects,
                        utils: window.mock_Utilities || loadFromLocalStorage('mock_Utilities', [])
                    }
                });
            }, 500);
        });
    },

    getBudgetTrackingData: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                const calculated = MOCK_API._calculateBudgetSummary();
                const transactions = [];
                
                const allocations = window.mock_Allocations || loadFromLocalStorage('mock_Allocations', []);
                allocations.forEach(a => {
                    transactions.push({
                        date: a.date || '-',
                        type: 'รับจัดสรร',
                        category: a.budgetType,
                        description: a.description || 'รับงบประมาณ',
                        amountIn: parseFloat(a.amount || 0),
                        amountOut: 0
                    });
                });

                const projects = window.mock_Projects || loadFromLocalStorage('mock_Projects', []);
                projects.forEach(p => {
                    if (p.status !== 'ไม่อนุมัติ') {
                        transactions.push({
                            date: p.date || '-',
                            type: 'จ่ายออก',
                            category: p.budgetType,
                            description: `โครงการ: ${p.name}`,
                            amountIn: 0,
                            amountOut: parseFloat(p.budget || 0)
                        });
                    }
                });

                const utils = window.mock_Utilities || loadFromLocalStorage('mock_Utilities', []);
                utils.forEach(u => {
                    transactions.push({
                        date: `${u.month || '-'}/${u.year || '-'}`,
                        type: 'จ่ายออก',
                        category: u.budgetType,
                        description: `สาธารณูปโภค: ${u.type}`,
                        amountIn: 0,
                        amountOut: parseFloat(u.amount || 0)
                    });
                });

                // Sort transactions by date descending (rough sort)
                transactions.sort((a, b) => (b.date > a.date ? 1 : -1));

                resolve({
                    success: true,
                    data: {
                        budgetSummary: calculated.typeDetails,
                        transactions: transactions
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

    getReportSettings: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data: window.mock_reportSettings || loadFromLocalStorage('mock_reportSettings', { wordLink: '#', pdfLink: '#' })
                });
            }, 500);
        });
    },

    saveReportSettings: async (wordLink, pdfLink) => {
        return new Promise(resolve => {
            setTimeout(() => {
                window.mock_reportSettings = { wordLink, pdfLink };
                saveToLocalStorage('mock_reportSettings', window.mock_reportSettings);
                resolve({ success: true, message: 'บันทึกการตั้งค่าลิงก์รายงานแล้ว' });
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
                saveToLocalStorage('mock_docTemplates', window.mock_docTemplates);
                resolve({ success: true, message: 'บันทึกแบบฟอร์มแล้ว' });
            }, 500);
        });
    },

    deleteDocTemplate: async (id) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (window.mock_docTemplates) {
                    window.mock_docTemplates = window.mock_docTemplates.filter(d => d.id !== id);
                    saveToLocalStorage('mock_docTemplates', window.mock_docTemplates);
                }
                resolve({ success: true, message: 'ลบแบบฟอร์มแล้ว' });
            }, 500);
        });
    },

    getAllUsers: async () => {
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
                saveToLocalStorage('mock_users', window.mock_users);
                resolve({ success: true, message: 'บันทึกข้อมูลผู้ใช้แล้ว' });
            }, 500);
        });
    },

    deleteUser: async (id) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (window.mock_users) {
                    window.mock_users = window.mock_users.filter(u => u.id !== id);
                    saveToLocalStorage('mock_users', window.mock_users);
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
                const merged = window.mock_permissions.map(existing => {
                    const updated = data.find(d => d.menuKey === existing.menuKey);
                    return updated ? { ...existing, ...updated } : existing;
                });
                window.mock_permissions = merged;
                saveToLocalStorage('mock_permissions', window.mock_permissions);
                resolve({ success: true, message: 'บันทึกสิทธิ์เรียบร้อยแล้ว' });
            }, 500);
        });
    },

    getReportSubmissions: async () => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (!window.mock_Projects) window.mock_Projects = loadFromLocalStorage('mock_Projects', []);
                const data = window.mock_Projects.map(p => ({
                    projectId: p.id,
                    projectName: p.name,
                    budget: p.budget,
                    progress: p.progress || 0,
                    reportStatus: p.reportStatus || 'ยังไม่ได้ส่ง',
                    reportNote: p.reportNote || '',
                    reportUpdatedBy: p.reportUpdatedBy || '',
                    wordLink: p.wordLink || '',
                    pdfLink: p.pdfLink || ''
                }));
                resolve({ success: true, data: data });
            }, 500);
        });
    },

    updateReportStatus: async (projectId, newStatus, note, updatedBy, wordLink, pdfLink) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (window.mock_Projects) {
                    const proj = window.mock_Projects.find(p => p.id === projectId);
                    if (proj) {
                        proj.reportStatus = newStatus;
                        proj.reportNote = note || '';
                        proj.reportUpdatedBy = updatedBy || '';
                        if (wordLink !== undefined) proj.wordLink = wordLink;
                        if (pdfLink !== undefined) proj.pdfLink = pdfLink;
                        saveToLocalStorage('mock_Projects', window.mock_Projects);
                    }
                }
                resolve({ success: true, message: 'อัปเดตสถานะเรียบร้อยแล้ว' });
            }, 500);
        });
    },

    updateProposalStatus: async (id, status, reason, updatedBy) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (!window.mock_Proposals) window.mock_Proposals = loadFromLocalStorage('mock_Proposals', []);
                const prop = window.mock_Proposals.find(p => p.id === id);
                if (prop) {
                    prop.status = status;
                    prop.rejectReason = reason || '';
                    prop.reviewedBy = updatedBy || '';
                    saveToLocalStorage('mock_Proposals', window.mock_Proposals);

                    // If approved, create a new project
                    if (status === 'อนุมัติ') {
                        if (!window.mock_Projects) window.mock_Projects = loadFromLocalStorage('mock_Projects', []);
                        window.mock_Projects.push({
                            id: Date.now().toString(),
                            name: prop.name,
                            budgetType: 'งบกลาง', // default
                            status: 'รอพิจารณา', // default
                            budget: prop.budget,
                            used: 0,
                            proposedBy: prop.proposedBy
                        });
                        saveToLocalStorage('mock_Projects', window.mock_Projects);
                    }
                }
                resolve({ success: true, message: 'อัปเดตสถานะเรียบร้อยแล้ว' });
            }, 500);
        });
    },

    approveDisbursement: async (id, updatedBy, actualAmount) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (!window.mock_Disbursements) window.mock_Disbursements = loadFromLocalStorage('mock_Disbursements', []);
                const disb = window.mock_Disbursements.find(d => d.id === id);
                if (disb) {
                    disb.status = 'อนุมัติแล้ว';
                    disb.reviewedBy = updatedBy || '';
                    disb.actualAmount = parseFloat(actualAmount || disb.amount);
                    saveToLocalStorage('mock_Disbursements', window.mock_Disbursements);
                    
                    // Also update the project's used amount
                    if (disb.projectId) {
                        if (!window.mock_Projects) window.mock_Projects = loadFromLocalStorage('mock_Projects', []);
                        const proj = window.mock_Projects.find(p => p.id === disb.projectId);
                        if (proj) {
                            proj.used = (parseFloat(proj.used) || 0) + disb.actualAmount;
                            saveToLocalStorage('mock_Projects', window.mock_Projects);
                        }
                    }
                }
                resolve({ success: true, message: 'อนุมัติเรียบร้อยแล้ว' });
            }, 500);
        });
    },

    rejectDisbursement: async (id, reason, updatedBy) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (!window.mock_Disbursements) window.mock_Disbursements = loadFromLocalStorage('mock_Disbursements', []);
                const disb = window.mock_Disbursements.find(d => d.id === id);
                if (disb) {
                    disb.status = 'ไม่อนุมัติ';
                    disb.rejectReason = reason || '';
                    disb.reviewedBy = updatedBy || '';
                    saveToLocalStorage('mock_Disbursements', window.mock_Disbursements);
                }
                resolve({ success: true, message: 'ปฏิเสธเรียบร้อยแล้ว' });
            }, 500);
        });
    }
};

function loadFromLocalStorage(key, defaultVal) {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultVal;
}

function saveToLocalStorage(key, val) {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
        console.warn('LocalStorage limit exceeded. Data kept in memory only.', e);
        if (typeof Swal !== 'undefined' && !window.hasWarnedStorageFull) {
            window.hasWarnedStorageFull = true;
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'พื้นที่จัดเก็บจำลองเต็ม ไฟล์ใหญ่เกินไป (หากรีเฟรชหน้า ไฟล์ที่อัปโหลดจะหาย)',
                showConfirmButton: false,
                timer: 5000
            });
        }
    }
}

window.mock_docTemplates = loadFromLocalStorage('mock_docTemplates', [
    { id: '1', name: 'แบบฟอร์มขออนุมัติโครงการ', desc: 'ดาวน์โหลดไปแก้ไขสำหรับเสนอโครงการ', url: '#', icon: 'fas fa-file-word' },
    { id: '2', name: 'ตัวอย่างโครงการ', desc: 'ไฟล์ตัวอย่างโครงการที่สมบูรณ์', url: '#', icon: 'fas fa-file-pdf' },
    { id: '3', name: 'แบบฟอร์มเบิกจ่าย', desc: 'ใช้เมื่อต้องการเบิกจ่ายงบประมาณ', url: '#', icon: 'fas fa-money-check-alt' }
]);

window.mock_users = loadFromLocalStorage('mock_users', [
    { id: 'u1', username: 'admin', name: 'ผู้ดูแลระบบสูงสุด', dept: 'ผู้บริหาร', role: 'ADMIN' },
    { id: 'u2', username: 'boss', name: 'ผอ.โรงเรียน', dept: 'ผู้บริหาร', role: 'EXECUTIVE' },
    { id: 'u3', username: 'kru', name: 'คุณครูสมศรี', dept: 'วิชาการ', role: 'TEACHER' }
]);

let savedPerms = loadFromLocalStorage('mock_permissions', null);
if (savedPerms && savedPerms.length > 0 && !savedPerms[0].menuKey) {
    savedPerms = null; // Discard old structure cache
}
window.mock_permissions = savedPerms || [
    { menuKey: 'dashboard', menuName: 'ภาพรวม (Dashboard)', ADMIN: true, EXECUTIVE: true, TEACHER: true },
    { menuKey: 'doctemplates', menuName: 'รูปแบบไฟล์ขออนุญาต', ADMIN: true, EXECUTIVE: true, TEACHER: true },
    { menuKey: 'settings', menuName: 'ตั้งค่าข้อมูลพื้นฐาน', ADMIN: true, EXECUTIVE: false, TEACHER: false },
    { menuKey: 'allocation', menuName: 'จัดสรรงบประมาณ', ADMIN: true, EXECUTIVE: false, TEACHER: false },
    { menuKey: 'projects', menuName: 'สร้างโครงการ/กิจกรรม', ADMIN: true, EXECUTIVE: false, TEACHER: false },
    { menuKey: 'utilities', menuName: 'บันทึกค่าสาธารณูปโภค', ADMIN: true, EXECUTIVE: false, TEACHER: false },
    { menuKey: 'central-budget', menuName: 'วิเคราะห์การใช้งบกลาง', ADMIN: true, EXECUTIVE: true, TEACHER: true },
    { menuKey: 'proposals', menuName: 'การเสนอโครงการ', ADMIN: true, EXECUTIVE: true, TEACHER: true },
    { menuKey: 'reports', menuName: 'รายงานโครงการ', ADMIN: true, EXECUTIVE: true, TEACHER: true },
    { menuKey: 'tracking', menuName: 'ติดตามการใช้จ่ายงบฯ', ADMIN: true, EXECUTIVE: true, TEACHER: true },
    { menuKey: 'disbursements', menuName: 'อนุมัติเบิกจ่าย', ADMIN: true, EXECUTIVE: true, TEACHER: false }
];
saveToLocalStorage('mock_permissions', window.mock_permissions);

const API = {
    USE_MOCK: false,
    
    call: async (action, ...args) => {
        if (API.USE_MOCK) {
            if (MOCK_API[action]) return MOCK_API[action](...args);
            
            // Generic mock response for any unimplemented function
            return new Promise(resolve => {
                setTimeout(() => {
                    if (action.startsWith('get') && action !== 'getReportSettings') {
                        let entity = action.replace('get', '');
                        if (entity === 'AllUsers') entity = 'Users';
                        if (!window['mock_' + entity]) window['mock_' + entity] = loadFromLocalStorage('mock_' + entity, []);
                        
                        // Patch for missing or undefined status in legacy data
                        if (['Disbursements', 'Proposals', 'Projects'].includes(entity)) {
                            let updated = false;
                            window['mock_' + entity].forEach(d => {
                                if (!d.status || d.status === 'undefined') {
                                    if (entity === 'Proposals' || entity === 'Projects') d.status = 'รอพิจารณา';
                                    else d.status = 'รออนุมัติ';
                                    updated = true;
                                }
                            });
                            if (updated) saveToLocalStorage('mock_' + entity, window['mock_' + entity]);
                        }

                        resolve({ success: true, data: window['mock_' + entity] });
                    } else if (action.startsWith('save')) {
                        let entity = action.replace('save', '');
                        if (entity === 'User') entity = 'Users';
                        else if (!entity.endsWith('s')) entity += 's';
                        
                        if (!window['mock_' + entity]) window['mock_' + entity] = loadFromLocalStorage('mock_' + entity, []);
                        let payload = args[0] || {};
                        if (!payload.id) payload.id = Date.now().toString();
                        
                        const idx = window['mock_' + entity].findIndex(x => x.id === payload.id);
                        if (idx !== -1) window['mock_' + entity][idx] = payload;
                        else window['mock_' + entity].push(payload);
                        
                        saveToLocalStorage('mock_' + entity, window['mock_' + entity]);
                        resolve({ success: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
                    } else if (action.startsWith('delete')) {
                        let entity = action.replace('delete', '');
                        if (entity === 'User') entity = 'Users';
                        else if (!entity.endsWith('s')) entity += 's';
                        
                        if (!window['mock_' + entity]) window['mock_' + entity] = loadFromLocalStorage('mock_' + entity, []);
                        if (window['mock_' + entity]) {
                            window['mock_' + entity] = window['mock_' + entity].filter(x => x.id !== args[0]);
                            saveToLocalStorage('mock_' + entity, window['mock_' + entity]);
                        }
                        resolve({ success: true, message: 'ลบข้อมูลเรียบร้อยแล้ว' });
                    } else if (action.startsWith('update') || action.startsWith('reject') || action.startsWith('approve')) {
                        resolve({ success: true, message: 'อัปเดตสถานะเรียบร้อยแล้ว' });
                    } else {
                        resolve({ success: true, message: 'ดำเนินการสำเร็จ (Mock Mode)', data: [] });
                    }
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
