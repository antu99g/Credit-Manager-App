const API_URL =
  "https://script.google.com/macros/s/AKfycby45VFbW5oC4A8iUIxiHbBblW1JCWHAu_635ET48iUaKoh8LWNGRDhXa7UO4jOShjKT/exec";

let currentTab = "w";
let customersData = [];
let currentCustomer = null;

// --- INITIALIZATION & HARDWARE BACK BUTTON ---
window.onload = () => {
  // Set initial browser history state for hardware back button
  history.replaceState({ screen: "home" }, "");
  loadCustomers();
};

window.addEventListener("popstate", (e) => {
  // If user presses physical back button while on details screen
  if (currentCustomer) {
    document.getElementById("details-screen").classList.remove("active");
    document.getElementById("home-screen").classList.add("active");
    currentCustomer = null;
    closeModals();
    renderCustomerList(); // Refresh home list instantly
  }
});

// --- API HELPER FUNCTION ---
async function apiCall(action, data = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      cache: "no-store",
      body: JSON.stringify({ action: action, ...data }),
    });
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return { status: "error", data: [] };
  }
}

// --- DATA LOADING & RENDERING ---
async function loadCustomers() {
  showLoader();
  try {
    const response = await apiCall("getCustomers");
    if (response.status === "success") customersData = response.data || [];
    else customersData = [];
    renderCustomerList();
  } catch (e) {
    console.error(e);
  } finally {
    hideLoader();
  }
}

function renderCustomerList() {
  const listContainer = document.getElementById("customer-list");
  listContainer.innerHTML = "";
  const filteredCustomers = customersData.filter((c) => c.type === currentTab);

  if (filteredCustomers.length === 0) {
    listContainer.innerHTML =
      '<p style="text-align:center; margin-top:20px; color:#888;">No customers found.</p>';
    return;
  }

  filteredCustomers.forEach((cust) => {
    const bgColor = getDefaulterColor(
      cust.lastTransactionDate,
      cust.currentDue,
    );

    // Format the last transaction date instead of showing mobile number
    let dateStr = "";
    if (cust.lastTransactionDate) {
      const dateObj = new Date(cust.lastTransactionDate);
      dateStr = `Last Transaction: ${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
    } else {
      dateStr = "No transactions yet";
    }

    const card = document.createElement("div");
    card.className = `card ${bgColor}`;
    card.onclick = () => openCustomerDetails(cust.customerId);

    card.innerHTML = `
      <h4>${cust.name}</h4>
      <div class="card-row">
        <span style="color: #666; font-size: 13px;">${dateStr}</span>
        <span class="due-text">₹ ${cust.currentDue}</span>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

function getDefaulterColor(lastTxnDate, currentDue) {
  // If due is 0 OR they have never had a transaction, background is white
  if (currentDue <= 0 || !lastTxnDate) return "bg-white";

  const now = new Date().getTime();
  const daysOverdue = (now - lastTxnDate) / (1000 * 60 * 60 * 24);

  // Updated time periods for defaulters
  if (daysOverdue >= 365) return "bg-red"; // More than 1 year
  if (daysOverdue >= 180) return "bg-yellow"; // More than 6 months
  return "bg-white";
}

function switchTab(type) {
  currentTab = type;
  document.getElementById("tab-w").classList.toggle("active", type === "w");
  document.getElementById("tab-r").classList.toggle("active", type === "r");
  document.getElementById("add-customer-btn").innerText =
    type === "w" ? "+ Add Wholesaler" : "+ Add Retailer";
  renderCustomerList();
}

// --- CUSTOMER DETAILS & TRANSACTIONS ---
async function openCustomerDetails(customerId) {
  currentCustomer = customersData.find((c) => c.customerId === customerId);

  // Push state to browser history so phone back button works
  history.pushState({ screen: "details" }, "");

  updateCustomerHeaderUI();

  document.getElementById("home-screen").classList.remove("active");
  document.getElementById("details-screen").classList.add("active");

  showLoader();
  try {
    const response = await apiCall("getTransactions", {
      customerId: customerId,
    });
    if (response.status === "success") renderTransactions(response.data || []);
    else renderTransactions([]);
  } catch (e) {
    console.error(e);
  } finally {
    hideLoader();
  }
}

function updateCustomerHeaderUI() {
  document.getElementById("detail-name").innerText = currentCustomer.name;
  document.getElementById("detail-mobile").innerText =
    currentCustomer.mobile || ""; // hide if blank
  document.getElementById("detail-due").innerText =
    `₹ ${currentCustomer.currentDue}`;
}

function renderTransactions(transactions) {
  const listContainer = document.getElementById("transaction-list");
  listContainer.innerHTML = "";

  if (!transactions || transactions.length === 0) {
    listContainer.innerHTML =
      '<p style="text-align:center; margin-top:20px; color:#888;">No transactions yet.</p>';
    return;
  }

  transactions.sort((a, b) => b.date - a.date);

  transactions.forEach((txn) => {
    const dateObj = new Date(txn.date);
    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

    let paidDisplay = `Paid: ₹ 0`;
    if (txn.paid > 0) {
      const methodStr = txn.paymentMethod ? `${txn.paymentMethod} ` : "";
      paidDisplay = `<span style="color: green; font-weight: bold;">${methodStr}₹ ${txn.paid}</span>`;
    }

    // Only create the remarks HTML if the user actually typed something
    const remarksHTML = txn.remarks
      ? `<div style="color: #777; font-size: 13px; margin-top: 8px; font-style: italic;">Note: ${txn.remarks}</div>`
      : "";

    const card = document.createElement("div");
    card.className = "card bg-white";
    card.innerHTML = `
      <div class="card-row" style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px;">
        <strong>Date: ${dateStr}</strong>
        <span class="due-text">Due: ₹ ${txn.dueAfterTransaction}</span>
      </div>
      <div class="card-row">
        <span>Goods: ₹ ${txn.goods}</span>
        ${paidDisplay}
      </div>
      ${remarksHTML} 
    `;
    listContainer.appendChild(card);
  });
}

function goBack() {
  history.back(); // This will trigger the popstate event above, just like the hardware button
}

// --- MODALS & FORM SAVING ---
function openAddCustomerModal() {
  document.getElementById("add-customer-title").innerText =
    currentTab === "w" ? "Add Wholesaler" : "Add Retailer";
  document.getElementById("new-cust-name").value = "";
  document.getElementById("new-cust-mobile").value = "";
  document.getElementById("add-customer-modal").classList.add("active");
}

function openAddTxnModal() {
  document.getElementById("new-txn-goods").value = "";
  document.getElementById("new-txn-paid").value = "";
  document.getElementById("new-txn-method").value = "Cash"; // Reset default
  document.getElementById("new-txn-remarks").value = ""; // Reset remarks
  document.getElementById("add-txn-modal").classList.add("active");
}

function closeModals() {
  document.getElementById("add-customer-modal").classList.remove("active");
  document.getElementById("add-txn-modal").classList.remove("active");
}

async function saveCustomer() {
  const name = document.getElementById("new-cust-name").value.trim();
  const mobile = document.getElementById("new-cust-mobile").value.trim(); // Now optional

  if (!name) return alert("Please enter a name.");

  showLoader();
  closeModals();

  const response = await apiCall("addCustomer", {
    data: { name: name, mobile: mobile, type: currentTab },
  });

  if (response.status === "success") {
    await loadCustomers();
  } else hideLoader();
}

async function saveTransaction() {
  const goods = document.getElementById("new-txn-goods").value || 0;
  const paid = document.getElementById("new-txn-paid").value || 0;
  const method = document.getElementById("new-txn-method").value;
  const remarks = document.getElementById("new-txn-remarks").value.trim(); // Get remarks

  if (goods == 0 && paid == 0) return alert("Please enter an amount.");

  showLoader();
  closeModals();

  const response = await apiCall("addTransaction", {
    data: {
      customerId: currentCustomer.customerId,
      goods: goods,
      paid: paid,
      paymentMethod: method,
      remarks: remarks, // Send remarks to backend
    },
  });

  if (response.status === "success") {
    currentCustomer.currentDue = response.data.newDue;
    currentCustomer.lastTransactionDate = new Date().getTime();
    updateCustomerHeaderUI();

    const txnsResponse = await apiCall("getTransactions", {
      customerId: currentCustomer.customerId,
    });
    if (txnsResponse.status === "success")
      renderTransactions(txnsResponse.data || []);
  }

  hideLoader();
}

function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}
function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}