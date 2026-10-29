// ==================================
// PRINT.JS — Admission Slip + Bulk List + Student Directory
// ==================================

const firebaseConfig = {
  apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
  authDomain: "school-management-projec-9db7a.firebaseapp.com",
  projectId: "school-management-projec-9db7a"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

function storageKey(uid, k) {
  return `${uid}_${k}`;
}

// ==================================
// GLOBAL HELPERS: robust field resolver
// ==================================
function pick(obj, ...keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  const lowerMap = {};
  for (const k of Object.keys(obj)) lowerMap[k.toLowerCase()] = k;
  for (const k of keys) {
    const actual = lowerMap[String(k).toLowerCase()];
    if (actual) {
      const v = obj[actual];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return "";
}

// Format a Firestore Timestamp / ISO string / number to a friendly date
function fmtDate(val) {
  if (!val) return "";
  try {
    if (typeof val === "object") {
      if (typeof val.toDate === "function") {
        const dt = val.toDate();
        if (!isNaN(dt)) return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      }
      if (typeof val.seconds === "number") {
        return new Date(val.seconds * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      }
    }
    if (typeof val === "string") {
      const dt = new Date(val);
      if (!isNaN(dt) && val.length >= 8) {
        return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      }
    }
    if (typeof val === "number") {
      return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
  } catch (e) {}
  return String(val);
}

function getClass(s) {
  return pick(s, "studentClass", "student_class", "className", "class_name", "class", "Class", "grade");
}
function getYear(s) {
  return pick(s, "academicYear", "academic_year", "session", "sessionYear", "session_year", "year", "academicSession", "academic_session");
}
function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getSchoolBranding(uid) {
  let schoolName = "ABC PUBLIC SCHOOL";
  let schoolAddress = "";
  let logo = "";
  let sign = "";

  try {
    const snap = await db.collection("school_settings").doc(uid).get();
    if (snap.exists) {
      const d = snap.data();
      schoolName = d.schoolName || schoolName;
      schoolAddress = d.schoolAddress || "";
      logo = d.logo || "";
      sign = d.principalSignature || "";
    }
  } catch (e) {
    console.warn("school_settings fetch failed:", e);
  }

  if (!logo) logo = localStorage.getItem(storageKey(uid, "schoolLogo")) || "";
  if (!sign) sign = localStorage.getItem(storageKey(uid, "principalSign")) || "";

  return { schoolName, schoolAddress, logo, sign };
}

// ==================================
// 1. SINGLE STUDENT — Search by mobile
// ==================================
document.getElementById("searchPrintBtn").addEventListener("click", async () => {
  const mobile = document.getElementById("mobile").value.trim();
  const user = auth.currentUser;

  if (!user) return alert("Not logged in");
  if (!mobile) return alert("Enter mobile number");

  const snap = await db.collection("students")
    .where("ownerId", "==", user.uid)
    .where("mobile", "==", mobile)
    .limit(1)
    .get();

  if (snap.empty) {
    alert("Student not found");
    return;
  }

  const s = snap.docs[0].data();

  const { schoolName, schoolAddress, logo, sign } =
    await getSchoolBranding(user.uid);

  const qrData = `
${schoolName}
Name: ${s.name}
Class: ${s.studentClass}
Roll: ${s.roll}
Mobile: ${s.mobile}
`.trim();

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" +
    encodeURIComponent(qrData);

  printPDF({
    schoolName,
    schoolAddress,
    schoolLogo: logo,
    principalSign: sign,
    studentPhoto: "",
    qrUrl,

    name: s.name,
    father: s.father,
    className: s.studentClass,
    roll: s.roll,
    dob: s.dob,
    age: s.age,
    admissionFee: s.admissionFee,
    monthlyFee: s.monthlyFee,
    dueFee: s.dueFee
  });
});

// ==================================
// 2. BULK STUDENT LIST — Filter by session + class
// ==================================
document.getElementById("printListBtn").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const classFilter = document.getElementById("classFilter").value;
  const sessionFilter = document.getElementById("sessionFilter").value;

  const btn = document.getElementById("printListBtn");
  const statusEl = document.getElementById("listStatus");
  const setStatus = (msg, type = "info") => {
    statusEl.textContent = msg;
    statusEl.className = "status-msg show " + type;
  };

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  setStatus("Fetching students...", "info");

  try {
    const snap = await db.collection("students")
      .where("ownerId", "==", user.uid)
      .get();

    let students = [];
    snap.forEach(doc => students.push({ id: doc.id, ...doc.data() }));

    if (classFilter) {
      students = students.filter(s => getClass(s) === classFilter);
    }
    if (sessionFilter) {
      students = students.filter(s => String(getYear(s)) === String(sessionFilter));
    }

    if (students.length === 0) {
      setStatus("No students found for the selected filters.", "error");
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-pdf"></i> Print Student List';
      return;
    }

    students.sort((a, b) => {
      const ca = String(getClass(a));
      const cb = String(getClass(b));
      if (ca !== cb) return ca.localeCompare(cb, undefined, { numeric: true });
      const ra = parseInt(a.roll) || 0;
      const rb = parseInt(b.roll) || 0;
      return ra - rb;
    });

    const { schoolName, schoolAddress, logo, sign } =
      await getSchoolBranding(user.uid);

    setStatus(`Found ${students.length} student(s). Opening print window...`, "success");

    printStudentListPDF({
      schoolName,
      schoolAddress,
      schoolLogo: logo,
      principalSign: sign,
      className: classFilter || "All Classes",
      session: sessionFilter || "All Sessions",
      students
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf"></i> Print Student List';

  } catch (err) {
    console.error(err);
    setStatus("Error: " + err.message, "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf"></i> Print Student List';
  }
});

// ==================================
// 3. STUDENT DIRECTORY — Load list with Show Details buttons
// ==================================
let directoryCache = [];

document.getElementById("loadDirectoryBtn").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const classFilter = document.getElementById("dirClass").value;
  const sessionFilter = document.getElementById("dirSession").value;

  const btn = document.getElementById("loadDirectoryBtn");
  const statusEl = document.getElementById("directoryStatus");
  const tbody = document.getElementById("directoryBody");
  const infoBar = document.getElementById("directoryInfoBar");

  const setStatus = (msg, type = "info") => {
    statusEl.textContent = msg;
    statusEl.className = "status-msg show " + type;
  };

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  statusEl.className = "status-msg";
  infoBar.style.display = "none";

  try {
    const snap = await db.collection("students")
      .where("ownerId", "==", user.uid)
      .get();

    let students = [];
    snap.forEach(doc => students.push({ id: doc.id, ...doc.data() }));

    if (classFilter) students = students.filter(s => getClass(s) === classFilter);
    if (sessionFilter) students = students.filter(s => String(getYear(s)) === String(sessionFilter));

    students.sort((a, b) => {
      const ca = String(getClass(a));
      const cb = String(getClass(b));
      if (ca !== cb) return ca.localeCompare(cb, undefined, { numeric: true });
      return (parseInt(a.roll) || 0) - (parseInt(b.roll) || 0);
    });

    directoryCache = students;

    tbody.innerHTML = "";
    if (students.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">
            <i class="fas fa-search" style="font-size:22px;display:block;margin-bottom:6px;opacity:0.5;"></i>
            No students found for the selected filters.
          </td>
        </tr>`;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-search"></i> Load Students';
      setStatus("No students found.", "error");
      return;
    }

    students.forEach((s, i) => {
      const tr = document.createElement("tr");

      const tdIdx = document.createElement("td");
      tdIdx.className = "center";
      tdIdx.textContent = i + 1;

      const tdName = document.createElement("td");
      tdName.innerHTML = `<b>${escapeHtml(s.name) || "—"}</b>`;

      const tdFather = document.createElement("td");
      tdFather.textContent = s.father || "—";

      const tdClass = document.createElement("td");
      tdClass.className = "center";
      tdClass.textContent = getClass(s) || "—";

      const tdRoll = document.createElement("td");
      tdRoll.className = "center";
      tdRoll.textContent = s.roll || "—";

      const tdSession = document.createElement("td");
      tdSession.className = "center";
      tdSession.textContent = getYear(s) || "—";

      const tdAction = document.createElement("td");
      tdAction.className = "center";
      const detailBtn = document.createElement("button");
      detailBtn.className = "detail-btn";
      detailBtn.innerHTML = '<i class="fas fa-eye"></i> Show Details';
      detailBtn.addEventListener("click", () => showStudentDetails(s));
      tdAction.appendChild(detailBtn);

      tr.appendChild(tdIdx);
      tr.appendChild(tdName);
      tr.appendChild(tdFather);
      tr.appendChild(tdClass);
      tr.appendChild(tdRoll);
      tr.appendChild(tdSession);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });

    document.getElementById("dirCount").textContent = students.length;
    document.getElementById("dirFilterLabel").textContent =
      `Class: ${classFilter || "All"} · Session: ${sessionFilter || "All"}`;
    infoBar.style.display = "flex";

    setStatus(`Loaded ${students.length} student(s).`, "success");

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-search"></i> Load Students';

  } catch (err) {
    console.error(err);
    setStatus("Error: " + err.message, "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-search"></i> Load Students';
  }
});

// ==================================
// SHOW DETAILS
// ==================================
async function showStudentDetails(s) {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const { schoolName, schoolAddress, logo, sign } =
    await getSchoolBranding(user.uid);

  const qrData = `
${schoolName}
Name: ${s.name}
Class: ${getClass(s)}
Roll: ${s.roll}
Mobile: ${s.mobile || "-"}
Session: ${getYear(s)}
`.trim();

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=" +
    encodeURIComponent(qrData);

  openStudentProfilePDF({
    schoolName,
    schoolAddress,
    schoolLogo: logo,
    principalSign: sign,
    qrUrl,
    student: s
  });
}

// ==================================
// SINGLE ADMISSION SLIP
// ==================================
function printPDF(d) {
  const w = window.open("", "_blank");

  w.document.write(`
<html>
<head>
  <title>Student Admission Slip</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    h2 { text-align: center; margin-bottom: 5px; }
    .center { text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    td { border: 1px solid #333; padding: 6px; }
    .photo { width: 90px; height: 110px; object-fit: cover; border: 1px solid #333; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; }
    .sign { height: 40px; }
  </style>
</head>
<body>

  <div class="center">
    ${d.schoolLogo ? `<img src="${d.schoolLogo}" height="60"><br>` : ""}
    <h2>${d.schoolName}</h2>
    <strong>Student Admission Slip</strong>
  </div>

  <table>
    <tr>
      <td><b>Name</b></td><td>${d.name}</td>
      <td rowspan="4" class="center">No Photo</td>
    </tr>
    <tr><td><b>Father Name</b></td><td>${d.father}</td></tr>
    <tr><td><b>Class</b></td><td>${d.className}</td></tr>
    <tr><td><b>Roll No</b></td><td>${d.roll}</td></tr>
    <tr>
      <td><b>Date of Birth</b></td><td>${d.dob}</td>
      <td rowspan="3" class="center"><img src="${d.qrUrl}"></td>
    </tr>
    <tr><td><b>Age</b></td><td>${d.age}</td></tr>
    <tr><td><b>Admission Fee</b></td><td>? ${d.admissionFee}</td></tr>
    <tr><td><b>Monthly Fee</b></td><td>? ${d.monthlyFee}</td><td></td></tr>
    <tr><td><b>Due Fee</b></td><td>? ${d.dueFee}</td><td></td></tr>
  </table>

  <div class="footer">
    <div></div>
    <div class="center">
      ${d.principalSign ? `<img src="${d.principalSign}" class="sign"><br>` : ""}
      <b>Principal</b>
    </div>
  </div>

</body>
</html>
  `);

  w.document.close();
  w.focus();
  w.print();
}

// ==================================
// BULK STUDENT LIST
// ==================================
function printStudentListPDF(d) {
  const w = window.open("", "_blank");

  const totalStudents = d.students.length;
  const totalDue = d.students.reduce((sum, s) => sum + (parseFloat(s.dueFee) || 0), 0);
  const totalMonthly = d.students.reduce((sum, s) => sum + (parseFloat(s.monthlyFee) || 0), 0);

  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  });
  const generatedTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit"
  });

  const rows = d.students.map((s, i) => {
    const cls = getClass(s) || "—";
    const yr = getYear(s) || "—";
    return `
      <tr>
        <td class="idx">${i + 1}</td>
        <td class="name">${escapeHtml(s.name) || "—"}</td>
        <td>${escapeHtml(s.father) || "—"}</td>
        <td class="center">${escapeHtml(cls)}</td>
        <td class="center">${escapeHtml(s.roll) || "—"}</td>
        <td class="center">${escapeHtml(s.mobile) || "—"}</td>
        <td class="center">${escapeHtml(s.dob) || "—"}</td>
        <td class="center">${escapeHtml(s.age) || "—"}</td>
        <td class="center">${escapeHtml(yr)}</td>
        <td class="right">${s.dueFee ? "? " + escapeHtml(s.dueFee) : "—"}</td>
      </tr>
    `;
  }).join("");

  const classCounts = {};
  d.students.forEach(s => {
    const c = getClass(s) || "Unknown";
    classCounts[c] = (classCounts[c] || 0) + 1;
  });
  const classSummary = Object.keys(classCounts)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(c => `<span class="pill"><b>${escapeHtml(c)}</b> ${classCounts[c]}</span>`)
    .join(" ");

  w.document.write(`
<html>
<head>
  <title>Student List Report</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
      color: #1a1410; background: #fff; padding: 0;
    }
    .header {
      display: flex; align-items: center; gap: 16px;
      padding-bottom: 14px; border-bottom: 3px double #1A2A6C;
      margin-bottom: 16px;
    }
    .header .logo-wrap {
      width: 70px; height: 70px; display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
    }
    .header .logo-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .header .title-block { flex: 1; text-align: center; }
    .header h1 {
      font-size: 26px; color: #1A2A6C; letter-spacing: 0.5px;
      margin-bottom: 4px; text-transform: uppercase;
    }
    .header .address { font-size: 12px; color: #555; margin-bottom: 4px; }
    .header h2 {
      font-size: 16px; color: #B21F1F; font-weight: 700;
      letter-spacing: 1px; margin-top: 6px; text-transform: uppercase;
    }
    .header .spacer { width: 70px; flex-shrink: 0; }
    .meta-bar {
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 10px;
      background: linear-gradient(135deg, #eef2ff, #fff5f5);
      border-left: 4px solid #1A2A6C; padding: 10px 16px;
      border-radius: 8px; margin-bottom: 14px; font-size: 12px;
    }
    .meta-bar .item { display: flex; flex-direction: column; gap: 2px; }
    .meta-bar .label {
      font-size: 9px; text-transform: uppercase;
      letter-spacing: 1px; color: #777; font-weight: 700;
    }
    .meta-bar .value { font-size: 13px; color: #1A2A6C; font-weight: 700; }
    .stats {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 10px; margin-bottom: 14px;
    }
    .stat {
      background: #fff; border: 1px solid #e5e7eb;
      border-top: 3px solid #1A2A6C; border-radius: 8px;
      padding: 10px 14px; text-align: center;
    }
    .stat .num { font-size: 22px; font-weight: 800; color: #1A2A6C; line-height: 1; }
    .stat .lbl {
      font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.5px; color: #666; margin-top: 4px; font-weight: 600;
    }
    .class-summary {
      margin-bottom: 12px; font-size: 11px;
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .pill {
      background: #eef2ff; color: #1A2A6C;
      border: 1px solid #c7d2fe; border-radius: 999px;
      padding: 3px 10px; font-weight: 500;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; page-break-inside: auto; }
    thead {
      display: table-header-group;
      background: linear-gradient(135deg, #1A2A6C, #2c3e91);
      color: #fff;
    }
    th {
      padding: 9px 6px; text-align: left; font-weight: 700;
      font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.5px; border: 1px solid #1A2A6C;
    }
    th.center, td.center { text-align: center; }
    th.right, td.right { text-align: right; }
    tbody tr { page-break-inside: avoid; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody tr:hover { background: #eef2ff; }
    td { padding: 7px 6px; border: 1px solid #e5e7eb; vertical-align: middle; }
    td.idx {
      width: 32px; text-align: center; font-weight: 700;
      color: #1A2A6C; background: #f3f4f6;
    }
    td.name { font-weight: 600; color: #111827; }
    .footer {
      margin-top: 40px; display: flex; justify-content: space-between;
      align-items: flex-end; page-break-inside: avoid;
    }
    .footer .note { font-size: 10px; color: #666; line-height: 1.6; }
    .footer .sign-block { text-align: center; }
    .footer .sign-img { height: 45px; margin-bottom: 4px; object-fit: contain; }
    .footer .sign-line { border-top: 1.5px solid #333; width: 180px; margin-bottom: 4px; }
    .footer .sign-label {
      font-size: 11px; font-weight: 700; color: #1A2A6C;
      letter-spacing: 0.5px; text-transform: uppercase;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo-wrap">
      ${d.schoolLogo ? `<img src="${d.schoolLogo}" alt="Logo">` : ""}
    </div>
    <div class="title-block">
      <h1>${escapeHtml(d.schoolName)}</h1>
      ${d.schoolAddress ? `<div class="address">${escapeHtml(d.schoolAddress)}</div>` : ""}
      <h2>Student Details Report</h2>
    </div>
    <div class="spacer"></div>
  </div>

  <div class="meta-bar">
    <div class="item">
      <span class="label">Class</span>
      <span class="value">${escapeHtml(d.className)}</span>
    </div>
    <div class="item">
      <span class="label">Session</span>
      <span class="value">${escapeHtml(d.session)}</span>
    </div>
    <div class="item">
      <span class="label">Generated On</span>
      <span class="value">${generatedOn} · ${generatedTime}</span>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="num">${totalStudents}</div>
      <div class="lbl">Total Students</div>
    </div>
    <div class="stat">
      <div class="num">${Object.keys(classCounts).length}</div>
      <div class="lbl">Classes</div>
    </div>
    <div class="stat">
      <div class="num">? ${totalMonthly.toLocaleString("en-IN")}</div>
      <div class="lbl">Monthly Fee Total</div>
    </div>
    <div class="stat">
      <div class="num">? ${totalDue.toLocaleString("en-IN")}</div>
      <div class="lbl">Total Due</div>
    </div>
  </div>

  ${classSummary ? `<div class="class-summary">${classSummary}</div>` : ""}

  <table>
    <thead>
      <tr>
        <th class="center">#</th>
        <th>Name</th>
        <th>Father's Name</th>
        <th class="center">Class</th>
        <th class="center">Roll</th>
        <th class="center">Mobile</th>
        <th class="center">DOB</th>
        <th class="center">Age</th>
        <th class="center">Session</th>
        <th class="right">Due Fee</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    <div class="note">
      <div>Generated by School Management System</div>
      <div>Total Records: <b>${totalStudents}</b></div>
    </div>
    <div class="sign-block">
      ${d.principalSign ? `<img src="${d.principalSign}" class="sign-img"><br>` : `<div style="height:45px"></div>`}
      <div class="sign-line"></div>
      <div class="sign-label">Principal</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  <\/script>

</body>
</html>
  `);

  w.document.close();
  w.focus();
}

// ==================================
// STUDENT PROFILE PDF — with Print button
// ==================================
function openStudentProfilePDF(d) {
  const w = window.open("", "_blank");
  const s = d.student;

  const vName        = pick(s, "name", "Name", "fullName", "full_name", "studentName", "student_name");
  const vFather      = pick(s, "father", "Father", "fatherName", "father_name", "fathersName", "fathers_name");
  const vMother      = pick(s, "mother", "Mother", "motherName", "mother_name", "mothersName", "mothers_name");
  const vAddress     = pick(s, "address", "Address", "addr", "fullAddress", "full_address", "residentialAddress", "residential_address");
  const vReligion    = pick(s, "religion", "Religion", "religionName", "religion_name", "dharma");
  const vBlood       = pick(s, "bloodGroup", "blood_group", "bloodgroup", "BloodGroup", "blood", "Blood");
  const vEmail       = pick(s, "email", "Email", "emailId", "email_id", "mail", "emailAddress", "email_address");
  const vCity        = pick(s, "city", "City", "cityName", "city_name", "town", "district", "District");
  const vPin         = pick(s, "pin", "pincode", "pinCode", "pin_code", "PIN", "zip", "zipCode", "zip_code", "postalCode", "postal_code");
  const vGender      = pick(s, "gender", "Gender", "sex", "Sex");
  const vClass       = getClass(s) || "";
  const vRoll        = pick(s, "roll", "Roll", "rollNo", "roll_no", "rollNumber", "roll_number");
  const vMobile      = pick(s, "mobile", "Mobile", "phone", "mobileNumber", "mobile_number", "contact", "contactNumber", "contact_number", "phoneNumber", "phone_number");
  const vAltMobile   = pick(s, "altMobile", "alt_mobile", "alternateMobile", "alternate_mobile", "alternatePhone", "alternate_phone", "phone2", "mobile2", "secondaryMobile", "secondary_mobile");
  const vDob         = pick(s, "dob", "DOB", "dateOfBirth", "date_of_birth", "birthDate", "birth_date");
  const vAge         = pick(s, "age", "Age");
  const vAdmissionFee = pick(s, "admissionFee", "admission_fee", "admissionFeeAmount", "admission_fee_amount");
  const vMonthlyFee  = pick(s, "monthlyFee", "monthly_fee", "monthlyFeeAmount", "monthly_fee_amount");
  const vDueFee      = pick(s, "dueFee", "due_fee", "dueAmount", "due_amount", "pendingFee", "pending_fee", "balance");
  const vPaidFee     = pick(s, "paidFee", "paid_fee", "paidAmount", "paid_amount", "totalPaid", "total_paid");
  const vYear        = getYear(s) || "";
  const vSection     = pick(s, "section", "Section", "sec", "division", "sectionName", "section_name");
  const vAdmissionDate = pick(s, "admissionDate", "admission_date", "dateOfAdmission", "date_of_admission", "doa", "admissionOn", "admission_on");
  const vPreviousSchool = pick(s, "previousSchool", "previous_school", "prevSchool", "prev_school", "previousschool", "oldSchool", "old_school", "lastSchool", "last_school");
  const vOwnerId     = pick(s, "ownerId", "owner_id", "owner");
  const vCreatedAt   = pick(s, "createdAt", "created_at", "createdOn", "created_on", "creationDate", "creation_date");
  const vPhoto       = pick(s, "photo", "studentPhoto", "student_photo", "imageUrl", "image_url", "image");

  const EMPTY = "-";

  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  });
  const generatedTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit"
  });

  const row = (label, value, icon) => `
    <tr>
      <td class="lbl"><i class="ic ${icon || ''}"></i>${label}</td>
      <td class="val">${escapeHtml(value) || EMPTY}</td>
    </tr>`;

  const feeRow = (label, value, cls) => `
    <tr>
      <td class="lbl"><i class="ic fa-solid fa-indian-rupee-sign"></i>${label}</td>
      <td class="val ${cls || ""}">${(value !== "" && value !== null && value !== undefined) ? "? " + escapeHtml(value) : EMPTY}</td>
    </tr>`;

  // ============================================================
  // FIXED: Collect "Extra" fields (like Category) FIRST
  // ============================================================
  const extraEntries = [];
  const seenExtraLabels = new Set();

  // 1. Pull the nested 'extra' object (where Category lives)
  if (s.extra && typeof s.extra === "object") {
    for (const [k, v] of Object.entries(s.extra)) {
      if (v === undefined || v === null || v === "") continue;
      extraEntries.push([k, v]);
      seenExtraLabels.add(k.toLowerCase());
    }
  }

  // 2. Collect any other unmapped fields (excluding system keys)
  const skipKeys = new Set([
    "id", "extra", "delivered", "bookDelivered", "admitCardCreated", "ownerId", "createdAt", "schoolName", "status",
    // Skip standard fields already printed above
    "name","Name","fullName","studentName","father","fatherName","mother","motherName","address","religion","bloodGroup",
    "email","city","pincode","pin","gender","studentClass","class","roll","mobile","dob","age","admissionFee","monthlyFee",
    "dueFee","paidFee","academicYear","session","section","admissionDate","previousSchool","photo"
  ]);

  for (const k of Object.keys(s)) {
    if (skipKeys.has(k)) continue;
    const lower = k.toLowerCase();
    if (lower.includes("photo") || lower.includes("image")) continue;
    if (seenExtraLabels.has(lower)) continue; // Don't duplicate if already handled in s.extra
    
    const v = s[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "object" && !v.toDate && !v.seconds) continue; // skip nested objects
    
    extraEntries.push([k, v]);
  }

  const extraRows = extraEntries.map(([k, v]) => {
    const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\s+/g, ' ').replace(/^./, c => c.toUpperCase()).trim();
    const val = (typeof v === "object") ? fmtDate(v) : String(v);
    return row(label, val, "fa-solid fa-circle-info");
  }).join("");

  w.document.write(`
<html>
<head>
  <title>Student Profile — ${escapeHtml(vName) || "Student"}</title>

  <link rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

  <style>
    @page { size: A4; margin: 12mm 12mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

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
      max-width: 780px;
      margin: 0 auto;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      overflow: hidden;
      padding: 28px 32px 24px;
    }

    /* ---------- HEADER ---------- */
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 3px double #1A2A6C;
      margin-bottom: 18px;
    }
    .header .logo-wrap {
      width: 74px; height: 74px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #f8fafc; border-radius: 10px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }
    .header .logo-wrap img {
      max-width: 100%; max-height: 100%; object-fit: contain;
    }
    .header .logo-placeholder {
      width: 74px; height: 74px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #eef2ff; border-radius: 10px;
      color: #1A2A6C; font-size: 32px; font-weight: 800;
      border: 1px solid #c7d2fe;
    }
    .header .title-block { flex: 1; text-align: center; }
    .header h1 {
      font-size: 24px; color: #1A2A6C;
      letter-spacing: 0.5px; margin-bottom: 4px;
      text-transform: uppercase;
    }
    .header .address { font-size: 12px; color: #555; margin-bottom: 6px; }
    .header .subtitle {
      display: inline-block;
      background: linear-gradient(135deg, #1A2A6C, #B21F1F);
      color: #fff;
      padding: 4px 16px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .header .spacer { width: 74px; flex-shrink: 0; }

    /* ---------- PROFILE TOP ---------- */
    .profile-top {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 20px;
      margin-bottom: 20px;
      align-items: start;
    }

    .photo-block {
      width: 130px;
      height: 155px;
      border: 2px solid #1A2A6C;
      border-radius: 10px;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 11px;
      text-align: center;
      font-weight: 600;
      letter-spacing: 0.5px;
      overflow: hidden;
      position: relative;
    }
    .photo-block .photo-initial {
      font-size: 46px; font-weight: 800;
      color: #1A2A6C; opacity: 0.85;
    }
    .photo-block img {
      width: 100%; height: 100%; object-fit: cover;
    }

    .name-block {
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 155px;
      gap: 8px;
    }
    .name-block .big-name {
      font-size: 26px;
      font-weight: 800;
      color: #1A2A6C;
      letter-spacing: 0.3px;
      line-height: 1.15;
    }
    .name-block .name-sub {
      font-size: 13px;
      color: #555;
    }
    .badges {
      display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .badge i { font-size: 10px; }
    .badge.class {
      background: #eef2ff; color: #1A2A6C;
      border: 1px solid #c7d2fe;
    }
    .badge.roll {
      background: #fff7ed; color: #c2410c;
      border: 1px solid #fed7aa;
    }
    .badge.session {
      background: #ecfdf5; color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .badge.status {
      background: #dcfce7; color: #166534;
      border: 1px solid #bbf7d0;
    }

    /* ---------- INFO SECTIONS ---------- */
    .section { margin-bottom: 18px; }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 800;
      color: #1A2A6C;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #eef2ff;
    }
    .section-title .bar {
      display: inline-block;
      width: 4px;
      height: 16px;
      background: linear-gradient(135deg, #1A2A6C, #B21F1F);
      border-radius: 2px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      font-size: 12.5px;
    }

    .info-table tr:nth-child(even) { background: #f9fafb; }
    .info-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #eef2f7;
      vertical-align: middle;
    }
    .info-table tr:last-child td { border-bottom: none; }
    .info-table td.lbl {
      width: 42%;
      font-weight: 700;
      color: #4b5563;
      background: #f3f4f6;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .info-table td.val {
      font-weight: 600;
      color: #111827;
      word-break: break-word;
    }
    .info-table td.val.due { color: #B21F1F; }
    .info-table td.val.paid { color: #16a34a; }
    .info-table .ic {
      display: inline-block;
      width: 16px;
      margin-right: 6px;
      color: #1A2A6C;
      opacity: 0.85;
      text-align: center;
      font-size: 11px;
    }

    /* QR block */
    .qr-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
    }
    .qr-block img {
      width: 130px; height: 130px;
      background: #fff;
      padding: 4px;
      border-radius: 8px;
    }
    .qr-block .qr-label {
      font-size: 10px;
      color: #6b7280;
      margin-top: 6px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ---------- FOOTER ---------- */
    .footer {
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 14px;
      border-top: 1px dashed #cbd5e1;
    }
    .footer .note {
      font-size: 10px;
      color: #6b7280;
      line-height: 1.6;
    }
    .footer .note b { color: #1A2A6C; }
    .footer .sign-block { text-align: center; }
    .footer .sign-img {
      height: 46px;
      margin-bottom: 4px;
      object-fit: contain;
    }
    .footer .sign-line {
      border-top: 1.5px solid #333;
      width: 180px;
      margin: 0 auto 4px;
    }
    .footer .sign-label {
      font-size: 11px;
      font-weight: 700;
      color: #1A2A6C;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

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
        padding: 0;
        page-break-after: avoid;
      }
      .print-btn { display: none !important; }
      .no-print { display: none !important; }
      .section { page-break-inside: avoid; }
      .footer { page-break-inside: avoid; }
      .header { page-break-after: avoid; }
      .profile-top { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <button class="print-btn no-print" onclick="window.print()">
    <i class="fa-solid fa-print"></i>
    Print / Save as PDF
  </button>

  <div class="page">

    <!-- HEADER -->
    <div class="header">
      ${d.schoolLogo
        ? `<div class="logo-wrap"><img src="${d.schoolLogo}" alt="Logo"></div>`
        : `<div class="logo-placeholder">${escapeHtml((d.schoolName || "S").charAt(0))}</div>`}
      <div class="title-block">
        <h1>${escapeHtml(d.schoolName)}</h1>
        ${d.schoolAddress ? `<div class="address">${escapeHtml(d.schoolAddress)}</div>` : ""}
        <span class="subtitle">Student Profile</span>
      </div>
      <div class="spacer"></div>
    </div>

    <!-- PROFILE TOP -->
    <div class="profile-top">
      <div class="photo-block">
        ${vPhoto
          ? `<img src="${vPhoto}" alt="Student Photo">`
          : `<div><div class="photo-initial">${escapeHtml((vName || "?").charAt(0).toUpperCase())}</div></div>`}
      </div>
      <div class="name-block">
        <div class="big-name">${escapeHtml(vName) || "—"}</div>
        <div class="name-sub">${vFather ? "S/O " + escapeHtml(vFather) : "&nbsp;"}</div>
        <div class="badges">
          <span class="badge class"><i class="fa-solid fa-school"></i> Class: ${escapeHtml(vClass) || "—"}</span>
          <span class="badge roll"><i class="fa-solid fa-hashtag"></i> Roll: ${escapeHtml(vRoll) || "—"}</span>
          <span class="badge session"><i class="fa-regular fa-calendar"></i> ${escapeHtml(vYear) || "—"}</span>
          <span class="badge status"><i class="fa-solid fa-circle-check"></i> Active</span>
        </div>
      </div>
    </div>

    <!-- PERSONAL INFO -->
    <div class="section">
      <div class="section-title"><span class="bar"></span> Personal Information</div>
      <table class="info-table">
        ${row("Full Name",        vName,     "fa-solid fa-user")}
        ${row("Father's Name",    vFather,   "fa-solid fa-user-tie")}
        ${row("Mother's Name",    vMother,   "fa-solid fa-user-group")}
        ${row("Date of Birth",    vDob,      "fa-solid fa-cake-candles")}
        ${row("Age",              vAge,      "fa-solid fa-cake-candles")}
        ${row("Gender",           vGender,   "fa-solid fa-venus-mars")}
        ${row("Blood Group",      vBlood,    "fa-solid fa-droplet")}
        ${row("Religion",         vReligion, "fa-solid fa-hands-praying")}
      </table>
    </div>

    <!-- ACADEMIC INFO -->
    <div class="section">
      <div class="section-title"><span class="bar"></span> Academic Information</div>
      <table class="info-table">
        ${row("Class",             vClass,           "fa-solid fa-school")}
        ${row("Roll Number",       vRoll,            "fa-solid fa-hashtag")}
        ${row("Section",           vSection,         "fa-solid fa-book")}
        ${row("Academic Session",  vYear,            "fa-regular fa-calendar")}
        ${row("Admission Date",    vAdmissionDate,   "fa-regular fa-calendar-check")}
        ${row("Previous School",   vPreviousSchool,  "fa-solid fa-building-columns")}
      </table>
    </div>

    <!-- CONTACT INFO + QR -->
    <div class="section">
      <div class="section-title"><span class="bar"></span> Contact &amp; Verification</div>
      <div class="info-grid">
        <table class="info-table">
          ${row("Mobile Number",     vMobile,     "fa-solid fa-mobile-screen-button")}
          ${row("Alternate Mobile",  vAltMobile,  "fa-solid fa-phone")}
          ${row("Email",             vEmail,      "fa-solid fa-envelope")}
          ${row("Address",           vAddress,    "fa-solid fa-house")}
          ${row("City",              vCity,       "fa-solid fa-city")}
          ${row("PIN Code",          vPin,        "fa-solid fa-location-dot")}
        </table>
        <div class="qr-block">
          <img src="${d.qrUrl}" alt="QR Code">
          <div class="qr-label">Scan to verify</div>
        </div>
      </div>
    </div>

    <!-- FEE INFO -->
    <div class="section">
      <div class="section-title"><span class="bar"></span> Fee Information</div>
      <table class="info-table">
        ${feeRow("Admission Fee",  vAdmissionFee)}
        ${feeRow("Monthly Fee",    vMonthlyFee)}
        ${feeRow("Total Paid",     vPaidFee, "paid")}
        ${feeRow("Due Amount",     vDueFee,  "due")}
      </table>
    </div>

    <!-- EXTRA / ADDITIONAL INFO (only if any extra fields exist) -->
    ${extraEntries.length > 0 ? `
    <div class="section">
      <div class="section-title"><span class="bar"></span> Additional Information</div>
      <table class="info-table">
        ${extraRows}
      </table>
    </div>
    ` : ""}

    <!-- RECORD INFO -->
    <div class="section">
      <div class="section-title"><span class="bar"></span> Record Information</div>
      <table class="info-table">
        ${row("Record Created",  fmtDate(vCreatedAt) || "-",  "fa-solid fa-clock")}
        ${row("Owner ID",        vOwnerId || "-",             "fa-solid fa-fingerprint")}
      </table>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="note">
        <div>Generated on <b>${generatedOn}</b> at <b>${generatedTime}</b></div>
        <div>This is a computer-generated document.</div>
      </div>
      <div class="sign-block">
        ${d.principalSign
          ? `<img src="${d.principalSign}" class="sign-img"><br>`
          : `<div style="height:46px"></div>`}
        <div class="sign-line"></div>
        <div class="sign-label">Principal</div>
      </div>
    </div>

  </div>

</body>
</html>
  `);

  w.document.close();
  w.focus();
}