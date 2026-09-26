document.addEventListener('DOMContentLoaded', () => {
    fetchStatus();
    fetchTunnels();
});

async function fetchStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('stat-ip').textContent = data.server_ip;
            document.getElementById('stat-count').textContent = `${data.active_tunnels} Tunnels`;
            document.getElementById('stat-version').textContent = data.core_version;
        }
    } catch (err) {
        console.error('Failed to fetch status:', err);
    }
}

async function fetchTunnels() {
    const container = document.getElementById('tunnels-list');
    container.innerHTML = '<div style="color: #94a3b8;">Loading tunnels...</div>';

    try {
        const res = await fetch('/api/tunnels');
        const data = await res.json();
        
        if (data.status === 'success') {
            document.getElementById('stat-count').textContent = `${data.tunnels.length} Tunnels`;
            renderTunnels(data.tunnels);
        }
    } catch (err) {
        container.innerHTML = '<div style="color: #f43f5e;">Failed to load tunnels.</div>';
    }
}

function renderTunnels(tunnels) {
    const container = document.getElementById('tunnels-list');
    container.innerHTML = '';

    if (tunnels.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: rgba(18, 24, 38, 0.5); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">
                <p style="color: #94a3b8; margin-bottom: 12px;">No active tunnels configured yet.</p>
                <button class="btn btn-primary" onclick="openCreateModal()">Create Your First Tunnel</button>
            </div>
        `;
        return;
    }

    tunnels.forEach(t => {
        const card = document.createElement('div');
        card.className = 'tunnel-card';
        const isRunning = t.status === 'running';

        card.innerHTML = `
            <div class="card-top">
                <span class="badge-mode ${t.mode.toLowerCase()}">${t.mode}</span>
                <span class="tunnel-status-badge ${t.status}">
                    <span class="dot ${isRunning ? 'online' : ''}"></span>
                    ${t.status.toUpperCase()}
                </span>
            </div>

            <div class="card-body">
                <h4>Port :${t.port}</h4>
                <div class="card-info">
                    <span class="info-pill">Protocol: ${t.transport.toUpperCase()}</span>
                    <span class="info-pill">${t.service_name}</span>
                </div>
            </div>

            <div class="latency-container">
                <span style="font-size: 12px; color: #94a3b8;">Connection Status:</span>
                <span id="latency-${t.id}" class="latency-badge">
                    Click 'Ping Test'
                </span>
            </div>

            <div class="card-actions">
                <button class="btn btn-primary btn-xs" onclick="testConnection('${t.id}')">⚡ Ping Test</button>
                <button class="btn btn-secondary btn-xs" onclick="tunnelAction('${t.id}', 'restart')">Restart</button>
                <button class="btn btn-secondary btn-xs" onclick="viewLogs('${t.service_name}')">Logs</button>
                <button class="btn btn-danger btn-xs" onclick="tunnelAction('${t.id}', 'delete')">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function testConnection(tunnelId) {
    const badge = document.getElementById(`latency-${tunnelId}`);
    if (badge) {
        badge.textContent = 'Testing...';
        badge.className = 'latency-badge';
    }

    try {
        const res = await fetch('/api/tunnels/test_connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tunnelId })
        });
        const data = await res.json();

        if (data.status === 'success' && data.connected) {
            badge.textContent = `Connected (${data.latency_ms} ms)`;
            badge.className = 'latency-badge connected';
        } else {
            badge.textContent = `Disconnected`;
            badge.className = 'latency-badge disconnected';
        }
    } catch (err) {
        if (badge) {
            badge.textContent = 'Error';
            badge.className = 'latency-badge disconnected';
        }
    }
}

function openCreateModal() {
    document.getElementById('create-modal').classList.remove('hidden');
    switchWizardTab('tab-basic');
}

function closeCreateModal() {
    document.getElementById('create-modal').classList.add('hidden');
}

function switchWizardTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');

    const activePane = document.getElementById(tabId);
    if (activePane) activePane.classList.add('active');
}

function toggleWizardFields() {
    const isClient = document.getElementById('mode-client').checked;
    const transport = document.getElementById('tunnel-transport').value;
    const tunEncapsulation = document.getElementById('tun-encapsulation').value;

    document.getElementById('group-remote').style.display = isClient ? 'block' : 'none';
    document.getElementById('group-tun-basic').style.display = (transport === 'tun') ? 'flex' : 'none';
    document.getElementById('group-ipx-profile').style.display = (transport === 'tun' && tunEncapsulation === 'ipx') ? 'block' : 'none';
}

async function handleCreateSubmit(event) {
    event.preventDefault();

    const mode = document.querySelector('input[name="mode"]:checked').value;
    const port = document.getElementById('tunnel-port').value.trim();
    const transport = document.getElementById('tunnel-transport').value;
    const tun_encapsulation = document.getElementById('tun-encapsulation').value;
    const ipx_profile = document.getElementById('ipx-profile').value;
    const remote_addr = document.getElementById('remote-addr').value.trim();

    // Security & Encryption
    const token = document.getElementById('tunnel-token').value.trim();
    const enable_encryption = document.getElementById('enable-encryption').value === 'true';
    const algorithm = document.getElementById('algorithm').value;
    const psk = document.getElementById('psk').value.trim();
    const kdf_iterations = parseInt(document.getElementById('kdf-iterations').value, 10);
    const tls_sni = document.getElementById('tls-sni').value.trim();

    // TUN & Mux
    const tun_name = document.getElementById('tun-name').value.trim();
    const tun_health_port = parseInt(document.getElementById('tun-health-port').value, 10);
    const tun_local_addr = document.getElementById('tun-local-addr').value.trim();
    const tun_remote_addr = document.getElementById('tun-remote-addr').value.trim();
    const mux_version = parseInt(document.getElementById('mux-version').value, 10);
    const mux_concurrency = parseInt(document.getElementById('mux-concurrency').value, 10);

    // Tuning
    const tuning_profile = document.getElementById('tuning-profile').value;
    const buffer_profile = document.getElementById('buffer-profile').value;
    const workers = parseInt(document.getElementById('workers').value, 10);
    const channel_size = parseInt(document.getElementById('channel-size').value, 10);
    const read_timeout = parseInt(document.getElementById('read-timeout').value, 10);

    // Ports
    const ports_mapping = document.getElementById('ports-mapping').value.trim();
    const forwarder = document.getElementById('forwarder').value;

    const payload = {
        mode,
        port,
        transport,
        tun_encapsulation,
        ipx_profile,
        remote_addr,
        token,
        enable_encryption,
        algorithm,
        psk,
        kdf_iterations,
        tls_sni,
        tun_name,
        tun_health_port,
        tun_local_addr,
        tun_remote_addr,
        mux_version,
        mux_concurrency,
        tuning_profile,
        buffer_profile,
        workers,
        channel_size,
        read_timeout,
        ports_mapping,
        forwarder
    };

    try {
        const res = await fetch('/api/tunnels/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            closeCreateModal();
            fetchTunnels();
            fetchStatus();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        alert('Failed to submit configuration.');
    }
}

async function tunnelAction(id, action) {
    if (action === 'delete' && !confirm(`Are you sure you want to delete tunnel ${id}?`)) {
        return;
    }

    try {
        const res = await fetch('/api/tunnels/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            fetchTunnels();
        } else {
            alert('Action failed: ' + data.message);
        }
    } catch (err) {
        alert('Request failed.');
    }
}

async function viewLogs(serviceName) {
    document.getElementById('logs-modal').classList.remove('hidden');
    document.getElementById('logs-title').textContent = `Logs for ${serviceName}`;
    const output = document.getElementById('logs-output');
    output.textContent = 'Loading live journal logs...';

    try {
        const res = await fetch(`/api/tunnels/logs?name=${serviceName}`);
        const data = await res.json();
        if (data.status === 'success') {
            output.textContent = data.logs.join('\n');
        }
    } catch (err) {
        output.textContent = 'Failed to load logs.';
    }
}

function closeLogsModal() {
    document.getElementById('logs-modal').classList.add('hidden');
}

function switchMainTab(tab) {
    if (tab === 'overview') {
        fetchTunnels();
    } else if (tab === 'logs') {
        viewLogs('wolfi-iran8443');
    }
}
