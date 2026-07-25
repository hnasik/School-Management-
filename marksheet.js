const firebaseConfig = {
  apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
  authDomain: "school-management-projec-9db7a.firebaseapp.com",
  projectId: "school-management-projec-9db7a",
  storageBucket: "school-management-projec-9db7a.firebasestorage.app",
  messagingSenderId: "975842483778",
  appId: "1:975842483778:web:d1708792ff56014f3317db",
  measurementId: "G-1X2Q7LE6G3"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let logoBase64 = "";
let principalBase64 = "";

const subjectsContainer =
document.getElementById("subjectsContainer");

// ====================
// LOGO UPLOAD
// ====================

document
.getElementById("logoInput")
.addEventListener("change",(e)=>{

const file = e.target.files[0];

if(!file) return;

const reader = new FileReader();

reader.onload = function(event){

logoBase64 = event.target.result;

document.getElementById(
"logoPreview"
).src = logoBase64;

};

reader.readAsDataURL(file);

});

// ====================
// PRINCIPAL SIGNATURE
// ====================

document
.getElementById("principalInput")
.addEventListener("change",(e)=>{

const file = e.target.files[0];

if(!file) return;

const reader = new FileReader();

reader.onload = function(event){

principalBase64 =
event.target.result;

document.getElementById(
"principalPreview"
).src =
principalBase64;

};

reader.readAsDataURL(file);

});

// ====================
// ADD SUBJECT
// ====================

function addSubject(
name="",
written="40",
oral="10"
){

const div =
document.createElement("div");

div.className =
"subject-row";

div.innerHTML = `

<input
class="subject-name"
placeholder="Subject Name"
value="${name}"
>

<input
class="written"
type="number"
placeholder="Written"
value="${written}"
>

<input
class="oral"
type="number"
placeholder="Oral"
value="${oral}"
>

<button
class="remove-btn"
onclick="this.parentElement.remove()">
X
</button>

`;

subjectsContainer.appendChild(div);

}

window.addSubject = addSubject;

// ====================
// AUTH CHECK
// ====================

auth.onAuthStateChanged(async(user)=>{

if(!user){

window.location.href =
"login.html";

return;

}

await loadSchoolData();

document
.getElementById("resultClass")
.addEventListener(
"change",
loadClassData
);

document
.getElementById("semester")
.addEventListener(
"blur",
loadClassData
);

});
// ====================
// LOAD SCHOOL DATA
// ====================

async function loadSchoolData(){

try{

const user =
auth.currentUser;

if(!user) return;

const schoolDoc =
await db
.collection("school_settings")
.doc(user.uid)
.get();

if(!schoolDoc.exists)
return;

const data =
schoolDoc.data();

document.getElementById(
"schoolName"
).value =
data.schoolName || "";

document.getElementById(
"schoolAddress"
).value =
data.schoolAddress || "";

logoBase64 =
data.logo || "";

principalBase64 =
data.principalSignature || "";

if(logoBase64){

document.getElementById(
"logoPreview"
).src =
logoBase64;

}

if(principalBase64){

document.getElementById(
"principalPreview"
).src =
principalBase64;

}

}catch(error){

console.error(error);

}

}

// ====================
// LOAD CLASS + SEMESTER DATA
// ====================

async function loadClassData(){

try{

const user =
auth.currentUser;

if(!user) return;

const selectedClass =
document.getElementById(
"resultClass"
).value;

const semesterName =
document.getElementById(
"semester"
).value
.trim();

subjectsContainer.innerHTML = "";

if(!semesterName){

addSubject(
"Bengali",
40,
10
);

addSubject(
"English",
40,
10
);

addSubject(
"Mathematics",
40,
10
);

return;

}

const semesterDoc =
await db
.collection("school_settings")
.doc(user.uid)
.collection("classes")
.doc(selectedClass)
.collection("semesters")
.doc(semesterName)
.get();

if(semesterDoc.exists){

const data =
semesterDoc.data();

(data.subjects || [])
.forEach(subject=>{

addSubject(
subject.name,
subject.written,
subject.oral
);

});

}else{

addSubject(
"Bengali",
40,
10
);

addSubject(
"English",
40,
10
);

addSubject(
"Mathematics",
40,
10
);

}

}catch(error){

console.error(error);

}

}
// ====================
// SAVE SETTINGS
// ====================

async function saveSettings(){

const user =
auth.currentUser;

if(!user){

alert(
"Please Login First"
);

return;

}

const selectedClass =
document.getElementById(
"resultClass"
).value;

const semesterName =
document.getElementById(
"semester"
).value
.trim();

if(!semesterName){

alert(
"Please Enter Semester Name"
);

return;

}

const subjects = [];

document
.querySelectorAll(".subject-row")
.forEach(row=>{

subjects.push({

name:
row.querySelector(
".subject-name"
).value,

written:Number(
row.querySelector(
".written"
).value
),

oral:Number(
row.querySelector(
".oral"
).value
)

});

});

try{

// Save School Info

await db
.collection("school_settings")
.doc(user.uid)
.set({

ownerId:user.uid,

schoolName:
document.getElementById(
"schoolName"
).value,

schoolAddress:
document.getElementById(
"schoolAddress"
).value,

logo:
logoBase64,

principalSignature:
principalBase64,

updatedAt:
firebase.firestore
.FieldValue
.serverTimestamp()

},{merge:true});

// Save Class Info

await db
.collection("school_settings")
.doc(user.uid)
.collection("classes")
.doc(selectedClass)
.set({

className:
selectedClass,

updatedAt:
firebase.firestore
.FieldValue
.serverTimestamp()

},{merge:true});

// Save Semester Info

await db
.collection("school_settings")
.doc(user.uid)
.collection("classes")
.doc(selectedClass)
.collection("semesters")
.add({

className:
selectedClass,

semester:
semesterName,

subjects:
subjects,

updatedAt:
firebase.firestore
.FieldValue
.serverTimestamp()

});

alert(
selectedClass +
" - " +
semesterName +
" Saved Successfully"
);

}catch(error){

console.error(error);

alert(
error.message
);

}

}

window.saveSettings =
saveSettings;