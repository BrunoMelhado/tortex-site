import { httpDelete, httpGet, httpPost, httpPut } from "./httpClient.js";

export async function getSales(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") {
      return;
    }
    params.set(key, value);
  });

  const query = params.toString();
  const url = query ? `./api/vendas.php?${query}` : "./api/vendas.php";
  return httpGet(url);
}

export async function createSale(payload) {
  return httpPost("./api/vendas.php", payload);
}

export async function updateSale(payload) {
  return httpPut("./api/vendas.php", payload);
}

export async function deleteSale(payload) {
  return httpDelete("./api/vendas.php", payload);
}
