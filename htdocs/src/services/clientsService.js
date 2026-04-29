import { httpDelete, httpGet, httpPost, httpPut } from "./httpClient.js";

export async function getClients() {
  return httpGet("./api/clientes.php");
}

export async function createClient(payload) {
  return httpPost("./api/clientes.php", payload);
}

export async function updateClient(payload) {
  return httpPut("./api/clientes.php", payload);
}

export async function deleteClient(payload) {
  return httpDelete("./api/clientes.php", payload);
}
