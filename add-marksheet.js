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

const studentId =
localStorage.getItem("selectedStudentId");

let currentStudent = null;
let classSettings = null;

auth.onAuthStateChanged(async(user)=>{

if(!user){

window.location.href =
"login.html";

return;
}

await loadStudent(user);

});
async function loadStudent(user){

try{

const studentDoc =
await db.collection("students")
.get()
.then(snapshot=>{

let found = null;

snapshot.forEach(doc=>{

if(doc.id === studentId){

found = {
id:doc.id,
...doc.data()
};

}

});

return found;

});

if(!studentDoc){

alert("Student Not Found");
return;
}

currentStudent = studentDoc;

document.getElementById(
"studentInfo"
).innerHTML = `

<div><b>Name:</b> ${studentDoc.name}</div>

<div><b>Roll:</b> ${studentDoc.roll}</div>

<div><b>Class:</b> ${studentDoc.studentClass}</div>

<div><b>Session:</b> ${studentDoc.academicYear}</div>

`;

await loadClassSubjects(
   user.uid,
   studentDoc.studentClass
);

}catch(error){

 console.error(error);

}

}
 async function loadClassSubjects(uid, className){

 try{

   await loadSemesters(uid, className);

 }catch(error){

   console.error(error);

 }

}
async function loadSemesters(uid, className){

 const select =
 document.getElementById("semesterInput");

 select.innerHTML =
 '<option value="">Select Semester</option>';

 const snapshot =
 await db
 .collection("school_settings")
 .doc(uid)
 .collection("classes")
 .doc(className)
 .collection("semesters")
 .get();

 snapshot.forEach(doc=>{

   const data = doc.data();

  select.innerHTML += `
<option
value="${data.semester}"
data-docid="${doc.id}">
${data.semester}
</option>
`;
 });

}
document
.getElementById("semesterInput")
.addEventListener(
"change",
async ()=>{
await loadSemesterSubjects();
}
);

async function loadSemesterSubjects(){

 const select =
document.getElementById("semesterInput");

const semesterDocId =
select.options[select.selectedIndex]
.dataset.docid;

 if(!semesterDocId) return;

 const doc =
 await db
 .collection("school_settings")
 .doc(auth.currentUser.uid)
 .collection("classes")
 .doc(currentStudent.studentClass)
 .collection("semesters")
 .doc(semesterDocId)
 .get();

 if(!doc.exists) return;

const data = doc.data();

classSettings = data;

renderSubjects(
   data.subjects || []
);

await loadPreviousMarks();



}





function renderSubjects(subjects){

const container =
document.getElementById(
"subjectsContainer"
);

container.innerHTML = "";

subjects.forEach(subject=>{

container.innerHTML += `

<div class="subject-row">

<div>

<b>${subject.name}</b><br>

Written Max:
${subject.written}<br>

Oral Max:
${subject.oral}

</div>

<input
type="number"
class="written-obtain"
data-written="${subject.written}"
placeholder="Written">

<input
type="number"
class="oral-obtain"
data-oral="${subject.oral}"
placeholder="Oral">

</div>

`;

});

document
.querySelectorAll("input")
.forEach(input=>{

input.addEventListener(
"input",
calculateResult
);

});

}

function calculateResult(){

let totalObtained = 0;
let totalMaximum = 0;

const writtenInputs =
document.querySelectorAll(".written-obtain");

const oralInputs =
document.querySelectorAll(".oral-obtain");

writtenInputs.forEach((input,index)=>{

const writtenObtained =
Number(input.value) || 0;

const oralObtained =
Number(oralInputs[index].value) || 0;

const writtenMax =
Number(input.dataset.written) || 0;

const oralMax =
Number(oralInputs[index].dataset.oral) || 0;

totalObtained +=
writtenObtained + oralObtained;

totalMaximum +=
writtenMax + oralMax;

});

const percentage =
totalMaximum > 0
? ((totalObtained / totalMaximum) * 100).toFixed(2)
: 0;

let grade = "F";

if(percentage >= 90) grade = "AA";
else if(percentage >= 80) grade = "A+";
else if(percentage >= 70) grade = "A";
else if(percentage >= 60) grade = "A";
else if(percentage >= 45) grade = "B+";
else if(percentage >= 35) grade = "B";
else if(percentage >= 25) grade = "C";
else if(percentage >= 1) grade = "D";

document.getElementById("totalMarks").innerText =
totalObtained;

document.getElementById("percentage").innerText =
percentage;

document.getElementById("grade").innerText =
grade;

}
async function loadSavedMarksheet(){

const semesterName =
document.getElementById("semesterInput").value;

const snapshot = await db
.collection("marksheet_history")
.where("studentId","==",currentStudent.id)
.where("semester","==",semesterName)
.limit(1)
.get();

if(snapshot.empty){
return null;
}

return snapshot.docs[0].data();

}

async function loadPreviousMarks(){

const data = await loadSavedMarksheet();

if(!data) return;

const rows =
document.querySelectorAll(".subject-row");

data.subjects.forEach((subject,index)=>{

if(rows[index]){

rows[index]
.querySelector(".written-obtain").value =
subject.written || "";

rows[index]
.querySelector(".oral-obtain").value =
subject.oral || "";

}

});

calculateResult();

}


async function saveMarksheet(){

const semesterName =
document.getElementById("semesterInput").value;

const existingSnapshot = await db
.collection("marksheet_history")
.where("studentId","==",currentStudent.id)
.where("academicYear","==",currentStudent.academicYear)
.where("semester","==",semesterName)
.get();

let existingSubjects = [];

if(!existingSnapshot.empty){

existingSubjects =
existingSnapshot.docs[0]
.data()
.subjects || [];

}

const subjects = [];

const rows =
document.querySelectorAll(".subject-row");

rows.forEach((row,index)=>{

subjects.push({

name:
classSettings.subjects[index].name,

written:
Number(
row.querySelector(
".written-obtain"
).value || 0
),

oral:
Number(
row.querySelector(
".oral-obtain"
).value || 0
)

});

});
const marksheetData = {

ownerId: auth.currentUser.uid,

studentId: currentStudent.id,

studentName: currentStudent.name,

roll: currentStudent.roll,

studentClass: currentStudent.studentClass,

academicYear: currentStudent.academicYear,

semester: semesterName,

subjects: subjects,

total: Number(
document.getElementById("totalMarks").innerText
),
semesterTotalMarks: classSettings.subjects.reduce(
(sum,subject)=>
sum +
Number(subject.written || 0) +
Number(subject.oral || 0),
0
),

percentage: Number(
document.getElementById("percentage").innerText
),

grade: document.getElementById("grade").innerText,

updatedAt:
firebase.firestore.FieldValue.serverTimestamp()

};
if(!existingSnapshot.empty){

   const docId =
   existingSnapshot.docs[0].id;

   await db
   .collection("marksheet_history")
   .doc(docId)
   .update(marksheetData);

   alert("Marksheet Updated Successfully");

}else{

   marksheetData.createdAt =
   firebase.firestore.FieldValue.serverTimestamp();

   await db
   .collection("marksheet_history")
   .add(marksheetData);

   alert("Marksheet Saved Successfully");

}

alert(
"Marksheet Saved Successfully"
);

}