import { httpGet, httpPost, httpPut } from "./httpClient.js";

export async function getProducts() {
  return httpGet("./api/produtos.php");
}

export async function createProduct(payload) {
  return httpPost("./api/produtos.php", payload);
}

export async function updateProduct(payload) {
  return httpPut("./api/produtos.php", payload);
}
