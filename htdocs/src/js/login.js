import { authenticateUser, getAuthSession } from "../services/authService.js";

const HOME_PAGE_PATH = "./index.php?view=dashboard";

const elements = {
  loginForm: document.getElementById("loginForm"),
  loginInput: document.getElementById("loginInput"),
  loginPasswordInput: document.getElementById("loginPasswordInput"),
  toggleLoginPasswordBtn: document.getElementById("toggleLoginPasswordBtn"),
  loginError: document.getElementById("loginError"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn")
};

function clearLoginError() {
  elements.loginError.hidden = true;
  elements.loginError.textContent = "";
}

function showLoginError(message) {
  elements.loginError.hidden = false;
  elements.loginError.textContent = message;
}

function getLoginValidationMessage(login, password) {
  if (!login && !password) {
    return "Preencha login e senha.";
  }
  if (!login) {
    return "Informe o login ou e-mail.";
  }
  if (!password) {
    return "Informe a senha.";
  }
  return "";
}

function getAuthErrorMessage(error) {
  if (error?.code === "empty_fields") {
    return "Preencha login e senha.";
  }
  if (error?.code === "invalid_user") {
    return "Usuario invalido. Verifique o login informado.";
  }
  if (error?.code === "invalid_password") {
    return "Senha incorreta. Tente novamente.";
  }
  return error?.message || "Nao foi possivel autenticar.";
}

function syncPasswordToggleButton() {
  const isVisible = elements.loginPasswordInput.type === "text";
  elements.toggleLoginPasswordBtn.textContent = isVisible ? "Ocultar" : "Mostrar";
  elements.toggleLoginPasswordBtn.setAttribute(
    "aria-label",
    isVisible ? "Ocultar senha" : "Mostrar senha"
  );
}

function togglePasswordVisibility() {
  elements.loginPasswordInput.type = elements.loginPasswordInput.type === "password" ? "text" : "password";
  syncPasswordToggleButton();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearLoginError();

  const login = elements.loginInput.value.trim();
  const password = elements.loginPasswordInput.value;
  const validationMessage = getLoginValidationMessage(login, password);
  if (validationMessage) {
    showLoginError(validationMessage);
    return;
  }

  const buttonLabel = elements.loginSubmitBtn.textContent;
  elements.loginSubmitBtn.disabled = true;
  elements.loginSubmitBtn.textContent = "Entrando...";

  try {
    await authenticateUser(login, password);
    window.location.replace(HOME_PAGE_PATH);
  } catch (error) {
    showLoginError(getAuthErrorMessage(error));
  } finally {
    elements.loginSubmitBtn.disabled = false;
    elements.loginSubmitBtn.textContent = buttonLabel;
  }
}

function setupLoginEvents() {
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
  elements.toggleLoginPasswordBtn.addEventListener("click", togglePasswordVisibility);
  syncPasswordToggleButton();
  clearLoginError();
}

async function bootstrap() {
  try {
    const session = await getAuthSession();
    if (session?.user) {
      window.location.replace(HOME_PAGE_PATH);
      return;
    }
  } catch (error) {
    // Sem sessao ativa: permanece no login.
  }

  setupLoginEvents();
  elements.loginInput.focus();
}

bootstrap();
