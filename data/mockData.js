export const dashboardMetrics = [
  {
    id: "sales-day",
    label: "Total Vendas Dia",
    value: "R$ 7.840,90",
    type: "highlight"
  },
  {
    id: "orders-pending",
    label: "Pedidos Pendentes",
    value: "12",
    type: "warning",
    badge: "Atencao"
  },
  {
    id: "stock-current",
    label: "Estoque Atual",
    value: "328 itens",
    type: "default"
  }
];

export const recentOrders = [
  { id: "#1021", customer: "Marina Silva", status: "Pendente", elapsedTime: "ha 5 min" },
  { id: "#1020", customer: "Carlos Lima", status: "Preparando", elapsedTime: "ha 11 min" },
  { id: "#1019", customer: "Ana Souza", status: "Concluido", elapsedTime: "ha 18 min" },
  { id: "#1018", customer: "Joao Pereira", status: "Pendente", elapsedTime: "ha 26 min" },
  { id: "#1017", customer: "Fernanda Rocha", status: "Concluido", elapsedTime: "ha 34 min" }
];

export const mockProducts = [
  { id: "PRD-001", name: "Torta de morango", stock: 42, isActive: true },
  { id: "PRD-002", name: "Torta de limao", stock: 0, isActive: true },
  { id: "PRD-003", name: "Torta de maracuja", stock: 18, isActive: false }
];

export const mockClients = [
  {
    id: "CLI-001",
    name: "Marina Souza",
    phone: "11999887766",
    email: "marina.souza@email.com",
    building: "1",
    floor: "Terreo",
    status: "active"
  },
  {
    id: "CLI-002",
    name: "Carlos Menezes",
    phone: "11988776655",
    email: "carlos.menezes@email.com",
    building: "2",
    floor: "2 andar",
    status: "inactive"
  },
  {
    id: "CLI-003",
    name: "Fernanda Lima",
    phone: "11977665544",
    email: "fernanda.lima@email.com",
    building: "1",
    floor: "1 andar",
    status: "active"
  }
];

export const mockSales = [
  {
    id: "VEN-001",
    clientId: "CLI-001",
    clientName: "Marina Souza",
    saleDate: "2026-03-01",
    saleStatus: "Em preparacao",
    paymentStatus: "Pago",
    paymentMethod: "Pix",
    deliveryType: "entrega",
    building: "1",
    floor: "Terreo",
    estimatedDelivery: "25 min",
    items: [{ productId: "PRD-001", productName: "Torta de morango", quantity: 2 }]
  },
  {
    id: "VEN-002",
    clientId: "CLI-002",
    clientName: "Carlos Menezes",
    saleDate: "2026-03-01",
    saleStatus: "Em andamento",
    paymentStatus: "Pendente",
    paymentMethod: "Credito rotativo",
    deliveryType: "retirada",
    building: "",
    floor: "",
    estimatedDelivery: "",
    items: [{ productId: "PRD-002", productName: "Torta de limao", quantity: 1 }]
  },
  {
    id: "VEN-003",
    clientId: "CLI-003",
    clientName: "Fernanda Lima",
    saleDate: "2026-02-28",
    saleStatus: "Finalizada",
    paymentStatus: "Pago",
    paymentMethod: "Dinheiro",
    deliveryType: "entrega",
    building: "1",
    floor: "1 andar",
    estimatedDelivery: "30 min",
    items: [{ productId: "PRD-003", productName: "Torta de maracuja", quantity: 3 }]
  }
];
