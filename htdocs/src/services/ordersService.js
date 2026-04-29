import { httpGet } from "./httpClient.js";

export async function getDashboardData() {
  return httpGet("./api/dashboard.php");
}
