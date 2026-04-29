const orderStatusClassMap = {
  Pendente: "badge badge--pending",
  Preparando: "badge badge--preparing",
  Concluido: "badge badge--done"
};

export function createKpiCard(metric) {
  const card = document.createElement("article");
  card.className = `kpi-card ${metric.type ? `kpi-card--${metric.type}` : ""}`.trim();

  const label = document.createElement("p");
  label.className = "kpi-card__label";
  label.textContent = metric.label;

  const value = document.createElement("p");
  value.className = "kpi-card__value";
  value.textContent = metric.value;

  card.append(label, value);

  if (metric.badge) {
    const badge = document.createElement("span");
    badge.className = "badge badge--warning";
    badge.textContent = metric.badge;
    card.appendChild(badge);
  }

  return card;
}

export function createOrderRow(order) {
  const row = document.createElement("tr");
  const badgeClass = orderStatusClassMap[order.status] || "badge";

  row.innerHTML = `
    <td>${order.id}</td>
    <td>${order.customer}</td>
    <td><span class="${badgeClass}">${order.status}</span></td>
    <td>${order.elapsedTime}</td>
  `;

  return row;
}

function productStockClass(inStock) {
  return inStock ? "badge badge--stock-in" : "badge badge--stock-out";
}

function productStatusClass(isActive) {
  return isActive ? "badge badge--status-active" : "badge badge--status-inactive";
}

export function createProductCard(product) {
  const stockAmount = Number(product.stock ?? 0);
  const hasStock = typeof product.inStock === "boolean" ? product.inStock : stockAmount > 0;

  const item = document.createElement("article");
  item.className = "product-card";
  item.dataset.productId = product.id;

  const productName = document.createElement("h3");
  productName.className = "product-card__name";
  productName.textContent = product.name;

  const meta = document.createElement("div");
  meta.className = "product-card__meta";
  meta.innerHTML = `
    <span class="${productStockClass(hasStock)}">${hasStock ? "Com estoque" : "Sem estoque"}</span>
    <span class="badge">${stockAmount} un.</span>
    <span class="${productStatusClass(product.isActive)}">${product.isActive ? "Ativo" : "Inativo"}</span>
  `;

  item.append(productName, meta);

  return item;
}

export function createClientCard(client) {
  const item = document.createElement("article");
  item.className = "client-card";
  item.dataset.clientId = client.id;

  const header = document.createElement("div");
  header.className = "client-card__header";
  header.innerHTML = `
    <p class="client-card__code">${client.id}</p>
    <span class="${productStatusClass(client.status === "active")}">${client.status === "active" ? "Ativo" : "Inativo"}</span>
  `;

  const name = document.createElement("h3");
  name.className = "client-card__name";
  name.textContent = client.name;

  item.append(header, name);
  return item;
}

function saleStatusClass(saleStatus) {
  if (saleStatus === "Finalizada") {
    return "badge badge--done";
  }
  if (saleStatus === "Em andamento") {
    return "badge badge--preparing";
  }
  return "badge badge--pending";
}

function paymentStatusClass(paymentStatus) {
  return paymentStatus === "Pago" ? "badge badge--status-active" : "badge badge--status-inactive";
}

function formatSaleDate(saleDate) {
  const parsedDate = new Date(saleDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(saleDate);
  }
  return parsedDate.toLocaleDateString("pt-BR");
}

export function createSaleCard(sale, options = {}) {
  const { hideId = false, historyMode = false } = options;
  const item = document.createElement("article");
  item.className = `sale-card ${historyMode ? "sale-card--history" : ""}`.trim();
  item.dataset.saleId = sale.id;

  const firstItem = sale.items?.[0];
  const productLabel = firstItem ? `${firstItem.productName} - ${firstItem.quantity}` : "Sem itens";
  const idMarkup = hideId ? "" : `<p class="sale-card__code">${sale.id}</p>`;
  const dateMarkup = historyMode ? `<p class="sale-card__date">${formatSaleDate(sale.saleDate)}</p>` : "";
  const productMarkup = historyMode ? `<p class="sale-card__item">${productLabel}</p>` : "";
  const statusMarkup = `<span class="${saleStatusClass(sale.saleStatus)}">${sale.saleStatus}</span>`;
  const topRightMarkup = historyMode ? dateMarkup : "";

  item.innerHTML = `
    <div class="sale-card__top">
      ${idMarkup}
      ${topRightMarkup}
    </div>
    <div class="sale-card__main">
      <h3 class="sale-card__client">${sale.clientName}</h3>
      ${statusMarkup}
    </div>
    <div class="sale-card__meta">
      ${historyMode ? productMarkup : `<span class="${paymentStatusClass(sale.paymentStatus)}">${sale.paymentStatus}</span>`}
    </div>
  `;

  return item;
}
