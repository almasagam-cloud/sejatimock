'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './admin.module.css';

interface Endpoint {
  _id: string;
  path: string;
  method: string;
  description: string;
  statusCode: number;
  responseBody: object;
  isActive: boolean;
  createdAt: string;
}

interface Stats {
  totalEndpoints: number;
  activeEndpoints: number;
  totalHits: number;
  hitsToday: number;
  topEndpoints: { _id: string; count: number; lastHit: string }[];
}

const DEFAULT_FORM = {
  path: '',
  method: 'POST',
  description: '',
  statusCode: 200,
  responseBody: '{\n  "status": true,\n  "data": {}\n}',
  isActive: true,
};

export default function AdminPage() {
  const [tab, setTab] = useState<'dashboard' | 'endpoints' | 'logs'>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [logs, setLogs] = useState<unknown[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filterPath, setFilterPath] = useState('');

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    setStats(data);
  }, []);

  const fetchEndpoints = useCallback(async () => {
    const res = await fetch('/api/admin/endpoints');
    const data = await res.json();
    setEndpoints(data.data ?? []);
  }, []);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ limit: '50', page: String(logPage) });
    if (filterPath) params.set('path', filterPath);
    const res = await fetch(`/api/admin/logs?${params}`);
    const data = await res.json();
    setLogs(data.data ?? []);
    setTotalLogs(data.total ?? 0);
  }, [logPage, filterPath]);

  useEffect(() => {
    fetchStats();
    fetchEndpoints();
  }, [fetchStats, fetchEndpoints]);

  useEffect(() => {
    if (tab === 'logs') fetchLogs();
  }, [tab, fetchLogs]);

  // Auto-refresh logs every 10s
  useEffect(() => {
    if (tab !== 'logs') return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [tab, fetchLogs]);

  // Auto-refresh stats every 15s
  useEffect(() => {
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (ep: Endpoint) => {
    setEditingId(ep._id);
    setForm({
      path: ep.path,
      method: ep.method,
      description: ep.description,
      statusCode: ep.statusCode,
      responseBody: JSON.stringify(ep.responseBody, null, 2),
      isActive: ep.isActive,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError('');
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(form.responseBody);
    } catch {
      setFormError('Response Body harus berupa JSON valid');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, responseBody: parsedResponse };
      const url = editingId ? `/api/admin/endpoints/${editingId}` : '/api/admin/endpoints';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Terjadi kesalahan');
        return;
      }
      setShowModal(false);
      await Promise.all([fetchEndpoints(), fetchStats()]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, path: string) => {
    if (!confirm(`Hapus endpoint '${path}'?`)) return;
    await fetch(`/api/admin/endpoints/${id}`, { method: 'DELETE' });
    await Promise.all([fetchEndpoints(), fetchStats()]);
  };

  const handleToggle = async (ep: Endpoint) => {
    await fetch(`/api/admin/endpoints/${ep._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !ep.isActive }),
    });
    await Promise.all([fetchEndpoints(), fetchStats()]);
  };

  const handleClearLogs = async () => {
    if (!confirm('Hapus semua log? Aksi ini tidak bisa dibatalkan.')) return;
    await fetch('/api/admin/logs', { method: 'DELETE' });
    setLogPage(1);
    await Promise.all([fetchLogs(), fetchStats()]);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'baru saja';
    if (mins < 60) return `${mins}m lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}j lalu`;
    return `${Math.floor(hrs / 24)}h lalu`;
  };

  const methodColor = (m: string) => {
    const map: Record<string, string> = { GET: '#22d3ee', POST: '#a78bfa', PUT: '#fb923c', DELETE: '#f87171', PATCH: '#4ade80' };
    return map[m] ?? '#94a3b8';
  };

  const statusColor = (code: number) => {
    if (code < 300) return '#4ade80';
    if (code < 400) return '#fb923c';
    return '#f87171';
  };

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>⚡</div>
          <div>
            <div className={styles.logoTitle}>Sejati</div>
            <div className={styles.logoSub}>Mock Server</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {(['dashboard', 'endpoints', 'logs'] as const).map((t) => (
            <button
              key={t}
              id={`nav-${t}`}
              className={`${styles.navItem} ${tab === t ? styles.navActive : ''}`}
              onClick={() => setTab(t)}
            >
              <span className={styles.navIcon}>
                {t === 'dashboard' ? '📊' : t === 'endpoints' ? '🔗' : '📋'}
              </span>
              <span>{t === 'dashboard' ? 'Dashboard' : t === 'endpoints' ? 'Endpoints' : 'Hit Logs'}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.apiKeyBadge}>
            <span className={styles.apiKeyLabel}>API Key</span>
            <code className={styles.apiKeyValue}>rahasia_chatbot_qibos_2026</code>
          </div>
          <div className={styles.baseUrl}>
            <span className={styles.apiKeyLabel}>Base URL</span>
            <code className={styles.apiKeyValue}>/api/asuransi/</code>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>Dashboard</h1>
              <p className={styles.pageSubtitle}>Monitor penggunaan dummy API server</p>
            </div>

            <div className={styles.statsGrid}>
              {[
                { label: 'Total Endpoint', value: stats?.totalEndpoints ?? '—', icon: '🔗', color: '#a78bfa' },
                { label: 'Endpoint Aktif', value: stats?.activeEndpoints ?? '—', icon: '✅', color: '#4ade80' },
                { label: 'Total Hit', value: stats?.totalHits ?? '—', icon: '📡', color: '#22d3ee' },
                { label: 'Hit Hari Ini', value: stats?.hitsToday ?? '—', icon: '📈', color: '#fb923c' },
              ].map((s, i) => (
                <div key={i} className={styles.statCard} style={{ '--accent': s.color } as React.CSSProperties}>
                  <div className={styles.statIcon}>{s.icon}</div>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>🔥 Top Endpoints</h2>
              {stats?.topEndpoints?.length === 0 && (
                <div className={styles.emptyState}>Belum ada hit. Coba panggil endpoint dulu!</div>
              )}
              <div className={styles.topList}>
                {stats?.topEndpoints?.map((ep, i) => (
                  <div key={ep._id} className={styles.topItem}>
                    <span className={styles.topRank}>#{i + 1}</span>
                    <code className={styles.topPath}>/api/asuransi/{ep._id}</code>
                    <span className={styles.topCount}>{ep.count} hits</span>
                    <span className={styles.topTime}>{timeAgo(ep.lastHit)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Endpoints */}
        {tab === 'endpoints' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <h1 className={styles.pageTitle}>Endpoints</h1>
                <p className={styles.pageSubtitle}>Kelola endpoint & response dummy</p>
              </div>
              <button id="btn-add-endpoint" className={styles.btnPrimary} onClick={openCreate}>
                + Add Endpoint
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Aktif</th>
                    <th>Dibuat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((ep) => (
                    <tr key={ep._id} className={!ep.isActive ? styles.rowInactive : ''}>
                      <td>
                        <code className={styles.pathCell}>/api/asuransi/{ep.path}</code>
                        {ep.description && <div className={styles.descCell}>{ep.description}</div>}
                      </td>
                      <td>
                        <span className={styles.methodBadge} style={{ color: methodColor(ep.method) }}>
                          {ep.method}
                        </span>
                      </td>
                      <td>
                        <span className={styles.statusBadge} style={{ color: statusColor(ep.statusCode) }}>
                          {ep.statusCode}
                        </span>
                      </td>
                      <td>
                        <button
                          id={`toggle-${ep._id}`}
                          className={`${styles.toggle} ${ep.isActive ? styles.toggleOn : styles.toggleOff}`}
                          onClick={() => handleToggle(ep)}
                          title={ep.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {ep.isActive ? '●' : '○'}
                        </button>
                      </td>
                      <td className={styles.dateCell}>{timeAgo(ep.createdAt)}</td>
                      <td>
                        <div className={styles.actions}>
                          <button id={`edit-${ep._id}`} className={styles.btnEdit} onClick={() => openEdit(ep)}>Edit</button>
                          <button id={`delete-${ep._id}`} className={styles.btnDelete} onClick={() => handleDelete(ep._id, ep.path)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {endpoints.length === 0 && (
                <div className={styles.emptyState}>Belum ada endpoint. Klik &ldquo;Add Endpoint&rdquo; untuk mulai.</div>
              )}
            </div>
          </div>
        )}

        {/* Logs */}
        {tab === 'logs' && (
          <div className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <h1 className={styles.pageTitle}>Hit Logs</h1>
                <p className={styles.pageSubtitle}>
                  {totalLogs} total hit • Auto-refresh setiap 10 detik
                </p>
              </div>
              <div className={styles.logActions}>
                <input
                  id="filter-path"
                  className={styles.filterInput}
                  placeholder="Filter by path..."
                  value={filterPath}
                  onChange={(e) => { setFilterPath(e.target.value); setLogPage(1); }}
                />
                <button id="btn-clear-logs" className={styles.btnDelete} onClick={handleClearLogs}>
                  Hapus Semua
                </button>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Method</th>
                    <th>Path</th>
                    <th>IP</th>
                    <th>Status</th>
                    <th>Durasi</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs as Record<string, unknown>[]).map((log) => {
                    const logId = String(log._id);
                    const isExpanded = expandedLog === logId;
                    return (
                      <>
                        <tr key={logId} className={styles.logRow}>
                          <td className={styles.dateCell}>{new Date(String(log.timestamp)).toLocaleString('id-ID')}</td>
                          <td>
                            <span className={styles.methodBadge} style={{ color: methodColor(String(log.method)) }}>
                              {String(log.method)}
                            </span>
                          </td>
                          <td><code className={styles.pathCell}>/api/asuransi/{String(log.path)}</code></td>
                          <td className={styles.ipCell}>{String(log.ip)}</td>
                          <td>
                            <span className={styles.statusBadge} style={{ color: statusColor(Number(log.responseStatusCode)) }}>
                              {String(log.responseStatusCode)}
                            </span>
                          </td>
                          <td className={styles.durationCell}>{Number(log.durationMs)}ms</td>
                          <td>
                            <button
                              id={`expand-log-${logId}`}
                              className={styles.btnExpand}
                              onClick={() => setExpandedLog(isExpanded ? null : logId)}
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${logId}-detail`} className={styles.logDetailRow}>
                            <td colSpan={7}>
                              <div className={styles.logDetail}>
                                <div className={styles.logDetailSection}>
                                  <div className={styles.logDetailTitle}>Request Body</div>
                                  <pre className={styles.logPre}>{JSON.stringify(log.requestBody, null, 2)}</pre>
                                </div>
                                <div className={styles.logDetailSection}>
                                  <div className={styles.logDetailTitle}>Response Body</div>
                                  <pre className={styles.logPre}>{JSON.stringify(log.responseBody, null, 2)}</pre>
                                </div>
                                <div className={styles.logDetailSection}>
                                  <div className={styles.logDetailTitle}>Request Headers</div>
                                  <pre className={styles.logPre}>{JSON.stringify(log.requestHeaders, null, 2)}</pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {logs.length === 0 && (
                <div className={styles.emptyState}>Belum ada hit yang tercatat.</div>
              )}
            </div>

            {/* Pagination */}
            {totalLogs > 50 && (
              <div className={styles.pagination}>
                <button
                  id="page-prev"
                  className={styles.btnPage}
                  disabled={logPage === 1}
                  onClick={() => setLogPage((p) => p - 1)}
                >
                  ← Prev
                </button>
                <span className={styles.pageInfo}>
                  Page {logPage} / {Math.ceil(totalLogs / 50)}
                </span>
                <button
                  id="page-next"
                  className={styles.btnPage}
                  disabled={logPage >= Math.ceil(totalLogs / 50)}
                  onClick={() => setLogPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingId ? 'Edit Endpoint' : 'Tambah Endpoint'}</h2>
              <button id="modal-close" className={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="form-path">Path *</label>
                  <div className={styles.pathInput}>
                    <span className={styles.pathPrefix}>/api/asuransi/</span>
                    <input
                      id="form-path"
                      className={styles.input}
                      value={form.path}
                      onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                      placeholder="validate"
                      disabled={!!editingId}
                    />
                  </div>
                </div>
                <div className={styles.formGroup} style={{ flex: '0 0 120px' }}>
                  <label className={styles.label} htmlFor="form-method">Method</label>
                  <select
                    id="form-method"
                    className={styles.select}
                    value={form.method}
                    onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                  >
                    {['POST', 'GET', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup} style={{ flex: '0 0 100px' }}>
                  <label className={styles.label} htmlFor="form-status">Status Code</label>
                  <input
                    id="form-status"
                    className={styles.input}
                    type="number"
                    value={form.statusCode}
                    onChange={(e) => setForm((f) => ({ ...f, statusCode: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="form-desc">Deskripsi</label>
                <input
                  id="form-desc"
                  className={styles.input}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Deskripsi singkat endpoint ini"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="form-response">Response Body (JSON) *</label>
                <textarea
                  id="form-response"
                  className={styles.textarea}
                  value={form.responseBody}
                  onChange={(e) => setForm((f) => ({ ...f, responseBody: e.target.value }))}
                  rows={12}
                  spellCheck={false}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    id="form-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Aktifkan endpoint ini
                </label>
              </div>

              {formError && <div className={styles.formError}>{formError}</div>}
            </div>

            <div className={styles.modalFooter}>
              <button id="modal-cancel" className={styles.btnSecondary} onClick={() => setShowModal(false)}>
                Batal
              </button>
              <button id="modal-save" className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Buat Endpoint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
