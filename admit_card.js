function normalizeClass(v){
  if(!v) return "";
  if(typeof v === "number") return String(v);
  return v.toLowerCase().replace(/\s+/g,"");
}

/* Firebase config */
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

/* Local storage keys */
const LS_SCHOOL_NAME = "admit_school_name";
const LS_EXAM_NAME = "admit_exam_name";
const ACADEMIC_YEAR_STORAGE_KEY = "smsAcademicYear";

/* Helpers */
function getSelectedAcademicYear() {
  let stored = localStorage.getItem(ACADEMIC_YEAR_STORAGE_KEY);
  if (!stored) {
    stored = String(new Date().getFullYear());
    localStorage.setItem(ACADEMIC_YEAR_STORAGE_KEY, stored);
  }
  return String(stored);
}
function escapeHtml(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function show(el) { if (el && el.classList) el.classList.add("show"); }
function hide(el) { if (el && el.classList) el.classList.remove("show"); }

/* DOM refs */
const classGrid = document.getElementById("class-card-grid");
const academicDisplay = document.getElementById("academic-year-display");

const studentModal = document.getElementById("studentModal");
const closeStudentModal = document.getElementById("closeStudentModal");
const studentModalTitle = document.getElementById("studentModalTitle");
const studentModalSub = document.getElementById("studentModalSub");
const studentModalBody = document.getElementById("studentModalBody");
const studentSearch = document.getElementById("studentSearch");
const studentPagination = document.getElementById("studentPagination");

const generateModal = document.getElementById("generateModal");
const closeGenerateModal = document.getElementById("closeGenerateModal");
const genStudentSummary = document.getElementById("gen-student-summary");
const genPhoto = document.getElementById("gen-photo");
const genName = document.getElementById("gen-name");
const genRoll = document.getElementById("gen-roll");
const genClass = document.getElementById("gen-class");
const genSchoolName = document.getElementById("gen-school-name");
const genExamName = document.getElementById("gen-exam-name");

const downloadGen = document.getElementById("downloadGen");
const printGen = document.getElementById("printGen");
const markGenerated = document.getElementById("markGenerated");

const pdfRenderArea = document.getElementById("pdf-render-area");
const logoutBtn = document.getElementById("logout-btn");

/* State */
let currentClass = null;
let allStudentsForClass = [];
let filteredStudents = [];
let currentPage = 1;
const PAGE_SIZE = 10;

let currentGenStudent = null;
let ownerProfile = null;

/* Owner signature (from school_settings/{uid}.principalSignature) */
let ownerSignatureUrl = "";

/* Hidden file input for photo upload */
const uploadPhotoInput = document.createElement("input");
uploadPhotoInput.type = "file";
uploadPhotoInput.accept = "image/*";
uploadPhotoInput.style.display = "none";
document.body.appendChild(uploadPhotoInput);

/* Render class cards */
function renderClassCards(){
  if(!classGrid) return;
  classGrid.innerHTML = "";

  const extraClasses = [
    { key: "preprimary", label: "Pre-Primary" },
    { key: "kg2", label: "LKG" },
    { key: "kg1", label: "NURSERY" },
    { key: "ukg", label: "UKG" }
  ];

  extraClasses.forEach(c=>{
    const card = document.createElement("div");
    card.className = "class-card";
    card.dataset.cls = c.key;
    card.innerHTML = `<div class="num">${c.label}</div><div class="sub">Tap to view students</div>`;
    card.addEventListener("click", ()=> openStudentModal(c.key));
    classGrid.appendChild(card);
  });

  for(let i=1;i<=12;i++){
    const card = document.createElement("div");
    card.className = "class-card";
    card.dataset.cls = String(i);
    card.innerHTML = `<div class="num">Class ${i}</div><div class="sub">Tap to view students</div>`;
    card.addEventListener("click", ()=> openStudentModal(String(i)));
    classGrid.appendChild(card);
  }

  if(academicDisplay) academicDisplay.textContent = getSelectedAcademicYear();
}

/* ============================================================
   FETCH OWNER SIGNATURE  (same source as marksheet & ID card)
   ============================================================ */
const SIGN_FIELDS = [
  "principalSignature", "principal_signature", "authoritySignature",
  "signature", "signatureUrl", "signUrl", "sign"
];

async function fetchOwnerSignature(uid) {
  if (!uid) return "";

  const collectionsToTry = ["school_settings", "user", "users", "owners", "schools"];

  for (const col of collectionsToTry) {
    try {
      const snap = await db.collection(col).doc(uid).get();
      if (snap.exists) {
        const d = snap.data();
        for (const f of SIGN_FIELDS) {
          if (d[f] && typeof d[f] === "string") {
            console.log(`? Admit card: signature found in ${col}/${uid} ? "${f}"`);
            return d[f];
          }
        }
      }
    } catch (e) {
      console.warn(`? ${col}/${uid} read failed:`, e.code || e.message);
    }
  }
  console.warn("?? Admit card: no signature found for uid:", uid);
  return "";
}

async function ensureOwnerSignature() {
  if (ownerSignatureUrl) return ownerSignatureUrl;
  const user = auth.currentUser;
  if (!user) return "";
  ownerSignatureUrl = await fetchOwnerSignature(user.uid);
  return ownerSignatureUrl;
}

/* Load owner profile from DB — also picks up the school logo + signature */
async function loadOwnerProfile(uid){
  try {
    let ref = db.collection('owners').doc(uid);
    let snap = await ref.get();
    if(!snap.exists){
      ref = db.collection('schools').doc(uid);
      snap = await ref.get();
    }
    if(snap.exists) ownerProfile = snap.data();

    /* Fallback: read school logo + name + signature from school_settings */
    try {
      const ssSnap = await db.collection('school_settings').doc(uid).get();
      if (ssSnap.exists) {
        const ss = ssSnap.data();
        if (!ownerProfile) ownerProfile = {};
        if (!ownerProfile.logoUrl) {
          ownerProfile.logoUrl = ss.logo || ss.logoUrl || ss.schoolLogo || "";
        }
        if (!ownerProfile.schoolName && ss.schoolName) {
          ownerProfile.schoolName = ss.schoolName;
        }
      }
    } catch (_) { /* ignore */ }

    /* Signature */
    ownerSignatureUrl = await fetchOwnerSignature(uid);
    if (ownerSignatureUrl) console.log("? Admit card: owner signature pre-loaded");
    if (ownerProfile && ownerProfile.logoUrl) console.log("? Admit card: school logo pre-loaded");
  } catch(err){
    console.warn("loadOwnerProfile failed:", err);
  }
}

/* Open student modal and fetch students */
async function openStudentModal(cls){
  if(!studentModal) return;
  currentClass = cls;
  const displayClassMap = {
    preprimary: "Pre-Primary",
    kg2: "LKG",
    kg1: "NURSERY",
    ukg: "UKG",
    lkg: "LKG",
    nursery: "NURSERY"
  };

  const displayClass = displayClassMap[normalizeClass(cls)] || `Class ${cls}`;

  studentModalTitle.textContent = `${displayClass} Students`;
  studentModalSub.textContent = "Loading students...";
  studentModalBody.innerHTML = "";
  show(studentModal);

  allStudentsForClass = [];
  filteredStudents = [];
  currentPage = 1;
  studentSearch.value = "";

  try {
    const user = auth.currentUser;
    if(!user){
      studentModalSub.textContent = "Sign-in required to load students.";
      return;
    }
    if(!ownerProfile) await loadOwnerProfile(user.uid);

    const academicYear = getSelectedAcademicYear();

    const snap = await db.collection("students")
      .where("ownerId","==", user.uid)
      .where("academicYear","==", academicYear)
      .get();

    const wantedRaw = normalizeClass(cls);
    let wanted = wantedRaw;
    if (wanted === "kg1" || wanted === "nursery") wanted = "nursery";
    else if (wanted === "kg2" || wanted === "lkg") wanted = "lkg";

    let docs = [];
    snap.forEach(d => {
      const data = d.data();
      let sc = normalizeClass(data.studentClass || data.class || "");
      if (sc === "kg1" || sc === "nursery") sc = "nursery";
      else if (sc === "kg2" || sc === "lkg") sc = "lkg";
      if (sc === wanted) docs.push({ id: d.id, data });
    });

    if(!docs.length){
      studentModalSub.textContent = `No students found for this class.`;
      return;
    }

    allStudentsForClass = docs;
    filteredStudents = [...docs];
    studentModalSub.textContent = `Found ${docs.length} student(s).`;
    renderStudentPage();

  } catch(err){
    console.error("openStudentModal error:", err);
    studentModalSub.textContent = "Error loading students — check console.";
  }
}

/* Render student page */
function renderStudentPage(){
  if(!studentModalBody) return;
  studentModalBody.innerHTML = "";
  const total = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage-1)*PAGE_SIZE;
  const end = Math.min(total, start + PAGE_SIZE);

  for(let i=start;i<end;i++){
    const s = filteredStudents[i];
    const tr = document.createElement("tr");
    const idx = i+1;
    const name = escapeHtml(s.data.name || "-");
    const roll = escapeHtml(s.data.roll || "-");
    const generated = !!s.data.admitCardCreated;
    const badge = generated
      ? `<span class="badge generated">Generated</span>`
      : `<span class="badge not-generated">Not Generated</span>`;

    tr.innerHTML = `
      <td>${idx}</td>
      <td>${name}</td>
      <td>${roll}</td>
      <td>${badge}</td>
      <td style="display:flex;gap:8px;align-items:center">
        <button class="action-btn btn-primary" data-action="generate" data-id="${s.id}">Generate</button>
        <button class="action-btn" data-action="mark" data-id="${s.id}" ${generated? 'disabled':''}>${generated? 'Generated':'Mark Generated'}</button>
      </td>
    `;

    tr.addEventListener("click", (e)=> {
      const btn = e.target.closest("button[data-action]");
      if(!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const stud = filteredStudents.find(x=> x.id === id);
      if(!stud) return;
      if(action === "generate") openGenerateModalWithStudent(id, stud.data);
      if(action === "mark") markAdmitCardGenerated(id, btn);
    });

    studentModalBody.appendChild(tr);
  }

  renderPaginationControls(total, PAGE_SIZE);
}

/* Pagination controls */
function renderPaginationControls(total, pageSize){
  if(!studentPagination) return;
  studentPagination.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(total/pageSize));

  const prev = document.createElement("button");
  prev.className = "page-btn";
  prev.textContent = "Prev";
  prev.disabled = currentPage <= 1;
  prev.addEventListener("click", ()=> { if(currentPage>1){ currentPage--; renderStudentPage(); } });
  studentPagination.appendChild(prev);

  const from = Math.max(1, currentPage - 2);
  const to = Math.min(totalPages, currentPage + 2);
  for(let p=from;p<=to;p++){
    const pbtn = document.createElement("button");
    pbtn.className = "page-btn";
    pbtn.textContent = p;
    if(p === currentPage) pbtn.style.fontWeight = "700";
    pbtn.addEventListener("click", ()=> { currentPage = p; renderStudentPage(); });
    studentPagination.appendChild(pbtn);
  }

  const next = document.createElement("button");
  next.className = "page-btn";
  next.textContent = "Next";
  next.disabled = currentPage >= totalPages;
  next.addEventListener("click", ()=> { if(currentPage<totalPages){ currentPage++; renderStudentPage(); } });
  studentPagination.appendChild(next);

  const info = document.createElement("span");
  info.style.marginLeft = "10px";
  info.style.color = "#666";
  info.textContent = ` ${Math.max(0, total)} student(s) — page ${currentPage}/${totalPages}`;
  studentPagination.appendChild(info);
}

/* Search */
if(studentSearch){
  studentSearch.addEventListener("input", ()=> {
    const q = (studentSearch.value||"").trim().toLowerCase();
    if(!q){ filteredStudents = [...allStudentsForClass]; currentPage = 1; renderStudentPage(); return; }
    filteredStudents = allStudentsForClass.filter(s=>{
      const name = (s.data.name||"").toLowerCase();
      const roll = String(s.data.roll||"").toLowerCase();
      return name.includes(q) || roll.includes(q);
    });
    currentPage = 1;
    renderStudentPage();
  });
}

/* Open generate modal with student */
function openGenerateModalWithStudent(docId, data){
  currentGenStudent = { id: docId, data };
  const rawStudentClass = normalizeClass(data.studentClass || data.class || "");

  const displayClassMap = {
    preprimary: "Pre-Primary",
    kg1: "NURSERY",
    nursery: "NURSERY",
    kg2: "LKG",
    lkg: "LKG",
    ukg: "UKG"
  };

  const displayStudentClass =
    displayClassMap[rawStudentClass] ||
    data.studentClass || data.class || "-";

  genStudentSummary.textContent =
    `${data.name || '-'} — Roll: ${data.roll || '-'} — Class: ${displayStudentClass}`;

  genName.textContent = data.name || "Student Name";
  genRoll.textContent = `Roll: ${data.roll || '-'}`;
  genClass.textContent = `Class: ${displayStudentClass}`;

  genPhoto.innerHTML = "";
  genPhoto.style.cursor = "default";
  genPhoto.onclick = null;

  if(data.photoUrl){
    const img = document.createElement("img"); img.src = data.photoUrl; genPhoto.appendChild(img);
  } else {
    genPhoto.textContent = "Upload Photo";
    genPhoto.style.cursor = "pointer";
    genPhoto.onclick = () => uploadPhotoInput.click();
  }

  const savedSchool = localStorage.getItem(LS_SCHOOL_NAME) || (ownerProfile && ownerProfile.schoolName) || "";
  const savedExam = localStorage.getItem(LS_EXAM_NAME) || "";
  genSchoolName.value = savedSchool;
  genExamName.value = savedExam;

  /* Ensure signature + logo loaded */
  if (!ownerSignatureUrl || !(ownerProfile && ownerProfile.logoUrl)) {
    const user = auth.currentUser;
    if (user) {
      loadOwnerProfile(user.uid).catch(()=>{});
    }
  }

  show(generateModal);
}

/* Mark admit card generated */
async function markAdmitCardGenerated(docId, btnElement){
  if(!confirm("Mark this student's admit card as GENERATED?")) return;
  try {
    await db.collection("students").doc(docId).update({
      admitCardCreated: true,
      admitCardCreatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if(btnElement){
      btnElement.textContent = "Generated";
      btnElement.disabled = true;
      const fsIdx = filteredStudents.findIndex(x=> x.id === docId);
      if(fsIdx>=0){ filteredStudents[fsIdx].data.admitCardCreated = true; }
      const allIdx = allStudentsForClass.findIndex(x=> x.id === docId);
      if(allIdx>=0) allStudentsForClass[allIdx].data.admitCardCreated = true;
      renderStudentPage();
    }
    alert("Marked as generated.");
  } catch(err){
    console.error("markAdmitCardGenerated error:", err);
    alert("Failed to update student (see console).");
  }
}

/* ========== PDF & Print Helpers ========== */

/* Build PDF HTML inside hidden render area */
function buildPdfTemplate(student, opts){

  const schoolName = escapeHtml(opts.schoolName || "Your School");
  const exam = escapeHtml(opts.examName || "Exam");
  const logoUrl = opts.logoUrl || null;

  const studentName = escapeHtml(student.name || "");
  const roll = escapeHtml(student.roll || "");
  const rawClass = normalizeClass(student.studentClass || student.class || "");

  const classLabelMap = {
    preprimary: "Pre-Primary",
    kg1: "NURSERY",
    nursery: "NURSERY",
    kg2: "LKG",
    lkg: "LKG",
    ukg: "UKG"
  };

  const cls = escapeHtml(
    classLabelMap[rawClass] ||
    student.studentClass ||
    student.class ||
    ""
  );

  const father = escapeHtml(
    student.fatherName || student.father || student.father_name || "-"
  );

  const headerLogo = logoUrl
    ? `<img src="${logoUrl}" style="height:50px;margin-right:12px" />`
    : "";

  /* Right column now shows the SCHOOL LOGO instead of the student photo */
  const logoBlockHtml = logoUrl
    ? `<img src="${logoUrl}"
            style="width:130px;height:130px;object-fit:contain;border-radius:12px;border:3px solid #6366f1;background:#fff;padding:8px;box-shadow:0 6px 18px rgba(99,102,241,0.18)" />`
    : `<div style="width:130px;height:130px;border-radius:12px;border:2px dashed #a5b4fc;background:#fff;display:flex;align-items:center;justify-content:center;color:#8b8f9c;font-size:12px">School Logo</div>`;

  const signatureHtml = ownerSignatureUrl
    ? `<img src="${ownerSignatureUrl}"
            style="max-height:55px;max-width:140px;object-fit:contain;display:block;margin:0 auto 6px"
            crossorigin="anonymous"
            onerror="this.style.display='none'" />`
    : `<div style="height:55px"></div>`;

  const infoBox = (label, value) => `
    <div style="background:linear-gradient(135deg,#ffffff 0%,#f8f7ff 100%);padding:12px 14px;border-radius:10px;border:1px solid #e0e7ff;box-shadow:0 2px 6px rgba(99,102,241,0.06)">
      <div style="font-size:11px;color:#6b7280;letter-spacing:0.4px;text-transform:uppercase;font-weight:600">${label}</div>
      <div style="font-weight:700;color:#1e1b4b;margin-top:3px;font-size:14px">${value}</div>
    </div>
  `;

  const html = `
 <div style="font-family:Segoe UI,Arial;background:#ffffff;padding:0">
    <div style="max-width:900px;margin:auto;background:linear-gradient(135deg,#fdfbff 0%,#f5f3ff 45%,#eef2ff 100%);border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(79,70,229,0.25);border:1px solid rgba(99,102,241,0.18)">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 60%,#8b5cf6 100%);color:#fff;padding:22px 26px;display:flex;align-items:center;box-shadow:inset 0 -2px 0 rgba(255,255,255,0.15)">
        ${headerLogo}
        <div>
          <div style="font-size:22px;font-weight:800;letter-spacing:0.3px">${schoolName}</div>
          <div style="opacity:0.92;margin-top:4px;font-size:14px;letter-spacing:0.2px">${exam} – Admit Card</div>
        </div>
        <div style="margin-left:auto;font-size:12px;opacity:0.9;text-align:right">
          <div style="font-weight:600">Academic Year</div>
          <div style="opacity:0.85;margin-top:2px">${escapeHtml(getSelectedAcademicYear())}</div>
        </div>
      </div>

      <!-- Body -->
      <div style="padding:26px;display:flex;gap:26px">

        <!-- Left -->
        <div style="flex:1">
          <div style="font-size:22px;font-weight:800;color:#1e1b4b;letter-spacing:0.2px">${studentName}</div>
          <div style="height:2px;width:60px;background:linear-gradient(to right,#6366f1,#a855f7);margin-top:8px;border-radius:2px"></div>

          <div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
            ${infoBox("Roll No", roll)}
            ${infoBox("Class", cls)}
            ${infoBox("Father's Name", father)}
          </div>

          <div style="margin-top:22px;padding:16px 18px;background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border-radius:12px;border-left:5px solid #6366f1">
            <div style="font-weight:700;margin-bottom:8px;color:#312e81;font-size:14px">Instructions</div>
            <ul style="margin:0;padding-left:18px;color:#4c4a63;font-size:13px;line-height:1.7">
              <li>Reach exam center 30 minutes early.</li>
              <li>Carry this admit card & valid ID.</li>
              <li>No electronic devices allowed.</li>
            </ul>
          </div>
        </div>

        <!-- Right — School Logo (replaces student photo) -->
        <div style="width:180px;text-align:center">
          ${logoBlockHtml}
          <div style="margin-top:10px;font-size:12px;color:#6b7280;font-weight:600;letter-spacing:0.4px">SCHOOL LOGO</div>

          <!-- Signature -->
          <div style="margin-top:32px">
            ${signatureHtml}
            <div style="border-top:1px solid #c7c9d9;padding-top:6px;font-size:12px;color:#4c4a63;font-weight:600">
              Principal Signature
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div style="padding:12px 26px;background:linear-gradient(to right,#eef2ff,#e0e7ff);font-size:11px;color:#4f46e5;text-align:right;font-weight:600;letter-spacing:0.3px">
        Generated on ${new Date().toLocaleString()}
      </div>

    </div>
  </div>
   `;

  pdfRenderArea.innerHTML = html;
}

/* Ensure html2canvas & jspdf loaded */
function ensurePdfLibs(){
  return new Promise((resolve) => {
    const libs = [];
    if(!window.html2canvas) libs.push('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    if(!window.jspdf && !window.jsPDF) libs.push('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if(libs.length===0) return resolve();
    let loaded=0;
    libs.forEach(src=>{
      const s = document.createElement('script'); s.src = src;
      s.onload = ()=>{ loaded++; if(loaded===libs.length) resolve(); };
      s.onerror = ()=>{ console.warn("Failed to load", src); loaded++; if(loaded===libs.length) resolve(); };
      document.head.appendChild(s);
    });
  });
}

/* Download PDF from generate modal */
async function downloadGenerateModalAsPDF(){
  if(!currentGenStudent) return alert("No student selected.");

  if(genSchoolName && genSchoolName.value) localStorage.setItem(LS_SCHOOL_NAME, genSchoolName.value);
  if(genExamName && genExamName.value) localStorage.setItem(LS_EXAM_NAME, genExamName.value);

  await ensureOwnerSignature();

  buildPdfTemplate(currentGenStudent.data, {
    schoolName: genSchoolName.value || (ownerProfile && ownerProfile.schoolName) || "Your School",
    examName: genExamName.value || "Exam",
    logoUrl: ownerProfile && ownerProfile.logoUrl ? ownerProfile.logoUrl : null
  });

  await ensurePdfLibs();
  try {
    await new Promise(r => setTimeout(r, 200));

    const el = pdfRenderArea;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging:false, allowTaint: true });
    const imgData = canvas.toDataURL("image/png");

    let jsPDFConstructor = null;
    if(window.jspdf && window.jspdf.jsPDF) jsPDFConstructor = window.jspdf.jsPDF;
    else if(window.jsPDF) jsPDFConstructor = window.jsPDF;
    else if(window.jspdf) jsPDFConstructor = window.jspdf;
    if(!jsPDFConstructor && window.jspdf && window.jspdf.default) jsPDFConstructor = window.jspdf.default.jsPDF;
    if(!jsPDFConstructor) {
      // Fallback: download the admit card as a PNG file directly
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `${(currentGenStudent.data.name || 'student').replace(/\s+/g,'_')}_admit_card.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const widthPx = canvas.width;
    const heightPx = canvas.height;
    const pdf = new jsPDFConstructor({ unit: 'px', format: [widthPx, heightPx] });
    pdf.addImage(imgData, 'PNG', 0, 0, widthPx, heightPx);
    const fname = `${(currentGenStudent.data.name||'student').replace(/\s+/g,'_')}_admit_card.pdf`;
    pdf.save(fname);
  } catch(err){
    console.error("downloadGenerateModalAsPDF error:", err);
    alert("Failed to create PDF (see console).");
  } finally {
    pdfRenderArea.innerHTML = "";
  }
}

/* Print using same template */
/* Print using same template — uses hidden iframe (no about:blank, no popup) */
async function printGenerateModal(){
  if(!currentGenStudent) return alert("No student selected.");

  if(genSchoolName && genSchoolName.value) localStorage.setItem(LS_SCHOOL_NAME, genSchoolName.value);
  if(genExamName && genExamName.value) localStorage.setItem(LS_EXAM_NAME, genExamName.value);

  await ensureOwnerSignature();

  buildPdfTemplate(currentGenStudent.data, {
    schoolName: genSchoolName.value || (ownerProfile && ownerProfile.schoolName) || "Your School",
    examName: genExamName.value || "Exam",
    logoUrl: ownerProfile && ownerProfile.logoUrl ? ownerProfile.logoUrl : null
  });

  await ensurePdfLibs();
  try {
    await new Promise(r => setTimeout(r, 200));
    const el = pdfRenderArea;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging:false, allowTaint: true });
    const imgData = canvas.toDataURL("image/png");

    // ---------------------------------------------------------
    // Use a hidden iframe instead of window.open("") — this
    // avoids the "about:blank" tab and prints directly.
    // ---------------------------------------------------------
    const oldFrame = document.getElementById("__admit_print_frame__");
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "__admit_print_frame__";
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Admit Card</title>
          <style>
            @page { margin: 0; }
            html, body { margin: 0; padding: 0; background: #fff; }
            img { display: block; width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <img src="${imgData}" />
        </body>
      </html>
    `);
    doc.close();

    // Wait for the image to render inside the iframe, then print
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error("Iframe print failed:", e);
        alert("Could not open print dialog. Please try again.");
      }
      // Clean up the iframe after the print dialog closes
      setTimeout(() => {
        if (iframe.parentNode) iframe.remove();
      }, 1500);
    }, 500);

  } catch(err){
    console.error("printGenerateModal error:", err);
    alert("Failed to print (see console).");
  } finally {
    pdfRenderArea.innerHTML = "";
  }
}

/* Save defaults when both fields entered */
function attemptSaveDefaults(){
  try {
    const s = (genSchoolName && genSchoolName.value || "").trim();
    const e = (genExamName && genExamName.value || "").trim();
    if(s && e){
      localStorage.setItem(LS_SCHOOL_NAME, s);
      localStorage.setItem(LS_EXAM_NAME, e);
    }
  } catch(err){
    console.warn("attemptSaveDefaults error", err);
  }
}
if(genSchoolName) genSchoolName.addEventListener('input', attemptSaveDefaults);
if(genExamName) genExamName.addEventListener('input', attemptSaveDefaults);

/* Upload photo input handler (still used in the modal preview) */
uploadPhotoInput.addEventListener("change", function() {
  const file = this.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = function(e){
    genPhoto.innerHTML = "";
    const img = document.createElement("img");
    img.src = e.target.result;
    genPhoto.appendChild(img);

    if(currentGenStudent){
      currentGenStudent.data.photoUrl = e.target.result;
    }
  };
  reader.readAsDataURL(file);
});

/* Close modals handlers */
if(closeStudentModal) closeStudentModal.addEventListener('click', ()=> {
  hide(studentModal);
  studentModalBody.innerHTML = "";
  allStudentsForClass = [];
  filteredStudents = [];
  currentPage = 1;
});
if(closeGenerateModal) closeGenerateModal.addEventListener('click', ()=> {
  hide(generateModal);
  currentGenStudent = null;
});

/* Wire download/print/mark buttons */
if(downloadGen) downloadGen.addEventListener('click', downloadGenerateModalAsPDF);
if(printGen) printGen.addEventListener('click', printGenerateModal);
if(markGenerated) markGenerated.addEventListener('click', async ()=> {
  if(!currentGenStudent) return alert("No student selected");
  await markAdmitCardGenerated(currentGenStudent.id, null);
});

/* Logout */
if(logoutBtn) logoutBtn.addEventListener('click', async ()=> {
  try { await auth.signOut(); alert('Signed out'); location.reload(); } catch(e){ console.error(e); alert('Sign out failed'); }
});

/* Auth listener */
auth.onAuthStateChanged(async (user)=>{
  if(!user) {
    console.log("Not signed in — waiting for sign in");
    return;
  }
  await loadOwnerProfile(user.uid);
  const savedSchool = localStorage.getItem(LS_SCHOOL_NAME);
  if(!savedSchool && ownerProfile && ownerProfile.schoolName) localStorage.setItem(LS_SCHOOL_NAME, ownerProfile.schoolName);
  renderClassCards();
});