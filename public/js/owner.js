function safeText(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function getStatusBadge(status) {
  const st = (status || "").toLowerCase().trim();
  if (st === "paid") return '<span class="status-badge status-paid">ชำระแล้ว</span>';
  if (st === "overdue") return '<span class="status-badge status-overdue">ค้างชำระ</span>';
  if (st === "pending") return '<span class="status-badge status-pending">รอตรวจสอบ</span>';
  return `<span class="status-badge status-default">${safeText(status)}</span>`;
}

function getRoomStatusBadge(status) {
  const st = (status || "").toLowerCase().trim();
  if (st === "occupied") return '<span class="status-badge status-paid">มีผู้เช่า</span>';
  if (st === "vacant") return '<span class="status-badge status-overdue">ว่าง</span>';
  if (st === "pending") return '<span class="status-badge status-pending">จองไว้</span>';
  return `<span class="status-badge status-default">${safeText(status)}</span>`;
}

function getRepairStatusBadge(status){
  const st = (status || "").toLowerCase().trim().replace("-", "");
  if (st === "pending" || st === "new" || st === "received") {
    return '<span class="status-badge repair-await"><span class="dot"></span>รอรับเรื่อง</span>';
  }
  if (st === "inprogress")  return '<span class="status-badge repair-in-progress">กำลังดำเนินการ</span>';
  if (st === "done" || st === "completed") return '<span class="status-badge repair-done">ซ่อมเสร็จแล้ว</span>';
  return `<span class="status-badge status-default">${safeText(status)}</span>`;
}

function applyRepairFilters() {
  const statusSel = document.getElementById("repair-status-filter");
  const qInput = document.getElementById("repair-search");
  const df = document.getElementById("repair-date-from");
  const dt = document.getElementById("repair-date-to");
  const q = (qInput && qInput.value || "").trim().toLowerCase();
  const status = (statusSel && statusSel.value || "all").replace("-", "");
  const from = df && df.value ? Date.parse(df.value + "T00:00:00") : null;
  const to = dt && dt.value ? Date.parse(dt.value + "T23:59:59") : null;

  const cards = document.querySelectorAll(".repair-card");
  let shown = 0, cPending=0, cProg=0, cDone=0;
  cards.forEach(card => {
    const st = (card.dataset.status||"").replace("-", "");
    const text = (card.dataset.text||"");
    const t = parseInt(card.dataset.date||"0", 10) || 0;
    let ok = true;
    if (status !== "all" && st !== status) ok = false;
    if (ok && q && !text.includes(q)) ok = false;
    if (ok && from !== null && t < from) ok = false;
    if (ok && to !== null && t > to) ok = false;

    card.style.display = ok ? "" : "none";
    if (ok) shown++;
    if (st==="pending") cPending += ok?1:0;
    if (st==="inprogress") cProg += ok?1:0;
    if (st==="done") cDone += ok?1:0;
  });

  const sum = document.getElementById("repair-summary");
  if (sum) {
    sum.textContent = `ผลลัพธ์ที่แสดง: ${shown} รายการ | รอดำเนินการ ${cPending} | กำลังดำเนินการ ${cProg} | เสร็จแล้ว ${cDone}`;
  }
}

// Bind filter controls
(function bindRepairFilters(){
  const statusSel = document.getElementById("repair-status-filter");
  const qInput = document.getElementById("repair-search");
  const df = document.getElementById("repair-date-from");
  const dt = document.getElementById("repair-date-to");
  const resetBtn = document.getElementById("repair-filter-reset");
  const refreshBtn = document.getElementById("repair-refresh");

  if (statusSel && !statusSel._bound) { statusSel.addEventListener("change", applyRepairFilters); statusSel._bound = true; }
  if (qInput && !qInput._bound) { qInput.addEventListener("input", applyRepairFilters); qInput._bound = true; }
  if (df && !df._bound) { df.addEventListener("change", applyRepairFilters); df._bound = true; }
  if (dt && !dt._bound) { dt.addEventListener("change", applyRepairFilters); dt._bound = true; }
  if (resetBtn && !resetBtn._bound) { 
    resetBtn.addEventListener("click", () => {
      if (qInput) qInput.value = "";
      if (df) df.value = "";
      if (dt) dt.value = "";
      if (statusSel) statusSel.value = "all";
      applyRepairFilters();
    });
    resetBtn._bound = true;
  }
  if (refreshBtn && !refreshBtn._bound) {
    refreshBtn.addEventListener("click", () => { fetchRepairsFromAPI(); });
    refreshBtn._bound = true;
  }
})();


/* ---------- api-driven ui ---------- */
async function fetchUserInfo() {
  try {
    const res = await fetch("/api/userinfo");
    const data = await res.json();
    if (data.user && data.user.name) {
      const el = document.getElementById("welcome-text");
      if (el) el.textContent = `สวัสดี, ${data.user.name}`;
    }
  } catch (err) {
    console.error("Error in fetchUserInfo:", err);
  }
}

async function updateDashboard() {
  try {
    const res = await fetch("/api/owner/dashboard");
    if (!res.ok) throw new Error("Network response not OK");
    const data = await res.json();

    const cardElems = document.querySelectorAll(".summary-cards .card .info p");
    if (cardElems.length >= 4) {
      cardElems[0].textContent = `${data.vacantRooms} ห้อง`;
      cardElems[1].textContent = `${data.overduePayments} คน`;
      cardElems[2].textContent = `${data.pendingMaintenance} รายการ`;
      cardElems[3].textContent = `${(data.monthlyIncome || 0).toLocaleString("th-TH")} บาท`;
    }

    const alertList = document.querySelector(".alert-list");
    if (!alertList) return;
    alertList.innerHTML = "";
    if (data.alerts && data.alerts.length > 0) {
      data.alerts.forEach((alert) => {
        const html = `<div class="alert-item"><i class="fa-solid fa-triangle-exclamation"></i><span>${safeText(alert.message)}</span></div>`;
        alertList.insertAdjacentHTML("beforeend", html);
      });
    } else {
      alertList.innerHTML = '<div class="alert-item">ไม่มีการแจ้งเตือนด่วน</div>';
    }
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    const alertList = document.querySelector(".alert-list");
    if (alertList) {
      alertList.innerHTML = '<div class="alert-item" style="color:red;">เกิดข้อผิดพลาดในการโหลดข้อมูลภาพรวม</div>';
    }
  }
}

async function fetchContractsFromAPI() {
  const tbody = document.querySelector("#contracts-section .tenant-table tbody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';
  try {
    const res = await fetch("/api/owner/leases");
    if (!res.ok) throw new Error("Network response not OK");
    const arr = await res.json();
    tbody.innerHTML = "";

    if (Array.isArray(arr) && arr.length > 0) {
      arr.forEach((contract) => {
        const tr = document.createElement("tr");

        const tdRoom   = document.createElement("td");
        const tdTenant = document.createElement("td");
        const tdStart  = document.createElement("td");
        const tdEnd    = document.createElement("td");
        const tdStatus = document.createElement("td");
                const tdAction = document.createElement("td");

        tdRoom.textContent   = contract.room_number;
        tdTenant.textContent = contract.tenant_name;
        tdStart.textContent  = new Date(contract.start_date).toLocaleDateString("th-TH");
        tdEnd.textContent    = new Date(contract.end_date).toLocaleDateString("th-TH");

        if (contract.status === "expiring_soon") {
          tdStatus.innerHTML = '<span class="status-badge status-pending">ใกล้หมดอายุ</span>';
        } else if (contract.status === "active") {
          tdStatus.innerHTML = '<span class="status-badge status-paid">ปกติ</span>';
        } else {
          tdStatus.innerHTML = `<span class="status-badge status-default">${safeText(contract.status)}</span>`;
        }

        tdAction.className = "action-icons";
        tdAction.innerHTML = `
          <a href="#" class="edit-contract-btn" title="แก้ไข"><i class="fa-solid fa-pencil"></i></a>
          <a href="#" class="delete-contract-btn" title="ลบ"><i class="fa-solid fa-trash-can"></i></a>
        `;

        tr.append(tdRoom, tdTenant, tdStart, tdEnd, tdStatus, tdAction);
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่พบข้อมูลสัญญาเช่า</td></tr>';
    }
  } catch (err) {
    console.error("Error fetching contracts:", err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">ไม่สามารถโหลดข้อมูลสัญญาเช่าได้</td></tr>';
  }
}

async function fetchTenantsFromAPI() {
  const section = document.getElementById("tenants-section");
  const tbody = section.querySelector(".tenant-table tbody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';

  try {
    const qInput = section.querySelector('.search-tenant input');const q = encodeURIComponent(qInput?.value || "");
    const res = await fetch(`/api/owner/tenants?q=${q}`);
    if (!res.ok) throw new Error("Network response not OK");
    const json = await res.json();
    const tenants = (json && Array.isArray(json.tenants)) ? json.tenants : [];
    tbody.innerHTML = "";

    if (tenants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ไม่พบข้อมูลผู้เช่า</td></tr>';
      return;
    }

    tenants.forEach((t) => {
      const tr = document.createElement("tr");
      tr.dataset.tenantId = t.id;

      const tdRoom   = document.createElement("td");
      const tdTenant = document.createElement("td");
      const tdPhone  = document.createElement("td");
            const tdAction = document.createElement("td");

      tdRoom.textContent   = safeText(t.roomNumber || "-");
      tdTenant.textContent = safeText(t.name);
      tdPhone.textContent  = safeText(t.phone || "-");
      
      tdAction.className = "action-icons";
      tdAction.innerHTML = `
        <button class="icon-btn edit-tenant"    title="แก้ไข"        data-id="${t.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn move-room"      title="ย้ายห้อง"     data-id="${t.id}" data-room="${t.roomId||''}"><i class="fa-solid fa-right-left"></i></button>
        <button class="icon-btn move-out"       title="ย้ายออก"      data-id="${t.id}"><i class="fa-solid fa-door-open"></i></button>
        <button class="icon-btn view-bills"     title="ประวัติบิล"   data-id="${t.id}"><i class="fa-solid fa-file-invoice-dollar"></i></button>
      `;

      tr.append(tdRoom, tdTenant, tdPhone, tdAction);
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Error fetching tenants:", err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">ไม่สามารถโหลดข้อมูลผู้เช่าได้</td></tr>';
  }
}
async function fetchRoomsFromAPI() {
  const tbody = document.querySelector("#rooms-section .tenant-table tbody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';
  try {
    const res = await fetch("/api/owner/rooms");
    if (!res.ok) throw new Error("Network response not OK");
    const { rooms = [] } = await res.json();
    tbody.innerHTML = "";

    if (rooms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่พบข้อมูลห้องพัก</td></tr>';
      return;
    }

    rooms
      .sort((a,b)=> String(a.roomNumber).localeCompare(String(b.roomNumber), 'en', { numeric: true, sensitivity: 'base' }))
      .forEach(room => {
      const tr = document.createElement("tr");
      const tdRoom   = document.createElement("td");
      const tdType   = document.createElement("td");
      const tdRent   = document.createElement("td");
      const tdStatus = document.createElement("td");
            const tdTenant = document.createElement("td");

      tdRoom.textContent   = room.roomNumber;
      tdType.textContent = (findTypeByAny(room.type)?.label || room.type);
      tdRent.textContent   = (room.rent || 0).toLocaleString("th-TH");
      tdStatus.innerHTML   = getRoomStatusBadge(room.status);
      tdTenant.textContent = room.tenant || "-";

      tr.append(tdRoom, tdType, tdRent, tdStatus, tdTenant);
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">ไม่สามารถโหลดข้อมูลห้องพักได้</td></tr>';
    console.error(err);
  }
}

/* ---------- announcements ---------- */
async function loadAnnouncementRooms() {
  const sel = document.getElementById("announcement-recipient");
  if (!sel) return;
  // Clear and add the "all" option
  sel.innerHTML = '<option value="all" selected>ผู้เช่าทั้งหมด</option>';
  try {
    const res = await fetch("/api/owner/rooms/simple");
    const list = res.ok ? await res.json() : [];
    (list || []).forEach(r => {
      const opt = document.createElement("option");
      opt.value = String(r.id);
      opt.textContent = `ห้อง ${r.room_number}`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("โหลดรายชื่อห้องไม่สำเร็จ:", e);
  }
}

function getSelectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions || []).map(o => o.value);
}

async function handleAnnouncementSubmit(event) {
  event.preventDefault();
  const form = event.target;

  const title   = (document.getElementById("announcement-title")?.value || "").trim();
  const content = (document.getElementById("announcement-content")?.value || "").trim();
  const sel     = document.getElementById("announcement-recipient");

  if (!title || !content) {
    alert("กรุณากรอกหัวข้อและเนื้อหาให้ครบ");
    return;
  }

  const value = sel?.value || "all";
  let payload;

  if (value === "all") {
    // ส่งถึงผู้เช่าทุกห้อง
    payload = { title, content, target: "tenant" };
  } else {
    // ส่งถึงห้องเดียว (ค่าที่เลือกในดรอปดาวน์)
    const roomId = Number(value);
    if (!Number.isFinite(roomId)) {
      alert("กรุณาเลือกห้องที่จะส่งประกาศ");
      return;
    }
    payload = { title, content, roomIds: [roomId] };
  }

  try {
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || "ส่งประกาศไม่สำเร็จ");

    alert("ส่งประกาศสำเร็จ!");
    form.reset();
    // ตั้งค่าให้กลับมาอยู่ที่ 'ผู้เช่าทั้งหมด' และโหลดรายการห้องใหม่
    document.getElementById("announcement-recipient").value = "all";
    await loadAnnouncementRooms();
  } catch (err) {
    console.error("Announcement error:", err);
    alert(err.message || "เกิดข้อผิดพลาดในการส่งประกาศ");
  }
}

/* ---------- accounting ---------- */
async function fetchAccountingData() {
  const tbody = document.querySelector("#accounting-section .tenant-table tbody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">กำลังโหลดข้อมูล...</td></tr>';
  try {
    const mSel = document.getElementById("acc-month-filter");
    const ySel = document.getElementById("acc-year-filter");
    const m = mSel?.value || "";
    const y = ySel?.value || "";
    const qs = (m && y) ? `?month=${encodeURIComponent(m)}&year=${encodeURIComponent(y)}` : "";
    const res = await fetch(`/api/owner/accounting${qs}`);
    if (!res.ok) throw new Error("Network response not OK");
    const json = await res.json();
    const arr = json.accountingData || [];
    tbody.innerHTML = "";

    if (arr.length > 0) {
      arr.forEach((item) => {
        const tr = document.createElement("tr");

        const tdRoom   = document.createElement("td");
        const tdTenant = document.createElement("td");
        const tdAmount = document.createElement("td");
        const tdStatus  = document.createElement("td");
                const tdProof  = document.createElement("td");
        const tdApprove= document.createElement("td");
        const tdReject = document.createElement("td");

        tdRoom.textContent   = item.roomNumber;
        tdTenant.textContent = item.tenantName;
        tdAmount.textContent = (item.amount || 0).toLocaleString("th-TH");
        tdStatus.innerHTML   = getStatusBadge(item.status);
        tdProof.innerHTML = tdApprove.innerHTML = tdReject.innerHTML = "-";

        if ((item.status || "").toLowerCase().trim() === "pending" && item.slipFilename) {
          const safeFilename = encodeURIComponent(item.slipFilename);
          tdProof.innerHTML   = `<a href="/uploads/${safeFilename}" target="_blank" title="ดูหลักฐาน"><span class="status-badge status-default">ดูบิล</span></a>`;
          tdApprove.innerHTML = `<button class="financial-action-btn green" data-id="${item.paymentId}" data-action="approve" title="อนุมัติ"><i class="fa-solid fa-circle-check"></i></button>`;
          tdReject.innerHTML  = `<button class="financial-action-btn red" data-id="${item.paymentId}" data-action="reject" title="ปฏิเสธ"><i class="fa-solid fa-circle-xmark"></i></button>`;
        }

        tr.append(tdRoom, tdTenant, tdAmount, tdStatus, tdProof, tdApprove, tdReject);
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">ไม่พบข้อมูลทางการเงิน</td></tr>';
    }
  } catch (err) {
    console.error("Error fetching accounting:", err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">ไม่สามารถโหลดข้อมูลการเงินได้</td></tr>';
  }
}

function handleAccountingClick(event) {
  const btn = event.target.closest(".financial-action-btn");
  if (!btn) return;

  const paymentId = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  if (!paymentId || !action) return;

  if (action === "reject") {
    const reason = prompt("เหตุผลในการปฏิเสธสลิป:", "หลักฐานไม่ชัดเจน");
    if (reason === null) return; // cancelled
    fetch(`/api/owner/payments/${paymentId}/reject`, {
      method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ reason })
    }).then(r=>r.json()).then(()=>{ alert("ปฏิเสธสลิปแล้ว"); fetchAccountingData(); }).catch(()=>alert("ปฏิเสธไม่สำเร็จ"));
    return;
  }

  const confirmMsg = "คุณแน่ใจไหมที่จะอนุมัติการชำระเงินนี้?";
  if (!confirm(confirmMsg)) return;

  fetch(`/api/owner/approve-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId }),
  })
    .then(res => {
      if (!res.ok) return res.json().then(err => Promise.reject(err));
      return res.json();
    })
    .then((json) => {
      alert(json.message || "ดำเนินการสำเร็จ");
      fetchAccountingData();
    })
    .catch((err) => {
      console.error("Error in accounting action:", err);
      alert("เกิดข้อผิดพลาดในการดำเนินการ: " + (err.error || 'Unknown error'));
    });
}

/* ---------- repairs ---------- */
async function fetchRepairsFromAPI() {
  const repairListContainer = document.querySelector(".repair-list");
  if (!repairListContainer) return;
  repairListContainer.innerHTML = '<p style="text-align:center;">กำลังโหลดรายการแจ้งซ่อม...</p>';
  try {
    const response = await fetch("/api/owner/repairs");
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    const data = await response.json();
    const repairs = data.repairs;
    repairListContainer.innerHTML = "";

    if (repairs && repairs.length > 0) {
      repairs.forEach((item) => {
        const normStatus = String(item.status||"").toLowerCase().replace(/\s+/g,"").replace("-", "");
        const ts = Date.parse(item.dateReported);
        const cardHTML = `
          <div class="repair-card" data-status="${normStatus}" data-room="${safeText(item.roomNumber)}" data-category="${safeText(item.category)}" data-tenant="${safeText(item.tenant_name||"")}" data-date="${ts}" data-text="${safeText((item.roomNumber+' '+item.category+' '+item.description+' '+(item.tenant_name||'')).toLowerCase())}">
            <div class="repair-card-info">
              <h3><span class="room-number">${safeText(item.roomNumber)}</span> - ${safeText(item.category)}</h3>
              <p>${safeText(item.description)}</p>
              <div class="meta-info">
                <div class="status-badge-container">${getRepairStatusBadge(normStatus)}</div>
                <span>วันที่แจ้ง: ${new Date(item.dateReported).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}</span>
              </div>
            </div>
            <div class="repair-actions">
              <select class="repair-status-update" data-id="${item.id}">
                <option value="pending" ${normStatus === "pending" ? "selected" : ""}>รอดำเนินการ</option>
                <option value="inprogress" ${normStatus === "inprogress" ? "selected" : ""}>กำลังดำเนินการ</option>
                <option value="done" ${normStatus === "done" ? "selected" : ""}>ซ่อมเสร็จแล้ว</option>
              </select>
            </div>
          </div>`;
        repairListContainer.insertAdjacentHTML("beforeend", cardHTML);
      });
      if (typeof applyRepairFilters === "function") applyRepairFilters();
    } else {
      repairListContainer.innerHTML = '<p style="text-align:center;">ไม่มีรายการแจ้งซ่อม</p>';
    }
  } catch (error) {
    console.error("Error fetching repair data:", error);
    repairListContainer.innerHTML = '<p style="text-align:center; color:red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
  }
}

function handleRepairStatusUpdate(event) {
  const selectElement = event.target;
  if (!selectElement.classList.contains("repair-status-update")) return;

  const repairId = selectElement.dataset.id;
  const newStatus = selectElement.value;
  const card = selectElement.closest(".repair-card");
  if (!card) return;
  card.classList.add("updating");

  fetch("/api/owner/repairs/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repairId: repairId, status: newStatus }),
  })
    .then((res) => {
      if (!res.ok) return res.json().then((err) => Promise.reject(err));
      return res.json();
    })
    .then((data) => {
      if (data.success) {
        card.dataset.status = newStatus;
        const badgeContainer = card.querySelector(".status-badge-container");
        if (badgeContainer) badgeContainer.innerHTML = getRepairStatusBadge(newStatus);
      } else {
        throw new Error(data.message || "Update failed");
      }
    })
    .catch((err) => {
      console.error("Failed to update status:", err);
      alert("อัปเดตสถานะไม่สำเร็จ!");
      fetchRepairsFromAPI();
    })
    .finally(() => {
      card.classList.remove("updating");
    });
}

/* ---------- billing ---------- */
const billingModal = document.getElementById("billing-modal");

function setupBillingFilters() {
  const monthFilter = document.getElementById("billing-month-filter");
  const yearFilter = document.getElementById("billing-year-filter");
  if (!monthFilter || !yearFilter) return;

  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  months.forEach((month, index) => monthFilter.add(new Option(month, index + 1)));
  monthFilter.value = String(currentMonth + 1);

  for (let i = currentYear - 2; i <= currentYear + 1; i++) {
    yearFilter.add(new Option(i + 543, i));
  }
  yearFilter.value = String(currentYear);

  monthFilter.addEventListener("change", fetchBillingData);
  yearFilter.addEventListener("change", fetchBillingData);
}

const waterRate = 18;
const elecRate  = 8;

// ตัวช่วยเล็ก ๆ (หน้าเพจนี้มี helper อยู่แล้ว เช่น getStatusBadge/safeText)
// ถ้ามีประกาศแล้วในไฟล์ ให้คงตัวเดิมไว้ ไม่ต้องซ้ำ

function thMonthsName(idx) {
  const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                     "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return TH_MONTHS[idx] || "";
}

function getFilters() {
  const month = document.getElementById("billing-month-filter")?.value;
  const year  = document.getElementById("billing-year-filter")?.value;
  return { month, year };
}

// โหลดตารางบิลตามเดือน/ปี
async function fetchBillingData() {
  const { month, year } = getFilters();
  const tbody = document.querySelector("#billing-table tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">กำลังโหลด...</td></tr>`;

  try {
    const res = await fetch(`/api/owner/billing?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`);
    if (!res.ok) throw new Error("Fetch billing failed");
    const data = await res.json();
    const bills = data?.bills || [];

    if (!bills.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">ไม่พบข้อมูลบิลสำหรับเดือนที่เลือก</td></tr>';
      return;
    }

    tbody.innerHTML = "";
    bills.forEach(bill => {
      const total = Number(bill.total ?? bill.amount ?? 0);
      const waterTotal = Number(bill.water_total ?? bill.waterTotal ?? 0);
      const elecTotal  = Number(bill.elec_total  ?? bill.elecTotal  ?? 0);
      const statusBadge = getStatusBadge?.(bill.status) || bill.status;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${safeText(bill.roomNumber)}</td>
        <td>${safeText(bill.tenantName)}</td>
        <td>${(Number(bill.rent)||0).toLocaleString("th-TH")}</td>
        <td>${waterTotal.toLocaleString("th-TH")}</td>
        <td>${elecTotal.toLocaleString("th-TH")}</td>
        <td>${total.toLocaleString("th-TH")}</td>
        <td>${statusBadge}</td>
        <td class="action-icons">
          <button class="manage-bill-btn" data-bill-id="${bill.id}" title="จัดการบิล">
            <i class="fa-solid fa-pencil"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // ติด handler ปุ่มแก้ไข
    document.querySelectorAll(".manage-bill-btn").forEach((btn) => {
      btn.addEventListener("click", () => openBillingModal(btn.dataset.billId));
    });
  } catch (err) {
    console.error("Error fetching billing data:", err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">ไม่สามารถโหลดข้อมูลได้</td></tr>';
  }
}

// เปิดโมดัลจากข้อมูลจริง
async function openBillingModal(billId) {
  const billingModal = document.getElementById("billing-modal");
  if (!billingModal) return;

  try {
    const res = await fetch(`/api/owner/billing/${billId}`);
    if (!res.ok) throw new Error("Fetch bill failed");
    const bill = await res.json();

    const d = bill.dueDate ? new Date(bill.dueDate) : new Date();
    const title = `จัดการบิลห้อง ${bill.roomNumber} — ${thMonthsName(d.getMonth())} ${d.getFullYear()+543}`;
    document.getElementById("modal-title").textContent = title;

    // ใส่ค่าเริ่มในฟอร์ม
    document.getElementById("billing-id").value      = bill.id;
    document.getElementById("bill-rent").value       = bill.rent ?? 0;
    document.getElementById("bill-others").value     = bill.others ?? 0;

    document.getElementById("bill-water-prev").value = bill.waterPrev ?? 0;
    document.getElementById("bill-water-curr").value = bill.waterCurr ?? 0;
    document.getElementById("bill-elec-prev").value  = bill.elecPrev ?? 0;
    document.getElementById("bill-elec-curr").value  = bill.elecCurr ?? 0;

    recalcModalTotals(); // คำนวณค่าน้ำ/ไฟ/รวม
    billingModal.classList.remove("hidden");
  } catch (e) {
    console.error(e);
    alert("ไม่สามารถเปิดบิลได้");
  }
}

const d = new Date();
const mm = String(d.getMonth()+1).padStart(2,"0");
const yy = String(d.getFullYear());
fetch(`/api/owner/accounting?month=${mm}&year=${yy}`);

// คำนวณผลรวมในโมดัล (ฝั่ง client)
// บันทึกค่าจากโมดัล → API
document.getElementById("billing-details-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("billing-id")?.value;
  if (!id) return;

  const payload = {
    others:   Number(document.getElementById("bill-others").value || 0),
    waterPrev:Number(document.getElementById("bill-water-prev").value || 0),
    waterCurr:Number(document.getElementById("bill-water-curr").value || 0),
    elecPrev: Number(document.getElementById("bill-elec-prev").value || 0),
    elecCurr: Number(document.getElementById("bill-elec-curr").value || 0),
  };

  try {
    const res = await fetch(`/api/owner/billing/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Update failed");
    alert("บันทึกสำเร็จ");
    closeBillingModal();
    fetchBillingData();
  } catch (err) {
    console.error(err);
    alert("บันทึกไม่สำเร็จ");
  }
});

// ปุ่ม “ชำระเงินแล้ว”
document.getElementById("mark-as-paid-btn")?.addEventListener("click", async () => {
  const id = document.getElementById("billing-id")?.value;
  if (!id) return;
  if (!confirm("ยืนยันมาร์คบิลนี้เป็น 'ชำระแล้ว'?")) return;

  try {
    const res = await fetch(`/api/owner/billing/${encodeURIComponent(id)}/mark-paid`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Mark paid failed");
    alert("มาร์คชำระแล้วเรียบร้อย");
    closeBillingModal();
    fetchBillingData();
  } catch (err) {
    console.error(err);
    alert("มาร์คชำระไม่สำเร็จ");
  }
});

// ปุ่ม “สร้างบิลเดือนนี้”
document.getElementById("generate-bills-btn")?.addEventListener("click", async () => {
  const { month, year } = getFilters();
  if (!confirm(`สร้างบิลเดือน ${thMonthsName(Number(month)-1)} ${Number(year)+543} สำหรับผู้เช่าที่ไม่มีบิล?`)) return;

  try {
    const res = await fetch(`/api/owner/billing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: Number(month), year: Number(year) })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Generate failed");
    alert(`สร้างบิลสำเร็จ: ${json.inserted || 0} รายการ`);
    fetchBillingData();
  } catch (e) {
    console.error(e);
    alert("สร้างบิลไม่สำเร็จ");
  }
});

// เปลี่ยนตัวกรอง → โหลดใหม่
document.getElementById("billing-month-filter")?.addEventListener("change", fetchBillingData);
document.getElementById("billing-year-filter")?.addEventListener("change", fetchBillingData);

// รีคัลซ์ยอดเมื่อกรอกเลขมิเตอร์/others
["bill-others","bill-water-curr","bill-elec-curr"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", recalcModalTotals);
});

function closeBillingModal() {
  if (!billingModal) return;
  billingModal.classList.add("hidden");
  const form = document.getElementById("billing-details-form");
  if (form) form.reset();
}

function recalcModalTotals() {
  const rent       = parseFloat(document.getElementById("bill-rent")?.value) || 0;
  const others     = parseFloat(document.getElementById("bill-others")?.value) || 0;

  const waterPrev  = parseFloat(document.getElementById("bill-water-prev")?.value) || 0;
  const waterCurr  = parseFloat(document.getElementById("bill-water-curr")?.value) || 0;
  const waterUnits = waterCurr > waterPrev ? waterCurr - waterPrev : 0;
  const waterTotal = waterUnits * waterRate;
  const wu = document.getElementById("bill-water-units");
  const wt = document.getElementById("bill-water-total");
  if (wu) wu.value = waterUnits.toFixed(2);
  if (wt) wt.value = waterTotal.toFixed(2);

  const elecPrev   = parseFloat(document.getElementById("bill-elec-prev")?.value) || 0;
  const elecCurr   = parseFloat(document.getElementById("bill-elec-curr")?.value) || 0;
  const elecUnits  = elecCurr > elecPrev ? elecCurr - elecPrev : 0;
  const elecTotal  = elecUnits * elecRate;
  const eu = document.getElementById("bill-elec-units");
  const et = document.getElementById("bill-elec-total");
  if (eu) eu.value = elecUnits.toFixed(2);
  if (et) et.value = elecTotal.toFixed(2);

  const grandTotal = rent + others + waterTotal + elecTotal;
  const gt = document.getElementById("bill-grand-total");
  if (gt) gt.textContent = grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const addTenantBtn = document.querySelector("#tenants-section .add-tenant-btn");
const addTenantModal = document.getElementById("add-tenant-modal");
const closeAddTenantBtn = document.querySelector("[data-close-add-tenant]");
const addTenantForm = document.getElementById("add-tenant-form");
const addTenantRoomSelect = document.getElementById("add-tenant-room");

// เปิดโมดอล + โหลดห้องว่าง
if (addTenantBtn && addTenantModal) {
  addTenantBtn.addEventListener("click", async () => {
    addTenantModal.classList.remove("hidden");
    try {
      const res = await fetch("/api/owner/available-rooms");
      const rooms = await res.json();
      addTenantRoomSelect.innerHTML = `<option value="">— ไม่ระบุ —</option>`;
      (rooms || []).forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = `ห้อง ${r.room_number}`;
        addTenantRoomSelect.appendChild(opt);
      });
    } catch (e) {
      console.error("Load available rooms failed:", e);
      addTenantRoomSelect.innerHTML = `<option value="">— โหลดห้องไม่สำเร็จ —</option>`;
    }
  });
}

// ปิดโมดอล
if (closeAddTenantBtn) {
  closeAddTenantBtn.addEventListener("click", () => {
    addTenantModal.classList.add("hidden");
    addTenantForm?.reset();
  });
}
addTenantModal?.addEventListener("click", (e) => {
  if (e.target === addTenantModal) {
    addTenantModal.classList.add("hidden");
    addTenantForm?.reset();
  }
});

// ส่งฟอร์ม
if (addTenantForm) {
  addTenantForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(addTenantForm);
    const payload = Object.fromEntries(formData.entries());
    if (!payload.roomId) delete payload.roomId;

    try {
      const res = await fetch("/api/owner/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "สร้างผู้เช่าไม่สำเร็จ");
      }
      alert("เพิ่มผู้เช่าสำเร็จ");
      addTenantModal.classList.add("hidden");
      addTenantForm.reset();
      // รีเฟรชข้อมูลให้ครบ
      fetchTenantsFromAPI && fetchTenantsFromAPI();
      fetchRoomsFromAPI && fetchRoomsFromAPI();
      updateDashboard && updateDashboard();
  refreshOverviewExtras();
  setInterval(()=>{updateDashboard(); refreshOverviewExtras();}, 300000);
    } catch (err) {
      console.error("Create tenant failed:", err);
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  });
}

async function refreshOverviewExtras() {
  try {
    // 1) Rooms for occupancy and expected revenue
    const roomsRes = await fetch("/api/owner/rooms");
    const roomsJson = roomsRes.ok ? await roomsRes.json() : { rooms: [] };
    const rooms = roomsJson.rooms || [];
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied');
    const occupiedCount = occupiedRooms.length;
    const occupancyPct = totalRooms ? Math.round((occupiedCount / totalRooms) * 100) : 0;
    const expectedRevenue = occupiedRooms.reduce((sum, r) => sum + (Number(r.rent)||0), 0);

    const elOccPct = document.getElementById("occupancyPct");
    const elOccCnt = document.getElementById("occupiedCount");
    const elTotal = document.getElementById("totalRooms");
    if (elOccPct) elOccPct.textContent = occupancyPct + "%";
    if (elOccCnt) elOccCnt.textContent = occupiedCount;
    if (elTotal) elTotal.textContent = totalRooms;

    // 2) Accounting for pending approvals & overdue/top
    const accRes = await fetch("/api/owner/accounting");
    const accJson = accRes.ok ? await accRes.json() : { accountingData: [] };
    const acc = accJson.accountingData || [];
    const pending = acc.filter(x => (x.status||'').toLowerCase() === 'pending').length;
    const overdue = acc.filter(x => (x.status||'').toLowerCase() === 'overdue');

    const elPending = document.getElementById("pendingApprovals");
    if (elPending) elPending.textContent = pending + " ใบ";

    // Top overdue by amount desc (take 3)
    overdue.sort((a,b)=> (Number(b.amount)||0) - (Number(a.amount)||0));
    const top3 = overdue.slice(0,3);
    const topList = document.getElementById("topOverdueList");
    if (topList) {
      topList.innerHTML = "";
      if (top3.length === 0) {
        const li = document.createElement("li");
        li.textContent = "ไม่พบผู้เช่าค้างชำระ";
        topList.appendChild(li);
      } else {
        top3.forEach(item => {
          const li = document.createElement("li");
          li.innerHTML = `<div><strong>ห้อง ${escapeHtml(item.roomNumber||"-")}</strong> — ${escapeHtml(item.tenantName||"-")}</div>
                          <div class="meta"><span class="badge red">${Number(item.amount||0).toLocaleString('th-TH')} บาท</span></div>`;
          topList.appendChild(li);
        });
      }
    }

    // 3) Collection rate = monthlyIncome / expectedRevenue
    try {
      const dash = await (await fetch("/api/owner/dashboard")).json();
      const actual = Number(dash.monthlyIncome||0);
      const rate = expectedRevenue ? Math.round((actual/expectedRevenue)*100) : 0;
      const bar = document.getElementById("collectionRateBar");
      const txt = document.getElementById("collectionRateText");
      if (bar) bar.style.width = Math.min(rate,100) + "%";
      if (txt) txt.textContent = `${rate}% (${actual.toLocaleString('th-TH')} / ${expectedRevenue.toLocaleString('th-TH')} บาท)`;
    } catch(_) {}

    // 4) Expiring leases
    const leaseRes = await fetch("/api/owner/leases");
    const leases = leaseRes.ok ? await leaseRes.json() : [];
    const expiring = (leases||[]).filter(x => (x.status||'').toLowerCase() === 'expiring_soon')
                                  .sort((a,b)=> new Date(a.end_date)-new Date(b.end_date))
                                  .slice(0,5);
    const expList = document.getElementById("expiringLeasesList");
    if (expList) {
      expList.innerHTML = "";
      if (expiring.length === 0) {
        const li = document.createElement("li");
        li.textContent = "ไม่มีสัญญาใกล้หมดอายุ";
        expList.appendChild(li);
      } else {
        expiring.forEach(x => {
          const end = x.end_date ? new Date(x.end_date) : null;
          const endText = end ? end.toLocaleDateString('th-TH') : '-';
          const li = document.createElement("li");
          li.innerHTML = `<div><strong>ห้อง ${escapeHtml(x.room_number||"-")}</strong> — ${escapeHtml(x.tenant_name||"-")}</div>
                          <div class="meta"><span class="badge orange">หมดอายุ ${endText}</span></div>`;
          expList.appendChild(li);
        });
      }
    }

  } catch (err) {
    console.error("refreshOverviewExtras error:", err);
  }
}

// small helper for HTML escaping
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

let ROOM_TYPES_CACHE = null;
async function loadRoomTypes() {
  if (ROOM_TYPES_CACHE) return ROOM_TYPES_CACHE;
  try {
    const res = await fetch("/api/owner/room-types");
    const json = await res.json();
    ROOM_TYPES_CACHE = (json.types || []).map(t => ({ key: t.key, label: t.label, rent: Number(t.rent)||0 }));
  } catch (e) {
    // fallback ถ้า API มีปัญหา
    ROOM_TYPES_CACHE = [
      { key: "air",          label: "ห้องแอร์",        rent: 3500 },
      { key: "air_built_in", label: "ห้องแอร์บิวท์อิน", rent: 4500 },
    ];
  }
  return ROOM_TYPES_CACHE;
}
function findTypeByAny(val) {
  if (!ROOM_TYPES_CACHE) return null;
  const s = String(val||"").trim().toLowerCase();
  return ROOM_TYPES_CACHE.find(t => t.key === s || t.label.toLowerCase() === s) || null;
}

// ------ เปิด/ปิดโมดัล ------
const roomsAddBtn   = document.querySelector("#rooms-section .add-tenant-btn");
const roomModal     = document.getElementById("room-modal");
const roomForm      = document.getElementById("room-form");
const roomTitle     = document.getElementById("room-modal-title");
const roomTypeSel   = document.getElementById("room-type-select");
const roomRentInput = document.getElementById("room-rent-display");

function openRoomModal(mode, data) {
  roomForm.reset();
  roomForm.elements["id"].value = data?.id || "";
  roomForm.elements["room_number"].value = data?.room_number || "";
  roomTitle.textContent = mode === "edit" ? "แก้ไขห้อง" : "เพิ่มห้อง";
  roomModal.classList.remove("hidden");
  // เติม dropdown + sync ราคา
  loadRoomTypes().then(types => {
    roomTypeSel.innerHTML = "";
    types.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.key;
      opt.textContent = `${t.label} (${t.rent.toLocaleString("th-TH")} บาท)`;
      roomTypeSel.appendChild(opt);
    });
    // เลือกค่าเริ่มต้น
    const def = data?.type ? findTypeByAny(data.type) : types[0];
    roomTypeSel.value = def?.key || types[0].key;
    roomRentInput.value = (def?.rent || types[0].rent).toFixed(0);
  });
}
function closeRoomModal() { roomModal.classList.add("hidden"); }

document.querySelector("[data-close-room]")?.addEventListener("click", closeRoomModal);
roomsAddBtn?.addEventListener("click", () => openRoomModal("add"));

// sync ราคาเมื่อเปลี่ยนประเภท
roomTypeSel?.addEventListener("change", () => {
  const tp = findTypeByAny(roomTypeSel.value);
  roomRentInput.value = tp ? tp.rent.toFixed(0) : "";
});

// submit เพิ่ม/แก้ไข
roomForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = roomForm.elements["id"].value.trim();
  const payload = {
    room_number: roomForm.elements["room_number"].value.trim(),
    type: roomTypeSel.value, // ส่ง key ไปให้ backend
  };
  if (!payload.room_number) return alert("กรอกเลขที่ห้องก่อนครับ");

  try {
    const url = id ? `/api/owner/rooms/${id}` : `/api/owner/rooms`;
    const method = id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || "บันทึกไม่สำเร็จ");

    alert("บันทึกสำเร็จ");
    closeRoomModal();
    fetchRoomsFromAPI && fetchRoomsFromAPI();
  } catch (err) {
    alert(err.message || "เกิดข้อผิดพลาด");
  }
});

// delegate ปุ่มแก้ไข/ลบ ในตาราง
document.querySelector("#rooms-section .tenant-table tbody")?.addEventListener("click", async (e) => {
  const btnEdit = e.target.closest(".btn-edit-room");
  const btnDel  = e.target.closest(".btn-del-room");
  if (btnEdit) {
    const data = JSON.parse(btnEdit.getAttribute("data-room") || "{}");
    openRoomModal("edit", data);
  }
  if (btnDel) {
    const id = btnDel.getAttribute("data-id");
    if (!id) return;
    if (!confirm("ยืนยันลบห้องนี้?")) return;
    try {
      const res = await fetch(`/api/owner/rooms/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "ลบไม่สำเร็จ");
      alert("ลบสำเร็จ");
      fetchRoomsFromAPI && fetchRoomsFromAPI();
    } catch (err) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  }
});

/* ---------- bootstrapping & events ---------- */
document.addEventListener("DOMContentLoaded", () => {
  fetchUserInfo();
  updateDashboard();
  refreshOverviewExtras();
  setInterval(()=>{updateDashboard(); refreshOverviewExtras();}, 300000);
  fetchTenantsFromAPI();
  fetchRoomsFromAPI();
  setupAccountingFilters();
  fetchAccountingData();
  fetchRepairsFromAPI();
  fetchContractsFromAPI();
  setupBillingFilters();
  fetchBillingData();

  const navItems = document.querySelectorAll(".sidebar-nav li");
  const contentSections = document.querySelectorAll(".content-section");
  const mainHeader = document.getElementById("main-header");
  const annForm = document.getElementById("announcement-form");


  
if (annForm) {
  annForm.addEventListener("submit", handleAnnouncementSubmit);
  // Preload room options shortly after initial render
  setTimeout(loadAnnouncementRooms, 50);
}
// Load rooms when user navigates to the announcements section
document.getElementById("nav-announcements")?.addEventListener("click", () => {
  loadAnnouncementRooms();
});
// Quick actions
  document.getElementById("qa-add-tenant")?.addEventListener("click", () => {
    document.getElementById("nav-tenants")?.click();
    setTimeout(()=>{ document.querySelector("#tenants-section .add-tenant-btn")?.click(); }, 200);
  });
  document.getElementById("qa-create-bills")?.addEventListener("click", () => {
    document.getElementById("nav-billing")?.click();
  });
  document.getElementById("qa-send-ann")?.addEventListener("click", () => {
    document.getElementById("nav-announcements")?.click();
    document.getElementById("announcement-form")?.scrollIntoView({behavior:"smooth"});
  });


  // contracts actions (delete)
  const contractsSection = document.getElementById('contracts-section');
  if (contractsSection) {
    contractsSection.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.delete-contract-btn');
      if (delBtn) {
        e.preventDefault();
        const row = e.target.closest('tr');
        const contractId = row?.dataset.id;
        const tenantName = row?.cells?.[1]?.textContent || "";
        if (contractId && confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสัญญาของ ${tenantName}?`)) {
          deleteContract(contractId);
        }
      }
    });
  }

  async function deleteContract(contractId) {
    try {
      const response = await fetch(`/api/owner/leases/${contractId}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok && result.success) {
        alert('ลบสัญญาสำเร็จ');
        fetchContractsFromAPI();
      } else {
        throw new Error(result.error || 'ไม่สามารถลบสัญญาได้');
      }
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  }

  if (annForm) annForm.addEventListener("submit", handleAnnouncementSubmit);

  // single navigation handler (with lazy-load)
  navItems.forEach((navItem) => {
    navItem.addEventListener("click", (e) => {
      e.preventDefault();
      navItems.forEach((item) => item.classList.remove("active"));
      navItem.classList.add("active");

      let targetSectionId = navItem.id.replace("nav-", "") + "-section";
      if (navItem.id === "nav-repairs" && !document.getElementById("repairs-section")) {
        targetSectionId = "repair-section";
      }

      contentSections.forEach((sec) => {
        if (sec.id === targetSectionId) sec.classList.remove("hidden");
        else sec.classList.add("hidden");
      });

      const mapHeader = {
        "nav-overview": "ภาพรวม",
        "nav-tenants": "จัดการผู้เช่า",
        "nav-rooms": "จัดการห้องพัก",
        "nav-accounting": "บัญชีและการเงิน",
        "nav-repairs": "รายการแจ้งซ่อม",
        "nav-contracts": "จัดการสัญญาเช่า",
        "nav-announcements": "ประกาศ/ข่าวสาร",
        "nav-billing": "ค่าเช่า/ค่าน้ำ/ค่าไฟ",
        "nav-reports": "รายงานและสถิติ",
        "nav-bookings": "คำขอจอง",
      "nav-settings":"ตั้งค่า","nav-wizard":"ย้ายเข้า/ย้ายออก"};
      if (mainHeader) mainHeader.textContent = mapHeader[navItem.id] || "";

      // Lazy-load per section
      if (targetSectionId === "contracts-section")       fetchContractsFromAPI();
      else if (targetSectionId === "tenants-section")    fetchTenantsFromAPI();
      else if (targetSectionId === "rooms-section")      fetchRoomsFromAPI();
      else if (targetSectionId === "accounting-section") fetchAccountingData();
      else if (targetSectionId === "settings-section") loadSettingsSection();
      else if (targetSectionId === "reports-section") loadReportsSection();
      else if (targetSectionId === "bookings-section") fetchBookingsFromAPI();
      else if (targetSectionId === "wizard-section") loadWizardSection();
      else if (targetSectionId === "billing-section")    fetchBillingData();
      else if (targetSectionId === "bookings-section") fetchBookingsFromAPI();
      else if (targetSectionId === "repair-section" || targetSectionId === "repairs-section") fetchRepairsFromAPI();
    // Lazy-load per section
      if (targetSectionId === "contracts-section")       fetchContractsFromAPI();
      else if (targetSectionId === "tenants-section")    fetchTenantsFromAPI();
      else if (targetSectionId === "rooms-section")      fetchRoomsFromAPI();
      else if (targetSectionId === "accounting-section") fetchAccountingData();
      else if (targetSectionId === "billing-section")    fetchBillingData();
      else if (targetSectionId === "bookings-section") fetchBookingsFromAPI();
      else if (targetSectionId === "repair-section" || targetSectionId === "repairs-section") fetchRepairsFromAPI();
    });
  });

  

  // default tab
  const defaultNav = document.getElementById("nav-overview");
  if (defaultNav) defaultNav.click();

  const navTenants = document.getElementById("nav-tenants");
  if (navTenants) {
    navTenants.addEventListener("click", () => {
      // สลับ active ที่ sidebar
      document.querySelectorAll(".sidebar-nav li").forEach(li => li.classList.remove("active"));
      navTenants.classList.add("active");

      // ซ่อนทุก section แล้วเปิด tenants-section
      document.querySelectorAll(".content-section").forEach(sec => sec.classList.add("hidden"));
      const sec = document.getElementById("tenants-section");
      if (sec) sec.classList.remove("hidden");

      // เปลี่ยนหัวข้อหลัก
      const h = document.getElementById("main-header");
      if (h) h.textContent = "จัดการผู้เช่า";

      // โหลดรายชื่อผู้เช่า
      fetchTenantsFromAPI(); // ฟังก์ชันนี้มีอยู่แล้วในไฟล์เดิม:contentReference[oaicite:2]{index=2}
    });
  }

  // accounting actions
  const accSection = document.getElementById("accounting-section");
  if (accSection) accSection.addEventListener("click", handleAccountingClick);

  // repairs filter & status updates
  const repairListContainer = document.querySelector(".repair-list");
  if (repairListContainer) {
    repairListContainer.addEventListener("change", handleRepairStatusUpdate);
  }

  const repairFilter = document.getElementById("repair-status-filter");
  if (repairFilter && !repairFilter._repairFilterBound) {
    repairFilter.addEventListener("change", () => { if (typeof applyRepairFilters === "function") applyRepairFilters(); });
    repairFilter._repairFilterBound = true;
  }

  // billing modal & form
  const closeBtn = document.querySelector("#billing-modal .close-modal-btn");
  if (closeBtn) closeBtn.addEventListener("click", closeBillingModal);
  if (billingModal) {
    billingModal.addEventListener("click", (e) => { if (e.target === billingModal) closeBillingModal(); });
  }
  const billingForm = document.getElementById("billing-details-form");
  if (billingForm) {
    billingForm.addEventListener("input", (e) => { if (e.target.type === "number") recalcModalTotals(); });
    billingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      console.log("Saving bill data:", data);
      alert("บันทึกข้อมูลและแจ้งยอดสำเร็จ (จำลอง)");
      closeBillingModal();
      fetchBillingData();
    });
  }
});
(function(){
  var sel = document.getElementById('repair-status-filter');
  if (sel && !sel._repairFilterBound) {
    sel.addEventListener('change', function(e){
      var v = (e.target.value || 'all').replace('-', '');
      var cards = document.querySelectorAll('.repair-card');
      cards.forEach(function(card){
        var st = ((card.dataset && card.dataset.status) || '').replace('-', '');
        card.style.display = (v === 'all' || v === st) ? '' : 'none';
      });
    });
    sel._repairFilterBound = true;
  }
})();

function setupAccountingFilters() {
  const mSel = document.getElementById("acc-month-filter");
  const ySel = document.getElementById("acc-year-filter");
  if(!mSel || !ySel) return;

  // เติมเดือน 01–12 พร้อมชื่อไทย
  const th = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  mSel.innerHTML = "";
  for (let i = 1; i <= 12; i++) {
    const mm = String(i).padStart(2, "0");
    const opt = document.createElement("option");
    opt.value = mm; opt.textContent = `${mm} - ${th[i-1]}`;
    mSel.appendChild(opt);
  }

  // เติมปี ย้อนหลัง/ล่วงหน้า 2 ปี (ปรับตามต้องการ)
  const now = new Date();
  const thisYear = now.getFullYear();
  ySel.innerHTML = "";
  for (let y = thisYear + 1; y >= thisYear - 2; y--) {
    const opt = document.createElement("option");
    opt.value = y; opt.textContent = String(y);
    ySel.appendChild(opt);
  }

  // ตั้งค่าเริ่มต้น=เดือน/ปีปัจจุบัน
  mSel.value = String(now.getMonth() + 1).padStart(2, "0");
  ySel.value = String(thisYear);

  // เปลี่ยนค่าแล้วโหลดใหม่
  mSel.addEventListener("change", fetchAccountingData);
  ySel.addEventListener("change", fetchAccountingData);
}


document.addEventListener("DOMContentLoaded", () => {
  // ค้นหา/กรองผู้เช่า
  const section = document.getElementById("tenants-section");
  const qInput = section?.querySelector(".search-tenant input");
  const statusSel = document.getElementById("tenant-status-filter");
  if (qInput)  qInput.addEventListener("input", () => fetchTenantsFromAPI());
  if (statusSel) statusSel.addEventListener("change", () => fetchTenantsFromAPI());

  // เดเลเกตปุ่มจัดการในตาราง
  const tbody = section?.querySelector(".tenant-table tbody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button.icon-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.classList.contains("edit-tenant")) return openEditTenantModal(id);
      if (btn.classList.contains("move-room"))   return openMoveRoomModal(id, btn.dataset.room || null);
      if (btn.classList.contains("move-out"))    return openMoveOutModal(id);
      if (btn.classList.contains("view-bills"))  return openBillsModal(id);
    });
  }
});


// ===== Modals Handlers (Edit / Move Room / Move Out / Bills) =====
const editTenantModal = document.getElementById("edit-tenant-modal");
const editTenantForm  = document.getElementById("edit-tenant-form");
const moveRoomModal   = document.getElementById("move-room-modal");
const moveRoomForm    = document.getElementById("move-room-form");
const moveOutModal    = document.getElementById("moveout-modal");
const moveOutForm     = document.getElementById("moveout-form");
const billsModal      = document.getElementById("bills-modal");
const billsListEl     = document.getElementById("bills-list");

document.querySelector("[data-close-edit]")?.addEventListener("click", ()=>{ editTenantModal.classList.add("hidden"); });
document.querySelector("[data-close-move-room]")?.addEventListener("click", ()=>{ moveRoomModal.classList.add("hidden"); });
document.querySelector("[data-close-moveout]")?.addEventListener("click", ()=>{ moveOutModal.classList.add("hidden"); });
document.querySelector("[data-close-bills]")?.addEventListener("click", ()=>{ billsModal.classList.add("hidden"); });

function openEditTenantModal(id) {
  editTenantForm.reset();
  editTenantModal.classList.remove("hidden");
  fetch(`/api/owner/tenants/${id}`)
    .then(r=>r.json())
    .then(data=>{
      if (data && data.id) {
        editTenantForm.querySelector('input[name="id"]').value = data.id;
        editTenantForm.querySelector('input[name="name"]').value = data.name || "";
        editTenantForm.querySelector('input[name="email"]').value = data.email || "";
        editTenantForm.querySelector('input[name="phone"]').value = data.phone || "";
      } else {
        alert("ไม่พบข้อมูลผู้เช่า");
      }
    })
    .catch(()=> alert("โหลดข้อมูลผู้เช่าล้มเหลว"));
}

editTenantForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(editTenantForm);
  const id = fd.get("id");
  const payload = Object.fromEntries(fd.entries());
  delete payload.id;
  if (!payload.password) delete payload.password;
  const res = await fetch(`/api/owner/tenants/${id}`, {
    method: "PUT",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    alert(json.error || "อัปเดตผู้เช่าไม่สำเร็จ");
    return;
  }
  alert("บันทึกสำเร็จ");
  editTenantModal.classList.add("hidden");
  fetchTenantsFromAPI();
  updateDashboard && updateDashboard();
});

function openMoveRoomModal(id, currentRoomId) {
  moveRoomForm.reset();
  moveRoomForm.querySelector('input[name="id"]').value = id;
  const sel = document.getElementById("move-room-select");
  sel.innerHTML = '<option value="">กำลังโหลด...</option>';
  moveRoomModal.classList.remove("hidden");
  fetch("/api/owner/available-rooms")
    .then(r=>r.json()).then(rooms=>{
      sel.innerHTML = "";
      if (Array.isArray(rooms) && rooms.length) {
        rooms.forEach(r=>{
          const opt = document.createElement("option");
          opt.value = r.id;
          opt.textContent = `ห้อง ${r.room_number}`;
          // ไม่แสดงห้องเดียวกับปัจจุบัน
          if (String(r.id) === String(currentRoomId||"")) opt.disabled = true;
          sel.appendChild(opt);
        });
      } else {
        sel.innerHTML = '<option value="">— ไม่มีห้องว่าง —</option>';
      }
    }).catch(()=>{
      sel.innerHTML = '<option value="">— โหลดห้องไม่สำเร็จ —</option>';
    });
}

moveRoomForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd = new FormData(moveRoomForm);
  const id = fd.get("id");
  const newRoomId = fd.get("newRoomId");
  if (!newRoomId) return alert("กรุณาเลือกห้องใหม่");
  const res = await fetch(`/api/owner/tenants/${id}/move-room`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ newRoomId })
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    return alert(json.error || "ย้ายห้องไม่สำเร็จ");
  }
  alert("ย้ายห้องสำเร็จ");
  moveRoomModal.classList.add("hidden");
  fetchTenantsFromAPI();
  fetchRoomsFromAPI && fetchRoomsFromAPI();
  updateDashboard && updateDashboard();
});

function openMoveOutModal(id) {
  moveOutForm.reset();
  moveOutForm.querySelector('input[name="id"]').value = id;
  moveOutModal.classList.remove("hidden");
}

moveOutForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd = new FormData(moveOutForm);
  const id = fd.get("id");
  const payload = Object.fromEntries(fd.entries());
  payload.createFinalBill = !!payload.createFinalBill;
  // แปลง number
  if (payload.finalAmount) payload.finalAmount = Number(payload.finalAmount);
  const res = await fetch(`/api/owner/tenants/${id}/move-out`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    return alert(json.error || "ดำเนินการย้ายออกไม่สำเร็จ");
  }
  alert("ดำเนินการย้ายออกสำเร็จ");
  moveOutModal.classList.add("hidden");
  fetchTenantsFromAPI();
  fetchRoomsFromAPI && fetchRoomsFromAPI();
  updateDashboard && updateDashboard();
});

// Bills history
function openBillsModal(id) {
  billsModal.classList.remove("hidden");
  billsListEl.innerHTML = '<div class="muted">กำลังโหลด...</div>';
  fetch(`/api/owner/tenants/${id}/payments`)
    .then(r=>r.json())
    .then(j=>{
      const arr = j.payments || [];
      if (arr.length === 0) {
        billsListEl.innerHTML = '<div class="muted">ไม่พบบิลในระบบ</div>';
        return;
      }
      const ul = document.createElement("ul");
      ul.className = "simple-list";
      arr.forEach(p=>{
        const li = document.createElement("li");
        li.innerHTML = `<div><strong>ครบกำหนด</strong> ${safeText(p.dueDate || "-")}</div>
                        <div><strong>ยอด</strong> ${Number(p.amount||0).toLocaleString("th-TH", {minimumFractionDigits:2})} บาท</div>
                        <div><strong>สถานะ</strong> ${safeText(p.status)}</div>`;
        ul.appendChild(li);
      });
      billsListEl.innerHTML = "";
      billsListEl.appendChild(ul);
    })
    .catch(()=>{
      billsListEl.innerHTML = '<div style="color:red;">โหลดประวัติบิลไม่สำเร็จ</div>';
    });
}


// ===== Settings (utility rates + room types) =====
async function loadSettingsSection() {
  // Load rates
  try {
    const res = await fetch("/api/owner/config/utility-rates");
    if (res.ok) {
      const json = await res.json();
      const f = document.getElementById("utility-rate-form");
      if (f) {
        f.water.value = json.water ?? 18;
        f.elec.value = json.elec ?? 8;
        f.notes.value = json.notes ?? "";
      }
    }
  } catch {}
  // Load room types
  refreshRoomTypesTable();
}

document.getElementById("utility-rate-form")?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = { water: Number(fd.get("water")), elec: Number(fd.get("elec")), notes: fd.get("notes") };
  const res = await fetch("/api/owner/config/utility-rates", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  if (res.ok) alert("บันทึกอัตราสำเร็จ"); else alert("บันทึกไม่สำเร็จ");
});

async function refreshRoomTypesTable() {
  const tbody = document.querySelector("#room-types-table tbody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">กำลังโหลด...</td></tr>';
  const res = await fetch("/api/owner/config/room-types");
  const json = res.ok ? await res.json() : { types: [] };
  const list = json.types || [];
  tbody.innerHTML = "";
  list.forEach(rt => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${rt.key}</td><td>${rt.label}</td><td>${(rt.base_rent||0).toLocaleString("th-TH")}</td><td>${rt.is_active? "ใช้งาน":"ปิด"}</td>
      <td>
        <button class="btn btn-secondary" data-action="edit" data-id="${rt.id}">แก้ไข</button>
        <button class="btn btn-danger" data-action="del" data-id="${rt.id}">ปิดใช้งาน</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById("room-type-form")?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.base_rent = Number(payload.base_rent);
  const res = await fetch("/api/owner/config/room-types", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  if (res.ok) { e.target.reset(); refreshRoomTypesTable(); } else { alert("เพิ่มไม่สำเร็จ"); }
});

document.getElementById("room-types-table")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === "del") {
        if (!confirm("ปิดใช้งานประเภทนี้?")) return;
        const res = await fetch(`/api/owner/config/room-types/${id}`, {
            method: "DELETE"
        });
        if (res.ok) {
            refreshRoomTypesTable();
        } else {
            alert("ลบไม่สำเร็จ");
        }
    } else if (action === "edit") {
        const newLabel = prompt("ชื่อใหม่:");
        const newRent = prompt("ค่าเช่าใหม่:");

        if (newLabel !== null || newRent !== null) {
            const payload = {
                label: newLabel || undefined,
                base_rent: newRent ? Number(newRent) : undefined
            };
            const res = await fetch(`/api/owner/config/room-types/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                refreshRoomTypesTable();
            } else {
                alert("ปรับปรุงไม่สำเร็จ");
            }
        }
    }
});

// ===== Reports =====
async function loadReportsSection() {
  try {
    const res = await fetch("/api/owner/reports/summary");
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    const json = await res.json();

    // occupancy
    const oc = json.rooms || { total: 0, occupied: 0 };
    const div = document.getElementById("report-occupancy");
    if (div) {
      const rate = oc.total ? Math.round((oc.occupied / oc.total) * 100) : 0;
      div.innerHTML = `<strong>อัตราการครอบครอง:</strong> ${oc.occupied}/${oc.total} ห้อง (${rate}%)`;
    }

    // revenue
    const tbody = document.getElementById("report-revenue-body");
    if (tbody) {
      const rows = json.revenue || [];
      tbody.innerHTML = rows.map(r => {
        const rev = (r.revenue || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
        return `<tr><td>${r.ym}</td><td>${rev}</td></tr>`;
      }).join("");
    }
  } catch (err) {
    console.error("Error loading reports:", err);
    // กันหน้าเว็บว่างเปล่า → แสดงข้อความแทน
    const div = document.getElementById("report-occupancy");
    if (div) div.innerHTML = `<span style="color:red;">ไม่สามารถโหลดรายงานได้</span>`;
    const tbody = document.getElementById("report-revenue-body");
    if (tbody) tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:red;">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
  }
}


// ===== Wizard =====
async function loadWizardSection() {
  // Tenants without room
  try {
    const resTen = await fetch("/api/owner/tenants?q=&status=all");
    if (!resTen.ok) throw new Error(`HTTP ${resTen.status}`);
    const jsonTen = await resTen.json();
    const selTen = document.getElementById("movein-tenant");
    if (selTen) {
      selTen.innerHTML = "";
      (jsonTen.tenants || [])
        .filter(t => !t.roomId)
        .forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = `${t.name} (${t.email || ""})`;
          selTen.appendChild(opt);
        });
      if (selTen.options.length === 0) {
        selTen.innerHTML = '<option>— ไม่มีผู้เช่าที่ว่าง —</option>';
      }
    }
  } catch (err) {
    console.error("โหลด tenants ไม่สำเร็จ:", err);
    const selTen = document.getElementById("movein-tenant");
    if (selTen) selTen.innerHTML = '<option style="color:red;">เกิดข้อผิดพลาดในการโหลด</option>';
  }

  // Rooms available
  try {
    const resRoom = await fetch("/api/owner/available-rooms");
    if (!resRoom.ok) throw new Error(`HTTP ${resRoom.status}`);
    const list = await resRoom.json();
    const selRoom = document.getElementById("movein-room");
    if (selRoom) {
      selRoom.innerHTML = "";
      list.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.room_number;
        selRoom.appendChild(opt);
      });
      if (selRoom.options.length === 0) {
        selRoom.innerHTML = '<option>— ไม่มีห้องว่าง —</option>';
      }
    }
  } catch (err) {
    console.error("โหลด rooms ไม่สำเร็จ:", err);
    const selRoom = document.getElementById("movein-room");
    if (selRoom) selRoom.innerHTML = '<option style="color:red;">เกิดข้อผิดพลาดในการโหลด</option>';
  }

  // Active leases for move-out
  try {
    const resLease = await fetch("/api/owner/leases");
    if (!resLease.ok) throw new Error(`HTTP ${resLease.status}`);
    const data = await resLease.json();
    const sel = document.getElementById("moveout-lease");
    const leases = Array.isArray(data) ? data : (data.leases || []);
leases
  .filter(l => (l.status || "").toLowerCase() === "active")
  .forEach(/* เติม option */);
    if (sel) {
      sel.innerHTML = "";
      (data.leases || [])
        .filter(l => (l.status || "").toLowerCase() === "active")
        .forEach(l => {
          const opt = document.createElement("option");
          opt.value = l.id;
          opt.textContent = `ห้อง ${l.room_number} - ${l.tenant_name}`;
          sel.appendChild(opt);
        });
      if (sel.options.length === 0) {
        sel.innerHTML = '<option>— ไม่มีสัญญาที่ active —</option>';
      }
    }
  } catch (err) {
    console.error("โหลด leases ไม่สำเร็จ:", err);
    const sel = document.getElementById("moveout-lease");
    if (sel) sel.innerHTML = '<option style="color:red;">เกิดข้อผิดพลาดในการโหลด</option>';
  }
}


document.getElementById("move-in-form")?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const res = await fetch("/api/owner/move-in", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  const j = await res.json();
  if (res.ok && j.success) { alert("ย้ายเข้าสำเร็จ"); loadWizardSection(); fetchRoomsFromAPI?.(); fetchTenantsFromAPI?.(); }
  else alert(j.error||"ไม่สำเร็จ");
});

document.getElementById("move-out-form")?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const res = await fetch("/api/owner/move-out", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  const j = await res.json();
  if (res.ok && j.success) { alert("ย้ายออกสำเร็จ"); loadWizardSection(); fetchRoomsFromAPI?.(); fetchTenantsFromAPI?.(); }
  else alert(j.error||"ไม่สำเร็จ");
});

async function fetchBookingsFromAPI() {
  const statusEl = document.getElementById("bk-status");
  const qEl = document.getElementById("bk-q");
  const tbody = document.getElementById("bk-tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="muted">กำลังโหลด...</td></tr>`;

  const status = statusEl ? statusEl.value : "all";
  const q = qEl ? qEl.value : "";

  try {
    const res = await fetch(`/api/owner/bookings?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!res.ok || !data?.success) {
      throw new Error(data?.error || "load_failed");
    }

    const rows = data.data || [];

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">ไม่พบรายการ</td></tr>`;
      return;
    }

    const html = rows.map(row => {
      const contact = [
        row.phone ? `📞 ${row.phone}` : "",
        row.email ? `✉️ ${row.email}` : "",
        row.line_id ? `LINE: ${row.line_id}` : ""
      ].filter(Boolean).join("<br>");

      const detail = [
        `ประเภท: ${row.room_type}`,
        `โซน/ห้อง: ${row.zone || "-"}${row.room_no ? " / " + row.room_no : ""}`,
        `ย้ายเข้า: ${row.move_in_date} | ${row.duration_months} เดือน`,
        `ผู้พัก: ${row.occupants} | ยานพาหนะ: ${row.vehicle || "ไม่มี"}`,
        row.contact_time ? `ติดต่อกลับ: ${row.contact_time}` : "",
        row.note ? `หมายเหตุ: ${row.note}` : "",
        row.scheduled_at ? `นัดหมาย: ${row.scheduled_at}` : ""
      ].filter(Boolean).join("<br>");

      const actions = `
        <button class="btn-xs bk-schedule" data-id="${row.id}">นัดหมาย</button>
        <button class="btn-xs bk-note" data-id="${row.id}">โน้ต</button>
        <button class="btn-xs bk-convert" data-id="${row.id}">แปลงเป็นผู้เช่า</button>
        <button class="btn-xs bk-deposit" data-id="${row.id}" data-tenant="${row.tenant_id || ''}">มัดจำ</button>
      `;

      return `
        <tr>
          <td>${(row.created_at || "").replace("T", " ").slice(0, 16)}</td>
          <td>${row.full_name}</td>
          <td>${contact}</td>
          <td>${detail}</td>
          <td>${actions}</td>
        </tr>`;
    }).join("");

    tbody.innerHTML = html;

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" class="muted">โหลดรายการไม่สำเร็จ</td></tr>`;
  }
}

fetchBookingsFromAPI();


document.getElementById("nav-bookings")?.addEventListener("click", () => {
  setTimeout(() => fetchBookingsFromAPI(), 50);
});
document.getElementById("bk-status")?.addEventListener("change", fetchBookingsFromAPI);
document.getElementById("bk-q")?.addEventListener("input", () => {
  clearTimeout(window.__bk_t);
  window.__bk_t = setTimeout(fetchBookingsFromAPI, 250);
});
