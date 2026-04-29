function isLoginPagePath() {
  const path = String(window.location.pathname || "").toLowerCase();
  return path.endsWith("/login.php") || path.endsWith("/login.html");
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));

  const shouldRedirectToLogin =
    response.status === 401 &&
    /sessao expirada/i.test(String(payload.message || "")) &&
    !isLoginPagePath();
  if (shouldRedirectToLogin) {
    window.location.replace("./login.php");
  }

  if (!response.ok || payload.success === false) {
    const details = payload.error ? ` Detalhes: ${payload.error}` : "";
    const message = `${payload.message || "Erro na requisicao."}${details}`;
    throw new Error(message);
  }
  return payload.data;
}

export async function httpGet(url) {
  const response = await fetch(url, { method: "GET" });
  return parseResponse(response);
}

export async function httpPost(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}

export async function httpPut(url, body) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}

export async function httpDelete(url, body) {
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}
