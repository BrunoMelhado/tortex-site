import { mockSales } from "../data/mockData.js";

export async function getSales() {
  // Stub pronto para futura troca por fetch/API.
  return Promise.resolve([...mockSales]);
}
