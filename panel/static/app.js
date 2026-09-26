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
    updateFormVisibility();
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

function updateFormVisibility() {
    const isServer = document.getElementById('mode-server').checked;
    const transport = document.getElementById('tunnel-transport').value;
    const isTun = (transport === 'tun');
    const tunEncap = document.getElementById('tun-encapsulation').value;
    const isIpx = (isTun && tunEncap === 'ipx');
    const ipxProfile = document.getElementById('ipx-profile').value;
    const isTls = ['anytls', 'wss', 'wssmux'].includes(transport);
    const isMux = transport.endsWith('mux');

    // 1. Bind port vs Remote Addr vs IPX (IPX has NO listener/dialer bind port!)
    const groupBindPort = document.getElementById('group-bind-port');
    const groupRemote = document.getElementById('group-remote');

    if (isIpx) {
        groupBindPort.style.display = 'none';
        groupRemote.style.display = 'none';
    } else if (isServer) {
        groupBindPort.style.display = 'block';
        groupRemote.style.display = 'none';
    } else {
        groupBindPort.style.display = 'none';
        groupRemote.style.display = 'block';
    }

    // 2. TUN & IPX Encap Options
    document.getElementById('group-tun-encap').style.display = isTun ? 'flex' : 'none';
    document.getElementById('group-ipx-profile').style.display = (isTun && tunEncap === 'ipx') ? 'block' : 'none';
    document.getElementById('group-ipx-network').style.display = isIpx ? 'flex' : 'none';
    document.getElementById('group-icmp-opts').style.display = (isIpx && ipxProfile === 'icmp') ? 'flex' : 'none';

    // 3. Security (IPX encryption vs standard Token)
    document.getElementById('group-token').style.display = isIpx ? 'none' : 'block';
    document.getElementById('group-ipx-security').style.display = isIpx ? 'block' : 'none';

    if (isIpx) {
        const encEnabled = (document.getElementById('enable-encryption').value === 'true');
        document.getElementById('group-alg-container').style.display = encEnabled ? 'block' : 'none';
        document.getElementById('group-psk-container').style.display = encEnabled ? 'flex' : 'none';
    }

    // 4. TLS Section (STRICT: Only for AnyTLS / WSS / WSSMUX!)
    document.getElementById('group-tls-section').style.display = isTls ? 'block' : 'none';

    // 5. TUN & Mux Details in Tab 3
    document.getElementById('group-tun-details').style.display = isTun ? 'block' : 'none';
    document.getElementById('group-mux-details').style.display = isMux ? 'block' : 'none';

    // Tab 3 Button Visibility
    document.getElementById('tab-btn-tun').style.display = (isTun || isMux) ? 'block' : 'none';

    // 6. Ports & Forwarder in Tab 5
    document.getElementById('group-ports-mapping').style.display = isServer ? 'block' : 'none';
    document.getElementById('group-forwarder').style.display = (isServer && isTun) ? 'block' : 'none';

    // 7. Buffer profile in Tuning
    document.getElementById('group-buffer-profile').style.display = (isTun || isIpx) ? 'none' : 'block';
}

async function handleCreateSubmit(event) {
    event.preventDefault();

    const mode = document.querySelector('input[name="mode"]:checked').value;
    const port = document.getElementById('tunnel-port').value.trim();
    const transport = document.getElementById('tunnel-transport').value;
    const tun_encapsulation = document.getElementById('tun-encapsulation').value;
    const ipx_profile = document.getElementById('ipx-profile').value;

    const payload = {
        mode,
        port,
        transport,
        tun_encapsulation,
        ipx_profile,
        ipx_listen_ip: document.getElementById('ipx-listen-ip').value.trim(),
        ipx_dst_ip: document.getElementById('ipx-dst-ip').value.trim(),
        ipx_interface: document.getElementById('ipx-interface').value.trim(),
        ipx_icmp_type: parseInt(document.getElementById('ipx-icmp-type').value, 10),
        ipx_icmp_code: parseInt(document.getElementById('ipx-icmp-code').value, 10),
        remote_addr: document.getElementById('remote-addr').value.trim(),

        token: document.getElementById('tunnel-token').value.trim(),
        enable_encryption: document.getElementById('enable-encryption').value === 'true',
        algorithm: document.getElementById('algorithm').value,
        psk: document.getElementById('psk').value.trim(),
        kdf_iterations: parseInt(document.getElementById('kdf-iterations').value, 10),
        tls_sni: document.getElementById('tls-sni').value.trim(),

        tun_name: document.getElementById('tun-name').value.trim(),
        tun_health_port: parseInt(document.getElementById('tun-health-port').value, 10),
        tun_local_addr: document.getElementById('tun-local-addr').value.trim(),
        tun_remote_addr: document.getElementById('tun-remote-addr').value.trim(),
        tun_mtu: parseInt(document.getElementById('tun-mtu').value, 10),

        mux_version: parseInt(document.getElementById('mux-version').value, 10),
        mux_concurrency: parseInt(document.getElementById('mux-concurrency').value, 10),

        tuning_profile: document.getElementById('tuning-profile').value,
        buffer_profile: document.getElementById('buffer-profile').value,
        workers: parseInt(document.getElementById('workers').value, 10),
        channel_size: parseInt(document.getElementById('channel-size').value, 10),

        ports_mapping: document.getElementById('ports-mapping').value.trim(),
        forwarder: document.getElementById('forwarder').value
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
