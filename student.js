// ==================================
// FINAL STUDENT.JS (FIRESTORE SCHOOL NAME + FULL PDF FIXED)
// ==================================

// ---------- HELPERS ----------
const el = (id) => document.getElementById(id);
const val = (id, d = "") => el(id)?.value || d;
const num = (id, d = 0) => Number(val(id, d)) || d;

function fileToBase64(input) {
  return new Promise((resolve) => {
    if (!input?.files?.[0]) return resolve("");
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(input.files[0]);
  });
}

// ---------- FIREBASE ----------
const firebaseConfig = {
  apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
  authDomain: "school-management-projec-9db7a.firebaseapp.com",
  projectId: "school-management-projec-9db7a"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ---------- USER STORAGE KEYS ----------
function storageKey(uid, key) {
  return `${uid}_${key}`;
}

// ---------- DEFAULT SCHOOL ----------
const DEFAULT_SCHOOL = "ABC PUBLIC SCHOOL";

// =================================================
// AUTH STATE
// =================================================
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const logoKey = storageKey(user.uid, "schoolLogo");
  const signKey = storageKey(user.uid, "principalSign");

  // ----- LOAD SCHOOL NAME -----
  try {
    const snap = await db.collection("school_settings").doc(user.uid).get();
    el("school-name").value = snap.exists
      ? snap.data().schoolName || DEFAULT_SCHOOL
      : DEFAULT_SCHOOL;
  } catch {
    el("school-name").value = DEFAULT_SCHOOL;
  }

  // ----- SAVE SCHOOL NAME -----
  el("school-name")?.addEventListener("input", async () => {
    await db.collection("school_settings").doc(user.uid).set(
      {
        schoolName: val("school-name", DEFAULT_SCHOOL),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  // ----- SAVE LOGO -----
  el("school-logo")?.addEventListener("change", async () => {
    const b64 = await fileToBase64(el("school-logo"));
    if (b64) {
      localStorage.setItem(logoKey, b64);
      alert("School logo saved");
    }
  });

  // ----- SAVE SIGN -----
  el("principal-signature")?.addEventListener("change", async () => {
    const b64 = await fileToBase64(el("principal-signature"));
    if (b64) {
      localStorage.setItem(signKey, b64);
      alert("Principal signature saved");
    }
  });
});

// ---------- AUTO AGE ----------
el("student-dob")?.addEventListener("change", () => {
  const dob = new Date(val("student-dob"));
  if (!dob) return;

  const t = new Date();
  let age = t.getFullYear() - dob.getFullYear();
  if (t < new Date(t.getFullYear(), dob.getMonth(), dob.getDate())) age--;
  el("student-age").value = age >= 0 ? age : "";
});

// =================================================
// SAVE STUDENT
// =================================================
el("student-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const studentData = {
    ownerId: user.uid,
    academicYear: new Date().getFullYear().toString(),
    name: val("student-name"),
    father: val("student-father"),
    studentClass: val("student-class"),
    roll: val("student-roll"),
    mobile: val("student-mobile"),
    dob: val("student-dob"),
    age: num("student-age"),
    admissionFee: num("student-fee"),
    monthlyFee: num("student-monthly-fee"),
    dueFee: num("student-due-fee"),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!studentData.name || !studentData.studentClass) {
    return alert("Student name and class required");
  }

  await db.collection("students").add(studentData);
  alert("Student saved successfully");
  e.target.reset();
});

// =================================================
// PRINT / PDF
// =================================================
el("student-print-btn")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const logo = localStorage.getItem(storageKey(user.uid, "schoolLogo")) || "";
  const sign = localStorage.getItem(storageKey(user.uid, "principalSign")) || "";
  const studentPhoto = await fileToBase64(el("student-photo"));

  const qrData = `
${val("school-name")}
Name: ${val("student-name")}
Class: ${val("student-class")}
Roll: ${val("student-roll")}
Mobile: ${val("student-mobile")}
  `.trim();

  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" +
    encodeURIComponent(qrData);

  printPDF({
    schoolName: val("school-name", DEFAULT_SCHOOL),
    schoolLogo: logo,
    principalSign: sign,
    studentPhoto,
    qrUrl,

    name: val("student-name"),
    father: val("student-father"),
    className: val("student-class"),
    roll: val("student-roll"),
    dob: val("student-dob"),
    age: val("student-age"),
    admissionFee: num("student-fee"),
    monthlyFee: num("student-monthly-fee"),
    dueFee: num("student-due-fee")
  });
});

// =================================================
// PDF FUNCTION (ORIGINAL FULL VERSION RESTORED)
// =================================================
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
        <td rowspan="4" class="center">
          ${d.studentPhoto ? `<img src="${d.studentPhoto}" class="photo">` : "No Photo"}
        </td>
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
