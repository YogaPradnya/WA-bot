/**
 * WhatsApp Bot Dashboard - Client Application
 */
(function () {
  'use strict';

  // --- State ---
  const API_BASE = '/api';
  let authKey = '';
  let menus = [];
  let editingTrigger = null; // null = tambah, string = edit

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    loginOverlay: $('#login-overlay'),
    loginForm: $('#login-form'),
    loginPassword: $('#login-password'),
    loginError: $('#login-error'),

    dashboard: $('#dashboard'),
    dashboardLayout: $('.dashboard-layout'),

    connectionBadge: $('#connection-badge'),
    themeToggleBtn: $('#theme-toggle-btn'),
    themeIconMoon: $('#theme-icon-moon'),
    themeIconSun: $('#theme-icon-sun'),
    refreshBtn: $('#refresh-btn'),
    logoutBtn: $('#logout-btn'),

    sidebar: $('#sidebar'),
    sidebarToggleBtn: $('#sidebar-toggle-btn'),
    sidebarBackdrop: $('#sidebar-backdrop'),
    setupDropdownBtn: $('#setup-dropdown-btn'),
    setupDropdown: $('#nav-setup-dropdown'),
    navItems: $$('.nav-item[data-view], .nav-sub-item[data-view]'),
    viewPanels: $$('.view-panel'),

    botToggleBtn: $('#bot-toggle-btn'),
    botToggleDot: $('#bot-toggle-dot'),
    botToggleText: $('#bot-toggle-text'),

    statBotStatus: $('#stat-bot-status'),
    statBotJid: $('#stat-bot-jid'),
    statMessagesCount: $('#stat-messages-count'),
    statCommandsCount: $('#stat-commands-count'),
    statMenuCount: $('#stat-menu-count'),
    statRam: $('#stat-ram'),
    statRamDetail: $('#stat-ram-detail'),
    statUptime: $('#stat-uptime'),
    statNodeVersion: $('#stat-node-version'),


    logsList: $('#logs-list'),
    logsCount: $('#logs-count'),
    logsFilterCategory: $('#logs-filter-category'),
    refreshLogsBtn: $('#refresh-logs-btn'),

    menuTbody: $('#menu-tbody'),
    addMenuBtn: $('#add-menu-btn'),

    menuModalOverlay: $('#menu-modal-overlay'),
    menuModalTitle: $('#menu-modal-title'),
    menuForm: $('#menu-form'),
    menuTrigger: $('#menu-trigger'),
    menuTitle: $('#menu-title'),
    menuResponse: $('#menu-response'),
    menuImageFile: $('#menu-image-file'),
    menuImageUrl: $('#menu-image-url'),
    menuImagePreview: $('#menu-image-preview'),
    menuPreviewImg: $('#menu-preview-img'),
    menuModalClose: $('#menu-modal-close'),
    menuModalCancel: $('#menu-modal-cancel'),

    deleteModalOverlay: $('#delete-modal-overlay'),
    deleteTriggerName: $('#delete-trigger-name'),
    deleteCancelBtn: $('#delete-cancel-btn'),
    deleteConfirmBtn: $('#delete-confirm-btn'),

    configPrefix: $('#config-prefix'),
    savePrefixBtn: $('#save-prefix-btn'),
    configAdmins: $('#config-admins'),
    saveAdminsBtn: $('#save-admins-btn'),
    configWelcomeEnabled: $('#config-welcome-enabled'),
    configWelcomeMessage: $('#config-welcome-message'),
    saveWelcomeBtn: $('#save-welcome-btn'),

    toastContainer: $('#toast-container'),
  };

  // --- Helpers ---

  /**
   * Menampilkan notifikasi toast
   */
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }

  // --- Theme Management ---
  function getStoredTheme() {
    return localStorage.getItem('dashboard_theme') || 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dashboard_theme', theme);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0b0d14' : '#f8fafc');
    }

    if (dom.themeIconMoon && dom.themeIconSun) {
      if (theme === 'dark') {
        dom.themeIconMoon.classList.add('hidden');
        dom.themeIconSun.classList.remove('hidden');
        if (dom.themeToggleBtn) dom.themeToggleBtn.title = 'Ganti ke Tema Terang (Light Mode)';
      } else {
        dom.themeIconMoon.classList.remove('hidden');
        dom.themeIconSun.classList.add('hidden');
        if (dom.themeToggleBtn) dom.themeToggleBtn.title = 'Ganti ke Tema Gelap (Dark Mode)';
      }
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(`Tema diubah ke ${nextTheme === 'dark' ? 'Gelap' : 'Terang'}.`, 'success');
  }

  // --- Sidebar & View Navigation ---
  let currentView = 'dashboard';

  function switchView(viewName) {
    if (!viewName) return;
    currentView = viewName;

    // Switch panels
    dom.viewPanels.forEach((panel) => {
      if (panel.id === `view-${viewName}`) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Update nav items active state
    dom.navItems.forEach((btn) => {
      const target = btn.dataset.view;
      if (target === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Highlight parent Setup button if in a setup sub-view
    const isSetupView = viewName.startsWith('setup-');
    if (dom.setupDropdownBtn) {
      if (isSetupView) {
        dom.setupDropdownBtn.classList.add('active');
      } else {
        dom.setupDropdownBtn.classList.remove('active');
      }
    }
    if (isSetupView && dom.setupDropdown) {
      dom.setupDropdown.classList.add('expanded');
    }

    // Auto-load data when switching view
    if (viewName === 'logs') {
      loadLogs();
    } else if (viewName === 'setup-menu') {
      loadMenus();
    }

    // Auto-close mobile drawer
    closeSidebar();
  }

  function toggleSetupDropdown() {
    if (dom.dashboardLayout && dom.dashboardLayout.classList.contains('sidebar-collapsed')) {
      toggleSidebar();
      if (dom.setupDropdown) {
        dom.setupDropdown.classList.add('expanded');
      }
      return;
    }
    if (dom.setupDropdown) {
      dom.setupDropdown.classList.toggle('expanded');
    }
  }

  function toggleSidebar() {
    if (dom.dashboardLayout) {
      const isCollapsed = dom.dashboardLayout.classList.toggle('sidebar-collapsed');
      localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');
    }
  }

  function closeSidebar() {
    if (window.innerWidth <= 768 && dom.dashboardLayout) {
      dom.dashboardLayout.classList.add('sidebar-collapsed');
    }
  }

  function initSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      if (dom.dashboardLayout) {
        dom.dashboardLayout.classList.add('sidebar-collapsed');
      }
    } else {
      const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
      if (isCollapsed && dom.dashboardLayout) {
        dom.dashboardLayout.classList.add('sidebar-collapsed');
      }
    }
  }

  /**
   * HTTP request helper
   */
  async function api(method, path, body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-dashboard-key': authKey,
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request gagal (${res.status})`);
    }
    return data;
  }

  /**
   * Format bytes ke MB
   */
  function formatMB(bytes) {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  /**
   * Format detik ke string jam/menit
   */
  function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}j ${m}m`;
    return `${m} menit`;
  }

  /**
   * Escape HTML
   */
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Auth ---

  function checkSession() {
    const stored = sessionStorage.getItem('dashboard_key');
    if (stored) {
      authKey = stored;
      showDashboard();
    }
  }

  function showDashboard() {
    dom.loginOverlay.classList.remove('active');
    dom.dashboard.classList.remove('hidden');
    switchView('dashboard');
    loadAllData();
  }

  function logout() {
    authKey = '';
    sessionStorage.removeItem('dashboard_key');
    dom.dashboard.classList.add('hidden');
    dom.loginOverlay.classList.add('active');
    dom.loginPassword.value = '';
    dom.loginError.textContent = '';
  }

  // --- Data Loading ---

  let currentLogs = [];
  let pollTimer = null;

  async function loadAllData() {
    await Promise.all([loadStatus(), loadMenus(), loadConfig(), loadLogs()]);
    startPolling();
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (authKey && !dom.dashboard.classList.contains('hidden')) {
        loadStatus();
        loadLogs();
      }
    }, 4000);
  }

  async function loadStatus() {
    try {
      const data = await api('GET', '/status');
      const s = data.data;

      // Bot connection status
      const isConnected = s.bot.status === 'connected';
      if (isConnected) {
        dom.connectionBadge.className = 'badge badge-online';
        dom.connectionBadge.textContent = 'Online';
        dom.statBotStatus.textContent = 'Tersambung';
        dom.statBotStatus.style.color = 'var(--success)';
      } else {
        dom.connectionBadge.className = 'badge badge-offline';
        dom.connectionBadge.textContent = 'Offline';
        dom.statBotStatus.textContent = 'Terputus';
        dom.statBotStatus.style.color = 'var(--danger)';
      }

      // Bot on / off state
      const isBotActive = s.bot.active !== false;
      if (isBotActive) {
        dom.botToggleBtn.className = 'btn-bot-toggle bot-on';
        dom.botToggleText.textContent = 'Bot Aktif (ON)';
      } else {
        dom.botToggleBtn.className = 'btn-bot-toggle bot-off';
        dom.botToggleText.textContent = 'Bot Nonaktif (OFF)';
      }

      // Turso Stats (Pesan & Perintah)
      if (s.stats && dom.statMessagesCount) {
        dom.statMessagesCount.textContent = s.stats.totalMessages || 0;
        dom.statCommandsCount.textContent = `${s.stats.totalCommands || 0} Perintah`;
      }

      // Format tampilan nomor bot agar rapi dan tidak meluap
      const rawJid = s.bot.userJid || '';
      if (rawJid) {
        const cleanNum = rawJid.split(':')[0].split('@')[0];
        if (cleanNum.startsWith('62')) {
          dom.statBotJid.textContent = `+62 ${cleanNum.slice(2, 5)}-${cleanNum.slice(5, 9)}-${cleanNum.slice(9)}`;
        } else {
          dom.statBotJid.textContent = cleanNum;
        }
        dom.statBotJid.title = rawJid;
      } else {
        dom.statBotJid.textContent = 'Tidak terhubung';
        dom.statBotJid.title = '';
      }

      // Memory
      dom.statRam.textContent = s.server.processMemoryMb + ' MB';
      dom.statRamDetail.textContent = `Sistem: ${s.server.ram.usedMb} / ${s.server.ram.totalMb} MB (${s.server.ram.percent}%)`;

      // Uptime
      dom.statUptime.textContent = formatUptime(s.server.processUptime);
      dom.statNodeVersion.textContent = `Node ${s.server.nodeVersion}`;

      // Menu count from status
      dom.statMenuCount.textContent = s.menuCount;

    } catch (err) {
      console.error('Gagal memuat status:', err);
    }
  }

  async function loadLogs() {
    try {
      const data = await api('GET', '/logs?limit=60');
      currentLogs = data.data || [];
      renderLogs();
    } catch (err) {
      console.error('Gagal memuat log aktivitas:', err);
    }
  }

  function renderLogs() {
    const filter = dom.logsFilterCategory ? dom.logsFilterCategory.value : 'all';
    const filtered = filter === 'all'
      ? currentLogs
      : currentLogs.filter((l) => l.category === filter);

    if (dom.logsCount) {
      dom.logsCount.textContent = `${filtered.length} entri aktivitas`;
    }

    if (!dom.logsList) return;

    if (filtered.length === 0) {
      dom.logsList.innerHTML = `<div class="log-item empty-log">Belum ada log aktivitas untuk kategori ini.</div>`;
      return;
    }

    dom.logsList.innerHTML = filtered
      .map(
        (log) => `
        <div class="log-item">
          <span class="log-time">${esc(log.timestamp)}</span>
          <span class="log-badge ${esc(log.level)}">${esc(log.category)}</span>
          <span class="log-text">${esc(log.message)}</span>
        </div>
      `
      )
      .join('');
  }

  async function toggleBot() {
    try {
      dom.botToggleBtn.disabled = true;
      const res = await api('POST', '/bot/toggle');
      const active = res.data.active;
      showToast(res.data.message, active ? 'success' : 'info');
      await loadStatus();
      await loadLogs();
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status bot.', 'error');
    } finally {
      dom.botToggleBtn.disabled = false;
    }
  }


  async function loadMenus() {
    try {
      const data = await api('GET', '/menus');
      menus = data.data || [];
      renderMenuTable();
      dom.statMenuCount.textContent = menus.length;
    } catch (err) {
      console.error('Gagal memuat menu:', err);
      dom.menuTbody.innerHTML = `<tr><td colspan="4" class="empty-row">Gagal memuat data.</td></tr>`;
    }
  }

  async function loadConfig() {
    try {
      const data = await api('GET', '/config');
      const c = data.data;
      dom.configPrefix.value = c.prefix || '.';
      dom.configAdmins.value = (c.adminNumbers || []).join(', ');
      dom.configWelcomeEnabled.checked = c.welcomeEnabled !== false;
      dom.configWelcomeMessage.value = c.welcomeMessage || '';
    } catch (err) {
      console.error('Gagal memuat konfigurasi:', err);
    }
  }

  // --- Render ---

  function renderMenuTable() {
    if (menus.length === 0) {
      dom.menuTbody.innerHTML = `<tr><td colspan="4" class="empty-row">Belum ada menu. Klik "+ Tambah Menu" untuk membuat.</td></tr>`;
      return;
    }

    dom.menuTbody.innerHTML = menus.map((m) => `
      <tr>
        <td class="td-trigger">${esc(m.trigger)}</td>
        <td class="td-title">${esc(m.title)}</td>
        <td class="td-response" title="${esc(m.response)}">${esc(m.response)}</td>
         <td class="td-actions">
          <button class="btn btn-ghost btn-xs" data-action="edit" data-trigger="${esc(m.trigger)}" title="Edit">Edit</button>
          <button class="btn btn-ghost btn-xs" data-action="delete" data-trigger="${esc(m.trigger)}" title="Hapus" style="color: var(--danger);">Hapus</button>
        </td>
      </tr>
    `).join('');
  }

  // --- Menu Modal ---

  function openMenuModal(trigger = null) {
    editingTrigger = trigger;
    dom.menuForm.reset();

    if (trigger) {
      dom.menuModalTitle.textContent = 'Edit Menu';
      const existing = menus.find((m) => m.trigger === trigger);
      if (existing) {
        dom.menuTrigger.value = existing.trigger;
        dom.menuTitle.value = existing.title;
        dom.menuResponse.value = existing.response;
        dom.menuImageUrl.value = existing.imageUrl || '';
        dom.menuImageFile.value = '';
        updateImagePreview();
      }
      dom.menuTrigger.readOnly = true;
    } else {
      dom.menuModalTitle.textContent = 'Tambah Menu Baru';
      dom.menuTrigger.readOnly = false;
      dom.menuImageUrl.value = '';
      dom.menuImageFile.value = '';
      updateImagePreview();
    }

    dom.menuModalOverlay.classList.add('active');
    dom.menuTrigger.focus();
  }

  function updateImagePreview() {
    const url = dom.menuImageUrl.value.trim();
    if (!url) {
      dom.menuImagePreview.classList.add('hidden');
      dom.menuPreviewImg.removeAttribute('src');
      return;
    }
    dom.menuPreviewImg.src = url;
    dom.menuImagePreview.classList.remove('hidden');
  }

  function closeMenuModal() {
    dom.menuModalOverlay.classList.remove('active');
    editingTrigger = null;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleMenuSubmit(e) {
    e.preventDefault();
    const trigger = dom.menuTrigger.value.trim();
    const title = dom.menuTitle.value.trim();
    const response = dom.menuResponse.value.trim();
    const imageFile = dom.menuImageFile.files[0];
    let imageUrl = dom.menuImageUrl.value.trim();

    if (!trigger || !title || !response) return;
    if (imageFile) {
      if (!/^image\/(jpeg|png|webp)$/.test(imageFile.type) || imageFile.size > 8 * 1024 * 1024) {
        showToast('Pilih JPG, PNG, atau WEBP maksimal 8 MB.', 'error'); return;
      }
      try {
        const data = await readFileAsDataUrl(imageFile);
        const upload = await api('POST', '/media', { data, filename: imageFile.name });
        imageUrl = upload.url;
      } catch (err) {
        showToast(err.message, 'error'); return;
      }
    }

    const payload = { trigger, title, response, ...(imageUrl ? { imageUrl } : {}) };

    try {
      if (editingTrigger) {
        await api('POST', '/menus', { ...payload, trigger: editingTrigger });
        showToast('Menu berhasil diperbarui.');
      } else {
        await api('POST', '/menus', payload);
        showToast('Menu baru berhasil ditambahkan.');
      }
      closeMenuModal();
      await loadMenus();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- Delete Modal ---

  let pendingDeleteTrigger = null;

  function openDeleteModal(trigger) {
    pendingDeleteTrigger = trigger;
    dom.deleteTriggerName.textContent = trigger;
    dom.deleteModalOverlay.classList.add('active');
  }

  function closeDeleteModal() {
    dom.deleteModalOverlay.classList.remove('active');
    pendingDeleteTrigger = null;
  }

  async function confirmDelete() {
    if (!pendingDeleteTrigger) return;
    try {
      await api('DELETE', `/menus/${encodeURIComponent(pendingDeleteTrigger)}`);
      showToast('Menu berhasil dihapus.');
      closeDeleteModal();
      await loadMenus();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- Config Actions ---

  async function savePrefix() {
    const prefix = dom.configPrefix.value.trim();
    if (!prefix) {
      showToast('Prefix tidak boleh kosong.', 'error');
      return;
    }
    try {
      await api('POST', '/config', { prefix });
      showToast('Prefix berhasil disimpan.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function saveAdmins() {
    const raw = dom.configAdmins.value.trim();
    const admins = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (admins.length === 0) {
      showToast('Minimal satu admin diperlukan.', 'error');
      return;
    }
    try {
      await api('POST', '/config', { adminNumbers: admins.join(',') });
      showToast('Daftar admin berhasil disimpan.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function saveWelcome() {
    const welcomeMessage = dom.configWelcomeMessage.value.trim();
    if (!welcomeMessage) {
      showToast('Pesan welcome tidak boleh kosong.', 'error');
      return;
    }
    try {
      await api('POST', '/config', {
        welcomeEnabled: dom.configWelcomeEnabled.checked,
        welcomeMessage,
      });
      showToast('Pengaturan welcome berhasil disimpan.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- Event Listeners ---

  // Login
  dom.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = dom.loginPassword.value;
    if (!pwd) return;

    dom.loginError.textContent = '';
    try {
      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      const loginData = await loginResponse.json();

      if (!loginResponse.ok || !loginData.success) {
        throw new Error(loginData.message || 'Password salah.');
      }

      authKey = loginData.token || pwd;
      sessionStorage.setItem('dashboard_key', authKey);
      showDashboard();
    } catch (err) {
      authKey = '';
      sessionStorage.removeItem('dashboard_key');
      dom.loginError.textContent = err.message || 'Password salah atau server tidak merespon.';
    }
  });

  // Logout
  dom.logoutBtn.addEventListener('click', logout);

  // Refresh
  dom.refreshBtn.addEventListener('click', () => {
    dom.refreshBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => { dom.refreshBtn.style.transform = ''; }, 400);
    loadAllData();
  });

  // Add Menu
  dom.addMenuBtn.addEventListener('click', () => openMenuModal());

  // Menu Table Actions (delegate)
  dom.menuTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const trigger = btn.dataset.trigger;

    if (action === 'edit') openMenuModal(trigger);
    if (action === 'delete') openDeleteModal(trigger);
  });

  // Menu Modal
  dom.menuModalClose.addEventListener('click', closeMenuModal);
  dom.menuModalCancel.addEventListener('click', closeMenuModal);
  dom.menuForm.addEventListener('submit', handleMenuSubmit);
  dom.menuImageFile.addEventListener('change', async () => {
    const file = dom.menuImageFile.files[0];
    if (!file) return;
    try {
      dom.menuPreviewImg.src = await readFileAsDataUrl(file);
      dom.menuImagePreview.classList.remove('hidden');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  dom.menuPreviewImg.addEventListener('error', () => {
    dom.menuImagePreview.classList.add('hidden');
    showToast('Preview banner tidak dapat dimuat.', 'error');
  });

  // Delete Modal
  dom.deleteCancelBtn.addEventListener('click', closeDeleteModal);
  dom.deleteConfirmBtn.addEventListener('click', confirmDelete);

  // Bot Toggle On / Off
  if (dom.botToggleBtn) {
    dom.botToggleBtn.addEventListener('click', toggleBot);
  }


  // Logs Toolbar
  if (dom.refreshLogsBtn) {
    dom.refreshLogsBtn.addEventListener('click', () => {
      loadLogs();
      showToast('Log aktivitas diperbarui.', 'success');
    });
  }
  if (dom.logsFilterCategory) {
    dom.logsFilterCategory.addEventListener('change', renderLogs);
  }

  // Config
  dom.savePrefixBtn.addEventListener('click', savePrefix);
  dom.saveAdminsBtn.addEventListener('click', saveAdmins);
  dom.saveWelcomeBtn.addEventListener('click', saveWelcome);

  // Theme Toggle
  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Sidebar & Navigation
  if (dom.sidebarToggleBtn) {
    dom.sidebarToggleBtn.addEventListener('click', toggleSidebar);
  }
  if (dom.sidebarBackdrop) {
    dom.sidebarBackdrop.addEventListener('click', closeSidebar);
  }
  if (dom.setupDropdownBtn) {
    dom.setupDropdownBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSetupDropdown();
    });
  }

  // Nav items click delegation
  dom.navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) switchView(view);
    });
  });

  // Close modals on overlay click
  [dom.menuModalOverlay, dom.deleteModalOverlay].forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Window resize handler for sidebar state
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
      if (dom.dashboardLayout) {
        dom.dashboardLayout.classList.toggle('sidebar-collapsed', isCollapsed);
      }
    }
  });

  // --- Init ---
  applyTheme(getStoredTheme());
  initSidebar();
  switchView('dashboard');
  checkSession();
})();
