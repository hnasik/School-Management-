let questionList = [];
let editingQuestionIndex = -1;
let editingImageIndex = -1;

// ==========================
// FIREBASE
// ==========================

const questionPaperRef = db.collection("question_papers");

let currentUser = null;

auth.onAuthStateChanged((user)=>{

if(!user){

window.location.href = "login.html";

return;

}

currentUser = user;

});

// ==========================
// Arabic Mode
// ==========================

document
.getElementById("languageInput")
.addEventListener("change", function(){

const questionBox =
document.getElementById("questionInput");

if(this.value === "Arabic"){

questionBox.classList.add(
"arabic-input"
);

}else{

questionBox.classList.remove(
"arabic-input"
);

}

});

// ==========================
// Add Question
// ==========================

function addQuestion(){

const language =
document.getElementById(
"languageInput"
).value;

const question =
document.getElementById(
"questionInput"
).value.trim();
const questionFontSize =
parseInt(
document.getElementById(
"questionFontSizeInput"
).value
) || 18;

const marks =
document.getElementById(
"marksInput"
).value;

if(question === ""){

alert(
"Please enter a question"
);

return;

}

const questionData = {

type:"question",

language:language,

question:question,

marks:marks || 0,

fontSize:questionFontSize

};

if(editingQuestionIndex === -1){

questionList.push(questionData);

}else{

questionList[editingQuestionIndex] = questionData;

editingQuestionIndex = -1;

}

renderQuestions();

document.getElementById(
"questionInput"
).value = "";

document.getElementById(
"questionFontSizeInput"
).value = "18";

}

// ==========================
// Render Questions
// ==========================

function renderQuestions(){

const container =
document.getElementById(
"questionList"
);

container.innerHTML = "";

questionList.forEach((item,index)=>{

let html = "";
if(item.type === "heading"){

html = `

<div
class="question-item"
style="
text-align:center;
font-size:${item.fontSize}px;
font-weight:bold;
background:#fff3cd;
border-left:5px solid #ff9800;
">

${item.text}

<br><br>

<button
style="
background:#ff9800;
color:white;
margin-top:10px;
margin-right:5px;
"
onclick="editQuestion(${index})">

Edit

</button>

<button
style="
background:red;
color:white;
margin-top:10px;
"
onclick="deleteQuestion(${index})">

Delete

</button>

</div>

`;

}

if(item.type === "question"){

html = `

<div class="question-item">

<div
style="
font-size:${item.fontSize || 18}px;
line-height:1.6;
">

${item.question}

</div>
<div class="question-meta">

Language :
${item.language}

<br>

Marks :
${item.marks}

</div>

<button
style="
background:#ff9800;
color:white;
margin-top:8px;
margin-right:5px;
"
onclick="editQuestion(${index})">

Edit

</button>

<button
style="
background:red;
color:white;
margin-top:8px;
"
onclick="deleteQuestion(${index})">

Delete

</button>

</div>

`;

}

if(item.type === "table"){

html = `

<div class="question-item">

<b>Table Question</b>

<br><br>

${item.html}

<br>

<button
style="
background:#ff9800;
color:white;
margin-top:8px;
margin-right:5px;
"
onclick="editQuestion(${index})">

Edit

</button>

<button
style="
background:red;
color:white;
margin-top:8px;
"
onclick="deleteQuestion(${index})">

Delete

</button>

</div>

`;

}
if(item.type==="images"){

    let imageHTML="";

    imageHTML+=`
    <div class="question-item">

        <div style="
            display:grid;
            grid-template-columns:repeat(${item.perRow},1fr);
            gap:10px;
            justify-items:${item.align};
            margin-bottom:10px;
        ">
    `;

    item.images.forEach(src=>{

        imageHTML+=`
            <img
                src="${src}"
                style="
                    width:${item.width}px;
                    height:${item.height}px;
                    object-fit:contain;
                    border:1px solid #ccc;
                    border-radius:6px;
                ">
        `;

    });

    imageHTML+=`
        </div>
    `;

    if(item.caption){

        imageHTML+=`

            <div style="
                text-align:center;
                font-weight:bold;
                margin-top:8px;
            ">

                ${item.caption}

            </div>

        `;

    }

    imageHTML+=`

        <br>

        <button
            style="
                background:#ff9800;
                color:white;
                margin-right:5px;
            "
            onclick="editImage(${index})">

            Edit

        </button>

        <button
            style="
                background:red;
                color:white;
            "
            onclick="deleteQuestion(${index})">

            Delete

        </button>

    </div>

    `;

    html=imageHTML;

}

container.innerHTML += html;

});

}

// ==========================
// Delete
// ==========================

function deleteQuestion(index){

questionList.splice(index,1);

renderQuestions();


}
function editQuestion(index){

const item = questionList[index];

if(item.type==="question"){

editingQuestionIndex = index;

document.getElementById("languageInput").value =
item.language;

document.getElementById("questionInput").value =
item.question;
document.getElementById(
"questionFontSizeInput"
).value =
item.fontSize || 18;

document.getElementById("marksInput").value =
item.marks;

}

}
function editImage(index){

    const item=questionList[index];

    editingImageIndex=index;

    document.getElementById("imagesPerRow").value=item.perRow;

    document.getElementById("imageWidthInput").value=item.width;

    document.getElementById("imageHeightInput").value=item.height;

    document.getElementById("imageAlignInput").value=item.align;

    document.getElementById("imageLayoutInput").value=item.layout;

    document.getElementById("imageCaptionInput").value=item.caption;

    openImagePopup();

}
// ==========================
// Popup
// ==========================
// ==========================
// HEADING POPUP
// ==========================

function openHeadingPopup(){

document.getElementById(
"headingPopup"
).style.display = "block";

}

function closeHeadingPopup(){

document.getElementById(
"headingPopup"
).style.display = "none";

}
function openImagePopup() {
    document.getElementById("imagePopup").style.display = "flex";
}

function closeImagePopup() {
    document.getElementById("imagePopup").style.display = "none";

    document.getElementById("imageInput").value = "";
    document.getElementById("imageCaptionInput").value = "";
    document.getElementById("imagePreview").innerHTML="";

    document.getElementById("imagesPerRow").value = "1";
    document.getElementById("imageWidthInput").value = "120";
    document.getElementById("imageHeightInput").value = "120";
    document.getElementById("imageAlignInput").value = "center";
    document.getElementById("imageLayoutInput").value = "vertical";

    editingImageIndex = -1;
}
function fileToBase64(file) {
    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);

        reader.onerror = reject;

        reader.readAsDataURL(file);

    });
}
async function saveImages() {

    const files = document.getElementById("imageInput").files;

   if (!files.length && editingImageIndex == -1) {
    alert("Please select at least one image.");
    return;
}
    const images = [];

if(files.length){

    for(const file of files){

        images.push(await fileToBase64(file));

    }

}else if(editingImageIndex>=0){

    images.push(...questionList[editingImageIndex].images);

}
    const imageItem = {

        type: "images",

        images: images,

        perRow: parseInt(document.getElementById("imagesPerRow").value),

        width: parseInt(document.getElementById("imageWidthInput").value),

        height: parseInt(document.getElementById("imageHeightInput").value),

        align: document.getElementById("imageAlignInput").value,

        layout: document.getElementById("imageLayoutInput").value,

        caption: document.getElementById("imageCaptionInput").value.trim()

    };

    if (editingImageIndex >= 0) {

        questionList[editingImageIndex] = imageItem;

    } else {

        questionList.push(imageItem);

    }

    closeImagePopup();

    renderQuestions();
}

function saveHeading(){

const headingText =
document.getElementById(
"headingTextInput"
).value.trim();

const headingFontSize =
parseInt(
document.getElementById(
"headingFontSizeInput"
).value
) || 24;

if(headingText===""){

alert("Please Enter Heading");

return;

}

questionList.push({

type:"heading",

text:headingText,

fontSize:headingFontSize

});

renderQuestions();

document.getElementById(
"headingTextInput"
).value = "";

document.getElementById(
"headingFontSizeInput"
).value = "24";

closeHeadingPopup();

}
function openTablePopup(){

document.getElementById(
"tablePopup"
).style.display = "block";

}
function previewSelectedImages(){

    const preview=document.getElementById("imagePreview");

    preview.innerHTML="";

    const files=document.getElementById("imageInput").files;

    [...files].forEach(file=>{

        const reader=new FileReader();

        reader.onload=function(e){

            const img=document.createElement("img");

            img.src=e.target.result;

            preview.appendChild(img);

        };

        reader.readAsDataURL(file);

    });

}
document
.getElementById("imageInput")
.addEventListener(
"change",
previewSelectedImages
);

function closeTablePopup(){


document.getElementById(
"tablePopup"
).style.display = "none";

}

// ==========================
// Create Table
// ==========================

function createTable(){

const rows =
parseInt(
document.getElementById(
"rowInput"
).value
);

const cols =
parseInt(
document.getElementById(
"columnInput"
).value
);

if(!rows || !cols){

alert(
"Enter Rows and Columns"
);

return;

}

let tableHTML =
"<table border='1' style='width:100%;border-collapse:collapse'>";

for(let r=0;r<rows;r++){

tableHTML += "<tr>";

for(let c=0;c<cols;c++){

tableHTML += `
<td
contenteditable="true"
style="
height:40px;
min-width:80px;
padding:5px;
">
Enter Text
</td>
`;

}

tableHTML += "</tr>";

}

tableHTML += "</table>";

questionList.push({

type:"table",

html:tableHTML

});

renderQuestions();

closeTablePopup();

document.getElementById(
"rowInput"
).value = "";

document.getElementById(
"columnInput"
).value = "";

}

// ==========================
// Save Question Paper
// ==========================

async function saveQuestionPaper(){

if(!currentUser){

alert("Please Login");

return;

}
// Save edited table contents

document
.querySelectorAll(".question-item table")
.forEach((table,index)=>{

const tableItem =
questionList.find(
q => q.type === "table"
);

if(tableItem){

tableItem.html =
table.outerHTML;

}

});

if(questionList.length===0){

alert(
"Add Questions First"
);

return;

}



const docId =
paperId || questionPaperRef.doc().id;

const paper = {

id: docId,
schoolName:
document.getElementById(
"schoolNameInput"
).value || "",

className:
document.getElementById(
"classInput"
).value,

subject:
document.getElementById(
"subjectInput"
).value,

exam:
document.getElementById(
"examInput"
).value,

fullMarks:
document.getElementById(
"fullMarksInput"
).value || 0,
time:
document.getElementById(
"timeInput"
).value || "",
heading:
document.getElementById(
"headingInput"
).value || "",

headingSize:
Number(
document.getElementById(
"headingSizeInput"
).value
) || 24,

questions:
questionList,

ownerId:
currentUser.uid,

createdAt:
firebase.firestore.FieldValue.serverTimestamp(),

updatedAt:
firebase.firestore.FieldValue.serverTimestamp()

};

try{

await questionPaperRef
.doc(docId)
.set(paper,{merge:true});
alert("Question Paper Saved Successfully");

questionList = [];

renderQuestions();

}catch(error){

console.error(error);

alert("Failed to Save Question Paper");

}



}
const urlParams = new URLSearchParams(window.location.search);

const paperId = urlParams.get("id");

if(paperId){

loadQuestionPaper(paperId);

}

async function loadQuestionPaper(id){

try{

const doc = await questionPaperRef.doc(id).get();

if(!doc.exists){

alert("Question Paper Not Found");

return;

}

const paper = doc.data();

document.getElementById("classInput").value =
paper.className;

document.getElementById("schoolNameInput").value =
paper.schoolName || "";

document.getElementById("subjectInput").value =
paper.subject;

document.getElementById("examInput").value =
paper.exam;

document.getElementById("fullMarksInput").value =
paper.fullMarks;

document.getElementById("timeInput").value =
paper.time || "";
document.getElementById("headingInput").value =
paper.heading || "";

document.getElementById("headingSizeInput").value =
paper.headingSize || 24;
questionList = paper.questions || [];

renderQuestions();

}catch(error){

console.error(error);

alert("Failed to Load Question Paper");

}

}