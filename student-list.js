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


        renderStudents(allStudents);


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
                No students found.
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

        const roll =
            student.roll || "-";

        const fatherName =
            student.fatherName || "";


        left.innerHTML = `
            <div>
                <strong>${escapeHtml(name)}</strong>
            </div>

            <div>
                Class:
                ${escapeHtml(String(studentClass))}
                &nbsp; | &nbsp;
                Roll:
                ${escapeHtml(String(roll))}
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


        const button =
            document.createElement("button");

        button.className = "add-btn";

        button.textContent =
            "Add Marksheet";


        button.onclick = () => {

            localStorage.setItem(
                "selectedStudentId",
                student.id
            );


            window.location.href =
                "add-marksheet.html";

        };


        row.appendChild(left);

        row.appendChild(button);

        studentContainer.appendChild(row);

    });

}


// -----------------------------------------------------
// FILTER BY CLASS
// -----------------------------------------------------

function filterClass(className) {

    selectedClass = className;


    const normalizedClass =
        String(className)
            .trim()
            .toLowerCase();


    const filtered =
        allStudents.filter((student) => {

            const studentClass =
                String(student.studentClass || "")
                    .trim()
                    .toLowerCase();


            return studentClass === normalizedClass;

        });


    renderStudents(filtered);

}


// Make function available to HTML onclick
window.filterClass = filterClass;


// -----------------------------------------------------
// SEARCH STUDENT
// -----------------------------------------------------

searchInput.addEventListener(
    "input",
    function () {

        const search =
            String(this.value || "")
                .trim()
                .toLowerCase();


        let filtered =
            allStudents;


        // First apply class filter
        if (selectedClass) {

            const normalizedClass =
                String(selectedClass)
                    .trim()
                    .toLowerCase();


            filtered =
                filtered.filter((student) => {

                    const studentClass =
                        String(student.studentClass || "")
                            .trim()
                            .toLowerCase();


                    return studentClass ===
                        normalizedClass;

                });

        }


        // Then search
        if (search) {

            filtered =
                filtered.filter((student) => {

                    const name =
                        String(student.name || "")
                            .toLowerCase();

                    const father =
                        String(student.fatherName || "")
                            .toLowerCase();

                    const roll =
                        String(student.roll || "")
                            .toLowerCase();

                    const mobile =
                        String(student.mobile || "")
                            .toLowerCase();


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