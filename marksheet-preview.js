const firebaseConfig = {
apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
authDomain: "school-management-projec-9db7a.firebaseapp.com",
projectId: "school-management-projec-9db7a",
storageBucket: "school-management-projec-9db7a.firebasestorage.app",
messagingSenderId: "975842483778",
appId: "1:975842483778:web:d1708792ff56014f3317db",
measurementId: "G-1X2Q7LE6G3"
};

if(!firebase.apps.length){
firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(user=>{

 if(!user){

   window.location.href = "login.html";
   return;

 }

});

document
.getElementById("classSelect")
.addEventListener("change",loadStudents);

document
.getElementById("sessionSelect")
.addEventListener("change",loadStudents);

async function loadStudents(){

const className =
document.getElementById("classSelect").value;

const session =
document.getElementById("sessionSelect").value;

if(!className || !session) return;

const table =
document.getElementById("studentTable");

table.innerHTML = "";

const snapshot =
await db.collection("students")
.where("studentClass","==",className)
.where("academicYear","==",session)
.get();

for(const doc of snapshot.docs){

const student = {
id:doc.id,
...doc.data()
};

const semesterSnapshot =
await db
.collection("school_settings")
.doc(auth.currentUser.uid)
.collection("classes")
.doc(className)
.collection("semesters")
.get();

let buttons = "";

semesterSnapshot.forEach(doc=>{

const semester =
doc.data().semester;

buttons += `

<button
class="sem-btn"
onclick="
viewMarksheet(
'${student.id}',
'${semester}'
)
">
See ${semester}
</button>

`;

});

table.innerHTML += `

<tr>

<td>${student.roll || ""}</td>

<td>${student.name || ""}</td>

<td>${buttons}</td>

</tr>

`;

}

}

function viewMarksheet(studentId,semester){

localStorage.setItem(
"previewStudentId",
studentId
);

localStorage.setItem(
"previewSemester",
semester
);

window.location.href =
"print-marksheet.html";

}