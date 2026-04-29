import { httpGet } from "./httpClient.js";

export async function getSalesHistory(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") {
      return;
    }
    params.set(key, value);
  });

  const query = params.toString();
  const url = query ? `./api/historico.php?${query}` : "./api/historico.php";
  return httpGet(url);
}
