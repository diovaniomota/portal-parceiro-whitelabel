'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clipboard,
  Database,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
} from 'lucide-react';
import styles from './partnerLicenses.module.css';

export type PartnerLicense = {
  id: string;
  organizationId: string;
  status: string;
  databaseMode: 'local' | 'cloud';
  expiresAt: string | null;
  lastValidatedAt: string | null;
  blockedReason: string | null;
  notes: string | null;
};

type ClientMin = {
  id: string;
  nome_fantasia?: string | null;
  name?: string | null;
  cnpj?: string | null;
  status?: string | null;
};

type GeneratedKey = {
  key: string;
  orgName: string;
};

type BlockDraft = {
  licenseId: string;
  orgName: string;
  reason: string;
};

const DB_MODES = [
  {
    value: 'local' as const,
    label: 'Servidor local',
    desc: 'Banco instalado na rede do cliente (sem custo adicional)',
    icon: Server,
  },
  {
    value: 'cloud' as const,
    label: 'Banco em nuvem (VPS)',
    desc: 'Hospedado pela DartSoft — acrescenta R$ 30,00/mês no repasse',
    icon: Database,
  },
];

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  blocked: 'Bloqueada',
  past_due: 'Pendente',
  inactive: 'Inativa',
  revoked: 'Revogada',
};

const STATUS_CLASS: Record<string, string> = {
  active: styles.statusActive,
  blocked: styles.statusBlocked,
};

function clientName(c: ClientMin): string {
  return String(c.nome_fantasia || c.name || c.id || 'Cliente').trim();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function PartnerLicenses({
  clients,
  licenses: initialLicenses,
  partnerBlocked,
  authorizedFetch,
  onLicensesChange,
}: {
  clients: ClientMin[];
  licenses: PartnerLicense[];
  partnerBlocked: boolean;
  authorizedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onLicensesChange: (licenses: PartnerLicense[]) => void;
}) {
  const [licenses, setLicenses] = useState<PartnerLicense[]>(initialLicenses);
  const [reloading, setReloading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [genForm, setGenForm] = useState({
    organizationId: clients[0]?.id ?? '',
    databaseMode: 'local' as 'local' | 'cloud',
    expiresAt: '',
    notes: '',
  });

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 2800);
  }, []);

  const sync = useCallback(
    (updated: PartnerLicense[]) => {
      setLicenses(updated);
      onLicensesChange(updated);
    },
    [onLicensesChange]
  );

  const reload = useCallback(async () => {
    setReloading(true);
    setError('');
    try {
      const res = await authorizedFetch('/api/partner/licenses');
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload?.error || 'Falha ao carregar tokens.');
      sync(payload.licenses ?? []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar tokens.');
    } finally {
      setReloading(false);
    }
  }, [authorizedFetch, sync]);

  const handleGenerate = async () => {
    if (!genForm.organizationId) {
      setError('Selecione um cliente.');
      return;
    }
    setActionId('generate');
    setError('');
    setGeneratedKey(null);
    try {
      const res = await authorizedFetch('/api/partner/licenses', {
        method: 'POST',
        body: JSON.stringify(genForm),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) throw new Error(payload?.error || 'Falha ao gerar token.');
      const org = clients.find((c) => c.id === genForm.organizationId);
      setGeneratedKey({ key: payload.licenseKey, orgName: org ? clientName(org) : 'Cliente' });
      if (payload.license) {
        sync([payload.license, ...licenses.filter((l) => l.id !== payload.license.id && l.organizationId !== genForm.organizationId)]);
      }
      showNotice('Token gerado com sucesso.');
    } catch (err: any) {
      setError(err?.message || 'Falha ao gerar token.');
    } finally {
      setActionId('');
    }
  };

  const patch = useCallback(
    async (licenseId: string, body: Record<string, unknown>) => {
      setActionId(licenseId);
      setError('');
      try {
        const res = await authorizedFetch('/api/partner/licenses', {
          method: 'PATCH',
          body: JSON.stringify({ licenseId, ...body }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.success) throw new Error(payload?.error || 'Falha ao atualizar.');
        if (payload.license) {
          sync(licenses.map((l) => (l.id === payload.license.id ? payload.license : l)));
        }
        showNotice('Token atualizado.');
        return true;
      } catch (err: any) {
        setError(err?.message || 'Falha ao atualizar token.');
        return false;
      } finally {
        setActionId('');
      }
    },
    [authorizedFetch, licenses, sync, showNotice]
  );

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      showNotice('Token copiado!');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = key;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showNotice('Token copiado!');
    }
  };

  const confirmBlock = async () => {
    if (!blockDraft) return;
    const ok = await patch(blockDraft.licenseId, {
      status: 'blocked',
      blockedReason: blockDraft.reason,
    });
    if (ok) setBlockDraft(null);
  };

  const clientMap = useMemo(() => {
    const map = new Map<string, ClientMin>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const existingByOrg = useMemo(() => {
    const map = new Map<string, PartnerLicense>();
    for (const l of licenses) {
      if (!map.has(l.organizationId)) map.set(l.organizationId, l);
    }
    return map;
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return licenses;
    return licenses.filter((lic) => {
      const c = clientMap.get(lic.organizationId);
      const hay = [c ? clientName(c) : '', lic.status, lic.databaseMode, lic.notes ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [licenses, search, clientMap]);

  const hasExisting = existingByOrg.has(genForm.organizationId);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Acesso desktop</p>
          <h1 className={styles.title}>Tokens Desktop</h1>
          <p className={styles.subtitle}>
            Gere um token para cada cliente e escolha se o banco será local ou em nuvem (VPS).
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={reloading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            background: '#ffffff',
            color: '#374151',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </header>

      {notice ? (
        <div className={styles.notice}>
          <CheckCircle2 size={16} />
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className={styles.errorBox}>
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      <div className={styles.topGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <KeyRound size={22} />
            <div>
              <h2>Token gerado</h2>
              <p>Copie e entregue ao cliente para configurar o acesso desktop.</p>
            </div>
          </div>

          <div className={styles.copyGroup}>
            <label>Chave de acesso</label>
            <div className={styles.copyRow}>
              <input
                value={generatedKey?.key ?? ''}
                readOnly
                placeholder="Gere um token para exibir aqui"
              />
              <button
                type="button"
                disabled={!generatedKey?.key}
                onClick={() => generatedKey && copyKey(generatedKey.key)}
              >
                <Clipboard size={14} />
                Copiar
              </button>
            </div>
          </div>

          {generatedKey?.key ? (
            <div className={styles.generatedBox}>
              <CheckCircle2 size={18} />
              <div>
                <strong>{generatedKey.orgName}</strong>
                <span>{generatedKey.key}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Database size={22} />
            <div>
              <h2>Gerar token por cliente</h2>
              <p>Escolha o cliente e o modo de banco de dados.</p>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Cliente</label>
            <select
              value={genForm.organizationId}
              onChange={(e) => setGenForm((prev) => ({ ...prev, organizationId: e.target.value }))}
              disabled={actionId === 'generate' || partnerBlocked}
            >
              {clients.length === 0 ? (
                <option value="">Nenhum cliente cadastrado</option>
              ) : null}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientName(c)}
                  {c.cnpj ? ` — ${c.cnpj}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Modo de banco</label>
            <div className={styles.dbModeGrid}>
              {DB_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    className={`${styles.dbModeButton} ${genForm.databaseMode === mode.value ? styles.dbModeActive : ''}`}
                    onClick={() =>
                      setGenForm((prev) => ({ ...prev, databaseMode: mode.value }))
                    }
                    disabled={actionId === 'generate' || partnerBlocked}
                  >
                    <Icon size={18} />
                    <div>
                      <strong>{mode.label}</strong>
                      <small>{mode.desc}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.inlineFields}>
            <div className={styles.formGroup}>
              <label>Vencimento</label>
              <input
                type="date"
                value={genForm.expiresAt}
                onChange={(e) => setGenForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                disabled={actionId === 'generate' || partnerBlocked}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Observação</label>
              <input
                type="text"
                value={genForm.notes}
                onChange={(e) => setGenForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Contrato, condição etc."
                disabled={actionId === 'generate' || partnerBlocked}
              />
            </div>
          </div>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleGenerate}
            disabled={
              actionId === 'generate' ||
              partnerBlocked ||
              !genForm.organizationId
            }
          >
            <KeyRound size={18} />
            {actionId === 'generate'
              ? 'Gerando...'
              : hasExisting
              ? 'Gerar novo token'
              : 'Gerar token'}
          </button>
        </div>
      </div>

      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <div>
            <h2>Tokens gerados</h2>
            <p>{filteredLicenses.length} token(s)</p>
          </div>
          <div className={styles.searchBox}>
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente ou status"
            />
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Status</th>
                <th>Banco</th>
                <th>Vencimento</th>
                <th>Última validação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {reloading ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>Carregando...</td>
                </tr>
              ) : null}

              {!reloading && filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>Nenhum token gerado ainda.</td>
                </tr>
              ) : null}

              {!reloading &&
                filteredLicenses.map((lic) => {
                  const c = clientMap.get(lic.organizationId);
                  const busy = actionId === lic.id;
                  const statusLabel = STATUS_LABELS[lic.status] ?? lic.status;
                  const statusClass = STATUS_CLASS[lic.status] ?? styles.statusInactive;

                  return (
                    <tr key={lic.id}>
                      <td>
                        <strong>{c ? clientName(c) : lic.organizationId}</strong>
                        {c?.cnpj ? <small>{c.cnpj}</small> : null}
                        {lic.notes ? <small>{lic.notes}</small> : null}
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>
                      </td>
                      <td>
                        <select
                          className={styles.modeSelect}
                          value={lic.databaseMode}
                          disabled={busy || partnerBlocked}
                          aria-label={`Modo de banco de ${c ? clientName(c) : lic.organizationId}`}
                          onChange={(e) =>
                            void patch(lic.id, { databaseMode: e.target.value })
                          }
                        >
                          {DB_MODES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{fmtDate(lic.expiresAt)}</td>
                      <td>{fmtDateTime(lic.lastValidatedAt)}</td>
                      <td>
                        <div className={styles.actions}>
                          {lic.status !== 'active' ? (
                            <button
                              type="button"
                              disabled={busy || partnerBlocked}
                              onClick={() => void patch(lic.id, { status: 'active' })}
                            >
                              <CheckCircle2 size={14} />
                              Liberar
                            </button>
                          ) : null}
                          {lic.status !== 'blocked' ? (
                            <button
                              type="button"
                              disabled={busy || partnerBlocked}
                              onClick={() =>
                                setBlockDraft({
                                  licenseId: lic.id,
                                  orgName: c ? clientName(c) : lic.organizationId,
                                  reason: lic.blockedReason ?? 'Bloqueado pelo parceiro.',
                                })
                              }
                            >
                              <Ban size={14} />
                              Bloquear
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy || partnerBlocked}
                            onClick={() => {
                              setGenForm((prev) => ({
                                ...prev,
                                organizationId: lic.organizationId,
                                databaseMode: lic.databaseMode,
                              }));
                              setGeneratedKey(null);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            <RotateCcw size={14} />
                            Renovar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {blockDraft ? (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.modalCard} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <div>
                <h2>Bloquear token</h2>
                <p>{blockDraft.orgName}</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setBlockDraft(null)}
                disabled={actionId === blockDraft.licenseId}
              >
                ×
              </button>
            </div>

            <div className={styles.formGroup}>
              <label>Motivo do bloqueio</label>
              <textarea
                rows={3}
                value={blockDraft.reason}
                onChange={(e) =>
                  setBlockDraft((prev) => (prev ? { ...prev, reason: e.target.value } : prev))
                }
                disabled={actionId === blockDraft.licenseId}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setBlockDraft(null)}
                disabled={actionId === blockDraft.licenseId}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={confirmBlock}
                disabled={actionId === blockDraft.licenseId}
              >
                <Ban size={16} />
                {actionId === blockDraft.licenseId ? 'Bloqueando...' : 'Confirmar bloqueio'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
