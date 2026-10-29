// app.js – Ultimate Dashboard (All Widgets + Charts)

const logoutBtn = document.getElementById("logout-btn");
const pageWelcome = document.getElementById("page-welcome");
const totalStudentsEl = document.getElementById("total-students");
const totalTeachersEl = document.getElementById("total-teachers");
const dashTotalPaidMonthEl = document.getElementById("dash-total-paid-month");
const dashTotalPaidMonthLabelEl = document.getElementById("dash-total-paid-month-label");
const monthlyBarChartEl = document.getElementById("monthly-bar-chart");
const monthlyBarYearLabelEl = document.getElementById("monthly-bar-year-label");
const academicYearSelect = document.getElementById("academic-year-select");
const classWiseSummaryEl = document.getElementById("class-wise-summary");
const feeBadgeEl = document.getElementById("fee-badge");

const AY_KEY = "smsAcademicYear";

/* Firebase */
firebase.initializeApp({
  apiKey: "AIzaSyCOzfdIXBeh6drFhml4pOFEvPG8xV_Wjzw",
  authDomain: "school-management-projec-9db7a.firebaseapp.com",
  projectId: "school-management-projec-9db7a"
});

const auth = firebase.auth();
const db = firebase.firestore();

/* Chart.js Instances */
let feesChartInstance = null;
let attChartInstance = null;
let classChartInstance = null;

/* Academic Year */
function getYear() {
  let y = localStorage.getItem(AY_KEY) || new Date().getFullYear();
  localStorage.setItem(AY_KEY, y);
  return y;
}

function initYearUI() {
  academicYearSelect.innerHTML = "";
  for (let y = 2025; y <= 2040; y++) {
    academicYearSelect.innerHTML += `<option value="${y}">${y}</option>`;
  }
  academicYearSelect.value = getYear();
  academicYearSelect.onchange = () => {
    localStorage.setItem(AY_KEY, academicYearSelect.value);
    loadDashboard(auth.currentUser);
  };
}

/* Custom HTML Bar Chart */
function renderChart(totals, year) {
  monthlyBarChartEl.innerHTML = "";
  const max = Math.max(...totals, 1);
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  totals.forEach((v,i)=>{
    monthlyBarChartEl.innerHTML += `
      <div class="bar-item">
        <div class="bar" style="height:${(v/max)*100}%"></div>
        <div class="bar-amount">?${v}</div>
        <div class="bar-month">${m[i]}</div>
      </div>`;
  });

  monthlyBarYearLabelEl.textContent = `Academic Year ${year}`;
}

/* Chart.js Visuals */
function renderChartJS(totalPaid, totalDue, presentCount, absentCount, classLabels, classData) {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";

  // 1. Fees Chart (Bar)
  const ctxFees = document.getElementById('feesChart').getContext('2d');
  if (feesChartInstance) feesChartInstance.destroy();
  feesChartInstance = new Chart(ctxFees, {
    type: 'bar',
    data: {
      labels: ['Collected', 'Pending'],
      datasets: [{
        label: 'Amount (?)',
        data: [totalPaid, totalDue],
        backgroundColor: ['rgba(46, 204, 113, 0.8)', 'rgba(231, 76, 60, 0.8)'],
        borderColor: ['#2ecc71', '#e74c3c'],
        borderWidth: 1,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // 2. Attendance Chart (Doughnut)
  const ctxAtt = document.getElementById('attendanceChart').getContext('2d');
  if (attChartInstance) attChartInstance.destroy();
  attChartInstance = new Chart(ctxAtt, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Absent'],
      datasets: [{
        data: [presentCount, absentCount],
        backgroundColor: ['#2ecc71', '#e74c3c'],
        borderWidth: 0, hoverOffset: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // 3. Students per Class (Pie)
  const ctxClass = document.getElementById('classChart').getContext('2d');
  if (classChartInstance) classChartInstance.destroy();
  classChartInstance = new Chart(ctxClass, {
    type: 'pie',
    data: {
      labels: classLabels.length ? classLabels : ['No Data'],
      datasets: [{
        data: classData.length ? classData : [1],
        backgroundColor: [
          '#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#f1c40f', 
          '#e74c3c', '#34495e', '#2ecc71', '#8e44ad', '#d35400'
        ],
        borderWidth: 0, hoverOffset: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } }
    }
  });
}

/* Helper: Parse Date safely */
function getMonthDay(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return { month: d.getMonth(), day: d.getDate(), full: d };
}

/* Dashboard Loader */
async function loadDashboard(user) {
  if (!user) return;
  const uid = user.uid;
  const year = getYear();
  const today = new Date().toISOString().split("T")[0];
  const currentMonthIdx = new Date().getMonth();

  // Fetch all required data
  const [studentsSnap, teachersSnap, paymentsSnap, attendanceSnap, prevPaymentsSnap, noticeSnap] = await Promise.all([
    db.collection("students").where("ownerId","==",uid).where("academicYear","==",year).get(),
    db.collection("teachers").where("ownerId","==",uid).where("academicYear","==",year).get(),
    db.collection("payments").where("ownerId","==",uid).where("academicYear","==",year).get(),
    db.collection("attendance").where("ownerId","==",uid).where("date","==",today).get(),
    // Fetch previous year payments for comparison
    db.collection("payments").where("ownerId","==",uid).where("academicYear","==",(parseInt(year)-1).toString()).get(),
    // Fetch latest notice
    db.collection("notices").where("ownerId","==",uid).get()
  ]);

  totalStudentsEl.textContent = studentsSnap.size;
  totalTeachersEl.textContent = teachersSnap.size;

  /* --- 1. Data Processing --- */
  const classOrder = ["preprimary", "kg2", "kg1", "ukg", 1,2,3,4,5,6,7,8,9,10,11,12];
  const classLabelsMap = { preprimary: "Pre-Primary", kg2: "LKG", kg1: "NURSERY", ukg: "UKG" };
  const classCount = {};
  classOrder.forEach(c => classCount[String(c)] = 0);
  
  let totalDue = 0;
  let pendingDues = [];
  let birthdays = [];
  let activities = [];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // Process Students
  studentsSnap.forEach(doc => {
    const data = doc.data();
    
    // Pending Dues
    const due = parseFloat(data.dueFee || 0);
    if (!isNaN(due)) {
      totalDue += due;
      if (due > 0) {
        pendingDues.push({ name: data.name, due: due, class: data.studentClass, phone: data.mobile || data.fatherMobile || "" });
      }
    }

    // Class counting
    let studentClass = String(data.studentClass || "").trim().toLowerCase().replace(/\s+/g, "");
    if (studentClass === "kg1" || studentClass === "nursery") studentClass = "kg1";
    else if (studentClass === "kg2" || studentClass === "lkg") studentClass = "kg2";
    else if (studentClass === "preprimary" || studentClass === "pre_primary") studentClass = "preprimary";
    else if (studentClass.startsWith("class")) studentClass = studentClass.replace("class", "");
    if (classCount[studentClass] !== undefined) classCount[studentClass]++;

    // Birthdays
    const dob = getMonthDay(data.dob || data.dateOfBirth);
    if (dob) {
      // Check if birthday is today or upcoming this week (within next 7 days)
      const isToday = dob.month === currentMonth && dob.day === currentDay;
      const diffDays = Math.floor((new Date(now.getFullYear(), dob.month, dob.day) - new Date(now.getFullYear(), currentMonth, currentDay)) / (1000 * 60 * 60 * 24));
      
      if (isToday || (diffDays > 0 && diffDays <= 7)) {
        birthdays.push({ name: data.name, dateStr: data.dob, isToday, diffDays, class: data.studentClass });
      }
    }

    // Activities (New Admissions)
    if (data.createdAt) {
      activities.push({
        type: 'student',
        text: `<b>${data.name}</b> admitted to Class ${data.studentClass}`,
        time: data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
      });
    }
  });

  // Process Payments
  let totalPaid = 0;
  const monthlyTotals = Array(12).fill(0);
  let prevMonthlyTotals = Array(12).fill(0);

  paymentsSnap.forEach(doc => {
    const d = doc.data();
    const amt = parseFloat(d.amount || 0);
    totalPaid += amt;
    if (d.monthKey) {
      const i = parseInt(d.monthKey.slice(5,7)) - 1;
      if (i >= 0 && i < 12) monthlyTotals[i] += amt;
    }
    
    // Activities (Payments)
    if (d.createdAt) {
      activities.push({
        type: 'payment',
        text: `Fee paid by <b>${d.studentName || 'Student'}</b> (?${amt})`,
        time: d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt)
      });
    }
  });

  prevPaymentsSnap.forEach(doc => {
    const d = doc.data();
    const amt = parseFloat(d.amount || 0);
    if (d.monthKey) {
      const i = parseInt(d.monthKey.slice(5,7)) - 1;
      if (i >= 0 && i < 12) prevMonthlyTotals[i] += amt;
    }
  });

  // Process Attendance
  let presentCount = 0, absentCount = 0;
  attendanceSnap.forEach(doc => {
    const a = doc.data();
    const status = (a.status || a.attendanceStatus || "").toLowerCase();
    if (status === "present") presentCount++;
    else if (status === "absent") absentCount++;
  });

  /* --- 2. Render UI --- */

  // Render Stats & Fee Badge
  dashTotalPaidMonthEl.textContent = `?${totalPaid}`;
  dashTotalPaidMonthLabelEl.textContent = `Total Paid for Academic Year ${year}`;

  const currentMonthPaid = monthlyTotals[currentMonth];
  const prevMonthPaid = currentMonth > 0 ? monthlyTotals[currentMonth - 1] : 0;
  
  if (prevMonthPaid > 0) {
    const diff = currentMonthPaid - prevMonthPaid;
    const pct = Math.round((diff / prevMonthPaid) * 100);
    if (pct > 0) {
      feeBadgeEl.className = "fee-badge up";
      feeBadgeEl.textContent = `+${pct}% vs last month`;
    } else if (pct < 0) {
      feeBadgeEl.className = "fee-badge down";
      feeBadgeEl.textContent = `${pct}% vs last month`;
    } else {
      feeBadgeEl.style.display = "none";
    }
    feeBadgeEl.style.display = "inline-block";
  }

  // Render Class Summary
  classWiseSummaryEl.innerHTML = "";
  const chartClassLabels = [], chartClassData = [];
  classOrder.forEach(c => {
    const key = String(c);
    const label = classLabelsMap[c] || `Class ${c}`;
    const count = classCount[key];
    classWiseSummaryEl.innerHTML += `<div class="class-item">${label}: ${count}</div>`;
    if (count > 0) { chartClassLabels.push(label); chartClassData.push(count); }
  });

  renderChart(monthlyTotals, year);
  renderChartJS(totalPaid, totalDue, presentCount, absentCount, chartClassLabels, chartClassData);

  // Render Top 5 Pending Dues
  const duesContainer = document.getElementById("pending-dues-container");
  pendingDues.sort((a, b) => b.due - a.due);
  if (pendingDues.length === 0) {
    duesContainer.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">No pending dues! ??</div>`;
  } else {
    duesContainer.innerHTML = pendingDues.slice(0, 5).map(s => {
      const phone = s.phone.replace(/\D/g, '');
      const waLink = phone ? `https://wa.me/${phone.length === 10 ? '91'+phone : phone}?text=Dear Parent, this is a gentle reminder regarding the pending fees for ${s.name}.` : '#';
      return `
        <div class="list-item">
          <div class="info">
            <span class="title">${s.name}</span>
            <span class="subtitle">Class ${s.class || '-'}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="amount">?${s.due}</span>
            ${phone ? `<a href="${waLink}" target="_blank" class="btn-wa"><i class="fab fa-whatsapp"></i> Remind</a>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Birthdays
  const bdayContainer = document.getElementById("birthday-container");
  birthdays.sort((a, b) => a.diffDays - b.diffDays);
  if (birthdays.length === 0) {
    bdayContainer.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">No upcoming birthdays this week.</div>`;
  } else {
    bdayContainer.innerHTML = birthdays.map(b => `
      <div class="birthday-item">
        <div class="bday-avatar">${b.name.charAt(0).toUpperCase()}</div>
        <div class="info" style="flex:1;">
          <span class="title" style="color:#fff; font-size:0.9rem;">${b.name}</span>
          <span class="subtitle" style="color:#94a3b8; font-size:0.75rem;">Class ${b.class || '-'}</span>
        </div>
        <span style="color:#e84393; font-size:0.8rem; font-weight:bold;">
          ${b.isToday ? '?? Today' : `In ${b.diffDays} days`}
        </span>
      </div>
    `).join('');
  }

  // Render Recent Activity
  const actContainer = document.getElementById("activity-container");
  activities.sort((a, b) => b.time - a.time);
  const recentActs = activities.slice(0, 5);
  if (recentActs.length === 0) {
    actContainer.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">No recent activity found.</div>`;
  } else {
    actContainer.innerHTML = recentActs.map(act => {
      const isPayment = act.type === 'payment';
      const timeAgo = Math.floor((new Date() - act.time) / 60000); // minutes
      const timeText = timeAgo < 60 ? `${timeAgo} mins ago` : timeAgo < 1440 ? `${Math.floor(timeAgo/60)} hrs ago` : `${Math.floor(timeAgo/1440)} days ago`;
      
      return `
        <div class="list-item">
          <div class="activity-icon ${isPayment ? 'act-payment' : 'act-student'}">
            <i class="fas ${isPayment ? 'fa-money-bill-wave' : 'fa-user-plus'}"></i>
          </div>
          <div class="activity-content">
            <div style="color:#fff; font-size:0.85rem;">${act.text}</div>
            <div class="activity-time">${timeText}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Notice Board
  const noticeContainer = document.getElementById("notice-container");
  let latestNotice = null;
  noticeSnap.forEach(doc => {
    const n = doc.data();
    const t = n.createdAt ? (n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt)) : new Date(0);
    if (!latestNotice || t > latestNotice.time) {
      latestNotice = { text: n.message, time: t };
    }
  });

  if (latestNotice) {
    const formattedDate = latestNotice.time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    noticeContainer.innerHTML = `
      <div style="font-size:0.75rem; color:#f1c40f; margin-bottom:6px; font-weight:bold;">Posted on: ${formattedDate}</div>
      <div>${latestNotice.text}</div>
    `;
  } else {
    noticeContainer.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">No notices posted yet.</div>`;
  }
}

/* Auth */
auth.onAuthStateChanged(user => {
  if (!user) {
    location.href = "login.html";
    return;
  }
  pageWelcome.textContent = user.email;
  initYearUI();
  loadDashboard(user);
});

logoutBtn.onclick = () => auth.signOut();