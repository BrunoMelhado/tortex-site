import { recentOrders } from "../data/mockData.js";

export async function getRecentOrders() {
  // Estrutura pronta para trocar mock por fetch/API no futuro.
  return Promise.resolve([...recentOrders]);
}
