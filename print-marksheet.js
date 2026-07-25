const firebaseConfig = {
apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
authDomain: "school-management-projec-9db7a.firebaseapp.com",
projectId: "school-management-projec-9db7a",
storageBucket: "school-management-projec-9db7a.firebasestorage.app",
messagingSenderId: "975842483778",
appId: "1:975842483778:web:d1708792ff56014f3317db"
};

if(!firebase.apps.length){
firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(async(user)=>{

if(!user){

window.location.href =
"login.html";

return;

}

await loadMarksheet(user);

});

async function loadMarksheet(user){

try{

const studentId =
localStorage.getItem(
"previewStudentId"
);

const semester =
localStorage.getItem(
"previewSemester"
);

if(!studentId || !semester){

alert(
"No Student Selected"
);

return;

}

// ====================
// SCHOOL SETTINGS
// ====================

const schoolDoc =
await db
.collection("school_settings")
.doc(user.uid)
.get();

if(schoolDoc.exists){

const school =
schoolDoc.data();

document.getElementById(
"schoolName"
).innerText =
school.schoolName || "";

document.getElementById(
"schoolAddress"
).innerText =
school.schoolAddress || "";

if(school.logo){

document.getElementById(
"schoolLogo"
).src =
school.logo;

}

if(
school.principalSignature
){

document.getElementById(
"principalSignature"
).src =
school.principalSignature;

}
}


// ====================
// STUDENT
// ====================

const studentDoc =
await db
.collection("students")
.doc(studentId)
.get();

if(!studentDoc.exists){

alert(
"Student Not Found"
);

return;

}

const student =
studentDoc.data();

document.getElementById(
"studentName"
).innerText =
student.name || "";

document.getElementById(
"studentRoll"
).innerText =
student.roll || "";

document.getElementById(
"studentClass"
).innerText =
student.studentClass || "";

document.getElementById(
"studentSession"
).innerText =
student.academicYear || "";

document.getElementById(
"studentSemester"
).innerText =
semester;

// ====================
// MARKSHEET
// ====================

const marksheetSnapshot =
await db
.collection("marksheet_history")
.where(
"studentId",
"==",
studentId
)
.where(
"semester",
"==",
semester
)
.limit(1)
.get();

if(marksheetSnapshot.empty){

alert(
"No Marksheet Found"
);

return;

}

const marksheet =
marksheetSnapshot.docs[0].data();

// ===================================
// LOAD TOTAL MARKS FROM SCHOOL SETTINGS
// ===================================

const semesterDocs =
await db
.collection("school_settings")
.doc(user.uid)
.collection("classes")
.doc(student.studentClass)
.collection("semesters")
.where("semester","==",semester)
.limit(1)
.get();

let settingsSubjects = [];

if(!semesterDocs.empty){

settingsSubjects =
semesterDocs.docs[0].data().subjects || [];

}
const summarySnapshot =
await db
.collection("marksheet_history")
.where("studentId","==",studentId)
.get();
const summaryBody =
document.querySelector(
"#semesterSummaryTable tbody"
);

summaryBody.innerHTML = "";

const semesterOrder = [
"1st semister",
"2nd semister",
"3rd semister",
"final semister",
"1st semester",
"2nd semester",
"3rd semester",
"final semester"
];

const summaryData = [];

summarySnapshot.forEach(doc=>{
summaryData.push(doc.data());
});

summaryData.sort((a,b)=>{

const aIndex =
semesterOrder.indexOf(a.semester);

const bIndex =
semesterOrder.indexOf(b.semester);

return aIndex - bIndex;

});

summaryData.forEach(data=>{

summaryBody.innerHTML += `
<tr>
<td>${data.semester || ""}</td>
<td>${data.semesterTotalMarks || 0}</td>
<td>${data.total || 0}</td>
<td>${data.percentage || 0}%</td>
<td>${data.grade || "-"}</td>
</tr>
`;

});
const tbody =
document.getElementById("subjectTable");

tbody.innerHTML = "";

let totalWritten = 0;
let totalOral = 0;
let totalMaxMarks = 0;

let obtainedWritten = 0;
let obtainedOral = 0;
let obtainedGrandTotal = 0;

settingsSubjects.forEach(settingSubject=>{

const obtained =
(marksheet.subjects || [])
.find(s =>
s.name.toLowerCase() ===
settingSubject.name.toLowerCase()
);

const maxWritten =
Number(settingSubject.written || 0);

const maxOral =
Number(settingSubject.oral || 0);

const maxTotal =
maxWritten + maxOral;

const obWritten =
Number(obtained?.written || 0);

const obOral =
Number(obtained?.oral || 0);

const obTotal =
obWritten + obOral;

totalWritten += maxWritten;
totalOral += maxOral;
totalMaxMarks += maxTotal;

obtainedWritten += obWritten;
obtainedOral += obOral;
obtainedGrandTotal += obTotal;

tbody.innerHTML += `

<tr>

<td>${settingSubject.name}</td>

<td>${maxWritten}</td>
<td>${maxOral}</td>
<td>${maxTotal}</td>

<td>${obWritten}</td>
<td>${obOral}</td>
<td>${obTotal}</td>

</tr>

`;

});

// TOTAL ROW
console.log("obtainedGrandTotal=", obtainedGrandTotal);
console.log("totalMaxMarks=", totalMaxMarks);

document.getElementById("totalMarks").innerText =
obtainedGrandTotal;

const percentage =
totalMaxMarks > 0
? ((obtainedGrandTotal / totalMaxMarks) * 100).toFixed(2)
: 0;

document.getElementById("percentage").innerText =
percentage;

document.getElementById("grade").innerText =
marksheet.grade || "-";

tbody.innerHTML += `

<tr style="font-weight:bold;background:#f2f2f2">

<td>TOTAL</td>

<td>${totalWritten}</td>
<td>${totalOral}</td>
<td>${totalMaxMarks}</td>

<td>${obtainedWritten}</td>
<td>${obtainedOral}</td>
<td>${obtainedGrandTotal}</td>

</tr>

`;


}catch(error){

console.error(error);

alert(error.message);

}

}