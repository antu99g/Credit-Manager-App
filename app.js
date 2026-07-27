// Paste your Google Apps Script Web App URL here inside the quotes
const API_URL =
  "https://script.google.com/macros/s/AKfycby45VFbW5oC4A8iUIxiHbBblW1JCWHAu_635ET48iUaKoh8LWNGRDhXa7UO4jOShjKT/exec";

// Global App State
let currentTab = "w"; // 'w' for wholesaler, 'r' for retailer
let customersData = [];
let currentCustomer = null;

// --- INITIALIZATION ---
window.onload = () => {
  loadCustomers();
};

// --- API HELPER FUNCTION ---
async function apiCall(action, data = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: action, ...data }),
    });
    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    alert("Network error. Please check your connection.");
    return { status: "error" };
  }
}

// --- DATA LOADING & RENDERING ---

async function loadCustomers() {
  showLoader();
  const response = await apiCall("getCustomers");
  if (response.status === "success") {
    customersData = response.data;
    renderCustomerList();
  }
  hideLoader();
}

function renderCustomerList() {
  const listContainer = document.getElementById("customer-list");
  listContainer.innerHTML = ""; // Clear current list

  // Filter based on active tab
  const filteredCustomers = customersData.filter((c) => c.type === currentTab);

  filteredCustomers.forEach((cust) => {
    const bgColor = getDefaulterColor(cust.lastPaymentDate, cust.currentDue);

    const card = document.createElement("div");
    card.className = `card ${bgColor}`;
    card.onclick = () => openCustomerDetails(cust.customerId);

    card.innerHTML = `
      <h4>${cust.name}</h4>
      <div class="card-row">
        <span>${cust.mobile}</span>
        <span class="due-text">₹ ${cust.currentDue}</span>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

function getDefaulterColor(lastPaymentDate, currentDue) {
  // If no due amount, they are not a defaulter
  if (currentDue <= 0) return "bg-white";

  const now = new Date().getTime();
  // If they have dues but never paid, treat their last payment as 0 (will trigger red)
  const paymentTime = lastPaymentDate ? lastPaymentDate : 0;

  const daysOverdue = (now - paymentTime) / (1000 * 60 * 60 * 24);

  if (daysOverdue >= 180) return "bg-red"; // 6 months
  if (daysOverdue >= 90) return "bg-yellow"; // 3 months
  return "bg-white";
}

// --- TAB MANAGEMENT ---
function switchTab(type) {
  currentTab = type;

  // Update Tab Styling
  document.getElementById("tab-w").classList.toggle("active", type === "w");
  document.getElementById("tab-r").classList.toggle("active", type === "r");

  // Update Floating Action Button Text
  const fab = document.getElementById("add-customer-btn");
  fab.innerText = type === "w" ? "+ Add Wholesaler" : "+ Add Retailer";

  renderCustomerList();
}

// --- CUSTOMER DETAILS & TRANSACTIONS ---
async function openCustomerDetails(customerId) {
  currentCustomer = customersData.find((c) => c.customerId === customerId);

  // Update header info
  document.getElementById("detail-name").innerText = currentCustomer.name;
  document.getElementById("detail-mobile").innerText = currentCustomer.mobile;
  document.getElementById("detail-due").innerText =
    `₹ ${currentCustomer.currentDue}`;

  // Switch screens
  document.getElementById("home-screen").classList.remove("active");
  document.getElementById("details-screen").classList.add("active");

  // Fetch transactions
  showLoader();
  const response = await apiCall("getTransactions", { customerId: customerId });
  if (response.status === "success") {
    renderTransactions(response.data);
  }
  hideLoader();
}

function renderTransactions(transactions) {
  const listContainer = document.getElementById("transaction-list");
  listContainer.innerHTML = "";

  // Sort latest first
  transactions.sort((a, b) => b.date - a.date);

  transactions.forEach((txn) => {
    const dateObj = new Date(txn.date);
    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

    const card = document.createElement("div");
    card.className = "card bg-white";
    card.innerHTML = `
      <div class="card-row" style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px;">
        <strong>Date: ${dateStr}</strong>
        <span class="due-text">Due: ₹ ${txn.dueAfterTransaction}</span>
      </div>
      <div class="card-row">
        <span>Goods: ₹ ${txn.goods}</span>
        <span style="color: green; font-weight: bold;">Paid: ₹ ${txn.paid}</span>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

function goBack() {
  document.getElementById("details-screen").classList.remove("active");
  document.getElementById("home-screen").classList.add("active");
  currentCustomer = null;
  loadCustomers(); // Refresh the main list to show any updated dues
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
  document.getElementById("add-txn-modal").classList.add("active");
}

function closeModals() {
  document.getElementById("add-customer-modal").classList.remove("active");
  document.getElementById("add-txn-modal").classList.remove("active");
}

async function saveCustomer() {
  const name = document.getElementById("new-cust-name").value.trim();
  const mobile = document.getElementById("new-cust-mobile").value.trim();

  if (!name || !mobile) return alert("Please enter name and mobile number.");

  showLoader();
  closeModals();

  const response = await apiCall("addCustomer", {
    data: { name: name, mobile: mobile, type: currentTab },
  });

  if (response.status === "success") {
    await loadCustomers(); // Refresh list from backend
  }
  hideLoader();
}

async function saveTransaction() {
  const goods = document.getElementById("new-txn-goods").value || 0;
  const paid = document.getElementById("new-txn-paid").value || 0;

  if (goods == 0 && paid == 0) return alert("Please enter an amount.");

  showLoader();
  closeModals();

  const response = await apiCall("addTransaction", {
    data: {
      customerId: currentCustomer.customerId,
      goods: goods,
      paid: paid,
    },
  });

  if (response.status === "success") {
    // Refresh the details page to show new transaction & updated due
    await openCustomerDetails(currentCustomer.customerId);
  }
  hideLoader();
}

// --- UI HELPERS ---
function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}
function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('Service Worker Registered!', reg))
      .catch(err => console.error('Service Worker Registration Failed!', err));
  });
}