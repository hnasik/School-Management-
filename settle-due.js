// settle-due.js — Settle with entered amount + settlement history
// NEW: Fully Settled Students list + Full Settlement Certificate PDF.
// NEW: "Settlement" button inside class modal ? shows fully settled students for that class.

const firebaseConfig = {
  apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
  authDomain: "school-management-projec-9db7a.firebaseapp.com",
  projectId: "school-management-projec-9db7a",
  storageBucket: "school-management-projec-9db7a.firebasestorage.app",
  messagingSenderId: "975842483778",
  appId: "1:975842483778:web:d1708792ff56014f3317db",
  measurementId: "G-1X2Q7LE6G3"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const FieldValue = firebase.firestore.FieldValue;

const ACADEMIC_YEAR_STORAGE_KEY = "smsAcademicYear";
function getSelectedAcademicYear() {
  let stored = localStorage.getItem(ACADEMIC_YEAR_STORAGE_KEY);
  if (!stored) {
    const currentYear = new Date().getFullYear();
    stored = String(currentYear);
    localStorage.setItem(ACADEMIC_YEAR_STORAGE_KEY, stored);
  }
  return String(stored);
}

// DOM Elements
const classGrid = document.getElementById("classGrid");
const classModal = document.getElementById("classModal");
const closeClassModal = document.getElementById("closeClassModal");
const classModalTitle = document.getElementById("classModalTitle");
const classModalSub = document.getElementById("classModalSub");
const dueListContainer = document.getElementById("dueListContainer");
const modalNoResults = document.getElementById("modalNoResults");
const showSettledClassBtn = document.getElementById("showSettledClassBtn");

const settledModal = document.getElementById("settledModal");
const closeSettledModal = document.getElementById("closeSettledModal");
const settledModalSub = document.getElementById("settledModalSub");
const settledListContainer = document.getElementById("settledListContainer");
const settledNoResults = document.getElementById("settledNoResults");
const showSettledBtn = document.getElementById("showSettledBtn");

let currentClass = null;
let lastLoadedStudents = [];
let cachedSchool = { name: "", address: "", logo: "", sign: "" };

// --- Helpers ---
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeClass(c) {
  let s = String(c || "").trim().toLowerCase();
  if (s === "kg1" || s === "nursery") return "nursery";
  if (s === "kg2" || s === "lkg") return "lkg";
  if (s === "pre_primary" || s === "preprimary") return "preprimary";
  return s;
}

function classLabelFromValue(v) {
  const map = {
    pre_primary: "Pre Primary",
    ukg: "UKG",
    kg1: "NURSERY",
    kg2: "LKG"
  };
  return map[String(v)] || `Class ${v}`;
}

async function loadSchoolBranding() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const snap = await db.collection("school_settings").doc(user.uid).get();
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
  if (!cachedSchool.logo) cachedSchool.logo = localStorage.getItem(`${user.uid}_schoolLogo`) || "";
  if (!cachedSchool.sign) cachedSchool.sign = localStorage.getItem(`${user.uid}_principalSign`) || "";
}

function renderClassCards() {
  if (!classGrid) return;
  classGrid.innerHTML = "";

  const classes = [
    { label: "Pre Primary", value: "pre_primary" },
    { label: "UKG", value: "ukg" },
    { label: "NURSERY", value: "kg1" },
    { label: "LKG", value: "kg2" },
    { label: "Class 1", value: "1" },
    { label: "Class 2", value: "2" },
    { label: "Class 3", value: "3" },
    { label: "Class 4", value: "4" },
    { label: "Class 5", value: "5" },
    { label: "Class 6", value: "6" },
    { label: "Class 7", value: "7" },
    { label: "Class 8", value: "8" },
    { label: "Class 9", value: "9" },
    { label: "Class 10", value: "10" },
    { label: "Class 11", value: "11" },
    { label: "Class 12", value: "12" }
  ];

  classes.forEach(cls => {
    const card = document.createElement("div");
    card.className = "class-card";
    card.dataset.class = cls.value;
    card.innerHTML = `
      <div class="num">${cls.label}</div>
      <div class="label">Students with dueAdmissionFee</div>
    `;
    card.addEventListener("click", () => openClassModal(cls.value));
    classGrid.appendChild(card);
  });
}

function getAdmissionTotalDocRef(ownerId, academicYear) {
  const docId = `${ownerId}_${academicYear}_admission`;
  return db.collection("admissionTotals").doc(docId);
}

// ============================================================
// Number to words — Indian numbering system
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

// ============================================================
// SETTLEMENT RECEIPT PDF (partial or full)
// ============================================================
async function openSettlementReceiptPDF(d) {
  if (!cachedSchool.name) await loadSchoolBranding();
  const w = window.open("", "_blank");
  if (!w) { alert("Pop-up blocked. Please allow pop-ups to see the receipt."); return; }

  const { name: schoolName, address: schoolAddress, logo: schoolLogo, sign: principalSign } = cachedSchool;
  const receiptNo = d.receiptNo || ("RCPT-" + Date.now().toString().slice(-8));
  const generatedOn = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const generatedTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const amountInWords = numberToWordsIndian(d.amountSettled);

  const fullyPaid = Number(d.newDue) <= 0;
  const statusColor = fullyPaid ? "#10b981" : "#f59e0b";
  const statusBg = fullyPaid ? "#ecfdf5" : "#fffbeb";

  const qrData = `
${schoolName}
Receipt: ${receiptNo}
Student: ${d.studentName}
Class: ${d.studentClass}
Session: ${d.academicYear}
Paid: Rs. ${d.amountSettled}
Remaining: Rs. ${d.newDue}
`.trim();
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=" + encodeURIComponent(qrData);

  w.document.write(`
<html>
<head>
  <title>Settlement Receipt — ${escapeHtml(d.studentName)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', 'Inter', Arial, sans-serif; color: #1a1410; background: #f3f4f6; padding: 20px; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #4a148c, #7b1fa2); color: #fff; border: none; padding: 12px 22px; border-radius: 999px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; box-shadow: 0 8px 24px rgba(74,20,140,0.35); display: inline-flex; align-items: center; gap: 8px; z-index: 100; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 32px 40px 28px; position: relative; overflow: hidden; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); font-size: 120px; font-weight: 900; color: rgba(74, 20, 140, 0.05); letter-spacing: 12px; pointer-events: none; user-select: none; z-index: 0; white-space: nowrap; }
    .content { position: relative; z-index: 1; }
    .header { display: flex; align-items: center; gap: 18px; padding-bottom: 16px; border-bottom: 3px double #4a148c; margin-bottom: 20px; }
    .header .logo-wrap { width: 78px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header .logo-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .header .logo-placeholder { width: 78px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f3e5f5; border-radius: 12px; color: #4a148c; font-size: 34px; font-weight: 800; border: 1px solid #ce93d8; }
    .header .title-block { flex: 1; text-align: center; }
    .header h1 { font-size: 24px; color: #4a148c; letter-spacing: 0.5px; margin-bottom: 4px; text-transform: uppercase; }
    .header .address { font-size: 12px; color: #555; }
    .header .spacer { width: 78px; flex-shrink: 0; }
    .title-bar { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #4a148c, #7b1fa2); color: #fff; padding: 12px 20px; border-radius: 10px; margin-bottom: 20px; gap: 10px; flex-wrap: wrap; }
    .title-bar h2 { font-size: 18px; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
    .title-bar .receipt-no { font-size: 12px; background: rgba(255,255,255,0.18); padding: 5px 12px; border-radius: 999px; font-weight: 600; letter-spacing: 0.5px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; }
    .info-card .card-label { font-size: 10px; font-weight: 800; color: #4a148c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #f3e5f5; display: flex; align-items: center; gap: 6px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
    .info-row .k { color: #6b7280; font-weight: 600; font-size: 12px; }
    .info-row .v { color: #111827; font-weight: 700; text-align: right; max-width: 60%; word-break: break-word; }
    .amount-block { background: linear-gradient(135deg, #f3e5f5, #ede7f6); border: 2px solid #7b1fa2; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
    .amount-block .left { position: relative; z-index: 1; }
    .amount-block .lbl { font-size: 11px; font-weight: 800; color: #4a148c; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; }
    .amount-block .words { font-size: 12px; color: #4a148c; font-style: italic; max-width: 340px; }
    .amount-block .amt { font-size: 38px; font-weight: 900; color: #4a148c; position: relative; z-index: 1; line-height: 1; letter-spacing: -1px; }
    .amount-block .amt small { font-size: 18px; font-weight: 700; opacity: 0.75; margin-right: 4px; }
    .breakdown { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    .bd-item { background: #fff; border: 1px solid #e5e7eb; border-top: 3px solid #7b1fa2; border-radius: 10px; padding: 14px 12px; text-align: center; }
    .bd-item.prev { border-top-color: #ef4444; }
    .bd-item.paid { border-top-color: #10b981; }
    .bd-item.due  { border-top-color: #f59e0b; }
    .bd-item .bd-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 800; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 5px; }
    .bd-item .bd-value { font-size: 20px; font-weight: 800; line-height: 1.1; }
    .bd-item.prev .bd-value { color: #dc2626; }
    .bd-item.paid .bd-value { color: #059669; }
    .bd-item.due  .bd-value { color: #d97706; }
    .status-row { display: flex; justify-content: center; margin-bottom: 24px; }
    .status-pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 20px; border-radius: 999px; font-size: 12px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; border: 2px solid ${statusColor}; color: ${statusColor}; background: ${statusBg}; }
    .bottom-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .qr-wrap img { width: 110px; height: 110px; background: #fff; padding: 4px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .qr-wrap .qr-label { font-size: 9px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
    .sign-wrap { text-align: center; }
    .sign-wrap .sign-img { height: 46px; margin-bottom: 4px; object-fit: contain; }
    .sign-wrap .sign-line { border-top: 1.5px solid #333; width: 180px; margin: 0 auto 4px; }
    .sign-wrap .sign-label { font-size: 11px; font-weight: 700; color: #4a148c; letter-spacing: 0.8px; text-transform: uppercase; }
    .footnote { margin-top: 26px; padding-top: 12px; border-top: 1px dashed #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; line-height: 1.6; }
    .footnote b { color: #4a148c; }
    @media print { body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { box-shadow: none; border-radius: 0; max-width: 100%; padding: 20px; } .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()"><i class="fa-solid fa-print"></i> Print / Save as PDF</button>
  <div class="page">
    <div class="watermark">${fullyPaid ? "PAID" : "PARTIAL"}</div>
    <div class="content">
      <div class="header">
        ${schoolLogo ? `<div class="logo-wrap"><img src="${schoolLogo}" alt="Logo"></div>` : `<div class="logo-placeholder">${escapeHtml((schoolName || "S").charAt(0))}</div>`}
        <div class="title-block">
          <h1>${escapeHtml(schoolName || "School Name")}</h1>
          ${schoolAddress ? `<div class="address">${escapeHtml(schoolAddress)}</div>` : ""}
        </div>
        <div class="spacer"></div>
      </div>
      <div class="title-bar">
        <h2><i class="fa-solid fa-receipt"></i> Due Settlement Receipt</h2>
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
          <div class="info-row"><span class="k">Date</span><span class="v">${generatedOn}</span></div>
          <div class="info-row"><span class="k">Time</span><span class="v">${generatedTime}</span></div>
          <div class="info-row"><span class="k">Receipt No.</span><span class="v">${receiptNo}</span></div>
        </div>
      </div>
      <div class="amount-block">
        <div class="left">
          <div class="lbl">Amount Paid</div>
          <div class="words">${escapeHtml(amountInWords)}</div>
        </div>
        <div class="amt"><small>?</small>${Number(d.amountSettled).toLocaleString("en-IN")}</div>
      </div>
      <div class="breakdown">
        <div class="bd-item prev"><div class="bd-label"><i class="fa-solid fa-arrow-up"></i> Previous Due</div><div class="bd-value">?${Number(d.previousDue).toLocaleString("en-IN")}</div></div>
        <div class="bd-item paid"><div class="bd-label"><i class="fa-solid fa-circle-check"></i> Amount Paid</div><div class="bd-value">?${Number(d.amountSettled).toLocaleString("en-IN")}</div></div>
        <div class="bd-item due"><div class="bd-label"><i class="fa-solid fa-arrow-down"></i> Remaining Due</div><div class="bd-value">?${Number(d.newDue).toLocaleString("en-IN")}</div></div>
      </div>
      <div class="status-row">
        <div class="status-pill">${fullyPaid ? '<i class="fa-solid fa-circle-check"></i> Fully Paid' : '<i class="fa-solid fa-clock"></i> Partial Payment'}</div>
      </div>
      <div class="bottom-row">
        <div class="qr-wrap"><img src="${qrUrl}" alt="QR Code"><div class="qr-label">Scan to verify</div></div>
        <div class="sign-wrap">
          ${principalSign ? `<img src="${principalSign}" class="sign-img"><br>` : `<div style="height:46px"></div>`}
          <div class="sign-line"></div>
          <div class="sign-label">Principal</div>
        </div>
      </div>
      <div class="footnote">
        Generated on <b>${generatedOn}</b> at <b>${generatedTime}</b> · This is a computer-generated receipt.
        <br>${fullyPaid ? "All dues for this session have been cleared. Thank you!" : "Please clear the remaining due amount at the earliest."}
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
// FULL SETTLEMENT CERTIFICATE PDF
// ============================================================
async function openFullSettlementCertificatePDF(d) {
  if (!cachedSchool.name) await loadSchoolBranding();
  const w = window.open("", "_blank");
  if (!w) { alert("Pop-up blocked. Please allow pop-ups to see the certificate."); return; }

  const { name: schoolName, address: schoolAddress, logo: schoolLogo, sign: principalSign } = cachedSchool;
  const certNo = "CERT-" + (d.studentId || Date.now()).toString().slice(-8).toUpperCase();
  const generatedOn = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const generatedTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const totalPaidWords = numberToWordsIndian(d.totalPaid);

  const paymentRows = d.payments.map((p, i) => {
    const settledDate = p.settledAt ? (p.settledAt.toDate ? p.settledAt.toDate() : new Date(p.settledAt)) : null;
    const dateStr = settledDate ? settledDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    return `
      <tr>
        <td style="text-align:center; font-weight:700; color:#4a148c; background:#f3e5f5; width:38px;">${i + 1}</td>
        <td>${escapeHtml(p.studentClass || d.studentClass || "—")}</td>
        <td style="text-align:center;">${escapeHtml(String(p.academicYear || d.academicYear || "—"))}</td>
        <td style="text-align:right; color:#dc2626; font-weight:700;">?${Number(p.previousDue || 0).toLocaleString("en-IN")}</td>
        <td style="text-align:right; color:#059669; font-weight:700;">?${Number(p.amountSettled || 0).toLocaleString("en-IN")}</td>
        <td style="text-align:right; color:#d97706; font-weight:700;">?${Number(p.newDue || 0).toLocaleString("en-IN")}</td>
        <td style="text-align:center; color:#6b7280;">${escapeHtml(dateStr)}</td>
      </tr>
    `;
  }).join("");

  const qrData = `
${schoolName}
Certificate: ${certNo}
Student: ${d.name}
Class: ${d.studentClass}
Session: ${d.academicYear}
Total Paid: Rs. ${d.totalPaid}
Status: FULLY SETTLED
`.trim();
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=" + encodeURIComponent(qrData);

  w.document.write(`
<html>
<head>
  <title>Full Settlement Certificate — ${escapeHtml(d.name)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', 'Inter', Arial, sans-serif; color: #1a1410; background: #f3f4f6; padding: 20px; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 12px 22px; border-radius: 999px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; box-shadow: 0 8px 24px rgba(16,185,129,0.4); display: inline-flex; align-items: center; gap: 8px; z-index: 100; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 32px 40px 28px; position: relative; overflow: hidden; border-top: 6px solid #10b981; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-22deg); font-size: 100px; font-weight: 900; color: rgba(16, 185, 129, 0.07); letter-spacing: 8px; pointer-events: none; user-select: none; z-index: 0; white-space: nowrap; text-align: center; line-height: 1; }
    .content { position: relative; z-index: 1; }
    .header { display: flex; align-items: center; gap: 18px; padding-bottom: 16px; border-bottom: 3px double #10b981; margin-bottom: 20px; }
    .header .logo-wrap { width: 78px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header .logo-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .header .logo-placeholder { width: 78px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #ecfdf5; border-radius: 12px; color: #059669; font-size: 34px; font-weight: 800; border: 1px solid #a7f3d0; }
    .header .title-block { flex: 1; text-align: center; }
    .header h1 { font-size: 24px; color: #059669; letter-spacing: 0.5px; margin-bottom: 4px; text-transform: uppercase; }
    .header .address { font-size: 12px; color: #555; }
    .header .spacer { width: 78px; flex-shrink: 0; }
    .title-bar { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #10b981, #059669); color: #fff; padding: 14px 22px; border-radius: 10px; margin-bottom: 20px; gap: 10px; flex-wrap: wrap; }
    .title-bar h2 { font-size: 18px; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
    .title-bar .cert-no { font-size: 12px; background: rgba(255,255,255,0.22); padding: 5px 12px; border-radius: 999px; font-weight: 600; letter-spacing: 0.5px; }
    .big-badge { display: flex; justify-content: center; margin-bottom: 20px; }
    .big-badge-inner { display: inline-flex; align-items: center; gap: 12px; padding: 12px 30px; border-radius: 999px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-size: 15px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35); }
    .big-badge-inner i { font-size: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; }
    .info-card .card-label { font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #d1fae5; display: flex; align-items: center; gap: 6px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
    .info-row .k { color: #6b7280; font-weight: 600; font-size: 12px; }
    .info-row .v { color: #111827; font-weight: 700; text-align: right; max-width: 60%; word-break: break-word; }
    .amount-block { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 2px solid #10b981; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
    .amount-block .left { position: relative; z-index: 1; }
    .amount-block .lbl { font-size: 11px; font-weight: 800; color: #059669; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; }
    .amount-block .words { font-size: 12px; color: #065f46; font-style: italic; max-width: 340px; }
    .amount-block .amt { font-size: 40px; font-weight: 900; color: #065f46; position: relative; z-index: 1; line-height: 1; letter-spacing: -1px; }
    .amount-block .amt small { font-size: 18px; font-weight: 700; opacity: 0.75; margin-right: 4px; }
    .section-title-small { font-size: 12px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #d1fae5; display: flex; align-items: center; gap: 8px; }
    .payments-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; font-size: 11.5px; }
    .payments-table thead { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
    .payments-table th { padding: 9px 8px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .payments-table th.center { text-align: center; }
    .payments-table th.right { text-align: right; }
    .payments-table td { padding: 8px; border-bottom: 1px solid #eef2f7; vertical-align: middle; }
    .payments-table tbody tr:nth-child(even) { background: #f9fafb; }
    .payments-table tbody tr:last-child td { border-bottom: none; }
    .bottom-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .qr-wrap img { width: 110px; height: 110px; background: #fff; padding: 4px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .qr-wrap .qr-label { font-size: 9px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
    .sign-wrap { text-align: center; }
    .sign-wrap .sign-img { height: 46px; margin-bottom: 4px; object-fit: contain; }
    .sign-wrap .sign-line { border-top: 1.5px solid #333; width: 180px; margin: 0 auto 4px; }
    .sign-wrap .sign-label { font-size: 11px; font-weight: 700; color: #059669; letter-spacing: 0.8px; text-transform: uppercase; }
    .footnote { margin-top: 26px; padding-top: 12px; border-top: 1px dashed #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; line-height: 1.6; }
    .footnote b { color: #059669; }
    @media print { body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { box-shadow: none; border-radius: 0; max-width: 100%; padding: 20px; } .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()"><i class="fa-solid fa-print"></i> Print / Save as PDF</button>
  <div class="page">
    <div class="watermark">FULLY<br>SETTLED</div>
    <div class="content">
      <div class="header">
        ${schoolLogo ? `<div class="logo-wrap"><img src="${schoolLogo}" alt="Logo"></div>` : `<div class="logo-placeholder">${escapeHtml((schoolName || "S").charAt(0))}</div>`}
        <div class="title-block">
          <h1>${escapeHtml(schoolName || "School Name")}</h1>
          ${schoolAddress ? `<div class="address">${escapeHtml(schoolAddress)}</div>` : ""}
        </div>
        <div class="spacer"></div>
      </div>
      <div class="title-bar">
        <h2><i class="fa-solid fa-certificate"></i> Full Settlement Certificate</h2>
        <span class="cert-no">#${certNo}</span>
      </div>
      <div class="big-badge">
        <div class="big-badge-inner"><i class="fa-solid fa-circle-check"></i> Fully Settled</div>
      </div>
      <div class="info-grid">
        <div class="info-card">
          <div class="card-label"><i class="fa-solid fa-user"></i> Student Details</div>
          <div class="info-row"><span class="k">Name</span><span class="v">${escapeHtml(d.name) || "—"}</span></div>
          <div class="info-row"><span class="k">Class</span><span class="v">${escapeHtml(d.studentClass) || "—"}</span></div>
          <div class="info-row"><span class="k">Session</span><span class="v">${escapeHtml(d.academicYear) || "—"}</span></div>
        </div>
        <div class="info-card">
          <div class="card-label"><i class="fa-solid fa-file-invoice"></i> Certificate Details</div>
          <div class="info-row"><span class="k">Date</span><span class="v">${generatedOn}</span></div>
          <div class="info-row"><span class="k">Time</span><span class="v">${generatedTime}</span></div>
          <div class="info-row"><span class="k">Certificate No.</span><span class="v">${certNo}</span></div>
        </div>
      </div>
      <div class="amount-block">
        <div class="left">
          <div class="lbl">Total Amount Paid</div>
          <div class="words">${escapeHtml(totalPaidWords)}</div>
        </div>
        <div class="amt"><small>?</small>${Number(d.totalPaid).toLocaleString("en-IN")}</div>
      </div>
      <div class="section-title-small"><i class="fa-solid fa-list-ul"></i> Complete Payment History</div>
      <table class="payments-table">
        <thead>
          <tr>
            <th class="center">#</th>
            <th>Class</th>
            <th class="center">Session</th>
            <th class="right">Previous Due</th>
            <th class="right">Amount Paid</th>
            <th class="right">New Due</th>
            <th class="center">Date</th>
          </tr>
        </thead>
        <tbody>${paymentRows}</tbody>
      </table>
      <div class="bottom-row">
        <div class="qr-wrap"><img src="${qrUrl}" alt="QR Code"><div class="qr-label">Scan to verify</div></div>
        <div class="sign-wrap">
          ${principalSign ? `<img src="${principalSign}" class="sign-img"><br>` : `<div style="height:46px"></div>`}
          <div class="sign-line"></div>
          <div class="sign-label">Principal</div>
        </div>
      </div>
      <div class="footnote">
        Generated on <b>${generatedOn}</b> at <b>${generatedTime}</b> · This is a computer-generated certificate.
        <br>This certifies that <b>${escapeHtml(d.name)}</b> has fully settled all outstanding dues. Thank you!
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
// NEW: Show settled students for a specific class (inside class modal)
// ============================================================
async function showClassSettledStudents(cls) {
  const user = auth.currentUser;
  if (!user) { alert("Please sign in."); return; }

  const displayClass = classLabelFromValue(cls);

  classModalTitle.innerHTML = `<i class="fas fa-circle-check" style="color:#10b981;"></i> ${escapeHtml(displayClass)} — Fully Settled`;
  classModalSub.textContent = "Loading settled students for this class...";
  dueListContainer.innerHTML = "";
  if (modalNoResults) modalNoResults.style.display = "none";

  // Hide the settlement button while we're in this view
  if (showSettledClassBtn) showSettledClassBtn.style.display = "none";

  try {
    const snap = await db
      .collection("settlementHistory")
      .orderBy("settledAt", "desc")
      .limit(1000)
      .get();

    const ownerDocs = snap.docs.filter(
      (doc) => (doc.data().ownerId || null) === user.uid
    );

    const wantedClass = normalizeClass(cls);

    // Filter by class
    const classDocs = ownerDocs.filter((doc) => {
      const d = doc.data();
      return normalizeClass(d.studentClass) === wantedClass;
    });

    if (classDocs.length === 0) {
      const msg = `No settlement history found for ${displayClass}.`;
      classModalSub.textContent = msg;
      if (modalNoResults) {
        modalNoResults.innerHTML =
          `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
        modalNoResults.style.display = "block";
      }
      // Show back button to return to due list
      const backWrap = document.createElement("div");
      backWrap.style.marginTop = "12px";
      backWrap.innerHTML =
        `<button class="btn btn-primary" id="settled-class-back">Back to Due List</button>`;
      dueListContainer.appendChild(backWrap);
      document.getElementById("settled-class-back").addEventListener("click", () => {
        openClassModal(cls);
      });
      return;
    }

    // Group by studentId
    const byStudent = {};
    classDocs.forEach((doc) => {
      const d = doc.data();
      if (!d.studentId) return;
      if (!byStudent[d.studentId]) byStudent[d.studentId] = [];
      byStudent[d.studentId].push({
        id: doc.id,
        ...d,
        settledAtDate: d.settledAt ? d.settledAt.toDate() : null
      });
    });

    // Keep only students whose latest payment cleared to 0
    const fullySettled = [];
    Object.keys(byStudent).forEach((sid) => {
      const payments = byStudent[sid].sort((a, b) => {
        const ta = a.settledAtDate ? a.settledAtDate.getTime() : 0;
        const tb = b.settledAtDate ? b.settledAtDate.getTime() : 0;
        return tb - ta;
      });
      const latest = payments[0];
      if (Number(latest.newDue) <= 0) {
        fullySettled.push({
          studentId: sid,
          name: latest.studentName || "Unnamed",
          studentClass: latest.studentClass || displayClass,
          academicYear: latest.academicYear || "—",
          payments,
          totalPaid: payments.reduce((s, p) => s + Number(p.amountSettled || 0), 0),
          lastSettledAt: latest.settledAtDate
        });
      }
    });

    if (fullySettled.length === 0) {
      const msg = `No students have fully settled their dues in ${displayClass} yet.`;
      classModalSub.textContent = msg;
      if (modalNoResults) {
        modalNoResults.innerHTML =
          `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
        modalNoResults.style.display = "block";
      }
      const backWrap = document.createElement("div");
      backWrap.style.marginTop = "12px";
      backWrap.innerHTML =
        `<button class="btn btn-primary" id="settled-class-back">Back to Due List</button>`;
      dueListContainer.appendChild(backWrap);
      document.getElementById("settled-class-back").addEventListener("click", () => {
        openClassModal(cls);
      });
      return;
    }

    // Sort by latest settlement date (most recent first)
    fullySettled.sort((a, b) => {
      const ta = a.lastSettledAt ? a.lastSettledAt.getTime() : 0;
      const tb = b.lastSettledAt ? b.lastSettledAt.getTime() : 0;
      return tb - ta;
    });

    classModalSub.textContent = `${fullySettled.length} fully settled student(s) in ${displayClass}`;

    // Build each card with inline history
    fullySettled.forEach((s, idx) => {
      const card = document.createElement("div");
      card.className = "settled-student-card";

      const lastDate = s.lastSettledAt
        ? s.lastSettledAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "—";

      // Build payment history rows
      const historyRows = s.payments.map((p, i) => {
        const dt = p.settledAtDate
          ? p.settledAtDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "—";
        return `
          <div class="ssc-history-row">
            <div class="idx">${i + 1}</div>
            <div class="date"><i class="fas fa-calendar-day" style="opacity:.6;margin-right:4px;"></i>${escapeHtml(dt)}</div>
            <div class="prev">?${Number(p.previousDue || 0).toLocaleString("en-IN")}</div>
            <div class="arrow"><i class="fas fa-arrow-right"></i></div>
            <div>
              <span class="amt">Paid ?${Number(p.amountSettled || 0).toLocaleString("en-IN")}</span>
              <span style="color:#6b7280;font-size:.72rem;"> · New due </span>
              <span class="newdue">?${Number(p.newDue || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        `;
      }).join("");

      card.innerHTML = `
        <div class="ssc-header">
          <div class="ssc-left">
            <div class="ssc-name">
              <i class="fas fa-circle-check check-icon"></i>
              ${escapeHtml(s.name)}
              <span class="ssc-badge"><i class="fas fa-check"></i> FULLY SETTLED</span>
            </div>
            <div class="ssc-meta">
              <b>Class:</b> ${escapeHtml(String(s.studentClass))}
              &nbsp;·&nbsp;
              <b>Session:</b> ${escapeHtml(String(s.academicYear))}
              &nbsp;·&nbsp;
              <b>Payments:</b> ${s.payments.length}
              &nbsp;·&nbsp;
              <b>Last:</b> ${escapeHtml(lastDate)}
            </div>
            <div class="ssc-meta" style="margin-top:8px;">
              <b>Total Paid:</b>
              <span class="ssc-total">?${Number(s.totalPaid).toLocaleString("en-IN")}</span>
              &nbsp;·&nbsp;
              <b>Remaining Due:</b>
              <span style="color:#059669;font-weight:800;">?0</span>
            </div>
          </div>
          <div>
            <button class="ssc-print-btn" data-idx="${idx}">
              <i class="fas fa-print"></i> Print Certificate
            </button>
          </div>
        </div>
        <div class="ssc-history">
          <div class="ssc-history-title">
            <i class="fas fa-list-ul"></i> Settlement History
          </div>
          <div class="ssc-history-list">
            ${historyRows}
          </div>
        </div>
      `;
      dueListContainer.appendChild(card);
    });

    // Attach print handlers
    dueListContainer.querySelectorAll(".ssc-print-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const s = fullySettled[idx];
        openFullSettlementCertificatePDF({
          studentId: s.studentId,
          name: s.name,
          studentClass: s.studentClass,
          academicYear: s.academicYear,
          payments: s.payments,
          totalPaid: s.totalPaid
        });
      });
    });

    // Back button
    const backBtn = document.createElement("div");
    backBtn.style.marginTop = "16px";
    backBtn.style.textAlign = "center";
    backBtn.innerHTML =
      `<button class="btn btn-primary" id="settled-class-back"><i class="fas fa-arrow-left"></i> Back to Due List</button>`;
    dueListContainer.appendChild(backBtn);
    document.getElementById("settled-class-back").addEventListener("click", () => {
      openClassModal(cls);
    });

  } catch (err) {
    console.error("Error loading class settled students", err);
    classModalSub.textContent = "Failed to load settled students (see console).";
    if (modalNoResults) {
      modalNoResults.innerHTML =
        `<i class="fas fa-exclamation-circle"></i> Failed to load settled students.`;
      modalNoResults.style.display = "block";
    }
  }
}

// ============================================================
// Load fully settled students (global banner view)
// ============================================================
async function loadFullySettledStudents() {
  const user = auth.currentUser;
  if (!user) { alert("Please sign in first."); return; }

  settledModal.classList.add("show");
  settledModalSub.textContent = "Loading...";
  settledListContainer.innerHTML = "";
  if (settledNoResults) settledNoResults.style.display = "none";

  try {
    const snap = await db
      .collection("settlementHistory")
      .orderBy("settledAt", "desc")
      .limit(1000)
      .get();

    const ownerDocs = snap.docs.filter(
      (doc) => (doc.data().ownerId || null) === user.uid
    );

    if (ownerDocs.length === 0) {
      settledModalSub.textContent = "No settlement records yet.";
      if (settledNoResults) settledNoResults.style.display = "flex";
      return;
    }

    const byStudent = {};
    ownerDocs.forEach((doc) => {
      const d = doc.data();
      if (!d.studentId) return;
      if (!byStudent[d.studentId]) byStudent[d.studentId] = [];
      byStudent[d.studentId].push({
        id: doc.id,
        ...d,
        settledAtDate: d.settledAt ? d.settledAt.toDate() : null
      });
    });

    const fullySettled = [];
    Object.keys(byStudent).forEach((sid) => {
      const payments = byStudent[sid].sort((a, b) => {
        const ta = a.settledAtDate ? a.settledAtDate.getTime() : 0;
        const tb = b.settledAtDate ? b.settledAtDate.getTime() : 0;
        return tb - ta;
      });
      const latest = payments[0];
      if (Number(latest.newDue) <= 0) {
        fullySettled.push({
          studentId: sid,
          name: latest.studentName || "Unnamed",
          studentClass: latest.studentClass || "—",
          academicYear: latest.academicYear || "—",
          payments,
          totalPaid: payments.reduce((sum, p) => sum + Number(p.amountSettled || 0), 0),
          lastSettledAt: latest.settledAtDate
        });
      }
    });

    fullySettled.sort((a, b) => {
      const ta = a.lastSettledAt ? a.lastSettledAt.getTime() : 0;
      const tb = b.lastSettledAt ? b.lastSettledAt.getTime() : 0;
      return tb - ta;
    });

    if (fullySettled.length === 0) {
      settledModalSub.textContent = "No students have fully settled their dues yet.";
      if (settledNoResults) settledNoResults.style.display = "flex";
      return;
    }

    settledModalSub.textContent = `${fullySettled.length} fully settled student(s)`;

    fullySettled.forEach((s, idx) => {
      const card = document.createElement("div");
      card.className = "settled-student-card";

      const lastDate = s.lastSettledAt
        ? s.lastSettledAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "—";

      const historyRows = s.payments.map((p, i) => {
        const dt = p.settledAtDate
          ? p.settledAtDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "—";
        return `
          <div class="ssc-history-row">
            <div class="idx">${i + 1}</div>
            <div class="date"><i class="fas fa-calendar-day" style="opacity:.6;margin-right:4px;"></i>${escapeHtml(dt)}</div>
            <div class="prev">?${Number(p.previousDue || 0).toLocaleString("en-IN")}</div>
            <div class="arrow"><i class="fas fa-arrow-right"></i></div>
            <div>
              <span class="amt">Paid ?${Number(p.amountSettled || 0).toLocaleString("en-IN")}</span>
              <span style="color:#6b7280;font-size:.72rem;"> · New due </span>
              <span class="newdue">?${Number(p.newDue || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        `;
      }).join("");

      card.innerHTML = `
        <div class="ssc-header">
          <div class="ssc-left">
            <div class="ssc-name">
              <i class="fas fa-circle-check check-icon"></i>
              ${escapeHtml(s.name)}
              <span class="ssc-badge"><i class="fas fa-check"></i> FULLY SETTLED</span>
            </div>
            <div class="ssc-meta">
              <b>Class:</b> ${escapeHtml(String(s.studentClass))}
              &nbsp;·&nbsp;
              <b>Session:</b> ${escapeHtml(String(s.academicYear))}
              &nbsp;·&nbsp;
              <b>Payments:</b> ${s.payments.length}
              &nbsp;·&nbsp;
              <b>Last:</b> ${escapeHtml(lastDate)}
            </div>
            <div class="ssc-meta" style="margin-top:8px;">
              <b>Total Paid:</b>
              <span class="ssc-total">?${Number(s.totalPaid).toLocaleString("en-IN")}</span>
              &nbsp;·&nbsp;
              <b>Remaining Due:</b>
              <span style="color:#059669;font-weight:800;">?0</span>
            </div>
          </div>
          <div>
            <button class="ssc-print-btn" data-idx="${idx}">
              <i class="fas fa-print"></i> Print Certificate
            </button>
          </div>
        </div>
        <div class="ssc-history">
          <div class="ssc-history-title">
            <i class="fas fa-list-ul"></i> Settlement History
          </div>
          <div class="ssc-history-list">
            ${historyRows}
          </div>
        </div>
      `;
      settledListContainer.appendChild(card);
    });

    settledListContainer.querySelectorAll(".ssc-print-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const s = fullySettled[idx];
        openFullSettlementCertificatePDF({
          studentId: s.studentId,
          name: s.name,
          studentClass: s.studentClass,
          academicYear: s.academicYear,
          payments: s.payments,
          totalPaid: s.totalPaid
        });
      });
    });

  } catch (err) {
    console.error("Error loading fully settled students", err);
    settledModalSub.textContent = "Failed to load settled students (see console).";
    if (settledNoResults) {
      settledNoResults.innerHTML =
        `<i class="fas fa-exclamation-circle"></i> Failed to load settled students.`;
      settledNoResults.style.display = "flex";
    }
  }
}

// ============================================================
// Student-specific settlement history view
// ============================================================
async function showStudentSettlementHistory(studentId, studentName) {
  const user = auth.currentUser;
  if (!user) { alert("Please sign in to see student history."); return; }

  classModalTitle.textContent = `Settlement History — ${studentName}`;
  classModalSub.textContent = "Loading student settlement history...";
  dueListContainer.innerHTML = "";
  if (modalNoResults) modalNoResults.style.display = "none";
  if (showSettledClassBtn) showSettledClassBtn.style.display = "none";

  try {
    const snap = await db
      .collection("settlementHistory")
      .orderBy("settledAt", "desc")
      .limit(300)
      .get();

    const docs = snap.docs.filter((doc) => {
      const d = doc.data();
      return (d.ownerId || null) === user.uid && (d.studentId || null) === studentId;
    });

    if (!docs.length) {
      const msg = "No settlement history found for this student.";
      classModalSub.textContent = msg;
      if (modalNoResults) {
        modalNoResults.innerHTML =
          `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
        modalNoResults.style.display = "block";
      }
      const backWrap = document.createElement("div");
      backWrap.style.marginTop = "10px";
      backWrap.innerHTML =
        `<button class="btn btn-primary" id="student-history-back">Back</button>`;
      dueListContainer.appendChild(backWrap);
      document.getElementById("student-history-back").addEventListener("click", () => {
        if (currentClass) classModalTitle.textContent = `Class ${currentClass} — Due Admission Fee`;
        renderStudentListFromCache();
      });
      return;
    }

    classModalSub.textContent = `Showing ${docs.length} settlements for this student`;
    dueListContainer.innerHTML = "";

    docs.forEach((doc, idx) => {
      const d = doc.data();
      const settledAt = d.settledAt ? d.settledAt.toDate() : null;
      const timeStr = settledAt ? settledAt.toLocaleString() : "—";

      const div = document.createElement("div");
      div.className = "student-card";
      div.style.background = "#fff";
      div.style.alignItems = "center";
      div.innerHTML = `
        <div style="flex:1">
          <div style="font-weight:700">Payment #${idx + 1}</div>
          <div class="txt-muted" style="font-size:.9rem">
            Settled: ?${escapeHtml(String(d.amountSettled || "0"))}
            (Prev: ?${escapeHtml(String(d.previousDue || "0"))}
             ? New: ?${escapeHtml(String(d.newDue || "0"))})
          </div>
          <div class="txt-muted" style="font-size:.85rem">
            By: ${escapeHtml(d.settledByEmail || d.settledBy || "")} · ${escapeHtml(timeStr)}
          </div>
        </div>
        <button class="btn btn-primary print-single-receipt" data-idx="${idx}" style="padding:8px 14px;">
          <i class="fas fa-print"></i> Print
        </button>
      `;
      dueListContainer.appendChild(div);
    });

    dueListContainer.querySelectorAll(".print-single-receipt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const d = docs[idx].data();
        openSettlementReceiptPDF({
          studentName: d.studentName,
          studentClass: d.studentClass,
          academicYear: d.academicYear,
          previousDue: Number(d.previousDue || 0),
          amountSettled: Number(d.amountSettled || 0),
          newDue: Number(d.newDue || 0),
          receiptNo: (docs[idx].id || "").slice(-8).toUpperCase(),
          settledAt: d.settledAt ? d.settledAt.toDate() : new Date()
        });
      });
    });

    const backBtn = document.createElement("div");
    backBtn.style.marginTop = "10px";
    backBtn.innerHTML =
      `<button class="btn btn-primary" id="student-history-back">Back</button>`;
    dueListContainer.appendChild(backBtn);
    document.getElementById("student-history-back").addEventListener("click", () => {
      if (currentClass) classModalTitle.textContent = `Class ${currentClass} — Due Admission Fee`;
      renderStudentListFromCache();
    });
  } catch (err) {
    console.error("Error loading student history", err);
    classModalSub.textContent = "Failed to load student history (see console).";
    if (modalNoResults) {
      modalNoResults.innerHTML =
        `<i class="fas fa-exclamation-circle"></i> Failed to load student history.`;
      modalNoResults.style.display = "block";
    }
  }
}

// ============================================================
// All settlement history view
// ============================================================
async function showSettlementHistory() {
  const user = auth.currentUser;
  if (!user) { alert("Please sign in to see settlement history."); return; }

  const academicYear = getSelectedAcademicYear();

  classModalTitle.textContent = "Settlement History";
  classModalSub.textContent = `Loading settlement history...`;
  dueListContainer.innerHTML = "";
  if (modalNoResults) modalNoResults.style.display = "none";
  if (showSettledClassBtn) showSettledClassBtn.style.display = "none";

  try {
    const snap = await db.collection("settlementHistory")
      .orderBy("settledAt", "desc")
      .limit(500)
      .get();

    const ownerDocs = snap.docs.filter(
      (doc) => (doc.data().ownerId || null) === user.uid
    );

    if (!ownerDocs || ownerDocs.length === 0) {
      const msg = "No settlement history found.";
      classModalSub.textContent = msg;
      if (modalNoResults) {
        modalNoResults.innerHTML =
          `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
        modalNoResults.style.display = "block";
      }
      return;
    }

    classModalSub.textContent = `Showing ${ownerDocs.length} recent settlements`;
    dueListContainer.innerHTML = "";

    try {
      const totalRef = getAdmissionTotalDocRef(user.uid, academicYear);
      const totalSnap = await totalRef.get();
      if (totalSnap.exists) {
        const td = totalSnap.data();
        const totalAmount = Number(td.totalPaidAdmissionAmount || 0);
        const updatedAt = td.updatedAt ? td.updatedAt.toDate() : null;
        const updatedStr = updatedAt ? updatedAt.toLocaleString() : "—";

        const totalDiv = document.createElement("div");
        totalDiv.className = "notification notification-success";
        totalDiv.style.marginBottom = "1rem";
        totalDiv.innerHTML = `
          <i class="fas fa-coins"></i>
          <div>
            <div style="font-weight:600">Total Paid Admission Amount (${escapeHtml(academicYear)})</div>
            <div style="font-size:.9rem">?${escapeHtml(totalAmount.toFixed(2))} · Last updated: ${escapeHtml(updatedStr)}</div>
          </div>
        `;
        dueListContainer.appendChild(totalDiv);
      }
    } catch (totalErr) { console.error("Error loading admission total", totalErr); }

    ownerDocs.forEach((doc, idx) => {
      const d = doc.data();
      const settledAt = d.settledAt ? d.settledAt.toDate() : null;
      const timeStr = settledAt ? settledAt.toLocaleString() : "—";

      const div = document.createElement("div");
      div.className = "student-card";
      div.style.background = "#fff";
      div.style.alignItems = "center";
      div.innerHTML = `
        <div style="flex:1">
          <div style="font-weight:700">${escapeHtml(d.studentName || "Unnamed")}</div>
          <div class="txt-muted" style="font-size:.9rem">
            Class: ${escapeHtml(String(d.studentClass || "—"))} &nbsp; | &nbsp;
            Settled: ?${escapeHtml(String(d.amountSettled || "0"))}
            (Prev: ?${escapeHtml(String(d.previousDue || "0"))} ? New: ?${escapeHtml(String(d.newDue || "0"))})
          </div>
          <div class="txt-muted" style="font-size:.85rem">
            By: ${escapeHtml(d.settledByEmail || d.settledBy || "")} · ${escapeHtml(timeStr)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <div style="color:#6b7280">#${idx + 1}</div>
          <button class="btn btn-primary print-single-receipt" data-idx="${idx}" style="padding:8px 14px;">
            <i class="fas fa-print"></i> Print
          </button>
        </div>
      `;
      dueListContainer.appendChild(div);
    });

    dueListContainer.querySelectorAll(".print-single-receipt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const d = ownerDocs[idx].data();
        openSettlementReceiptPDF({
          studentName: d.studentName,
          studentClass: d.studentClass,
          academicYear: d.academicYear,
          previousDue: Number(d.previousDue || 0),
          amountSettled: Number(d.amountSettled || 0),
          newDue: Number(d.newDue || 0),
          receiptNo: (ownerDocs[idx].id || "").slice(-8).toUpperCase(),
          settledAt: d.settledAt ? d.settledAt.toDate() : new Date()
        });
      });
    });

    const backBtn = document.createElement("div");
    backBtn.style.marginTop = "10px";
    backBtn.innerHTML =
      `<button class="btn btn-primary" id="settle-history-back">Back</button>`;
    dueListContainer.appendChild(backBtn);
    document.getElementById("settle-history-back").addEventListener("click", () => {
      if (currentClass) openClassModal(currentClass);
      else {
        classModal.classList.remove("show");
        dueListContainer.innerHTML = "";
        if (modalNoResults) modalNoResults.style.display = "none";
      }
    });
  } catch (err) {
    console.error("Error loading settlement history", err);
    classModalSub.textContent = "Failed to load history (see console).";
    if (modalNoResults) {
      modalNoResults.innerHTML =
        `<i class="fas fa-exclamation-circle"></i> Failed to load settlement history.`;
      modalNoResults.style.display = "block";
    }
  }
}

// ============================================================
// Perform settlement
// ============================================================
async function settleStudentAmount(studentDoc, amount) {
  const user = auth.currentUser;
  if (!user) { alert("Please sign in to perform settlement."); return; }

  const studentId = studentDoc.id;
  const data = studentDoc.data();
  const previousDue = Number(data.dueFee || 0);
  const studentName = data.name || data.studentName || "Unnamed";
  const studentClass = data.studentClass || data.class || data.student_class || currentClass || "—";
  const academicYearFromStudent = data.academicYear || getSelectedAcademicYear();

  if (isNaN(amount) || amount <= 0) { alert("Please enter a valid positive amount."); return; }
  if (amount > previousDue) {
    alert(`Entered amount (?${amount}) is greater than due amount (?${previousDue}). Please enter = ?${previousDue}.`);
    return;
  }

  const newDue = Number((previousDue - amount).toFixed(2));

  if (!confirm(`Settle ?${amount} for ${studentName} (Class ${studentClass}, ${academicYearFromStudent})?`)) return;

  try {
    const studentRef = db.collection("students").doc(studentId);
    const historyRef = db.collection("settlementHistory").doc();

    const ownerIdForDoc = data.ownerId || user.uid;
    const academicYearStr = String(academicYearFromStudent);
    const totalRef = getAdmissionTotalDocRef(ownerIdForDoc, academicYearStr);

    const batch = db.batch();
    batch.set(historyRef, {
      studentId,
      studentName,
      studentClass: String(studentClass),
      previousDue,
      amountSettled: amount,
      newDue,
      settledBy: user.uid,
      settledByEmail: user.email || null,
      ownerId: ownerIdForDoc,
      academicYear: academicYearStr,
      settledAt: FieldValue.serverTimestamp(),
      note: "Settled via Settle Due page (entered amount)"
    });
    batch.update(studentRef, { dueFee: newDue });
    batch.set(totalRef, {
      ownerId: ownerIdForDoc,
      academicYear: academicYearStr,
      totalPaidAdmissionAmount: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    lastLoadedStudents = lastLoadedStudents.map((s) => {
      if (s.id === studentId) {
        const oldData = typeof s.data === "function" ? s.data() : s._rawData || {};
        const newData = Object.assign({}, oldData, { dueFee: newDue });
        return { id: s.id, data: () => newData, _rawData: newData };
      }
      return s;
    });
    if (newDue <= 0) lastLoadedStudents = lastLoadedStudents.filter((s) => s.id !== studentId);

    renderStudentListFromCache();

    const receiptNo = (historyRef.id || "").slice(-8).toUpperCase() || ("RCPT-" + Date.now().toString().slice(-8));
    openSettlementReceiptPDF({
      studentName,
      studentClass: String(studentClass),
      academicYear: academicYearStr,
      previousDue,
      amountSettled: amount,
      newDue,
      receiptNo,
      settledAt: new Date()
    });
  } catch (err) {
    console.error("Error performing settlement", err);
    alert("Failed to settle due (see console).");
  }
}

// ============================================================
// Render list of students with due for a class
// ============================================================
function renderStudentListFromCache() {
  dueListContainer.innerHTML = "";
  // Show the Settlement button again when we come back to due list
  if (showSettledClassBtn) showSettledClassBtn.style.display = "inline-flex";

  if (!lastLoadedStudents || lastLoadedStudents.length === 0) {
    classModalSub.textContent = "No due students found.";
    if (modalNoResults) {
      modalNoResults.innerHTML =
        `<i class="fas fa-exclamation-circle"></i> No due students found for this class.`;
      modalNoResults.style.display = "block";
    }
    return;
  }
  classModalSub.textContent = `${lastLoadedStudents.length} student(s) found`;
  if (modalNoResults) modalNoResults.style.display = "none";

  lastLoadedStudents.forEach((sdoc) => {
    const data = typeof sdoc.data === "function" ? sdoc.data() : sdoc._rawData || {};
    const studentName = data.name || data.studentName || "Unnamed";
    let studentClass = data.studentClass || data.class || data.student_class || currentClass;
    if (String(studentClass).toLowerCase() === "kg1") studentClass = "NURSERY";
    else if (String(studentClass).toLowerCase() === "kg2") studentClass = "LKG";

    const due = Number(data.dueFee || 0);

    const div = document.createElement("div");
    div.className = "student-card";
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";
    div.innerHTML = `
      <div style="flex:1">
        <div class="student-name">${escapeHtml(studentName)}</div>
        <div class="txt-muted" style="font-size:.9rem">
          Class: ${escapeHtml(String(studentClass))} |
          Due: ?${escapeHtml(String(due))}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;margin-left:12px">
        <input type="number" min="0" step="0.01" class="settle-amount-input" data-id="${sdoc.id}" placeholder="Enter amount"
          style="padding:6px;border-radius:8px;border:1px solid #e6eefc;width:130px;text-align:right" />
        <button class="btn btn-primary settle-btn" data-id="${sdoc.id}">Settle</button>
        <button class="btn history-btn" data-id="${sdoc.id}" style="margin-top:4px;">History</button>
      </div>
    `;
    dueListContainer.appendChild(div);
  });

  dueListContainer.querySelectorAll(".settle-btn").forEach((btn) => {
    const id = btn.dataset.id;
    btn.addEventListener("click", async () => {
      const input = dueListContainer.querySelector(`.settle-amount-input[data-id="${id}"]`);
      if (!input) { alert("Amount input not found."); return; }
      const raw = input.value.trim();
      if (raw === "") { alert("Please enter an amount to settle."); return; }
      const amt = Number(raw);
      if (isNaN(amt) || amt <= 0) { alert("Enter a valid amount greater than 0."); return; }
      const sdoc = lastLoadedStudents.find((s) => s.id === id);
      if (!sdoc) { alert("Student not found in current list. Refresh and try again."); return; }
      const sdata = typeof sdoc.data === "function" ? sdoc.data() : sdoc._rawData || {};
      const due = Number(sdata.dueFee || 0);
      if (amt > due) {
        alert(`Entered amount (?${amt}) is greater than due amount (?${due}). Please enter = ?${due}.`);
        return;
      }
      await settleStudentAmount(sdoc, amt);
    });
  });

  dueListContainer.querySelectorAll(".history-btn").forEach((btn) => {
    const id = btn.dataset.id;
    btn.addEventListener("click", () => {
      const sdoc = lastLoadedStudents.find((s) => s.id === id);
      if (!sdoc) { alert("Student not found in current list."); return; }
      const data = typeof sdoc.data === "function" ? sdoc.data() : sdoc._rawData || {};
      const studentName = data.name || data.studentName || "Unnamed";
      showStudentSettlementHistory(id, studentName);
    });
  });

  const histWrap = document.createElement("div");
  histWrap.style.marginTop = "12px";
  histWrap.innerHTML = `<button class="btn" id="see-settlement-history">See settlement history</button>`;
  dueListContainer.appendChild(histWrap);
  document.getElementById("see-settlement-history").addEventListener("click", showSettlementHistory);
}

// ============================================================
// Open class modal
// ============================================================
async function openClassModal(cls) {
  currentClass = cls;
  const displayClass = classLabelFromValue(cls);

  classModalTitle.textContent = `${displayClass} — dueFee`;
  classModalSub.textContent = "Loading...";
  dueListContainer.innerHTML = "";

  // Show settlement button in the modal head
  if (showSettledClassBtn) {
    showSettledClassBtn.style.display = "inline-flex";
    showSettledClassBtn.onclick = () => showClassSettledStudents(cls);
  }

  if (modalNoResults) modalNoResults.style.display = "none";
  classModal.classList.add("show");

  const user = auth.currentUser;
  if (!user) {
    classModalSub.textContent = "Please login first.";
    if (modalNoResults) {
      modalNoResults.innerHTML = `<i class="fas fa-exclamation-circle"></i> Please login first.`;
      modalNoResults.style.display = "block";
    }
    return;
  }

  const academicYear = getSelectedAcademicYear();

  try {
    const snap = await db.collection("students")
      .where("ownerId", "==", user.uid)
      .limit(1000)
      .get();

    if (!snap || snap.empty) {
      const msg = `No students found for ${displayClass} in ${academicYear}.`;
      classModalSub.textContent = msg;
      if (modalNoResults) {
        modalNoResults.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
        modalNoResults.style.display = "block";
      }
      lastLoadedStudents = [];
      return;
    }

    const wantedClass = normalizeClass(cls);
    const withDue = [];

    snap.docs.forEach((doc) => {
      const d = doc.data();
      const studentYear = String(d.academicYear ?? "").trim();
      const selectedYear = String(academicYear).trim();
      if (studentYear !== selectedYear) return;

      const studentClass = normalizeClass(d.studentClass || d.class || d.student_class || "");
      const due = Number(d.dueFee || 0);

      if (studentClass === wantedClass && due > 0) {
        withDue.push(doc);
      }
    });

    if (withDue.length === 0) {
      const msg = `No students with dueFee found for ${displayClass} in ${academicYear}.`;
      classModalSub.textContent = msg;
      if (modalNoResults) {
        modalNoResults.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
        modalNoResults.style.display = "block";
      }
      lastLoadedStudents = [];
      return;
    }

    lastLoadedStudents = withDue;
    renderStudentListFromCache();
  } catch (err) {
    console.error("Error loading students", err);
    classModalSub.textContent = "Failed to load students (see console).";
    if (modalNoResults) {
      modalNoResults.innerHTML = `<i class="fas fa-exclamation-circle"></i> Failed to load students.`;
      modalNoResults.style.display = "block";
    }
  }
}

// ============================================================
// Close modals
// ============================================================
if (closeClassModal) {
  closeClassModal.addEventListener("click", () => {
    classModal.classList.remove("show");
    dueListContainer.innerHTML = "";
    if (modalNoResults) modalNoResults.style.display = "none";
    if (showSettledClassBtn) showSettledClassBtn.style.display = "none";
    currentClass = null;
    lastLoadedStudents = [];
  });
}
if (closeSettledModal) {
  closeSettledModal.addEventListener("click", () => {
    settledModal.classList.remove("show");
    settledListContainer.innerHTML = "";
    if (settledNoResults) settledNoResults.style.display = "none";
  });
}
if (settledModal) {
  settledModal.addEventListener("click", (e) => {
    if (e.target === settledModal) {
      settledModal.classList.remove("show");
      settledListContainer.innerHTML = "";
      if (settledNoResults) settledNoResults.style.display = "none";
    }
  });
}
if (showSettledBtn) {
  showSettledBtn.addEventListener("click", loadFullySettledStudents);
}

// ============================================================
// Init
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  renderClassCards();
  auth.onAuthStateChanged((user) => {
    if (!user) console.log("Not signed-in: login required.");
    else { console.log("Signed in:", user.email, user.uid); loadSchoolBranding(); }
  });
});