// ============================================================
//  RCA Toolkit – app.js  (FIXED: data loss on delete/add)
//  All 7 templates, user profile, version history, PWA, cloud sync
// ============================================================

// ---------- IndexedDB Setup ----------
let db;
const DB_NAME = 'rca_toolkit_db';
const STORE_TEMPLATES = 'templates';
const STORE_USER = 'user';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: 'templateName' });
      }
      if (!db.objectStoreNames.contains(STORE_USER)) {
        db.createObjectStore(STORE_USER, { keyPath: 'key' });
      }
    };
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

// ---------- User Profile (name, logo, dark mode) ----------
async function getUserProfile() {
  if (!db) await openDB();
  const tx = db.transaction(STORE_USER, 'readonly');
  const store = tx.objectStore(STORE_USER);
  const getReq = store.get('profile');
  return new Promise((resolve) => {
    getReq.onsuccess = () => resolve(getReq.result || {});
    getReq.onerror = () => resolve({});
  });
}

async function saveUserProfile(updates) {
  if (!db) await openDB();
  const profile = await getUserProfile();
  Object.assign(profile, updates);
  const tx = db.transaction(STORE_USER, 'readwrite');
  const store = tx.objectStore(STORE_USER);
  store.put({ key: 'profile', ...profile });
  return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function loadUserDisplay() {
  const profile = await getUserProfile();
  document.getElementById('globalUserName').value = profile.name || '';
  if (profile.logoBase64) {
    const img = document.getElementById('userLogo');
    img.src = profile.logoBase64;
    img.style.display = 'block';
  }
  if (profile.darkMode) {
    document.body.classList.add('dark');
  }
  document.querySelectorAll('.signature-name-display').forEach(el => {
    el.textContent = profile.name || '________________________';
  });
}

async function saveUserName() {
  const name = document.getElementById('globalUserName').value.trim();
  await saveUserProfile({ name });
  document.querySelectorAll('.signature-name-display').forEach(el => {
    el.textContent = name || '________________________';
  });
}

function uploadLogo() { document.getElementById('logoUpload').click(); }

async function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    await saveUserProfile({ logoBase64: base64 });
    const img = document.getElementById('userLogo');
    img.src = base64;
    img.style.display = 'block';
    showToast('Logo updated');
  };
  reader.readAsDataURL(file);
}

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  saveUserProfile({ darkMode: document.body.classList.contains('dark') });
}

// ---------- Template Data & Version History ----------
function getDefaultData() {
  return {
    '5why': {
      problem: '',
      whys: ['', '', '', '', ''],
      rootCause: '',
      correctiveAction: '',
      date: new Date().toISOString().split('T')[0],
      equipment: '',
      lab: ''
    },
    'fishbone': {
      problem: '',
      categories: {
        'Man': ['', '', ''],
        'Machine': ['', '', ''],
        'Material': ['', '', ''],
        'Method': ['', '', ''],
        'Environment': ['', '', ''],
        'Measurement': ['', '', '']
      },
      date: new Date().toISOString().split('T')[0]
    },
    'a3': {
      title: '',
      background: '',
      currentState: '',
      goal: '',
      rootCauseAnalysis: '',
      countermeasures: '',
      checkResults: '',
      followUp: '',
      date: new Date().toISOString().split('T')[0]
    },
    'timeline': {
      problem: '',
      events: [
        { time: '', description: '' },
        { time: '', description: '' },
        { time: '', description: '' },
        { time: '', description: '' }
      ],
      date: new Date().toISOString().split('T')[0]
    },
    'matrix': {
      problem: '',
      rows: [
        { cause: '', severity: '3', occurrence: '3', detection: '3' },
        { cause: '', severity: '3', occurrence: '3', detection: '3' },
        { cause: '', severity: '3', occurrence: '3', detection: '3' },
        { cause: '', severity: '3', occurrence: '3', detection: '3' }
      ],
      date: new Date().toISOString().split('T')[0]
    },
    'checklist': {
      problem: '',
      items: [
        { question: 'Safety confirmed — equipment isolated and safe to work on?', checked: false, notes: '' },
        { question: 'Error codes documented before clearing?', checked: false, notes: '' },
        { question: 'Operator interviewed about last actions before failure?', checked: false, notes: '' },
        { question: 'External factors ruled out (power, water, reagents, environment)?', checked: false, notes: '' },
        { question: '5-Why or Fishbone analysis completed?', checked: false, notes: '' },
        { question: 'Root cause distinguished from contributing factors?', checked: false, notes: '' },
        { question: 'Corrective action verified with QC?', checked: false, notes: '' },
        { question: 'PM checklist updated to prevent recurrence?', checked: false, notes: '' },
        { question: 'Finding communicated to lab manager?', checked: false, notes: '' },
        { question: 'Case documented in failure library?', checked: false, notes: '' }
      ],
      date: new Date().toISOString().split('T')[0]
    },
    'problemsolve': {
      problem: '',
      possibleCauses: ['', '', ''],
      possibleSolutions: ['', '', ''],
      solution: '',
      date: new Date().toISOString().split('T')[0]
    }
  };
}

async function getTemplateRecord(templateName) {
  if (!db) await openDB();
  const tx = db.transaction(STORE_TEMPLATES, 'readonly');
  const store = tx.objectStore(STORE_TEMPLATES);
  const getReq = store.get(templateName);
  return new Promise((resolve) => {
    getReq.onsuccess = () => {
      if (getReq.result) {
        resolve(getReq.result);
      } else {
        const defaultRec = {
          templateName,
          versions: [],
          current: getDefaultData()[templateName]
        };
        resolve(defaultRec);
      }
    };
    getReq.onerror = () => {
      resolve({
        templateName,
        versions: [],
        current: getDefaultData()[templateName]
      });
    };
  });
}

// Immediate save (no delay)
async function saveNow(templateName, data) {
  await saveTemplateSnapshot(templateName, data);
}

// Normal save with version snapshot
async function saveTemplateSnapshot(templateName, newData) {
  if (!db) await openDB();
  const record = await getTemplateRecord(templateName);
  record.versions.push({
    timestamp: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(newData))
  });
  if (record.versions.length > 50) record.versions.shift();
  record.current = newData;
  const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
  const store = tx.objectStore(STORE_TEMPLATES);
  store.put(record);
  return new Promise((resolve) => { tx.oncomplete = resolve; });
}

// 🛡️ FIX: flush any pending auto-save before deleting/adding
async function flushPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    await saveTemplateSnapshot(currentTab, currentData);
  }
}

async function restoreVersion(templateName, versionIndex) {
  const record = await getTemplateRecord(templateName);
  if (versionIndex >= 0 && versionIndex < record.versions.length) {
    record.current = JSON.parse(JSON.stringify(record.versions[versionIndex].data));
    const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORE_TEMPLATES);
    store.put(record);
    await new Promise(r => { tx.oncomplete = r; });
    renderTemplate(templateName);
    showToast('Version restored');
  }
}

async function showVersionHistory(templateName) {
  const record = await getTemplateRecord(templateName);
  let list = '';
  record.versions.slice().reverse().forEach((v, i) => {
    const idx = record.versions.length - 1 - i;
    list += `
      <div style="border-bottom:1px solid var(--border2); padding:0.5rem 0; display:flex; justify-content:space-between; align-items:center;">
        <span>${new Date(v.timestamp).toLocaleString()}</span>
        <button class="btn btn-sm btn-outline" onclick="restoreVersion('${templateName}', ${idx})">Restore</button>
      </div>`;
  });
  if (!list) list = '<p>No saved versions yet.</p>';
  document.getElementById('modalContent').innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>📜 Version History: ${templateName}</h3>
    ${list}
  `;
  document.getElementById('modalOverlay').style.display = 'flex';
}

// ---------- Current Tab State ----------
let currentTab = '5why';
let currentData = null;

// ---------- UI Helpers ----------
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// ---------- Modal & Help ----------
function openHelpModal(methodKey) {
  const help = getHelpContent(methodKey);
  document.getElementById('modalContent').innerHTML = `
    <button class="modal-close" onclick="closeModal()">✕</button>
    ${help}
  `;
  document.getElementById('modalOverlay').style.display = 'flex';
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').style.display = 'none';
}
function getHelpContent(key) {
  const guides = {
    '5why': `<h3>❓ 5-Why Analysis</h3><p>Drill down from symptom to root cause by asking "Why?" repeatedly.</p><p><b>When:</b> Linear problems with a single root cause.</p><p><b>Example:</b> Centrifuge tripping breaker → motor drawing excess current → bearing worn → lubrication dried out → PM schedule missed → no automated PM reminder system.</p>`,
    'fishbone': `<h3>🐟 Fishbone (Ishikawa)</h3><p>Brainstorm causes across 6 categories: Man, Machine, Material, Method, Environment, Measurement.</p><p><b>When:</b> Complex problems with multiple possible causes.</p>`,
    'a3': `<h3>📋 A3 Report</h3><p>One-page structured problem solving: Background → Current State → Goal → Root Cause → Countermeasures → Check → Follow-up.</p>`,
    'timeline': `<h3>🕐 Timeline</h3><p>Map events chronologically to spot triggers and patterns.</p>`,
    'matrix': `<h3>📊 Cause & Effect Matrix (FMEA-style)</h3><p>Score causes by Severity, Occurrence, Detection. RPN = S×O×D. Focus on highest RPN first.</p>`,
    'checklist': `<h3>✅ Quick RCA Checklist</h3><p>10-step verification before closing a service call.</p>`,
    'problemsolve': `<h3>🧠 Problem Solving Steps</h3><p>Simple structure: Problem → Possible Causes → Possible Solutions → Chosen Solution.</p>`
  };
  return guides[key] || '';
}

// ---------- Cloud Sync to GitHub Gist ----------
async function backupToGist() {
  const profile = await getUserProfile();
  let token = profile.gistToken;
  let gistId = profile.gistId;

  if (!token) {
    token = prompt('Enter your GitHub personal access token (must have gist scope):');
    if (!token) return;
    await saveUserProfile({ gistToken: token });
  }

  const templateNames = ['5why','fishbone','a3','timeline','matrix','checklist','problemsolve'];
  const allData = {};
  for (const name of templateNames) {
    const record = await getTemplateRecord(name);
    allData[name] = record.current;
  }
  const content = JSON.stringify(allData, null, 2);

  const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
  const method = gistId ? 'PATCH' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'RCA Toolkit Backup',
        public: false,
        files: { 'rca_backup.json': { content } }
      })
    });
    const result = await response.json();
    if (response.ok) {
      if (!gistId) {
        await saveUserProfile({ gistId: result.id });
        showToast('✅ Gist created & data synced');
      } else {
        showToast('✅ Gist updated');
      }
    } else {
      showToast('⚠️ Sync failed: ' + result.message);
    }
  } catch (e) {
    showToast('⚠️ Network error');
  }
}

// ---------- Export / Import ----------
async function exportAllData() {
  const templateNames = ['5why','fishbone','a3','timeline','matrix','checklist','problemsolve'];
  const allData = {};
  for (const name of templateNames) {
    const record = await getTemplateRecord(name);
    allData[name] = record.current;
  }
  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rca_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Exported');
}

function importAllData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        for (const [key, value] of Object.entries(data)) {
          await saveNow(key, value);
        }
        showToast('📤 Imported');
        renderTemplate(currentTab);
      } catch (err) {
        showToast('⚠️ Invalid file');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ---------- Clear current template ----------
async function clearCurrentTemplate() {
  if (!confirm('Clear all data in this template? This cannot be undone.')) return;
  const defaultData = getDefaultData()[currentTab];
  await saveNow(currentTab, defaultData);
  renderTemplate(currentTab, defaultData);
  showToast('🗑️ Template cleared');
}

// ---------- Print current template ----------
function printCurrentTemplate() { window.print(); }

// ---------- Auto-save after edits (for typing) ----------
let saveTimeout;
function autoSave(templateName, data) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await saveTemplateSnapshot(templateName, data);
  }, 800);
}

// 🖐️ Manual save button
async function manualSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  await saveTemplateSnapshot(currentTab, currentData);
  const indicator = document.getElementById('saveIndicator');
  if (indicator) {
    indicator.textContent = '💾 Saved manually';
    setTimeout(() => { indicator.textContent = '💾 Auto-saved'; }, 2000);
  }
}

// ---------- Render a template (all 7 types) ----------
async function renderTemplate(key, preloadedData = null) {
  currentTab = key;

  if (preloadedData) {
    currentData = preloadedData;
  } else {
    const record = await getTemplateRecord(key);
    currentData = record.current;
  }

  const profile = await getUserProfile();

  const titleMap = {
    '5why': '❓ 5-Why Analysis',
    'fishbone': '🐟 Fishbone / Ishikawa Diagram',
    'a3': '📋 A3 Problem Solving Report',
    'timeline': '🕐 Timeline / Chronology Analysis',
    'matrix': '📊 Cause & Effect Matrix (FMEA-style)',
    'checklist': '✅ Quick RCA Checklist',
    'problemsolve': '🧠 Problem Solving Steps'
  };

  let html = `
    <div class="template-header">
      <h2>${titleMap[key]}
        <button class="help-btn" onclick="openHelpModal('${key}')">?</button>
        <button class="btn btn-sm btn-outline" onclick="showVersionHistory('${key}')" style="margin-left:0.5rem;">📜 History</button>
      </h2>
      <div class="template-actions">
        <span class="save-indicator" id="saveIndicator" onclick="manualSave()" style="cursor:pointer;" title="Click to save immediately">💾 Auto-saved</span>
        <button class="btn btn-outline btn-sm" onclick="printCurrentTemplate()">🖨️ Print</button>
        <button class="btn btn-danger btn-sm" onclick="clearCurrentTemplate()">🗑️ Clear</button>
      </div>
    </div>
    <div class="template-body">
  `;

  switch (key) {
    case '5why':
      html += render5Why(currentData);
      break;
    case 'fishbone':
      html += renderFishbone(currentData);
      break;
    case 'a3':
      html += renderA3(currentData);
      break;
    case 'timeline':
      html += renderTimeline(currentData);
      break;
    case 'matrix':
      html += renderMatrix(currentData);
      break;
    case 'checklist':
      html += renderChecklist(currentData);
      break;
    case 'problemsolve':
      html += renderProblemSolve(currentData);
      break;
  }

  // Signature block (only visible when printing)
  html += `
    <div class="signature-block">
      ${profile.logoBase64 ? `<img src="${profile.logoBase64}" style="max-height:50px; margin-bottom:0.5rem;">` : ''}
      <p><strong>Prepared by:</strong> <span class="signature-name-display">${escHtml(profile.name) || '________________________'}</span></p>
      <p><strong>Date:</strong> ${escHtml(currentData.date)}</p>
      ${currentData.equipment ? `<p><strong>Equipment:</strong> ${escHtml(currentData.equipment)}</p>` : ''}
      ${currentData.lab ? `<p><strong>Lab:</strong> ${escHtml(currentData.lab)}</p>` : ''}
    </div>
  `;
  html += `</div>`;

  document.getElementById('mainPanel').innerHTML = html;

  // Update active tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${key}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Attach editable listeners (handles placeholder focus/blur)
  attachEditableListeners(key);

  // Redraw fishbone if needed
  if (key === 'fishbone') {
    setTimeout(() => drawFishboneSVG(currentData), 100);
  }
}

// ---------- Template Rendering Functions ----------
// 5-Why
function render5Why(data) {
  let html = `
    <table class="rca-table" style="margin-bottom:1rem;">
      <tr><td style="width:140px;font-weight:600;color:var(--green);">📅 Date</td><td><span class="editable-field" data-path="5why.date" data-placeholder="YYYY-MM-DD" contenteditable="true">${escHtml(data.date)}</span></td></tr>
      <tr><td style="font-weight:600;color:var(--green);">🖥️ Equipment</td><td><span class="editable-field ${!data.equipment?'placeholder':''}" data-path="5why.equipment" data-placeholder="e.g. Chemistry Analyzer Model X" contenteditable="true">${escHtml(data.equipment) || 'e.g. Chemistry Analyzer Model X'}</span></td></tr>
      <tr><td style="font-weight:600;color:var(--green);">🏥 Lab / Site</td><td><span class="editable-field ${!data.lab?'placeholder':''}" data-path="5why.lab" data-placeholder="e.g. Main Lab, Al Ahli Hospital" contenteditable="true">${escHtml(data.lab) || 'e.g. Main Lab, Al Ahli Hospital'}</span></td></tr>
      <tr><td style="font-weight:600;color:var(--green);">🔴 Problem Statement</td><td><span class="editable-field ${!data.problem?'placeholder':''}" data-path="5why.problem" data-placeholder="Describe the problem — be specific" contenteditable="true">${escHtml(data.problem) || 'Describe the problem — be specific'}</span></td></tr>
    </table>
    <h4 style="color:var(--gold);margin-bottom:0.5rem;">🔍 The 5 Whys</h4>
    <table class="rca-table" id="whyTable">
      <thead><tr><th class="row-number">#</th><th>Why Question & Answer</th><th class="row-actions"></th></tr></thead>
      <tbody>
  `;
  data.whys.forEach((why, i) => {
    html += `
      <tr>
        <td class="row-number">Why ${i+1}</td>
        <td><span class="editable-field ${!why?'placeholder':''}" data-path="5why.whys.${i}" data-placeholder="Because..." contenteditable="true">${escHtml(why) || 'Because...'}</span></td>
        <td class="row-actions"><button class="btn-icon" onclick="deleteWhyRow(${i})" title="Remove">🗑️</button></td>
      </tr>`;
  });
  html += `
      </tbody>
    </table>
    <button class="btn btn-outline btn-sm" onclick="addWhyRow()" style="margin-top:0.4rem;">+ Add Another Why</button>
    <table class="rca-table" style="margin-top:1rem;">
      <tr><td style="width:140px;font-weight:600;color:var(--green);">🎯 Root Cause</td><td><span class="editable-field ${!data.rootCause?'placeholder':''}" data-path="5why.rootCause" data-placeholder="The true root cause identified" contenteditable="true">${escHtml(data.rootCause) || 'The true root cause identified'}</span></td></tr>
      <tr><td style="font-weight:600;color:var(--green);">✅ Corrective Action</td><td><span class="editable-field ${!data.correctiveAction?'placeholder':''}" data-path="5why.correctiveAction" data-placeholder="What will be done to prevent recurrence?" contenteditable="true">${escHtml(data.correctiveAction) || 'What will be done to prevent recurrence?'}</span></td></tr>
    </table>
  `;
  return html;
}

async function addWhyRow() {
  await flushPendingSave();
  currentData.whys.push('');
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

async function deleteWhyRow(index) {
  if (currentData.whys.length <= 1) { showToast('⚠️ Keep at least 1 Why'); return; }
  await flushPendingSave();
  currentData.whys.splice(index, 1);
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

// Fishbone
function renderFishbone(data) {
  let html = `
    <table class="rca-table" style="margin-bottom:1rem;">
      <tr><td style="width:140px;font-weight:600;color:var(--green);">📅 Date</td><td><span class="editable-field" data-path="fishbone.date" data-placeholder="YYYY-MM-DD" contenteditable="true">${escHtml(data.date)}</span></td></tr>
    </table>
    <p style="margin-bottom:0.3rem;font-weight:600;color:var(--green);">🔴 Problem (Fish Head)</p>
    <span class="editable-field ${!data.problem?'placeholder':''}" data-path="fishbone.problem" data-placeholder="Describe the problem — this goes in the fish head" contenteditable="true" style="font-size:1rem;margin-bottom:1rem;">${escHtml(data.problem) || 'Describe the problem — this goes in the fish head'}</span>
    <h4 style="color:var(--gold);margin:0.8rem 0 0.5rem;">🐟 Cause Categories (edit each bone)</h4>
    <div style="overflow-x:auto;">
      <svg class="fishbone-svg" id="fishboneSvg" viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <p style="font-size:0.78rem;color:var(--text3);margin-top:0.5rem;">💡 Edit the text fields below. Diagram updates automatically.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;margin-top:1rem;">
  `;
  const catColors = { 'Man': '#5a8a9e', 'Machine': '#8a6e4a', 'Material': '#6a8a5a', 'Method': '#9e6a5a', 'Environment': '#7a6a9e', 'Measurement': '#5a7a6e' };
  for (const [cat, causes] of Object.entries(data.categories)) {
    html += `<div style="border-left:3px solid ${catColors[cat]};padding-left:0.6rem;"><strong style="color:${catColors[cat]};">${cat}</strong>`;
    causes.forEach((cause, i) => {
      html += `<br><span class="editable-field ${!cause?'placeholder':''}" data-path="fishbone.categories.${cat}.${i}" data-placeholder="—" contenteditable="true" style="font-size:0.82rem;">${escHtml(cause) || '—'}</span>`;
    });
    html += `<br><button class="btn btn-outline btn-sm" style="margin-top:0.3rem;font-size:0.7rem;" onclick="addFishboneCause('${cat}')">+ Add</button></div>`;
  }
  html += `</div>`;
  return html;
}

async function addFishboneCause(cat) {
  await flushPendingSave();
  currentData.categories[cat].push('');
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

function drawFishboneSVG(data) {
  const svg = document.getElementById('fishboneSvg');
  if (!svg) return;
  const W = 800, H = 420, cx = 180, cy = H/2, headX = 730, headY = cy;
  let s = '';
  s += `<line x1="${cx}" y1="${cy}" x2="${headX-40}" y2="${headY}" stroke="#9e7d3f" stroke-width="3" stroke-linecap="round"/>`;
  s += `<rect x="${headX-35}" y="${headY-22}" width="100" height="44" rx="8" fill="#fdfcf8" stroke="#9e7d3f" stroke-width="2"/>`;
  s += `<text x="${headX+15}" y="${headY}" class="fishbone-head-text">${escXml(data.problem || 'PROBLEM')}</text>`;
  const categories = [
    { name:'Man', y:60, side:'top', color:'#5a8a9e' },
    { name:'Machine', y:120, side:'top', color:'#8a6e4a' },
    { name:'Material', y:180, side:'top', color:'#6a8a5a' },
    { name:'Method', y:240, side:'bottom', color:'#9e6a5a' },
    { name:'Environment', y:310, side:'bottom', color:'#7a6a9e' },
    { name:'Measurement', y:380, side:'bottom', color:'#5a7a6e' }
  ];
  categories.forEach(cat => {
    const catData = data.categories[cat.name] || [];
    const isTop = cat.side === 'top';
    const ribStartX = cx+80, ribEndX = headX-80, mainRibY = cat.y;
    s += `<line x1="${ribStartX}" y1="${cy}" x2="${ribEndX}" y2="${mainRibY}" stroke="#8a7a5a" stroke-width="1.6"/>`;
    s += `<text x="${ribStartX-10}" y="${mainRibY+(isTop?-12:16)}" class="fishbone-category" fill="${cat.color}">${cat.name}</text>`;
    catData.forEach((cause, i) => {
      if (!cause || cause.trim() === '') return;
      const subX = ribStartX + 60 + i*90;
      const subY = mainRibY + (isTop ? -25 : 25);
      s += `<line x1="${subX}" y1="${mainRibY}" x2="${subX}" y2="${subY}" stroke="#b5a88a" stroke-width="1"/>`;
      const label = cause.length > 18 ? cause.substring(0,17)+'…' : cause;
      s += `<rect x="${subX-48}" y="${subY-(isTop?22:8)}" width="96" height="22" rx="4" class="fishbone-label-bg" fill="#fdfcf8" stroke="#d9d0bb" stroke-width="1"/>`;
      s += `<text x="${subX}" y="${subY+(isTop?-3:13)}" class="fishbone-label-text">${escXml(label)}</text>`;
    });
  });
  svg.innerHTML = s;
}

// A3 Report
function renderA3(data) {
  let html = `
    <table class="rca-table" style="margin-bottom:1rem;">
      <tr><td style="width:140px;font-weight:600;color:var(--green);">📅 Date</td><td><span class="editable-field" data-path="a3.date" data-placeholder="YYYY-MM-DD" contenteditable="true">${escHtml(data.date)}</span></td></tr>
      <tr><td style="font-weight:600;color:var(--green);">📌 Title</td><td><span class="editable-field ${!data.title?'placeholder':''}" data-path="a3.title" data-placeholder="A3 Report Title" contenteditable="true">${escHtml(data.title) || 'A3 Report Title'}</span></td></tr>
    </table>
    <div class="a3-grid">
      <div class="a3-cell"><h4>1. Background</h4><span class="editable-field ${!data.background?'placeholder':''}" data-path="a3.background" data-placeholder="Why is this problem important?" contenteditable="true">${escHtml(data.background) || 'Why is this problem important?'}</span></div>
      <div class="a3-cell"><h4>2. Current State</h4><span class="editable-field ${!data.currentState?'placeholder':''}" data-path="a3.currentState" data-placeholder="What is happening now?" contenteditable="true">${escHtml(data.currentState) || 'What is happening now?'}</span></div>
      <div class="a3-cell"><h4>3. Goal</h4><span class="editable-field ${!data.goal?'placeholder':''}" data-path="a3.goal" data-placeholder="What does success look like?" contenteditable="true">${escHtml(data.goal) || 'What does success look like?'}</span></div>
      <div class="a3-cell"><h4>4. Root Cause Analysis</h4><span class="editable-field ${!data.rootCauseAnalysis?'placeholder':''}" data-path="a3.rootCauseAnalysis" data-placeholder="Use 5-Why or Fishbone results..." contenteditable="true">${escHtml(data.rootCauseAnalysis) || 'Use 5-Why or Fishbone results...'}</span></div>
      <div class="a3-cell"><h4>5. Countermeasures</h4><span class="editable-field ${!data.countermeasures?'placeholder':''}" data-path="a3.countermeasures" data-placeholder="Actions to address root cause" contenteditable="true">${escHtml(data.countermeasures) || 'Actions to address root cause'}</span></div>
      <div class="a3-cell"><h4>6. Check Results</h4><span class="editable-field ${!data.checkResults?'placeholder':''}" data-path="a3.checkResults" data-placeholder="How did you verify the fix?" contenteditable="true">${escHtml(data.checkResults) || 'How did you verify the fix?'}</span></div>
      <div class="a3-cell full-width"><h4>7. Follow-Up</h4><span class="editable-field ${!data.followUp?'placeholder':''}" data-path="a3.followUp" data-placeholder="PM updates? Training? Shared learning?" contenteditable="true">${escHtml(data.followUp) || 'PM updates? Training? Shared learning?'}</span></div>
    </div>
  `;
  return html;
}

// Timeline
function renderTimeline(data) {
  let html = `
    <table class="rca-table" style="margin-bottom:1rem;">
      <tr><td style="width:140px;font-weight:600;color:var(--green);">📅 Date</td><td><span class="editable-field" data-path="timeline.date" data-placeholder="YYYY-MM-DD" contenteditable="true">${escHtml(data.date)}</span></td></tr>
      <tr><td style="font-weight:600;color:var(--green);">🔴 Problem</td><td><span class="editable-field ${!data.problem?'placeholder':''}" data-path="timeline.problem" data-placeholder="Describe the failure event" contenteditable="true">${escHtml(data.problem) || 'Describe the failure event'}</span></td></tr>
    </table>
    <h4 style="color:var(--gold);margin-bottom:0.5rem;">🕐 Event Timeline</h4>
    <ul class="timeline-list" id="timelineList">
  `;
  data.events.forEach((ev, i) => {
    html += `
      <li class="timeline-item">
        <div style="display:flex;gap:0.5rem;align-items:flex-start;">
          <span class="editable-field time-input ${!ev.time?'placeholder':''}" data-path="timeline.events.${i}.time" data-placeholder="Date / Time" contenteditable="true" style="width:140px;flex-shrink:0;">${escHtml(ev.time) || 'Date / Time'}</span>
          <span class="editable-field event-input ${!ev.description?'placeholder':''}" data-path="timeline.events.${i}.description" data-placeholder="Event description..." contenteditable="true" style="flex:1;">${escHtml(ev.description) || 'Event description...'}</span>
          <button class="btn-icon" onclick="deleteTimelineEvent(${i})" title="Remove" style="flex-shrink:0;">🗑️</button>
        </div>
      </li>`;
  });
  html += `
    </ul>
    <button class="btn btn-outline btn-sm" onclick="addTimelineEvent()">+ Add Event</button>
  `;
  return html;
}

async function addTimelineEvent() {
  await flushPendingSave();
  currentData.events.push({ time: '', description: '' });
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

async function deleteTimelineEvent(index) {
  if (currentData.events.length <= 1) { showToast('⚠️ Keep at least 1 event'); return; }
  await flushPendingSave();
  currentData.events.splice(index, 1);
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

// C&E Matrix
function renderMatrix(data) {
  let html = `
    <table class="rca-table" style="margin-bottom:1rem;">
      <tr><td style="width:140px;font-weight:600;color:var(--green);">📅 Date</td><td><span class="editable-field" data-path="matrix.date" data-placeholder="YYYY-MM-DD" contenteditable="true">${escHtml(data.date)}</span></td></tr>
      <tr><td style="font-weight:600;color:var(--green);">🔴 Problem</td><td><span class="editable-field ${!data.problem?'placeholder':''}" data-path="matrix.problem" data-placeholder="Describe the problem" contenteditable="true">${escHtml(data.problem) || 'Describe the problem'}</span></td></tr>
    </table>
    <p style="font-size:0.8rem;color:var(--text3);">Score each cause 1-5: <strong>S</strong>=Severity, <strong>O</strong>=Occurrence, <strong>D</strong>=Detection. <strong>RPN = S × O × D</strong></p>
    <table class="rca-table" id="matrixTable">
      <thead><tr><th>Potential Cause</th><th style="width:50px;">S</th><th style="width:50px;">O</th><th style="width:50px;">D</th><th style="width:60px;">RPN</th><th class="row-actions"></th></tr></thead>
      <tbody>
  `;
  data.rows.forEach((row, i) => {
    const rpn = (parseInt(row.severity)||0) * (parseInt(row.occurrence)||0) * (parseInt(row.detection)||0);
    const rpnColor = rpn > 60 ? 'color:#b54a3e;font-weight:700;' : (rpn > 30 ? 'color:#9e7d3f;' : '');
    html += `
      <tr>
        <td><span class="editable-field ${!row.cause?'placeholder':''}" data-path="matrix.rows.${i}.cause" data-placeholder="Describe potential cause..." contenteditable="true">${escHtml(row.cause) || 'Describe potential cause...'}</span></td>
        <td><span class="editable-field" data-path="matrix.rows.${i}.severity" contenteditable="true" style="text-align:center;">${escHtml(row.severity)}</span></td>
        <td><span class="editable-field" data-path="matrix.rows.${i}.occurrence" contenteditable="true" style="text-align:center;">${escHtml(row.occurrence)}</span></td>
        <td><span class="editable-field" data-path="matrix.rows.${i}.detection" contenteditable="true" style="text-align:center;">${escHtml(row.detection)}</span></td>
        <td style="text-align:center;${rpnColor}" class="rpn-cell">${rpn || '—'}</td>
        <td class="row-actions"><button class="btn-icon" onclick="deleteMatrixRow(${i})" title="Remove">🗑️</button></td>
      </tr>`;
  });
  html += `
      </tbody>
    </table>
    <button class="btn btn-outline btn-sm" onclick="addMatrixRow()">+ Add Cause Row</button>
  `;
  return html;
}

async function addMatrixRow() {
  await flushPendingSave();
  currentData.rows.push({ cause: '', severity: '3', occurrence: '3', detection: '3' });
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

async function deleteMatrixRow(index) {
  if (currentData.rows.length <= 1) { showToast('⚠️ Keep at least 1 row'); return; }
  await flushPendingSave();
  currentData.rows.splice(index, 1);
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

function recalcMatrixDisplay() {
  const table = document.getElementById('matrixTable');
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((tr, i) => {
    if (i >= currentData.rows.length) return;
    const s = parseInt(currentData.rows[i].severity) || 0;
    const o = parseInt(currentData.rows[i].occurrence) || 0;
    const d = parseInt(currentData.rows[i].detection) || 0;
    const rpn = s * o * d;
    const rpnCell = tr.querySelector('.rpn-cell');
    if (rpnCell) {
      rpnCell.textContent = rpn || '—';
      rpnCell.style.color = rpn > 60 ? '#b54a3e' : (rpn > 30 ? '#9e7d3f' : '');
      rpnCell.style.fontWeight = rpn > 60 ? '700' : '';
    }
  });
  autoSave(currentTab, currentData);
}

// Checklist
function renderChecklist(data) {
  let html = `
    <table class="rca-table" style="margin-bottom:1rem;">
      <tr><td style="width:140px;font-weight:600;color:var(--green);">📅 Date</td><td><span class="editable-field" data-path="checklist.date" data-placeholder="YYYY-MM-DD" contenteditable="true">${escHtml(data.date)}</span></td></tr>
      <tr><td style="font-weight:600;color:var(--green);">🔴 Problem</td><td><span class="editable-field ${!data.problem?'placeholder':''}" data-path="checklist.problem" data-placeholder="Describe the problem" contenteditable="true">${escHtml(data.problem) || 'Describe the problem'}</span></td></tr>
    </table>
    <table class="rca-table" id="checklistTable">
      <thead><tr><th style="width:30px;">✓</th><th>Checklist Item</th><th>Notes</th></tr></thead>
      <tbody>
  `;
  data.items.forEach((item, i) => {
    html += `
      <tr>
        <td style="text-align:center;">
          <input type="checkbox" data-path="checklist.items.${i}.checked" ${item.checked ? 'checked' : ''} onchange="updateChecklistItem(${i}, 'checked', this.checked)" style="width:18px;height:18px;cursor:pointer;">
        </td>
        <td><span class="editable-field" data-path="checklist.items.${i}.question" contenteditable="true">${escHtml(item.question)}</span></td>
        <td><span class="editable-field ${!item.notes?'placeholder':''}" data-path="checklist.items.${i}.notes" data-placeholder="Notes..." contenteditable="true">${escHtml(item.notes) || 'Notes...'}</span></td>
      </tr>`;
  });
  html += `
      </tbody>
    </table>
    <button class="btn btn-outline btn-sm" onclick="addChecklistItem()">+ Add Checklist Item</button>
  `;
  return html;
}

async function addChecklistItem() {
  await flushPendingSave();
  currentData.items.push({ question: 'New item', checked: false, notes: '' });
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

function updateChecklistItem(index, field, value) {
  currentData.items[index][field] = value;
  autoSave(currentTab, currentData);
}

// Problem Solving
function renderProblemSolve(data) {
  let html = `
    <table class="rca-table" style="margin-bottom:1rem;">
      <tr><td style="width:140px;font-weight:600;color:var(--green);">📅 Date</td><td><span class="editable-field" data-path="problemsolve.date" data-placeholder="YYYY-MM-DD" contenteditable="true">${escHtml(data.date)}</span></td></tr>
    </table>
    <div class="problem-section">
      <h4>1. 🔴 Problem</h4>
      <span class="editable-field ${!data.problem?'placeholder':''}" data-path="problemsolve.problem" data-placeholder="Describe the problem clearly — what, where, when, impact." contenteditable="true" style="font-size:1rem;">${escHtml(data.problem) || 'Describe the problem clearly — what, where, when, impact.'}</span>
    </div>
    <div class="problem-section">
      <h4>2. 💡 Possible Causes</h4>
      <div id="problemCausesList">
  `;
  data.possibleCauses.forEach((cause, i) => {
    html += `
      <div class="problem-row">
        <span class="bullet">•</span>
        <span class="editable-field ${!cause?'placeholder':''}" data-path="problemsolve.possibleCauses.${i}" data-placeholder="Possible cause..." contenteditable="true" style="flex:1;">${escHtml(cause) || 'Possible cause...'}</span>
        <button class="btn-icon" onclick="deleteProblemItem('possibleCauses', ${i})" title="Remove">🗑️</button>
      </div>`;
  });
  html += `
      </div>
      <button class="btn btn-outline btn-sm" onclick="addProblemItem('possibleCauses')">+ Add Cause</button>
    </div>
    <div class="problem-section">
      <h4>3. 💡 Possible Solutions</h4>
      <div id="problemSolutionsList">
  `;
  data.possibleSolutions.forEach((sol, i) => {
    html += `
      <div class="problem-row">
        <span class="bullet">•</span>
        <span class="editable-field ${!sol?'placeholder':''}" data-path="problemsolve.possibleSolutions.${i}" data-placeholder="Possible solution..." contenteditable="true" style="flex:1;">${escHtml(sol) || 'Possible solution...'}</span>
        <button class="btn-icon" onclick="deleteProblemItem('possibleSolutions', ${i})" title="Remove">🗑️</button>
      </div>`;
  });
  html += `
      </div>
      <button class="btn btn-outline btn-sm" onclick="addProblemItem('possibleSolutions')">+ Add Solution</button>
    </div>
    <div class="problem-section">
      <h4 style="color:var(--green);">4. ✅ Solution (Chosen)</h4>
      <span class="editable-field ${!data.solution?'placeholder':''}" data-path="problemsolve.solution" data-placeholder="Describe the selected solution and why it was chosen." contenteditable="true" style="font-size:1rem;">${escHtml(data.solution) || 'Describe the selected solution and why it was chosen.'}</span>
    </div>
  `;
  return html;
}

async function addProblemItem(arrayKey) {
  await flushPendingSave();
  currentData[arrayKey].push('');
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

async function deleteProblemItem(arrayKey, index) {
  if (currentData[arrayKey].length <= 1) { showToast('⚠️ Keep at least 1 item'); return; }
  await flushPendingSave();
  currentData[arrayKey].splice(index, 1);
  await saveNow(currentTab, currentData);
  renderTemplate(currentTab, currentData);
}

// ---------- Attach Editable Field Listeners ----------
function attachEditableListeners(key) {
  document.querySelectorAll('.editable-field[contenteditable="true"]').forEach(el => {
    el.addEventListener('focus', function() {
      const placeholder = this.getAttribute('data-placeholder');
      if (placeholder && this.innerText.trim() === placeholder) {
        this.innerText = '';
        this.classList.remove('placeholder');
      }
    });
    el.addEventListener('blur', function() {
      const placeholder = this.getAttribute('data-placeholder');
      const text = this.innerText.trim();
      if (!text && placeholder) {
        this.innerText = placeholder;
        this.classList.add('placeholder');
      } else if (text === placeholder) {
        this.classList.add('placeholder');
      } else {
        this.classList.remove('placeholder');
      }
    });
    el.addEventListener('input', function() {
      const path = this.getAttribute('data-path');
      const placeholder = this.getAttribute('data-placeholder');
      const value = this.innerText.trim();
      if (value !== placeholder) this.classList.remove('placeholder');
      if (!path) return;
      setNestedValue(currentData, path, value);
      autoSave(key, currentData);
      if (key === 'fishbone' && path.startsWith('fishbone')) {
        setTimeout(() => drawFishboneSVG(currentData), 200);
      }
      if (key === 'matrix' && path.startsWith('matrix.rows') && (path.includes('severity') || path.includes('occurrence') || path.includes('detection'))) {
        recalcMatrixDisplay();
      }
    });
  });

  document.querySelectorAll('input[type="checkbox"][data-path]').forEach(cb => {
    cb.addEventListener('change', function() {
      const path = this.getAttribute('data-path');
      setNestedValue(currentData, path, this.checked);
      autoSave(key, currentData);
    });
  });
}

function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (/^\d+$/.test(parts[i+1])) {
      if (!current[part]) current[part] = [];
      current = current[part];
    } else if (Array.isArray(current[part])) {
      const idx = parseInt(parts[i+1]);
      current = current[part];
      i++;
    } else {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
  }
  const lastPart = parts[parts.length-1];
  if (/^\d+$/.test(lastPart) && Array.isArray(current)) {
    current[parseInt(lastPart)] = value;
  } else {
    current[lastPart] = value;
  }
}

// ---------- PWA Registration ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.log('SW registration failed', err));
  });
}

// ---------- Initial Load ----------
async function init() {
  await openDB();
  await loadUserDisplay();

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      renderTemplate(tab);
    });
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      printCurrentTemplate();
    }
    if (e.key === 'Escape') {
      document.getElementById('modalOverlay').style.display = 'none';
    }
  });

  renderTemplate('5why');
}

init();