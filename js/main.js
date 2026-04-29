import { dashboardMetrics } from "../data/mockData.js";
import { getRecentOrders } from "../services/ordersService.js";
import { getProducts } from "../services/productsService.js";
import { getClients } from "../services/clientsService.js";
import { getSales } from "../services/salesService.js";
import { createKpiCard, createOrderRow, createProductCard, createClientCard, createSaleCard } from "../components/ui.js";

const FLOOR_OPTIONS = {
  "1": ["Terreo", "1 andar"],
  "2": ["1 andar", "2 andar", "3 andar"]
};

const APP_VIEWS = ["dashboard", "sales", "products", "clients", "sales-history"];

const state = {
  currentView: "dashboard",
  products: [],
  clients: [],
  sales: [],
  productFilters: {
    search: "",
    stock: "all",
    status: "all"
  },
  clientFilters: {
    name: "",
    phone: "",
    status: "all"
  },
  salesManageFilters: {
    client: "",
    saleDate: "",
    product: ""
  },
  salesHistoryFilters: {
    client: "",
    status: "all",
    product: ""
  },
  activeProductId: null,
  isEditingProduct: false,
  activeClientId: null,
  isEditingClient: false,
  activeSaleId: null
};

const elements = {
  sidebar: document.getElementById("sidebar"),
  overlay: document.getElementById("overlay"),
  menuBtn: document.getElementById("menuBtn"),
  closeSidebarBtn: document.getElementById("closeSidebar"),
  sidebarHomeBtn: document.getElementById("sidebarHomeBtn"),
  navLinks: Array.from(document.querySelectorAll(".nav-link")),
  topbarTitle: document.querySelector(".topbar__title"),
  newSaleBtn: document.getElementById("newSaleBtn"),

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
  modalProductStatus: document.getElementById("modalProductStatus"),
  cancelModalBtn: document.getElementById("cancelModalBtn"),

  clientFiltersForm: document.getElementById("clientFiltersForm"),
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
  salesManageList: document.getElementById("salesManageList"),
  salesManageEmptyState: document.getElementById("salesManageEmptyState"),
  salesHistoryFiltersForm: document.getElementById("salesHistoryFiltersForm"),
  salesHistoryList: document.getElementById("salesHistoryList"),
  salesHistoryEmptyState: document.getElementById("salesHistoryEmptyState"),

  saleModalOverlay: document.getElementById("saleModalOverlay"),
  saleModalForm: document.getElementById("saleModalForm"),
  saleClientSelect: document.getElementById("saleClientSelect"),
  saleProductSelect: document.getElementById("saleProductSelect"),
  saleQuantityInput: document.getElementById("saleQuantityInput"),
  salePaymentMethod: document.getElementById("salePaymentMethod"),
  salePaymentTiming: document.getElementById("salePaymentTiming"),
  salePaymentDate: document.getElementById("salePaymentDate"),
  saleDeliveryType: document.getElementById("saleDeliveryType"),
  cancelSaleModalBtn: document.getElementById("cancelSaleModalBtn"),

  saleDetailsModalOverlay: document.getElementById("saleDetailsModalOverlay"),
  receiptClientName: document.getElementById("receiptClientName"),
  receiptSaleCode: document.getElementById("receiptSaleCode"),
  receiptSaleDate: document.getElementById("receiptSaleDate"),
  receiptItems: document.getElementById("receiptItems"),
  receiptPaymentMethod: document.getElementById("receiptPaymentMethod"),
  receiptPaymentStatus: document.getElementById("receiptPaymentStatus"),
  receiptSaleStatus: document.getElementById("receiptSaleStatus"),
  receiptDeliveryInfo: document.getElementById("receiptDeliveryInfo"),
  closeSaleDetailsBtn: document.getElementById("closeSaleDetailsBtn"),

  saleEditModalOverlay: document.getElementById("saleEditModalOverlay"),
  saleEditForm: document.getElementById("saleEditForm"),
  saleEditCodeTop: document.getElementById("saleEditCodeTop"),
  saleEditClientName: document.getElementById("saleEditClientName"),
  saleEditItemsBox: document.getElementById("saleEditItemsBox"),
  saleEditType: document.getElementById("saleEditType"),
  saleEditDate: document.getElementById("saleEditDate"),
  saleEditLocation: document.getElementById("saleEditLocation"),
  saleEditPaymentMethod: document.getElementById("saleEditPaymentMethod"),
  saleEditPaymentStatus: document.getElementById("saleEditPaymentStatus")
};

function normalizeText(value) {
  return value.trim().toLowerCase();
}

function toIsoDate(dateInput) {
  return new Date(dateInput).toISOString().slice(0, 10);
}

function formatDateTime(dateInput) {
  const date = new Date(dateInput);
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatDeliveryType(type) {
  return type === "entrega" ? "Entrega" : "Retirada";
}

function buildSaleItemsText(items) {
  return items.map((item) => `${item.productName} x${item.quantity}`).join("\n");
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
    "sales-history": "Historico de Vendas"
  };
  elements.topbarTitle.textContent = titleMap[viewName] || "HOME";
  elements.newSaleBtn.hidden = viewName !== "dashboard";
}

function navigateTo(viewName) {
  if (!APP_VIEWS.includes(viewName)) {
    return;
  }

  state.currentView = viewName;
  elements.views.forEach((viewNode) => {
    viewNode.classList.toggle("view--active", viewNode.dataset.view === viewName);
  });

  elements.navLinks.forEach((link) => {
    link.classList.toggle("nav-link--active", link.dataset.route === viewName);
  });

  updateTopbarByView(viewName);
  closeSidebar();
}

function renderDashboardMetrics() {
  elements.kpiGrid.innerHTML = "";
  dashboardMetrics.forEach((metric) => {
    elements.kpiGrid.appendChild(createKpiCard(metric));
  });
}

async function renderOrders() {
  const orders = await getRecentOrders();
  elements.ordersTableBody.innerHTML = "";
  orders.forEach((order) => {
    elements.ordersTableBody.appendChild(createOrderRow(order));
  });
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

function applyClientFilters(clients, filters) {
  const name = normalizeText(filters.name);
  const phone = normalizeText(filters.phone);

  return clients.filter((client) => {
    const nameMatch = client.name.toLowerCase().includes(name);
    const phoneMatch = client.phone.toLowerCase().includes(phone);
    const statusMatch = filters.status === "all" || client.status === filters.status;
    return nameMatch && phoneMatch && statusMatch;
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

function applySalesManageFilters(sales, filters) {
  const clientTerm = normalizeText(filters.client);
  const productTerm = normalizeText(filters.product);
  return sales.filter((sale) => {
    const clientMatch = sale.clientName.toLowerCase().includes(clientTerm);
    const productMatch = getSaleProductNames(sale).includes(productTerm);
    const dateMatch = !filters.saleDate || toIsoDate(sale.saleDate) === filters.saleDate;
    return clientMatch && productMatch && dateMatch;
  });
}

function applySalesHistoryFilters(sales, filters) {
  const clientTerm = normalizeText(filters.client);
  const productTerm = normalizeText(filters.product);
  return sales.filter((sale) => {
    const clientMatch = sale.clientName.toLowerCase().includes(clientTerm);
    const productMatch = getSaleProductNames(sale).includes(productTerm);
    const statusMatch = filters.status === "all" || sale.saleStatus === filters.status;
    return clientMatch && productMatch && statusMatch;
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

function renderSalesHistoryList() {
  const filtered = applySalesHistoryFilters(state.sales, state.salesHistoryFilters);
  elements.salesHistoryList.innerHTML = "";
  filtered.forEach((sale) => {
    elements.salesHistoryList.appendChild(createSaleCard(sale, { hideId: true, historyMode: true }));
  });
  elements.salesHistoryEmptyState.hidden = filtered.length > 0;
}

function openModal(overlayElement) {
  overlayElement.classList.add("is-open");
  overlayElement.setAttribute("aria-hidden", "false");
}

function closeModal(overlayElement) {
  overlayElement.classList.remove("is-open");
  overlayElement.setAttribute("aria-hidden", "true");
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
  elements.modalProductStatus.value = product.isActive ? "active" : "inactive";
  openModal(elements.productModalOverlay);
}

function handleSaveProduct(event) {
  event.preventDefault();
  const id = elements.modalProductId.value.trim();
  const name = elements.modalProductName.value.trim();
  const stock = Number(elements.modalProductStock.value);
  const status = elements.modalProductStatus.value;

  if (!name) {
    window.alert("Informe o nome do produto.");
    return;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    window.alert("Estoque deve ser um numero inteiro igual ou maior que zero.");
    return;
  }

  const payload = {
    id,
    name,
    stock,
    isActive: status === "active"
  };

  if (state.isEditingProduct) {
    state.products = state.products.map((product) => (product.id === id ? payload : product));
  } else {
    state.products = [...state.products, payload];
  }

  renderProductsList();
  populateSaleProductOptions();
  closeModal(elements.productModalOverlay);
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
      normalizeText(client.name) === normalizeText(payload.name) ||
      normalizeText(client.phone) === normalizeText(payload.phone) ||
      normalizeText(client.email) === normalizeText(payload.email)
    );
  });
}

function handleSaveClient(event) {
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
    window.alert("Ja existe cliente com nome, telefone ou email informado.");
    return;
  }

  if (state.isEditingClient) {
    state.clients = state.clients.map((client) => {
      if (client.id !== state.activeClientId) {
        return client;
      }
      return {
        ...client,
        ...payload
      };
    });
  } else {
    state.clients = [...state.clients, payload];
  }

  renderClientsList();
  populateSaleClientOptions();
  closeModal(elements.clientModalOverlay);
}

function buildSaleDateTime() {
  const now = new Date();
  return now.toISOString();
}

function getPaymentStatusFromSaleForm() {
  if (elements.salePaymentTiming.value) {
    return "Pago";
  }
  return "Pendente";
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
  const today = toIsoDate(new Date());

  if (method === "credit") {
    elements.salePaymentTiming.value = "";
    elements.salePaymentTiming.disabled = true;
    elements.salePaymentDate.disabled = false;
    elements.salePaymentDate.min = today;
    if (elements.salePaymentDate.value && elements.salePaymentDate.value <= today) {
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

function populateSaleProductOptions() {
  const options = state.products.map((product) => `<option value="${product.id}">${product.name}</option>`);
  elements.saleProductSelect.innerHTML = options.join("");
}

function openSaleModal() {
  elements.saleModalForm.reset();
  populateSaleClientOptions();
  populateSaleProductOptions();
  elements.salePaymentDate.value = "";
  elements.salePaymentTiming.value = "";
  toggleSalePaymentControls();
  openModal(elements.saleModalOverlay);
}

function closeSaleModal() {
  closeModal(elements.saleModalOverlay);
}

function getSelectedClient(clientId) {
  return state.clients.find((client) => client.id === clientId);
}

function getSelectedProduct(productId) {
  return state.products.find((product) => product.id === productId);
}

function handleSaveSale(event) {
  event.preventDefault();

  const clientId = elements.saleClientSelect.value;
  const productId = elements.saleProductSelect.value;
  const quantity = Number(elements.saleQuantityInput.value);
  const paymentMethodValue = elements.salePaymentMethod.value;
  const paymentTiming = elements.salePaymentTiming.value;
  const paymentDate = elements.salePaymentDate.value;
  const deliveryType = elements.saleDeliveryType.value;
  const saleDateTime = buildSaleDateTime();

  if (!clientId || !productId || !quantity) {
    window.alert("Preencha cliente, produto e quantidade.");
    return;
  }
  if (quantity < 1 || !Number.isInteger(quantity)) {
    window.alert("Quantidade deve ser um numero inteiro maior que zero.");
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

  const client = getSelectedClient(clientId);
  const product = getSelectedProduct(productId);
  if (!client || !product) {
    window.alert("Cliente ou produto invalido.");
    return;
  }

  const sale = {
    id: nextSequentialId("VEN", state.sales),
    clientId: client.id,
    clientName: client.name,
    saleDate: saleDateTime,
    saleStatus: "Em preparacao",
    paymentStatus: paymentDate ? "Pendente" : "Pago",
    paymentMethod: normalizePaymentMethod(paymentMethodValue),
    deliveryType,
    building: deliveryType === "entrega" ? client.building : "",
    floor: deliveryType === "entrega" ? client.floor : "",
    estimatedDelivery: deliveryType === "entrega" ? "25 min" : "",
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity
      }
    ]
  };

  state.sales = [sale, ...state.sales];
  renderSalesManageList();
  renderSalesHistoryList();
  closeSaleModal();
}

function openSaleDetailsModal(saleId) {
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) {
    return;
  }

  elements.receiptClientName.textContent = sale.clientName;
  elements.receiptSaleCode.textContent = sale.id;
  elements.receiptSaleDate.textContent = formatDateTime(sale.saleDate);
  elements.receiptItems.innerHTML = sale.items
    .map((item) => `<p class="receipt-item-line">${item.productName} x${item.quantity}</p>`)
    .join("");
  elements.receiptPaymentMethod.textContent = sale.paymentMethod;
  elements.receiptPaymentStatus.textContent = sale.paymentStatus;
  elements.receiptSaleStatus.textContent = sale.saleStatus;

  if (sale.deliveryType === "entrega") {
    elements.receiptDeliveryInfo.innerHTML = `
      <p class="receipt-meta"><strong>Predio:</strong> ${sale.building}</p>
      <p class="receipt-meta"><strong>Andar:</strong> ${sale.floor}</p>
      <p class="receipt-meta"><strong>Tempo estimado:</strong> ${sale.estimatedDelivery}</p>
    `;
  } else {
    elements.receiptDeliveryInfo.innerHTML = `<span class="receipt-tag">Retirada no local</span>`;
  }

  openModal(elements.saleDetailsModalOverlay);
}

function closeSaleDetailsModal() {
  closeModal(elements.saleDetailsModalOverlay);
}

function openSaleEditModal(saleId) {
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) {
    return;
  }
  state.activeSaleId = sale.id;

  elements.saleEditCodeTop.textContent = sale.id;
  elements.saleEditClientName.value = sale.clientName;
  elements.saleEditItemsBox.textContent = buildSaleItemsText(sale.items).replace(/\n/g, " | ");
  elements.saleEditType.value = formatDeliveryType(sale.deliveryType);
  elements.saleEditDate.value = formatDateTime(sale.saleDate);
  elements.saleEditLocation.value =
    sale.deliveryType === "entrega" ? `Predio ${sale.building} - ${sale.floor}` : "Retirada no local";
  elements.saleEditPaymentMethod.value = sale.paymentMethod;
  elements.saleEditPaymentStatus.value = sale.paymentStatus;

  openModal(elements.saleEditModalOverlay);
}

function closeSaleEditModal() {
  state.activeSaleId = null;
  closeModal(elements.saleEditModalOverlay);
}

function handleSaveSaleEdit(event) {
  event.preventDefault();
  if (!state.activeSaleId) {
    return;
  }

  const paymentMethod = elements.saleEditPaymentMethod.value;
  const paymentStatus = elements.saleEditPaymentStatus.value;
  if (!paymentMethod || !paymentStatus) {
    window.alert("Preencha forma e status do pagamento.");
    return;
  }

  state.sales = state.sales.map((sale) => {
    if (sale.id !== state.activeSaleId) {
      return sale;
    }
    return {
      ...sale,
      paymentMethod,
      paymentStatus
    };
  });

  renderSalesManageList();
  renderSalesHistoryList();
  closeSaleEditModal();
}

function setupSidebarEvents() {
  elements.menuBtn.addEventListener("click", openSidebar);
  elements.closeSidebarBtn.addEventListener("click", closeSidebar);
  elements.overlay.addEventListener("click", closeSidebar);
  elements.sidebarHomeBtn.addEventListener("click", () => navigateTo("dashboard"));

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navigateTo(link.dataset.route);
    });
  });
}

function setupDashboardEvents() {
  elements.refreshOrdersBtn.addEventListener("click", renderOrders);
  elements.newSaleBtn.addEventListener("click", openSaleModal);
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
  elements.clientFiltersForm.addEventListener("input", () => {
    state.clientFilters.name = elements.clientFiltersForm.name.value || "";
    state.clientFilters.phone = elements.clientFiltersForm.phone.value || "";
    state.clientFilters.status = elements.clientFiltersForm.status.value || "all";
    renderClientsList();
  });

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
  elements.salesManageFiltersForm.addEventListener("input", () => {
    state.salesManageFilters.client = elements.salesManageFiltersForm.client.value || "";
    state.salesManageFilters.saleDate = elements.salesManageFiltersForm.saleDate.value || "";
    state.salesManageFilters.product = elements.salesManageFiltersForm.product.value || "";
    renderSalesManageList();
  });

  elements.salesManageList.addEventListener("click", (event) => {
    const card = event.target.closest(".sale-card");
    if (!card) {
      return;
    }
    openSaleEditModal(card.dataset.saleId);
  });
}

function setupSalesHistoryEvents() {
  elements.salesHistoryFiltersForm.addEventListener("input", () => {
    state.salesHistoryFilters.client = elements.salesHistoryFiltersForm.client.value || "";
    state.salesHistoryFilters.status = elements.salesHistoryFiltersForm.status.value || "all";
    state.salesHistoryFilters.product = elements.salesHistoryFiltersForm.product.value || "";
    renderSalesHistoryList();
  });

  elements.salesHistoryList.addEventListener("click", (event) => {
    const card = event.target.closest(".sale-card");
    if (!card) {
      return;
    }
    openSaleDetailsModal(card.dataset.saleId);
  });
}

function setupSaleModalEvents() {
  elements.saleModalForm.addEventListener("submit", handleSaveSale);
  elements.cancelSaleModalBtn.addEventListener("click", closeSaleModal);
  elements.saleModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.saleModalOverlay) {
      closeSaleModal();
    }
  });

  elements.salePaymentMethod.addEventListener("change", toggleSalePaymentControls);
  elements.salePaymentTiming.addEventListener("change", toggleSalePaymentControls);
  elements.salePaymentDate.addEventListener("change", toggleSalePaymentControls);
}

function setupSaleDetailsEvents() {
  elements.closeSaleDetailsBtn.addEventListener("click", closeSaleDetailsModal);
  elements.saleDetailsModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.saleDetailsModalOverlay) {
      closeSaleDetailsModal();
    }
  });
}

function setupSaleEditEvents() {
  elements.saleEditForm.addEventListener("submit", handleSaveSaleEdit);
  elements.saleEditModalOverlay.addEventListener("click", (event) => {
    if (event.target === elements.saleEditModalOverlay) {
      closeSaleEditModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.saleEditModalOverlay.classList.contains("is-open")) {
      closeSaleEditModal();
    }
  });
}

async function bootstrap() {
  state.products = await getProducts();
  state.clients = await getClients();
  state.sales = await getSales();

  renderDashboardMetrics();
  await renderOrders();
  renderProductsList();
  renderClientsList();
  renderSalesManageList();
  renderSalesHistoryList();

  setupSidebarEvents();
  setupDashboardEvents();
  setupProductEvents();
  setupClientEvents();
  setupSalesManageEvents();
  setupSalesHistoryEvents();
  setupSaleModalEvents();
  setupSaleDetailsEvents();
  setupSaleEditEvents();

  navigateTo("dashboard");
}

bootstrap();
