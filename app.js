const icons = {
  clock: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 13h9.4l.8-13M9 7V4h6v3"/></svg>',
};

const state = {
  tasks: [],
  filter: "all",
  notificationPermission: "default",
  session: null,
  authMode: "signin",
};

const elements = {
  authScreen: document.querySelector("#auth-screen"),
  authForm: document.querySelector("#auth-form"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authHeading: document.querySelector("#auth-heading"),
  authDescription: document.querySelector("#auth-description"),
  authSubmit: document.querySelector("#auth-submit"),
  authToggle: document.querySelector("#auth-toggle"),
  authMessage: document.querySelector("#auth-message"),
  authConfigHelp: document.querySelector("#auth-config-help"),
  appShell: document.querySelector("#app-shell"),
  logoutButton: document.querySelector("#logout-button"),
  list: document.querySelector("#task-list"),
  form: document.querySelector("#task-form"),
  titleInput: document.querySelector("#task-title"),
  reminderInput: document.querySelector("#task-reminder"),
  notificationButton: document.querySelector("#notification-button"),
  notificationButtonLabel: document.querySelector("#notification-button-label"),
  notificationStatus: document.querySelector("#notification-status"),
  formError: document.querySelector("#form-error"),
  saveButton: document.querySelector("#save-button"),
  toastContainer: document.querySelector("#toast-container"),
};

const priorityLabels = { high: "Tinggi", normal: "Sedang", low: "Rendah" };
const sectionLabels = { all: "Semua tugas", today: "Hari ini", upcoming: "Mendatang", completed: "Selesai" };
const sessionKey = "ruang-tugas.supabase.session";
const supabaseConfig = window.SUPABASE_CONFIG || {};

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function taskDateKey(value) {
  const date = parseLocalDate(value);
  return date ? localDateKey(date) : "";
}

function formatDate(value, options = {}) {
  const date = parseLocalDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    ...options,
  }).format(date);
}

function formatTime(value) {
  const date = parseLocalDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function startClock() {
  const updateClock = () => {
    const now = new Date();
    const currentHour = now.getHours();
    let greeting = "Selamat malam";
    if (currentHour >= 4 && currentHour < 11) greeting = "Selamat pagi";
    else if (currentHour >= 11 && currentHour < 15) greeting = "Selamat siang";
    else if (currentHour >= 15 && currentHour < 18) greeting = "Selamat sore";
    document.querySelector("#greeting-title").innerHTML = `${greeting}<span class="heading-period">.</span>`;
    document.querySelector("#topbar-date").textContent = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
    document.querySelector("#live-clock").textContent = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(now);
  };
  updateClock();
  window.setInterval(updateClock, 1000);
}

function readSession() {
  try {
    const stored = localStorage.getItem(sessionKey);
    return stored ? JSON.parse(stored) : null;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

function saveSession(session) {
  state.session = session;
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function clearSession() {
  state.session = null;
  localStorage.removeItem(sessionKey);
}

function formatRequestError(data, fallback) {
  return data?.msg || data?.message || data?.error_description || data?.error || fallback;
}

async function supabaseRequest(path, { method = "GET", body, token, prefer } = {}) {
  const baseUrl = String(supabaseConfig.url || "").replace(/\/+$/, "");
  const anonKey = String(supabaseConfig.anonKey || "");
  if (!baseUrl || !anonKey) {
    throw new Error("Supabase belum dikonfigurasi. Isi public/config.js sesuai panduan README.");
  }

  const headers = { apikey: anonKey };
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (anonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${anonKey}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  let response;
  let text;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    text = await response.text();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Permintaan ke Supabase melewati batas waktu 20 detik. Coba lagi.");
    }
    throw new Error(`Tidak dapat terhubung ke Supabase: ${error.message}`);
  } finally {
    window.clearTimeout(timeoutId);
  }

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Respons Supabase tidak dapat dibaca.");
    }
  }
  if (!response.ok) {
    const error = new Error(formatRequestError(data, `Permintaan gagal (${response.status}).`));
    error.status = response.status;
    throw error;
  }
  return data;
}

function sessionFromResponse(response) {
  if (!response?.access_token || !response?.refresh_token || !response?.user) return null;
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: response.expires_at || Math.floor(Date.now() / 1000) + (response.expires_in || 3600),
    user: response.user,
  };
}

async function refreshSession() {
  const session = state.session || readSession();
  if (!session?.refresh_token) {
    clearSession();
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }
  try {
    const response = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
    });
    const refreshed = sessionFromResponse(response);
    if (!refreshed) throw new Error("Supabase tidak mengembalikan sesi yang valid.");
    saveSession(refreshed);
    return refreshed;
  } catch (error) {
    clearSession();
    throw new Error(`Sesi berakhir. Silakan masuk kembali. (${error.message})`);
  }
}

async function authenticatedRequest(path, options = {}) {
  let session = state.session || readSession();
  if (!session?.access_token) throw new Error("Silakan masuk untuk mengakses tugas.");
  if (session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
    session = await refreshSession();
  }
  try {
    return await supabaseRequest(path, { ...options, token: session.access_token });
  } catch (error) {
    if (error.status !== 401) throw error;
    session = await refreshSession();
    return supabaseRequest(path, { ...options, token: session.access_token });
  }
}

function setAuthMessage(message, type = "") {
  elements.authMessage.textContent = message;
  elements.authMessage.classList.toggle("success", type === "success");
}

function updateAuthMode() {
  const isSignup = state.authMode === "signup";
  elements.authHeading.textContent = isSignup ? "Buat akun baru" : "Masuk ke Ruang Tugas";
  elements.authDescription.textContent = isSignup
    ? "Buat akun agar tugasmu tersimpan pribadi dan bisa diakses dari perangkat mana pun."
    : "Simpan dan akses tugasmu dengan aman dari perangkat mana pun.";
  elements.authSubmit.textContent = isSignup ? "Buat akun" : "Masuk";
  elements.authToggle.textContent = isSignup ? "Sudah punya akun? Masuk" : "Belum punya akun? Buat akun";
  elements.authPassword.autocomplete = isSignup ? "new-password" : "current-password";
  setAuthMessage("");
}

function showAuthScreen(message = "", type = "") {
  elements.authScreen.hidden = false;
  elements.appShell.hidden = true;
  setAuthMessage(message, type);
}

async function signOut() {
  const session = state.session;
  let error;
  if (session?.access_token) {
    try {
      await supabaseRequest("/auth/v1/logout", { method: "POST", token: session.access_token });
    } catch (requestError) {
      error = requestError;
    }
  }
  clearSession();
  state.tasks = [];
  showAuthScreen(error ? `Sesi lokal dihapus, tetapi server gagal logout: ${error.message}` : "Kamu sudah keluar.", error ? "" : "success");
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  elements.toastContainer.append(toast);
  window.setTimeout(() => {
    toast.classList.add("toast-leaving");
    window.setTimeout(() => toast.remove(), 220);
  }, 3000);
}

function visibleTasks() {
  const today = localDateKey(new Date());
  return state.tasks.filter((task) => {
    if (state.filter === "completed") return task.completed;
    if (task.completed) return false;
    if (state.filter === "today") return taskDateKey(task.due_at) === today;
    if (state.filter === "upcoming") return Boolean(task.due_at) && taskDateKey(task.due_at) > today;
    return true;
  });
}

function dueLabel(task) {
  if (!task.due_at) return "";
  const date = parseLocalDate(task.due_at);
  if (!date) return "";
  const now = new Date();
  const dateKey = localDateKey(date);
  let label = formatDate(task.due_at, { weekday: "short" });
  if (dateKey === localDateKey(now)) label = "Hari ini";
  else {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (dateKey === localDateKey(tomorrow)) label = "Besok";
  }
  const overdue = date.getTime() < now.getTime() && !task.completed;
  return { label: `${label}, ${formatTime(task.due_at)}`, overdue };
}

function buildTaskCard(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.completed ? " task-completed" : ""}`;
  card.dataset.taskId = task.id;

  const checkbox = document.createElement("button");
  checkbox.type = "button";
  checkbox.className = `task-checkbox${task.completed ? " checked" : ""}`;
  checkbox.setAttribute("aria-label", task.completed ? `Tandai ${task.title} belum selesai` : `Tandai ${task.title} selesai`);
  checkbox.innerHTML = task.completed
    ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6.5 12.5 3.5 3.5 7.5-8"/></svg>'
    : "";
  checkbox.addEventListener("click", () => toggleTask(task));

  const content = document.createElement("div");
  content.className = "task-main";
  const titleRow = document.createElement("div");
  titleRow.className = "task-title-row";
  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;
  titleRow.append(title);
  const priority = document.createElement("span");
  priority.className = `priority-pill priority-${task.priority}`;
  priority.innerHTML = `<span class="priority-dot"></span>${priorityLabels[task.priority]}`;
  titleRow.append(priority);
  content.append(titleRow);

  if (task.notes) {
    const notes = document.createElement("p");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    content.append(notes);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";
  const due = dueLabel(task);
  if (due) {
    const deadline = document.createElement("span");
    deadline.className = `task-deadline${due.overdue ? " deadline-overdue" : ""}`;
    deadline.innerHTML = `${icons.clock}<span>${due.label}</span>`;
    meta.append(deadline);
  }
  if (task.reminder_at) {
    const reminder = document.createElement("span");
    reminder.className = `task-reminder${task.reminder_sent_at ? " reminder-sent" : ""}`;
    reminder.innerHTML = `${icons.bell}<span>${task.reminder_sent_at ? "Notifikasi muncul" : `Ingatkan ${formatDate(task.reminder_at)} · ${formatTime(task.reminder_at)}`}</span>`;
    meta.append(reminder);
  }
  if (meta.childElementCount) content.append(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "task-action";
  remove.setAttribute("aria-label", `Hapus tugas ${task.title}`);
  remove.title = "Hapus tugas";
  remove.innerHTML = icons.trash;
  remove.addEventListener("click", () => deleteTask(task));
  actions.append(remove);
  card.append(checkbox, content, actions);
  return card;
}

function render() {
  const visible = visibleTasks();
  const pending = state.tasks.filter((task) => !task.completed);
  const completed = state.tasks.filter((task) => task.completed);
  document.querySelector("#summary-total").textContent = String(state.tasks.length).padStart(2, "0");
  document.querySelector("#summary-pending").textContent = String(pending.length).padStart(2, "0");
  document.querySelector("#summary-done").textContent = String(completed.length).padStart(2, "0");
  document.querySelector("#summary-progress").textContent = state.tasks.length
    ? `${Math.round((completed.length / state.tasks.length) * 100)}% dari semua tugas`
    : "Sedikit demi sedikit";
  document.querySelector("#all-count").textContent = pending.length;
  document.querySelector("#today-count").textContent = pending.filter((task) => taskDateKey(task.due_at) === localDateKey(new Date())).length;
  document.querySelector("#completed-count").textContent = completed.length;
  document.querySelector("#visible-count").textContent = visible.length;
  document.querySelector("#current-section").textContent = sectionLabels[state.filter];
  document.querySelector("#tasks-heading").childNodes[0].textContent =
    state.filter === "all" ? "Daftar tugas " : `${sectionLabels[state.filter]} `;
  document.querySelector("#list-subtitle").textContent =
    state.filter === "all" ? "Susun hari yang terasa lebih ringan." : `Yang kamu butuhkan untuk ${sectionLabels[state.filter].toLowerCase()}.`;

  elements.list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const illustration = document.createElement("div");
    illustration.className = "empty-illustration";
    illustration.setAttribute("aria-hidden", "true");
    illustration.innerHTML = '<div class="empty-paper"><span></span><span></span><span></span></div><div class="empty-sparkle">✦</div><div class="empty-check"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6"/></svg></div>';
    const title = document.createElement("h3");
    title.textContent = state.filter === "completed" ? "Belum ada yang selesai" : "Ruang kosong, penuh kemungkinan";
    const message = document.createElement("p");
    message.textContent = state.filter === "completed" ? "Tugas yang selesai akan muncul di sini." : "Tambahkan satu tugas kecil untuk memulai harimu.";
    empty.append(illustration, title, message);
    if (state.filter !== "completed") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "empty-add-button";
      button.textContent = "+ Tambah tugas pertama";
      button.addEventListener("click", openForm);
      empty.append(button);
    }
    elements.list.append(empty);
    return;
  }

  const taskGroup = document.createElement("div");
  taskGroup.className = "task-group";
  visible.forEach((task) => taskGroup.append(buildTaskCard(task)));
  elements.list.append(taskGroup);
}

function updateNotificationStatus() {
  const supported = "Notification" in window;
  state.notificationPermission = supported ? Notification.permission : "unsupported";
  if (!supported) {
    elements.notificationButtonLabel.textContent = "Notifikasi tidak didukung";
    elements.notificationButton.title = "Browser ini tidak mendukung notifikasi.";
    elements.notificationButton.disabled = true;
    elements.notificationStatus.textContent = "Browser ini tidak mendukung notifikasi.";
    elements.notificationStatus.classList.add("status-warning");
    return;
  }

  elements.notificationButton.disabled = false;
  if (state.notificationPermission === "granted") {
    elements.notificationButtonLabel.textContent = "Notifikasi aktif";
    elements.notificationButton.title = "Notifikasi browser sudah diizinkan.";
    elements.notificationStatus.textContent = "Notifikasi aktif. Pengingat diperiksa setiap 15 detik selama website terbuka.";
    elements.notificationStatus.classList.remove("status-warning");
  } else if (state.notificationPermission === "denied") {
    elements.notificationButtonLabel.textContent = "Atur izin notifikasi";
    elements.notificationButton.title = "Ubah izin notifikasi melalui pengaturan situs di browser.";
    elements.notificationStatus.textContent = "Notifikasi diblokir. Ubah izin situs ini di pengaturan browser.";
    elements.notificationStatus.classList.add("status-warning");
  } else {
    elements.notificationButtonLabel.textContent = "Aktifkan notifikasi";
    elements.notificationButton.title = "Izinkan notifikasi agar pengingat dapat muncul.";
    elements.notificationStatus.textContent = "Klik “Aktifkan notifikasi” di atas, lalu izinkan permintaan dari browser.";
    elements.notificationStatus.classList.add("status-warning");
  }
}

async function checkDueReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  const dueTasks = state.tasks.filter(
    (task) => !task.completed && task.reminder_at && !task.reminder_sent_at && Date.parse(task.reminder_at) <= now,
  );

  for (const task of dueTasks) {
    const sentAt = new Date().toISOString();
    const updated = await authenticatedRequest(
      `/rest/v1/tasks?id=eq.${encodeURIComponent(task.id)}&completed=eq.false&reminder_sent_at=is.null&reminder_at=lte.${encodeURIComponent(sentAt)}`,
      { method: "PATCH", body: { reminder_sent_at: sentAt }, prefer: "return=representation" },
    );
    if (!updated.length) continue;

    try {
      const notification = new Notification(`Pengingat: ${task.title}`, {
        body: task.notes || "Waktunya mengerjakan tugas yang sudah kamu jadwalkan.",
        tag: `task-${task.id}`,
      });
      notification.addEventListener("click", () => {
        window.focus();
        notification.close();
      });
      state.tasks = state.tasks.map((item) => item.id === task.id ? updated[0] : item);
      render();
    } catch (error) {
      await authenticatedRequest(
        `/rest/v1/tasks?id=eq.${encodeURIComponent(task.id)}&reminder_sent_at=eq.${encodeURIComponent(sentAt)}`,
        { method: "PATCH", body: { reminder_sent_at: null }, prefer: "return=minimal" },
      );
      showToast("Notifikasi gagal ditampilkan. Periksa izin browser lalu coba lagi.", "error");
      throw error;
    }
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    showToast("Browser ini tidak mendukung notifikasi.", "error");
    return;
  }
  if (Notification.permission === "denied") {
    showToast("Izinkan notifikasi untuk situs ini melalui pengaturan browser.", "error");
    return;
  }
  try {
    await Notification.requestPermission();
    updateNotificationStatus();
    if (Notification.permission === "granted") {
      await loadTasks();
      showToast("Notifikasi browser berhasil diaktifkan.");
    }
  } catch (error) {
    showToast(`Izin notifikasi gagal diminta: ${error.message}`, "error");
  }
}

async function loadTasks() {
  const tasks = await authenticatedRequest(
    "/rest/v1/tasks?select=id,title,notes,due_at,reminder_at,priority,completed,created_at,reminder_sent_at&order=completed.asc,due_at.asc.nullslast,created_at.desc",
  );
  state.tasks = tasks;
  updateNotificationStatus();
  render();
  await checkDueReminders();
}

async function toggleTask(task) {
  try {
    const updated = await authenticatedRequest(`/rest/v1/tasks?id=eq.${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: { completed: !task.completed },
      prefer: "return=representation",
    });
    if (!updated.length) throw new Error("Tugas tidak ditemukan atau akses ditolak.");
    state.tasks = state.tasks.map((item) => item.id === task.id ? updated[0] : item);
    render();
    showToast(updated[0].completed ? "Satu langkah selesai. Kerja bagus!" : "Tugas ditambahkan kembali.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteTask(task) {
  try {
    await authenticatedRequest(`/rest/v1/tasks?id=eq.${encodeURIComponent(task.id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    render();
    showToast("Tugas berhasil dihapus.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openForm() {
  elements.form.hidden = false;
  elements.formError.textContent = "";
  window.requestAnimationFrame(() => elements.form.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  elements.titleInput.focus({ preventScroll: true });
}

function closeForm() {
  elements.form.reset();
  elements.formError.textContent = "";
  elements.form.hidden = true;
}

async function submitTask(event) {
  event.preventDefault();
  elements.formError.textContent = "";
  const formData = new FormData(elements.form);
  const payload = Object.fromEntries(formData.entries());
  if (payload.reminder_at && (!("Notification" in window) || Notification.permission !== "granted")) {
    elements.formError.textContent = "Aktifkan izin notifikasi browser terlebih dahulu.";
    return;
  }
  elements.saveButton.disabled = true;
  try {
    const inserted = await authenticatedRequest("/rest/v1/tasks", {
      method: "POST",
      body: {
        user_id: state.session.user.id,
        title: payload.title,
        notes: payload.notes,
        due_at: payload.due_at ? new Date(payload.due_at).toISOString() : null,
        reminder_at: payload.reminder_at ? new Date(payload.reminder_at).toISOString() : null,
        priority: payload.priority,
      },
      prefer: "return=representation",
    });
    if (!inserted.length) throw new Error("Supabase tidak mengembalikan tugas yang tersimpan.");
    state.tasks.unshift(inserted[0]);
    state.filter = "all";
    document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.filter === "all"));
    closeForm();
    render();
    showToast("Tugas baru berhasil disimpan.");
  } catch (error) {
    elements.formError.textContent = error.message;
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function restoreSessionFromUrl() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const authError = params.get("error_description");
  if (authError) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    throw new Error(authError.replace(/\+/g, " "));
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const user = await supabaseRequest("/auth/v1/user", { token: accessToken });
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600),
    user,
  };
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  saveSession(session);
  return session;
}

async function showApp(session) {
  state.session = session;
  elements.authScreen.hidden = true;
  elements.appShell.hidden = false;
  elements.logoutButton.textContent = String(session.user.email || "A").charAt(0).toUpperCase();
  try {
    await loadTasks();
  } catch (error) {
    elements.list.innerHTML = '<div class="error-state">Tidak dapat memuat tugas. Periksa konfigurasi Supabase lalu segarkan halaman.</div>';
    showToast(error.message, "error");
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  setAuthMessage("");
  elements.authSubmit.disabled = true;
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  try {
    if (state.authMode === "signup") {
      const redirectUrl = encodeURIComponent(window.location.href.split("#")[0]);
      const response = await supabaseRequest(`/auth/v1/signup?redirect_to=${redirectUrl}`, {
        method: "POST",
        body: { email, password },
      });
      const session = sessionFromResponse(response);
      if (!session) {
        setAuthMessage("Akun dibuat. Periksa email untuk verifikasi, lalu masuk.", "success");
        elements.authPassword.value = "";
        return;
      }
      saveSession(session);
      await showApp(session);
      return;
    }

    const response = await supabaseRequest("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });
    const session = sessionFromResponse(response);
    if (!session) throw new Error("Supabase tidak mengembalikan sesi yang valid.");
    saveSession(session);
    await showApp(session);
  } catch (error) {
    setAuthMessage(error.message);
  } finally {
    elements.authSubmit.disabled = false;
  }
}

async function initializeApp() {
  startClock();
  initializeEvents();
  const baseUrl = String(supabaseConfig.url || "").trim();
  const anonKey = String(supabaseConfig.anonKey || "").trim();
  if (!baseUrl || !anonKey || baseUrl.includes("PROJECT_REF") || anonKey.includes("YOUR_")) {
    elements.authConfigHelp.hidden = false;
    elements.authSubmit.disabled = true;
    elements.authToggle.disabled = true;
    showAuthScreen("Lengkapi konfigurasi Supabase sebelum menggunakan aplikasi.");
    return;
  }

  try {
    let session = await restoreSessionFromUrl();
    if (!session) session = readSession();
    if (!session) {
      showAuthScreen();
      return;
    }
    state.session = session;
    if (!session.access_token || !session.refresh_token || !session.user) {
      session = await refreshSession();
      if (!session.user) {
        session.user = await supabaseRequest("/auth/v1/user", { token: session.access_token });
        saveSession(session);
      }
    } else if (session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
      session = await refreshSession();
    }
    await showApp(session);
  } catch (error) {
    clearSession();
    showAuthScreen(error.message);
  }
}

function initializeEvents() {
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.authToggle.addEventListener("click", () => {
    state.authMode = state.authMode === "signin" ? "signup" : "signin";
    updateAuthMode();
  });
  elements.logoutButton.addEventListener("click", signOut);
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      state.filter = link.dataset.filter;
      document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item === link));
      render();
    });
  });
  document.querySelector("#add-task-button").addEventListener("click", openForm);
  elements.notificationButton.addEventListener("click", enableNotifications);
  document.querySelector(".close-composer").addEventListener("click", closeForm);
  document.querySelector(".cancel-composer").addEventListener("click", closeForm);
  elements.form.addEventListener("submit", submitTask);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadTasks().catch((error) => showToast(error.message, "error"));
    }
  });
}

initializeApp();
window.setInterval(() => {
  if (!state.session || elements.appShell.hidden) return;
  loadTasks().catch((error) => showToast(error.message, "error"));
}, 15000);
