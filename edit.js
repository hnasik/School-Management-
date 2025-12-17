// --- Firebase init (same config as other pages) ---
const firebaseConfig = {
  apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
  authDomain: "school-management-projec-9db7a.firebaseapp.com",
  projectId: "school-management-projec-9db7a",
  storageBucket: "school-management-projec-9db7a.firebasestorage.app",
  messagingSenderId: "975842483778",
  appId: "1:975842483778:web:d1708792ff56014f3317db",
  measurementId: "G-1X2Q7LE6G3",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// --- Academic year (same key as other pages) ---
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

// --- Auth state global ---
let currentUser = null;

// --- UI references ---
let classCards;
let studentModal,
  studentModalTitle,
  studentModalSub,
  studentTableBody;
let editModal,
  editModalTitle,
  editFormFields,
  editSaveBtn,
  editCancelBtn,
  editModalCloseBtn;
let logoutBtn;

let currentClass = null;
let currentStudents = []; // array of { id, data }
let editingStudentId = null;
let editingStudentData = null;
let editFieldsRendered = []; // keys rendered as inputs

// --- Helpers ---

function escapeHtml(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Turn "studentClass" -> "Student Class"
function beautifyKey(key) {
  if (!key) return "";
  let label = key.replace(/_/g, " ");
  label = label.replace(/([a-z])([A-Z])/g, "$1 $2");
  label = label.replace(/\s+/g, " ");
  return label
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// system/meta fields we don't want to edit
function isSystemField(key) {
  const systemFields = [
    "ownerId",
    "academicYear",
    "createdAt",
    "updatedAt",
    "_createdAt",
    "_updatedAt",
    "idCardCreated",
    "idCardDelivered",
    "bookDelivered",
    "lastBookName",
    "lastBookEntryId",
  ];
  return systemFields.includes(key);
}

// --- Load students for a specific class (simple & fast) ---
async function loadStudentsForClass(cls) {
  if (
    !studentModal ||
    !studentModalTitle ||
    !studentModalSub ||
    !studentTableBody
  )
    return;

  currentClass = cls;
  currentStudents = [];
  studentTableBody.innerHTML = "";

  studentModalTitle.textContent = `Class ${cls} Students`;
  studentModalSub.textContent = `Loading students for class ${cls}...`;
  studentModal.classList.remove("hidden");

  try {
    const user = currentUser || auth.currentUser;
    if (!user) {
      // Very rare case: auth not ready yet
      studentModalSub.textContent = "Please wait a moment and try again.";
      return;
    }

    const academicYear = getSelectedAcademicYear();

    // Try at most two field names: studentClass, then class
    const attempts = [
      { field: "studentClass", desc: "studentClass" },
      { field: "class", desc: "class" },
    ];

    let foundDocs = [];
    let usedField = "";

    for (const attempt of attempts) {
      const fieldName = attempt.field;
      let query = db
        .collection("students")
        .where("ownerId", "==", user.uid)
        .where("academicYear", "==", academicYear)
        .where(fieldName, "==", String(cls));

      let snap;
      try {
        snap = await query.orderBy("roll").get(); // nicer list
      } catch (err) {
        console.warn(
          `edit.js: orderBy(roll) failed for field ${fieldName}, trying without orderBy.`
        );
        snap = await query.get();
      }

      if (!snap.empty) {
        snap.forEach((doc) => {
          foundDocs.push(doc);
        });
        usedField = fieldName;
        break;
      }
    }

    if (foundDocs.length === 0) {
      studentModalSub.textContent = `No students found for class ${cls} for this owner & academic year.`;
      return;
    }

    let idx = 0;
    currentStudents = [];
    foundDocs.forEach((doc) => {
      idx++;
      const data = doc.data();
      currentStudents.push({ id: doc.id, data });
      appendStudentRow(idx, doc.id, data);
    });

    studentModalSub.textContent = `Found ${currentStudents.length} student(s) for class ${cls} (field used: ${usedField}).`;
  } catch (err) {
    console.error("edit.js: error loading students:", err);
    studentModalSub.textContent = "Error loading students. See console.";
  }
}

// Append one student row with Edit + Delete buttons
function appendStudentRow(index, docId, data) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${index}</td>
    <td>${escapeHtml(data.name || "-")}</td>
    <td>${escapeHtml(data.roll || "")}</td>
    <td>
      <button class="btn-small btn-edit" data-id="${docId}">
        <i class="fas fa-pen"></i> Edit
      </button>
      <button class="btn-small btn-delete" data-id="${docId}" style="margin-left:6px;">
        <i class="fas fa-trash"></i> Delete
      </button>
    </td>
  `;

  tr.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit");
    const deleteBtn = e.target.closest(".btn-delete");

    if (editBtn) {
      const id = editBtn.dataset.id;
      openEditForm(id);
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      handleDeleteStudent(id);
    }
  });

  studentTableBody.appendChild(tr);
}

// --- Delete student doc ---
async function handleDeleteStudent(studentId) {
  if (!studentId) return;

  const stu = currentStudents.find((s) => s.id === studentId);
  const name = stu?.data?.name || "this student";

  if (!confirm(`Are you sure you want to delete ${name}?`)) return;

  try {
    await db.collection("students").doc(studentId).delete();
    alert("Student deleted successfully.");

    // remove from local cache
    currentStudents = currentStudents.filter((s) => s.id !== studentId);

    // reload list for same class
    if (currentClass) {
      studentTableBody.innerHTML = "";
      let idx = 0;
      currentStudents.forEach((stuObj) => {
        idx++;
        appendStudentRow(idx, stuObj.id, stuObj.data);
      });
      studentModalSub.textContent = `Found ${currentStudents.length} student(s) for class ${currentClass}.`;
    }
  } catch (err) {
    console.error("edit.js: failed to delete student:", err);
    alert("Failed to delete student (see console).");
  }
}

// --- Open edit modal for a specific student ---
function openEditForm(studentId) {
  if (!editModal || !editFormFields || !editModalTitle) return;

  const stu = currentStudents.find((s) => s.id === studentId);
  if (!stu) {
    alert("Student not found in current list.");
    return;
  }

  editingStudentId = studentId;
  editingStudentData = stu.data;
  editFieldsRendered = [];
  editFormFields.innerHTML = "";

  const entries = Object.entries(editingStudentData || {});
  for (const [key, value] of entries) {
    if (isSystemField(key)) continue;

    editFieldsRendered.push(key);
    const group = document.createElement("div");
    group.className = "form-group";
    group.innerHTML = `
      <label>${escapeHtml(beautifyKey(key))}</label>
      <input type="text" data-field="${escapeHtml(
        key
      )}" value="${escapeHtml(value ?? "")}" />
    `;
    editFormFields.appendChild(group);
  }

  if (editFieldsRendered.length === 0) {
    editFormFields.innerHTML =
      "<p style='font-size:0.9rem; color:#64748b;'>No editable fields found for this student.</p>";
  }

  const titleName =
    editingStudentData.name || editingStudentData.studentName || "";
  editModalTitle.textContent = titleName
    ? `Edit: ${titleName}`
    : "Edit Student";

  editModal.classList.remove("hidden");
}

// --- Save changes back to Firestore ---
async function saveEditChanges() {
  if (!editingStudentId || !editFormFields) {
    closeEditModal();
    return;
  }

  const updateData = {};

  for (const fieldKey of editFieldsRendered) {
    const input = editFormFields.querySelector(
      `input[data-field="${CSS.escape(fieldKey)}"]`
    );
    if (!input) continue;
    updateData[fieldKey] = input.value;
  }

  if (Object.keys(updateData).length === 0) {
    alert("No editable fields to update.");
    return;
  }

  try {
    await db.collection("students").doc(editingStudentId).update(updateData);
    alert("Student updated successfully.");

    // update local cache
    const idx = currentStudents.findIndex((s) => s.id === editingStudentId);
    if (idx !== -1) {
      currentStudents[idx].data = {
        ...currentStudents[idx].data,
        ...updateData,
      };
    }

    closeEditModal();

    // refresh list for the same class
    if (currentClass) {
      studentTableBody.innerHTML = "";
      let i = 0;
      currentStudents.forEach((stuObj) => {
        i++;
        appendStudentRow(i, stuObj.id, stuObj.data);
      });
      studentModalSub.textContent = `Found ${currentStudents.length} student(s) for class ${currentClass}.`;
    }
  } catch (err) {
    console.error("edit.js: failed to update student:", err);
    alert("Failed to update student (see console).");
  }
}

// --- Close modals ---
function closeStudentModal() {
  if (!studentModal || !studentTableBody) return;
  studentModal.classList.add("hidden");
  studentTableBody.innerHTML = "";
  currentClass = null;
  currentStudents = [];
}

function closeEditModal() {
  if (!editModal || !editFormFields) return;
  editModal.classList.add("hidden");
  editFormFields.innerHTML = "";
  editingStudentId = null;
  editingStudentData = null;
  editFieldsRendered = [];
}

// --- DOMContentLoaded setup ---
document.addEventListener("DOMContentLoaded", () => {
  // query DOM
  classCards = document.querySelectorAll(".class-card");

  studentModal = document.getElementById("student-modal");
  studentModalTitle = document.getElementById("student-modal-title");
  studentModalSub = document.getElementById("student-modal-sub");
  studentTableBody = document.getElementById("student-table-body");
  const studentModalCloseBtn = document.getElementById("student-modal-close");

  editModal = document.getElementById("edit-modal");
  editModalTitle = document.getElementById("edit-modal-title");
  editFormFields = document.getElementById("edit-form-fields");
  editSaveBtn = document.getElementById("edit-save-btn");
  editCancelBtn = document.getElementById("edit-cancel-btn");
  editModalCloseBtn = document.getElementById("edit-modal-close");

  logoutBtn = document.getElementById("logout-btn");

  // Auth check – single redirect place
  auth.onAuthStateChanged((user) => {
    currentUser = user || null;

    if (!user) {
      console.log("edit.js: not signed in, redirecting to login.");
      window.location.href = "login.html";
    } else {
      console.log("edit.js: signed in as", user.email || user.uid);
    }
  });

  // Click class card -> load students
  if (classCards && classCards.length) {
    classCards.forEach((card) => {
      card.addEventListener("click", () => {
        const cls = card.dataset.class;
        if (!cls) return;
        loadStudentsForClass(String(cls));
      });
    });
  }

  // Student modal close
  if (studentModalCloseBtn) {
    studentModalCloseBtn.addEventListener("click", closeStudentModal);
  }

  // Edit modal close / cancel
  if (editModalCloseBtn) {
    editModalCloseBtn.addEventListener("click", closeEditModal);
  }
  if (editCancelBtn) {
    editCancelBtn.addEventListener("click", closeEditModal);
  }

  if (editSaveBtn) {
    editSaveBtn.addEventListener("click", saveEditChanges);
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth
        .signOut()
        .then(() => {
          window.location.href = "login.html";
        })
        .catch((err) => {
          console.error("Logout failed:", err);
          alert("Failed to logout (see console).");
        });
    });
  }

  // Optional: close modals when clicking on overlay
  if (studentModal) {
    studentModal.addEventListener("click", (e) => {
      if (e.target === studentModal) closeStudentModal();
    });
  }
  if (editModal) {
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) closeEditModal();
    });
  }
});
