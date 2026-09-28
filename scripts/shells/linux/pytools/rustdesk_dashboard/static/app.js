(function () {
  function api(path, options) {
    options = options || {};
    var method = options.method || 'GET';
    var body = options.body;
    var headers = { 'Content-Type': 'application/json' };
    var req = { method: method, headers: headers, credentials: 'same-origin' };
    if (body) req.body = JSON.stringify(body);
    return fetch(path, req).then(function (r) {
      if (r.status === 401) { window.location.href = '/'; return; }
      return r.json().catch(function () { return null; });
    });
  }

  function copyToClipboard(text, btn) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { return; }
    } else {
      navigator.clipboard.writeText(text).catch(function () {});
    }
    if (btn) {
      var orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = orig; }, 1200);
    }
  }

  function renderServerStatus(data) {
    var el = document.getElementById('serverStatusContent');
    if (!data || !data.server_status) {
      el.innerHTML = '<p class="muted">Server config not available. Run script 128 to save config.</p>';
      return;
    }
    var st = data.server_status;
    var av = st.availability || data.availability || 'unavailable';
    var cfg = data.client_config || {};
    var html = '<p><span class="status-badge ' + av + '">' + av.toUpperCase() + '</span>';
    html += ' hbbs: <strong>' + (st.hbbs || 'unknown') + '</strong>';
    html += ' &nbsp; hbbr: <strong>' + (st.hbbr || 'unknown') + '</strong></p>';
    if (cfg.public_ip) {
      html += '<p class="ports-list">Public IP: ' + escapeHtml(cfg.public_ip);
      if (cfg.ports && cfg.ports.hbbs) {
        html += ' &nbsp; Ports: ' + cfg.ports.hbbs + ' (ID), ' + cfg.ports.hbbs_nat + ' (NAT), ' + cfg.ports.hbbr + ' (Relay)';
      }
      html += '</p>';
    }
    if (cfg.server_version) {
      html += '<p class="ports-list">Server version: ' + escapeHtml(cfg.server_version) + '</p>';
    }
    el.innerHTML = html;
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderClientConfig(data) {
    var el = document.getElementById('clientConfigContent');
    if (!data || !data.client_config) {
      el.innerHTML = '<p class="muted">No client config. Run script 128 to save config.</p>';
      return;
    }
    var c = data.client_config;
    var html = '';
    function row(label, value, canCopy) {
      if (value === undefined || value === null) value = '';
      var v = typeof value === 'string' ? value : JSON.stringify(value);
      var id = 'cfg_' + label.replace(/\s/g, '_');
      var copyBtn = canCopy !== false && v ? '<button type="button" class="btn copy-btn" data-copy="' + escapeHtml(v) + '">Copy</button>' : '';
      return '<div class="config-row"><label>' + escapeHtml(label) + '</label><span class="value" id="' + id + '">' + escapeHtml(v) + '</span>' + copyBtn + '</div>';
    }
    html += row('ID Server', c.id_server);
    html += row('Relay Server', c.relay_server || '(leave empty; client deduces hbbr from ID Server)');
    html += row('API Server', c.api_server || '(OSS: leave empty)');
    html += row('Key', c.key);
    if (c.local_ips && c.local_ips.length) {
      html += row('Local IPs', c.local_ips.join(', '));
    }
    el.innerHTML = html;
    el.querySelectorAll('.copy-btn[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyToClipboard(btn.getAttribute('data-copy'), btn);
      });
    });
  }

  function loadServerInfo() {
    api('/api/server_info').then(function (data) {
      if (data) {
        renderServerStatus(data);
        renderClientConfig(data);
      }
    });
  }

  function showList(data) {
    var list = document.getElementById('clientList');
    var updated = document.getElementById('updated');
    list.innerHTML = '';
    if (data && data.ids && data.ids.length) {
      data.ids.forEach(function (id) {
        var li = document.createElement('li');
        li.textContent = id;
        list.appendChild(li);
      });
      updated.textContent = 'Updated: ' + (data.updated || '');
    } else {
      var li = document.createElement('li');
      li.textContent = 'No client IDs (run Refresh or check server logs)';
      li.style.color = 'var(--muted)';
      list.appendChild(li);
      updated.textContent = '';
    }
  }

  function loadClientIds() {
    api('/api/client_ids').then(function (data) {
      if (data) showList(data);
    });
  }

  loadServerInfo();
  loadClientIds();

  document.getElementById('btnRefresh').addEventListener('click', function () {
    loadServerInfo();
    api('/api/client_ids?refresh=1').then(function (data) {
      if (data) showList(data);
    });
  });

  document.getElementById('btnLogout').addEventListener('click', function () {
    api('/api/logout', { method: 'POST' }).then(function () {
      window.location.reload();
    });
  });

  document.getElementById('btnSettings').addEventListener('click', function () {
    document.getElementById('settingsModal').classList.remove('hidden');
    document.getElementById('settingsMsg').classList.add('hidden');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newPassword2').value = '';
  });

  document.getElementById('btnCloseSettings').addEventListener('click', function () {
    document.getElementById('settingsModal').classList.add('hidden');
  });

  document.getElementById('btnSavePassword').addEventListener('click', function () {
    var cur = document.getElementById('currentPassword').value;
    var new1 = document.getElementById('newPassword').value;
    var new2 = document.getElementById('newPassword2').value;
    var msgEl = document.getElementById('settingsMsg');
    msgEl.classList.remove('hidden');
    if (!cur || !new1 || !new2) {
      msgEl.textContent = 'Fill all fields';
      msgEl.className = 'msg error';
      return;
    }
    if (new1 !== new2) {
      msgEl.textContent = 'New passwords do not match';
      msgEl.className = 'msg error';
      return;
    }
    api('/api/change_password', { method: 'POST', body: { current_password: cur, new_password: new1 } }).then(function (data) {
      if (data && data.ok) {
        msgEl.textContent = 'Password updated';
        msgEl.className = 'msg success';
        setTimeout(function () { document.getElementById('settingsModal').classList.add('hidden'); }, 800);
      } else {
        msgEl.textContent = (data && data.error) ? data.error : 'Failed';
        msgEl.className = 'msg error';
      }
    });
  });

})();
