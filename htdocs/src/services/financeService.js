import { httpGet, httpPost } from "./httpClient.js";

export async function getFinanceOverview() {
  return httpGet("./api/financeiro.php");
}

export async function registerFinancePayment(payload) {
  return httpPost("./api/financeiro.php", payload);
}
