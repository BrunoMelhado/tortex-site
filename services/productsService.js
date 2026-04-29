import { mockProducts } from "../data/mockData.js";

export async function getProducts() {
  // Stub pronto para substituir por fetch/API no futuro.
  return Promise.resolve([...mockProducts]);
}
