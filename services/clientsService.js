import { mockClients } from "../data/mockData.js";

export async function getClients() {
  // Stub pronto para futura troca por fetch/API.
  return Promise.resolve([...mockClients]);
}
