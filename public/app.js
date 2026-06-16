const state = {
  user: null,
  clients: [],
  tickets: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Erro na requisicao.");
  return data;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function login(event) {
  event.preventDefault();
  const message = $("#loginMessage");
  message.textContent = "";
  try {
    const { user } = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(formData(event.currentTarget))
    });
    state.user = user;
    await bootDashboard();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  $("#dashboardView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
}

async function bootDashboard() {
  $("#loginView").classList.add("hidden");
  $("#dashboardView").classList.remove("hidden");
  $("#userBadge").textContent = state.user?.name || "Usuario";
  await refreshAll();
}

async function refreshAll() {
  const [dashboard, clientsData, ticketsData] = await Promise.all([
    api("/api/dashboard"),
    api("/api/clients"),
    api("/api/tickets")
  ]);

  state.clients = clientsData.clients;
  state.tickets = ticketsData.tickets;
  renderDashboard(dashboard);
  renderClientOptions();
  renderClients();
  renderTickets();
}

function renderDashboard(dashboard) {
  $("#metricClients").textContent = dashboard.clients;
  $("#metricActiveClients").textContent = dashboard.activeClients;
  $("#metricOpenTickets").textContent = dashboard.openTickets;
  $("#metricHighPriority").textContent = dashboard.highPriority;

  const entries = Object.entries(dashboard.ticketsByStatus);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  $("#statusChart").innerHTML = entries.map(([label, value]) => `
    <div class="bar-row">
      <strong>${escapeHtml(label)}</strong>
      <div class="bar-track"><div class="bar-fill" style="width: ${(value / max) * 100}%"></div></div>
      <span>${value}</span>
    </div>
  `).join("");
}

function renderClientOptions() {
  const select = $("#ticketForm select[name='clientId']");
  select.innerHTML = state.clients
    .map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`)
    .join("");
}

function renderClients() {
  const search = $("#clientSearch").value.toLowerCase();
  const clients = state.clients.filter((client) => (
    client.name.toLowerCase().includes(search) ||
    client.email.toLowerCase().includes(search) ||
    client.segment.toLowerCase().includes(search)
  ));

  $("#clientsTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Contato</th>
          <th>Segmento</th>
          <th>Status</th>
          <th>Cadastro</th>
          <th>Acoes</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map((client) => `
          <tr>
            <td><strong>${escapeHtml(client.name)}</strong></td>
            <td>${escapeHtml(client.email)}<br>${escapeHtml(client.phone)}</td>
            <td>${escapeHtml(client.segment)}</td>
            <td><span class="tag">${escapeHtml(client.status)}</span></td>
            <td>${formatDate(client.createdAt)}</td>
            <td>
              <button class="small-button" data-edit-client="${client.id}">Editar</button>
              <button class="small-button danger" data-delete-client="${client.id}">Excluir</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderTickets() {
  $("#ticketsTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Atendimento</th>
          <th>Cliente</th>
          <th>Prioridade</th>
          <th>Status</th>
          <th>Abertura</th>
          <th>Acoes</th>
        </tr>
      </thead>
      <tbody>
        ${state.tickets.map((ticket) => `
          <tr>
            <td><strong>${escapeHtml(ticket.title)}</strong><br>${escapeHtml(ticket.description)}</td>
            <td>${escapeHtml(ticket.clientName)}</td>
            <td><span class="tag">${escapeHtml(ticket.priority)}</span></td>
            <td>${escapeHtml(ticket.status)}</td>
            <td>${formatDate(ticket.createdAt)}</td>
            <td>
              <button class="small-button" data-close-ticket="${ticket.id}">Concluir</button>
              <button class="small-button danger" data-delete-ticket="${ticket.id}">Excluir</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function saveClient(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formData(form);
  const id = payload.id;
  delete payload.id;
  await api(id ? `/api/clients/${id}` : "/api/clients", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });
  form.reset();
  await refreshAll();
}

async function saveTicket(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formData(form);
  await api("/api/tickets", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  form.reset();
  await refreshAll();
}

function showSection(sectionId) {
  $$(".page-section").forEach((section) => section.classList.toggle("hidden", section.id !== sectionId));
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.section === sectionId));
}

document.addEventListener("click", async (event) => {
  const navButton = event.target.closest("[data-section]");
  if (navButton) showSection(navButton.dataset.section);

  const editClientId = event.target.dataset.editClient;
  if (editClientId) {
    const client = state.clients.find((item) => item.id === editClientId);
    const form = $("#clientForm");
    Object.entries(client).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value;
    });
    showSection("clients");
  }

  const deleteClientId = event.target.dataset.deleteClient;
  if (deleteClientId && confirm("Excluir cliente e atendimentos relacionados?")) {
    await api(`/api/clients/${deleteClientId}`, { method: "DELETE" });
    await refreshAll();
  }

  const closeTicketId = event.target.dataset.closeTicket;
  if (closeTicketId) {
    await api(`/api/tickets/${closeTicketId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "Concluido" })
    });
    await refreshAll();
  }

  const deleteTicketId = event.target.dataset.deleteTicket;
  if (deleteTicketId && confirm("Excluir atendimento?")) {
    await api(`/api/tickets/${deleteTicketId}`, { method: "DELETE" });
    await refreshAll();
  }
});

$("#loginForm").addEventListener("submit", login);
$("#logoutButton").addEventListener("click", logout);
$("#clientForm").addEventListener("submit", saveClient);
$("#ticketForm").addEventListener("submit", saveTicket);
$("#clientSearch").addEventListener("input", renderClients);

api("/api/me")
  .then(({ user }) => {
    state.user = user;
    return bootDashboard();
  })
  .catch(() => {
    $("#loginView").classList.remove("hidden");
  });
