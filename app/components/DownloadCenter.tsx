'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, Package, RefreshCw } from 'lucide-react';

type GithubAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

type GithubRelease = {
  tag_name: string;
  published_at: string;
  assets: GithubAsset[];
};

type AppCard = {
  name: string;
  repo: string;
  color: string;
  tag: string | null;
  publishedAt: string | null;
  downloadUrl: string | null;
  fileName: string | null;
  fileSize: string | null;
  loading: boolean;
  error: string;
};

const APPS: Pick<AppCard, 'name' | 'repo' | 'color'>[] = [
  { name: 'DartWork', repo: 'diovaniomota/dartwork-releases', color: '#2563eb' },
  { name: 'DartChef', repo: 'diovaniomota/dartchef-releases', color: '#e25c2a' },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function fetchRelease(repo: string): Promise<GithubRelease> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub: HTTP ${res.status}`);
  return res.json() as Promise<GithubRelease>;
}

export default function DownloadCenter() {
  const [apps, setApps] = useState<AppCard[]>(
    APPS.map((def) => ({
      ...def,
      tag: null,
      publishedAt: null,
      downloadUrl: null,
      fileName: null,
      fileSize: null,
      loading: true,
      error: '',
    }))
  );

  const load = useCallback(() => {
    setApps((prev) => prev.map((app) => ({ ...app, loading: true, error: '' })));

    APPS.forEach((def, index) => {
      fetchRelease(def.repo)
        .then((release) => {
          const exe = release.assets.find((a) => a.name.endsWith('.exe'));
          const fallbackUrl = `https://github.com/${def.repo}/releases/latest/download/setup.exe`;
          setApps((prev) =>
            prev.map((app, i) =>
              i !== index
                ? app
                : {
                    ...app,
                    tag: release.tag_name,
                    publishedAt: release.published_at,
                    downloadUrl: exe?.browser_download_url ?? fallbackUrl,
                    fileName: exe?.name ?? 'setup.exe',
                    fileSize: exe ? formatBytes(exe.size) : null,
                    loading: false,
                    error: '',
                  }
            )
          );
        })
        .catch((err: unknown) => {
          setApps((prev) =>
            prev.map((app, i) =>
              i !== index
                ? app
                : {
                    ...app,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Falha ao carregar',
                  }
            )
          );
        });
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-xs)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px',
              color: 'var(--primary)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Instaladores
          </p>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.9375rem', fontWeight: 600 }}>
            Centro de downloads
          </h2>
        </div>
        <button className="btn btnSecondary" type="button" onClick={load}>
          <RefreshCw size={15} />
          Atualizar
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          padding: 16,
        }}
      >
        {apps.map((app) => (
          <div
            key={app.name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-hover)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: app.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#fff',
                  boxShadow: `0 2px 8px ${app.color}40`,
                }}
              >
                <Package size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                  {app.name}
                </div>
                {app.loading ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Buscando versão...
                  </div>
                ) : app.error ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--danger)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <AlertCircle size={12} />
                    {app.error}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {app.tag}
                    {app.publishedAt ? ` · ${formatDate(app.publishedAt)}` : ''}
                  </div>
                )}
              </div>
            </div>

            {!app.loading && !app.error && app.fileSize ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {app.fileName} · {app.fileSize}
              </div>
            ) : null}

            <a
              href={app.downloadUrl ?? undefined}
              download
              className="btn btnPrimary"
              style={{
                textDecoration: 'none',
                pointerEvents: app.loading || !app.downloadUrl ? 'none' : undefined,
                opacity: app.loading || !app.downloadUrl ? 0.5 : 1,
                background: app.color,
                boxShadow: `0 1px 3px ${app.color}40`,
              }}
              aria-disabled={app.loading || !app.downloadUrl}
            >
              <Download size={15} />
              {app.loading ? 'Carregando...' : 'Baixar instalador (.exe)'}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
