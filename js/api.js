// Configuration for the Google Apps Script API
const CONFIG = {
    // Replace this URL with the Web App URL generated when you deploy Code.gs in Google Apps Script
    API_URL: 'https://script.google.com/macros/s/AKfycbyJi8hhxx-L_3xqokw_ceLcPPl5KPHMEU-Cqt1aIVjfIsGUZvRKsv6jitRvZGV_eFWx/exec'
};

// --- HIGH-PERFORMANCE CLIENT CACHE & SWR LAYER ---
const FAST_CACHE = {
    memory: {},
    PREFIX: 'mhc_budget_cache_',
    FRESH_TTL: 45 * 1000, // 45 seconds strictly fresh (0 network requests)
    MAX_TTL: 24 * 60 * 60 * 1000, // 24 hours SWR cache

    get(key) {
        const now = Date.now();
        // 1. Fast in-memory check (0ms)
        const mem = this.memory[key];
        if (mem && (now - mem.timestamp < this.MAX_TTL)) {
            return {
                data: mem.data,
                timestamp: mem.timestamp,
                isFresh: (now - mem.timestamp) < this.FRESH_TTL
            };
        }
        // 2. Persistent localStorage check (survives page refresh/browser restart)
        try {
            const raw = localStorage.getItem(this.PREFIX + key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (now - parsed.timestamp < this.MAX_TTL) {
                    this.memory[key] = parsed; // Sync to memory
                    return {
                        data: parsed.data,
                        timestamp: parsed.timestamp,
                        isFresh: (now - parsed.timestamp) < this.FRESH_TTL
                    };
                }
            }
        } catch (e) {}
        return null;
    },

    set(key, data) {
        const entry = { data: data, timestamp: Date.now() };
        this.memory[key] = entry;
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(entry));
        } catch (e) {}
    },

    touch(key) {
        const now = Date.now();
        if (this.memory[key]) {
            this.memory[key].timestamp = now;
            try {
                localStorage.setItem(this.PREFIX + key, JSON.stringify(this.memory[key]));
            } catch (e) {}
        }
    },

    invalidateAll() {
        this.memory = {};
        try {
            const toRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(this.PREFIX)) {
                    toRemove.push(k);
                }
            }
            toRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
    },

    invalidateEntity(entityName) {
        const lower = String(entityName).toLowerCase();
        Object.keys(this.memory).forEach(k => {
            const lk = k.toLowerCase();
            if (lk.includes(lower) || lk.includes('dashboard') || lk.includes('central') || lk.includes('tracking')) {
                delete this.memory[k];
            }
        });
        try {
            const toRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(this.PREFIX)) {
                    const lk = k.toLowerCase();
                    if (lk.includes(lower) || lk.includes('dashboard') || lk.includes('central') || lk.includes('tracking')) {
                        toRemove.push(k);
                    }
                }
            }
            toRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
    }
};

window.FAST_CACHE = FAST_CACHE;

// --- TOP PROGRESS BAR CONTROLLER ---
let activeRequestsCount = 0;
function startTopProgressBar() {
    if (typeof document === 'undefined') return;
    activeRequestsCount++;
    let bar = document.getElementById('top-progress-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'top-progress-bar';
        if (document.body) document.body.prepend(bar);
    }
    if (bar && bar.style) {
        if (bar.classList) bar.classList.add('loading');
        bar.style.opacity = '1';
        bar.style.width = '35%';
        setTimeout(() => {
            if (activeRequestsCount > 0 && bar && bar.style) {
                bar.style.width = '75%';
            }
        }, 250);
    }
}

function finishTopProgressBar() {
    if (typeof document === 'undefined') return;
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    if (activeRequestsCount === 0) {
        const bar = document.getElementById('top-progress-bar');
        if (bar && bar.style) {
            bar.style.width = '100%';
            setTimeout(() => {
                bar.style.opacity = '0';
                setTimeout(() => {
                    bar.style.width = '0%';
                    if (bar.classList) bar.classList.remove('loading');
                }, 300);
            }, 200);
        }
    }
}

// In-flight request deduplication map
const IN_FLIGHT_REQUESTS = new Map();

/**
 * Make an API call to the Google Apps Script backend with deduplication and timeout.
 * @param {string} action The function name to call in Apps Script
 * @param {object} payload The data to send
 * @returns {Promise<any>}
 */
async function apiCall(action, payload = {}) {
    const requestKey = action + '_' + JSON.stringify(payload);
    if (IN_FLIGHT_REQUESTS.has(requestKey)) {
        return IN_FLIGHT_REQUESTS.get(requestKey);
    }

    const fetchPromise = (async () => {
        startTopProgressBar();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                // text/plain avoids CORS preflight OPTIONS request
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({
                    action: action,
                    payload: payload
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === 'error') {
                throw new Error(data.message || 'API Error');
            }
            
            if (data.status === 'success' && typeof data.data === 'undefined') {
                throw new Error(`ฟังก์ชัน '${action}' ใน Code.gs ไม่ได้ส่งค่ากลับมา`);
            }
            
            return data.data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('การเชื่อมต่อเซิร์ฟเวอร์หมดเวลา (Timeout)');
            }
            console.error(`API Call failed (${action}):`, error);
            throw error;
        } finally {
            clearTimeout(timeoutId);
            finishTopProgressBar();
            IN_FLIGHT_REQUESTS.delete(requestKey);
        }
    })();

    IN_FLIGHT_REQUESTS.set(requestKey, fetchPromise);
    return fetchPromise;
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
                if (!window.mock_docTemplates) window.mock_docTemplates = loadFromLocalStorage('mock_docTemplates', []);
                if (data.id) {
                    const idx = window.mock_docTemplates.findIndex(d => String(d.id) === String(data.id));
                    if (idx !== -1) {
                        window.mock_docTemplates[idx] = { ...window.mock_docTemplates[idx], ...data };
                        saveToLocalStorage('mock_docTemplates', window.mock_docTemplates);
                        resolve({ success: true, message: 'แก้ไขแบบฟอร์มเรียบร้อยแล้ว' });
                        return;
                    }
                }
                const newDoc = {
                    id: Date.now().toString(),
                    name: data.name,
                    desc: data.desc,
                    url: data.url,
                    icon: data.icon || 'fas fa-file-word'
                };
                window.mock_docTemplates.push(newDoc);
                saveToLocalStorage('mock_docTemplates', window.mock_docTemplates);
                resolve({ success: true, message: 'บันทึกแบบฟอร์มเรียบร้อยแล้ว' });
            }, 300);
        });
    },

    deleteDocTemplate: async (id) => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (!window.mock_docTemplates) window.mock_docTemplates = loadFromLocalStorage('mock_docTemplates', []);
                window.mock_docTemplates = window.mock_docTemplates.filter(d => String(d.id) !== String(id));
                saveToLocalStorage('mock_docTemplates', window.mock_docTemplates);
                resolve({ success: true, message: 'ลบแบบฟอร์มเรียบร้อยแล้ว' });
            }, 300);
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
    if (typeof localStorage === 'undefined') return defaultVal;
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) {
        return defaultVal;
    }
}

function saveToLocalStorage(key, val) {
    if (typeof localStorage === 'undefined') return;
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

// Function to handle google.script.run calls with SWR caching, instant synchronous callback, and mutation bust
function handleGoogleScriptCall(action, args, successCallback, failureCallback) {
    const isRead = action.startsWith('get');
    const isMutation = !isRead && action !== 'loginUser';

    // 1. If mutation, invalidate client cache immediately
    if (isMutation) {
        FAST_CACHE.invalidateAll();
    }

    // 2. Fast Read Path with SWR (Stale-While-Revalidate)
    if (isRead) {
        const cacheKey = action + '_' + JSON.stringify(args);
        const cached = FAST_CACHE.get(cacheKey);

        if (cached) {
            // A. INSTANT SYNCHRONOUS RESOLUTION (0ms!)
            if (successCallback) {
                try {
                    successCallback({ success: true, data: cached.data });
                } catch (e) {
                    console.error(`Error in successCallback for cached ${action}:`, e);
                }
            }

            // B. If strictly fresh (< 45s), skip network entirely
            if (cached.isFresh) {
                return;
            }

            // C. Background silent revalidation for stale data
            API.call(action, ...args)
                .then(freshResult => {
                    const freshData = (freshResult && freshResult.data !== undefined) ? freshResult.data : freshResult;
                    const isDifferent = JSON.stringify(freshData) !== JSON.stringify(cached.data);
                    if (isDifferent) {
                        FAST_CACHE.set(cacheKey, freshData);
                        if (successCallback) {
                            try {
                                successCallback({ success: true, data: freshData });
                            } catch (e) {
                                console.error(`Error updating UI with fresh ${action}:`, e);
                            }
                        }
                    } else {
                        FAST_CACHE.touch(cacheKey);
                    }
                })
                .catch(err => {
                    console.warn(`Background revalidation failed (${action}):`, err);
                });
            return;
        }
    }

    // 3. Cold Fetch or Mutation / Login
    API.call(action, ...args)
        .then(result => {
            if (isRead) {
                const cacheKey = action + '_' + JSON.stringify(args);
                const dataToCache = (result && result.data !== undefined) ? result.data : result;
                FAST_CACHE.set(cacheKey, dataToCache);
            }
            if (successCallback) {
                successCallback(result);
            }
        })
        .catch(err => {
            console.error(`API Call failed (${action}):`, err);
            if (failureCallback) {
                failureCallback(err);
            } else if (typeof Swal !== 'undefined' && !action.startsWith('get')) {
                Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ' + err.message, 'error');
            }
        });
}

// Polyfill for google.script.run so all client JS operates seamlessly and lightning-fast!
window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = new Proxy({}, {
    get: function(target, prop) {
        if (prop === 'withSuccessHandler') {
            return function(callback) {
                let failureHandler = null;
                const innerProxy = new Proxy({}, {
                    get: function(t, action) {
                        if (action === 'withFailureHandler') {
                            return function(failCb) {
                                failureHandler = failCb;
                                return innerProxy;
                            };
                        }
                        return function(...args) {
                            handleGoogleScriptCall(action, args, callback, failureHandler);
                        };
                    }
                });
                return innerProxy;
            };
        }
        if (prop === 'withFailureHandler') {
            return function(failCb) {
                let successHandler = null;
                const innerProxy = new Proxy({}, {
                    get: function(t, action) {
                        if (action === 'withSuccessHandler') {
                            return function(succCb) {
                                successHandler = succCb;
                                return innerProxy;
                            };
                        }
                        return function(...args) {
                            handleGoogleScriptCall(action, args, successHandler, failCb);
                        };
                    }
                });
                return innerProxy;
            };
        }

        // Direct call without handlers (e.g. prefetch / fire-and-forget)
        return function(...args) {
            handleGoogleScriptCall(prop, args, null, null);
        };
    }
});
