// =====================================================
// STUDENT LIST
// Separate JS for student-list.html
// =====================================================

const firebaseConfig = {
    apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
    authDomain: "school-management-projec-9db7a.firebaseapp.com",
    projectId: "school-management-projec-9db7a",
    storageBucket: "school-management-projec-9db7a.firebasestorage.app",
    messagingSenderId: "975842483778",
    appId: "1:975842483778:web:d1708792ff56014f3317db"
};


// -----------------------------------------------------
// Firebase initialization
// -----------------------------------------------------

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();


// -----------------------------------------------------
// Variables
// -----------------------------------------------------

let allStudents = [];
let selectedClass = null;
let selectedSection = 'ALL';

const studentContainer =
    document.getElementById("studentContainer");

const searchInput =
    document.getElementById("searchInput");


// -----------------------------------------------------
// AUTH CHECK
// -----------------------------------------------------

auth.onAuthStateChanged(async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;
    }

    await loadStudents(user);

});


// -----------------------------------------------------
// LOAD ALL STUDENTS
// -----------------------------------------------------

async function loadStudents(user) {

    try {

        studentContainer.innerHTML =
            '<div class="loading">Loading Students...</div>';


        const snapshot = await db
            .collection("students")
            .where("ownerId", "==", user.uid)
            .get();


        allStudents = [];


        snapshot.forEach((doc) => {

            allStudents.push({
                id: doc.id,
                ...doc.data()
            });

        });


        // Sort by student name
        allStudents.sort((a, b) => {

            const nameA =
                String(a.name || "").toLowerCase();

            const nameB =
                String(b.name || "").toLowerCase();

            return nameA.localeCompare(nameB);

        });


        applyFilters(); // Render with initial state


    } catch (error) {

        console.error(
            "Error loading students:",
            error
        );


        studentContainer.innerHTML = `
            <div class="loading">
                Error loading students.<br>
                ${error.message}
            </div>
        `;

    }

}


// -----------------------------------------------------
// RENDER STUDENTS
// -----------------------------------------------------

function renderStudents(students) {

    if (!students.length) {

        studentContainer.innerHTML = `
            <div class="loading">
                No students found matching the current filters.
            </div>
        `;

        return;
    }


    studentContainer.innerHTML = "";


    students.forEach((student) => {

        const row =
            document.createElement("div");

        row.className = "student-row";


        const left =
            document.createElement("div");


        const name =
            student.name || "Unnamed Student";

        const studentClass =
            student.studentClass || "-";

        const section =
            student.section || "-";

        const roll =
            student.roll || "-";

        const fatherName =
            student.fatherName || "";


        left.innerHTML = `
            <div>
                <strong>${escapeHtml(name)}</strong>
            </div>

            <div>
                Class: ${escapeHtml(String(studentClass))} 
                &nbsp;|&nbsp; 
                Section: ${escapeHtml(String(section))}
                &nbsp;|&nbsp; 
                Roll: ${escapeHtml(String(roll))}
            </div>

            ${
                fatherName
                ? `<div>
                    Father:
                    ${escapeHtml(String(fatherName))}
                   </div>`
                : ""
            }
        `;


        // --- Create Button Container ---
        const actionBtns = document.createElement("div");
        actionBtns.className = "action-btns";

        // 1. Add Marksheet Button
        const addBtn = document.createElement("button");
        addBtn.className = "add-btn";
        addBtn.textContent = "Add Marksheet";
        addBtn.onclick = () => {
            localStorage.setItem("selectedStudentId", student.id);
            window.location.href = "add-marksheet.html";
        };

        // 2. Delete Button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => deleteStudent(student.id, student.name);

        // Append buttons to container
        actionBtns.appendChild(addBtn);
        actionBtns.appendChild(deleteBtn);


        // Append to main row
        row.appendChild(left);
        row.appendChild(actionBtns);

        studentContainer.appendChild(row);

    });

}


// -----------------------------------------------------
// DELETE STUDENT FUNCTION
// -----------------------------------------------------

async function deleteStudent(studentId, studentName) {
    const confirmDelete = confirm(`Are you sure you want to DELETE ${studentName || 'this student'}?\n\nThis action cannot be undone.`);
    
    if (!confirmDelete) return;

    try {
        // Delete from Firestore
        await db.collection("students").doc(studentId).delete();

        // Remove from local array
        allStudents = allStudents.filter(s => s.id !== studentId);

        // Re-apply filters to update UI
        applyFilters();

        alert("Student deleted successfully.");

    } catch (error) {
        console.error("Error deleting student:", error);
        alert("Failed to delete student: " + error.message);
    }
}


// -----------------------------------------------------
// CORE FILTERING LOGIC (Combines Class, Section & Search)
// -----------------------------------------------------

function applyFilters() {

    let filtered = allStudents;


    // 1. Apply Class Filter
    if (selectedClass) {

        const normalizedClass =
            String(selectedClass).trim().toLowerCase();

        filtered = filtered.filter((student) => {

            const studentClass =
                String(student.studentClass || "").trim().toLowerCase();

            return studentClass === normalizedClass;

        });

    }


    // 2. Apply Section Filter
    if (selectedSection !== 'ALL') {

        const normalizedSection =
            String(selectedSection).trim().toLowerCase();

        filtered = filtered.filter((student) => {

            const studentSection =
                String(student.section || "").trim().toLowerCase();

            return studentSection === normalizedSection;

        });

    }


    // 3. Apply Search Query
    const search =
        String(searchInput.value || "").trim().toLowerCase();

    if (search) {

        filtered = filtered.filter((student) => {

            const name = String(student.name || "").toLowerCase();
            const father = String(student.fatherName || "").toLowerCase();
            const roll = String(student.roll || "").toLowerCase();
            const mobile = String(student.mobile || "").toLowerCase();

            return (
                name.includes(search) ||
                father.includes(search) ||
                roll.includes(search) ||
                mobile.includes(search)
            );

        });

    }


    renderStudents(filtered);

}


// -----------------------------------------------------
// FILTER BY CLASS
// -----------------------------------------------------

function filterClass(className, btnElement) {

    selectedClass = className;

    // UI: Remove active class from all class buttons
    document.querySelectorAll('.class-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // UI: Add active class to clicked button
    if (btnElement) {
        btnElement.classList.add('active');
    }

    applyFilters();

}

// Make function available to HTML onclick
window.filterClass = filterClass;


// -----------------------------------------------------
// FILTER BY SECTION
// -----------------------------------------------------

function filterSection(sectionName, btnElement) {

    selectedSection = sectionName;

    // UI: Remove active class from all section buttons
    document.querySelectorAll('.section-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // UI: Add active class to clicked button
    if (btnElement) {
        btnElement.classList.add('active');
    }

    applyFilters();

}

// Make function available to HTML onclick
window.filterSection = filterSection;


// -----------------------------------------------------
// SEARCH STUDENT
// -----------------------------------------------------

searchInput.addEventListener(
    "input",
    function () {
        applyFilters();
    }
);


// -----------------------------------------------------
// LOGOUT
// -----------------------------------------------------

function logout() {

    auth.signOut()
        .then(() => {

            window.location.href =
                "login.html";

        })
        .catch((error) => {

            console.error(
                "Logout error:",
                error
            );

        });

}

// Make logout available to HTML onclick
window.logout = logout;


// -----------------------------------------------------
// HTML ESCAPE
// -----------------------------------------------------

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}