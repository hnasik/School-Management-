// ================= FIREBASE =================
function normalizeClass(v) {
  if (!v) return "";
  if (typeof v === "number") return v;
  return v.toLowerCase().replace(/\s+/g, "");
}

const firebaseConfig = {
  apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
  authDomain: "school-management-projec-9db7a.firebaseapp.com",
  projectId: "school-management-projec-9db7a",
  storageBucket: "school-management-projec-9db7a.firebasestorage.app",
  messagingSenderId: "975842483778",
  appId: "1:975842483778:web:d1708792ff56014f3317db"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ================= GLOBALS =================
let currentUserUid = null;
let openedStudentId = null;
let cachedSchool = { name: "", address: "", logo: "", sign: "" };

// DOM
const yearSelect = document.getElementById("academicYearSelect");
const classSelect = document.getElementById("classSelect");
const studentListContainer = document.getElementById("studentListContainer");
const paymentHistoryBox = document.getElementById("paymentHistory");
const studentTitle = document.getElementById("studentTitle");
const monthList = document.getElementById("monthList");

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// ================= HELPERS =================
function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function storageKey(uid, k) {
  return `${uid}_${k}`;
}

function showToast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.className = "toast " + type;
  el.innerHTML = `<i class="fas ${
    type === "success" ? "fa-check-circle" :
    type === "error" ? "fa-exclamation-circle" :
    "fa-info-circle"
  }"></i> ${escapeHtml(msg)}`;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

// ---- Custom months (per student, per school owner) ----
function customMonthsKey(studentId) {
  return `customMonths_${currentUserUid}_${studentId}`;
}
function getCustomMonths(studentId) {
  try {
    const raw = localStorage.getItem(customMonthsKey(studentId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveCustomMonths(studentId, list) {
  localStorage.setItem(customMonthsKey(studentId), JSON.stringify(list));
}

// Load school branding from Firestore (user-specific)
async function loadSchoolBranding() {
  if (!currentUserUid) return;
  try {
    const snap = await db.collection("school_settings").doc(currentUserUid).get();
    if (snap.exists) {
      const d = snap.data();
      cachedSchool.name = d.schoolName || "";
      cachedSchool.address = d.schoolAddress || "";
      cachedSchool.logo = d.logo || "";
      cachedSchool.sign = d.principalSignature || "";
    }
  } catch (e) {
    console.warn("school_settings fetch failed:", e);
  }
  if (!cachedSchool.logo) cachedSchool.logo = localStorage.getItem(storageKey(currentUserUid, "schoolLogo")) || "";
  if (!cachedSchool.sign) cachedSchool.sign = localStorage.getItem(storageKey(currentUserUid, "principalSign")) || "";
}

// ================= INIT =================
for (let y = 2025; y <= 2040; y++) {
  yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
}
yearSelect.value = new Date().getFullYear();

const extraClasses = [
  { value: "preprimary", label: "Pre-Primary" },
  { value: "kg2", label: "LKG" },
  { value: "kg1", label: "NURSERY" },
  { value: "ukg", label: "UKG" }
];

extraClasses.forEach(c => {
  classSelect.innerHTML += `<option value="${c.value}">${c.label}</option>`;
});

for (let c = 1; c <= 12; c++) {
  classSelect.innerHTML += `<option value="${c}">Class ${c}</option>`;
}

// ================= AUTH =================
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUserUid = user.uid;
  loadSchoolBranding();
});

// ================= EVENTS =================
classSelect.addEventListener("change", loadStudents);
yearSelect.addEventListener("change", loadStudents);

// ================= LOAD STUDENTS =================
async function loadStudents() {
  if (!classSelect.value) {
    studentListContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <h3>No students loaded</h3>
        <p>Select a class and academic year above to begin</p>
      </div>`;
    return;
  }

  studentListContainer.innerHTML = `
    <div class="loading-state">
      <i class="fas fa-spinner"></i>
      <p>Loading students...</p>
    </div>`;

  let selectedNorm = normalizeClass(classSelect.value);

if (selectedNorm === "kg2" || selectedNorm === "lkg") {
  selectedNorm = "lkg";
} else if (selectedNorm === "kg1" || selectedNorm === "nursery") {
  selectedNorm = "nursery";
}

  try {
    const snap = await db.collection("students")
      .where("ownerId", "==", currentUserUid)
      .where("academicYear", "==", yearSelect.value)
      .get();

    if (snap.empty) {
      studentListContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-slash"></i>
          <h3>No students found</h3>
          <p>No students in this class for ${escapeHtml(yearSelect.value)}</p>
        </div>`;
      return;
    }

    let found = false;
    let cardsHTML = '<div class="student-list">';

    snap.forEach(doc => {
      const s = doc.data();
      let studentNorm = normalizeClass(s.studentClass);

if (studentNorm === "kg2" || studentNorm === "lkg") {
  studentNorm = "lkg";
} else if (studentNorm === "kg1" || studentNorm === "nursery") {
  studentNorm = "nursery";
}

      if (studentNorm == selectedNorm) {
        found = true;
        const initial = (s.name || "?").trim().charAt(0).toUpperCase();
        const classLabelMap = {
  kg1: "NURSERY",
  kg2: "LKG",
  nursery: "NURSERY",
  lkg: "LKG"
};
const displayClass =
  classLabelMap[normalizeClass(s.studentClass)] || s.studentClass;
        cardsHTML += `
          <div class="student-card">
            <div class="student-avatar">${escapeHtml(initial)}</div>
            <div class="student-info">
              <div class="student-name">${escapeHtml(s.name)}</div>
             


              <div class="student-class"><i class="fas fa-school"></i> ${escapeHtml(displayClass)} &nbsp;·&nbsp; <i class="fas fa-hashtag"></i> ${escapeHtml(s.roll || "—")}</div>
            </div>
            <button class="btn-history" onclick="toggleHistory('${doc.id}','${escapeHtml(s.name)}','${escapeHtml(displayClass)}')">
              <i class="fas fa-history"></i> Payment History
            </button>
          </div>
        `;
      }
    });

    cardsHTML += "</div>";

    if (!found) {
      studentListContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-slash"></i>
          <h3>No students found</h3>
          <p>No students in this class for ${escapeHtml(yearSelect.value)}</p>
        </div>`;
    } else {
      studentListContainer.innerHTML = cardsHTML;
    }
  } catch (err) {
    console.error(err);
    studentListContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error loading students</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>`;
  }
}

// ================= TOGGLE HISTORY =================
function toggleHistory(studentId, name, cls) {
  if (openedStudentId === studentId) {
    paymentHistoryBox.style.display =
      paymentHistoryBox.style.display === "none" ? "block" : "none";
    return;
  }

  openedStudentId = studentId;
  paymentHistoryBox.style.display = "block";
  paymentHistoryBox.scrollIntoView({ behavior: "smooth", block: "start" });

  viewHistory(studentId, name, cls);
}

// ================================================================
// BUILD A MONTH ROW (used for both standard and custom months)
// ================================================================
function buildMonthRow(opts) {
  const {
    monthName, monthKey, payment, year,
    studentId, studentName, studentClass, isCustom
  } = opts;

  const div = document.createElement("div");
  div.className = "month" + (payment ? " paid" : "") + (isCustom ? " custom-month" : "");

  // Label: month name (+ year + badge for custom)
  const label = isCustom
    ? `${escapeHtml(monthName)} ${escapeHtml(String(year))} <span class="custom-badge"><i class="fas fa-star"></i> Extra</span>`
    : escapeHtml(monthName);

  const removeBtnHTML = (isCustom && !payment)
    ? `<button class="btn-remove-custom" title="Remove this month" data-remove="${monthKey}"><i class="fas fa-times"></i></button>`
    : "";

  div.innerHTML = `
    <strong><i class="fas fa-calendar-day"></i> ${label} ${removeBtnHTML}</strong>

    <input type="number"
      value="${payment ? payment.amount : (localStorage.getItem("defaultFee") || "")}"
      placeholder="Amount"
      ${payment ? "disabled" : ""}>

    <button class="${payment ? 'btn-paid-green btn-disabled' : 'btn-paid-red'}">
      <i class="fas fa-check"></i> Paid
    </button>

    <button class="btn-unpaid ${payment ? '' : 'btn-disabled'}">
      <i class="fas fa-times"></i> Unpaid
    </button>

    <button class="btn-print">
      <i class="fas fa-print"></i>
    </button>
  `;

  const amountInput = div.querySelector("input");
  const paidBtn = div.children[2];
  const unpaidBtn = div.children[3];
  const printBtn = div.children[4];

  // PAID
  paidBtn.onclick = async () => {
    if (payment) return;
    if (!amountInput.value) return showToast("Enter amount", "error");

    localStorage.setItem("defaultFee", amountInput.value);

    // Derive the year from the monthKey (works for standard AND custom months)
    const paymentYear = String(year);

    await db.collection("payments").add({
      ownerId: currentUserUid,
      academicYear: paymentYear,
      studentId,
      studentName,
      studentClass,
      monthKey,
      monthName,
      amount: Number(amountInput.value),
      status: "paid",
      paidOn: new Date().toISOString().split("T")[0],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast("Payment marked as paid", "success");
    viewHistory(studentId, studentName, studentClass);
  };

  // UNPAID
  unpaidBtn.onclick = async () => {
    if (!payment) return;
    await db.collection("payments").doc(payment.id).delete();
    showToast("Payment marked as unpaid", "info");
    viewHistory(studentId, studentName, studentClass);
  };

  // PRINT RECEIPT
  printBtn.onclick = () => {
    const amount = payment ? payment.amount : amountInput.value;
    if (!amount || Number(amount) <= 0) {
      return showToast("No amount to print", "error");
    }
    const paidOn = payment ? (payment.paidOn || "") : new Date().toISOString().split("T")[0];
    openFeeReceiptPDF({
      studentName,
      studentClass,
      monthName,
      monthKey,
      academicYear: String(year),
      amount: Number(amount),
      paidOn
    });
  };

  // REMOVE custom month (only when unpaid)
  const removeBtn = div.querySelector(".btn-remove-custom");
  if (removeBtn) {
    removeBtn.onclick = () => {
      const list = getCustomMonths(studentId).filter(k => k !== monthKey);
      saveCustomMonths(studentId, list);
      showToast("Month removed", "info");
      viewHistory(studentId, studentName, studentClass);
    };
  }

  return div;
}

// ================================================================
// VIEW HISTORY
// ================================================================
async function viewHistory(studentId, studentName, studentClass) {
  studentTitle.textContent = `Payment History : ${studentName} (${studentClass})`;
  monthList.innerHTML = `
    <div class="loading-state">
      <i class="fas fa-spinner"></i>
      <p>Loading payment history...</p>
    </div>`;

  // Query ALL payments for this student (all years) — no year filter
  const snap = await db.collection("payments")
    .where("ownerId", "==", currentUserUid)
    .where("studentId", "==", studentId)
    .get();

  const payments = {};
  snap.forEach(d => payments[d.data().monthKey] = { id: d.id, ...d.data() });

  const selectedYear = String(yearSelect.value);

  monthList.innerHTML = "";
  const renderedKeys = new Set();

  // -- 1) Standard 12 months of selected year --
  MONTH_NAMES.forEach((m, i) => {
    const monthKey = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
    renderedKeys.add(monthKey);
    const payment = payments[monthKey];
    const row = buildMonthRow({
      monthName: m, monthKey, payment, year: selectedYear,
      studentId, studentName, studentClass, isCustom: false
    });
    monthList.appendChild(row);
  });

  // -- 2) Custom months (from localStorage) + any other payments --
  const extraKeys = new Set();
  getCustomMonths(studentId).forEach(k => {
    if (!renderedKeys.has(k)) extraKeys.add(k);
  });
  Object.keys(payments).forEach(k => {
    if (!renderedKeys.has(k)) extraKeys.add(k);
  });

  const sortedExtra = [...extraKeys].sort();
  sortedExtra.forEach(monthKey => {
    renderedKeys.add(monthKey);
    const [yy, mm] = monthKey.split("-");
    const monthIdx = parseInt(mm, 10) - 1;
    const monthName = MONTH_NAMES[monthIdx] || mm;
    const payment = payments[monthKey];
    const row = buildMonthRow({
      monthName, monthKey, payment, year: yy,
      studentId, studentName, studentClass, isCustom: true
    });
    monthList.appendChild(row);
  });

  // -- 3) "Add Extra Month" button --
  const wrap = document.createElement("div");
  wrap.className = "add-month-wrap";
  wrap.innerHTML = `
    <button class="btn-add-month" id="addMonthBtn">
      <i class="fas fa-plus-circle"></i> Add Extra Month / Year
    </button>
  `;
  monthList.appendChild(wrap);

  document.getElementById("addMonthBtn").onclick = () => {
    openAddMonthDialog(studentId, studentName, studentClass, renderedKeys);
  };
}

// ================================================================
// ADD MONTH DIALOG (inline panel below the button)
// ================================================================
function openAddMonthDialog(studentId, studentName, studentClass, renderedKeys) {
  // Remove any existing panel
  const existing = document.getElementById("addMonthPanel");
  if (existing) existing.remove();

  const currentYear = parseInt(yearSelect.value, 10) || new Date().getFullYear();

  const panel = document.createElement("div");
  panel.id = "addMonthPanel";
  panel.className = "add-month-panel";

  const monthOptions = MONTH_NAMES
    .map((m, i) => `<option value="${i + 1}">${m}</option>`)
    .join("");

  panel.innerHTML = `
    <div class="amp-title">
      <i class="fas fa-plus-circle"></i> Add Extra Month / Year
    </div>
    <p class="amp-desc">
      The selected month will be added below December. You can mark it Paid, Unpaid, or print its receipt just like any other month.
    </p>

    <div class="amp-fields">
      <div class="amp-field">
        <label>Month</label>
        <select id="extraMonthSel">${monthOptions}</select>
      </div>
      <div class="amp-field">
        <label>Year</label>
        <input type="number" id="extraYearInput" min="2000" max="2100" value="${currentYear + 1}">
      </div>
    </div>

    <div class="amp-actions">
      <button class="amp-cancel" id="extraAddCancel">Cancel</button>
      <button class="amp-confirm" id="extraAddConfirm">
        <i class="fas fa-check"></i> Add Month
      </button>
    </div>
  `;

  monthList.appendChild(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  document.getElementById("extraAddCancel").onclick = () => panel.remove();

  document.getElementById("extraAddConfirm").onclick = () => {
    const mm = parseInt(document.getElementById("extraMonthSel").value, 10);
    const yy = parseInt(document.getElementById("extraYearInput").value, 10);

    if (!yy || yy < 2000 || yy > 2100) {
      showToast("Enter a valid year (2000–2100)", "error");
      return;
    }

    const monthKey = `${yy}-${String(mm).padStart(2, "0")}`;

    if (renderedKeys && renderedKeys.has(monthKey)) {
      showToast("This month is already listed", "error");
      return;
    }

    const list = getCustomMonths(studentId);
    if (!list.includes(monthKey)) {
      list.push(monthKey);
      list.sort();
      saveCustomMonths(studentId, list);
    }

    showToast("Month added", "success");
    viewHistory(studentId, studentName, studentClass);
  };
}

// ================================================================
// FEE RECEIPT PDF — beautiful, with logo & principal signature
// ================================================================
async function openFeeReceiptPDF(d) {
  if (!cachedSchool.name) {
    await loadSchoolBranding();
  }

  const w = window.open("", "_blank");
  if (!w) return showToast("Pop-up blocked. Please allow pop-ups.", "error");

  const { name: schoolName, address: schoolAddress, logo: schoolLogo, sign: principalSign } = cachedSchool;

  const receiptNo = "RCPT-" + Date.now().toString().slice(-8);
  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  });
  const generatedTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit"
  });

  const amountInWords = numberToWordsIndian(d.amount);

  const qrData = `
${schoolName}
Receipt: ${receiptNo}
Student: ${d.studentName}
Class: ${d.studentClass}
Month: ${d.monthName} ${d.academicYear}
Amount: Rs. ${d.amount}
`.trim();
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=" + encodeURIComponent(qrData);

  w.document.write(`
<html>
<head>
  <title>Fee Receipt — ${escapeHtml(d.studentName)}</title>

  <link rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
      color: #1a1410;
      background: #f3f4f6;
      padding: 20px;
    }

    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #1A2A6C, #2c3e91);
      color: #fff;
      border: none;
      padding: 12px 22px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(26,42,108,0.35);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      z-index: 100;
      transition: transform .15s, box-shadow .15s;
    }
    .print-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(26,42,108,0.45);
    }
    .print-btn i { font-size: 14px; }

    .page {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      padding: 32px 40px 28px;
      position: relative;
      overflow: hidden;
    }

    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 160px;
      font-weight: 900;
      color: rgba(16, 185, 129, 0.07);
      letter-spacing: 20px;
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }

    .content { position: relative; z-index: 1; }

    .header {
      display: flex;
      align-items: center;
      gap: 18px;
      padding-bottom: 16px;
      border-bottom: 3px double #1A2A6C;
      margin-bottom: 20px;
    }
    .header .logo-wrap {
      width: 78px; height: 78px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #f8fafc; border-radius: 12px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }
    .header .logo-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .header .logo-placeholder {
      width: 78px; height: 78px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #eef2ff; border-radius: 12px;
      color: #1A2A6C; font-size: 34px; font-weight: 800;
      border: 1px solid #c7d2fe;
    }
    .header .title-block { flex: 1; text-align: center; }
    .header h1 {
      font-size: 24px; color: #1A2A6C;
      letter-spacing: 0.5px; margin-bottom: 4px;
      text-transform: uppercase;
    }
    .header .address { font-size: 12px; color: #555; }
    .header .spacer { width: 78px; flex-shrink: 0; }

    .title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #1A2A6C, #2c3e91);
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    .title-bar h2 {
      font-size: 18px;
      letter-spacing: 2px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .title-bar h2 i { font-size: 16px; }
    .title-bar .receipt-no {
      font-size: 12px;
      background: rgba(255,255,255,0.18);
      padding: 5px 12px;
      border-radius: 999px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 14px 16px;
    }
    .info-card .card-label {
      font-size: 10px;
      font-weight: 800;
      color: #1A2A6C;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #eef2ff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .info-card .card-label i { color: #667eea; }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      font-size: 13px;
    }
    .info-row .k {
      color: #6b7280;
      font-weight: 600;
      font-size: 12px;
    }
    .info-row .v {
      color: #111827;
      font-weight: 700;
      text-align: right;
      max-width: 60%;
      word-break: break-word;
    }

    .amount-block {
      background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
      border: 2px solid #10b981;
      border-radius: 14px;
      padding: 20px 24px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    .amount-block::before {
      content: "";
      position: absolute;
      top: -30px; right: -30px;
      width: 120px; height: 120px;
      background: radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%);
      border-radius: 50%;
    }
    .amount-block .left { position: relative; z-index: 1; }
    .amount-block .lbl {
      font-size: 11px;
      font-weight: 800;
      color: #059669;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .amount-block .words {
      font-size: 12px;
      color: #065f46;
      font-style: italic;
      max-width: 320px;
    }
    .amount-block .amt {
      font-size: 38px;
      font-weight: 900;
      color: #065f46;
      position: relative;
      z-index: 1;
      line-height: 1;
      letter-spacing: -1px;
    }
    .amount-block .amt small {
      font-size: 18px;
      font-weight: 700;
      opacity: 0.75;
      margin-right: 4px;
    }

    .payment-meta {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 22px;
    }
    .meta-item {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-top: 3px solid #667eea;
      border-radius: 10px;
      padding: 12px;
      text-align: center;
    }
    .meta-item .mi-label {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      font-weight: 800;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .meta-item .mi-label i { color: #667eea; }
    .meta-item .mi-value {
      font-size: 14px;
      font-weight: 800;
      color: #1A2A6C;
    }
    .meta-item .mi-value.paid {
      color: #059669;
      background: #ecfdf5;
      padding: 3px 10px;
      border-radius: 999px;
      display: inline-block;
      font-size: 11px;
      letter-spacing: 1px;
    }

    .bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
    }
    .qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .qr-wrap img {
      width: 110px;
      height: 110px;
      background: #fff;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .qr-wrap .qr-label {
      font-size: 9px;
      color: #6b7280;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .sign-wrap { text-align: center; }
    .sign-wrap .sign-img {
      height: 46px;
      margin-bottom: 4px;
      object-fit: contain;
    }
    .sign-wrap .sign-line {
      border-top: 1.5px solid #333;
      width: 180px;
      margin: 0 auto 4px;
    }
    .sign-wrap .sign-label {
      font-size: 11px;
      font-weight: 700;
      color: #1A2A6C;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .footnote {
      margin-top: 26px;
      padding-top: 12px;
      border-top: 1px dashed #e5e7eb;
      font-size: 10px;
      color: #6b7280;
      text-align: center;
      line-height: 1.6;
    }
    .footnote b { color: #1A2A6C; }

    @media print {
      body {
        background: #fff;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
        padding: 20px;
      }
      .print-btn { display: none !important; }
    }
  </style>
</head>
<body>

  <button class="print-btn" onclick="window.print()">
    <i class="fa-solid fa-print"></i>
    Print / Save as PDF
  </button>

  <div class="page">
    <div class="watermark">PAID</div>

    <div class="content">

      <div class="header">
        ${schoolLogo
          ? `<div class="logo-wrap"><img src="${schoolLogo}" alt="Logo"></div>`
          : `<div class="logo-placeholder">${escapeHtml((schoolName || "S").charAt(0))}</div>`}
        <div class="title-block">
          <h1>${escapeHtml(schoolName || "School Name")}</h1>
          ${schoolAddress ? `<div class="address">${escapeHtml(schoolAddress)}</div>` : ""}
        </div>
        <div class="spacer"></div>
      </div>

      <div class="title-bar">
        <h2><i class="fa-solid fa-receipt"></i> Fee Receipt</h2>
        <span class="receipt-no">#${receiptNo}</span>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <div class="card-label"><i class="fa-solid fa-user"></i> Student Details</div>
          <div class="info-row"><span class="k">Name</span><span class="v">${escapeHtml(d.studentName) || "—"}</span></div>
          <div class="info-row"><span class="k">Class</span><span class="v">${escapeHtml(d.studentClass) || "—"}</span></div>
          <div class="info-row"><span class="k">Session</span><span class="v">${escapeHtml(d.academicYear) || "—"}</span></div>
        </div>
        <div class="info-card">
          <div class="card-label"><i class="fa-solid fa-credit-card"></i> Payment Details</div>
          <div class="info-row"><span class="k">Month</span><span class="v">${escapeHtml(d.monthName) || "—"}</span></div>
          <div class="info-row"><span class="k">Paid On</span><span class="v">${escapeHtml(d.paidOn) || generatedOn}</span></div>
          <div class="info-row"><span class="k">Receipt No.</span><span class="v">${receiptNo}</span></div>
        </div>
      </div>

      <div class="amount-block">
        <div class="left">
          <div class="lbl">Amount Received</div>
          <div class="words">${escapeHtml(amountInWords)}</div>
        </div>
        <div class="amt"><small>?</small>${Number(d.amount).toLocaleString("en-IN")}</div>
      </div>

      <div class="payment-meta">
        <div class="meta-item">
          <div class="mi-label"><i class="fa-regular fa-calendar"></i> Month</div>
          <div class="mi-value">${escapeHtml(d.monthName)}</div>
        </div>
        <div class="meta-item">
          <div class="mi-label"><i class="fa-solid fa-calendar-days"></i> Year</div>
          <div class="mi-value">${escapeHtml(d.academicYear)}</div>
        </div>
        <div class="meta-item">
          <div class="mi-label"><i class="fa-solid fa-circle-check"></i> Status</div>
          <div class="mi-value paid">PAID</div>
        </div>
      </div>

      <div class="bottom-row">
        <div class="qr-wrap">
          <img src="${qrUrl}" alt="QR Code">
          <div class="qr-label">Scan to verify</div>
        </div>

        <div class="sign-wrap">
          ${principalSign
            ? `<img src="${principalSign}" class="sign-img"><br>`
            : `<div style="height:46px"></div>`}
          <div class="sign-line"></div>
          <div class="sign-label">Principal</div>
        </div>
      </div>

      <div class="footnote">
        Generated on <b>${generatedOn}</b> at <b>${generatedTime}</b> · This is a computer-generated receipt.
        <br>Thank you for your payment!
      </div>

    </div>
  </div>

</body>
</html>
  `);

  w.document.close();
  w.focus();
}

// ============================================================
// Convert number to words — Indian numbering system
// ============================================================
function numberToWordsIndian(num) {
  num = Math.floor(Number(num) || 0);
  if (num === 0) return "Zero Rupees Only";

  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
  }

  function threeDigits(n) {
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + twoDigits(n%100) : "");
  }

  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore) result += threeDigits(crore) + " Crore ";
  if (lakh) result += twoDigits(lakh) + " Lakh ";
  if (thousand) result += twoDigits(thousand) + " Thousand ";
  if (num) result += threeDigits(num);

  return result.trim() + " Rupees Only";
}