import { getDashboardData } from "../services/ordersService.js";
import { getProducts, createProduct, updateProduct } from "../services/productsService.js";
import { getClients, createClient, updateClient } from "../services/clientsService.js";
import { getSales, createSale, updateSale, deleteSale as removeSale } from "../services/salesService.js";
import { getFinanceOverview, registerFinancePayment } from "../services/financeService.js";
import { getSalesHistory } from "../services/historyService.js";
import { getAuthSession, clearAuthSession } from "../services/authService.js";
import { createKpiCard, createOrderRow, createProductCard, createClientCard, createSaleCard } from "../components/ui.js";

const FLOOR_OPTIONS = {
  "1": ["Terreo", "1 andar"],
  "2": ["1 andar", "2 andar", "3 andar"]
};

const APP_VIEWS = ["dashboard", "sales", "products", "clients", "finance", "sales-history"];
const LOGIN_PAGE_PATH = "./login.php";
const THEME_STORAGE_KEY = "dashboard_theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const SALE_MODAL_HISTORY_KEY = "new-sale";
const SALE_EDIT_MODAL_HISTORY_KEY = "sale-edit-recent-order";
const DASHBOARD_EXIT_GUARD_HISTORY_KEY = "dashboard-exit-guard";
const MODAL_SCROLL_LOCK_CLASS = "has-modal-open";
const CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function createEmptyFinanceSummary() {
  return {
    totalReceivable: 0,
    debtorCount: 0,
    pendingSalesCount: 0,
    overdueCount: 0,
    overdueAmount: 0
  };
}

const state = {
  authUser: null,
  appEventsBound: false,
  browserNavigationBound: false,
  currentTheme: THEME_LIGHT,
  currentView: "dashboard",
  products: [],
  clients: [],
  sales: [],
  salesHistory: [],
  financeSummary: createEmptyFinanceSummary(),
  financeClients: [],
  productFilters: {
    search: "",
    stock: "all",
    status: "all"
  },
  clientFilters: {
    clientId: "",
    phone: "",
    status: "all"
  },
  salesManageFilters: {
    clientId: "",
    saleDate: "",
    product: ""
  },
  salesHistoryFilters: {
    clientId: "",
    paymentStatus: "all",
    saleStatus: "Finalizada",
    startDate: "",
    endDate: ""
  },
  financeFilters: {
    clientId: "",
    paymentDate: "",
    status: "all"
  },
  activeProductId: null,
  isEditingProduct: false,
  activeClientId: null,
  isEditingClient: false,
  activeSaleId: null,
  activeHistorySaleId: null,
  isSubmittingSale: false,
  isSubmittingSaleEdit: false,
  activeFinanceClientId: null,
  isSubmittingFinanceSettlement: false,
  isSubmittingPayment: false,
  isSubmittingHistoryPayment: false,
  salesHistoryRequestId: 0
};

const elements = {
  sidebar: document.getElementById("sidebar"),
  overlay: document.getElementById("overlay"),
  menuBtn: document.getElementById("menuBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  sidebarHomeBtn: document.getElementById("sidebarHomeBtn"),
  navLinks: Array.from(document.querySelectorAll(".nav-link")),
  topbarTitle: document.querySelector(".topbar__title"),
  newSaleBtn: document.getElementById("newSaleBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  kpiGrid: document.getElementById("kpiGrid"),
  ordersTableBody: document.getElementById("ordersTableBody"),
  refreshOrdersBtn: document.getElementById("refreshOrders"),

  views: Array.from(document.querySelectorAll("[data-view]")),

  productFiltersForm: document.getElementById("productFiltersForm"),
  productsList: document.getElementById("productsList"),
  productsEmptyState: document.getElementById("productsEmptyState"),
  registerProductBtn: document.getElementById("registerProductBtn"),
  productModalOverlay: document.getElementById("productModalOverlay"),
  productModalForm: document.getElementById("productModalForm"),
  productModalTitle: document.getElementById("productModalTitle"),
  modalProductId: document.getElementById("modalProductId"),
  modalProductName: document.getElementById("modalProductName"),
  modalProductStock: document.getElementById("modalProductStock"),
  modalProductPrice: document.getElementById("modalProductPrice"),
  modalProductStatus: document.getElementById("modalProductStatus"),
  cancelModalBtn: document.getElementById("cancelModalBtn"),

  clientFiltersForm: document.getElementById("clientFiltersForm"),
  clientNameFilter: document.getElementById("clientNameFilter"),
  clientsList: document.getElementById("clientsList"),
  clientsEmptyState: document.getElementById("clientsEmptyState"),
  registerClientBtn: document.getElementById("registerClientBtn"),
  clientModalOverlay: document.getElementById("clientModalOverlay"),
  clientModalForm: document.getElementById("clientModalForm"),
  clientModalTitle: document.getElementById("clientModalTitle"),
  modalClientId: document.getElementById("modalClientId"),
  modalClientName: document.getElementById("modalClientName"),
  modalClientPhone: document.getElementById("modalClientPhone"),
  modalClientEmail: document.getElementById("modalClientEmail"),
  modalClientBuilding: document.getElementById("modalClientBuilding"),
  modalClientFloor: document.getElementById("modalClientFloor"),
  cancelClientModalBtn: document.getElementById("cancelClientModalBtn"),

  salesManageFiltersForm: document.getElementById("salesManageFiltersForm"),
  salesManageClientFilter: document.getElementById("salesManageClientFilter"),
  salesManageList: document.getElementById("salesManageList"),
  salesManageEmptyState: document.getElementById("salesManageEmptyState"),
  salesHistoryFiltersForm: document.getElementById("salesHistoryFiltersForm"),
  salesHistoryClientFilter: document.getElementById("salesHistoryClientFilter"),
  salesHistoryPaymentStatusFilter: document.getElementById("salesHistoryPaymentStatusFilter"),
  salesHistorySaleStatusFilter: document.getElementById("salesHistorySaleStatusFilter"),
  salesHistoryStartDate: document.getElementById("salesHistoryStartDate"),
  salesHistoryEndDate: document.getElementById("salesHistoryEndDate"),
  salesHistoryTableBody: document.getElementById("salesHistoryTableBody"),
  salesHistoryEmptyState: document.getElementById("salesHistoryEmptyState"),
  financeFiltersForm: document.getElementById("financeFiltersForm"),
  financeClientFilter: document.getElementById("financeClientFilter"),
  financeStatusFilter: document.getElementById("financeStatusFilter"),
  financeDateFilter: document.getElementById("financeDateFilter"),
  financeTotalReceivable: document.getElementById("financeTotalReceivable"),
  financeDebtorCount: document.getElementById("financeDebtorCount"),
  financePendingSalesCount: document.getElementById("financePendingSalesCount"),
  financeOverdueAmount: document.getElementById("financeOverdueAmount"),
  financeList: document.getElementById("financeList"),
  financeEmptyState: document.getElementById("financeEmptyState"),

  saleModalOverlay: document.getElementById("saleModalOverlay"),
  saleModalForm: document.getElementById("saleModalForm"),
  saleClientSelect: document.getElementById("saleClientSelect"),
  saleProductSelect: document.getElementById("saleProductSelect"),
  saleQuantityInput: document.getElementById("saleQuantityInput"),
  saleUnitPriceInput: document.getElementById("saleUnitPriceInput"),
  saleProductPriceHint: document.getElementById("saleProductPriceHint"),
  saleTotalAmount: document.getElementById("saleTotalAmount"),
  salePaymentMethod: document.getElementById("salePaymentMethod"),
  salePaymentTiming: document.getElementById("salePaymentTiming"),
  salePaymentDate: document.getElementById("salePaymentDate"),
  saleDeliveryType: document.getElementById("saleDeliveryType"),
  cancelSaleModalBtn: document.getElementById("cancelSaleModalBtn"),
  saveSaleModalBtn: document.getElementById("saveSaleModalBtn"),
  finalizeSaleModalBtn: document.getElementById("finalizeSaleModalBtn"),

  saleDetailsModalOverlay: document.getElementById("saleDetailsModalOverlay"),
  receiptClientName: document.getElementById("receiptClientName"),
  receiptSaleCode: document.getElementById("receiptSaleCode"),
  receiptClientPhone: document.getElementById("receiptClientPhone"),
  receiptClientAddress: document.getElementById("receiptClientAddress"),
  receiptSaleDate: document.getElementById("receiptSaleDate"),
  receiptItems: document.getElementById("receiptItems"),
  receiptPaymentMethod: document.getElementById("receiptPaymentMethod"),
  receiptPaymentStatus: document.getElementById("receiptPaymentStatus"),
  receiptSaleStatus: document.getElementById("receiptSaleStatus"),
  receiptPaymentDate: document.getElementById("receiptPaymentDate"),
  receiptBalanceBefore: document.getElementById("receiptBalanceBefore"),
  receiptBalanceIncrease: document.getElementById("receiptBalanceIncrease"),
  receiptBalanceAfter: document.getElementById("receiptBalanceAfter"),
  receiptCurrentBalance: document.getElementById("receiptCurrentBalance"),
  receiptTransactions: document.getElementById("receiptTransactions"),
  receiptTransactionsEmptyState: document.getElementById("receiptTransactionsEmptyState"),
  receiptDeliveryInfo: document.getElementById("receiptDeliveryInfo"),
  closeSaleDetailsBtn: document.getElementById("closeSaleDetailsBtn"),
  printSaleReceiptBtn: document.getElementById("printSaleReceiptBtn"),
  receiptRegisterPaymentBtn: document.getElementById("receiptRegisterPaymentBtn"),
  deleteSaleDetailsBtn: document.getElementById("deleteSaleDetailsBtn"),

  saleEditModalOverlay: document.getElementById("saleEditModalOverlay"),
  saleEditForm: document.getElementById("saleEditForm"),
  saleEditCodeTop: document.getElementById("saleEditCodeTop"),
  saleEditClientName: document.getElementById("saleEditClientName"),
  saleEditItemsBox: document.getElementById("saleEditItemsBox"),
  saleEditType: document.getElementById("saleEditType"),
  saleEditDate: document.getElementById("saleEditDate"),
  saleEditLocation: document.getElementById("saleEditLocation"),
  saleEditPaymentMethod: document.getElementById("saleEditPaymentMethod"),
  saleEditPaymentStatus: document.getElementById("saleEditPaymentStatus"),
  deleteSaleEditTopBtn: document.getElementById("deleteSaleEditTopBtn"),
  saveSaleEditTopBtn: document.getElementById("saveSaleEditTopBtn"),
  finalizeSaleEditTopBtn: document.getElementById("finalizeSaleEditTopBtn"),

  financeClientModalOverlay: document.getElementById("financeClientModalOverlay"),
  financeModalClientName: document.getElementById("financeModalClientName"),
  financeModalPendingAmount: document.getElementById("financeModalPendingAmount"),
  financeModalPendingSalesCount: document.getElementById("financeModalPendingSalesCount"),
  financeModalDueDates: document.getElementById("financeModalDueDates"),
  financeModalSalesList: document.getElementById("financeModalSalesList"),
  financeSalesEmptyState: document.getElementById("financeSalesEmptyState"),
  financeTransactionsList: document.getElementById("financeTransactionsList"),
  financeTransactionsEmptyState: document.getElementById("financeTransactionsEmptyState"),
  closeFinanceModalBtn: document.getElementById("closeFinanceModalBtn"),

  registerPaymentBtn: document.getElementById("registerPaymentBtn"),
  paymentModalOverlay: document.getElementById("paymentModalOverlay"),
  paymentClientSelect: document.getElementById("paymentClientSelect"),
  paymentAmount: document.getElementById("paymentAmount"),
  paymentMethod: document.getElementById("paymentMethod"),
  paymentNote: document.getElementById("paymentNote"),
  closePaymentModalBtn: document.getElementById("closePaymentModalBtn"),
  submitPaymentBtn: document.getElementById("submitPaymentBtn"),
  receiptTotalAmount: document.getElementById("receiptTotalAmount"),
  receiptPendingAmount: document.getElementById("receiptPendingAmount"),
  saleEditTotalAmount: document.getElementById("saleEditTotalAmount")
};

function normalizeTheme(theme) {
  return theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
}

function getStoredThemePreference() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === THEME_DARK || storedTheme === THEME_LIGHT) {
      return storedTheme;
    }
  } catch (error) {
    // Ignora indisponibilidade de storage.
  }
  return null;
}

function getSystemThemePreference() {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return THEME_DARK;
  }
  return THEME_LIGHT;
}

function persistThemePreference(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
  } catch (error) {
    // Ignora indisponibilidade de storage.
  }
}

function syncThemeToggleButton() {
  if (!elements.themeToggleBtn) {
    return;
  }

  const isDarkTheme = state.currentTheme === THEME_DARK;
  elements.themeToggleBtn.setAttribute("aria-pressed", String(isDarkTheme));
  elements.themeToggleBtn.setAttribute("aria-checked", String(isDarkTheme));
  elements.themeToggleBtn.setAttribute("aria-label", isDarkTheme ? "Alternar para modo claro" : "Alternar para modo escuro");
}

function applyTheme(theme, { persist = false } = {}) {
  const normalizedTheme = normalizeTheme(theme);
  state.currentTheme = normalizedTheme;
  document.documentElement.setAttribute("data-theme", normalizedTheme);
  syncThemeToggleButton();

  if (persist) {
    persistThemePreference(normalizedTheme);
  }
}

function toggleThemePreference() {
  const nextTheme = state.currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  applyTheme(nextTheme, { persist: true });
}

function initializeTheme() {
  const preferredTheme = getStoredThemePreference() || getSystemThemePreference();
  applyTheme(preferredTheme);
}

function normalizeText(value) {
  return value.trim().toLowerCase();
}

function normalizeDateInput(dateInput) {
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateInput)) {
    return dateInput.replace(" ", "T");
  }
  return dateInput;
}

function toIsoDate(dateInput) {
  return new Date(normalizeDateInput(dateInput)).toISOString().slice(0, 10);
}

function formatDateTime(dateInput) {
  const date = new Date(normalizeDateInput(dateInput));
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatDateOnly(dateInput) {
  const date = new Date(normalizeDateInput(dateInput));
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleDateString("pt-BR");
}

function formatCurrency(amount) {
  return CURRENCY_FORMATTER.format(Number(amount) || 0);
}

function parseCurrencyInput(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return Number.NaN;
  }

  let sanitizedValue = normalizedValue.replace(/[^\d,.-]/g, "");
  if (!sanitizedValue) {
    return Number.NaN;
  }

  if (sanitizedValue.includes(",") && sanitizedValue.includes(".")) {
    sanitizedValue = sanitizedValue.replace(/\./g, "").replace(",", ".");
  } else if (sanitizedValue.includes(",")) {
    sanitizedValue = sanitizedValue.replace(",", ".");
  }

  const amount = Number(sanitizedValue);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

function formatCurrencyInputValue(amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }
  return formatCurrency(amount).replace(/^R\$\s?/, "");
}

function formatCurrencyFieldInput(inputElement) {
  if (!inputElement) {
    return;
  }
  const amount = parseCurrencyInput(inputElement.value);
  inputElement.value = Number.isFinite(amount) && amount > 0 ? formatCurrencyInputValue(amount) : "";
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function formatShortDate(value) {
  const parsedDate = parseDateOnly(value);
  if (!parsedDate) {
    return "--";
  }
  return parsedDate.toLocaleDateString("pt-BR");
}

function formatDeliveryType(type) {
  return type === "entrega" ? "Entrega" : "Retirada";
}

function buildSaleItemsText(items) {
  return items.map((item) => `${item.productName} x${item.quantity}`).join("\n");
}

function formatSaleProductsSummary(items = []) {
  return items.map((item) => `${item.productName} x${item.quantity}`).join(", ");
}

function getSaleStatusBadgeClass(saleStatus) {
  if (saleStatus === "Finalizada") {
    return "badge badge--done";
  }
  if (saleStatus === "Em andamento") {
    return "badge badge--preparing";
  }
  return "badge badge--pending";
}

function getPaymentStatusBadgeClass(paymentStatus) {
  return paymentStatus === "Pago" ? "badge badge--status-active" : "badge badge--status-inactive";
}

function toggleSidebar(isOpen) {
  elements.sidebar.classList.toggle("is-open", isOpen);
  elements.overlay.classList.toggle("is-visible", isOpen);
}

function closeSidebar() {
  toggleSidebar(false);
}

function openSidebar() {
  toggleSidebar(true);
}

function updateTopbarByView(viewName) {
  const titleMap = {
    dashboard: "HOME",
    sales: "Vendas",
    products: "Produtos",
    clients: "Clientes",
    finance: "Financeiro",
    "sales-history": "Historico de Vendas"
  };
  elements.topbarTitle.textContent = titleMap[viewName] || "HOME";
  elements.newSaleBtn.hidden = viewName !== "dashboard";
  elements.registerPaymentBtn.style.display = viewName === "finance" ? "inline-block" : "none";
}

function getViewFromSearchParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  return APP_VIEWS.includes(view) ? view : "dashboard";
}

function getViewFromHistoryState(historyState) {
  if (!historyState || typeof historyState !== "object") {
    return null;
  }
  return APP_VIEWS.includes(historyState.view) ? historyState.view : null;
}

function getSaleEditModalHistoryState(historyState) {
  if (!historyState || typeof historyState !== "object") {
    return null;
  }
  if (historyState.modal !== SALE_EDIT_MODAL_HISTORY_KEY) {
    return null;
  }

  const saleId = String(historyState.saleId || "").trim();
  if (!saleId) {
    return null;
  }

  const view = getViewFromHistoryState(historyState) || "dashboard";
  return { view, saleId };
}

function getSaleModalHistoryState(historyState) {
  if (!historyState || typeof historyState !== "object") {
    return null;
  }
  if (historyState.modal !== SALE_MODAL_HISTORY_KEY) {
    return null;
  }

  const view = getViewFromHistoryState(historyState) || "dashboard";
  return { view };
}

function isDashboardExitGuardState(historyState) {
  if (!historyState || typeof historyState !== "object") {
    return false;
  }

  return historyState.guard === DASHBOARD_EXIT_GUARD_HISTORY_KEY && getViewFromHistoryState(historyState) === "dashboard";
}

function buildViewUrl(viewName) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", viewName);
  return `${url.pathname}${url.search}${url.hash}`;
}

function syncBrowserHistory(viewName, { replace = false } = {}) {
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const nextUrl = buildViewUrl(viewName);
  const currentView = getViewFromHistoryState(window.history.state);

  if (!replace && currentUrl === nextUrl && currentView === viewName) {
    return;
  }

  const nextState = { view: viewName };

  if (replace) {
    window.history.replaceState(nextState, "", nextUrl);
    return;
  }
  window.history.pushState(nextState, "", nextUrl);
}

function syncSaleEditModalHistory(saleId) {
  const view = state.currentView;
  const nextUrl = buildViewUrl(view);
  const currentModalState = getSaleEditModalHistoryState(window.history.state);

  if (currentModalState && currentModalState.saleId === saleId && currentModalState.view === view) {
    return;
  }

  window.history.pushState(
    {
      view,
      modal: SALE_EDIT_MODAL_HISTORY_KEY,
      saleId
    },
    "",
    nextUrl
  );
}

function syncSaleModalHistory() {
  const view = state.currentView;
  const nextUrl = buildViewUrl(view);
  const currentModalState = getSaleModalHistoryState(window.history.state);

  if (currentModalState && currentModalState.view === view) {
    return;
  }

  window.history.pushState(
    {
      view,
      modal: SALE_MODAL_HISTORY_KEY
    },
    "",
    nextUrl
  );
}

function armDashboardExitGuard() {
  const dashboardUrl = buildViewUrl("dashboard");

  window.history.replaceState(
    {
      view: "dashboard",
      guard: DASHBOARD_EXIT_GUARD_HISTORY_KEY
    },
    "",
    dashboardUrl
  );

  window.history.pushState(
    {
      view: "dashboard"
    },
    "",
    dashboardUrl
  );
}

function restoreDashboardHistoryEntry() {
  window.history.pushState(
    {
      view: "dashboard"
    },
    "",
    buildViewUrl("dashboard")
  );
}

function confirmDashboardExit() {
  const shouldExitSite = window.confirm("Deseja realmente sair do site?");

  if (!shouldExitSite) {
    restoreDashboardHistoryEntry();
    navigateTo("dashboard");
    return;
  }

  window.history.back();
}

function navigateTo(viewName, { syncHistory = false, replaceHistory = false } = {}) {
  if (!state.authUser) {
    return;
  }

  if (!APP_VIEWS.includes(viewName)) {
    return;
  }

  const previousView = state.currentView;
  state.currentView = viewName;
  elements.views.forEach((viewNode) => {
    viewNode.classList.toggle("view--active", viewNode.dataset.view === viewName);
  });

  elements.navLinks.forEach((link) => {
    link.classList.toggle("nav-link--active", link.dataset.route === viewName);
  });

  updateTopbarByView(viewName);
  closeSidebar();

  if (syncHistory) {
    syncBrowserHistory(viewName, { replace: replaceHistory || previousView === viewName });
  }
}

function setupBrowserNavigation(initialView) {
  if (!state.browserNavigationBound) {
    window.addEventListener("popstate", () => {
      if (hasOpenModalOverlay()) {
        closeAllOverlays();
        return;
      }

      if (!state.authUser) {
        return;
      }
      const saleModalState = getSaleModalHistoryState(window.history.state);
      const saleEditModalState = getSaleEditModalHistoryState(window.history.state);
      const viewFromState = getViewFromHistoryState(window.history.state);
      const targetView = viewFromState || getViewFromSearchParams();

      if (isDashboardExitGuardState(window.history.state)) {
        confirmDashboardExit();
        return;
      }

      if (saleModalState) {
        navigateTo(saleModalState.view);
        openSaleModal();
        return;
      }

      if (saleEditModalState) {
        navigateTo(targetView);
        openSaleEditModal(saleEditModalState.saleId);
        return;
      }

      if (elements.saleEditModalOverlay.classList.contains("is-open")) {
        closeSaleEditModal();
      }

      navigateTo(targetView);
    });
    state.browserNavigationBound = true;
  }

  navigateTo(initialView, { syncHistory: true, replaceHistory: true });
  if (initialView === "dashboard") {
    armDashboardExitGuard();
  }
}

function renderDashboardMetrics(metrics = []) {
  elements.kpiGrid.innerHTML = "";
  metrics.forEach((metric) => {
    elements.kpiGrid.appendChild(createKpiCard(metric));
  });
}

function renderOrders(orders = []) {
  elements.ordersTableBody.innerHTML = "";
  orders.forEach((order) => {
    elements.ordersTableBody.appendChild(createOrderRow(order));
  });
}

async function refreshDashboardData() {
  try {
    const data = await getDashboardData();
    renderDashboardMetrics(data.metrics || []);
    renderOrders(data.orders || []);
  } catch (error) {
    window.alert(error.message || "Nao foi possivel carregar dashboard.");
  }
}

function buildSalesHistoryQueryParams(filters = state.salesHistoryFilters) {
  return {
    cliente: filters.clientId,
    status_pagamento: filters.paymentStatus,
    status_venda: filters.saleStatus,
    data_inicio: filters.startDate,
    data_fim: filters.endDate
  };
}

function applyProtectedData({
  products = state.products,
  clients = state.clients,
  sales = state.sales,
  salesHistory = state.salesHistory,
  finance = null
} = {}) {
  state.products = products;
  state.clients = clients;
  state.sales = sales;
  state.salesHistory = salesHistory;
  if (finance) {
    applyFinanceOverview(finance);
  }
}

async function refreshClientsSalesFinance() {
  const [clients, sales, salesHistory, finance] = await Promise.all([
    getClients(),
    getSales(),
    getSalesHistory(buildSalesHistoryQueryParams()),
    getFinanceOverview()
  ]);

  applyProtectedData({ clients, sales, salesHistory, finance });
  populateClientFilterOptions();
  populateSaleClientOptions();
  renderClientsList();
  renderSalesManageList();
  renderSalesHistoryList();
  renderFinanceList();
}

async function refreshProductsClientsSalesFinance() {
  const [products, clients, sales, salesHistory, finance] = await Promise.all([
    getProducts(),
    getClients(),
    getSales(),
    getSalesHistory(buildSalesHistoryQueryParams()),
    getFinanceOverview()
  ]);

  applyProtectedData({ products, clients, sales, salesHistory, finance });
  populateClientFilterOptions();
  populateSaleClientOptions();
  populateSaleProductOptions();
  syncSalePricingFromSelectedProduct();
  renderProductsList();
  renderClientsList();
  renderSalesManageList();
  renderSalesHistoryList();
  renderFinanceList();
}

async function refreshAllSaleDependencies() {
  await refreshProductsClientsSalesFinance();
  await refreshDashboardData();
}

function applyProductFilters(products, filters) {
  const search = normalizeText(filters.search);
  return products.filter((product) => {
    const nameMatch = product.name.toLowerCase().includes(search);
    const stockMatch =
      filters.stock === "all" ||
      (filters.stock === "in" && Number(product.stock) > 0) ||
      (filters.stock === "out" && Number(product.stock) <= 0);
    const statusMatch =
      filters.status === "all" ||
      (filters.status === "active" && product.isActive) ||
      (filters.status === "inactive" && !product.isActive);

    return nameMatch && stockMatch && statusMatch;
  });
}

function renderProductsList() {
  const filtered = applyProductFilters(state.products, state.productFilters);
  elements.productsList.innerHTML = "";
  filtered.forEach((product) => {
    elements.productsList.appendChild(createProductCard(product));
  });
  elements.productsEmptyState.hidden = filtered.length > 0;
}

function syncFloorOptions(buildingValue, selectedFloor = "") {
  const options = FLOOR_OPTIONS[buildingValue] || FLOOR_OPTIONS["1"];
  elements.modalClientFloor.innerHTML = options
    .map((floor) => `<option value="${floor}">${floor}</option>`)
    .join("");
  if (selectedFloor && options.includes(selectedFloor)) {
    elements.modalClientFloor.value = selectedFloor;
  }
}

function setClientFilterOptions(selectElement, selectedClientId = "") {
  if (!selectElement) {
    return;
  }

  const fragment = document.createDocumentFragment();
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Todos os clientes";
  fragment.appendChild(defaultOption);

  state.clients.forEach((client) => {
    const option = document.createElement("option");
    option.value = client.id;
    option.textContent = client.name;
    fragment.appendChild(option);
  });

  selectElement.innerHTML = "";
  selectElement.appendChild(fragment);

  if (selectedClientId && state.clients.some((client) => client.id === selectedClientId)) {
    selectElement.value = selectedClientId;
    return;
  }
  selectElement.value = "";
}

function populateClientFilterOptions() {
  setClientFilterOptions(elements.clientNameFilter, state.clientFilters.clientId);
  setClientFilterOptions(elements.salesManageClientFilter, state.salesManageFilters.clientId);
  setClientFilterOptions(elements.salesHistoryClientFilter, state.salesHistoryFilters.clientId);
}

function applyClientFilters(clients, filters) {
  const clientId = filters.clientId;
  const phone = normalizeText(filters.phone);

  return clients.filter((client) => {
    const clientMatch = !clientId || client.id === clientId;
    const phoneMatch = client.phone.toLowerCase().includes(phone);
    const statusMatch = filters.status === "all" || client.status === filters.status;
    return clientMatch && phoneMatch && statusMatch;
  });
}

function renderClientsList() {
  const filtered = applyClientFilters(state.clients, state.clientFilters);
  elements.clientsList.innerHTML = "";
  filtered.forEach((client) => {
    elements.clientsList.appendChild(createClientCard(client));
  });
  elements.clientsEmptyState.hidden = filtered.length > 0;
}

function getSaleProductNames(sale) {
  return sale.items.map((item) => item.productName.toLowerCase()).join(" ");
}

function getSaleById(saleId) {
  return state.sales.find((sale) => sale.id === saleId) || null;
}

function applySalesManageFilters(sales, filters) {
  const clientId = filters.clientId;
  const productTerm = normalizeText(filters.product);
  return sales.filter((sale) => {
    const clientMatch = !clientId || sale.clientId === clientId;
    const productMatch = getSaleProductNames(sale).includes(productTerm);
    const dateMatch = !filters.saleDate || toIsoDate(sale.saleDate) === filters.saleDate;
    return clientMatch && productMatch && dateMatch;
  });
}

function renderSalesManageList() {
  const filtered = applySalesManageFilters(state.sales, state.salesManageFilters);
  elements.salesManageList.innerHTML = "";
  filtered.forEach((sale) => {
    elements.salesManageList.appendChild(createSaleCard(sale));
  });
  elements.salesManageEmptyState.hidden = filtered.length > 0;
}

function createSalesHistoryRow(sale) {
  const row = document.createElement("tr");
  row.className = "history-row";
  row.tabIndex = 0;
  row.dataset.saleId = sale.id;
  row.setAttribute("role", "button");
  row.setAttribute("aria-label", `Abrir cupom da venda ${sale.id}`);

  row.innerHTML = `
    <td data-label="Cliente"><strong>${sale.clientName}</strong></td>
    <td data-label="Data">${formatDateOnly(sale.saleDate)}</td>
    <td data-label="Produtos">${formatSaleProductsSummary(sale.items)}</td>
    <td data-label="Valor Total">${formatCurrency(sale.totalAmount)}</td>
    <td data-label="Status Pagamento"><span class="${getPaymentStatusBadgeClass(sale.paymentStatus)}">${sale.paymentStatus}</span></td>
    <td data-label="Status Venda"><span class="${getSaleStatusBadgeClass(sale.saleStatus)}">${sale.saleStatus}</span></td>
  `;

  return row;
}

function renderSalesHistoryList() {
  elements.salesHistoryTableBody.innerHTML = "";
  state.salesHistory.forEach((sale) => {
    elements.salesHistoryTableBody.appendChild(createSalesHistoryRow(sale));
  });
  elements.salesHistoryEmptyState.hidden = state.salesHistory.length > 0;
}

async function refreshSalesHistoryData() {
  const requestId = ++state.salesHistoryRequestId;
  const history = await getSalesHistory(buildSalesHistoryQueryParams());
  if (requestId !== state.salesHistoryRequestId) {
    return;
  }

  state.salesHistory = Array.isArray(history) ? history : [];
  renderSalesHistoryList();
}

function applyFinanceOverview(financeOverview = {}) {
  state.financeSummary = {
    ...createEmptyFinanceSummary(),
    ...(financeOverview.summary || {})
  };
  state.financeClients = Array.isArray(financeOverview.clients) ? financeOverview.clients : [];
}

function getTodayIsoLocal() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isFinanceSaleOverdue(sale) {
  return Boolean(sale?.dueDate) && sale.dueDate < getTodayIsoLocal();
}

function getFinanceClientById(clientId) {
  return state.financeClients.find((client) => client.clientId === clientId) || null;
}

function syncFinanceClientFilterOptions() {
  const selectedClientId = state.financeFilters.clientId;
  const clientEntries = state.financeClients
    .map((client) => [client.clientId, client.clientName])
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "pt-BR"));

  const fragment = document.createDocumentFragment();
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Todos os clientes";
  fragment.appendChild(defaultOption);

  clientEntries.forEach(([clientId, clientName]) => {
    const option = document.createElement("option");
    option.value = clientId;
    option.textContent = clientName;
    fragment.appendChild(option);
  });

  elements.financeClientFilter.innerHTML = "";
  elements.financeClientFilter.appendChild(fragment);

  if (selectedClientId && clientEntries.some(([clientId]) => clientId === selectedClientId)) {
    elements.financeClientFilter.value = selectedClientId;
    return;
  }

  state.financeFilters.clientId = "";
  elements.financeClientFilter.value = "";
}

function applyFinanceFilters(financeClients, filters) {
  return financeClients.filter((client) => {
    const pendingSales = getClientFinancePendingSales(client);
    const overdueSalesCount = pendingSales.filter((sale) => isFinanceSaleOverdue(sale)).length;
    const clientMatch = !filters.clientId || client.clientId === filters.clientId;
    const dateMatch =
      !filters.paymentDate ||
      pendingSales.some((sale) => sale.dueDate === filters.paymentDate);
    const statusMatch =
      filters.status === "all" ||
      (filters.status === "overdue" && overdueSalesCount > 0) ||
      (filters.status === "current" && overdueSalesCount === 0);

    return clientMatch && dateMatch && statusMatch;
  });
}

function createFinanceClientCard(client) {
  const card = document.createElement("article");
  const pendingSales = getClientFinancePendingSales(client);
  const balanceDue = getClientFinanceBalanceDue(client, pendingSales);
  const overdueSalesCount = pendingSales.filter((sale) => isFinanceSaleOverdue(sale)).length;
  const hasOverdueSales = overdueSalesCount > 0;
  const nextDueDate = pendingSales[0]?.dueDate || client.nextDueDate || "";
  card.className = "finance-card";
  card.dataset.clientId = client.clientId;
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Abrir resumo financeiro de ${client.clientName}`);
  card.innerHTML = `
    <div class="finance-card__top">
      <h3 class="finance-card__name">${client.clientName}</h3>
      <span class="badge ${hasOverdueSales ? "badge--warning" : "badge--done"}">
        ${hasOverdueSales ? `${overdueSalesCount} vencida(s)` : "Em dia"}
      </span>
    </div>
    <p class="finance-card__due">Proximo vencimento: ${formatShortDate(nextDueDate)}</p>
    <p class="finance-card__meta">${pendingSales.length} venda(s) pendente(s)</p>
    <p class="finance-card__amount ${balanceDue > 0 ? "finance-card__amount--danger" : ""}">${formatCurrency(balanceDue)}</p>
  `;
  return card;
}

function buildFinanceSummaryFromClients(financeClients) {
  const summary = createEmptyFinanceSummary();
  summary.debtorCount = financeClients.length;

  financeClients.forEach((client) => {
    const pendingSales = getClientFinancePendingSales(client);
    const overdueSalesCount = pendingSales.filter((sale) => isFinanceSaleOverdue(sale)).length;
    summary.totalReceivable += getClientFinanceBalanceDue(client, pendingSales);
    summary.pendingSalesCount += pendingSales.length;
    summary.overdueCount += overdueSalesCount;

    pendingSales.forEach((sale) => {
      if (isFinanceSaleOverdue(sale)) {
        summary.overdueAmount += Number(sale.pendingAmount || 0);
      }
    });
  });

  summary.totalReceivable = Number(summary.totalReceivable.toFixed(2));
  summary.overdueAmount = Number(summary.overdueAmount.toFixed(2));
  return summary;
}

function renderFinanceIndicators(financeClients = state.financeClients) {
  const summary = buildFinanceSummaryFromClients(financeClients);
  elements.financeTotalReceivable.textContent = formatCurrency(summary.totalReceivable);
  elements.financeDebtorCount.textContent = String(summary.debtorCount);
  elements.financePendingSalesCount.textContent = String(summary.pendingSalesCount);
  elements.financeOverdueAmount.textContent = formatCurrency(summary.overdueAmount);
}

function renderFinanceList() {
  syncFinanceClientFilterOptions();
  const filteredClients = applyFinanceFilters(state.financeClients, state.financeFilters);
  renderFinanceIndicators(filteredClients);

  elements.financeList.innerHTML = "";
  filteredClients.forEach((client) => {
    elements.financeList.appendChild(createFinanceClientCard(client));
  });
  elements.financeEmptyState.hidden = filteredClients.length > 0;
}

function setFinanceSettlementSubmitting(isSubmitting) {
  state.isSubmittingFinanceSettlement = isSubmitting;
  if (elements.closeFinanceModalBtn) {
    elements.closeFinanceModalBtn.disabled = isSubmitting;
  }
}

function getSortableDateTimeValue(value) {
  const parsedDate = new Date(normalizeDateInput(value));
  const timestamp = parsedDate.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeFinancePendingSales(pendingSales = []) {
  const seenSaleIds = new Set();

  return pendingSales
    .filter((sale) => sale && typeof sale === "object" && sale.saleId)
    .filter((sale) => {
      if (seenSaleIds.has(sale.saleId)) {
        return false;
      }
      seenSaleIds.add(sale.saleId);
      return true;
    })
    .sort((left, right) => {
      const dueDateCompare = String(left.dueDate || "").localeCompare(String(right.dueDate || ""));
      if (dueDateCompare !== 0) {
        return dueDateCompare;
      }

      const saleDateCompare = getSortableDateTimeValue(left.saleDate) - getSortableDateTimeValue(right.saleDate);
      if (saleDateCompare !== 0) {
        return saleDateCompare;
      }

      return String(left.saleId || "").localeCompare(String(right.saleId || ""));
    });
}

function normalizeFinanceTransactions(transactions = []) {
  const seenTransactionIds = new Set();

  return transactions
    .filter((transaction) => transaction && typeof transaction === "object" && transaction.id !== undefined)
    .filter((transaction) => {
      if (seenTransactionIds.has(transaction.id)) {
        return false;
      }
      seenTransactionIds.add(transaction.id);
      return true;
    })
    .map((transaction) => ({
      ...transaction,
      id: Number(transaction.id || 0),
      type: String(transaction.type || "").trim().toLowerCase(),
      amount: Number(transaction.amount || 0),
      description: String(transaction.description || "").trim(),
      note: String(transaction.note || "").trim(),
      createdAt: String(transaction.createdAt || "").trim(),
      saleId: transaction.saleId ? String(transaction.saleId).trim() : null,
      productLabel: String(transaction.productLabel || "").trim()
    }))
    .sort((left, right) => {
      const dateCompare = getSortableDateTimeValue(right.createdAt) - getSortableDateTimeValue(left.createdAt);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return Number(right.id || 0) - Number(left.id || 0);
    });
}

function getClientFinancePendingSales(client) {
  return normalizeFinancePendingSales(Array.isArray(client?.pendingSales) ? client.pendingSales : []);
}

function getClientFinanceTransactions(client) {
  return normalizeFinanceTransactions(Array.isArray(client?.transactions) ? client.transactions : []);
}

function getClientFinanceBalanceDue(client, pendingSales = getClientFinancePendingSales(client)) {
  if (pendingSales.length > 0) {
    const pendingAmount = pendingSales.reduce((total, sale) => total + Number(sale.pendingAmount || 0), 0);
    return Number(pendingAmount.toFixed(2));
  }

  return Number(client?.balanceDue || 0);
}

function getFinanceTransactionMeta(transaction) {
  const typeMap = {
    debito_venda: {
      label: "Venda",
      className: "finance-transaction__amount--debit",
      itemClassName: "finance-transaction--debit",
      pillClassName: "finance-transaction__pill--debit",
      sign: "+"
    },
    pagamento_manual: {
      label: "Pagamento",
      className: "finance-transaction__amount--credit",
      itemClassName: "finance-transaction--credit",
      pillClassName: "finance-transaction__pill--credit",
      sign: "-"
    },
    pagamento_venda: {
      label: "Pagamento",
      className: "finance-transaction__amount--credit",
      itemClassName: "finance-transaction--credit",
      pillClassName: "finance-transaction__pill--credit",
      sign: "-"
    },
    estorno_debito: {
      label: "Estorno",
      className: "finance-transaction__amount--neutral",
      itemClassName: "finance-transaction--neutral",
      pillClassName: "finance-transaction__pill--neutral",
      sign: "-"
    }
  };
  return typeMap[transaction.type] || {
    label: "Movimentacao",
    className: "finance-transaction__amount--neutral",
    itemClassName: "finance-transaction--neutral",
    pillClassName: "finance-transaction__pill--neutral",
    sign: ""
  };
}

function getFinanceRecentTransactionStatusMeta(transaction) {
  if (transaction?.type === "debito_venda") {
    return {
      label: "Saida",
      itemClassName: "finance-transaction--debit",
      statusClassName: "finance-transaction__status--debit"
    };
  }

  if (["pagamento_manual", "pagamento_venda", "estorno_debito"].includes(transaction?.type)) {
    return {
      label: "Entrada",
      itemClassName: "finance-transaction--credit",
      statusClassName: "finance-transaction__status--credit"
    };
  }

  return {
    label: "Movimento",
    itemClassName: "finance-transaction--neutral",
    statusClassName: "finance-transaction__status--neutral"
  };
}

function getFinanceRecentTransactionProductLabel(transaction) {
  const productLabel = String(transaction?.productLabel || "").trim();
  if (productLabel) {
    return productLabel;
  }

  if (transaction?.saleId) {
    return `Venda ${transaction.saleId}`;
  }

  return "Pagamento manual";
}

function getFinanceRecentTransactionMetaLine(transaction) {
  const details = [];
  const paymentMethod = String(transaction?.paymentMethod || "").trim();
  const dateLabel = formatDateOnly(transaction?.createdAt || "");

  if (paymentMethod) {
    details.push(normalizePaymentMethod(paymentMethod));
  }
  if (dateLabel !== "--") {
    details.push(dateLabel);
  }

  return details.join(" | ") || "--";
}

function fillFinanceClientModal(client) {
  const pendingSales = getClientFinancePendingSales(client);
  const transactions = getClientFinanceTransactions(client);
  const nextDueDate = pendingSales[0]?.dueDate || client.nextDueDate || "";
  const balanceDue = getClientFinanceBalanceDue(client, pendingSales);
  elements.financeModalClientName.textContent = client.clientName;
  elements.financeModalPendingAmount.textContent = formatCurrency(balanceDue);
  elements.financeModalPendingSalesCount.textContent = String(pendingSales.length);
  elements.financeModalDueDates.textContent = nextDueDate ? formatShortDate(nextDueDate) : "--";

  elements.financeModalSalesList.innerHTML = "";
  pendingSales.forEach((sale) => {
    const row = document.createElement("div");
    row.className = "finance-sale-row";
    row.innerHTML = `
      <span class="finance-sale-row__code">${sale.saleId}</span>
      <span class="finance-sale-row__date">${formatShortDate(sale.dueDate)}</span>
      <span class="finance-sale-row__amount">${formatCurrency(sale.pendingAmount)}</span>
    `;
    elements.financeModalSalesList.appendChild(row);
  });
  elements.financeSalesEmptyState.hidden = pendingSales.length > 0;

  elements.financeTransactionsList.innerHTML = "";
  transactions.forEach((transaction) => {
    const transactionMeta = getFinanceRecentTransactionStatusMeta(transaction);
    const item = document.createElement("div");
    item.className = `finance-transaction ${transactionMeta.itemClassName}`.trim();
    item.innerHTML = `
      <div class="finance-transaction__content">
        <div class="finance-transaction__header">
          <p class="finance-transaction__product">${getFinanceRecentTransactionProductLabel(transaction)}</p>
          <span class="finance-transaction__status ${transactionMeta.statusClassName}">${transactionMeta.label}</span>
        </div>
        <p class="finance-transaction__meta">${getFinanceRecentTransactionMetaLine(transaction)}</p>
      </div>
    `;
    elements.financeTransactionsList.appendChild(item);
  });
  elements.financeTransactionsEmptyState.hidden = transactions.length > 0;
}

function openFinanceClientModal(clientId) {
  const financeClient = getFinanceClientById(clientId);
  if (!financeClient) {
    renderFinanceList();
    return;
  }

  try {
    state.activeFinanceClientId = clientId;
    setFinanceSettlementSubmitting(false);
    fillFinanceClientModal(financeClient);
    openModal(elements.financeClientModalOverlay);
  } catch (error) {
    state.activeFinanceClientId = null;
    console.error("Erro ao abrir resumo financeiro do cliente.", error);
    window.alert("Nao foi possivel abrir o resumo financeiro deste cliente.");
  }
}

function closeFinanceClientModal({ force = false } = {}) {
  if (state.isSubmittingFinanceSettlement && !force) {
    return;
  }
  state.activeFinanceClientId = null;
  setFinanceSettlementSubmitting(false);
  closeModal(elements.financeClientModalOverlay);
}

function openPaymentModal() {
  populatePaymentClientSelect();
  openModal(elements.paymentModalOverlay);
}

function closePaymentModal({ force = false } = {}) {
  if (!force && state.isSubmittingPayment) {
    return;
  }
  closeModal(elements.paymentModalOverlay);
  resetPaymentForm();
}

function resetPaymentForm() {
  elements.paymentClientSelect.value = "";
  elements.paymentAmount.value = "";
  elements.paymentMethod.value = "Pix";
  elements.paymentNote.value = "";
}

async function handlePaymentSubmission() {
  if (state.isSubmittingPayment) {
    return;
  }

  const clientId = elements.paymentClientSelect.value;
  const amount = parseCurrencyInput(elements.paymentAmount.value);
  const paymentMethod = elements.paymentMethod.value;
  const note = elements.paymentNote.value.trim();

  if (!clientId) {
    window.alert("Selecione um cliente.");
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    window.alert("Informe um valor de pagamento valido.");
    return;
  }

  const client = state.clients.find(c => c.id === clientId);
  if (!client) {
    window.alert("Cliente nao encontrado.");
    return;
  }

  const shouldConfirm = window.confirm(
    `Confirmar pagamento de ${formatCurrency(amount)} para ${client.name}?`
  );
  if (!shouldConfirm) {
    return;
  }

  setPaymentSubmitting(true);
  try {
    await registerFinancePayment({
      clientId,
      amount,
      paymentMethod,
      note
    });

    await refreshClientsSalesFinance();
    await refreshDashboardData();
    closePaymentModal({ force: true });
  } catch (error) {
    window.alert(error.message || "Nao foi possivel registrar o pagamento.");
  } finally {
    setPaymentSubmitting(false);
  }
}

function populatePaymentClientSelect() {
  const select = elements.paymentClientSelect;
  select.innerHTML = '<option value="">Selecione um cliente</option>';

  // Only clients with pending balance
  const clientsWithDebt = state.clients.filter(client => {
    const financeClient = state.financeClients.find(fc => fc.clientId === client.id);
    return financeClient && getClientFinanceBalanceDue(financeClient) > 0;
  });

  clientsWithDebt.forEach(client => {
    const option = document.createElement("option");
    option.value = client.id;
    option.textContent = client.name;
    select.appendChild(option);
  });
}

function setPaymentSubmitting(isSubmitting) {
  state.isSubmittingPayment = isSubmitting;
  elements.submitPaymentBtn.disabled = isSubmitting;
  elements.closePaymentModalBtn.disabled = isSubmitting;
  elements.paymentClientSelect.disabled = isSubmitting;
  elements.paymentAmount.disabled = isSubmitting;
  elements.paymentMethod.disabled = isSubmitting;
  elements.paymentNote.disabled = isSubmitting;
}

function hasOpenModalOverlay() {
  return Boolean(document.querySelector(".modal-overlay.is-open"));
}

function lockBackgroundScroll() {
  if (document.body.classList.contains(MODAL_SCROLL_LOCK_CLASS)) {
    return;
  }

  const scrollY = window.scrollY || window.pageYOffset || 0;
  document.body.dataset.modalScrollY = String(scrollY);
  document.documentElement.classList.add(MODAL_SCROLL_LOCK_CLASS);
  document.body.classList.add(MODAL_SCROLL_LOCK_CLASS);
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockBackgroundScroll() {
  if (!document.body.classList.contains(MODAL_SCROLL_LOCK_CLASS)) {
    return;
  }

  const lockedScrollY = Number(document.body.dataset.modalScrollY || "0");
  document.documentElement.classList.remove(MODAL_SCROLL_LOCK_CLASS);
  document.body.classList.remove(MODAL_SCROLL_LOCK_CLASS);
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  delete document.body.dataset.modalScrollY;
  window.scrollTo(0, Number.isFinite(lockedScrollY) ? lockedScrollY : 0);
}

function syncModalScrollLock() {
  if (hasOpenModalOverlay()) {
    lockBackgroundScroll();
    return;
  }
  unlockBackgroundScroll();
}

function openModal(overlayElement) {
  if (!overlayElement) {
    return;
  }
  overlayElement.classList.add("is-open");
  overlayElement.setAttribute("aria-hidden", "false");
  syncModalScrollLock();
}

function closeModal(overlayElement) {
  if (!overlayElement) {
    return;
  }
  overlayElement.classList.remove("is-open");
  overlayElement.setAttribute("aria-hidden", "true");
  syncModalScrollLock();
}

function closeAllOverlays() {
  closeModal(elements.productModalOverlay);
  closeModal(elements.clientModalOverlay);
  closeModal(elements.saleModalOverlay);
  closeSaleDetailsModal({ force: true });
  closeModal(elements.saleEditModalOverlay);
  closeFinanceClientModal({ force: true });
  closePaymentModal({ force: true });
}

function nextSequentialId(prefix, collection) {
  const maxValue = collection.reduce((maxId, item) => {
    const parts = String(item.id).split("-");
    const value = Number(parts[1]) || 0;
    return Math.max(maxId, value);
  }, 0);
  return `${prefix}-${String(maxValue + 1).padStart(3, "0")}`;
}

function openCreateProductModal() {
  state.isEditingProduct = false;
  state.activeProductId = null;
  elements.productModalTitle.textContent = "Cadastro de Produto";
  elements.modalProductId.value = nextSequentialId("PRD", state.products);
  elements.modalProductName.value = "";
  elements.modalProductStock.value = "";
  elements.modalProductPrice.value = "";
  elements.modalProductStatus.value = "active";
  openModal(elements.productModalOverlay);
}

function openEditProductModal(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }
  state.isEditingProduct = true;
  state.activeProductId = product.id;
  elements.productModalTitle.textContent = "Editar Produto";
  elements.modalProductId.value = product.id;
  elements.modalProductName.value = product.name;
  elements.modalProductStock.value = String(product.stock);
  elements.modalProductPrice.value = formatCurrencyInputValue(Number(product.price ?? product.preco ?? 0));
  elements.modalProductStatus.value = product.isActive ? "active" : "inactive";
  openModal(elements.productModalOverlay);
}

async function handleSaveProduct(event) {
  event.preventDefault();
  const id = elements.modalProductId.value.trim();
  const name = elements.modalProductName.value.trim();
  const stock = Number(elements.modalProductStock.value);
  const price = parseCurrencyInput(elements.modalProductPrice.value);
  const status = elements.modalProductStatus.value;

  if (!name) {
    window.alert("Informe o nome do produto.");
    return;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    window.alert("Estoque deve ser um numero inteiro igual ou maior que zero.");
    return;
  }
  if (!Number.isFinite(price) || price <= 0) {
    window.alert("Preco deve ser maior que zero.");
    return;
  }

  try {
    const payload = {
      id,
      name,
      stock,
      price,
      isActive: status === "active"
    };

    const savedProduct = state.isEditingProduct ? await updateProduct(payload) : await createProduct(payload);
    if (state.isEditingProduct) {
      state.products = state.products.map((product) => (product.id === savedProduct.id ? savedProduct : product));
    } else {
      state.products = [savedProduct, ...state.products];
    }

    renderProductsList();
    populateSaleProductOptions();
    closeModal(elements.productModalOverlay);
    await refreshDashboardData();
  } catch (error) {
    window.alert(error.message || "Nao foi possivel salvar produto.");
  }
}

function openCreateClientModal() {
  state.isEditingClient = false;
  state.activeClientId = null;
  elements.clientModalTitle.textContent = "Cadastro de Cliente";
  elements.modalClientId.value = nextSequentialId("CLI", state.clients);
  elements.modalClientName.value = "";
  elements.modalClientPhone.value = "";
  elements.modalClientEmail.value = "";
  elements.modalClientBuilding.value = "1";
  syncFloorOptions("1");
  openModal(elements.clientModalOverlay);
}

function openEditClientModal(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) {
    return;
  }
  state.isEditingClient = true;
  state.activeClientId = client.id;
  elements.clientModalTitle.textContent = "Editar Cliente";
  elements.modalClientId.value = client.id;
  elements.modalClientName.value = client.name;
  elements.modalClientPhone.value = client.phone;
  elements.modalClientEmail.value = client.email;
  elements.modalClientBuilding.value = client.building;
  syncFloorOptions(client.building, client.floor);
  openModal(elements.clientModalOverlay);
}

function hasDuplicateClientData(payload, currentClientId) {
  return state.clients.some((client) => {
    if (client.id === currentClientId) {
      return false;
    }
    return (
      normalizeText(client.phone) === normalizeText(payload.phone) ||
      normalizeText(client.email) === normalizeText(payload.email)
    );
  });
}

async function handleSaveClient(event) {
  event.preventDefault();
  const id = elements.modalClientId.value.trim();
  const payload = {
    id,
    name: elements.modalClientName.value.trim(),
    phone: elements.modalClientPhone.value.trim(),
    email: elements.modalClientEmail.value.trim(),
    building: elements.modalClientBuilding.value,
    floor: elements.modalClientFloor.value,
    status: "active"
  };

  if (!payload.name || !payload.phone || !payload.email) {
    window.alert("Preencha nome, telefone e email.");
    return;
  }
  if (hasDuplicateClientData(payload, state.isEditingClient ? state.activeClientId : null)) {
    window.alert("Ja existe cliente com telefone ou email informado.");
    return;
  }

  try {
    const savedClient = state.isEditingClient ? await updateClient(payload) : await createClient(payload);
    if (state.isEditingClient) {
      state.clients = state.clients.map((client) => (client.id === savedClient.id ? savedClient : client));
    } else {
      state.clients = [savedClient, ...state.clients];
    }

    try {
      applyFinanceOverview(await getFinanceOverview());
    } catch (error) {
      // Mantem a atualizacao do cliente mesmo se o resumo financeiro falhar.
    }
    populateClientFilterOptions();
    renderClientsList();
    populateSaleClientOptions();
    renderFinanceList();
    closeModal(elements.clientModalOverlay);
  } catch (error) {
    window.alert(error.message || "Nao foi possivel salvar cliente.");
  }
}

function normalizePaymentMethod(value) {
  const map = {
    pix: "Pix",
    caju: "Caju",
    cash: "Dinheiro",
    credit: "Credito rotativo"
  };
  return map[value] || value;
}

function toggleSalePaymentControls() {
  const method = elements.salePaymentMethod.value;
  const hasTiming = Boolean(elements.salePaymentTiming.value);
  const hasFutureDate = Boolean(elements.salePaymentDate.value);

  if (method === "credit") {
    elements.salePaymentTiming.value = "";
    elements.salePaymentTiming.disabled = true;
    elements.salePaymentDate.disabled = false;
    const tomorrow = toIsoDate(new Date(Date.now() + 86400000));
    elements.salePaymentDate.min = tomorrow;
    if (elements.salePaymentDate.value && elements.salePaymentDate.value < tomorrow) {
      elements.salePaymentDate.value = "";
    }
    return;
  }

  if (hasFutureDate) {
    elements.salePaymentTiming.value = "";
    elements.salePaymentTiming.disabled = true;
    elements.salePaymentDate.disabled = false;
    elements.salePaymentDate.min = toIsoDate(new Date(Date.now() + 86400000));
    return;
  }

  elements.salePaymentTiming.disabled = false;
  elements.salePaymentDate.min = toIsoDate(new Date(Date.now() + 86400000));
  if (hasTiming) {
    elements.salePaymentDate.value = "";
    elements.salePaymentDate.disabled = true;
  } else {
    elements.salePaymentDate.disabled = false;
  }
}

function populateSaleClientOptions() {
  const options = state.clients.map((client) => `<option value="${client.id}">${client.name}</option>`);
  elements.saleClientSelect.innerHTML = options.join("");
}

function getProductById(productId) {
  return state.products.find((product) => product.id === productId) || null;
}

function updateSaleTotalField() {
  const quantity = Number(elements.saleQuantityInput.value);
  const unitPrice = parseCurrencyInput(elements.saleUnitPriceInput.value);

  if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    elements.saleTotalAmount.value = "";
    return Number.NaN;
  }

  const totalAmount = Number((quantity * unitPrice).toFixed(2));
  elements.saleTotalAmount.value = formatCurrency(totalAmount);
  return totalAmount;
}

function syncSaleProductPriceHint(product) {
  if (!product) {
    elements.saleProductPriceHint.textContent = "Preco base do produto: --";
    return;
  }

  const productPrice = Number(product.price ?? product.preco ?? 0);
  elements.saleProductPriceHint.textContent =
    productPrice > 0
      ? `Preco base do produto: ${formatCurrency(productPrice)}`
      : "Produto sem preco cadastrado";
}

function syncSalePricingFromSelectedProduct({ force = false } = {}) {
  const product = getProductById(elements.saleProductSelect.value);
  syncSaleProductPriceHint(product);

  if (!product) {
    elements.saleUnitPriceInput.value = "";
    updateSaleTotalField();
    return;
  }

  const productPrice = Number(product.price ?? product.preco ?? 0);
  if (force || !elements.saleUnitPriceInput.value.trim()) {
    elements.saleUnitPriceInput.value = formatCurrencyInputValue(productPrice);
  }

  updateSaleTotalField();
}

function populateSaleProductOptions() {
  const options = state.products.map((product) => {
    const price = Number(product.price ?? product.preco ?? 0);
    const label = `${product.name} | ${formatCurrency(price)} | ${product.stock} un.`;
    return `<option value="${product.id}">${label}</option>`;
  });
  elements.saleProductSelect.innerHTML = options.join("");
}

function setSaleModalSubmitting(isSubmitting) {
  state.isSubmittingSale = isSubmitting;
  [
    elements.cancelSaleModalBtn,
    elements.saveSaleModalBtn,
    elements.finalizeSaleModalBtn
  ].forEach((button) => {
    if (!button) {
      return;
    }
    button.disabled = isSubmitting;
  });
}

function setSaleEditModalSubmitting(isSubmitting) {
  state.isSubmittingSaleEdit = isSubmitting;
  [elements.deleteSaleEditTopBtn, elements.saveSaleEditTopBtn, elements.finalizeSaleEditTopBtn].forEach((button) => {
    if (!button) {
      return;
    }
    button.disabled = isSubmitting;
  });
}

function openSaleModal({ syncHistory = false } = {}) {
  setSaleModalSubmitting(false);
  elements.saleModalForm.reset();
  populateSaleClientOptions();
  populateSaleProductOptions();
  elements.saleQuantityInput.value = "1";
  elements.saleUnitPriceInput.value = "";
  elements.saleTotalAmount.value = "";
  elements.salePaymentDate.value = "";
  elements.salePaymentTiming.value = "";
  toggleSalePaymentControls();
  syncSalePricingFromSelectedProduct({ force: true });
  openModal(elements.saleModalOverlay);
  if (syncHistory) {
    syncSaleModalHistory();
  }
}

function closeSaleModal({ syncHistory = false, force = false } = {}) {
  if (state.isSubmittingSale && !force) {
    return;
  }

  setSaleModalSubmitting(false);

  if (syncHistory && getSaleModalHistoryState(window.history.state)) {
    window.history.back();
    return;
  }

  closeModal(elements.saleModalOverlay);
}

async function handleSaveSale(event) {
  event.preventDefault();
  if (state.isSubmittingSale) {
    return;
  }

  const submitMode = event.submitter?.dataset.saleSubmitMode === "finalize" ? "finalize" : "save";
  const shouldFinalizeSale = submitMode === "finalize";

  const clientId = elements.saleClientSelect.value;
  const productId = elements.saleProductSelect.value;
  const quantity = Number(elements.saleQuantityInput.value);
  const selectedProduct = getProductById(productId);
  const unitPrice = parseCurrencyInput(elements.saleUnitPriceInput.value);
  const totalAmount = updateSaleTotalField();
  const paymentMethodValue = elements.salePaymentMethod.value;
  const paymentTiming = elements.salePaymentTiming.value;
  const paymentDate = elements.salePaymentDate.value;
  const deliveryType = elements.saleDeliveryType.value;

  if (!clientId || !productId || !quantity) {
    window.alert("Preencha cliente, produto e quantidade.");
    return;
  }
  if (quantity < 1 || !Number.isInteger(quantity)) {
    window.alert("Quantidade deve ser um numero inteiro maior que zero.");
    return;
  }
  if (selectedProduct && quantity > Number(selectedProduct.stock ?? 0)) {
    window.alert("Quantidade nao pode ser maior que o estoque disponivel.");
    return;
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    window.alert("Informe um preco unitario maior que zero.");
    return;
  }
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    window.alert("Informe o valor total da venda.");
    return;
  }
  if (!paymentTiming && !paymentDate) {
    window.alert("Selecione quando pagar ou informe uma data futura.");
    return;
  }
  if (paymentDate) {
    const tomorrow = toIsoDate(new Date(Date.now() + 86400000));
    if (paymentDate < tomorrow) {
      window.alert("Data no calendario deve ser futura.");
      return;
    }
  }
  if (paymentMethodValue === "credit" && !paymentDate) {
    window.alert("Credito rotativo exige data futura.");
    return;
  }

  if (shouldFinalizeSale) {
    const shouldConfirm = window.confirm("Deseja finalizar esta venda agora?");
    if (!shouldConfirm) {
      return;
    }
  }

  setSaleModalSubmitting(true);

  try {
    await createSale({
      clientId,
      productId,
      quantity,
      unitPrice,
      totalAmount,
      deliveryType,
      paymentMethod: normalizePaymentMethod(paymentMethodValue),
      paymentTiming,
      paymentDate,
      finalizeSale: shouldFinalizeSale
    });

    await refreshAllSaleDependencies();
    closeSaleModal({ syncHistory: true, force: true });
  } catch (error) {
    window.alert(error.message || (shouldFinalizeSale ? "Nao foi possivel finalizar venda." : "Nao foi possivel salvar venda."));
  } finally {
    setSaleModalSubmitting(false);
  }
}

function getHistorySaleById(saleId) {
  return state.salesHistory.find((sale) => sale.id === saleId) || null;
}

function setHistoryPaymentSubmitting(isSubmitting) {
  state.isSubmittingHistoryPayment = isSubmitting;
  elements.receiptRegisterPaymentBtn.disabled = isSubmitting;
  elements.deleteSaleDetailsBtn.disabled = isSubmitting;
  elements.closeSaleDetailsBtn.disabled = isSubmitting;
  elements.printSaleReceiptBtn.disabled = isSubmitting;
}

function fillSaleDetailsModal(sale) {
  state.activeHistorySaleId = sale.id;

  elements.receiptClientName.textContent = sale.clientName;
  elements.receiptSaleCode.textContent = sale.id;
  elements.receiptClientPhone.textContent = sale.clientPhone || "--";
  elements.receiptClientAddress.textContent =
    sale.deliveryType === "entrega" ? `Predio ${sale.building} - ${sale.floor}` : "Retirada no local";
  elements.receiptSaleDate.textContent = formatDateOnly(sale.saleDate);
  elements.receiptPaymentDate.textContent = sale.paymentDate ? formatShortDate(sale.paymentDate) : "--";
  elements.receiptPaymentMethod.textContent = sale.paymentMethod;
  elements.receiptPaymentStatus.textContent = sale.paymentStatus;
  elements.receiptSaleStatus.textContent = sale.saleStatus;
  elements.receiptTotalAmount.textContent = formatCurrency(sale.totalAmount);
  elements.receiptPendingAmount.textContent = formatCurrency(sale.pendingAmount || 0);
  elements.receiptBalanceBefore.textContent = formatCurrency(sale.balanceBeforeSale || 0);
  elements.receiptBalanceIncrease.textContent = formatCurrency(sale.saleDebtIncrease || 0);
  elements.receiptBalanceAfter.textContent = formatCurrency(sale.balanceAfterSale || 0);
  elements.receiptCurrentBalance.textContent = formatCurrency(sale.balanceDue || sale.saldo_devendo || 0);

  elements.receiptItems.innerHTML = sale.items
    .map((item) => `
      <div class="receipt-item-row">
        <div class="receipt-item-row__content">
          <p class="receipt-item-row__title">${item.quantity}x ${item.productName}</p>
          <p class="receipt-item-row__meta">${formatCurrency(item.unitPrice)} cada</p>
        </div>
        <span class="receipt-item-row__total">${formatCurrency(item.totalAmount)}</span>
      </div>
    `)
    .join("");

  elements.receiptTransactions.innerHTML = "";
  const transactions = Array.isArray(sale.transactions) ? sale.transactions : [];
  transactions.forEach((transaction) => {
    const meta = getFinanceTransactionMeta(transaction);
    const item = document.createElement("div");
    item.className = "receipt-transaction";
    item.innerHTML = `
      <div class="receipt-transaction__content">
        <p class="receipt-transaction__title">${meta.label}</p>
        <p class="receipt-transaction__description">${transaction.description}</p>
        <p class="receipt-transaction__date">${formatDateTime(transaction.createdAt)}</p>
      </div>
      <span class="receipt-transaction__amount ${meta.className}">
        ${meta.sign}${formatCurrency(transaction.amount)}
      </span>
    `;
    elements.receiptTransactions.appendChild(item);
  });
  elements.receiptTransactionsEmptyState.hidden = transactions.length > 0;

  if (sale.deliveryType === "entrega") {
    elements.receiptDeliveryInfo.innerHTML = `
      <p class="receipt-meta"><strong>Entrega:</strong> Predio ${sale.building} - ${sale.floor}</p>
    `;
  } else {
    elements.receiptDeliveryInfo.innerHTML = `<span class="receipt-tag">Retirada no local</span>`;
  }

  elements.receiptRegisterPaymentBtn.hidden = !(sale.paymentStatus === "Pendente" && Number(sale.pendingAmount || 0) > 0);
  setHistoryPaymentSubmitting(false);
}

function openSaleDetailsModal(saleId) {
  const sale = getHistorySaleById(saleId);
  if (!sale) {
    return;
  }

  fillSaleDetailsModal(sale);
  openModal(elements.saleDetailsModalOverlay);
}

function closeSaleDetailsModal({ force = false } = {}) {
  if (state.isSubmittingHistoryPayment && !force) {
    return;
  }
  state.activeHistorySaleId = null;
  setHistoryPaymentSubmitting(false);
  closeModal(elements.saleDetailsModalOverlay);
}

async function handleSaleReceiptPayment() {
  if (state.isSubmittingHistoryPayment || !state.activeHistorySaleId) {
    return;
  }

  const sale = getHistorySaleById(state.activeHistorySaleId);
  if (!sale || Number(sale.pendingAmount || 0) <= 0) {
    closeSaleDetailsModal({ force: true });
    return;
  }

  const shouldConfirm = window.confirm(
    `Registrar pagamento de ${formatCurrency(sale.pendingAmount)} para a venda ${sale.id}?`
  );
  if (!shouldConfirm) {
    return;
  }

  setHistoryPaymentSubmitting(true);
  try {
    await registerFinancePayment({
      clientId: sale.clientId,
      saleId: sale.id,
      amount: sale.pendingAmount,
      paymentMethod: sale.paymentMethod,
      note: `Pagamento registrado pelo cupom da venda ${sale.id}.`
    });

    await refreshAllSaleDependencies();
    const updatedSale = getHistorySaleById(sale.id);
    if (updatedSale) {
      fillSaleDetailsModal(updatedSale);
    } else {
      closeSaleDetailsModal({ force: true });
    }
  } catch (error) {
    window.alert(error.message || "Nao foi possivel registrar o pagamento da venda.");
  } finally {
    setHistoryPaymentSubmitting(false);
  }
}

function buildSaleDeletionMessage(sale) {
  if (sale?.saleStatus === "Finalizada") {
    return "Esta venda finalizada sera excluida, o estoque sera devolvido e os registros financeiros e do historico serao removidos. Deseja continuar?";
  }

  return "Esta venda ainda nao foi finalizada. Ela sera apenas removida do sistema. Deseja continuar?";
}

async function deleteSaleAndRefresh(saleId, { source }) {
  const sale = getSaleById(saleId) || getHistorySaleById(saleId);
  if (!sale) {
    return;
  }

  const shouldConfirm = window.confirm(buildSaleDeletionMessage(sale));
  if (!shouldConfirm) {
    return;
  }

  if (source === "details") {
    setHistoryPaymentSubmitting(true);
  } else {
    setSaleEditModalSubmitting(true);
  }

  try {
    await removeSale({ id: saleId });
    await refreshAllSaleDependencies();

    if (source === "details") {
      closeSaleDetailsModal({ force: true });
    } else {
      closeSaleEditModal({ syncHistory: true, force: true });
    }
  } catch (error) {
    window.alert(error.message || "Nao foi possivel excluir a venda.");
  } finally {
    if (source === "details") {
      setHistoryPaymentSubmitting(false);
    } else {
      setSaleEditModalSubmitting(false);
    }
  }
}

async function handleDeleteSaleFromDetails() {
  if (state.isSubmittingHistoryPayment || !state.activeHistorySaleId) {
    return;
  }

  await deleteSaleAndRefresh(state.activeHistorySaleId, { source: "details" });
}

async function handleDeleteSaleFromEdit() {
  if (state.isSubmittingSaleEdit || !state.activeSaleId) {
    return;
  }

  await deleteSaleAndRefresh(state.activeSaleId, { source: "edit" });
}

function openSaleEditModal(saleId, { syncHistory = false } = {}) {
  const sale = getSaleById(saleId);
  if (!sale) {
    return;
  }
  state.activeSaleId = sale.id;

  elements.saleEditCodeTop.textContent = sale.id;
  elements.saleEditClientName.value = sale.clientName;
  elements.saleEditItemsBox.textContent = buildSaleItemsText(sale.items).replace(/\n/g, " | ");
  elements.saleEditType.value = formatDeliveryType(sale.deliveryType);
  elements.saleEditDate.value = formatDateTime(sale.saleDate);
  elements.saleEditTotalAmount.value = formatCurrency(sale.totalAmount);
  elements.saleEditLocation.value =
    sale.deliveryType === "entrega" ? `Predio ${sale.building} - ${sale.floor}` : "Retirada no local";
  elements.saleEditPaymentMethod.value = sale.paymentMethod;
  elements.saleEditPaymentStatus.value = sale.paymentStatus;
  elements.finalizeSaleEditTopBtn.hidden = sale.saleStatus === "Finalizada";
  setSaleEditModalSubmitting(false);

  openModal(elements.saleEditModalOverlay);
  if (syncHistory) {
    syncSaleEditModalHistory(sale.id);
  }
}

function closeSaleEditModal({ syncHistory = false, force = false } = {}) {
  if (state.isSubmittingSaleEdit && !force) {
    return;
  }
  if (syncHistory && getSaleEditModalHistoryState(window.history.state)) {
    window.history.back();
    return;
  }

  state.activeSaleId = null;
  setSaleEditModalSubmitting(false);
  closeModal(elements.saleEditModalOverlay);
}

async function handleSaveSaleEdit(event) {
  event.preventDefault();
  if (state.isSubmittingSaleEdit) {
    return;
  }
  if (!state.activeSaleId) {
    return;
  }

  const submitMode = event.submitter?.dataset.saleSubmitMode === "finalize" ? "finalize" : "save";
  const shouldFinalizeSale = submitMode === "finalize";
  const paymentMethod = elements.saleEditPaymentMethod.value;
  const paymentStatus = elements.saleEditPaymentStatus.value;
  if (!paymentMethod || !paymentStatus) {
    window.alert("Preencha forma e status do pagamento.");
    return;
  }

  if (shouldFinalizeSale) {
    const shouldConfirm = window.confirm("Deseja finalizar esta venda agora?");
    if (!shouldConfirm) {
      return;
    }
  }

  setSaleEditModalSubmitting(true);

  try {
    await updateSale({
      id: state.activeSaleId,
      paymentMethod,
      paymentStatus,
      finalizeSale: shouldFinalizeSale
    });
    await refreshAllSaleDependencies();
    closeSaleEditModal({ syncHistory: true, force: true });
  } catch (error) {
    window.alert(error.message || (shouldFinalizeSale ? "Nao foi possivel finalizar venda." : "Nao foi possivel atualizar venda."));
  } finally {
    setSaleEditModalSubmitting(false);
  }
}

async function loadProtectedData() {
  const [products, clients, sales, salesHistory, finance] = await Promise.all([
    getProducts(),
    getClients(),
    getSales(),
    getSalesHistory(buildSalesHistoryQueryParams()),
    getFinanceOverview()
  ]);

  applyProtectedData({ products, clients, sales, salesHistory, finance });

  populateClientFilterOptions();
  populateSaleClientOptions();
  populateSaleProductOptions();
  syncSalePricingFromSelectedProduct();
  renderProductsList();
  renderClientsList();
  renderSalesManageList();
  renderSalesHistoryList();
  renderFinanceList();
  await refreshDashboardData();
}

function setupAppEvents() {
  if (state.appEventsBound) {
    return;
  }

  setupSidebarEvents();
  setupDashboardEvents();
  setupProductEvents();
  setupClientEvents();
  setupSalesManageEvents();
  setupSalesHistoryEvents();
  setupFinanceEvents();
  setupSaleModalEvents();
  setupSaleDetailsEvents();
  setupSaleEditEvents();
  state.appEventsBound = true;
}

async function handleLogout() {
  try {
    await clearAuthSession();
  } catch (error) {
    // Mesmo com erro no endpoint, segue para a tela de login.
  }

  state.authUser = null;
  closeSidebar();
  closeAllOverlays();
  window.location.replace(LOGIN_PAGE_PATH);
}

function setupSidebarEvents() {
  elements.menuBtn.addEventListener("click", () => {
    const shouldOpen = !elements.sidebar.classList.contains("is-open");
    toggleSidebar(shouldOpen);
  });
  elements.overlay.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.sidebar.classList.contains("is-open")) {
      closeSidebar();
    }
  });
  elements.sidebarHomeBtn.addEventListener("click", () => navigateTo("dashboard", { syncHistory: true }));
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener("click", toggleThemePreference);
  }
  elements.logoutBtn.addEventListener("click", () => {
    handleLogout();
  });

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navigateTo(link.dataset.route, { syncHistory: true });
    });
  });
}

async function openRecentOrderForEdit(orderRow) {
  const saleId = orderRow.dataset.saleId;
  if (!saleId) {
    return;
  }

  const hasSaleInState = state.sales.some((sale) => sale.id === saleId);
  if (!hasSaleInState) {
    try {
      state.sales = await getSales();
      renderSalesManageList();
      renderSalesHistoryList();
      renderFinanceList();
    } catch (error) {
      window.alert(error.message || "Nao foi possivel carregar os dados da venda.");
      return;
    }
  }

  window.requestAnimationFrame(() => {
    openSaleEditModal(saleId, { syncHistory: true });
  });
}

function handleRecentOrderClick(event) {
  const orderRow = event.target.closest(".order-row-link");
  if (!orderRow) {
    return;
  }

  openRecentOrderForEdit(orderRow);
}

function handleRecentOrderKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const orderRow = event.target.closest(".order-row-link");
  if (!orderRow) {
    return;
  }

  event.preventDefault();
  openRecentOrderForEdit(orderRow);
}

function setupDashboardEvents() {
  elements.refreshOrdersBtn.addEventListener("click", refreshDashboardData);
  elements.newSaleBtn.addEventListener("click", () => {
    openSaleModal({ syncHistory: true });
  });
  elements.ordersTableBody.addEventListener("click", handleRecentOrderClick);
  elements.ordersTableBody.addEventListener("keydown", handleRecentOrderKeydown);
}

function setupProductEvents() {
  elements.productFiltersForm.addEventListener("input", () => {
    state.productFilters.search = elements.productFiltersForm.search.value || "";
    state.productFilters.stock = elements.productFiltersForm.stock.value || "all";
    state.productFilters.status = elements.productFiltersForm.status.value || "all";
    renderProductsList();
  });

  elements.registerProductBtn.addEventListener("click", openCreateProductModal);
  elements.productsList.addEventListener("click", (event) => {
    const card = event.target.closest(".product-card");
    if (!card) {
      return;
    }
    openEditProductModal(card.dataset.productId);
  });

  elements.productModalForm.addEventListener("submit", handleSaveProduct);
  elements.modalProductPrice.addEventListener("blur", () => {
    formatCurrencyFieldInput(elements.modalProductPrice);
  });
  elements.cancelModalBtn.addEventListener("click", () => {
    const shouldClose = window.confirm("Deseja cancelar?");
    if (shouldClose) {
      closeModal(elements.productModalOverlay);
    }
  });
  elements.productModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.productModalOverlay) {
      closeModal(elements.productModalOverlay);
    }
  });
}

function setupClientEvents() {
  const applyClientFiltersState = () => {
    state.clientFilters.clientId = elements.clientNameFilter.value || "";
    state.clientFilters.phone = elements.clientFiltersForm.phone.value || "";
    state.clientFilters.status = elements.clientFiltersForm.status.value || "all";
    renderClientsList();
  };

  elements.clientFiltersForm.addEventListener("input", applyClientFiltersState);
  elements.clientFiltersForm.addEventListener("change", applyClientFiltersState);

  elements.registerClientBtn.addEventListener("click", openCreateClientModal);
  elements.clientsList.addEventListener("click", (event) => {
    const card = event.target.closest(".client-card");
    if (!card) {
      return;
    }
    openEditClientModal(card.dataset.clientId);
  });

  elements.modalClientBuilding.addEventListener("change", () => {
    syncFloorOptions(elements.modalClientBuilding.value);
  });

  elements.clientModalForm.addEventListener("submit", handleSaveClient);
  elements.cancelClientModalBtn.addEventListener("click", () => {
    const shouldClose = window.confirm("Deseja cancelar?");
    if (shouldClose) {
      closeModal(elements.clientModalOverlay);
    }
  });
  elements.clientModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.clientModalOverlay) {
      closeModal(elements.clientModalOverlay);
    }
  });
}

function setupSalesManageEvents() {
  const applySalesManageFiltersState = () => {
    state.salesManageFilters.clientId = elements.salesManageClientFilter.value || "";
    state.salesManageFilters.saleDate = elements.salesManageFiltersForm.saleDate.value || "";
    state.salesManageFilters.product = elements.salesManageFiltersForm.product.value || "";
    renderSalesManageList();
  };

  elements.salesManageFiltersForm.addEventListener("input", applySalesManageFiltersState);
  elements.salesManageFiltersForm.addEventListener("change", applySalesManageFiltersState);

  elements.salesManageList.addEventListener("click", (event) => {
    const card = event.target.closest(".sale-card");
    if (!card) {
      return;
    }
    openSaleEditModal(card.dataset.saleId);
  });
}

function setupSalesHistoryEvents() {
  const applySalesHistoryFiltersState = async () => {
    state.salesHistoryFilters.clientId = elements.salesHistoryClientFilter.value || "";
    state.salesHistoryFilters.paymentStatus = elements.salesHistoryPaymentStatusFilter.value || "all";
    state.salesHistoryFilters.saleStatus = elements.salesHistorySaleStatusFilter.value || "Finalizada";
    state.salesHistoryFilters.startDate = elements.salesHistoryStartDate.value || "";
    state.salesHistoryFilters.endDate = elements.salesHistoryEndDate.value || "";

    try {
      await refreshSalesHistoryData();
    } catch (error) {
      window.alert(error.message || "Nao foi possivel carregar o historico de vendas.");
    }
  };

  elements.salesHistoryFiltersForm.addEventListener("input", applySalesHistoryFiltersState);
  elements.salesHistoryFiltersForm.addEventListener("change", applySalesHistoryFiltersState);

  const openHistoryRow = (event) => {
    const row = event.target.closest(".history-row");
    if (!row) {
      return;
    }
    openSaleDetailsModal(row.dataset.saleId);
  };

  elements.salesHistoryTableBody.addEventListener("click", openHistoryRow);
  elements.salesHistoryTableBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openHistoryRow(event);
  });
}

function handleFinanceCardSelection(event) {
  const financeCard = event.target.closest(".finance-card");
  if (!financeCard) {
    return;
  }
  openFinanceClientModal(financeCard.dataset.clientId);
}

function setupFinanceEvents() {
  const applyFinanceFiltersState = () => {
    state.financeFilters.clientId = elements.financeClientFilter.value || "";
    state.financeFilters.status = elements.financeStatusFilter.value || "all";
    state.financeFilters.paymentDate = elements.financeDateFilter.value || "";
    renderFinanceList();
  };

  elements.financeFiltersForm.addEventListener("input", applyFinanceFiltersState);
  elements.financeFiltersForm.addEventListener("change", applyFinanceFiltersState);

  elements.financeList.addEventListener("click", handleFinanceCardSelection);
  elements.financeList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const financeCard = event.target.closest(".finance-card");
    if (!financeCard) {
      return;
    }
    event.preventDefault();
    openFinanceClientModal(financeCard.dataset.clientId);
  });

  elements.closeFinanceModalBtn.addEventListener("click", () => {
    closeFinanceClientModal();
  });

  elements.registerPaymentBtn.addEventListener("click", openPaymentModal);
  elements.closePaymentModalBtn.addEventListener("click", closePaymentModal);
  elements.submitPaymentBtn.addEventListener("click", handlePaymentSubmission);
  elements.paymentAmount.addEventListener("blur", () => {
    formatCurrencyFieldInput(elements.paymentAmount);
  });
  elements.paymentModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.paymentModalOverlay) {
      closePaymentModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.paymentModalOverlay.classList.contains("is-open")) {
      closePaymentModal();
    }
  });

  elements.financeClientModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.financeClientModalOverlay) {
      closeFinanceClientModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.financeClientModalOverlay.classList.contains("is-open")) {
      closeFinanceClientModal();
    }
  });
}

function setupSaleModalEvents() {
  elements.saleModalForm.addEventListener("submit", handleSaveSale);
  elements.cancelSaleModalBtn.addEventListener("click", () => {
    closeSaleModal({ syncHistory: true });
  });
  elements.saleModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.saleModalOverlay) {
      closeSaleModal({ syncHistory: true });
    }
  });

  elements.salePaymentMethod.addEventListener("change", toggleSalePaymentControls);
  elements.salePaymentTiming.addEventListener("change", toggleSalePaymentControls);
  elements.salePaymentDate.addEventListener("change", toggleSalePaymentControls);
  elements.saleProductSelect.addEventListener("change", () => {
    syncSalePricingFromSelectedProduct({ force: true });
  });
  elements.saleQuantityInput.addEventListener("input", updateSaleTotalField);
  elements.saleUnitPriceInput.addEventListener("input", updateSaleTotalField);
  elements.saleUnitPriceInput.addEventListener("blur", () => {
    formatCurrencyFieldInput(elements.saleUnitPriceInput);
    updateSaleTotalField();
  });
}

function setupSaleDetailsEvents() {
  elements.closeSaleDetailsBtn.addEventListener("click", closeSaleDetailsModal);
  elements.deleteSaleDetailsBtn.addEventListener("click", handleDeleteSaleFromDetails);
  elements.printSaleReceiptBtn.addEventListener("click", () => {
    window.print();
  });
  elements.receiptRegisterPaymentBtn.addEventListener("click", handleSaleReceiptPayment);
  elements.saleDetailsModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.saleDetailsModalOverlay) {
      closeSaleDetailsModal();
    }
  });
}

function setupSaleEditEvents() {
  elements.saleEditForm.addEventListener("submit", handleSaveSaleEdit);
  elements.deleteSaleEditTopBtn.addEventListener("click", handleDeleteSaleFromEdit);
  elements.saleEditModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.saleEditModalOverlay) {
      closeSaleEditModal({ syncHistory: true });
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.saleEditModalOverlay.classList.contains("is-open")) {
      closeSaleEditModal({ syncHistory: true });
    }
  });
}

async function bootstrap() {
  let session;
  try {
    session = await getAuthSession();
  } catch (error) {
    window.location.replace(LOGIN_PAGE_PATH);
    return;
  }

  if (!session?.user) {
    window.location.replace(LOGIN_PAGE_PATH);
    return;
  }

  state.authUser = session.user;

  try {
    await loadProtectedData();
    setupAppEvents();
    const initialView = getViewFromSearchParams();
    setupBrowserNavigation(initialView);
  } catch (error) {
    window.alert(error.message || "Erro ao carregar dados iniciais.");
    await handleLogout();
  }
}

initializeTheme();
bootstrap();
