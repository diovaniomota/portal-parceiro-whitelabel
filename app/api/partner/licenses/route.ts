import { createHash, randomBytes } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerPortalUser } from '@/app/lib/serverSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_OFFLINE_DAYS = 5;

const LICENSE_SELECT =
  'id, organization_id, status, allowed_offline_days, expires_at, last_validated_at, blocked_reason, notes, metadata, created_at';

function generateLicenseKey(): string {
  const a = randomBytes(8).toString('hex').toUpperCase();
  const b = randomBytes(8).toString('hex').toUpperCase();
  const c = randomBytes(4).toString('hex').toUpperCase();
  return `DART-${a}-${b}-${c}`;
}

function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

function normalizeDatabaseMode(value: unknown): 'local' | 'cloud' {
  const v = String(value || '').trim().toLowerCase();
  return ['cloud', 'nuvem', 'online', 'hosted'].includes(v) ? 'cloud' : 'local';
}

function normalizeDateOrNull(value: unknown): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeLicense(row: Record<string, any>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: String(row.status || 'active'),
    databaseMode: normalizeDatabaseMode(
      row.metadata?.database_mode || row.metadata?.databaseMode || 'local'
    ),
    expiresAt: row.expires_at || null,
    lastValidatedAt: row.last_validated_at || null,
    blockedReason: row.blocked_reason || null,
    notes: row.notes || null,
  };
}

async function getPartnerOrgIds(supabaseAdmin: any, partnerId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('partner_id', partnerId);
  if (error) throw new Error(error.message);
  return (data || []).map((o: any) => String(o.id));
}

async function verifyOrgBelongsToPartner(
  supabaseAdmin: any,
  organizationId: string,
  partnerId: string
): Promise<{ id: string; nome_fantasia?: string; name?: string } | null> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('id, nome_fantasia, name')
    .eq('id', organizationId)
    .eq('partner_id', partnerId)
    .maybeSingle();
  return data || null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePartnerPortalUser(request);
    if (!auth.ok) return auth.response;

    const orgIds = await getPartnerOrgIds(auth.supabaseAdmin, auth.partner.id);

    if (orgIds.length === 0) {
      return NextResponse.json({ success: true, licenses: [] });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('platform_licenses')
      .select(LICENSE_SELECT)
      .in('organization_id', orgIds)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      licenses: (data || []).map(normalizeLicense),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro interno.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePartnerPortalUser(request);
    if (!auth.ok) return auth.response;

    if (auth.partner.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Parceiro bloqueado pela plataforma.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const organizationId = String(body.organizationId || '').trim();

    if (!organizationId) {
      return NextResponse.json({ success: false, error: 'Cliente não informado.' }, { status: 400 });
    }

    const org = await verifyOrgBelongsToPartner(auth.supabaseAdmin, organizationId, auth.partner.id);
    if (!org) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    const databaseMode = normalizeDatabaseMode(body.databaseMode);
    const licenseKey = generateLicenseKey();
    const nowIso = new Date().toISOString();

    const { data: existing } = await auth.supabaseAdmin
      .from('platform_licenses')
      .select('id, metadata')
      .eq('organization_id', organizationId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })
      .limit(1);

    let result: any;
    let dbError: any;

    if (existing?.[0]?.id) {
      const currentMeta = existing[0].metadata || {};
      const updatePayload = {
        license_key_hash: hashKey(licenseKey),
        installation_id: null,
        machine_fingerprint_hash: null,
        status: 'active',
        blocked_reason: null,
        allowed_offline_days: ALLOWED_OFFLINE_DAYS,
        expires_at: normalizeDateOrNull(body.expiresAt) ?? null,
        notes: String(body.notes || '').trim() || null,
        metadata: {
          ...currentMeta,
          database_mode: databaseMode,
          regenerated_by: auth.user.id,
          regenerated_at: nowIso,
          source: 'partner_portal',
        },
      };
      ({ data: result, error: dbError } = await auth.supabaseAdmin
        .from('platform_licenses')
        .update(updatePayload)
        .eq('id', existing[0].id)
        .select(LICENSE_SELECT)
        .single());
    } else {
      const insertPayload = {
        organization_id: organizationId,
        license_key_hash: hashKey(licenseKey),
        status: 'active',
        allowed_offline_days: ALLOWED_OFFLINE_DAYS,
        expires_at: normalizeDateOrNull(body.expiresAt) ?? null,
        notes: String(body.notes || '').trim() || null,
        created_by: auth.user.id,
        metadata: {
          source: 'partner_portal',
          database_mode: databaseMode,
          issued_by: auth.user.id,
          issued_at: nowIso,
        },
      };
      ({ data: result, error: dbError } = await auth.supabaseAdmin
        .from('platform_licenses')
        .insert(insertPayload)
        .select(LICENSE_SELECT)
        .single());
    }

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({
      success: true,
      license: normalizeLicense(result),
      licenseKey,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro ao gerar token.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePartnerPortalUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const licenseId = String(body.licenseId || '').trim();

    if (!licenseId) {
      return NextResponse.json({ success: false, error: 'Token não informado.' }, { status: 400 });
    }

    const { data: lic, error: licError } = await auth.supabaseAdmin
      .from('platform_licenses')
      .select('id, organization_id, metadata')
      .eq('id', licenseId)
      .maybeSingle();

    if (licError || !lic) {
      return NextResponse.json({ success: false, error: 'Token não encontrado.' }, { status: 404 });
    }

    const org = await verifyOrgBelongsToPartner(auth.supabaseAdmin, lic.organization_id, auth.partner.id);
    if (!org) {
      return NextResponse.json({ success: false, error: 'Acesso negado.' }, { status: 403 });
    }

    const updatePayload: Record<string, any> = {};

    if (body.status !== undefined) {
      const status = body.status === 'blocked' ? 'blocked' : 'active';
      updatePayload.status = status;
      if (status === 'active') {
        updatePayload.blocked_reason = null;
      } else {
        updatePayload.blocked_reason =
          String(body.blockedReason || 'Bloqueado pelo parceiro.').trim() ||
          'Bloqueado pelo parceiro.';
      }
    }

    if (body.databaseMode !== undefined) {
      updatePayload.metadata = {
        ...(lic.metadata || {}),
        database_mode: normalizeDatabaseMode(body.databaseMode),
        database_mode_updated_by: auth.user.id,
        database_mode_updated_at: new Date().toISOString(),
      };
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhuma alteração enviada.' }, { status: 400 });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('platform_licenses')
      .update(updatePayload)
      .eq('id', licenseId)
      .select(LICENSE_SELECT)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, license: normalizeLicense(data) });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro ao atualizar token.' },
      { status: 500 }
    );
  }
}
