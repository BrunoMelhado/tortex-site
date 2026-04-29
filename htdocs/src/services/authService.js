import { httpGet, httpPost } from "./httpClient.js";

export async function authenticateUser(login, password) {
  const normalizedLogin = String(login || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedLogin || !normalizedPassword) {
    const error = new Error("Preencha login e senha.");
    error.code = "empty_fields";
    throw error;
  }

  return httpPost("./login.php", {
    login: normalizedLogin,
    password: normalizedPassword
  });
}

export async function getAuthSession() {
  return httpGet("./auth_check.php?json=1");
}

export async function clearAuthSession() {
  return httpPost("./logout.php", {});
}
