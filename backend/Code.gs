/**
 * Google Apps Script Backend for Budget Management System
 * Deploy this script as a Web App: 
 * "Execute as: Me", "Who has access: Anyone"
 */

const CACHE_TTL_SECONDS = 300; // 5 minutes cache for read queries

function getScriptCache_(key) {
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    Logger.log('Cache read exception: ' + e);
  }
  return null;
}

function putScriptCache_(key, data) {
  try {
    const str = JSON.stringify(data);
    // Limit is 100KB per key in CacheService
    if (str.length < 95000) {
      CacheService.getScriptCache().put(key, str, CACHE_TTL_SECONDS);
    }
  } catch (e) {
    Logger.log('Cache put exception: ' + e);
  }
}

function invalidateAllScriptCache_() {
  try {
    const keys = [
      'getDashboardData',
      'getCentralBudgetData',
      'getBudgetTrackingData',
      'getReportSubmissions',
      'getTeacherReports',
      'getBudgetSources',
      'getMenuPermissions',
      'getBudgetTypes',
      'getDepartments',
      'getDocTemplates',
      'getAllocations',
      'getProjects',
      'getUtilities',
      'getProposals',
      'getDisbursements',
      'getUsers',
      'getAllUsers',
      'getNotifications'
    ];
    CacheService.getScriptCache().removeAll(keys);
  } catch (e) {
    Logger.log('Cache invalidate exception: ' + e);
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const payload = postData.payload || {};
    
    // 1. FAST SERVER-SIDE CACHE CHECK FOR READ ACTIONS
    const isRead = action.startsWith('get');
    const isSimpleGet = isRead && (!payload || Object.keys(payload).length === 0);
    const cacheKey = isSimpleGet ? action : (isRead ? action + '_' + Utilities.base64Encode(JSON.stringify(payload)).substring(0, 30) : null);
    
    if (isRead && cacheKey) {
      const cached = getScriptCache_(cacheKey);
      if (cached) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          data: cached
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    let result = {};
    if (typeof this[action] === 'function') {
      result = this[action].apply(this, Array.isArray(payload) ? payload : [payload]);
    } else {
      result = handleGenericAction(action, payload);
    }
    
    if (Array.isArray(result)) {
      result = { success: true, data: result };
    }
    
    // 2. INVALIDATE SERVER CACHE ON MUTATIONS, OR STORE ON READS
    if (!isRead && action !== 'loginUser') {
      invalidateAllScriptCache_();
    } else if (isRead && cacheKey && result && result.success !== false) {
      putScriptCache_(cacheKey, result);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Budget API is Running. Setup database by running setupDatabase() in the editor.' })).setMimeType(ContentService.MimeType.JSON);
}

// --- FIX SYSTEM (Run this to forcefully reset menus and roles) ---
function forceFixSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let mpSheet = ss.getSheetByName('MenuPermissions');
  if (mpSheet) {
    ss.deleteSheet(mpSheet);
  }
  setupDatabase(); // Recreate and seed MenuPermissions
  
  let userSheet = ss.getSheetByName('Users');
  if (userSheet) {
    let data = userSheet.getDataRange().getValues();
    let headers = data[0];
    let roleIdx = headers.indexOf('role');
    if (roleIdx !== -1) {
      for (let i = 1; i < data.length; i++) {
        let r = data[i][roleIdx];
        if (r) userSheet.getRange(i+1, roleIdx+1).setValue(String(r).trim().toUpperCase());
      }
    }
  }
}

/**
 * --- DATABASE SETUP ---
 * Run this function ONCE from the Apps Script Editor to generate the sheets
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Use Exact JSON keys used by Frontend for 1:1 mapping
  const schemas = {
    'Users': ['id', 'username', 'password', 'name', 'department', 'role'],
    'Allocations': ['id', 'date', 'budgetType', 'description', 'amount', 'recordedBy'],
    'Projects': ['id', 'name', 'budgetType', 'budget', 'used', 'proposedBy', 'status', 'reportStatus', 'reportNote', 'reportUpdatedBy', 'wordLink', 'pdfLink'],
    'Utilities': ['id', 'type', 'month', 'year', 'amount', 'budgetType', 'recordedBy'],
    'CentralBudget': ['id', 'date', 'description', 'amount'],
    'Proposals': ['id', 'name', 'objectives', 'budget', 'department', 'proposedBy', 'status', 'rejectReason', 'reviewedBy'],
    'Disbursements': ['id', 'projectId', 'projectName', 'purpose', 'amount', 'requestDate', 'requestedBy', 'status', 'rejectReason', 'reviewedBy', 'actualAmount'],
    'DocTemplates': ['id', 'name', 'desc', 'url', 'icon', 'uploadedBy'],
    'MenuPermissions': ['menuKey', 'menuName', 'ADMIN', 'EXECUTIVE', 'TEACHER'],
    'BudgetTypes': ['id', 'name'],
    'Departments': ['id', 'name', 'desc']
  };
  
  for (const sheetName in schemas) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    const headers = schemas[sheetName];
    // Overwrite the first row with correct headers
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
  }
  
  // Seed initial data if empty
  const pSheet = ss.getSheetByName('MenuPermissions');
  if (pSheet.getLastRow() <= 1) {
    const defaultPerms = [
      ['dashboard', 'ภาพรวม (Dashboard)', true, true, true],
      ['doctemplates', 'รูปแบบไฟล์ขออนุญาต', true, true, true],
      ['settings', 'ตั้งค่าข้อมูลพื้นฐาน', true, false, false],
      ['allocation', 'จัดสรรงบประมาณ', true, false, false],
      ['projects', 'สร้างโครงการ/กิจกรรม', true, false, false],
      ['utilities', 'บันทึกค่าสาธารณูปโภค', true, false, false],
      ['central-budget', 'วิเคราะห์การใช้งบกลาง', true, true, true],
      ['proposals', 'การเสนอโครงการ', true, true, true],
      ['reports', 'รายงานโครงการ', true, true, true],
      ['report-submissions', 'ติดตามการส่งรายงาน', true, true, true],
      ['tracking', 'ติดตามการใช้จ่ายงบฯ', true, true, true],
      ['disbursements', 'อนุมัติเบิกจ่าย', true, true, false]
    ];
    pSheet.getRange(2, 1, defaultPerms.length, 5).setValues(defaultPerms);
  }
  
  const dSheet = ss.getSheetByName('DocTemplates');
  if (dSheet.getLastRow() <= 1) {
    const defaultDocs = [
      ['1', 'แบบฟอร์มขออนุมัติโครงการ', 'ดาวน์โหลดไปแก้ไขสำหรับเสนอโครงการ', '#', 'fas fa-file-word'],
      ['2', 'ตัวอย่างโครงการ', 'ไฟล์ตัวอย่างโครงการที่สมบูรณ์', '#', 'fas fa-file-pdf'],
      ['3', 'แบบฟอร์มเบิกจ่าย', 'ใช้เมื่อต้องการเบิกจ่ายงบประมาณ', '#', 'fas fa-money-check-alt']
    ];
    dSheet.getRange(2, 1, defaultDocs.length, 5).setValues(defaultDocs);
  }

  const uSheet = ss.getSheetByName('Users');
  if (uSheet.getLastRow() <= 1) {
    uSheet.appendRow(['u1', 'admin', '1234', 'ผู้ดูแลระบบสูงสุด', 'ผู้บริหาร', 'ADMIN']);
    uSheet.appendRow(['u2', 'boss', '1234', 'ผอ.โรงเรียน', 'ผู้บริหาร', 'EXECUTIVE']);
    uSheet.appendRow(['u3', 'kru', '1234', 'คุณครูสมศรี', 'วิชาการ', 'TEACHER']);
  }
  
  SpreadsheetApp.getUi().alert('สร้างฐานข้อมูลจำลอง (Schema) เรียบร้อยแล้ว!');
}

/**
 * --- CUSTOM API ROUTE HANDLERS ---
 */
function loginUser(username, password) {
  if (typeof username === 'object') {
    password = username.password;
    username = username.username;
  }
  const users = handleGenericAction('getUsers', {});
  const user = users.find(u => String(u.username) === String(username) && String(u.password) === String(password));
  if (user) return { success: true, user: user };
  return { success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' };
}

function approveDisbursement(id, updatedBy, actualAmount) {
  const disbs = handleGenericAction('getDisbursements', {});
  const disb = disbs.find(d => String(d.id) === String(id));
  if (disb) {
    disb.status = 'อนุมัติแล้ว';
    disb.reviewedBy = updatedBy || '';
    disb.actualAmount = actualAmount || disb.amount;
    handleGenericAction('saveDisbursement', disb);
    
    // Update project
    if (disb.projectId) {
      const projs = handleGenericAction('getProjects', {});
      const proj = projs.find(p => String(p.id) === String(disb.projectId));
      if (proj) {
        proj.used = (parseFloat(proj.used) || 0) + parseFloat(disb.actualAmount);
        handleGenericAction('saveProject', proj);
      }
    }
  }
  return { success: true, message: 'อนุมัติเรียบร้อยแล้ว' };
}

function rejectDisbursement(id, reason, updatedBy) {
  const disbs = handleGenericAction('getDisbursements', {});
  const disb = disbs.find(d => String(d.id) === String(id));
  if (disb) {
    disb.status = 'ไม่อนุมัติ';
    disb.rejectReason = reason || '';
    disb.reviewedBy = updatedBy || '';
    handleGenericAction('saveDisbursement', disb);
  }
  return { success: true, message: 'ปฏิเสธเรียบร้อยแล้ว' };
}

function updateProposalStatus(id, status, reason, updatedBy) {
  const props = handleGenericAction('getProposals', {});
  const prop = props.find(p => String(p.id) === String(id));
  if (prop) {
    prop.status = status;
    prop.rejectReason = reason || '';
    prop.reviewedBy = updatedBy || '';
    handleGenericAction('saveProposal', prop);
    
    if (status === 'อนุมัติ') {
      const newProject = {
        id: prop.id, name: prop.name, budgetType: prop.department, budget: prop.budget,
        used: 0, proposedBy: prop.proposedBy || 'ไม่ระบุ', status: 'ดำเนินการ'
      };
      handleGenericAction('saveProject', newProject);
    }
  }
  return { success: true, message: 'อัปเดตสถานะเรียบร้อยแล้ว' };
}

function updateReportStatus(projectId, newStatus, note, updatedBy, wordLink, pdfLink) {
  const projs = handleGenericAction('getProjects', {});
  const proj = projs.find(p => String(p.id) === String(projectId));
  if (proj) {
    proj.reportStatus = newStatus;
    proj.reportNote = note || '';
    proj.reportUpdatedBy = updatedBy || '';
    if (wordLink !== undefined) proj.wordLink = wordLink;
    if (pdfLink !== undefined) proj.pdfLink = pdfLink;
    handleGenericAction('saveProject', proj);
  }
  return { success: true, message: 'อัปเดตสถานะรายงานเรียบร้อยแล้ว' };
}

function getBudgetTypes() {
  const types = handleGenericAction('getBudgetTypes', {});
  const allocations = handleGenericAction('getAllocations', {});
  const projects = handleGenericAction('getProjects', {});
  const utils = handleGenericAction('getUtilities', {});
  
  const typeMap = {};
  
  allocations.forEach(a => {
    let amt = parseFloat(a.amount || 0);
    const bt = a.budgetType || 'ไม่ระบุ';
    if (!typeMap[bt]) typeMap[bt] = { received: 0, used: 0, remain: 0 };
    typeMap[bt].received += amt;
  });
  
  projects.forEach(p => {
    if (p.status !== 'ไม่อนุมัติ') {
      let amt = parseFloat(p.budget || 0);
      const bt = p.budgetType || 'ไม่ระบุ';
      if (!typeMap[bt]) typeMap[bt] = { received: 0, used: 0, remain: 0 };
      typeMap[bt].used += amt;
    }
  });

  utils.forEach(u => {
    let amt = parseFloat(u.amount || 0);
    const bt = u.type || 'ไม่ระบุ'; // Assuming u.type is budgetType
    if (!typeMap[bt]) typeMap[bt] = { received: 0, used: 0, remain: 0 };
    typeMap[bt].used += amt;
  });
  
  const enriched = types.map(t => {
    const stats = typeMap[t.name] || { received: 0, used: 0, remain: 0 };
    return {
      id: t.id,
      name: t.name,
      received: stats.received,
      used: stats.used,
      remain: stats.received - stats.used
    };
  });
  
  return { success: true, data: enriched };
}

function getDashboardData() {
  const projects = handleGenericAction('getProjects', {});
  const allocations = handleGenericAction('getAllocations', {});
  
  const types = handleGenericAction('getBudgetTypes', {});
  const utils = handleGenericAction('getUtilities', {});
  
  let totalBudget = 0, usedBudget = 0, reserveBudget = 0;
  const typeMap = {};
  
  allocations.forEach(a => {
    let amt = parseFloat(a.amount || 0);
    totalBudget += amt;
    const bt = a.budgetType || 'ไม่ระบุ';
    if (!typeMap[bt]) typeMap[bt] = { received: 0, used: 0, remain: 0 };
    typeMap[bt].received += amt;
  });
  
  projects.forEach(p => {
    if (p.status !== 'ไม่อนุมัติ') {
      let amt = parseFloat(p.budget || 0);
      usedBudget += amt;
      const bt = p.budgetType || 'ไม่ระบุ';
      if (!typeMap[bt]) typeMap[bt] = { received: 0, used: 0, remain: 0 };
      typeMap[bt].used += amt;
    }
  });

  utils.forEach(u => {
    let amt = parseFloat(u.amount || 0);
    usedBudget += amt;
    const bt = u.budgetType || u.type || 'ไม่ระบุ';
    if (!typeMap[bt]) typeMap[bt] = { received: 0, used: 0, remain: 0 };
    typeMap[bt].used += amt;
  });
  
  const typeDetails = types.map(t => {
    const stats = typeMap[t.name] || { received: 0, used: 0, remain: 0 };
    return {
      name: t.name,
      received: stats.received,
      used: stats.used,
      remain: stats.received - stats.used
    };
  });
  
  const formattedProjects = projects.map(p => ({
    status: p.status || 'รออนุมัติ',
    name: p.name,
    budget: parseFloat(p.budget || 0),
    used: parseFloat(p.used || 0),
    pct: parseFloat(p.budget || 0) > 0 ? (parseFloat(p.used || 0) / parseFloat(p.budget)) * 100 : 0
  }));
  
  return {
    success: true,
    data: {
      summary: {
        total: totalBudget,
        used: usedBudget,
        reserve: reserveBudget,
        remain: totalBudget - usedBudget - reserveBudget
      },
      typeDetails: typeDetails,
      projects: formattedProjects
    }
  };
}

/**
 * --- GENERIC CRUD ROUTER ---
 */
function handleGenericAction(action, payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // GET
  if (action.startsWith('get')) {
    let sheetName = action.replace('get', '');
    if (sheetName === 'AllUsers') sheetName = 'Users';
    if (!sheetName.endsWith('s') && sheetName !== 'CentralBudget' && sheetName !== 'MenuPermissions') sheetName += 's';
    
    let targetSheet = ss.getSheetByName(sheetName);
    if (!targetSheet) return [];
    
    const data = targetSheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const result = [];
    for (let i = 1; i < data.length; i++) {
      let obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      
      // Safety fallbacks for undefined status
      if (['Disbursements', 'Proposals', 'Projects'].includes(sheetName) && !obj.status) {
         obj.status = (sheetName === 'Disbursements') ? 'รออนุมัติ' : 'รอพิจารณา';
      }
      result.push(obj);
    }
    return result;
  }
  
  // SAVE (Insert or Update)
  if (action.startsWith('save')) {
    let sheetName = action.replace('save', '');
    if (sheetName === 'User') sheetName = 'Users';
    else if (!sheetName.endsWith('s') && sheetName !== 'CentralBudget' && sheetName !== 'MenuPermissions') sheetName += 's';
    
    let targetSheet = ss.getSheetByName(sheetName);
    if (!targetSheet) return { success: false, error: 'Table not found: ' + sheetName };
    
    let obj = Array.isArray(payload) ? payload[0] : payload;
    if (!obj.id && sheetName !== 'MenuPermissions') obj.id = new Date().getTime().toString();
    
    const data = targetSheet.getDataRange().getValues();
    const headers = data[0];
    const rowData = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
    
    // Check for existing ID to UPDATE
    let updated = false;
    if (obj.id) {
       for (let i = 1; i < data.length; i++) {
         if (String(data[i][0]) === String(obj.id)) {
           targetSheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
           updated = true;
           break;
         }
       }
    } else if (sheetName === 'MenuPermissions' && obj.menuKey) {
       for (let i = 1; i < data.length; i++) {
         if (String(data[i][0]) === String(obj.menuKey)) {
           targetSheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
           updated = true;
           break;
         }
       }
    }
    
    if (!updated) {
       targetSheet.appendRow(rowData);
    }
    
    return { success: true, message: 'บันทึกสำเร็จ' };
  }
  
  // DELETE
  if (action.startsWith('delete')) {
    let sheetName = action.replace('delete', '');
    if (sheetName === 'User') sheetName = 'Users';
    else if (!sheetName.endsWith('s')) sheetName += 's';
    
    let targetSheet = ss.getSheetByName(sheetName);
    if (!targetSheet) return { success: false, error: 'Table not found' };
    
    const data = targetSheet.getDataRange().getValues();
    const idToDelete = Array.isArray(payload) ? payload[0] : payload;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idToDelete)) {
        targetSheet.deleteRow(i + 1);
        return { success: true, message: 'ลบข้อมูลสำเร็จ' };
      }
    }
    return { success: false, error: 'ไม่พบข้อมูลที่ต้องการลบ' };
  }
  
  throw new Error('Action ' + action + ' is not implemented yet.');
}

// ==========================================
// MISSING CUSTOM ENDPOINTS FOR 100% FUNCTIONALITY
// ==========================================

function getCentralBudgetData() {
  const projects = handleGenericAction('getProjects', {});
  const utils = handleGenericAction('getUtilities', {});
  const allocations = handleGenericAction('getAllocations', {});
  
  let totalBudget = 0, usedBudget = 0, reserveBudget = 0;
  
  allocations.forEach(a => {
    totalBudget += parseFloat(a.amount || 0);
  });
  
  const formattedProjects = [];
  projects.forEach(p => {
    if (p.status !== 'ไม่อนุมัติ') {
      let budget = parseFloat(p.budget || 0);
      let used = parseFloat(p.used || 0);
      usedBudget += budget;
      formattedProjects.push({
        name: p.name,
        allocated: budget,
        totalUsed: used,
        overAmount: used > budget ? used - budget : 0
      });
    }
  });

  utils.forEach(u => {
    reserveBudget += parseFloat(u.amount || 0);
  });
  
  return {
    success: true,
    data: {
      summary: {
        total: totalBudget,
        used: usedBudget,
        reserve: reserveBudget,
        remain: totalBudget - usedBudget - reserveBudget
      },
      projects: formattedProjects,
      utils: utils
    }
  };
}

function getBudgetTrackingData() {
  const allocations = handleGenericAction('getAllocations', {});
  const projects = handleGenericAction('getProjects', {});
  const utils = handleGenericAction('getUtilities', {});
  
  let transactions = [];
  
  allocations.forEach(a => {
    transactions.push({
      date: a.date || '-',
      type: 'รับจัดสรร',
      category: a.budgetType || 'ไม่ระบุ',
      description: a.description || 'รับงบประมาณ',
      amountIn: parseFloat(a.amount || 0),
      amountOut: 0
    });
  });

  projects.forEach(p => {
    if (p.status !== 'ไม่อนุมัติ') {
      transactions.push({
        date: p.date || '-',
        type: 'จ่ายออก',
        category: p.budgetType || 'ไม่ระบุ',
        description: `โครงการ: ${p.name}`,
        amountIn: 0,
        amountOut: parseFloat(p.budget || 0)
      });
    }
  });

  utils.forEach(u => {
    transactions.push({
      date: `${u.month || '-'}/${u.year || '-'}`,
      type: 'จ่ายออก',
      category: u.budgetType || u.type || 'ไม่ระบุ',
      description: `สาธารณูปโภค: ${u.type}`,
      amountIn: 0,
      amountOut: parseFloat(u.amount || 0)
    });
  });

  transactions.sort((a, b) => (b.date > a.date ? 1 : -1));
  
  // Minimal budgetSummary just to satisfy frontend map mapping
  // We can fetch from getDashboardData since it has typeDetails
  const dash = getDashboardData();

  return {
    success: true,
    data: {
      budgetSummary: dash.data.typeDetails || [],
      transactions: transactions
    }
  };
}

function getReportSubmissions() {
  const projects = handleGenericAction('getProjects', {});
  const data = projects.map(p => ({
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
  return { success: true, data: data };
}

function updateReportStatus(projectId, newStatus, note, updatedBy, wordLink, pdfLink) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Projects');
  if (!sheet) return { success: false, message: 'ไม่พบฐานข้อมูล Projects' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  const statusIdx = headers.indexOf('reportStatus');
  const noteIdx = headers.indexOf('reportNote');
  const byIdx = headers.indexOf('reportUpdatedBy');
  const wordIdx = headers.indexOf('wordLink');
  const pdfIdx = headers.indexOf('pdfLink');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(projectId)) {
      if (statusIdx !== -1) sheet.getRange(i+1, statusIdx+1).setValue(newStatus);
      if (noteIdx !== -1) sheet.getRange(i+1, noteIdx+1).setValue(note || '');
      if (byIdx !== -1) sheet.getRange(i+1, byIdx+1).setValue(updatedBy || '');
      if (wordIdx !== -1 && wordLink !== undefined) sheet.getRange(i+1, wordIdx+1).setValue(wordLink);
      if (pdfIdx !== -1 && pdfLink !== undefined) sheet.getRange(i+1, pdfIdx+1).setValue(pdfLink);
      return { success: true, message: 'อัปเดตสถานะรายงานเรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบโครงการที่ระบุ' };
}

function updateProposalStatus(id, status, reason, updatedBy) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Proposals');
  if (!sheet) return { success: false, message: 'ไม่พบฐานข้อมูล Proposals' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  
  let targetProposal = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      targetProposal = {};
      headers.forEach((h, j) => targetProposal[h] = data[i][j]);
      
      const stIdx = headers.indexOf('status');
      const rIdx = headers.indexOf('rejectReason');
      const bIdx = headers.indexOf('reviewedBy');
      
      if (stIdx !== -1) sheet.getRange(i+1, stIdx+1).setValue(status);
      if (rIdx !== -1) sheet.getRange(i+1, rIdx+1).setValue(reason || '');
      if (bIdx !== -1) sheet.getRange(i+1, bIdx+1).setValue(updatedBy || '');
      break;
    }
  }
  
  // If approved, create a Project automatically
  if (targetProposal && status === 'อนุมัติ') {
    const projSheet = ss.getSheetByName('Projects');
    if (projSheet) {
      const pHeaders = projSheet.getDataRange().getValues()[0];
      const newRow = pHeaders.map(h => {
        if (h === 'id') return new Date().getTime().toString();
        if (h === 'name') return targetProposal.name;
        if (h === 'budgetType') return 'งบกลาง';
        if (h === 'budget') return targetProposal.budget;
        if (h === 'used') return 0;
        if (h === 'proposedBy') return targetProposal.proposedBy;
        if (h === 'status') return 'รอพิจารณา'; // initial project status
        return '';
      });
      projSheet.appendRow(newRow);
    }
  }
  
  return { success: true, message: 'อัปเดตสถานะการอนุมัติเรียบร้อยแล้ว' };
}

function approveDisbursement(id, updatedBy, actualAmount) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Disbursements');
  if (!sheet) return { success: false, message: 'ไม่พบฐานข้อมูล Disbursements' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  
  let projectId = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      const stIdx = headers.indexOf('status');
      const bIdx = headers.indexOf('reviewedBy');
      const amIdx = headers.indexOf('actualAmount');
      const pIdIdx = headers.indexOf('projectId');
      
      if (stIdx !== -1) sheet.getRange(i+1, stIdx+1).setValue('อนุมัติแล้ว');
      if (bIdx !== -1) sheet.getRange(i+1, bIdx+1).setValue(updatedBy || '');
      
      let finalAmt = actualAmount;
      if (amIdx !== -1) {
        if (!finalAmt) finalAmt = data[i][headers.indexOf('amount')];
        sheet.getRange(i+1, amIdx+1).setValue(finalAmt);
      }
      if (pIdIdx !== -1) projectId = data[i][pIdIdx];
      
      // Update Project used amount
      if (projectId) {
        const projSheet = ss.getSheetByName('Projects');
        if (projSheet) {
          const pData = projSheet.getDataRange().getValues();
          const pH = pData[0];
          const pIdCol = pH.indexOf('id');
          const pUsedCol = pH.indexOf('used');
          if (pIdCol !== -1 && pUsedCol !== -1) {
            for (let k = 1; k < pData.length; k++) {
              if (String(pData[k][pIdCol]) === String(projectId)) {
                let currentUsed = parseFloat(pData[k][pUsedCol] || 0);
                projSheet.getRange(k+1, pUsedCol+1).setValue(currentUsed + parseFloat(finalAmt || 0));
                break;
              }
            }
          }
        }
      }
      return { success: true, message: 'อนุมัติเบิกจ่ายและหักยอดแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบคำขอเบิกจ่าย' };
}

function rejectDisbursement(id, reason, updatedBy) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Disbursements');
  if (!sheet) return { success: false, message: 'ไม่พบฐานข้อมูล Disbursements' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      const stIdx = headers.indexOf('status');
      const rIdx = headers.indexOf('rejectReason');
      const bIdx = headers.indexOf('reviewedBy');
      
      if (stIdx !== -1) sheet.getRange(i+1, stIdx+1).setValue('ไม่อนุมัติ');
      if (rIdx !== -1) sheet.getRange(i+1, rIdx+1).setValue(reason || '');
      if (bIdx !== -1) sheet.getRange(i+1, bIdx+1).setValue(updatedBy || '');
      return { success: true, message: 'ปฏิเสธคำขอเบิกจ่ายแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบคำขอเบิกจ่าย' };
}
