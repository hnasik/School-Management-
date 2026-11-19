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

  const className = document.getElementById("classSelect").value;
  const session = document.getElementById("sessionSelect").value;

  if(!className || !session) return;

  const table = document.getElementById("studentTable");
  table.innerHTML = "";

  // ?. ??????? ???????? ?? ??? (Nursery, LKG, UKG ?? ????)
  const classNameOptions = {
      "Nursery": ["Nursery", "NURSERY", "nursery", "NUR", "Nur"],
      "LKG": ["LKG", "KG 1", "KG1", "kg1"],
      "UKG": ["UKG", "KG 2", "KG2", "kg2"]
  };

  const possibleClassNames = classNameOptions[className] || [className];

  // ?. ?????? ?? ????????? ?????? ????? ??? ??? (???? ?????? ??????? ?? ?? ????)
  let allSemesters = [];
  for (const firestoreClassName of possibleClassNames) {
      const tempSnapshot = await db
        .collection("school_settings")
        .doc(auth.currentUser.uid)
        .collection("classes")
        .doc(firestoreClassName)
        .collection("semesters")
        .get();

      // ?????? ????????? ???? ??????? ???????? ????
      tempSnapshot.forEach(doc => {
          const data = doc.data();
          // ???? ??? ??? ?????? ????
          if (!allSemesters.find(s => s.semester === data.semester || s.docId === doc.id)) {
              allSemesters.push({
                  semester: data.semester,
                  docId: doc.id
              });
          }
      });
  }

  // ?. ???? ????????????? ?????
  const snapshots = await Promise.all(
      possibleClassNames.map(cls =>
          db.collection("students")
          .where("studentClass", "==", cls)
          .where("academicYear", "==", session)
          .where("ownerId", "==", auth.currentUser.uid)
          .get()
      )
  );

  const allDocs = snapshots.flatMap(snapshot => snapshot.docs);

  // ?. ?????? ??????
  for(const doc of allDocs){

    const student = {
      id: doc.id,
      ...doc.data()
    };

    let buttons = "";

    // ??? ???? ?????????? ??????? ??? ?? ????
    if (allSemesters.length === 0) {
        buttons = "<span style='color:red'>No semesters found</span>";
    } else {
        // ?????? ??????????? ???? ???? ???
        allSemesters.forEach(sem => {
          buttons += `
            <button
            class="sem-btn"
            onclick="viewMarksheet('${student.id}', '${sem.semester}')">
            See ${sem.semester}
            </button>
          `;
        });
    }

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

window.open(
    "print-marksheet.html",
    "_blank"
);

}