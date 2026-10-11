/* Smart Excel Student Import — dropdown-free edition
 * Compatible with the modern upload.html (no yearSelect / classSelect).
 *
 * Excel MUST contain:
 *   - "Student Name"    (required)
 *   - "Academic Year"   (required — 4-digit year)
 *   - "Class"           (required)
 *
 * All other columns are optional and auto-detected via the mapping UI.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const fileInput = $("fileInput");
  const previewBtn = $("previewBtn");
  const uploadBtn = $("uploadBtn");
  const previewTable = $("previewTable");
  const progressBar = $("progressBar");
  const statusText = $("status");
  const dateFormatSelect = $("dateFormat") || { value: "yyyy-mm-dd" };

  if (!fileInput || !previewBtn || !uploadBtn || !previewTable) {
    console.error(
      "Smart Excel Import: required elements missing. Check upload.html IDs: fileInput, previewBtn, uploadBtn, previewTable."
    );
    return;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
    authDomain: "school-management-projec-9db7a.firebaseapp.com",
    projectId: "school-management-projec-9db7a",
    storageBucket: "school-management-projec-9db7a.firebasestorage.app",
    messagingSenderId: "975842483778",
    appId: "1:975842483778:web:d1708792ff56014f3317db"
  };

  if (!window.firebase) {
    setStatus("Firebase SDK load হয়নি। upload.html-এ Firebase scripts পরীক্ষা করুন।", true);
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();
  const db = firebase.firestore();

  let headers = [];
  let sourceRows = [];
  let mapping = {};
  let validRows = [];
  let invalidRows = [];
  let busy = false;

  const FIELDS = [
    ["", "— Skip this column —"],
    ["name", "Student Name (required)"],
    ["academicYear", "Academic Year (required)"],
    ["studentClass", "Class (required)"],
    ["father", "Father Name"],
    ["mother", "Mother Name"],
    ["gender", "Gender"],
    ["religion", "Religion"],
    ["bloodGroup", "Blood Group"],
    ["email", "Email"],
    ["address", "Address"],
    ["city", "City"],
    ["pincode", "PIN / Pincode"],
    ["section", "Section"],
    ["roll", "Roll Number"],
    ["mobile", "Mobile Number"],
    ["aadharNo", "Aadhaar Number"],
    ["dateOfAdmission", "Date of Admission"],
    ["dob", "Date of Birth"],
    ["age", "Age"],
    ["schoolName", "School Name"],
    ["admissionFee", "Admission Fee"],
    ["monthlyFee", "Monthly Fee"],
    ["dueFee", "Due Fee"]
  ];
  const DATE_FIELDS = new Set(["dob", "dateOfAdmission"]);
  const NUMBER_FIELDS = new Set(["age", "admissionFee", "monthlyFee", "dueFee"]);

  const ALIASES = {
    name: ["name", "student name", "studentname", "student full name", "full name", "pupil name", "শিক্ষার্থীর নাম", "ছাত্রের নাম", "ছাত্রীর নাম"],
    academicYear: ["academic year", "academicyear", "academic_year", "session", "season", "year", "শিক্ষাবর্ষ", "সেশন", "শিক্ষাবর্ষের বছর"],
    studentClass: ["class", "student class", "class name", "standard", "grade", "শ্রেণি", "শ্রেণী", "ক্লাস"],
    father: ["father", "father name", "father's name", "fathername", "fathers name", "guardian name", "পিতার নাম", "বাবার নাম"],
    mother: ["mother", "mother name", "mother's name", "mothername", "mothers name", "মাতার নাম", "মায়ের নাম", "মায়ের নাম"],
    gender: ["gender", "sex", "লিঙ্গ"],
    religion: ["religion", "ধর্ম"],
    bloodGroup: ["blood group", "bloodgroup", "blood", "রক্তের গ্রুপ"],
    email: ["email", "email id", "e-mail", "ইমেইল"],
    address: ["address", "full address", "present address", "home address", "residential address", "student address", "ঠিকানা", "বর্তমান ঠিকানা", "বাসার ঠিকানা"],
    city: ["city", "town", "গ্রাম", "শহর"],
    pincode: ["pin", "pin code", "pincode", "postal code", "zip", "zip code"],
    section: ["section", "sec", "বিভাগ"],
    roll: ["roll", "roll no", "roll number", "rollno", "rollnumber", "class roll", "রোল", "রোল নম্বর"],
    mobile: ["mobile", "mobile no", "mobile number", "phone", "phone number", "contact", "contact no", "মোবাইল", "ফোন নম্বর"],
    aadharNo: ["aadhaar", "aadhar", "aadhaar no", "aadhar no", "aadhaar number", "aadhar number"],
    dateOfAdmission: ["date of admission", "admission date", "dateofadmission", "admissiondate", "doa", "ভর্তির তারিখ"],
    dob: ["dob", "date of birth", "birth date", "dateofbirth", "birthdate", "জন্ম তারিখ", "জন্মতারিখ"],
    age: ["age", "বয়স", "বয়স"],
    schoolName: ["school", "school name", "schoolname", "বিদ্যালয়ের নাম", "স্কুলের নাম"],
    admissionFee: ["admission fee", "admissionfee", "admission fees", "ভর্তি ফি"],
    monthlyFee: ["monthly fee", "monthlyfee", "monthly fees", "মাসিক ফি"],
    dueFee: ["due fee", "duefee", "due amount", "balance", "outstanding", "বকেয়া", "বকেয়া"]
  };

  function normalizeHeader(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[_\-./\\]+/g, " ")
      .replace(/[’']/g, "")
      .replace(/[()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const ALIAS_LOOKUP = {};
  Object.entries(ALIASES).forEach(([field, names]) => {
    names.forEach((name) => {
      ALIAS_LOOKUP[normalizeHeader(name)] = field;
    });
  });

  window.downloadTemplate = function downloadTemplate() {
    if (!window.XLSX) {
      alert("SheetJS library is not loaded.");
      return;
    }
    const sample = [{
      "Student Name": "Rahul Das",
      "Academic Year": "2026",
      "Class": "1",
      "Section": "A",
      "Roll No": "01",
      "Father Name": "Rajesh Das",
      "Mother Name": "Mina Das",
      "Gender": "Male",
      "Address": "Kolkata, West Bengal",
      "City": "Kolkata",
      "Pincode": "700001",
      "Date of Birth": "2018-05-12",
      "Mobile": "9876543210",
      "Admission Fee": 0,
      "Monthly Fee": 800,
      "Due Fee": 0
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student-import-template.xlsx");
  };

  function setStatus(message, isError = false) {
    if (!statusText) return;
    statusText.textContent = message;
    statusText.style.color = isError ? "#b42318" : "";
  }

  function labelForField(field) {
    return (FIELDS.find(([key]) => key === field) || [field, field])[1];
  }

  function injectStylesAndMappingUI() {
    let panel = $("smartMappingPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "smartMappingPanel";
      panel.className = "smart-import-panel";
      panel.innerHTML = `
        <h3>Smart Column Mapping</h3>
        <p class="smart-import-help">Excel-এর প্রতিটি হেডিং আপনার Student Database-এর কোন ফিল্ডে যাবে তা যাচাই করুন। সিস্টেম পরিচিত হেডিং মিলিয়ে প্রস্তাব দেবে; ভুল হলে এখানে পরিবর্তন করুন।</p>
        <div id="smartImportSummary" class="smart-import-summary"></div>
        <div id="smartMappingGrid" class="smart-map-grid"></div>
        <div id="smartPreviewNote" class="smart-small-note"></div>
        <label class="smart-confirm-row">
          <input type="checkbox" id="smartImportConfirmed">
          <span>আমি Preview, Column Mapping এবং Error Summary পরীক্ষা করেছি। উপরের বৈধ রেকর্ডগুলো এই স্কুল ও Academic Year-এ সেভ করতে সম্মত।</span>
        </label>
      `;
      previewTable.parentElement?.insertBefore(panel, previewTable);
      if (!panel.isConnected) {
        (previewBtn.parentElement || fileInput.parentElement || document.body).appendChild(panel);
      }
    }

    const tableWrap = previewTable.parentElement;
    if (tableWrap && !tableWrap.classList.contains("smart-import-table-wrap")) {
      tableWrap.classList.add("smart-import-table-wrap");
    }
  }

  function guessField(header) {
    const normalized = normalizeHeader(header);
    if (ALIAS_LOOKUP[normalized]) return ALIAS_LOOKUP[normalized];

    const compact = normalized.replace(/\s/g, "");
    if (compact === "studentname" || compact === "studentfullname") return "name";
    if (compact === "academicyear" || compact === "session") return "academicYear";
    if (compact === "studentclass" || compact === "classname") return "studentClass";
    if (compact === "fathername" || compact === "fathersname") return "father";
    if (compact === "mothername" || compact === "mothersname") return "mother";
    if (compact === "dateofbirth" || compact === "birthdate") return "dob";
    if (compact === "rollno" || compact === "rollnumber") return "roll";
    if (compact === "monthlyfee") return "monthlyFee";
    if (compact === "admissionfee") return "admissionFee";
    if (compact === "duefee") return "dueFee";
    return "";
  }

  function renderMapping() {
    injectStylesAndMappingUI();
    const grid = $("smartMappingGrid");
    if (!grid) return;
    grid.innerHTML = "";

    headers.forEach((header, index) => {
      const wrapper = document.createElement("label");
      wrapper.className = "smart-map-item";
      const title = document.createElement("span");
      title.textContent = `Excel Column: ${header || `(Column ${index + 1})`}`;
      const select = document.createElement("select");
      select.dataset.columnIndex = String(index);
      select.setAttribute("aria-label", `Map ${header} to student field`);

      FIELDS.forEach(([field, label]) => {
        const option = document.createElement("option");
        option.value = field;
        option.textContent = label;
        select.appendChild(option);
      });
      select.value = mapping[index] || "";
      select.addEventListener("change", () => {
        mapping[index] = select.value;
        const sameField = Object.entries(mapping).filter(([i, field]) => field && field === select.value && i !== String(index));
        if (select.value && sameField.length) {
          alert(`"${labelForField(select.value)}" ফিল্ডটি ইতিমধ্যে অন্য কলামে ম্যাপ করা আছে।`);
          select.value = "";
          mapping[index] = "";
        }
        renderPreview();
      });
      wrapper.append(title, select);
      grid.appendChild(wrapper);
    });

    const confirmed = $("smartImportConfirmed");
    if (confirmed) {
      confirmed.checked = false;
      confirmed.onchange = updateSaveState;
    }
    const note = $("smartPreviewNote");
    if (note) note.textContent = "একটি Excel কলাম একটি মাত্র ফিল্ডে ম্যাপ করা যাবে। অপ্রয়োজনীয় কলাম Skip করতে পারেন।";
    renderPreview();
  }

  function parseDate(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "number" && Number.isFinite(value)) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
      return date.toISOString().slice(0, 10);
    }

    const text = String(value).trim();
    if (!text) return "";

    let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return validISO(+m[1], +m[2], +m[3]);

    m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
      const first = +m[1], second = +m[2], year = +m[3];
      const preference = dateFormatSelect.value || "yyyy-mm-dd";
      return preference === "mm-dd-yyyy"
        ? validISO(year, first, second)
        : validISO(year, second, first);
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return "";
  }

  function validISO(year, month, day) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function cellValue(value, field) {
    if (value === null || value === undefined) return "";
    if (DATE_FIELDS.has(field)) return parseDate(value);
    if (NUMBER_FIELDS.has(field)) {
      if (String(value).trim() === "") return "";
      const n = Number(String(value).replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : String(value).trim();
    }
    return String(value).trim();
  }

  function buildRows() {
    const rows = [];
    const errors = [];

    sourceRows.forEach((cells, rowIndex) => {
      const student = {};
      const extra = {};
      headers.forEach((header, colIndex) => {
        const field = mapping[colIndex] || "";
        const raw = cells[colIndex];
        if (!field) {
          const clean = normalizeHeader(header).replace(/\s+/g, "_").replace(/[^\w\u0980-\u09FF]/g, "");
          if (clean && raw !== undefined && raw !== null && String(raw).trim() !== "") {
            extra[clean] = String(raw).trim();
          }
          return;
        }
        student[field] = cellValue(raw, field);
      });

      if (!student.schoolName) student.schoolName = "";
      if (student.academicYear) student.academicYear = String(student.academicYear).trim();
      if (student.studentClass)  student.studentClass  = String(student.studentClass).trim();

      const rowErrors = [];
      if (!student.name || !String(student.name).trim())
        rowErrors.push("Student Name missing");
      if (!student.studentClass)
        rowErrors.push("Class missing (add a 'Class' column in Excel)");
      if (!student.academicYear)
        rowErrors.push("Academic Year missing (add an 'Academic Year' column in Excel)");
      if (student.academicYear && !/^\d{4}$/.test(String(student.academicYear)))
        rowErrors.push("Academic Year must be a 4-digit year");

      ["dob", "dateOfAdmission"].forEach((field) => {
        if (student[field] && !/^\d{4}-\d{2}-\d{2}$/.test(String(student[field]))) {
          rowErrors.push(`${labelForField(field)} date invalid`);
        }
      });
      ["age", "admissionFee", "monthlyFee", "dueFee"].forEach((field) => {
        if (student[field] !== "" && student[field] !== undefined && typeof student[field] !== "number") {
          rowErrors.push(`${labelForField(field)} must be numeric`);
        }
      });

      const hasAnyValue = cells.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
      if (!hasAnyValue) return;

      const record = { sourceRow: rowIndex + 2, student, extra, errors: rowErrors };
      if (rowErrors.length) errors.push(record);
      else rows.push(record);
    });

    return { rows, errors };
  }

  function renderPreview() {
    if (!headers.length) return;
    const result = buildRows();
    validRows = result.rows;
    invalidRows = result.errors;

    const summary = $("smartImportSummary");
    if (summary) {
      summary.innerHTML = `
        <span class="smart-import-chip">Spreadsheet rows: ${sourceRows.length}</span>
        <span class="smart-import-chip good">Valid: ${validRows.length}</span>
        <span class="smart-import-chip error">Needs attention: ${invalidRows.length}</span>
      `;
    }

    const visibleFields = [
      ["name", "Student Name"], ["academicYear", "Academic Year"], ["studentClass", "Class"],
      ["section", "Section"], ["roll", "Roll"], ["father", "Father"], ["mother", "Mother"],
      ["address", "Address"], ["city", "City"], ["pincode", "PIN"], ["dob", "DOB"],
      ["mobile", "Mobile"], ["admissionFee", "Adm. Fee"], ["monthlyFee", "Monthly Fee"], ["dueFee", "Due Fee"]
    ].filter(([field]) => Object.values(mapping).includes(field) || ["name", "studentClass", "academicYear"].includes(field));

    previewTable.replaceChildren();
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Excel Row", ...visibleFields.map(([, label]) => label), "Status"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    previewTable.appendChild(thead);

    const tbody = document.createElement("tbody");
    const all = [
      ...validRows.map((record) => ({ ...record, isValid: true })),
      ...invalidRows.map((record) => ({ ...record, isValid: false }))
    ].sort((a, b) => a.sourceRow - b.sourceRow);

    all.slice(0, 500).forEach((record) => {
      const tr = document.createElement("tr");
      tr.className = record.isValid ? "smart-row-ok" : "smart-row-error";
      const first = document.createElement("td");
      first.textContent = String(record.sourceRow);
      tr.appendChild(first);
      visibleFields.forEach(([field]) => {
        const td = document.createElement("td");
        td.textContent = record.student[field] === undefined || record.student[field] === "" ? "—" : String(record.student[field]);
        tr.appendChild(td);
      });
      const status = document.createElement("td");
      status.textContent = record.isValid ? "Ready" : record.errors.join("; ");
      tr.appendChild(status);
      tbody.appendChild(tr);
    });
    previewTable.appendChild(tbody);

    if (all.length > 500) {
      const note = $("smartPreviewNote");
      if (note) note.textContent = `Preview-তে প্রথম 500টি non-empty row দেখানো হয়েছে; মোট ${all.length}টি row যাচাই করা হয়েছে।`;
    }

    const confirmed = $("smartImportConfirmed");
    if (confirmed) confirmed.checked = false;
    updateSaveState();
  }

  function updateSaveState() {
    if (!uploadBtn) return;
    const confirmed = $("smartImportConfirmed")?.checked === true;
    uploadBtn.disabled = busy || !headers.length || validRows.length === 0 || !confirmed;
    uploadBtn.title = !confirmed
      ? "Preview যাচাই করে confirmation checkbox টিক দিন"
      : "";
  }

  async function parseSelectedFile() {
    const file = fileInput.files?.[0];
    if (!file) throw new Error("প্রথমে একটি Excel বা CSV ফাইল নির্বাচন করুন।");
    if (!window.XLSX) throw new Error("SheetJS XLSX লাইব্রেরি লোড হয়নি।");
    const allowed = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!allowed) throw new Error("শুধুমাত্র .xlsx, .xls অথবা .csv ফাইল ব্যবহার করুন।");

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: false });
    if (!wb.SheetNames.length) throw new Error("Excel ফাইলে কোনো worksheet পাওয়া যায়নি।");
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1, defval: "", raw: true, blankrows: false
    });
    if (matrix.length < 2) throw new Error("ফাইলে header row এবং অন্তত একটি student row থাকতে হবে।");

    headers = matrix[0].map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
    if (headers.every((h) => /^Column \d+$/.test(h))) {
      throw new Error("প্রথম সারিতে Excel column heading পাওয়া যায়নি।");
    }
    sourceRows = matrix.slice(1).filter((row) =>
      row.some((v) => v !== null && v !== undefined && String(v).trim() !== "")
    );
    if (!sourceRows.length) throw new Error("হেডিংয়ের পরে কোনো student data পাওয়া যায়নি।");

    mapping = {};
    headers.forEach((header, index) => {
      const guess = guessField(header);
      if (guess && !Object.values(mapping).includes(guess)) mapping[index] = guess;
      else mapping[index] = "";
    });

    renderMapping();
    const note = $("smartPreviewNote");
    if (note) note.textContent =
      `ফাইল: ${file.name} • ${sourceRows.length}টি non-empty row পাওয়া গেছে। Save করার আগে প্রতিটি mapping এবং Preview পরীক্ষা করুন।`;
    setStatus(`ফাইল পড়া হয়েছে: ${sourceRows.length}টি row। Column Mapping যাচাই করুন।`);
  }

  previewBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    if (busy) return;
    try {
      setStatus("Excel ফাইল পড়া হচ্ছে…");
      await parseSelectedFile();
    } catch (error) {
      console.error("Excel preview error:", error);
      setStatus(error.message || "ফাইল পড়া যায়নি।", true);
      alert(error.message || "ফাইল পড়া যায়নি।");
    }
  });

  fileInput.addEventListener("change", () => {
    headers = [];
    sourceRows = [];
    mapping = {};
    validRows = [];
    invalidRows = [];
    previewTable.replaceChildren();
    if ($("smartMappingGrid")) $("smartMappingGrid").replaceChildren();
    if ($("smartImportSummary")) $("smartImportSummary").replaceChildren();
    const confirm = $("smartImportConfirmed");
    if (confirm) confirm.checked = false;
    if (progressBar) progressBar.style.width = "0%";
    setStatus("নতুন ফাইল নির্বাচন করা হয়েছে। Preview চাপুন।");
    updateSaveState();
  });

  if (dateFormatSelect && dateFormatSelect.addEventListener) {
    dateFormatSelect.addEventListener("change", renderPreview);
  }

  uploadBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    if (busy) return;
    const user = auth.currentUser;
    if (!user) {
      alert("Please login first.");
      window.location.href = "login.html";
      return;
    }
    const confirmed = $("smartImportConfirmed")?.checked === true;
    if (!confirmed) return alert("Save করার আগে Preview যাচাই করে confirmation checkbox টিক দিন।");
    if (!validRows.length) return alert("Import করার মতো কোনো valid student row নেই।");

    const result = buildRows();
    validRows = result.rows;
    invalidRows = result.errors;
    if (!validRows.length) {
      renderPreview();
      return alert("কোনো valid row নেই। Error গুলো ঠিক করে আবার Preview দেখুন।");
    }

    const message =
      `আপনি ${validRows.length} জন শিক্ষার্থীর তথ্য এই অ্যাকাউন্টে সেভ করতে যাচ্ছেন। ` +
      `${invalidRows.length}টি row-তে সমস্যা আছে এবং সেগুলো বাদ থাকবে। চালিয়ে যাবেন?`;
    if (!window.confirm(message)) return;

    busy = true;
    uploadBtn.disabled = true;
    if (previewBtn) previewBtn.disabled = true;
    if (fileInput) fileInput.disabled = true;
    if (progressBar) progressBar.style.width = "0%";

    let saved = 0;
    let failed = 0;
    const failures = [];
    const chunkSize = 400;

    try {
      setStatus("Firestore-এ সেভ করা হচ্ছে…");
      for (let start = 0; start < validRows.length; start += chunkSize) {
        const chunk = validRows.slice(start, start + chunkSize);
        const batch = db.batch();
        const refs = chunk.map(() => db.collection("students").doc());

        chunk.forEach((record, i) => {
          const s = record.student;
          const data = {
            ownerId: user.uid,
            academicYear: String(s.academicYear || "").trim(),
            name: String(s.name).trim(),
            father: s.father || "",
            mother: s.mother || "",
            gender: s.gender || "",
            religion: s.religion || "",
            bloodGroup: s.bloodGroup || "",
            email: s.email || "",
            address: s.address || "",
            city: s.city || "",
            pincode: s.pincode || "",
            studentClass: String(s.studentClass || "").trim(),
            section: s.section || "",
            roll: s.roll === undefined ? "" : String(s.roll),
            mobile: s.mobile === undefined ? "" : String(s.mobile),
            aadharNo: s.aadharNo === undefined ? "" : String(s.aadharNo),
            dateOfAdmission: s.dateOfAdmission || "",
            dob: s.dob || "",
            age: s.age === undefined || s.age === "" ? 0 : Number(s.age),
            schoolName: s.schoolName || "",
            admissionFee: s.admissionFee === undefined || s.admissionFee === "" ? 0 : Number(s.admissionFee),
            monthlyFee: s.monthlyFee === undefined || s.monthlyFee === "" ? 0 : Number(s.monthlyFee),
            dueFee: s.dueFee === undefined || s.dueFee === "" ? "0" : String(s.dueFee),
            delivered: "false",
            bookDelivered: false,
            admitCardCreated: "false",
            extra: record.extra,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          batch.set(refs[i], data);
        });

        try {
          await batch.commit();
          saved += chunk.length;
        } catch (batchError) {
          console.error("Firestore batch failed:", batchError);
          failed += chunk.length;
          failures.push(`Rows ${chunk[0].sourceRow}–${chunk[chunk.length - 1].sourceRow}: ${batchError.message || "Firestore batch failed"}`);
        }

        if (progressBar) {
          progressBar.style.width = `${Math.round(((start + chunk.length) / validRows.length) * 100)}%`;
        }
        setStatus(`সেভ হচ্ছে… ${Math.min(start + chunk.length, validRows.length)} / ${validRows.length}`);
      }

      const skipped = invalidRows.length;
      let finalMessage = `Import শেষ। Saved: ${saved}, failed: ${failed}, skipped due to validation: ${skipped}.`;
      if (failures.length) finalMessage += ` Error: ${failures.join(" | ")}`;
      setStatus(finalMessage, failed > 0 || skipped > 0);
      alert(finalMessage);

      if (saved > 0) {
        if (fileInput) fileInput.value = "";
        headers = [];
        sourceRows = [];
        mapping = {};
        validRows = [];
        invalidRows = [];
        previewTable.replaceChildren();
        if ($("smartMappingGrid")) $("smartMappingGrid").replaceChildren();
        if ($("smartImportSummary")) $("smartImportSummary").replaceChildren();
        const confirmBox = $("smartImportConfirmed");
        if (confirmBox) confirmBox.checked = false;
      }
    } catch (error) {
      console.error("Student import failed:", error);
      setStatus(`Import ব্যর্থ হয়েছে: ${error.message || error}`, true);
      alert(`Import ব্যর্থ হয়েছে: ${error.message || error}`);
    } finally {
      busy = false;
      if (previewBtn) previewBtn.disabled = false;
      if (fileInput) fileInput.disabled = false;
      updateSaveState();
    }
  });

  injectStylesAndMappingUI();
  auth.onAuthStateChanged((user) => {
    if (!user) {
      alert("Please login first");
      window.location.href = "login.html";
      return;
    }
    setStatus("Excel ফাইল নির্বাচন করে Preview চাপুন।");
  });
  updateSaveState();
})();