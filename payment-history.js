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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function storageKey(uid, k) { return `${uid}_${k}`; }

function showToast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.className = "toast " + type;
  el.innerHTML = `<i class="fas ${
    type === "success" ? "fa-check-circle" :
    type === "error" ? "fa-exclamation-circle" : "fa-info-circle"
  }"></i> ${escapeHtml(msg)}`;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 3400);
}

function customMonthsKey(studentId) { return `customMonths_${currentUserUid}_${studentId}`; }
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
  } catch (e) { console.warn("school_settings fetch failed:", e); }
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
extraClasses.forEach(c => { classSelect.innerHTML += `<option value="${c.value}">${c.label}</option>`; });
for (let c = 1; c <= 12; c++) { classSelect.innerHTML += `<option value="${c}">Class ${c}</option>`; }

// ================= AUTH =================
auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = "login.html"; return; }
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
  if (selectedNorm === "kg2" || selectedNorm === "lkg") selectedNorm = "lkg";
  else if (selectedNorm === "kg1" || selectedNorm === "nursery") selectedNorm = "nursery";

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
      if (studentNorm === "kg2" || studentNorm === "lkg") studentNorm = "lkg";
      else if (studentNorm === "kg1" || studentNorm === "nursery") studentNorm = "nursery";

      if (studentNorm == selectedNorm) {
        found = true;
        const initial = (s.name || "?").trim().charAt(0).toUpperCase();
        const classLabelMap = { kg1: "NURSERY", kg2: "LKG", nursery: "NURSERY", lkg: "LKG" };
        const displayClass = classLabelMap[normalizeClass(s.studentClass)] || s.studentClass;
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
          </div>`;
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
// BUILD MONTH ROW
// ================================================================
function buildMonthRow(opts) {
  const { monthName, monthKey, payment, year, studentId, studentName, studentClass, isCustom } = opts;

  const div = document.createElement("div");
  div.className = "month" + (payment ? " paid" : "") + (isCustom ? " custom-month" : "");

  const label = isCustom
    ? `${escapeHtml(monthName)} ${escapeHtml(String(year))} <span class="custom-badge"><i class="fas fa-star"></i> Extra</span>`
    : escapeHtml(monthName);

  const removeBtnHTML = (isCustom && !payment)
    ? `<button class="btn-remove-custom" title="Remove this month" data-remove="${monthKey}"><i class="fas fa-times"></i></button>`
    : "";

  div.innerHTML = `
    <strong><i class="fas fa-calendar-day"></i> ${label} ${removeBtnHTML}</strong>

    <input type="number" value="${payment ? payment.amount : (localStorage.getItem("defaultFee") || "")}" placeholder="Amount" ${payment ? "disabled" : ""}>

    <button class="${payment ? 'btn-paid-green btn-disabled' : 'btn-paid-red'}">
      <i class="fas fa-check"></i> Paid
    </button>

    <button class="btn-unpaid ${payment ? '' : 'btn-disabled'}">
      <i class="fas fa-times"></i> Unpaid
    </button>

    <button class="btn-print" title="Print / Preview receipt">
      <i class="fas fa-print"></i>
    </button>

    <button class="btn-download" title="Download PDF">
      <i class="fas fa-download"></i>
    </button>

    <button class="btn-whatsapp" title="Send receipt via WhatsApp">
      <i class="fab fa-whatsapp"></i>
    </button>
  `;

  const amountInput = div.querySelector("input");
  const paidBtn     = div.children[2];
  const unpaidBtn   = div.children[3];
  const printBtn    = div.children[4];
  const downloadBtn = div.children[5];
  const waBtn       = div.children[6];

  // PAID
  paidBtn.onclick = async () => {
    if (payment) return;
    if (!amountInput.value) return showToast("Enter amount", "error");
    localStorage.setItem("defaultFee", amountInput.value);

    await db.collection("payments").add({
      ownerId: currentUserUid,
      academicYear: String(year),
      studentId, studentName, studentClass,
      monthKey, monthName,
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

  // PRINT — popup preview (UNCHANGED)
  printBtn.onclick = () => {
    const amount = payment ? payment.amount : amountInput.value;
    if (!amount || Number(amount) <= 0) return showToast("No amount to print", "error");
    const paidOn = payment ? (payment.paidOn || "") : new Date().toISOString().split("T")[0];
    openFeeReceiptPDF({
      studentName, studentClass, monthName, monthKey,
      academicYear: String(year), amount: Number(amount), paidOn
    });
  };

  // DOWNLOAD — popup auto-downloads the PDF (visible rendering ? never blank)
  downloadBtn.onclick = () => {
    const amount = payment ? payment.amount : amountInput.value;
    if (!amount || Number(amount) <= 0) {
      return showToast("No amount to download", "error");
    }

    // Open popup FIRST (user-gesture safe)
    const w = window.open("", "_blank", "width=900,height=900,menubar=no,toolbar=no");
    if (!w) {
      return showToast("Pop-up blocked. Please allow pop-ups and try again.", "error");
    }

    const originalHTML = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    downloadBtn.disabled = true;

    const paidOn = payment ? (payment.paidOn || "") : new Date().toISOString().split("T")[0];

    downloadFeeReceiptPDF({
      studentName, studentClass, monthName, monthKey,
      academicYear: String(year), amount: Number(amount), paidOn
    }, w)
      .then(() => showToast("PDF downloaded ?", "success"))
      .catch(err => {
        console.error("Download error:", err);
        showToast("Failed: " + (err.message || "Unknown error"), "error");
      })
      .finally(() => {
        downloadBtn.innerHTML = originalHTML;
        downloadBtn.disabled = false;
      });
  };

  // WHATSAPP — text-only message (UNCHANGED)
  waBtn.onclick = async () => {
    const amount = payment ? payment.amount : amountInput.value;
    if (!amount || Number(amount) <= 0) {
      return showToast("Mark this month as paid first", "error");
    }
    const originalHTML = waBtn.innerHTML;
    waBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    waBtn.disabled = true;

    try {
      const paidOn = payment ? (payment.paidOn || "") : new Date().toISOString().split("T")[0];
      await sharePaymentMessage({
        studentName, studentClass, monthName, monthKey,
        academicYear: String(year), amount: Number(amount), paidOn
      }, studentId);
    } catch (err) {
      console.error("WhatsApp share error:", err);
      showToast("Failed: " + (err.message || "Unknown error"), "error");
    } finally {
      waBtn.innerHTML = originalHTML;
      waBtn.disabled = false;
    }
  };

  // REMOVE custom month
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
  monthList.innerHTML = `<div class="loading-state"><i class="fas fa-spinner"></i><p>Loading payment history...</p></div>`;

  const snap = await db.collection("payments")
    .where("ownerId", "==", currentUserUid)
    .where("studentId", "==", studentId)
    .get();

  const payments = {};
  snap.forEach(d => payments[d.data().monthKey] = { id: d.id, ...d.data() });

  const selectedYear = String(yearSelect.value);
  monthList.innerHTML = "";
  const renderedKeys = new Set();

  MONTH_NAMES.forEach((m, i) => {
    const monthKey = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
    renderedKeys.add(monthKey);
    monthList.appendChild(buildMonthRow({
      monthName: m, monthKey, payment: payments[monthKey], year: selectedYear,
      studentId, studentName, studentClass, isCustom: false
    }));
  });

  const extraKeys = new Set();
  getCustomMonths(studentId).forEach(k => { if (!renderedKeys.has(k)) extraKeys.add(k); });
  Object.keys(payments).forEach(k => { if (!renderedKeys.has(k)) extraKeys.add(k); });

  [...extraKeys].sort().forEach(monthKey => {
    renderedKeys.add(monthKey);
    const [yy, mm] = monthKey.split("-");
    const monthIdx = parseInt(mm, 10) - 1;
    const monthName = MONTH_NAMES[monthIdx] || mm;
    monthList.appendChild(buildMonthRow({
      monthName, monthKey, payment: payments[monthKey], year: yy,
      studentId, studentName, studentClass, isCustom: true
    }));
  });

  const wrap = document.createElement("div");
  wrap.className = "add-month-wrap";
  wrap.innerHTML = `<button class="btn-add-month" id="addMonthBtn"><i class="fas fa-plus-circle"></i> Add Extra Month / Year</button>`;
  monthList.appendChild(wrap);

  document.getElementById("addMonthBtn").onclick = () => {
    openAddMonthDialog(studentId, studentName, studentClass, renderedKeys);
  };
}

// ================================================================
// ADD MONTH DIALOG
// ================================================================
function openAddMonthDialog(studentId, studentName, studentClass, renderedKeys) {
  const existing = document.getElementById("addMonthPanel");
  if (existing) existing.remove();

  const currentYear = parseInt(yearSelect.value, 10) || new Date().getFullYear();
  const panel = document.createElement("div");
  panel.id = "addMonthPanel";
  panel.className = "add-month-panel";

  const monthOptions = MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");

  panel.innerHTML = `
    <div class="amp-title"><i class="fas fa-plus-circle"></i> Add Extra Month / Year</div>
    <p class="amp-desc">The selected month will be added below December. You can mark it Paid, Unpaid, or print its receipt just like any other month.</p>
    <div class="amp-fields">
      <div class="amp-field"><label>Month</label><select id="extraMonthSel">${monthOptions}</select></div>
      <div class="amp-field"><label>Year</label><input type="number" id="extraYearInput" min="2000" max="2100" value="${currentYear + 1}"></div>
    </div>
    <div class="amp-actions">
      <button class="amp-cancel" id="extraAddCancel">Cancel</button>
      <button class="amp-confirm" id="extraAddConfirm"><i class="fas fa-check"></i> Add Month</button>
    </div>`;

  monthList.appendChild(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  document.getElementById("extraAddCancel").onclick = () => panel.remove();
  document.getElementById("extraAddConfirm").onclick = () => {
    const mm = parseInt(document.getElementById("extraMonthSel").value, 10);
    const yy = parseInt(document.getElementById("extraYearInput").value, 10);
    if (!yy || yy < 2000 || yy > 2100) return showToast("Enter a valid year (2000–2100)", "error");
    const monthKey = `${yy}-${String(mm).padStart(2, "0")}`;
    if (renderedKeys && renderedKeys.has(monthKey)) return showToast("This month is already listed", "error");
    const list = getCustomMonths(studentId);
    if (!list.includes(monthKey)) { list.push(monthKey); list.sort(); saveCustomMonths(studentId, list); }
    showToast("Month added", "success");
    viewHistory(studentId, studentName, studentClass);
  };
}

// ================================================================
// WHATSAPP — TEXT-ONLY SHARE
// ================================================================
function buildPaymentMessage(d) {
  const schoolName = cachedSchool.name || "";
  const schoolAddress = cachedSchool.address || "";
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const paidOn = d.paidOn || today;

  const headerBlock = schoolName
    ? `?? *${schoolName}*${schoolAddress ? "\n?? " + schoolAddress : ""}\n\n`
    : "";

  return (
`?? *PAYMENT SUCCESSFUL* ?
????????????????????

${headerBlock}Dear Parent,

Your payment has been received successfully! ?

?? *Student:* ${d.studentName}
?? *Class:* ${d.studentClass}
?? *Month:* ${d.monthName} ${d.academicYear}
?? *Amount:* ?${Number(d.amount).toLocaleString("en-IN")}
??? *Paid On:* ${paidOn}
? *Status:* PAID

????????????????????

Thank you for your payment! ??
Please keep this message for your records.

????????????????????

_Sent via ${schoolName || "School"}_`
  );
}

async function sharePaymentMessage(d, studentId) {
  let phone = "";
  try {
    const snap = await db.collection("students").doc(studentId).get();
    if (snap.exists) {
      const s = snap.data();
      phone = String(
        s.mobile || s.mobileNo || s.fatherMobile || s.guardianMobile ||
        s.parentMobile || s.parentsMobile || s.contact || ""
      ).replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;
    }
  } catch (e) { console.warn("Could not load phone:", e); }

  const message = buildPaymentMessage(d);
  const text = encodeURIComponent(message);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  let url;
  if (isMobile) {
    url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  } else {
    url = phone
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}`
      : `https://web.whatsapp.com/send?text=${text}`;
  }

  window.open(url, "_blank");
  showToast("Opening WhatsApp…", "success");
}

// ================================================================
// ? DOWNLOAD — popup renders visible receipt, auto-downloads PDF
// ================================================================
async function downloadFeeReceiptPDF(d, w) {
  if (!cachedSchool.name) {
    try { await loadSchoolBranding(); } catch(_) {}
  }

  const { name: schoolName, address: schoolAddress, logo: schoolLogo, sign: principalSign } = cachedSchool;
  const receiptNo = "RCPT-" + Date.now().toString().slice(-8);
  const generatedOn = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const generatedTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const amountInWords = numberToWordsIndian(d.amount);

  const qrData = [
    schoolName,
    "Receipt: " + receiptNo,
    "Student: " + d.studentName,
    "Class: " + d.studentClass,
    "Month: " + d.monthName + " " + d.academicYear,
    "Amount: Rs. " + d.amount
  ].join("\n");
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=" + encodeURIComponent(qrData);

  const safeName = (d.studentName || "Student").replace(/[^\w\-]+/g, "_");
  const safeMonth = String(d.monthName || "Month").replace(/[^\w\-]+/g, "_");
  const fileName = "Fee_Receipt_" + safeName + "_" + safeMonth + "_" + d.academicYear + ".pdf";

  const receiptHTML = `
    <div class="page" id="receiptPage">
      <div class="watermark">PAID</div>
      <div class="content">
        <div class="header">
          ${schoolLogo
            ? '<div class="logo-wrap"><img src="' + schoolLogo + '" crossorigin="anonymous" alt="Logo"></div>'
            : '<div class="logo-placeholder">' + escapeHtml((schoolName || "S").charAt(0)) + '</div>'}
          <div class="title-block">
            <h1>${escapeHtml(schoolName || "School Name")}</h1>
            ${schoolAddress ? '<div class="address">' + escapeHtml(schoolAddress) + '</div>' : ''}
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
          <div class="meta-item"><div class="mi-label"><i class="fa-regular fa-calendar"></i> Month</div><div class="mi-value">${escapeHtml(d.monthName)}</div></div>
          <div class="meta-item"><div class="mi-label"><i class="fa-solid fa-calendar-days"></i> Year</div><div class="mi-value">${escapeHtml(d.academicYear)}</div></div>
          <div class="meta-item"><div class="mi-label"><i class="fa-solid fa-circle-check"></i> Status</div><div class="mi-value paid">PAID</div></div>
        </div>

        <div class="bottom-row">
          <div class="qr-wrap">
            <img src="${qrUrl}" crossorigin="anonymous" alt="QR Code">
            <div class="qr-label">Scan to verify</div>
          </div>
          <div class="sign-wrap">
            ${principalSign ? '<img src="' + principalSign + '" class="sign-img" crossorigin="anonymous" alt="Sign"><br>' : '<div style="height:46px"></div>'}
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
  `;

  const receiptStyles = `
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI','Inter',Arial,sans-serif; color: #1a1410; background: #f3f4f6; padding: 20px; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 32px 40px 28px; position: relative; overflow: hidden; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-25deg); font-size: 160px; font-weight: 900; color: rgba(16,185,129,0.07); letter-spacing: 20px; pointer-events: none; user-select: none; z-index: 0; }
    .content { position: relative; z-index: 1; }
    .header { display: flex; align-items: center; gap: 18px; padding-bottom: 16px; border-bottom: 3px double #1A2A6C; margin-bottom: 20px; }
    .header .logo-wrap { width: 78px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header .logo-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .header .logo-placeholder { width: 78px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eef2ff; border-radius: 12px; color: #1A2A6C; font-size: 34px; font-weight: 800; border: 1px solid #c7d2fe; }
    .header .title-block { flex: 1; text-align: center; }
    .header h1 { font-size: 24px; color: #1A2A6C; letter-spacing: 0.5px; margin-bottom: 4px; text-transform: uppercase; }
    .header .address { font-size: 12px; color: #555; }
    .header .spacer { width: 78px; flex-shrink: 0; }
    .title-bar { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #1A2A6C, #2c3e91); color: #fff; padding: 12px 20px; border-radius: 10px; margin-bottom: 20px; }
    .title-bar h2 { font-size: 18px; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
    .title-bar h2 i { font-size: 16px; }
    .title-bar .receipt-no { font-size: 12px; background: rgba(255,255,255,0.18); padding: 5px 12px; border-radius: 999px; font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; }
    .info-card .card-label { font-size: 10px; font-weight: 800; color: #1A2A6C; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #eef2ff; display: flex; align-items: center; gap: 6px; }
    .info-card .card-label i { color: #667eea; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
    .info-row .k { color: #6b7280; font-weight: 600; font-size: 12px; }
    .info-row .v { color: #111827; font-weight: 700; text-align: right; max-width: 60%; word-break: break-word; }
    .amount-block { background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border: 2px solid #10b981; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .amount-block .left { position: relative; z-index: 1; }
    .amount-block .lbl { font-size: 11px; font-weight: 800; color: #059669; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; }
    .amount-block .words { font-size: 12px; color: #065f46; font-style: italic; max-width: 320px; }
    .amount-block .amt { font-size: 38px; font-weight: 900; color: #065f46; position: relative; z-index: 1; line-height: 1; letter-spacing: -1px; }
    .amount-block .amt small { font-size: 18px; font-weight: 700; opacity: 0.75; margin-right: 4px; }
    .payment-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    .meta-item { background: #fff; border: 1px solid #e5e7eb; border-top: 3px solid #667eea; border-radius: 10px; padding: 12px; text-align: center; }
    .meta-item .mi-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 800; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 5px; }
    .meta-item .mi-label i { color: #667eea; }
    .meta-item .mi-value { font-size: 14px; font-weight: 800; color: #1A2A6C; }
    .meta-item .mi-value.paid { color: #059669; background: #ecfdf5; padding: 3px 10px; border-radius: 999px; display: inline-block; font-size: 11px; }
    .bottom-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .qr-wrap img { width: 110px; height: 110px; background: #fff; padding: 4px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .qr-wrap .qr-label { font-size: 9px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
    .sign-wrap { text-align: center; }
    .sign-wrap .sign-img { height: 46px; margin-bottom: 4px; object-fit: contain; }
    .sign-wrap .sign-line { border-top: 1.5px solid #333; width: 180px; margin: 0 auto 4px; }
    .sign-wrap .sign-label { font-size: 11px; font-weight: 700; color: #1A2A6C; letter-spacing: 0.8px; text-transform: uppercase; }
    .footnote { margin-top: 26px; padding-top: 12px; border-top: 1px dashed #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; line-height: 1.6; }
    .footnote b { color: #1A2A6C; }
    #overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.75);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 14px;
      color: #fff; font: 600 15px/1.4 'Segoe UI', sans-serif;
      backdrop-filter: blur(4px);
    }
    #overlay .spinner {
      width: 46px; height: 46px; border-radius: 50%;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #10b981;
      animation: spin 0.8s linear infinite;
    }
    #overlay.done .spinner { display: none; }
    #overlay .icon { font-size: 42px; color: #10b981; display: none; }
    #overlay.done .icon { display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  const autoScript = `
    (function() {
      var overlay = document.getElementById('overlay');
      var statusEl = document.getElementById('statusText');
      var fileName = ${JSON.stringify(fileName)};

      function run() {
        if (!window.html2pdf) {
          setTimeout(run, 200);
          return;
        }
        // Give images a moment to load
        setTimeout(function() {
          var el = document.getElementById('receiptPage');
          window.html2pdf().set({
            margin: [10, 10, 10, 10],
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false,
              windowWidth: 794,
              scrollX: 0,
              scrollY: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          }).from(el).save(fileName).then(function() {
            overlay.classList.add('done');
            statusEl.textContent = 'PDF downloaded ?';
            setTimeout(function(){ try { window.close(); } catch(_) {} }, 1400);
          }).catch(function(err) {
            statusEl.textContent = 'Failed: ' + (err && err.message || err);
            overlay.style.background = 'rgba(120,0,0,0.85)';
          });
        }, 700);
      }
      run();
    })();
  `;

  w.document.open();
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">');
  w.document.write('<title>Fee Receipt - ' + escapeHtml(d.studentName) + '</title>');
  w.document.write('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">');
  w.document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>');
  w.document.write('<style>' + receiptStyles + '</style>');
  w.document.write('</head><body>');
  w.document.write(receiptHTML);
  w.document.write('<div id="overlay"><div class="spinner"></div><div class="icon">?</div><div id="statusText">Generating PDF…</div></div>');
  w.document.write('<script>' + autoScript + '<\/script>');
  w.document.write('</body></html>');
  w.document.close();

  return Promise.resolve();
}

// ================================================================
// PRINT POPUP — unchanged
// ================================================================
async function openFeeReceiptPDF(d) {
  if (!cachedSchool.name) await loadSchoolBranding();

  const w = window.open("", "_blank");
  if (!w) return showToast("Pop-up blocked. Please allow pop-ups.", "error");

  const { name: schoolName, address: schoolAddress, logo: schoolLogo, sign: principalSign } = cachedSchool;
  const receiptNo = "RCPT-" + Date.now().toString().slice(-8);
  const generatedOn = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const generatedTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const amountInWords = numberToWordsIndian(d.amount);

  const qrData = [schoolName, "Receipt: " + receiptNo, "Student: " + d.studentName,
                  "Class: " + d.studentClass, "Month: " + d.monthName + " " + d.academicYear,
                  "Amount: Rs. " + d.amount].join("\n");
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=" + encodeURIComponent(qrData);

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
  const styles = `
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI','Inter',Arial,sans-serif; color: #1a1410; background: #f3f4f6; padding: 20px; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #1A2A6C, #2c3e91); color: #fff; border: none; padding: 12px 22px; border-radius: 999px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; box-shadow: 0 8px 24px rgba(26,42,108,0.35); display: inline-flex; align-items: center; gap: 8px; z-index: 100; }
    .print-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(26,42,108,0.45); }
    .page { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 32px 40px 28px; position: relative; overflow: hidden; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-25deg); font-size: 160px; font-weight: 900; color: rgba(16,185,129,0.07); letter-spacing: 20px; pointer-events: none; user-select: none; z-index: 0; }
    .content { position: relative; z-index: 1; }
    .header { display: flex; align-items: center; gap: 18px; padding-bottom: 16px; border-bottom: 3px double #1A2A6C; margin-bottom: 20px; }
    .header .logo-wrap { width: 78px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header .logo-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .header .logo-placeholder { width: 78px; height: 78px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eef2ff; border-radius: 12px; color: #1A2A6C; font-size: 34px; font-weight: 800; border: 1px solid #c7d2fe; }
    .header .title-block { flex: 1; text-align: center; }
    .header h1 { font-size: 24px; color: #1A2A6C; letter-spacing: 0.5px; margin-bottom: 4px; text-transform: uppercase; }
    .header .address { font-size: 12px; color: #555; }
    .header .spacer { width: 78px; flex-shrink: 0; }
    .title-bar { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #1A2A6C, #2c3e91); color: #fff; padding: 12px 20px; border-radius: 10px; margin-bottom: 20px; }
    .title-bar h2 { font-size: 18px; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
    .title-bar h2 i { font-size: 16px; }
    .title-bar .receipt-no { font-size: 12px; background: rgba(255,255,255,0.18); padding: 5px 12px; border-radius: 999px; font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; }
    .info-card .card-label { font-size: 10px; font-weight: 800; color: #1A2A6C; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #eef2ff; display: flex; align-items: center; gap: 6px; }
    .info-card .card-label i { color: #667eea; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
    .info-row .k { color: #6b7280; font-weight: 600; font-size: 12px; }
    .info-row .v { color: #111827; font-weight: 700; text-align: right; max-width: 60%; word-break: break-word; }
    .amount-block { background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border: 2px solid #10b981; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .amount-block .left { position: relative; z-index: 1; }
    .amount-block .lbl { font-size: 11px; font-weight: 800; color: #059669; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; }
    .amount-block .words { font-size: 12px; color: #065f46; font-style: italic; max-width: 320px; }
    .amount-block .amt { font-size: 38px; font-weight: 900; color: #065f46; position: relative; z-index: 1; line-height: 1; letter-spacing: -1px; }
    .amount-block .amt small { font-size: 18px; font-weight: 700; opacity: 0.75; margin-right: 4px; }
    .payment-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    .meta-item { background: #fff; border: 1px solid #e5e7eb; border-top: 3px solid #667eea; border-radius: 10px; padding: 12px; text-align: center; }
    .meta-item .mi-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 800; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 5px; }
    .meta-item .mi-label i { color: #667eea; }
    .meta-item .mi-value { font-size: 14px; font-weight: 800; color: #1A2A6C; }
    .meta-item .mi-value.paid { color: #059669; background: #ecfdf5; padding: 3px 10px; border-radius: 999px; display: inline-block; font-size: 11px; }
    .bottom-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .qr-wrap img { width: 110px; height: 110px; background: #fff; padding: 4px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .qr-wrap .qr-label { font-size: 9px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
    .sign-wrap { text-align: center; }
    .sign-wrap .sign-img { height: 46px; margin-bottom: 4px; object-fit: contain; }
    .sign-wrap .sign-line { border-top: 1.5px solid #333; width: 180px; margin: 0 auto 4px; }
    .sign-wrap .sign-label { font-size: 11px; font-weight: 700; color: #1A2A6C; letter-spacing: 0.8px; text-transform: uppercase; }
    .footnote { margin-top: 26px; padding-top: 12px; border-top: 1px dashed #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; line-height: 1.6; }
    .footnote b { color: #1A2A6C; }
    @media print {
      body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { box-shadow: none; border-radius: 0; max-width: 100%; padding: 20px; }
      .print-btn { display: none !important; }
    }
  `;

  const body = `
    <button class="print-btn" onclick="window.print()">
      <i class="fa-solid fa-print"></i> Print / Save as PDF
    </button>

    <div class="page">
      <div class="watermark">PAID</div>
      <div class="content">
        <div class="header">
          ${schoolLogo
            ? '<div class="logo-wrap"><img src="' + schoolLogo + '" alt="Logo"></div>'
            : '<div class="logo-placeholder">' + escapeHtml((schoolName || "S").charAt(0)) + '</div>'}
          <div class="title-block">
            <h1>${escapeHtml(schoolName || "School Name")}</h1>
            ${schoolAddress ? '<div class="address">' + escapeHtml(schoolAddress) + '</div>' : ''}
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
          <div class="meta-item"><div class="mi-label"><i class="fa-regular fa-calendar"></i> Month</div><div class="mi-value">${escapeHtml(d.monthName)}</div></div>
          <div class="meta-item"><div class="mi-label"><i class="fa-solid fa-calendar-days"></i> Year</div><div class="mi-value">${escapeHtml(d.academicYear)}</div></div>
          <div class="meta-item"><div class="mi-label"><i class="fa-solid fa-circle-check"></i> Status</div><div class="mi-value paid">PAID</div></div>
        </div>

        <div class="bottom-row">
          <div class="qr-wrap">
            <img src="${qrUrl}" alt="QR Code">
            <div class="qr-label">Scan to verify</div>
          </div>
          <div class="sign-wrap">
            ${principalSign ? '<img src="' + principalSign + '" class="sign-img"><br>' : '<div style="height:46px"></div>'}
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
  `;

  w.document.write(html);
  w.document.write('<title>Fee Receipt — ' + escapeHtml(d.studentName) + '</title>');
  w.document.write('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">');
  w.document.write('<style>' + styles + '</style>');
  w.document.write('</head><body>');
  w.document.write(body);
  w.document.write('</body></html>');
  w.document.close();
  w.focus();
}

// ============================================================
// Number ? Indian words
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
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;

  if (crore) result += threeDigits(crore) + " Crore ";
  if (lakh) result += twoDigits(lakh) + " Lakh ";
  if (thousand) result += twoDigits(thousand) + " Thousand ";
  if (num) result += threeDigits(num);

  return result.trim() + " Rupees Only";
}