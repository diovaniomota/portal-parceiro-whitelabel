import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const createServiceRoleClient = () => {
  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE');

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

const extractBearerToken = (request: NextRequest) => {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
};

const PARTNER_ADMIN_TYPES = new Set(['partner_admin', 'partner']);

export async function requirePartnerPortalUser(request: NextRequest) {
  const supabaseAdmin = createServiceRoleClient();
  if (!supabaseAdmin) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Configuração do Supabase incompleta no portal.' },
        { status: 500 }
      )
    };
  }

  const token = extractBearerToken(request);
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Token ausente.' }, { status: 401 })
    };
  }

  const {
    data: { user },
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Sessão inválida.' }, { status: 401 })
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('app_users')
    .select('*')
    .eq('auth_id', user.id)
    .maybeSingle();

  const partnerId = String(profile?.partner_id || '').trim();
  const accountType = String(profile?.account_type || '').trim().toLowerCase();

  if (profileError || !partnerId || !PARTNER_ADMIN_TYPES.has(accountType)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Usuário não vinculado ao portal de parceiro.' },
        { status: 403 }
      )
    };
  }

  const { data: partner, error: partnerError } = await supabaseAdmin
    .from('partner_accounts')
    .select('id, name, slug, email, phone, logo_url, primary_color, portal_enabled, status, blocked_reason, blocked_at, license_price, monthly_fee, metadata')
    .eq('id', partnerId)
    .maybeSingle();

  if (partnerError || !partner) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Parceiro não encontrado.' }, { status: 404 })
    };
  }

  return {
    ok: true as const,
    supabaseAdmin,
    user,
    profile,
    partner
  };
}
